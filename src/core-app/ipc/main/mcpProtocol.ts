/**
 * Minimal MCP server over Streamable HTTP.
 *
 * WHY THIS EXISTS
 * ---------------
 * The embedded Claude CLI agent used to reach Downlodr only by shelling out to
 * a `downlodr` binary through its Bash tool. That binary is a shim written at
 * launch by ensureDownlodrCliOnPath() (chatHandler.ts), and the shim is
 * `node "<bundle>" "$@"` — so the whole chat feature silently required a system
 * Node.js AND Git Bash (Claude Code's Bash tool runs under MSYS on Windows) on
 * every end user's machine. Users who let Downlodr install Claude Code for them
 * fall through to the native installer, which needs no Node at all, so they
 * ended up with a working `claude` and no `downlodr` — the agent then reported
 * "the downlodr CLI isn't installed on PATH" and improvised from there.
 *
 * Serving MCP from the bridge the app already runs removes every link in that
 * chain: no shim, no PATH, no Node, no Bash tool. The agent connects over
 * loopback HTTP with the bearer token the bridge already issues.
 *
 * WHY IT IS HAND-ROLLED
 * ---------------------
 * @modelcontextprotocol/sdk is not a dependency of the app (only of the
 * separate downlodr-mcp package, where it is bundled into a dependency-free
 * dist). Pulling it into the main-process bundle means teaching
 * vite.main.config.ts's external/rewrite machinery about another ESM package
 * with subpath exports, plus a packaging change. The slice of the protocol a
 * single local client needs is four methods, so the transport is implemented
 * here directly and kept deliberately small.
 *
 * WHY ONLY TWO TOOLS
 * ------------------
 * downlodr-mcp registers 106 tools and cli.ts exposes 136 subcommands.
 * Advertising those over MCP would push every name, description and schema
 * into the model's context on every turn. Instead this mirrors the shape the
 * in-process agentic path already uses (CLI_ARG_SPECS / parseCliArgv in
 * chatHandler.ts): one `run_downlodr` that takes the argv the docs already
 * teach, and one `read_doc`. The docs and the installed Agent Skills stay
 * authoritative about WHICH command to run and need no rewriting — only the
 * transport instruction in the system prompt changes.
 */

import type * as http from 'http';

/** Protocol version echoed back when a client does not name one. */
const DEFAULT_PROTOCOL_VERSION = '2025-06-18';

export const MCP_ENDPOINT_PATH = '/mcp';

/**
 * Runs one tool call and returns its result as a JSON/text payload. Registered
 * by chatHandler.ts, which owns the argv parser and the doc reader — the same
 * two entry points its in-process agentic loop uses, so both chat backends go
 * through one dispatcher instead of drifting apart.
 */
export type McpToolDispatcher = (
  tool: string,
  args: Record<string, unknown>,
) => Promise<string>;

let dispatcher: McpToolDispatcher | null = null;

export function registerMcpToolDispatcher(fn: McpToolDispatcher | null): void {
  dispatcher = fn;
}

/** True once a dispatcher is wired — the preflight check reads this. */
export function mcpToolsReady(): boolean {
  return dispatcher !== null;
}

// Tool descriptions are written for the model, not for humans: they restate the
// CLI shape the docs use so the agent can translate a documented
// `downlodr <command> --flag value` line straight into an args array.
const TOOLS = [
  {
    name: 'run_downlodr',
    description:
      'Run one Downlodr command. Pass the command and its flags as a flat ' +
      'argv array, exactly as the docs and skills write them. Example: the ' +
      'documented line `downlodr get_video_info --url https://...` becomes ' +
      'args: ["get_video_info", "--url", "https://..."]. Always start a task ' +
      'with ["get_app_status"]. Destructive and file-writing commands are ' +
      'gated: the app asks the user to confirm before they run, and the tool ' +
      'result says so if they decline — do not retry a declined command.',
    inputSchema: {
      type: 'object',
      properties: {
        args: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Command name first, then its flags and values as separate ' +
            'entries, e.g. ["queue_download", "--url", "https://..."].',
        },
      },
      required: ['args'],
      additionalProperties: false,
    },
  },
  {
    name: 'read_doc',
    description:
      'Read one Downlodr task doc. Start with "README.md" for the index, then ' +
      'read the doc matching the request — it gives the exact command ' +
      'sequence, prerequisite order, flags and defaults. Paths are relative ' +
      'to the docs root, e.g. "core/downloads/download-video.md".',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Doc path relative to the docs root, e.g. "README.md".',
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
];

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function result(id: JsonRpcRequest['id'], value: unknown) {
  return { jsonrpc: '2.0', id, result: value };
}

