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
import os from 'os';
import { getUserDataPath, getAppVersion } from '../../utils/platformPaths';

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
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function parseBody(
  req: http.IncomingMessage,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
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
    // ── status ────────────────────────────────────────────────────────────────
    if (method === 'GET' && p === '/status') {
      return json(res, 200, {
        ok: true,
        app: 'Downlodr',
        version: resolveAppVersion(),
        platform: process.platform,
        afdaReady: afdaReady(),
        skedulosaReady: !!skedulosaServices,
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
        cookiesFromBrowser: '',
        noPlaylist: true,
      });
      return json(res, 200, info);
    }

    if (method === 'GET' && p === '/downloads/playlist') {
      const videoUrl = url.searchParams.get('url');
      if (!videoUrl) return json(res, 400, { error: 'url param required' });
      const info = await YTDLP.getPlaylistInfo({
        url: videoUrl,
        cookiesFromBrowser: '',
      });
      return json(res, 200, info);
    }

    if (method === 'GET' && p === '/downloads/ytdlp-version') {
      const version = await YTDLP.getYTDLPVersion();
      return json(res, 200, { version });
    }

    // ── start download ────────────────────────────────────────────────────────
    if (method === 'POST' && p === '/downloads/start') {
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
        const outputFilepath = String(body.outputFilepath);
        const slash = Math.max(
          outputFilepath.lastIndexOf('/'),
          outputFilepath.lastIndexOf('\\'),
        );
        const location =
          slash >= 0 ? outputFilepath.slice(0, slash) : outputFilepath;
        try {
          const result = await commandRenderer({
            action: 'start_download',
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

      return json(res, 200, { downloadId, controllerId });
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
            ? (body.download_quality ?? 'Best Quality')
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
      void (async () => {
        try {
          // Fetch avatar/details
          const details = (await invokeIpc(
            'toolkit:channel:fetchDetails',
            body.url,
          )) as {
            name?: string;
            thumbnailUrl?: string;
            subscriberCount?: number;
            videoCount?: number;
            error?: string;
          } | null;
          const channelDetails =
            details && !details.error
              ? {
                  avatarUrl: details.thumbnailUrl ?? '',
                  subscriberCount: details.subscriberCount ?? 0,
                  videoCount: String(details.videoCount ?? ''),
                  site: 'youtube',
                }
              : null;
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
      sendToRenderer('toolkit:channel:updated', { id: channelId, active: body.active ?? true });
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
        const result = await callAfda<Record<string, unknown>>('storage', 'getArticles', [{
          limit,
          offset: (page - 1) * limit,
        }]);
        return json(res, 200, { ...result, page, limit });
      }

      if (method === 'GET' && p === '/afda/articles/search') {
        const page = Number(url.searchParams.get('page') ?? '1');
        const limit = Number(url.searchParams.get('limit') ?? '20');
        const result = await callAfda<Record<string, unknown>>('storage', 'getArticlesFiltered', [{
          search: url.searchParams.get('q') ?? undefined,
          limit,
          offset: (page - 1) * limit,
        }]);
        return json(res, 200, { ...result, page, limit });
      }

      if (method === 'GET' && p === '/afda/articles/manual') {
        const result = await callAfda('storage', 'listManualArticles', [{ limit: 50, offset: 0 }]);
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
        const items = await callAfda<unknown[]>('storage', 'getArticlesByIds', [[id]]);
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
        const websites = await callAfda<Array<{ id: number }>>('storage', 'getAllWebsites', []);
        const sectioned = await Promise.all(
          websites.map(async (w) => ({
            ...w,
            sections: await callAfda('storage', 'getSectionsForWebsite', [w.id]),
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
          ? [await callAfda('storage', 'getSection', [sectionId])].filter(Boolean)
          : await callAfda<Array<{ id: number }>>('storage', 'getSectionsForWebsite', [websiteId]);

        if (!sections.length)
          return json(res, 404, { error: 'no sections found' });

        for (const section of sections as Array<{ id: number }>) {
          if (section)
            void callAfda('scrapeEngine', 'runJob', [section.id, 'manual']).catch(console.error);
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
        const rows = await callAfda('storage', 'getScrapeJobs', [{
          limit,
          section_id: sectionId ? Number(sectionId) : undefined,
        }]);
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
        const hasMapper = await callAfda<boolean>('meta', 'hasService', ['mapper']);
        if (!hasMapper)
          return json(res, 503, {
            error: 'Mapper service not registered. Restart the app.',
          });
        // Cap sections to 20 — large sites (100+ sections) would make TA take minutes.
        // Skip temporal analysis entirely here; the UI wizard does it on demand.
        const MAX_SECTIONS = 1;
        try {
          const mapperResult = await callAfda<{ section_links: string[] }>('mapper', 'run', [{
            website_url: String(body.website_url),
            fqdn: String(body.fqdn ?? ''),
            website_name: String(body.website_name ?? body.fqdn ?? ''),
            website_category: String(body.website_category ?? 'News'),
          }]);
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
        const analytics = await callAfda('storage', 'getWebsiteAnalytics', [websiteId, days]);
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
          return json(res, 200, { key, value: await callAfda('storage', 'getAppSetting', [key]) });
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
        const hasSocialFeed = await callAfda<boolean>('meta', 'hasService', ['socialFeed']);
        const hasSocialScheduler = await callAfda<boolean>('meta', 'hasService', ['socialScheduler']);

        // On-demand scrape: URL → posts, no persistence. Works with zero setup.
        if (method === 'POST' && p === '/afda/social/scrape') {
          if (!hasSocialFeed)
            return json(res, 503, { error: 'Social services not ready' });
          const body = await parseBody(req);
          if (!body.url) return json(res, 400, { error: 'url required' });
          try {
            const posts = await callAfda<unknown[]>('socialFeed', 'scrapeProfile', [{
              url: String(body.url),
              platform: body.platform ? String(body.platform) : undefined,
              account: body.account ? String(body.account) : undefined,
              useNitter: body.useNitter === true || body.useNitter === 'true',
            }]);
            return json(res, 200, { posts, count: posts.length });
          } catch (err) {
            return json(res, 200, {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        if (method === 'GET' && p === '/afda/social/sources') {
          return json(res, 200, await callAfda('storage', 'listSocialSources', []));
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
          const id = await callAfda<number>('storage', 'upsertSocialSource', [{
            url: rawUrl,
            handle,
            platform,
            label: body.label ? String(body.label) : handle,
            account: body.account ? String(body.account) : null,
          }]);
          return json(res, 200, { ok: true, source: await callAfda('storage', 'getSocialSource', [id]) });
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
          return json(res, 200, await callAfda('storage', 'getSocialPosts', [id, { limit, offset }]));
        }

        const updateMatch = p.match(
          /^\/afda\/social\/sources\/(\d+)\/update$/,
        );
        if (method === 'POST' && updateMatch) {
          const id = Number(updateMatch[1]);
          const body = await parseBody(req);
          const patch: Record<string, unknown> = {};
          if (body.label !== undefined) patch.label = body.label;
          if (body.account !== undefined) patch.account = body.account;
          await callAfda('storage', 'updateSocialSource', [id, patch]);
          return json(res, 200, { ok: true, source: await callAfda('storage', 'getSocialSource', [id]) });
        }

        const deleteMatch = p.match(
          /^\/afda\/social\/sources\/(\d+)\/delete$/,
        );
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
            const inserted = await callAfda<number>('socialFeed', 'scrapeAndStore', [id]);
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
          if (!body.config)
            return json(res, 400, { error: 'config required' });
          const next = await callAfda('socialScheduler', 'assignSchedule', [id, body.config]);
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
            const next = await callAfda('socialScheduler', 'resume', [Number(resumeMatch[1])]);
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
