/**
 * MCP Bridge Server — runs inside the Electron main process OR as a
 * standalone headless Node.js process.
 *
 * Exposes a local HTTP + WebSocket server on 127.0.0.1:7185 so the
 * downlodr-mcp Node.js process (the MCP server Claude talks to) can
 * call into all Downlodr services.
 *
 * Security: a random bearer token is generated at each launch and written
 * to {userData}/mcp-token.txt (mode 0o600). The MCP client reads that file
 * at startup. The server only binds to loopback.
 *
 * Service instances are registered after the IPC handlers initialise them
 * (see registerHandlers.ts → startMcpBridgeServer call order).
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { WebSocketServer } from 'ws';
import type { WebSocket as WS } from 'ws';
import * as YTDLP from 'yt-dlp-helper';
import { describeVideoInfoFailure } from './videoInfoResult';
import {
  DETACH_REASON,
  describeDetachedWait,
  registerDetachedApproval,
  takeDetachedApproval,
} from './detachedApproval';
import { resolveCookiesForCall } from './cookieAuth/state';
import os from 'os';
import { getUserDataPath, getAppVersion } from '../../utils/platformPaths';
import { hydratePlaylistEntries } from './playlistEntryMetadata';
import { toChannelDetails, type ToolkitChannelDetails } from './channelDetails';
import {
  APPROVAL_TIMEOUT_MS,
  MAX_BATCH_ITEMS,
  applyApprovalPatch,
  currentActionApprover,
  currentAddonDownloadChecker,
  normalizeDownloadItems,
  resolveGatedAction,
  type DownloadItem,
  type GatedAction as GatedActionType,
} from './actionGate';
import { buildAddonRequiredAction, resolveRequiredAddon } from './addonGate';
import { MCP_ENDPOINT_PATH, handleMcpHttp } from './mcpProtocol';

// Lazy Electron loader — safe to call in headless mode (returns null).
type ElectronApp = typeof import('electron')['app'];
type ElectronIpcMain = typeof import('electron')['ipcMain'];
let _electronApp: ElectronApp | null = null;
let _electronIpcMain: ElectronIpcMain | null = null;
let _electronTried = false;
function getElectronApp(): ElectronApp | null {
  if (!_electronTried) {
    _electronTried = true;
    try {
      const electron = require('electron') as typeof import('electron');
      _electronApp = electron.app;
      _electronIpcMain = electron.ipcMain;
    } catch {
      /* headless */
    }
  }
  return _electronApp;
}
function getElectronIpcMain(): ElectronIpcMain | null {
  if (!_electronTried) getElectronApp();
  return _electronIpcMain;
}

function resolveUserDataPath(): string {
  return getElectronApp()?.getPath('userData') ?? getUserDataPath();
}

function resolveAppVersion(): string {
  return getElectronApp()?.getVersion() ?? getAppVersion();
}

export const MCP_BRIDGE_PORT = 7185;

let server: http.Server | null = null;
let wss: InstanceType<typeof WebSocketServer> | null = null;
let bearerToken = '';

const wsClients = new Set<WS>();

// ─── service registry ─────────────────────────────────────────────────────────
// Services are registered by their handler after init. The bridge calls them
// directly rather than going through ipcMain, so no fake event objects needed.

interface SkedulosaServices {
  dbPath: string;
}

let skedulosaServices: SkedulosaServices | null = null;
let _sendToRenderer: ((channel: string, payload: unknown) => void) | null =
  null;

/**
 * AFDA services now live in the utility-process worker (see
 * afdaWorkerProxy.ts) in Electron mode, or in directly-constructed service
 * instances in headless mode (see src/headless/index.ts) — this module
 * doesn't know or care which. Whoever owns the actual services registers a
 * callService/isReady pair here via registerAfdaServiceProxy(), the same
 * registration-callback pattern registerSkedulosaServices() already uses
 * below. This keeps mcpBridgeServer.ts free of any static import into
 * afdaWorkerProxy.ts (which itself imports registerBridgeHandler from this
 * file — a static import back into it here would be a real circular ES
 * module dependency).
 */
interface AfdaServiceProxy {
  callService: <T = unknown>(
    service: string,
    method: string,
    args?: unknown[],
  ) => Promise<T>;
  isReady: () => boolean;
}

let afdaServiceProxy: AfdaServiceProxy | null = null;

export function registerAfdaServiceProxy(p: AfdaServiceProxy): void {
  afdaServiceProxy = p;
}

async function callAfda<T = unknown>(
  service: string,
  method: string,
  args: unknown[] = [],
): Promise<T> {
  if (!afdaServiceProxy) throw new Error('AFDA services not ready');
  return afdaServiceProxy.callService<T>(service, method, args);
}

function afdaReady(): boolean {
  return !!afdaServiceProxy && afdaServiceProxy.isReady();
}

// Smart Organize has no bridge route, so this is reported on /status and
// never gated. registerHandlers sets it once its handler registers.
let smartOrganizeServicesReady = false;

export function registerSmartOrganizeReady(ready: boolean): void {
  smartOrganizeServicesReady = ready;
}

/**
 * Is this add-on usable right now?
 *
 * One state, not two: a pack that was never downloaded and a pack sitting on
 * disk that this session never loaded both answer false, because the user's
 * next step is the same either way.
 */
function addonReady(pack: string): boolean {
  if (pack === 'afda-backend') return afdaReady();
  if (pack === 'video-nemesis-toolkit') return !!skedulosaServices;
  if (pack === 'smart-organize-backend') return smartOrganizeServicesReady;
  return true;
}

export function registerSkedulosaServices(s: SkedulosaServices): void {
  skedulosaServices = s;
}

export function registerRendererSender(
  fn: (channel: string, payload: unknown) => void,
): void {
  _sendToRenderer = fn;
}

function sendToRenderer(channel: string, payload: unknown): void {
  _sendToRenderer?.(channel, payload);
}

/** Re-hydrate the AFDA websites store after a bridge mutation. */
function hydrateAfdaRenderer(): void {
  if (!afdaReady()) return;
  callAfda('meta', 'buildHydratedWebsites', [])
    .then((websites) => {
      sendToRenderer('store:hydrate', { websites });
    })
    .catch((err) => {
      console.error('[mcpBridge] hydrateAfdaRenderer failed:', err);
    });
}

/** Push current toolkit slot rows to the Skedulosa renderer store. */
function notifySkedulosaChannelSlots(channelId: number): void {
  const slots = querySkedulosa<{ day_of_week: number; time_minutes: number }>(
    'SELECT day_of_week, time_minutes FROM channel_slots WHERE channel_id = ? ORDER BY day_of_week, time_minutes',
    [channelId],
  );
  sendToRenderer('toolkit:channel:updated', { id: channelId, slots });
}

// ─── Renderer round-trip (request/response) ────────────────────────────────────
//
// Core download state lives in the renderer's Zustand store, which the main
// process cannot read directly. This is a request/response bridge: main sends a
// query/command to the renderer (which owns the store) and awaits a reply.
// The actual transport is injected by the host (skedulosaHandler) via
// registerRendererQuery, so this module stays Electron-free.

let _queryRenderer:
  | ((
      kind: 'query' | 'command',
      payload: unknown,
      timeoutMs: number,
    ) => Promise<unknown>)
  | null = null;

export function registerRendererQuery(
  fn: (
    kind: 'query' | 'command',
    payload: unknown,
    timeoutMs: number,
  ) => Promise<unknown>,
): void {
  _queryRenderer = fn;
}

// True once the renderer download-store transport is wired (main window ready).
// Lets routes prefer the store-backed path and fall back when headless.
function rendererAvailable(): boolean {
  return _queryRenderer != null;
}

async function queryRenderer(
  payload: unknown,
  timeoutMs = 5000,
): Promise<unknown> {
  if (!_queryRenderer)
    throw new Error(
      'Download list is not available — the main window is not ready.',
    );
  return _queryRenderer('query', payload, timeoutMs);
}

async function commandRenderer(
  payload: unknown,
  timeoutMs = 8000,
): Promise<unknown> {
  if (!_queryRenderer)
    throw new Error(
      'Download actions are not available — the main window is not ready.',
    );
  return _queryRenderer('command', payload, timeoutMs);
}

// ─── token helpers ────────────────────────────────────────────────────────────

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function writeTokenFile(token: string): void {
  const tokenPath = path.join(resolveUserDataPath(), 'mcp-token.txt');
  fs.writeFileSync(tokenPath, token, { mode: 0o600 });
}

// ─── response helpers ─────────────────────────────────────────────────────────