function rpcError(
  id: JsonRpcRequest['id'],
  code: number,
  message: string,
): unknown {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/**
 * Handle one JSON-RPC message. Returns the response object, or null for a
 * notification (which must be answered with 202 and an empty body).
 */
async function handleMessage(msg: JsonRpcRequest): Promise<unknown | null> {
  const { id, method, params } = msg;

  // Notifications carry no id and expect no response body.
  if (method?.startsWith('notifications/')) return null;

  switch (method) {
    case 'initialize': {
      // Echo the client's protocol version when it names one: Claude Code
      // refuses a server that answers with a version it did not ask for.
      const asked = (params?.protocolVersion as string) || undefined;
      return result(id, {
        protocolVersion: asked ?? DEFAULT_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'downlodr', version: '1.0.0' },
      });
    }

    case 'ping':
      return result(id, {});

    case 'tools/list':
      return result(id, { tools: TOOLS });

    case 'tools/call': {
      const name = params?.name as string;
      const args = (params?.arguments as Record<string, unknown>) ?? {};
      if (!TOOLS.some((t) => t.name === name)) {
        return rpcError(id, -32602, `Unknown tool: ${name}`);
      }
      if (!dispatcher) {
        // Handlers register after the chat surface opens (see the two-phase
        // startup note in chatHandler.ts). Report it as a tool error rather
        // than a protocol error so the agent can surface it to the user.
        return result(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error:
                  'Downlodr is still starting up. Wait a moment and try again.',
              }),
            },
          ],
          isError: true,
        });
      }
      try {
        const text = await dispatcher(name, args);
        return result(id, { content: [{ type: 'text', text }] });
      } catch (err) {
        return result(id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
          isError: true,
        });
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

/**
 * Serve one HTTP request against the MCP endpoint. The caller has already
 * checked the bearer token and matched MCP_ENDPOINT_PATH.
 *
 * Only the JSON half of Streamable HTTP is implemented: a POST carrying one or
 * more JSON-RPC messages is answered with a single `application/json` body.
 * The spec allows this whenever the server has no server-initiated messages to
 * stream, which is the case here — every tool call is strictly
 * request/response. GET (the client's SSE listening channel) is answered 405,
 * also explicitly allowed for servers that never push.
 */
export async function handleMcpHttp(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  body: unknown,
  send: (status: number, payload: unknown) => void,
): Promise<void> {
  const method = req.method ?? 'GET';

  if (method === 'GET') {
    res.writeHead(405, { Allow: 'POST, DELETE' });
    res.end();
    return;
  }

  // Stateless: there is exactly one local client and no session state to drop.
  if (method === 'DELETE') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (method !== 'POST') {
    res.writeHead(405, { Allow: 'POST, DELETE' });
    res.end();
    return;
  }

  const batch = Array.isArray(body)
    ? (body as JsonRpcRequest[])
    : [body as JsonRpcRequest];

  const responses: unknown[] = [];
  for (const msg of batch) {
    const answer = await handleMessage(msg ?? {});
    if (answer !== null) responses.push(answer);
  }

  // Every message was a notification — nothing to say back.
  if (responses.length === 0) {
    res.writeHead(202);
    res.end();
    return;
  }

  send(200, Array.isArray(body) ? responses : responses[0]);
}
