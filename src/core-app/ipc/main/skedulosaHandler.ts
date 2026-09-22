import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import Database from 'better-sqlite3';
import { pathToFileURL } from 'url';
import { getYtdlpBinaryPath } from './bundledBinariesEnv';
import {
  registerSkedulosaServices,
  registerBridgeHandler,
  registerRendererSender,
} from './mcpBridgeServer';

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
    const mod = await import(
      '@/skedulosa/backend/video-nemesis-toolkit__hidden/dist/index'
    );
    registerVideoNemesisIpcHandlers = mod.registerVideoNemesisIpcHandlers;
  }

  const ytDlpPath = getYtdlpBinaryPath();
  const dbPath = path.join(app.getPath('userData'), 'skedulosa.db');

  registerSkedulosaServices({ dbPath });
  registerRendererSender((channel, payload) => {
    try {
      if (!mainWindow.isDestroyed())
        mainWindow.webContents.send(channel, payload);
    } catch {
    }
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