function json(res: http.ServerResponse, status: number, data: unknown): void {
  // The action gate can hold a request open for as long as the user takes to
  // answer, so by the time there is something to say the caller may be gone.
  // Writing to a finished response throws; there is nobody left to tell.
  if (res.writableEnded || res.destroyed) return;
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// Memoised per request: the action gate below has to read the body to tell a
// `delete` apart from an `add_tag` (both are POST /downloads/command), and the
// route handler then reads it again. A request stream can only be consumed
// once, so the first read wins and every later caller gets the same promise.
const _bodyCache = new WeakMap<
  http.IncomingMessage,
  Promise<Record<string, unknown>>
>();

function parseBody(
  req: http.IncomingMessage,
): Promise<Record<string, unknown>> {
  const cached = _bodyCache.get(req);
  if (cached) return cached;

  const pending = new Promise<Record<string, unknown>>((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });

  _bodyCache.set(req, pending);
  return pending;
}

function checkAuth(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): boolean {
  const authHeader = (req.headers['authorization'] as string) ?? '';
  if (authHeader !== `Bearer ${bearerToken}`) {
    json(res, 401, { error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ─── Destructive / file-writing action gate ───────────────────────────
//
// The route table and approver registry live in actionGate.ts (pure, unit
// tested). What stays here is the part that needs the live request: reading
// the body once, waiting on the user with a timeout, and noticing a caller
// that hangs up mid-prompt.

// Re-exported so hosts keep importing their wiring from the bridge they start.
export {
  MCP_ENDPOINT_PATH,
  registerMcpToolDispatcher,
  mcpToolsReady,
  type McpToolDispatcher,
} from './mcpProtocol';

export {
  registerActionApprover,
  approveAllGatedActions,
  MAX_BATCH_ITEMS,
  type ActionApprover,
  type ActionReview,
  type GatedAction,
  type GatedActionKind,
} from './actionGate';

/**
 * The one statement of the download-now batch rule, in words the agent can act
 * on. Returns null when the list is usable.
 *
 * Called from before the gate so the 400 lands instead of a card, and reused by
 * the route handler for the paths that never pass a gate (headless approves
 * everything, and a patch can only shrink the list). One copy, because two
 * would drift.
 */
function checkBatchSize(items: DownloadItem[]): string | null {
  if (items.length === 0) return 'url or items[] required';
  if (items.length > MAX_BATCH_ITEMS)
    return (
      `A download batch may contain at most ${MAX_BATCH_ITEMS} videos; got ` +
      `${items.length}. Split them into chunks of ${MAX_BATCH_ITEMS} and ` +
      `call this once per chunk, waiting for each confirmation before the next.`
    );
  return null;
}

// Reads the body (needed to tell a `delete` from an `add_tag` on the shared
// /downloads/command route), then defers to the pure lookup.
async function gatedActionFor(
  method: string,
  pathname: string,
  req: http.IncomingMessage,
): Promise<GatedActionType | null> {
  if (method !== 'POST') return null;
  let body: Record<string, unknown> = {};
  try {
    body = await parseBody(req);
  } catch {
    // A malformed body is the route handler's error to report, not the gate's.
    return null;
  }
  const action = resolveGatedAction(method, pathname, body);
  return action ? await enrichDownloadTarget(action, body) : null;
}

/**
 * Turn "delete_download / id=f74621a0-c9fd-…" into a card that names the file.
 *
 * resolveGatedAction is pure — it only sees the request body, and a download
 * command's body carries nothing but the id. That is fine for deciding
 * *whether* to gate, and useless for the human being asked to approve it: a
 * raw UUID gives no way to tell the right file from the wrong one, on the one
 * prompt standing between the agent and an irreversible delete.
 *
 * The name lives in the renderer's Zustand store, so resolving it needs a live
 * round trip — which is why this enrichment sits here rather than in the pure,
 * unit-tested gate module. Best effort throughout: a lookup that fails or
 * times out leaves the original id-only detail rather than blocking the
 * prompt, since a vaguer question is still better than a stalled one.
 */
async function enrichDownloadTarget(
  action: GatedActionType,
  body: Record<string, unknown>,
): Promise<GatedActionType> {
  const id = typeof body.id === 'string' ? body.id : '';
  // Only the download commands that act on one existing item by id. Tag and
  // category commands already carry a human-readable name of their own.
  const NAMED_BY_ID = new Set([
    'delete_download',
    'stop_download',
    'rename_download',
  ]);
  if (!id || action.review || !NAMED_BY_ID.has(action.command)) return action;

  try {
    const found = (await queryRenderer({ op: 'get', id }, 3000)) as {
      name?: string;
      location?: string;
      status?: string;
      error?: string;
    };
    if (!found || found.error || !found.name) return action;

    const fields = [
      { label: 'File', value: found.name },
      { label: 'Folder', value: found.location ?? '' },
      { label: 'Status', value: found.status ?? '' },
    ];
    if (action.command === 'rename_download') {
      fields.push({ label: 'New name', value: String(body.newName ?? '') });
    }

    return {
      ...action,
      review: {
        title:
          action.command === 'delete_download'
            ? 'Confirm delete'
            : action.command === 'stop_download'
              ? 'Confirm stop'
              : 'Confirm rename',
        fields,
      },
    };
  } catch {
    // Renderer busy, not ready, or slow — ask with what we already have.
    return action;
  }
}

interface ApprovalDecision {
  approved: boolean;
  reason: string;
  /**
   * True when the user never answered — the prompt timed out or the caller hung
   * up — as opposed to answering "no".
   *
   * The distinction matters to the agent. A decline is final and retrying it
   * pesters the user, so the tool result tells it not to. An expiry is not an
   * answer at all: the card is gone, nobody decided anything, and re-issuing
   * the command to raise a fresh card is the correct next move. Reporting both
   * as retry:false left the agent telling the user to click a card that had
   * already retired its buttons.
   */
  expired?: boolean;
  /**
   * The question could not be put to the user at all — another confirmation
   * card already holds the single prompt slot. Distinct from `expired`: an
   * outstanding card is not an expiry, and conflating the two leaves the next
   * reader unable to tell which happened. Both map to retry:true.
   */
  busy?: boolean;
  /**
   * The wait timed out but the card is still up and still answerable, and the
   * request is parked in detachedApproval for the user's eventual click.
   * Distinct from `expired` in the one way that matters to the agent: it must
   * NOT re-issue the command, because doing so would put a second card on
   * screen for an action the first one can still perform.
   */
  detached?: boolean;
  /** Card-collected edits to apply to the request body before routing. */
  patch?: Record<string, unknown>;
}

async function requestApproval(
  actionArg: GatedActionType,
  req: http.IncomingMessage,
): Promise<ApprovalDecision> {
  // One id for the card, the registry and the replay token, minted here so the
  // approver's card and a later click agree on what is being answered.
  const detachId = crypto.randomUUID();
  const action: GatedActionType = { ...actionArg, requestId: detachId };
  // Read before the wait: a detach happens inside a sync timer callback, and
  // the body is what a replay needs. parseBody caches per request, so this is
  // the same parse the route would do. GETs carry nothing worth keeping.
  const pendingBody =
    (req.method ?? 'POST') === 'GET'
      ? {}
      : await parseBody(req).catch(() => ({}));
  const approver = currentActionApprover();
  if (!approver) {
    return {
      approved: false,
      reason:
        `"${action.command}" needs the user's confirmation, and no Downlodr window is open to ask. ` +
        `Open Downlodr and try again.`,
    };
  }

  // Aborting tells the approver to take its prompt down. Without it a timed-out
  // or abandoned question would sit in the UI forever, holding the approver's
  // single prompt slot and denying every later action.
  const cancel = new AbortController();
  let settled = false;

  const decision = await new Promise<ApprovalDecision>((resolve) => {
    const timer = setTimeout(() => {
      // Park the request so the card's eventual answer can still run it, then
      // stop waiting. Registered BEFORE finish(), which aborts the prompt: the
      // approver's detach handler needs the record to already be there.
      registerDetachedApproval({
        id: detachId,
        command: action.command,
        method: req.method ?? 'POST',
        path: new URL(req.url ?? '/', 'http://127.0.0.1').pathname,
        body: pendingBody,
      });
      finish({
        approved: false,
        detached: true,
        reason: describeDetachedWait(action.command),
      });
    }, APPROVAL_TIMEOUT_MS);

    // A caller that hangs up mid-prompt must not have its action run once the
    // user eventually answers — treat the disconnect as a cancellation.
    const onClose = () => {
      finish({
        approved: false,
        expired: true,
        reason: `"${action.command}" was cancelled — the caller disconnected.`,
      });
    };

    function finish(d: ApprovalDecision): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req.off('close', onClose);
      // The reason is how the approver tells a detach from a death: on a
      // detach it keeps the card up and frees the prompt slot; on anything
      // else (a caller hanging up) the card retires as before.
      if (!d.approved) cancel.abort(d.detached === true ? DETACH_REASON : undefined);
      resolve(d);
    }

    req.once('close', onClose);

    approver(action, cancel.signal)
      .then((answer) =>
        finish({
          approved: answer.approved,
          patch: answer.patch,
          reason: answer.approved
            ? 'approved'
            : `The user declined "${action.command}", so nothing ran.`,
        }),
      )
      .catch((err) =>
        finish({
          approved: false,
          // The approver throwing means the question was never put to the user
          // — overwhelmingly because another card still holds the single
          // prompt slot. Nothing was decided, so this is retryable.
          busy: true,
          reason:
            `Could not ask the user to confirm "${action.command}": ${
              err instanceof Error ? err.message : String(err)
            }. A confirmation card may still be open — wait for the user to ` +
            `answer it, then issue this command again.`,
        }),
      );
  });

  console.log(
    `[mcpBridge] gate ${action.command} (${action.kind}) -> ${
      decision.approved ? 'approved' : 'denied'
    }`,
  );
  return decision;
}

// ─── WebSocket event broadcaster ──────────────────────────────────────────────

const WS_OPEN = 1; // WebSocket.OPEN constant

export function broadcastEvent(type: string, payload: unknown): void {
  if (wsClients.size === 0) return;
  const msg = JSON.stringify({ type, payload });
  for (const client of wsClients) {
    if (client.readyState === WS_OPEN) {
      client.send(msg);
    }
  }
}

// ─── SQLite helpers for Skedulosa (read-only queries) ─────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const BetterSqlite3 = require('better-sqlite3') as any;

/** The folder half of a full output path, on either path separator. */
function folderOf(outputFilepath: string): string {
  const slash = Math.max(
    outputFilepath.lastIndexOf('/'),
    outputFilepath.lastIndexOf('\\'),
  );
  return slash >= 0 ? outputFilepath.slice(0, slash) : outputFilepath;
}

/**
 * Headless download: run yt-dlp straight from the main process and stream
 * progress over the WS event feed.
 *
 * This is the fallback for both /downloads/queue and /downloads/download-now
 * when there is no renderer to route through (no main window, or the store
 * round-trip failed). The download runs for real, but it does NOT appear in
 * the UI list — callers get a downloadId/controllerId to track it instead.
 */
async function standaloneDownload(
  body: Record<string, unknown>,
  res: http.ServerResponse,
): Promise<void> {
  const downloadId = crypto.randomUUID();
  const controller = await YTDLP.download({
    args: {
      url: body.url as string,
      output: body.outputFilepath as string,
      videoFormat: body.videoFormat as string | undefined,
      remuxVideo: body.remuxVideo as string | undefined,
      audioFormat: body.audioExt as string | undefined,
      audioQuality: body.audioFormatId as string | undefined,
      limitRate: body.limitRate as string | undefined,
    },
  });

  if (!controller)
    return json(res, 500, { error: 'Failed to start download controller' });

  const controllerId = controller.id;

  // Stream progress to WS clients asynchronously
  void (async () => {
    try {
      for await (const chunk of controller.listen()) {
        broadcastEvent('download:progress', {
          downloadId,
          controllerId,
          chunk,
        });
        if (chunk?.data?.status === 'finished') {
          broadcastEvent('download:finished', { downloadId, controllerId });
        }
      }
    } catch (err) {
      broadcastEvent('download:error', { downloadId, error: String(err) });
    }
  })();

  // `started` distinguishes this from the store-routed /downloads/queue path,
  // which only queues: there the user still has to press download in the app.
  return json(res, 200, { downloadId, controllerId, started: true });
}

function skedulosaDb(readonly = true) {
  if (!skedulosaServices) throw new Error('Skedulosa not ready');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return BetterSqlite3(skedulosaServices.dbPath, { readonly }) as {
    prepare: (sql: string) => {
      all: (...p: unknown[]) => unknown[];
      get: (...p: unknown[]) => unknown;
      run: (...p: unknown[]) => { changes: number; lastInsertRowid: number };
    };
    close: () => void;
  };
}

function querySkedulosa<T>(sql: string, params: unknown[] = []): T[] {
  const db = skedulosaDb();
  try {
    return db.prepare(sql).all(...params) as T[];
  } finally {
    db.close();
  }
}

function getSkedulosa<T>(sql: string, params: unknown[] = []): T | undefined {
  const db = skedulosaDb();
  try {
    return db.prepare(sql).get(...params) as T | undefined;
  } finally {
    db.close();
  }
}

// ─── IPC invoker — direct handler registry ───────────────────────────────────
//
// Instead of reaching into ipcMain internals (which vary by Electron version),
// callers register their handlers here via registerBridgeHandler(). The bridge
// then calls them directly without needing a BrowserWindow or fake event.

type IpcHandler = (
  event: null,
  ...args: unknown[]
) => unknown | Promise<unknown>;
const _bridgeHandlers = new Map<string, IpcHandler>();

export function registerBridgeHandler(
  channel: string,
  handler: IpcHandler,
): void {
  _bridgeHandlers.set(channel, handler);
}

async function invokeIpc(
  channel: string,
  ...args: unknown[]
): Promise<unknown> {
  const handler = _bridgeHandlers.get(channel);
  if (!handler) throw new Error(`IPC channel not registered: ${channel}`);
  return handler(null, ...args);
}

// ─── route handler ────────────────────────────────────────────────────────────

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  if (!checkAuth(req, res)) return;

  const base = `http://127.0.0.1:${MCP_BRIDGE_PORT}`;
  const url = new URL(req.url ?? '/', base);
  const method = req.method ?? 'GET';
  const p = url.pathname;

  try {
    // ── MCP over Streamable HTTP ──────────────────────────────────────────────
    // Routed before the action gate: the gate's route table describes the REST
    // surface, and an MCP tool call is not one of those routes. The gate still
    // fires for the real work — run_downlodr dispatches through executeTool,
    // which calls back into this server over HTTP (callBridge), so a
    // destructive command hits gatedActionFor on its own inner request exactly
    // as it does from the CLI or the in-process agentic loop.
    if (p === MCP_ENDPOINT_PATH) {
      const mcpBody = method === 'POST' ? await parseBody(req) : null;
      return await handleMcpHttp(req, res, mcpBody, (status, payload) =>
        json(res, status, payload),
      );
    }

    // An unavailable add-on stops the call here, before routing. The
    // placement is the point: chatHandler's find_subscription / find_website
    // / find_section parse the response and fall through to a "nothing
    // matched" branch when it isn't an array, so a 200 carrying
    // {"error": "Skedulosa not ready"} becomes "No subscription found
    // matching X" — and the agent then creates instead of reporting. A 403
    // can't be misread that way.
    const required = resolveRequiredAddon(p);
    if (required && !addonReady(required.pack)) {
      // The card offers a download; the answer only decides what to tell the
      // agent, never whether to proceed — the command cannot run either way.
      const decision = await requestApproval(
        buildAddonRequiredAction(required),
        req,
      );
      // Which copy to send is decided by whether a download is actually
      // running, not by decision.approved — see registerAddonDownloadChecker
      // in actionGate.ts for why the approver's own answer can't be trusted
      // for this.
      const downloading =
        currentAddonDownloadChecker()?.(required.pack) ?? false;
      return json(res, 403, {
        error: downloading
          ? `The ${required.label} add-on is downloading now. It is not usable ` +
            `until the download finishes and the user restarts Downlodr. Tell ` +
            `them that and stop — do not retry this command.`
          : // Not "the user declined": requestApproval also resolves false when
            // the approver could not ask at all — another confirmation already
            // holds the single prompt slot, or no chat window is open, or (as
            // with headless's blanket approver) "approved" didn't actually
            // start anything. Claiming they refused would be a lie in those
            // cases too.
            `The ${required.label} add-on is not available, so ${required.feature} ` +
            `cannot be used. Tell the user this feature needs that add-on, and ` +
            `stop — do not retry.`,
        denied: true,
        addonRequired: required.pack,
        // Never true: unlike an expired confirmation, re-issuing changes
        // nothing until the pack is installed and the app restarted.
        retry: false,
      });
    }

    // Destructive and file-writing calls stop here for the user's yes/no
    // before any routing happens — see the action gate above. 403 with
    // `denied` is a terminal answer, not a transient failure: agents are told
    // in the message not to retry it.
    // The batch shape is validated before the card, not after it: a thirty-item
    // body must be a 400 the agent can act on, never a thirty-row card the user
    // waits three minutes to answer only to have the route reject it anyway.
    if (method === 'POST' && p === '/downloads/download-now') {
      const batchError = checkBatchSize(normalizeDownloadItems(await parseBody(req)));
      if (batchError) return json(res, 400, { error: batchError });
    }

    const gated = await gatedActionFor(method, p, req);
    if (gated) {
      // A replay of a card the user has just answered late. The question was
      // already put and approved, so asking again would raise a second card for
      // an action the first one is still standing behind. The token is one-shot
      // (taken here, never returned) and must match this exact method and path,
      // so it cannot wave through a different command.
      const replayToken = (req.headers['x-downlodr-approved'] as string) ?? '';
      const replay = replayToken ? takeDetachedApproval(replayToken) : null;
      const preApproved = Boolean(
        replay && replay.method === method && replay.path === p,
      );
      if (replay && !preApproved) {
        console.warn(
          '[mcpBridge] ignoring approval token issued for',
          `${replay.method} ${replay.path}`,
          'on',
          `${method} ${p}`,
        );
      }

      if (!preApproved) {
        const decision = await requestApproval(gated, req);
        if (!decision.approved) {
          return json(res, 403, {
            error: decision.reason,
            denied: true,
            command: gated.command,
            // An unanswered prompt is not a refusal: nothing was decided, and
            // the card is gone. Re-issuing raises a fresh one, which is the
            // only way the user gets to answer at all.
            expired: decision.expired === true,
            // The card is still up and can still run this, so re-issuing would
            // only put a second one on screen for the same action.
            detached: decision.detached === true,
            // A card that could not even be raised because another one is
            // still open is the one genuinely transient case here: the agent
            // should wait for that card and re-issue, not treat this as a
            // refusal.
            retry: decision.expired === true || decision.busy === true,
          });
        }
        // The card may have answered more than "yes" — extras toggles, rows the
        // user removed. parseBody caches one body object per request, so this
        // mutation is what the route handler below reads. A late answer applies
        // its own patch before replaying (see chatHandler's late-answer
        // handler), which is why this sits under !preApproved.
        if (decision.patch) {
          const body = await parseBody(req);
          const rejected = applyApprovalPatch(body, decision.patch);
          if (rejected.length) {
            console.warn(
              `[mcpBridge] dropped non-patchable confirm keys: ${rejected.join(', ')}`,
            );
            // `items` is the one patch key whose whole job is REMOVING videos.
            // Falling through with the agent's original list would download the
            // rows the user just struck out, right after a card that said
            // "Yes, download 2" — so a rejected items patch fails closed.
            if (rejected.includes('items'))
              return json(res, 403, {
                error:
                  'The confirmation card sent an item list that does not match what ' +
                  'was proposed, so nothing ran. Re-issue the command to raise a fresh card.',
                denied: true,
                command: gated.command,
                expired: false,
                retry: true,
              });
          }
        }
      }
    }

    // ── status ────────────────────────────────────────────────────────────────
    if (method === 'GET' && p === '/status') {
      return json(res, 200, {
        ok: true,
        app: 'Downlodr',
        version: resolveAppVersion(),
        platform: process.platform,
        afdaReady: afdaReady(),
        skedulosaReady: !!skedulosaServices,
        smartOrganizeReady: smartOrganizeServicesReady,
      });
    }

    // ── system info ───────────────────────────────────────────────────────────
    if (method === 'GET' && p === '/system/info') {
      const cpus = os.cpus();
      return json(res, 200, {
        app_name: 'Downlodr',
        app_version: resolveAppVersion(),
        platform: process.platform,
        arch: os.arch(),
        cpu_model: cpus[0]?.model ?? 'unknown',
        cpu_cores: cpus.length,
        memory_total_gb: Math.round((os.totalmem() / 1073741824) * 10) / 10,
        memory_free_gb: Math.round((os.freemem() / 1073741824) * 10) / 10,
      });
    }

    // ── yt-dlp video info ─────────────────────────────────────────────────────
    if (method === 'GET' && p === '/downloads/info') {
      const videoUrl = url.searchParams.get('url');
      if (!videoUrl) return json(res, 400, { error: 'url param required' });
      // noPlaylist: same reason as the ytdlp:info handler — /downloads/playlist
      // is the container endpoint, so this one must stay a single-video lookup
      // or --dump-json's per-entry output breaks getInfo's JSON.parse.
      const info = await YTDLP.getInfo(videoUrl, {
        ...(await resolveCookiesForCall(videoUrl)),
        noPlaylist: true,
      });
      // A bare `{ ok: false }` told the caller nothing — getInfo has no error
      // field, so yt-dlp's own reason never arrives — and an agent handed it
      // guessed at the cause out loud. Say what can actually be said.
      const failure = describeVideoInfoFailure(videoUrl, info);
      if (failure) {
        return json(res, failure.status, {
          error: failure.error,
          retry: failure.retry,
        });
      }
      return json(res, 200, info);
    }

    if (method === 'GET' && p === '/downloads/playlist') {
      const videoUrl = url.searchParams.get('url');
      if (!videoUrl) return json(res, 400, { error: 'url param required' });
      const info = await YTDLP.getPlaylistInfo({
        url: videoUrl,
        ...(await resolveCookiesForCall(videoUrl)),
      });
      // Same reason as the ytdlp:playlist:info handler — un-smuggle the
      // per-entry title/thumbnail extractors hide in the URL fragment.
      return json(res, 200, hydratePlaylistEntries(info));
    }

    if (method === 'GET' && p === '/downloads/ytdlp-version') {
      const version = await YTDLP.getYTDLPVersion();
      return json(res, 200, { version });
    }

    // ── queue download ────────────────────────────────────────────────────────
    if (method === 'POST' && p === '/downloads/queue') {
      const body = await parseBody(req);
      if (!body.url) return json(res, 400, { error: 'url required' });
      if (!body.outputFilepath)
        return json(res, 400, { error: 'outputFilepath required' });

      // Preferred path: route into the renderer's download store so the
      // download appears in the UI list/activity with live progress and full
      // metadata — identical to a user pasting the URL into the app. We derive
      // the destination folder from outputFilepath; the store fetches the title
      // and names the file itself (matching UI behavior).
      if (rendererAvailable()) {
        const location = folderOf(String(body.outputFilepath));
        try {
          const result = await commandRenderer({
            action: 'queue_download',
            url: body.url,
            location,
            limitRate: (body.limitRate as string | undefined) ?? '',
          });
          return json(res, 200, result);
        } catch (err) {
          // Fall through to the standalone main-process download below.
          console.error(
            '[mcp-bridge] store-routed download failed, falling back to standalone:',
            err,
          );
        }
      }

      // Fallback (no main window / headless): download standalone in the main
      // process. This will NOT appear in the UI download list.
      return standaloneDownload(body, res);
    }

    // ── download now ──────────────────────────────────────────────────────────
    // Accepts one video ({ url, outputFilepath }) or a batch ({ items: [...] }),
    // normalized to the same list either way. Unlike /downloads/queue, this
    // actually runs the download.
    if (method === 'POST' && p === '/downloads/download-now') {
      const body = await parseBody(req);
      const items = normalizeDownloadItems(body);

      const batchError = checkBatchSize(items);
      if (batchError) return json(res, 400, { error: batchError });
      const missingPath = items.find((i) => !i.outputFilepath);
      if (missingPath)
        return json(res, 400, {
          error: `outputFilepath required for every item (missing for ${missingPath.url})`,
        });

      if (rendererAvailable()) {
        try {
          const result = await commandRenderer({
            action: 'download_videos',
            items: items.map((i) => ({
              url: i.url,
              location: folderOf(i.outputFilepath),
            })),
            limitRate: (body.limitRate as string | undefined) ?? '',
            quality: body.quality as string | undefined,
            getThumbnail: body.getThumbnail === true,
            getTranscript: body.getTranscript === true,
          });
          return json(res, 200, result);
        } catch (err) {
          console.error(
            '[mcp-bridge] store-routed download-now failed, falling back to standalone:',
            err,
          );
        }
      }

      // The headless fallback downloads one video and cannot report a list, so
      // it would silently drop items 2..n. Refusing is the honest answer.
      if (items.length > 1) {
        return json(res, 503, {
          error:
            'Downloading several videos at once needs the Downlodr window, and it ' +
            'is not available. Open Downlodr and try again, or download them one ' +
            'at a time.',
        });
      }

      return standaloneDownload(
        { ...body, url: items[0].url, outputFilepath: items[0].outputFilepath },
        res,
      );
    }

    // ── stop download ─────────────────────────────────────────────────────────
    if (method === 'POST' && p === '/downloads/stop') {
      const body = await parseBody(req);
      if (!body.controllerId)
        return json(res, 400, { error: 'controllerId required' });
      const terminal = YTDLP.getTerminalFromID(body.controllerId as string);
      if (terminal) {
        terminal.kill('SIGKILL');
        return json(res, 200, { stopped: true });
      }
      return json(res, 404, { error: 'controller not found' });
    }

    // ── core download list & management (renderer-backed) ─────────────────────
    // These read/act on the core download list, which lives in the renderer's
    // Zustand store. We round-trip to the renderer via queryRenderer/commandRenderer.

    if (method === 'GET' && p === '/downloads/list') {
      const result = await queryRenderer({
        op: 'list',
        status: url.searchParams.get('status') ?? undefined,
        search: url.searchParams.get('search') ?? undefined,
        tag: url.searchParams.get('tag') ?? undefined,
        category: url.searchParams.get('category') ?? undefined,
      });
      return json(res, 200, result);
    }

    if (method === 'GET' && p.match(/^\/downloads\/[^/]+\/log$/)) {
      const id = decodeURIComponent(p.split('/')[2]);
      const result = await queryRenderer({ op: 'log', id });
      return json(res, 200, result);
    }

    if (
      method === 'GET' &&
      p.startsWith('/downloads/') &&
      p !== '/downloads/list' &&
      p !== '/downloads/info' &&
      p !== '/downloads/playlist' &&
      p !== '/downloads/ytdlp-version' &&
      !p.endsWith('/log')
    ) {
      const id = decodeURIComponent(p.split('/')[2]);
      const result = await queryRenderer({ op: 'get', id });
      return json(res, 200, result);
    }

    if (method === 'GET' && p === '/downloads/tags') {
      return json(res, 200, await queryRenderer({ op: 'tags' }));
    }

    if (method === 'GET' && p === '/downloads/categories') {
      return json(res, 200, await queryRenderer({ op: 'categories' }));
    }

    if (method === 'GET' && p === '/downloads/favorites') {
      return json(res, 200, await queryRenderer({ op: 'favorites' }));
    }

    if (method === 'POST' && p === '/downloads/command') {
      const body = await parseBody(req);
      if (!body.action) return json(res, 400, { error: 'action required' });
      const result = await commandRenderer(body);
      return json(res, 200, result);
    }

    // ── subscriptions / channels (Skedulosa) ──────────────────────────────────
    if (method === 'GET' && p === '/subscriptions/channels') {
      const rows = querySkedulosa<unknown>(
        'SELECT c.*, s.name as schedule_name FROM channels c LEFT JOIN schedules s ON c.schedule_id = s.id ORDER BY c.id',
      );
      return json(res, 200, rows);
    }

    if (method === 'GET' && p === '/subscriptions/schedules') {
      const rows = querySkedulosa<unknown>(
        'SELECT * FROM schedules ORDER BY id',
      );
      return json(res, 200, rows);
    }

    if (method === 'GET' && p === '/subscriptions/tasks') {
      const rows = querySkedulosa<unknown>(
        'SELECT dt.*, vd.video_title FROM download_task dt LEFT JOIN video_details vd ON dt.video_url = vd.video_url ORDER BY dt.created_at DESC LIMIT 100',
      );
      return json(res, 200, rows);
    }

    if (method === 'GET' && p === '/subscriptions/history') {
      const rows = querySkedulosa<unknown>(
        'SELECT dh.*, vd.video_title FROM download_history dh LEFT JOIN video_details vd ON dh.video_url = vd.video_url ORDER BY dh.created_at DESC LIMIT 100',
      );
      return json(res, 200, rows);
    }

    if (method === 'GET' && p === '/subscriptions/schedule/week') {
      const slots = querySkedulosa<unknown>(
        'SELECT cs.*, c.name as channel_name, c.url as channel_url FROM channel_slots cs JOIN channels c ON cs.channel_id = c.id ORDER BY cs.day_of_week, cs.time_minutes',
      );
      return json(res, 200, slots);
    }

    if (method === 'GET' && p === '/subscriptions/intelligent-schedules') {
      const rows = querySkedulosa<unknown>(
        'SELECT * FROM intelligent_schedule ORDER BY channel_id',
      );
      return json(res, 200, rows);
    }

    if (
      method === 'GET' &&
      p.startsWith('/subscriptions/channels/') &&
      p.endsWith('/slots')
    ) {
      const channelId = Number(p.split('/')[3]);
      if (isNaN(channelId))
        return json(res, 400, { error: 'invalid channel id' });
      const slots = querySkedulosa<unknown>(
        'SELECT * FROM channel_slots WHERE channel_id = ? ORDER BY day_of_week, time_minutes',
        [channelId],
      );
      return json(res, 200, slots);
    }

    if (
      method === 'GET' &&
      p.startsWith('/subscriptions/channels/') &&
      !p.includes('/slots')
    ) {
      const channelId = Number(p.split('/').pop());
      if (isNaN(channelId))
        return json(res, 400, { error: 'invalid channel id' });
      const row = getSkedulosa<unknown>('SELECT * FROM channels WHERE id = ?', [
        channelId,
      ]);
      if (!row) return json(res, 404, { error: 'channel not found' });
      return json(res, 200, row);
    }

    // ── subscriptions write (Skedulosa via IPC) ───────────────────────────────

    if (method === 'POST' && p === '/subscriptions/channels') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const body = await parseBody(req);
      if (!body.url) return json(res, 400, { error: 'url required' });

      // ── Replicate the full UI subscribe flow (SubscriptionQueueContext.createSubscription) ──

      // 1. Create a per-channel schedule (same as UI)
      const schedule = (await invokeIpc('toolkit:schedules:create', {
        name: body.name ?? body.url,
      })) as { id: number } | null;
      if (!schedule?.id)
        return json(res, 500, { error: 'Failed to create schedule' });

      // 2. Create the channel — first_scrape_limit defaults to 0 (no backlog auto-download)
      const ch = (await invokeIpc('toolkit:channels:create', {
        schedule_id: schedule.id,
        url: body.url,
        name: body.name ?? '',
        download_format: body.download_format ?? 'mp4',
        active: 1,
        first_scrape_limit: body.first_scrape_limit ?? 0,
        all_words: body.all_words ?? [],
        any_words: body.any_words ?? [],
        none_words: body.none_words ?? [],
        min_duration_minutes: body.min_duration_minutes ?? null,
        max_duration_minutes: body.max_duration_minutes ?? null,
        download_subtitles: body.download_subtitles ?? 0,
        download_thumbnails: body.download_thumbnails ?? 0,
      })) as {
        id: number;
        url: string;
        name: string;
        schedule_id: number;
      } | null;
      if (!ch?.id) return json(res, 500, { error: 'Failed to create channel' });

      // 3. Set manual time slots if provided
      const manualSlots =
        Array.isArray(body.slots) && body.slots.length > 0
          ? (body.slots as { day_of_week: number; time_minutes: number }[])
          : undefined;
      if (manualSlots) {
        await invokeIpc('toolkit:channelSlots:replace', ch.id, manualSlots);
      }

      // 4. Build the renderer-store settings the UI normally fills in (quality,
      //    save location, timezone). These live only in the renderer Zustand
      //    store — not the toolkit DB — so we forward them on the created event.
      //    Mirrors SubscriptionQueueContext.createSubscription.
      const isManual = body.frequency === 'manual';
      const channelSettings = [
        {
          frequency: isManual ? '' : 'auto-detect',
          download_quality: isManual
            ? body.download_quality ?? 'Best Quality'
            : 'Best Quality',
          save_location: body.save_location ?? '',
          download_priority: '',
          lookback_period: '7 days',
          file_naming_format: '',
          timezone: body.timezone ?? 'UTC',
        },
      ];

      // 5. Push to renderer immediately so UI shows the channel (without avatar yet)
      sendToRenderer('toolkit:channel:created', {
        ...ch,
        schedule_id: schedule.id,
        settings: channelSettings,
        ...(manualSlots ? { slots: manualSlots } : {}),
      });

      // 6. Run initial scrape + fetch details + save analysis videos in background
      // Report progress into the same scrapingChannels map a manual subscribe
      // fills, so the Status page shows a spinner row for chat subscribes too.
      const scrapeName = (body.name as string) || (body.url as string);
      const reportScraping = (status: string) =>
        sendToRenderer('toolkit:channel:scraping', {
          channelId: ch.id,
          name: scrapeName,
          status,
        });
      void (async () => {
        try {
          reportScraping('Fetching channel details...');
          // Fetch avatar/details
          const details = (await invokeIpc(
            'toolkit:channel:fetchDetails',
            body.url,
          )) as ToolkitChannelDetails | null;
          const channelDetails = toChannelDetails(details);
          // Push again with avatar so UI updates
          sendToRenderer('toolkit:channel:created', {
            ...ch,
            schedule_id: schedule.id,
            channel_details: channelDetails,
            settings: channelSettings,
          });

          // Analyze channel schedule to get videos for intelligent scheduling (same as UI).
          // toolkit:channelAnalyze:schedule returns { videos, intelligentPrediction, ... }.
          // ScrapeRunResult does NOT include videos, so we must fetch them separately.
          reportScraping('Analyzing upload schedule...');
          const analysisResult = (await invokeIpc(
            'toolkit:channelAnalyze:schedule',
            body.url,
          )) as {
            videos?: unknown[];
            intelligentPrediction?: unknown;
            suggestedSlots?: unknown[];
            videoCount?: number;
          } | null;
          const analysisVideos = analysisResult?.videos;
          // Save analysis videos BEFORE the scrape so the scraper's internal
          // updateChannelSchedule call finds data in channel_analysis_videos.
          let intelligentScheduleResult: {
            next_scrape_time?: string;
            pattern?: string;
            confidence?: number;
            is_erratic?: number;
          } | null = null;
          if (Array.isArray(analysisVideos) && analysisVideos.length > 0) {
            const saved = await invokeIpc(
              'toolkit:channelAnalysisVideos:save',
              ch.id,
              analysisVideos,
            );
            intelligentScheduleResult =
              (saved as {
                next_scrape_time?: string;
                pattern?: string;
                confidence?: number;
                is_erratic?: number;
              } | null) ?? null;
          }

          // Run initial scrape (scraper's internal updateChannelSchedule will now find data)
          reportScraping('Checking for new videos...');
          await invokeIpc('toolkit:scraper:runOnce', ch.id);

          // Restart scraper loop so ongoing monitoring kicks in (same as UI batch end)
          await invokeIpc('toolkit:scraper:start');

          // Push channel_analysis to renderer so UI shows the correct "Next check in" time
          if (intelligentScheduleResult?.next_scrape_time) {
            const channelAnalysis = {
              nextScrapeTime: intelligentScheduleResult.next_scrape_time,
              pattern: intelligentScheduleResult.pattern ?? 'unknown',
              confidence: intelligentScheduleResult.confidence ?? 0,
              isErratic: Boolean(intelligentScheduleResult.is_erratic),
            };
            sendToRenderer('toolkit:channel:created', {
              ...ch,
              schedule_id: schedule.id,
              channel_details: channelDetails,
              channel_analysis: channelAnalysis,
            });
          }
        } catch (err) {
          console.error('[mcpBridge] Background subscribe tasks failed:', err);
        } finally {
          // Always clear the row — a thrown phase must not leave it spinning.
          sendToRenderer('toolkit:channel:scraping', {
            channelId: ch.id,
            done: true,
          });
        }
      })();

      return json(res, 200, {
        ...ch,
        schedule_id: schedule.id,
        message: 'Subscribed. Initial scrape starting in background.',
      });
    }

    if (
      method === 'POST' &&
      p.match(/^\/subscriptions\/channels\/\d+\/update$/)
    ) {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const channelId = Number(p.split('/')[3]);
      if (isNaN(channelId))
        return json(res, 400, { error: 'invalid channel id' });
      const body = await parseBody(req);
      const result = await invokeIpc(
        'toolkit:channels:update',
        channelId,
        body,
      );
      // Push to renderer so the subscription list updates live without a restart.
      sendToRenderer('toolkit:channel:updated', { id: channelId, ...body });
      return json(res, 200, result);
    }

    if (
      method === 'POST' &&
      p.match(/^\/subscriptions\/channels\/\d+\/delete$/)
    ) {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const channelId = Number(p.split('/')[3]);
      if (isNaN(channelId))
        return json(res, 400, { error: 'invalid channel id' });
      await invokeIpc('toolkit:channels:delete', channelId);
      // Push to renderer so the subscription is removed from the list live.
      sendToRenderer('toolkit:channel:deleted', { id: channelId });
      return json(res, 200, { deleted: true });
    }

    if (
      method === 'POST' &&
      p.startsWith('/subscriptions/channels/') &&
      p.endsWith('/active')
    ) {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const channelId = Number(p.split('/')[3]);
      if (isNaN(channelId))
        return json(res, 400, { error: 'invalid channel id' });
      const body = await parseBody(req);
      await invokeIpc(
        'toolkit:channels:setActive',
        channelId,
        body.active ?? true,
      );
      // Push to renderer so pause/resume is reflected in the UI immediately.
      sendToRenderer('toolkit:channel:updated', {
        id: channelId,
        active: body.active ?? true,
      });
      return json(res, 200, { ok: true });
    }

    if (
      method === 'POST' &&
      p.startsWith('/subscriptions/channels/') &&
      p.endsWith('/slots/replace')
    ) {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const channelId = Number(p.split('/')[3]);
      if (isNaN(channelId))
        return json(res, 400, { error: 'invalid channel id' });
      const body = await parseBody(req);
      const result = await invokeIpc(
        'toolkit:channelSlots:replace',
        channelId,
        body.slots ?? [],
      );
      notifySkedulosaChannelSlots(channelId);
      return json(res, 200, result);
    }

    if (
      method === 'POST' &&
      p.startsWith('/subscriptions/channels/') &&
      p.endsWith('/slots')
    ) {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const channelId = Number(p.split('/')[3]);
      if (isNaN(channelId))
        return json(res, 400, { error: 'invalid channel id' });
      const body = await parseBody(req);
      const result = await invokeIpc(
        'toolkit:channelSlots:add',
        channelId,
        body.day_of_week,
        body.time_minutes,
      );
      notifySkedulosaChannelSlots(channelId);
      return json(res, 200, result);
    }

    if (method === 'GET' && p === '/subscriptions/slots/next-run') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const fromDate = url.searchParams.get('fromDate') ?? undefined;
      const result = await invokeIpc(
        'toolkit:channelSlots:getNextRun',
        fromDate,
      );
      return json(res, 200, { nextRun: result });
    }

    if (method === 'POST' && p === '/subscriptions/schedules') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const body = await parseBody(req);
      const result = await invokeIpc('toolkit:schedules:create', body);
      return json(res, 200, result);
    }

    if (
      method === 'POST' &&
      p.match(/^\/subscriptions\/schedules\/\d+\/update$/)
    ) {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const scheduleId = Number(p.split('/')[3]);
      if (isNaN(scheduleId))
        return json(res, 400, { error: 'invalid schedule id' });
      const body = await parseBody(req);
      const result = await invokeIpc(
        'toolkit:schedules:update',
        scheduleId,
        body,
      );
      return json(res, 200, result);
    }

    if (
      method === 'POST' &&
      p.match(/^\/subscriptions\/schedules\/\d+\/delete$/)
    ) {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const scheduleId = Number(p.split('/')[3]);
      if (isNaN(scheduleId))
        return json(res, 400, { error: 'invalid schedule id' });
      await invokeIpc('toolkit:schedules:delete', scheduleId);
      return json(res, 200, { deleted: true });
    }

    if (method === 'POST' && p === '/subscriptions/scraper/start') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const body = await parseBody(req);
      await invokeIpc('toolkit:scraper:start', body.scheduleId ?? undefined);
      return json(res, 200, { started: true });
    }

    if (method === 'POST' && p === '/subscriptions/scraper/stop') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const body = await parseBody(req);
      await invokeIpc('toolkit:scraper:stop', body.scheduleId ?? undefined);
      return json(res, 200, { stopped: true });
    }

    if (method === 'POST' && p === '/subscriptions/scraper/run-once') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const body = await parseBody(req);
      const result = await invokeIpc(
        'toolkit:scraper:runOnce',
        body.channelId ?? undefined,
      );
      return json(res, 200, result);
    }

    if (method === 'POST' && p === '/subscriptions/download-worker/start') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      await invokeIpc('toolkit:downloadWorker:start');
      return json(res, 200, { started: true });
    }

    if (method === 'POST' && p === '/subscriptions/download-worker/stop') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      await invokeIpc('toolkit:downloadWorker:stop');
      return json(res, 200, { stopped: true });
    }

    if (method === 'GET' && p === '/subscriptions/download-worker/status') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const result = await invokeIpc('toolkit:downloadWorker:getStatus');
      return json(res, 200, result);
    }

    if (method === 'GET' && p === '/subscriptions/video-details') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const channelName = url.searchParams.get('channelName') ?? undefined;
      const result = await invokeIpc('toolkit:videoDetails:list', channelName);
      return json(res, 200, result);
    }

    if (method === 'GET' && p === '/subscriptions/video-details/by-url') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const videoUrl = url.searchParams.get('url');
      if (!videoUrl) return json(res, 400, { error: 'url param required' });
      const result = await invokeIpc('toolkit:videoDetails:get', videoUrl);
      return json(res, 200, result);
    }

    if (method === 'POST' && p === '/subscriptions/download-tasks') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const body = await parseBody(req);
      if (!body.video_url)
        return json(res, 400, { error: 'video_url required' });
      const result = await invokeIpc('toolkit:downloadTasks:add', body);
      return json(res, 200, result);
    }

    if (method === 'GET' && p === '/subscriptions/download-tasks/by-status') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const status = url.searchParams.get('status') ?? undefined;
      const result = await invokeIpc('toolkit:downloadTasks:list', status);
      return json(res, 200, result);
    }

    if (
      method === 'POST' &&
      p.startsWith('/subscriptions/download-tasks/') &&
      p.endsWith('/finish')
    ) {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const taskId = Number(p.split('/')[3]);
      if (isNaN(taskId)) return json(res, 400, { error: 'invalid task id' });
      const result = await invokeIpc(
        'toolkit:downloadTasks:markFinished',
        taskId,
      );
      return json(res, 200, result);
    }

    if (
      method === 'POST' &&
      p === '/subscriptions/download-tasks/clear-pending'
    ) {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const result = await invokeIpc('toolkit:downloadTasks:clearPending');
      return json(res, 200, result);
    }

    if (
      method === 'POST' &&
      p.startsWith('/subscriptions/download-tasks/') &&
      p.endsWith('/delete')
    ) {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const taskId = Number(p.split('/')[3]);
      if (isNaN(taskId)) return json(res, 400, { error: 'invalid task id' });
      const result = await invokeIpc('toolkit:downloadTasks:delete', taskId);
      return json(res, 200, result);
    }

    if (
      method === 'GET' &&
      p === '/subscriptions/intelligent-schedule/upcoming'
    ) {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const hoursAhead = Number(url.searchParams.get('hoursAhead') ?? '24');
      const result = await invokeIpc(
        'toolkit:intelligentSchedule:getUpcoming',
        hoursAhead,
      );
      return json(res, 200, result);
    }

    if (
      method === 'GET' &&
      p === '/subscriptions/intelligent-schedule/overdue'
    ) {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const result = await invokeIpc('toolkit:intelligentSchedule:getOverdue');
      return json(res, 200, result);
    }

    if (method === 'GET' && p === '/subscriptions/intelligent-schedule/stats') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const result = await invokeIpc('toolkit:intelligentSchedule:getStats');
      return json(res, 200, result);
    }

    if (
      method === 'POST' &&
      p === '/subscriptions/intelligent-schedule/refresh-all'
    ) {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const result = await invokeIpc('toolkit:intelligentSchedule:refreshAll');
      return json(res, 200, result);
    }

    if (method === 'POST' && p === '/subscriptions/channels/analyze-schedule') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const body = await parseBody(req);
      if (!body.channelUrl)
        return json(res, 400, { error: 'channelUrl required' });
      const result = await invokeIpc(
        'toolkit:channelAnalyze:schedule',
        body.channelUrl,
      );
      return json(res, 200, result);
    }

    if (method === 'POST' && p === '/subscriptions/channels/fetch-details') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const body = await parseBody(req);
      if (!body.channelUrl)
        return json(res, 400, { error: 'channelUrl required' });
      const result = await invokeIpc(
        'toolkit:channel:fetchDetails',
        body.channelUrl,
        body.opts ?? undefined,
      );
      return json(res, 200, result);
    }

    if (
      method === 'POST' &&
      p === '/subscriptions/channels/fetch-upload-dates'
    ) {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const body = await parseBody(req);
      if (!body.channelUrl)
        return json(res, 400, { error: 'channelUrl required' });
      const result = await invokeIpc(
        'toolkit:channel:fetchUploadDates',
        body.channelUrl,
        body.daysBack ?? 90,
      );
      return json(res, 200, result);
    }

    if (method === 'GET' && p === '/subscriptions/process-load') {
      if (!skedulosaServices)
        return json(res, 503, { error: 'Skedulosa not ready' });
      const result = await invokeIpc('toolkit:process:load');
      return json(res, 200, result);
    }

    // ── AFDA ─────────────────────────────────────────────────────────────────
    if (p.startsWith('/afda')) {
      if (!afdaReady())
        return json(res, 503, { error: 'AFDA services not ready' });

      if (method === 'GET' && p === '/afda/articles') {
        const page = Number(url.searchParams.get('page') ?? '1');
        const limit = Number(url.searchParams.get('limit') ?? '20');
        const result = await callAfda<Record<string, unknown>>(
          'storage',
          'getArticles',
          [
            {
              limit,
              offset: (page - 1) * limit,
            },
          ],
        );
        return json(res, 200, { ...result, page, limit });
      }

      if (method === 'GET' && p === '/afda/articles/search') {
        const page = Number(url.searchParams.get('page') ?? '1');
        const limit = Number(url.searchParams.get('limit') ?? '20');
        const result = await callAfda<Record<string, unknown>>(
          'storage',
          'getArticlesFiltered',
          [
            {
              search: url.searchParams.get('q') ?? undefined,
              limit,
              offset: (page - 1) * limit,
            },
          ],
        );
        return json(res, 200, { ...result, page, limit });
      }

      if (method === 'GET' && p === '/afda/articles/manual') {
        const result = await callAfda('storage', 'listManualArticles', [
          { limit: 50, offset: 0 },
        ]);
        return json(res, 200, result);
      }

      if (method === 'POST' && p === '/afda/articles/parse') {
        const body = await parseBody(req);
        if (!body.url) return json(res, 400, { error: 'url required' });
        const result = await invokeIpc('manual_articles:parse', {
          url: body.url,
        });
        return json(res, 200, result);
      }

      if (method === 'POST' && p === '/afda/articles/reparse') {
        const body = await parseBody(req);
        if (!body.article_id)
          return json(res, 400, { error: 'article_id required' });
        const result = await invokeIpc('articles:reparse', {
          article_id: body.article_id,
        });
        return json(res, 200, result);
      }

      if (method === 'POST' && p === '/afda/articles/export') {
        const body = await parseBody(req);
        if (!body.output_dir)
          return json(res, 400, { error: 'output_dir required' });
        const exportPayload = {
          output_dir: body.output_dir,
          formats: [body.format ?? 'csv'],
          filters: {
            ...(body.website_ids ? { website_ids: body.website_ids } : {}),
            ...(body.section_ids ? { section_ids: body.section_ids } : {}),
            ...(body.date_from ? { date_from: body.date_from } : {}),
            ...(body.date_to ? { date_to: body.date_to } : {}),
            ...(body.search ? { search: body.search } : {}),
          },
        };
        const result = await invokeIpc('articles:export', exportPayload);
        return json(res, 200, result);
      }

      if (method === 'GET' && p === '/afda/articles/filtered') {
        const params = {
          search: url.searchParams.get('search') ?? undefined,
          website_ids:
            url.searchParams.get('website_ids')?.split(',').map(Number) ??
            undefined,
          section_ids:
            url.searchParams.get('section_ids')?.split(',').map(Number) ??
            undefined,
          date_from: url.searchParams.get('date_from') ?? undefined,
          date_to: url.searchParams.get('date_to') ?? undefined,
          limit: Number(url.searchParams.get('limit') ?? '20'),
          offset: Number(url.searchParams.get('offset') ?? '0'),
          sort_key: url.searchParams.get('sort_key') ?? undefined,
          sort_dir: url.searchParams.get('sort_dir') ?? undefined,
        };
        const result = await invokeIpc('articles:list_filtered', params);
        return json(res, 200, result);
      }

      if (method === 'GET' && p === '/afda/articles/count') {
        const params = {
          search: url.searchParams.get('search') ?? undefined,
          website_ids:
            url.searchParams.get('website_ids')?.split(',').map(Number) ??
            undefined,
          section_ids:
            url.searchParams.get('section_ids')?.split(',').map(Number) ??
            undefined,
          date_from: url.searchParams.get('date_from') ?? undefined,
          date_to: url.searchParams.get('date_to') ?? undefined,
        };
        const result = await invokeIpc('articles:count_filtered', params);
        return json(res, 200, result);
      }

      if (method === 'GET' && p === '/afda/articles/fqdns') {
        const result = await invokeIpc('articles:distinct_fqdns');
        return json(res, 200, result);
      }

      if (method === 'GET' && p === '/afda/articles/section-paths') {
        const result = await invokeIpc('articles:distinct_section_paths');
        return json(res, 200, result);
      }

      if (
        method === 'GET' &&
        p.startsWith('/afda/articles/') &&
        p !== '/afda/articles/search' &&
        p !== '/afda/articles/manual' &&
        p !== '/afda/articles/filtered' &&
        p !== '/afda/articles/count' &&
        p !== '/afda/articles/fqdns' &&
        p !== '/afda/articles/section-paths'
      ) {
        const id = Number(p.split('/').pop());
        if (isNaN(id)) return json(res, 400, { error: 'invalid article id' });
        const items = await callAfda<unknown[]>('storage', 'getArticlesByIds', [
          [id],
        ]);
        if (!items.length)
          return json(res, 404, { error: 'article not found' });
        return json(res, 200, items[0]);
      }

      // ── manual articles ────────────────────────────────────────────────────

      if (method === 'GET' && p === '/afda/manual-articles') {
        const params = {
          search: url.searchParams.get('search') ?? undefined,
          limit: Number(url.searchParams.get('limit') ?? '50'),
          offset: Number(url.searchParams.get('offset') ?? '0'),
        };
        const result = await invokeIpc('manual_articles:list', params);
        return json(res, 200, result);
      }

      if (method === 'GET' && p === '/afda/manual-articles/count') {
        const params = {
          search: url.searchParams.get('search') ?? undefined,
        };
        const result = await invokeIpc('manual_articles:count', params);
        return json(res, 200, result);
      }

      if (
        method === 'GET' &&
        p.startsWith('/afda/manual-articles/') &&
        !p.endsWith('/reparse')
      ) {
        const id = Number(p.split('/').pop());
        if (isNaN(id)) return json(res, 400, { error: 'invalid id' });
        const result = await invokeIpc('manual_articles:get', { id });
        return json(res, 200, result);
      }

      if (
        method === 'POST' &&
        p.match(/^\/afda\/manual-articles\/\d+\/delete$/)
      ) {
        const id = Number(p.split('/')[3]);
        if (isNaN(id)) return json(res, 400, { error: 'invalid id' });
        const result = await invokeIpc('manual_articles:delete', { id });
        return json(res, 200, result);
      }

      if (
        method === 'POST' &&
        p.startsWith('/afda/manual-articles/') &&
        p.endsWith('/reparse')
      ) {
        const id = Number(p.split('/')[3]);
        if (isNaN(id)) return json(res, 400, { error: 'invalid id' });
        const result = await invokeIpc('manual_articles:reparse', { id });
        return json(res, 200, result);
      }

      // ── websites ───────────────────────────────────────────────────────────

      if (method === 'GET' && p === '/afda/websites') {
        const websites = await callAfda<Array<{ id: number }>>(
          'storage',
          'getAllWebsites',
          [],
        );
        const sectioned = await Promise.all(
          websites.map(async (w) => ({
            ...w,
            sections: await callAfda('storage', 'getSectionsForWebsite', [
              w.id,
            ]),
          })),
        );
        return json(res, 200, sectioned);
      }

      if (method === 'POST' && p === '/afda/websites') {
        const body = await parseBody(req);
        if (!body.fqdn) return json(res, 400, { error: 'fqdn required' });

        // Normalize the simplified chat-tool payload into the full websites:save shape.
        // The chat skill passes: fqdn, website_name, category, mapper_raw (from run_mapper_sync),
        // section_links (from run_mapper_sync), and optional sections[] with path/name.
        // websites:save requires: fqdn, website_url, website_name, website_category,
        // mapper_raw, selected_sections[{section_url,section_path,schedule_config}], pagination.
        if (!body.selected_sections) {
          const defaultSchedule = { type: 'preset', preset: 'daily' };
          const fqdnStr = String(body.fqdn);
          const baseUrl = `https://${fqdnStr}`;

          // Build selected_sections from section_links (mapper result) or sections (simple format).
          // Filter out compactResult sentinel strings like "... (N more)" that may appear if the
          // array was truncated before being stored in the skill's results map.
          const sectionLinks: string[] = (
            Array.isArray(body.section_links) ? body.section_links : []
          ).filter(
            (s: unknown) => typeof s === 'string' && s.startsWith('http'),
          );
          const simpleSections: Array<{ path?: string; name?: string }> =
            Array.isArray(body.sections) ? body.sections : [];

          let selectedSections: Array<{
            section_url: string;
            section_path: string;
            schedule_config: unknown;
            max_articles_per_run?: number;
          }> = [];
          if (sectionLinks.length > 0) {
            selectedSections = sectionLinks.map((url: string) => {
              let path = '/';
              try {
                path = new URL(url).pathname || '/';
              } catch {
                /* keep / */
              }
              return {
                section_url: url,
                section_path: path,
                schedule_config: defaultSchedule,
                max_articles_per_run: 10,
              };
            });
          } else if (simpleSections.length > 0) {
            selectedSections = simpleSections.map((s) => {
              const p = s.path ?? '/';
              return {
                section_url: `${baseUrl}${p}`,
                section_path: p,
                schedule_config: defaultSchedule,
                max_articles_per_run: 10,
              };
            });
          } else {
            selectedSections = [
              {
                section_url: baseUrl,
                section_path: '/',
                schedule_config: defaultSchedule,
                max_articles_per_run: 10,
              },
            ];
          }

          const normalizedBody = {
            fqdn: fqdnStr,
            website_url: body.website_url ?? baseUrl,
            website_name: body.website_name ?? fqdnStr,
            website_category: body.category ?? body.website_category ?? 'News',
            mapper_raw: body.mapper_raw ?? {},
            pagination: body.pagination ?? null,
            selected_sections: selectedSections,
            lookback_mode: body.lookback_mode ?? null,
            lookback_value: body.lookback_value ?? null,
          };
          const result = await invokeIpc('websites:save', normalizedBody);
          hydrateAfdaRenderer();
          return json(res, 200, result);
        }

        const result = await invokeIpc('websites:save', body);
        hydrateAfdaRenderer();
        return json(res, 200, result);
      }

      if (method === 'POST' && p.match(/^\/afda\/websites\/\d+\/update$/)) {
        const id = Number(p.split('/')[3]);
        if (isNaN(id)) return json(res, 400, { error: 'invalid website id' });
        const body = await parseBody(req);
        const result = await invokeIpc('websites:update', { id, patch: body });
        hydrateAfdaRenderer();
        return json(res, 200, result);
      }

      if (method === 'POST' && p.match(/^\/afda\/websites\/\d+\/delete$/)) {
        const id = Number(p.split('/')[3]);
        if (isNaN(id)) return json(res, 400, { error: 'invalid website id' });
        const result = await invokeIpc('websites:delete', { id });
        hydrateAfdaRenderer();
        return json(res, 200, result);
      }

      if (method === 'POST' && p === '/afda/websites/add-sections') {
        const body = await parseBody(req);
        if (!body.website_id)
          return json(res, 400, { error: 'website_id required' });
        const result = await invokeIpc('websites:add_sections', body);
        hydrateAfdaRenderer();
        return json(res, 200, result);
      }

      if (method === 'POST' && p === '/afda/websites/reset-initial-scrape') {
        const body = await parseBody(req);
        if (!body.website_id)
          return json(res, 400, { error: 'website_id required' });
        const result = await invokeIpc('websites:reset_initial_scrape', {
          website_id: body.website_id,
        });
        hydrateAfdaRenderer();
        return json(res, 200, result);
      }

      // ── sections ───────────────────────────────────────────────────────────

      if (method === 'POST' && p === '/afda/sections') {
        const body = await parseBody(req);
        if (!body.website_id || !body.path)
          return json(res, 400, { error: 'website_id and path required' });
        const result = await invokeIpc('sections:add', body);
        hydrateAfdaRenderer();
        return json(res, 200, result);
      }

      if (method === 'POST' && p === '/afda/sections/delete') {
        const body = await parseBody(req);
        if (!Array.isArray(body.section_ids))
          return json(res, 400, { error: 'section_ids array required' });
        const result = await invokeIpc('sections:delete', {
          section_ids: body.section_ids,
        });
        hydrateAfdaRenderer();
        return json(res, 200, result);
      }

      if (
        method === 'POST' &&
        p.match(/^\/afda\/sections\/\d+\/schedule\/update$/)
      ) {
        const sectionId = Number(p.split('/')[3]);
        if (isNaN(sectionId))
          return json(res, 400, { error: 'invalid section id' });
        const body = await parseBody(req);
        const result = await invokeIpc('sections:update_schedule', {
          section_id: sectionId,
          config: body.config,
          follow_manual: body.follow_manual ?? false,
        });
        hydrateAfdaRenderer();
        return json(res, 200, result);
      }

      if (
        method === 'POST' &&
        p.match(/^\/afda\/sections\/\d+\/max-articles\/update$/)
      ) {
        const sectionId = Number(p.split('/')[3]);
        if (isNaN(sectionId))
          return json(res, 400, { error: 'invalid section id' });
        const body = await parseBody(req);
        const result = await invokeIpc('sections:set_max_articles', {
          section_id: sectionId,
          max_articles_per_run: body.max_articles_per_run ?? null,
        });
        hydrateAfdaRenderer();
        return json(res, 200, result);
      }

      // ── schedules ──────────────────────────────────────────────────────────

      if (method === 'POST' && p === '/afda/schedule/assign') {
        const body = await parseBody(req);
        if (!body.section_id)
          return json(res, 400, { error: 'section_id required' });
        const result = await invokeIpc('schedule:assign', body);
        hydrateAfdaRenderer();
        return json(res, 200, result);
      }

      if (method === 'POST' && p === '/afda/schedule/pause') {
        const body = await parseBody(req);
        if (!body.section_id)
          return json(res, 400, { error: 'section_id required' });
        const result = await invokeIpc('schedule:pause', {
          section_id: body.section_id,
        });
        hydrateAfdaRenderer();
        return json(res, 200, result);
      }

      if (method === 'POST' && p === '/afda/schedule/resume') {
        const body = await parseBody(req);
        if (!body.section_id)
          return json(res, 400, { error: 'section_id required' });
        const result = await invokeIpc('schedule:resume', body);
        hydrateAfdaRenderer();
        return json(res, 200, result);
      }

      if (method === 'GET' && p === '/afda/schedule') {
        const websiteId = url.searchParams.get('website_id');
        const result = await invokeIpc('schedule:get', {
          website_id: websiteId ? Number(websiteId) : undefined,
        });
        return json(res, 200, result);
      }

      // ── scrape ─────────────────────────────────────────────────────────────

      if (method === 'POST' && p === '/afda/scrape') {
        const body = await parseBody(req);
        const websiteId = body.websiteId as number;
        const sectionId = body.sectionId as number | undefined;
        if (!websiteId) return json(res, 400, { error: 'websiteId required' });

        const sections = sectionId
          ? [await callAfda('storage', 'getSection', [sectionId])].filter(
              Boolean,
            )
          : await callAfda<Array<{ id: number }>>(
              'storage',
              'getSectionsForWebsite',
              [websiteId],
            );

        if (!sections.length)
          return json(res, 404, { error: 'no sections found' });

        for (const section of sections as Array<{ id: number }>) {
          if (section)
            void callAfda('scrapeEngine', 'runJob', [
              section.id,
              'manual',
            ]).catch(console.error);
        }
        return json(res, 200, { started: true, sections: sections.length });
      }

      if (method === 'POST' && p === '/afda/scrape/run-now') {
        const body = await parseBody(req);
        if (!body.section_id)
          return json(res, 400, { error: 'section_id required' });
        const result = await invokeIpc('scrape:run_now', {
          section_id: body.section_id,
        });
        return json(res, 200, result);
      }

      if (method === 'GET' && p === '/afda/scrape/job-status') {
        const jobId = Number(url.searchParams.get('job_id'));
        if (isNaN(jobId)) return json(res, 400, { error: 'job_id required' });
        const result = await invokeIpc('scrape:job_status', { job_id: jobId });
        return json(res, 200, result);
      }

      if (method === 'GET' && p === '/afda/scrape/job-size') {
        const jobId = Number(url.searchParams.get('job_id'));
        if (isNaN(jobId)) return json(res, 400, { error: 'job_id required' });
        const result = await invokeIpc('scrape:job_size', { job_id: jobId });
        return json(res, 200, result);
      }

      if (method === 'GET' && p === '/afda/scrape/job-articles') {
        const jobId = Number(url.searchParams.get('job_id'));
        if (isNaN(jobId)) return json(res, 400, { error: 'job_id required' });
        const result = await invokeIpc('scrape:job_articles', {
          job_id: jobId,
        });
        return json(res, 200, result);
      }

      if (method === 'GET' && p === '/afda/jobs') {
        const limit = Number(url.searchParams.get('limit') ?? '20');
        const sectionId = url.searchParams.get('sectionId');
        const rows = await callAfda('storage', 'getScrapeJobs', [
          {
            limit,
            section_id: sectionId ? Number(sectionId) : undefined,
          },
        ]);
        return json(res, 200, rows);
      }

      // ── mapper ─────────────────────────────────────────────────────────────

      if (method === 'POST' && p === '/afda/mapper/run') {
        const body = await parseBody(req);
        if (!body.website_url)
          return json(res, 400, { error: 'website_url required' });
        const result = await invokeIpc('mapper:run', body);
        return json(res, 200, result);
      }

      if (method === 'POST' && p === '/afda/mapper/run-sync') {
        if (!afdaReady())
          return json(res, 503, { error: 'AFDA services not ready' });
        const body = await parseBody(req);
        if (!body.website_url)
          return json(res, 400, { error: 'website_url required' });
        const hasMapper = await callAfda<boolean>('meta', 'hasService', [
          'mapper',
        ]);
        if (!hasMapper)
          return json(res, 503, {
            error: 'Mapper service not registered. Restart the app.',
          });
        // Cap sections to 20 — large sites (100+ sections) would make TA take minutes.
        // Skip temporal analysis entirely here; the UI wizard does it on demand.
        const MAX_SECTIONS = 1;
        try {
          const mapperResult = await callAfda<{ section_links: string[] }>(
            'mapper',
            'run',
            [
              {
                website_url: String(body.website_url),
                fqdn: String(body.fqdn ?? ''),
                website_name: String(body.website_name ?? body.fqdn ?? ''),
                website_category: String(body.website_category ?? 'News'),
              },
            ],
          );
          const totalSections = mapperResult.section_links.length;
          if (totalSections > MAX_SECTIONS) {
            mapperResult.section_links = mapperResult.section_links.slice(
              0,
              MAX_SECTIONS,
            );
          }
          sendToRenderer('mapper:complete', mapperResult);
          return json(res, 200, {
            ...mapperResult,
            total_sections_found: totalSections,
            sections_capped: totalSections > MAX_SECTIONS,
          });
        } catch (err) {
          console.error('[bridge] /afda/mapper/run-sync error:', err);
          return json(res, 500, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (method === 'POST' && p === '/afda/mapper/batch') {
        const body = await parseBody(req);
        if (!body.batchId || !Array.isArray(body.items))
          return json(res, 400, { error: 'batchId and items required' });
        const result = await invokeIpc('batch:start', body);
        return json(res, 200, result);
      }

      if (method === 'POST' && p === '/afda/mapper/batch/cancel') {
        const body = await parseBody(req);
        if (!body.batchId) return json(res, 400, { error: 'batchId required' });
        const result = await invokeIpc('batch:cancel', {
          batchId: body.batchId,
        });
        return json(res, 200, result);
      }

      if (method === 'GET' && p === '/afda/mapper/batch/status') {
        const batchId = url.searchParams.get('batchId');
        if (!batchId) return json(res, 400, { error: 'batchId required' });
        const result = await invokeIpc('batch:get-status', { batchId });
        return json(res, 200, result);
      }

      // ── analytics ──────────────────────────────────────────────────────────

      if (method === 'GET' && p === '/afda/analytics') {
        const websiteId = Number(url.searchParams.get('websiteId'));
        const days = Number(url.searchParams.get('days') ?? '30');
        if (isNaN(websiteId))
          return json(res, 400, { error: 'websiteId required' });
        const analytics = await callAfda('storage', 'getWebsiteAnalytics', [
          websiteId,
          days,
        ]);
        return json(res, 200, analytics);
      }

      if (method === 'POST' && p === '/afda/temporal/run') {
        const body = await parseBody(req);
        if (!body.section_id)
          return json(res, 400, { error: 'section_id required' });
        const result = await invokeIpc('ta:run_section', {
          section_id: body.section_id,
        });
        return json(res, 200, result);
      }

      // ── settings ───────────────────────────────────────────────────────────

      if (method === 'GET' && p === '/afda/settings') {
        const key = url.searchParams.get('key');
        if (key)
          return json(res, 200, {
            key,
            value: await callAfda('storage', 'getAppSetting', [key]),
          });
        return json(res, 200, {
          note: 'Provide ?key=<setting_key> to fetch a specific setting',
        });
      }

      if (method === 'POST' && p === '/afda/settings') {
        const body = await parseBody(req);
        if (!body.key) return json(res, 400, { error: 'key required' });
        const result = await invokeIpc('settings:set', {
          key: body.key,
          value: body.value,
        });
        return json(res, 200, result);
      }

      if (method === 'POST' && p === '/afda/settings/load-control') {
        const body = await parseBody(req);
        if (!body.max) return json(res, 400, { error: 'max required' });
        const result = await invokeIpc('settings:update_load_control', {
          max: body.max,
        });
        return json(res, 200, result);
      }

      // ── auth ───────────────────────────────────────────────────────────────

      if (method === 'POST' && p === '/afda/auth/login') {
        const body = await parseBody(req);
        if (!body.websiteId || !body.loginUrl)
          return json(res, 400, { error: 'websiteId and loginUrl required' });
        const result = await invokeIpc('auth:open-login', {
          websiteId: body.websiteId,
          loginUrl: body.loginUrl,
        });
        return json(res, 200, result);
      }

      if (method === 'GET' && p === '/afda/auth/status') {
        const websiteId = Number(url.searchParams.get('websiteId'));
        if (isNaN(websiteId))
          return json(res, 400, { error: 'websiteId required' });
        const result = await invokeIpc('auth:get-status', { websiteId });
        return json(res, 200, result);
      }

      if (method === 'POST' && p === '/afda/auth/clear') {
        const body = await parseBody(req);
        if (!body.websiteId)
          return json(res, 400, { error: 'websiteId required' });
        const result = await invokeIpc('auth:clear', {
          websiteId: body.websiteId,
        });
        return json(res, 200, result);
      }

      // ── store ──────────────────────────────────────────────────────────────

      if (method === 'GET' && p === '/afda/store') {
        const result = await invokeIpc('store:get_all');
        return json(res, 200, result);
      }

      // ── social sources ───────────────────────────────────────────────────────
      // Social services are called directly (not via IPC) — they are not wired
      // into the package ipc-handlers; the bridge owns this surface.
      {
        const hasSocialFeed = await callAfda<boolean>('meta', 'hasService', [
          'socialFeed',
        ]);
        const hasSocialScheduler = await callAfda<boolean>(
          'meta',
          'hasService',
          ['socialScheduler'],
        );

        // On-demand scrape: URL → posts, no persistence. Works with zero setup.
        if (method === 'POST' && p === '/afda/social/scrape') {
          if (!hasSocialFeed)
            return json(res, 503, { error: 'Social services not ready' });
          const body = await parseBody(req);
          if (!body.url) return json(res, 400, { error: 'url required' });
          try {
            const posts = await callAfda<unknown[]>(
              'socialFeed',
              'scrapeProfile',
              [
                {
                  url: String(body.url),
                  platform: body.platform ? String(body.platform) : undefined,
                  account: body.account ? String(body.account) : undefined,
                  useNitter:
                    body.useNitter === true || body.useNitter === 'true',
                },
              ],
            );
            return json(res, 200, { posts, count: posts.length });
          } catch (err) {
            return json(res, 200, {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        if (method === 'GET' && p === '/afda/social/sources') {
          return json(
            res,
            200,
            await callAfda('storage', 'listSocialSources', []),
          );
        }

        if (method === 'POST' && p === '/afda/social/sources') {
          if (!hasSocialFeed)
            return json(res, 503, { error: 'Social services not ready' });
          const body = await parseBody(req);
          if (!body.url) return json(res, 400, { error: 'url required' });
          const rawUrl = String(body.url);
          let handle = body.handle ? String(body.handle) : '';
          if (!handle) {
            // Derive a handle from the last non-empty path segment.
            try {
              const u = new URL(rawUrl);
              handle =
                u.pathname.split('/').filter(Boolean).pop() ?? u.hostname;
            } catch {
              handle = rawUrl;
            }
          }
          // Persist 'auto' when unspecified; SocialFeedService.scrapeAndStore
          // resolves 'auto' to the URL-detected platform at scrape time.
          const platform = body.platform ? String(body.platform) : 'auto';
          const id = await callAfda<number>('storage', 'upsertSocialSource', [
            {
              url: rawUrl,
              handle,
              platform,
              label: body.label ? String(body.label) : handle,
              account: body.account ? String(body.account) : null,
            },
          ]);
          return json(res, 200, {
            ok: true,
            source: await callAfda('storage', 'getSocialSource', [id]),
          });
        }

        const sourceIdMatch = p.match(/^\/afda\/social\/sources\/(\d+)$/);
        if (method === 'GET' && sourceIdMatch) {
          const id = Number(sourceIdMatch[1]);
          const source = await callAfda('storage', 'getSocialSource', [id]);
          if (!source) return json(res, 404, { error: 'source not found' });
          return json(res, 200, source);
        }

        const postsMatch = p.match(/^\/afda\/social\/sources\/(\d+)\/posts$/);
        if (method === 'GET' && postsMatch) {
          const id = Number(postsMatch[1]);
          const limit = Number(url.searchParams.get('limit') ?? '20');
          const offset = Number(url.searchParams.get('offset') ?? '0');
          return json(
            res,
            200,
            await callAfda('storage', 'getSocialPosts', [
              id,
              { limit, offset },
            ]),
          );
        }

        const updateMatch = p.match(/^\/afda\/social\/sources\/(\d+)\/update$/);
        if (method === 'POST' && updateMatch) {
          const id = Number(updateMatch[1]);
          const body = await parseBody(req);
          const patch: Record<string, unknown> = {};
          if (body.label !== undefined) patch.label = body.label;
          if (body.account !== undefined) patch.account = body.account;
          await callAfda('storage', 'updateSocialSource', [id, patch]);
          return json(res, 200, {
            ok: true,
            source: await callAfda('storage', 'getSocialSource', [id]),
          });
        }

        const deleteMatch = p.match(/^\/afda\/social\/sources\/(\d+)\/delete$/);
        if (method === 'POST' && deleteMatch) {
          const id = Number(deleteMatch[1]);
          await callAfda('storage', 'deleteSocialSource', [id]);
          return json(res, 200, { ok: true });
        }

        const scrapeNowMatch = p.match(
          /^\/afda\/social\/sources\/(\d+)\/scrape-now$/,
        );
        if (method === 'POST' && scrapeNowMatch) {
          if (!hasSocialFeed)
            return json(res, 503, { error: 'Social services not ready' });
          const id = Number(scrapeNowMatch[1]);
          try {
            const inserted = await callAfda<number>(
              'socialFeed',
              'scrapeAndStore',
              [id],
            );
            return json(res, 200, { ok: true, inserted });
          } catch (err) {
            return json(res, 200, {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        const assignMatch = p.match(
          /^\/afda\/social\/sources\/(\d+)\/schedule\/assign$/,
        );
        if (method === 'POST' && assignMatch) {
          if (!hasSocialScheduler)
            return json(res, 503, { error: 'Social services not ready' });
          const id = Number(assignMatch[1]);
          const body = await parseBody(req);
          if (!body.config) return json(res, 400, { error: 'config required' });
          const next = await callAfda('socialScheduler', 'assignSchedule', [
            id,
            body.config,
          ]);
          return json(res, 200, { ok: true, next_run_at: next });
        }

        const pauseMatch = p.match(
          /^\/afda\/social\/sources\/(\d+)\/schedule\/pause$/,
        );
        if (method === 'POST' && pauseMatch) {
          if (!hasSocialScheduler)
            return json(res, 503, { error: 'Social services not ready' });
          await callAfda('socialScheduler', 'pause', [Number(pauseMatch[1])]);
          return json(res, 200, { ok: true });
        }

        const resumeMatch = p.match(
          /^\/afda\/social\/sources\/(\d+)\/schedule\/resume$/,
        );
        if (method === 'POST' && resumeMatch) {
          if (!hasSocialScheduler)
            return json(res, 503, { error: 'Social services not ready' });
          try {
            const next = await callAfda('socialScheduler', 'resume', [
              Number(resumeMatch[1]),
            ]);
            return json(res, 200, { ok: true, next_run_at: next });
          } catch (err) {
            return json(res, 400, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }

    return json(res, 404, { error: `No route: ${method} ${p}` });
  } catch (err) {
    console.error('[mcpBridge] request error:', err);
    if (!res.headersSent) {
      json(res, 500, { error: String(err) });
    }
  }
}

// ─── public start/stop ────────────────────────────────────────────────────────

export function startMcpBridgeServer(): void {
  bearerToken = generateToken();
  writeTokenFile(bearerToken);

  server = http.createServer((req, res) => {
    void handleRequest(req, res);
  });

  wss = new WebSocketServer({ server });
  wss.on('connection', (ws, req) => {
    const wsUrl = new URL(
      req.url ?? '/',
      `http://127.0.0.1:${MCP_BRIDGE_PORT}`,
    );
    const token = wsUrl.searchParams.get('token');
    if (token !== bearerToken) {
      ws.close(4401, 'Unauthorized');
      return;
    }
    wsClients.add(ws);
    ws.on('close', () => wsClients.delete(ws));
    ws.on('error', () => wsClients.delete(ws));
  });

  server.listen(MCP_BRIDGE_PORT, '127.0.0.1', () => {
    console.log(`[mcpBridge] Listening on 127.0.0.1:${MCP_BRIDGE_PORT}`);
    console.log(
      `[mcpBridge] Token file: ${path.join(
        resolveUserDataPath(),
        'mcp-token.txt',
      )}`,
    );
  });

  server.on('error', (err) => {
    console.error('[mcpBridge] Server error:', err);
  });
}

export function stopMcpBridgeServer(): void {
  for (const client of wsClients) {
    try {
      client.terminate();
    } catch {
      /* ignore */
    }
  }
  wsClients.clear();
  wss?.close();
  server?.close();
  server = null;
  wss = null;
}
