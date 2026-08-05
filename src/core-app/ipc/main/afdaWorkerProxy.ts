// src/core-app/ipc/main/afdaWorkerProxy.ts

/**
 * Main-process proxy for the AFDA utilityProcess worker (afda-worker/entry.ts).
 * Forks the worker, forwards renderer IPC calls to it, relays its push events
 * back to the renderer, keeps the worker's FakeWindow state in sync with the
 * real BrowserWindow, and handles crash/timeout/shutdown.
 */

import { BrowserWindow, ipcMain, utilityProcess } from 'electron';
import path from 'node:path';
import { getElectronPaths } from './electronPaths';
import { registerBridgeHandler, registerAfdaServiceProxy } from './mcpBridgeServer';
import type { AfdaWorkerInbound, AfdaWorkerOutbound } from './afda-worker/protocol';

const CALL_TIMEOUT_MS = 15000;
const MAX_RESPAWNS = 1;

interface PendingCall {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

let child: Electron.UtilityProcess | null = null;
let ready = false;
let respawnCount = 0;
let callSeq = 0;
let shuttingDown = false;
const pending = new Map<string, PendingCall>();
const registeredChannels = new Set<string>();

function post(msg: AfdaWorkerInbound): void {
  child?.postMessage(msg);
}

function nextCallId(): string {
  callSeq += 1;
  return `afda_${Date.now()}_${callSeq}`;
}

export function isAfdaWorkerReady(): boolean {
  return ready;
}

export async function callAfdaService<T = unknown>(
  service: string,
  method: string,
  args: unknown[] = [],
): Promise<T> {
  if (!ready) throw new Error('AFDA services not ready');
  const callId = nextCallId();
  const payload: AfdaWorkerInbound = { type: 'service-call', callId, service, method, args };
  return runPendingCall<T>(callId, payload);
}

// Hand our callService/isReady pair to mcpBridgeServer.ts via its
// registration callback rather than mcpBridgeServer.ts statically importing
// these two functions — avoids a real circular ES module dependency (this
// module already imports registerBridgeHandler from mcpBridgeServer.ts).
// Safe to call at module-eval time: callAfdaService/isAfdaWorkerReady are
// stable function references that don't depend on the worker being spawned
// yet — they just check `ready` / reject when it's false at call time.
registerAfdaServiceProxy({
  callService: callAfdaService,
  isReady: isAfdaWorkerReady,
});

function forwardChannel(channel: string): (event: unknown, ...args: unknown[]) => Promise<unknown> {
  return async (_event, ...args) => {
    if (!ready) throw new Error('AFDA services not ready');
    const callId = nextCallId();
    const payload: AfdaWorkerInbound = { type: 'call', callId, channel, args };
    return runPendingCall(callId, payload);
  };
}

function runPendingCall<T>(callId: string, message: AfdaWorkerInbound): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(callId);
      reject(new Error('AFDA worker did not respond in time.'));
    }, CALL_TIMEOUT_MS);
    pending.set(callId, { resolve: resolve as (v: unknown) => void, reject, timer });
    post(message);
  });
}

export function startAfdaWorker(
  mainWindow: BrowserWindow,
  dbPath: string,
  addonPath?: string,
): () => void {
  spawnWorker(mainWindow, dbPath, addonPath);

  return () => {
    shuttingDown = true;
    if (!child) return;
    post({ type: 'shutdown' });
    const c = child;
    const killTimer = setTimeout(() => c.kill(), 3000);
    c.once('exit', () => clearTimeout(killTimer));
  };
}

