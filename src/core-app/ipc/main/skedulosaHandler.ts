/* Handler for Skedulosa (scheduled downloads) — delegates IPC registration to the video-nemesis-toolkit */

import { app, BrowserWindow, ipcMain } from 'electron';
import { existsSync } from 'fs';
import path from 'path';
import type BetterSqlite3 from 'better-sqlite3';
import { pathToFileURL } from 'url';
import {
 registerSkedulosaServices,
 registerBridgeHandler,
 registerRendererSender,
 registerRendererQuery,
} from './mcpBridgeServer';

/**
 * better-sqlite3 is a native module. Load it lazily and guarded so the main
 * process never crashes at startup on platforms/builds where the native
 * binding fails to load (e.g. macOS core builds) — the DB-backed handlers
 * below simply degrade to a no-op instead.
 */
let DatabaseCtor: typeof BetterSqlite3 | null = null;
let dbLoadAttempted = false;
function getDatabase(): typeof BetterSqlite3 | null {
 if (!dbLoadAttempted) {
  dbLoadAttempted = true;
  try {
   // eslint-disable-next-line @typescript-eslint/no-var-requires
   DatabaseCtor = require('better-sqlite3');
  } catch (err) {
   console.warn(
    '[skedulosa] better-sqlite3 unavailable — DB features disabled:',
    (err as Error)?.message,
   );
   DatabaseCtor = null;
  }
 }
 return DatabaseCtor;
}

/**
 * Resolves the path to the bundled yt-dlp binary.
 * - Packaged app: looks in process.resourcesPath
 * - Development: looks in the app root directory (where yt-dlp.exe is at the repo root)
 */
function resolveYtDlpPath(): string {
 const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

 if (app.isPackaged) {
  // postPackage copies yt-dlp next to the executable, not into resources
  const nextToExe = path.join(path.dirname(process.execPath), binaryName);
  if (existsSync(nextToExe)) return nextToExe;

  // Fallback: resources directory (in case it moves there in future builds)
  if (process.resourcesPath) {
   const inResources = path.join(process.resourcesPath, binaryName);
   if (existsSync(inResources)) return inResources;
  }
 } else {
  // Development — yt-dlp.exe sits at the repo root alongside package.json
  const devPath = path.join(app.getAppPath(), binaryName);
  if (existsSync(devPath)) return devPath;
 }

 // Fall back to system PATH
 return binaryName;
}

/**
 * Registers all Skedulosa IPC handlers via the video-nemesis-toolkit.
 * @param mainWindow - The main window of the app (used to push events to the renderer)
 * @param addonPath - Optional path to the downloaded pack's root directory.
 *                    When set, loads registerVideoNemesisIpcHandlers from pack dist/index.
 *                    When undefined, falls through to Vite-bundled imports (dev/full build).
 * @returns cleanup function — stops the scraper, download worker, and closes the DB.
 *          Call this in the app's before-quit handler.
 */
