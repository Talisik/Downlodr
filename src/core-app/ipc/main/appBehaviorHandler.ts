/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import https from 'https';
import { setLastClipboardText } from './clipboardHandler';
import {
  getRunInBackgroundSetting,
  resetTrayIcon,
  setRunInBackgroundSetting,
} from './trayHandler';
/**
 * Handles the behavior of the base app such as closing, minimizing, maximizing, etc.
 * @param mainWindow - The main window of the base app
 * @returns void
 */

async function isOnline(timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const timeoutHandle = setTimeout(() => {
      resolve(false);
    }, timeout);

    // Try to make an actual HTTPS request to a reliable endpoint
    // This is more reliable than just DNS resolution
    const req = https.request(
      {
        hostname: 'www.google.com',
        port: 443,
        path: '/favicon.ico',
        method: 'HEAD', // HEAD request is lighter than GET
        timeout: timeout,
      },
      (res) => {
        clearTimeout(timeoutHandle);
        resolve(true);
      },
    );

    req.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timeoutHandle);
      const errorMessage =
        err && typeof err === 'object' && 'code' in err
          ? (err as { code?: string; message?: string }).code || err.message
          : err.message || String(err);
      resolve(false);
    });

    req.on('timeout', () => {
      clearTimeout(timeoutHandle);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

export const appBehaviorHandler = (mainWindow: BrowserWindow) => {
  /* App Control buttons*/
  ipcMain.on('close-btn', () => {
    if (!mainWindow) return;

    if (getRunInBackgroundSetting()) {
      // If running in background is enabled, hide the window
      mainWindow.hide();
    } else {
      // If running in background is disabled, actually quit the app
      app.quit();
    }
  });

  ipcMain.on('minimize-btn', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('maximize-btn', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  // support functions
  ipcMain.handle('check-internet-connection', async () => {
    return await isOnline();
  });

  ipcMain.on('show-input-context-menu', (event) => {
    const menu = Menu.buildFromTemplate([
      { label: 'Cut', role: 'cut' },
      { label: 'Copy', role: 'copy' },
      { label: 'Paste', role: 'paste' },
      { type: 'separator' },
      { label: 'Select All', role: 'selectAll' },
    ]);

    const win = BrowserWindow.fromWebContents(event.sender);
    menu.popup({ window: win });
  });

  ipcMain.handle('show-window', () => {
    if (mainWindow) {
      mainWindow.show();
      resetTrayIcon(); // Reset icon when window is explicitly shown
      return true;
    }
    return false;
  });

  // function for hiding window not close it
  ipcMain.handle('hide-window', () => {
    if (mainWindow) {
      mainWindow.hide();
      return true;
    }
    return false;
  });

  // function for forcibly closing the app
  ipcMain.handle('exit-app', () => {
    // Set to BLANK_STATE before quitting so clipboard handler state is consistent
    setLastClipboardText('BLANK_STATE');
    app.quit();
  });

  // function for syncing settings on startup
  ipcMain.handle('sync-background-setting-on-startup', (_event, value) => {
    setRunInBackgroundSetting(value);
    return true;
  });

  ipcMain.handle('get-run-in-background', () => {
    return getRunInBackgroundSetting();
  });

  ipcMain.handle('set-run-in-background', (_event, value: boolean) => {
    setRunInBackgroundSetting(value);
    return true;
  });
};
