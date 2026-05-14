/* Handler for Skedulosa (scheduled downloads) — delegates IPC registration to the video-nemesis-toolkit */

import { app, BrowserWindow, ipcMain } from 'electron';
import { existsSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { registerVideoNemesisIpcHandlers } from '@/skedulosa/backend/video-nemesis-toolkit/dist/index';

/**
 * Resolves the path to the bundled yt-dlp binary.
 * - Packaged app: looks in process.resourcesPath
 * - Development: looks in the app root directory (where yt-dlp.exe is at the repo root)
 */
function resolveYtDlpPath(): string {
  const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

  // Packaged app — binaries are in process.resourcesPath
  if (app.isPackaged && process.resourcesPath) {
    const bundled = path.join(process.resourcesPath, binaryName);
    if (existsSync(bundled)) return bundled;
  }

  // Development — yt-dlp.exe sits at the repo root alongside package.json
  const devPath = path.join(app.getAppPath(), binaryName);
  if (existsSync(devPath)) return devPath;

  // Fall back to system PATH
  return binaryName;
}

/**
 * Registers all Skedulosa IPC handlers via the video-nemesis-toolkit.
 * @param mainWindow - The main window of the app (used to push events to the renderer)
 * @returns cleanup function — stops the scraper, download worker, and closes the DB.
 *          Call this in the app's before-quit handler.
 */
export const skedulosaHandler = (mainWindow: BrowserWindow): (() => void) => {
  const ytDlpPath = resolveYtDlpPath();
  const dbPath = path.join(app.getPath('userData'), 'skedulosa.db');

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

  registerVideoNemesisIpcHandlers(ipcMain, {
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
        console.error('[skedulosa] sendToRenderer failed (renderer may be closing):', err);
      }
    },
  });

  // These two channels are not implemented by the toolkit — we handle them here
  // using a short-lived DB connection so the nemesis package stays untouched.

  ipcMain.handle('toolkit:downloadTasks:delete', (_event, id: number) => {
    const db = new Database(dbPath);
    try {
      db.prepare('DELETE FROM download_task WHERE id = ?').run(id);
      return { deleted: true };
    } finally {
      db.close();
    }
  });

  ipcMain.handle('toolkit:downloadTasks:clearPending', () => {
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
  });

  return () => {
    console.log = _origLog;
  };
};