function spawnWorker(mainWindow: BrowserWindow, dbPath: string, addonPath?: string): void {
  ready = false;
  const entryPath = path.join(__dirname, 'entry.js');
  const paths = getElectronPaths();
  // These three env vars are read by vite.afda-worker.config.ts's
  // output.banner to populate global.__electronPaths inside the worker,
  // BEFORE any of its bundled code (including the hoisted better-sqlite3/
  // afda-backend external-require preamble) runs. This is the worker
  // equivalent of vite.main.config.ts's require('electron')-based banner —
  // env vars are available synchronously at process start; a postMessage
  // after fork is not early enough (see Task 1's report and Task 2 Step 3's
  // comment in entry.ts for why).
  child = utilityProcess.fork(entryPath, [], {
    serviceName: 'afda-worker',
    stdio: 'pipe',
    env: {
      ...process.env,
      DOWNLODR_IS_PACKAGED: paths.isPackaged ? '1' : '0',
      DOWNLODR_RESOURCES_PATH: paths.resourcesPath,
      DOWNLODR_APP_PATH: paths.appPath,
    },
  });

  child.stdout?.on('data', (d) => console.log(`[AFDA worker] ${d.toString().trimEnd()}`));
  child.stderr?.on('data', (d) => console.error(`[AFDA worker] ${d.toString().trimEnd()}`));

  child.on('message', (msg: AfdaWorkerOutbound) => handleWorkerMessage(msg, mainWindow));

  child.on('exit', (code) => {
    ready = false;
    for (const [id, call] of pending) {
      clearTimeout(call.timer);
      pending.delete(id);
      call.reject(new Error('AFDA worker crashed before responding.'));
    }
    if (shuttingDown) {
      console.log(`[AFDA worker] exited with code ${code} (intentional shutdown, no respawn)`);
      return;
    }
    console.error(`[AFDA worker] exited with code ${code}`);
    if (respawnCount < MAX_RESPAWNS) {
      respawnCount += 1;
      console.log('[AFDA worker] Respawning after crash...');
      spawnWorker(mainWindow, dbPath, addonPath);
    } else {
      console.error('[AFDA worker] Crashed again — marking AFDA unavailable for this session.');
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('addons:afda-unavailable');
      }
    }
  });

  post({
    type: 'init',
    dbPath,
    addonPath,
    initialWindowState: {
      isDestroyed: mainWindow.isDestroyed(),
      isMinimized: mainWindow.isMinimized(),
      isLoading: mainWindow.webContents.isLoading(),
      isVisible: mainWindow.isVisible(),
    },
  });

  wireWindowStateSync(mainWindow);
}

let windowStateSyncWired = false;
function wireWindowStateSync(mainWindow: BrowserWindow): void {
  if (windowStateSyncWired) return;
  windowStateSyncWired = true;
  const sendState = () => {
    if (mainWindow.isDestroyed()) return;
    post({
      type: 'window-state',
      isDestroyed: mainWindow.isDestroyed(),
      isMinimized: mainWindow.isMinimized(),
      isLoading: mainWindow.webContents.isLoading(),
      isVisible: mainWindow.isVisible(),
    });
  };
  mainWindow.on('minimize', sendState);
  mainWindow.on('restore', sendState);
  mainWindow.on('show', sendState);
  mainWindow.on('hide', sendState);
  mainWindow.webContents.on('did-start-loading', sendState);
  mainWindow.webContents.on('did-finish-load', sendState);
  mainWindow.on('closed', sendState);
}

function handleWorkerMessage(msg: AfdaWorkerOutbound, mainWindow: BrowserWindow): void {
  if (msg.type === 'ready') {
    ready = true;
    for (const channel of msg.channels) {
      if (!registeredChannels.has(channel)) {
        registeredChannels.add(channel);
        const forward = forwardChannel(channel);
        ipcMain.handle(channel, forward);
        registerBridgeHandler(channel, forward as (event: null, ...args: unknown[]) => unknown);
      }
    }
    console.log(`[AFDA worker] ready with ${msg.channels.length} channels`);
    // Feed the existing boot-splash-status mechanism (see index.html /
    // bootStatusHandler.ts) so the splash text reflects real AFDA readiness
    // if it's still on screen when this fires. A no-op once the splash has
    // already hidden — the renderer just ignores boot:status pushes then.
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('boot:status', 'Article services ready');
    }
    return;
  }

  if (msg.type === 'reply') {
    const call = pending.get(msg.callId);
    if (!call) return;
    clearTimeout(call.timer);
    pending.delete(msg.callId);
    if (msg.error) call.reject(new Error(msg.error));
    else call.resolve(msg.result);
    return;
  }

  if (msg.type === 'push') {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(msg.channel, msg.payload);
    }
    return;
  }

  if (msg.type === 'window-call') {
    if (msg.method === 'show') mainWindow.show();
    else if (msg.method === 'focus') mainWindow.focus();
    else if (msg.method === 'restore') mainWindow.restore();
    return;
  }

  if (msg.type === 'init-error') {
    console.error('[AFDA worker] init failed:', msg.error);
    return;
  }
}
