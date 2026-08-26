/* Handler for Skedulosa (scheduled downloads) — delegates IPC registration to the video-nemesis-toolkit */

import { app, BrowserWindow, ipcMain } from 'electron';
import { existsSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { pathToFileURL } from 'url';
import {
  registerSkedulosaServices,
  registerBridgeHandler,
  registerRendererSender,
} from './mcpBridgeServer';

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
    const indexUrl = pathToFileURL(
      path.join(addonPath, 'dist', 'index.js'),
    ).href;
    const mod = await import(/* @vite-ignore */ indexUrl);
    registerVideoNemesisIpcHandlers = mod.registerVideoNemesisIpcHandlers;
  } else if (process.env.NODE_ENV !== 'production') {
    // Dev only: Vite-bundled imports from source.
    // Guarded by NODE_ENV so Rollup eliminates this branch (and the toolkit require())
    // from the production bundle entirely.
    const mod = await import(
      '@/skedulosa/backend/video-nemesis-toolkit__hidden/dist/index'
    );
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

  // NOTE: the core download list's request/response round-trip
  // (registerRendererQuery) is registered unconditionally in
  // coreDownloadBridgeHandler.ts / registerHandlers.ts, not here — it has no
  // dependency on this add-on and must work even when this handler never runs.

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
      sendToRenderer: (channel: string, payload: unknown) => {
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
    (
      channel: string,
      handler: (
        event: Electron.IpcMainInvokeEvent,
        ...args: unknown[]
      ) => unknown,
    ) => {
      ipcMain.handle(channel, handler);
      registerBridgeHandler(
        channel,
        handler as unknown as (event: null, ...args: unknown[]) => unknown,
      );
    },
  );

  // These two channels are not implemented by the toolkit — we handle them here
  // using a short-lived DB connection so the nemesis package stays untouched.

  const deleteTaskHandler = (_event: unknown, id: number) => {
    const db = new Database(dbPath);
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
    const db = new Database(dbPath);
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