export const skedulosaHandler = async (
 mainWindow: BrowserWindow,
 addonPath?: string,
): Promise<() => void> => {
 let registerVideoNemesisIpcHandlers: any;

 if (addonPath) {
  const indexUrl = pathToFileURL(path.join(addonPath, 'dist', 'index.js')).href;
  const mod = await import(/* @vite-ignore */ indexUrl);
  registerVideoNemesisIpcHandlers = mod.registerVideoNemesisIpcHandlers;
 } else if (process.env.NODE_ENV !== 'production') {
  // Dev only: Vite-bundled imports from source.
  // Guarded by NODE_ENV so Rollup eliminates this branch (and the toolkit require())
  // from the production bundle entirely.
  const mod = await import('@/skedulosa/backend/video-nemesis-toolkit__hidden/dist/index');
  registerVideoNemesisIpcHandlers = mod.registerVideoNemesisIpcHandlers;
 }

 const ytDlpPath = resolveYtDlpPath();
 const dbPath = path.join(app.getPath('userData'), 'skedulosa.db');

 registerSkedulosaServices({ dbPath });
 registerRendererSender((channel, payload) => {
  try {
   if (!mainWindow.isDestroyed())
    mainWindow.webContents.send(channel, payload);
  } catch {
   /* renderer closing */
  }
 });

 // Request/response round-trip to the main window's renderer, which owns the
 // core download Zustand store. Used by the bridge's /downloads/* routes to
 // read and mutate the download list (state the main process can't see directly).
 let _rendererReqSeq = 0;
 registerRendererQuery((kind, payload, timeoutMs) => {
  return new Promise((resolve, reject) => {
   if (mainWindow.isDestroyed()) {
    reject(new Error('Main window is not available.'));
    return;
   }
   const requestId = `dlq_${Date.now()}_${_rendererReqSeq++}`;
   const replyChannel = `downloads:reply:${requestId}`;
   const timer = setTimeout(() => {
    ipcMain.removeAllListeners(replyChannel);
    reject(
     new Error(
      'The app did not respond in time (download list unavailable).',
     ),
    );
   }, timeoutMs);
   ipcMain.once(
    replyChannel,
    (_event, reply: { ok: boolean; result?: unknown; error?: string }) => {
     clearTimeout(timer);
     if (reply && reply.ok) resolve(reply.result);
     else reject(new Error(reply?.error || 'Download request failed.'));
    },
   );
   // kind === 'query' → downloads:query, kind === 'command' → downloads:command
   mainWindow.webContents.send(`downloads:${kind}`, {
    requestId,
    replyChannel,
    payload,
   });
  });
 });
 const _origLog = console.log;
 console.log = (...args: unknown[]) => {
  _origLog.apply(console, args);
  const msg = args[0];
  if (typeof msg === 'string' && msg.startsWith('[scraper]')) {
   try {
    if (!mainWindow.isDestroyed()) {
     mainWindow.webContents.send('toolkit:scraper:channelLog', msg);
    }
   } catch {
    // renderer may be closing
   }
  }
 };

 registerVideoNemesisIpcHandlers(
  ipcMain,
  {
   dbPath,
   ytDlpPath,
   sendToRenderer: (channel, payload) => {
    try {
     if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
     }
    } catch (err) {
     // Renderer IPC channel may be null when the renderer crashes or is
     // being torn down while a scrape is in flight. Log and swallow so
     // the main process does not crash with an uncaught exception.
     console.error(
      '[skedulosa] sendToRenderer failed (renderer may be closing):',
      err,
     );
    }
   },
  },
  (channel, handler) => {
   ipcMain.handle(channel, handler);
   registerBridgeHandler(
    channel,
    handler as (event: null, ...args: unknown[]) => unknown,
   );
  },
 );

 // These two channels are not implemented by the toolkit — we handle them here
 // using a short-lived DB connection so the nemesis package stays untouched.

 const deleteTaskHandler = (_event: unknown, id: number) => {
  const Ctor = getDatabase();
  if (!Ctor) return { deleted: false, error: 'Database unavailable' };
  const db = new Ctor(dbPath);
  try {
   db.prepare('DELETE FROM download_task WHERE id = ?').run(id);
   return { deleted: true };
  } finally {
   db.close();
  }
 };
 ipcMain.handle('toolkit:downloadTasks:delete', deleteTaskHandler);
 registerBridgeHandler(
  'toolkit:downloadTasks:delete',
  deleteTaskHandler as (event: null, ...args: unknown[]) => unknown,
 );

 const clearPendingHandler = () => {
  const Ctor = getDatabase();
  if (!Ctor) return { cleared: false, count: 0, error: 'Database unavailable' };
  const db = new Ctor(dbPath);
  try {
   const now = new Date().toISOString();
   const result = db
    .prepare(
     "UPDATE download_task SET status = 'downloaded', updated_at = ? WHERE status = 'pending'",
    )
    .run(now);
   return { cleared: result.changes > 0, count: result.changes };
  } finally {
   db.close();
  }
 };
 ipcMain.handle('toolkit:downloadTasks:clearPending', clearPendingHandler);
 registerBridgeHandler(
  'toolkit:downloadTasks:clearPending',
  clearPendingHandler,
 );

 return () => {
  console.log = _origLog;
 };
};
