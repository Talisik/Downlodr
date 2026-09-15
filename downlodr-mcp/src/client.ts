/**
 * HTTP + WebSocket client for the Downlodr MCP bridge server.
 * Reads the auth token from {userData}/mcp-token.txt at startup.
 * Falls back to an env var DOWNLODR_MCP_TOKEN if set.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import { WebSocket } from 'ws';

export const BRIDGE_PORT = 7185;
export const BRIDGE_HOST = '127.0.0.1';
export const BRIDGE_BASE = `http://${BRIDGE_HOST}:${BRIDGE_PORT}`;

let token: string | null = null;

function resolveTokenPath(): string {
  // Match Electron's app.getPath('userData') per platform
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Downlodr', 'mcp-token.txt');
    case 'win32':
      return path.join(
        process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'),
        'Downlodr',
        'mcp-token.txt',
      );
    default:
      return path.join(
        process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'),
        'Downlodr',
        'mcp-token.txt',
      );
  }
}

export function loadToken(): void {
  if (process.env.DOWNLODR_MCP_TOKEN) {
    token = process.env.DOWNLODR_MCP_TOKEN;
    return;
  }
  const tokenPath = resolveTokenPath();
  try {
    token = fs.readFileSync(tokenPath, 'utf-8').trim();
  } catch {
    // If we already have a cached token, keep using it rather than crashing
    if (!token) {
      throw new Error(
        `Cannot read Downlodr MCP token from ${tokenPath}.\n` +
          'Make sure Downlodr is running, or set DOWNLODR_MCP_TOKEN env var.',
      );
    }
  }
}

function getToken(): string {
  // Always re-read from disk so a Downlodr restart (which generates a new token) is handled automatically
  loadToken();
  return token!;
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

export class BridgeError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'BridgeError';
  }
}

export async function bridgeGet<T>(urlPath: string, params?: Record<string, string | number>): Promise<T> {
  const u = new URL(urlPath, BRIDGE_BASE);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      u.searchParams.set(k, String(v));
    }
  }
  return request<T>('GET', u.toString());
}

export async function bridgePost<T>(urlPath: string, body?: unknown): Promise<T> {
  return request<T>('POST', `${BRIDGE_BASE}${urlPath}`, body);
}

function request<T>(method: string, fullUrl: string, body?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(fullUrl);
    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data) as T;
          if ((res.statusCode ?? 200) >= 400) {
            const msg = (parsed as { error?: string }).error ?? `HTTP ${res.statusCode}`;
            reject(new BridgeError(res.statusCode ?? 500, msg));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`Invalid JSON from bridge: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(
        new Error(
          `Cannot reach Downlodr bridge at ${BRIDGE_BASE}. Is Downlodr running?\n${err.message}`,
        ),
      );
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── WebSocket event stream ───────────────────────────────────────────────────

export type BridgeEvent = {
  type: string;
  payload: unknown;
};

export function connectEventStream(
  onEvent: (event: BridgeEvent) => void,
  onClose?: () => void,
): WebSocket {
  const wsUrl = `ws://${BRIDGE_HOST}:${BRIDGE_PORT}/events?token=${encodeURIComponent(getToken())}`;
  const ws = new WebSocket(wsUrl);

  ws.on('message', (data) => {
    try {
      const event = JSON.parse(data.toString()) as BridgeEvent;
      onEvent(event);
    } catch {
      // ignore malformed frames
    }
  });

  ws.on('close', () => onClose?.());
  ws.on('error', () => onClose?.());

  return ws;
}

// ─── Polling helper for progress tracking ────────────────────────────────────

export function waitForEvent(
  ws: WebSocket,
  predicate: (event: BridgeEvent) => boolean,
  timeoutMs = 300_000,
): Promise<BridgeEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for download event'));
    }, timeoutMs);

    const handler = (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString()) as BridgeEvent;
        if (predicate(event)) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(event);
        }
      } catch {
        // ignore
      }
    };
    ws.on('message', handler);
  });
}
