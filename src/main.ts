/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Main process entry point for the Electron application.
 * This file is responsible for creating the main application window,
 * handling IPC (Inter-Process Communication) events, and managing
 * application lifecycle events.
 */
import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import path from 'path';
import { checkForUpdates } from './core-app/hook/updateCheckerHook';
import { setLastClipboardText } from './core-app/ipc/main/clipboardHandler';
import { registerMainIpcHandlers } from './core-app/ipc/main/registerHandlers';
import { getRunInBackgroundSetting } from './core-app/ipc/main/trayHandler';
import { setupExtendr } from './extension/utils/extensionLoader';

// Set app identity early so Windows notifications show "Downlodr" instead of "app.electron"
app.setName('Downlodr');
if (process.platform === 'win32') {
  app.setAppUserModelId('Downlodr');
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Prevent multiple instances of the app
const isSingleInstance = app.requestSingleInstanceLock();

if (!isSingleInstance) {
  console.log('Another instance is already running. Quitting this instance.');
  app.quit();
}

// focus first window instead
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;
let forceQuit = false;
let appCleanup: (() => void) | null = null;

// Function to create the main application window
const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1350,
    height: 680,
    frame: false,
    autoHideMenuBar: true,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      nodeIntegration: true,
      // devTools: false,
    },
  });

  const { cleanup } = registerMainIpcHandlers(mainWindow, {
    tray: {
      onBeforeQuit: () => {
        forceQuit = true;
        setLastClipboardText('BLANK_STATE');
      },
    },
  });
  appCleanup = cleanup;

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // Only open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Handle window close events - hide instead of close
  mainWindow.on('close', async (event) => {
    if (!forceQuit) {
      const shouldRunInBackground = getRunInBackgroundSetting();
      if (shouldRunInBackground) {
        event.preventDefault();
        mainWindow?.hide();
      } else {
        forceQuit = true;
        app.quit();
      }
    }
  });

  // focus tracking for clipboard monitoring
  mainWindow.on('focus', () => {
    // console.log('Window focused - clipboard monitoring paused');
  });

  mainWindow.on('blur', () => {
    // console.log('Window unfocused - clipboard monitoring resumed');
  });

  // Prevent navigation to external URLs
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
  });
};

// TEMPORARY DIAGNOSTIC — catch silent rejections and show them
process.on('unhandledRejection', (reason) => {
  const { dialog } = require('electron');
  dialog.showErrorBox('Unhandled Rejection', String(reason instanceof Error ? reason.stack : reason));
});

// once the app opens
app.on('ready', async () => {
  try {
    await setupExtendr();
  } catch (err) {
    const { dialog } = require('electron');
    dialog.showErrorBox('setupExtendr failed', String(err instanceof Error ? err.stack : err));
  }
  try {
    createWindow();
  } catch (err) {
    const { dialog } = require('electron');
    dialog.showErrorBox('createWindow failed', String(err instanceof Error ? err.stack : err));
  }

  // Check for updates when app starts
  setTimeout(async () => {
    const updateInfo = await checkForUpdates();
    if (updateInfo.hasUpdate) {
      BrowserWindow.getAllWindows().forEach((win) =>
        win.webContents.send('update-available', updateInfo),
      );
    }
  }, 5000); // Check after 5 seconds to not slow startup

  // Set up periodic update checking
  const UPDATE_CHECK_INTERVAL = 1000 * 60 * 60 * 4; // Check every 4 hours
  setInterval(async () => {
    const updateInfo = await checkForUpdates();
    if (updateInfo.hasUpdate) {
      BrowserWindow.getAllWindows().forEach((win) =>
        win.webContents.send('update-available', updateInfo),
      );
    }
  }, UPDATE_CHECK_INTERVAL);
});

// Change this to keep app running in background
app.on('window-all-closed', () => {
  // Do nothing here to keep app running when windows are closed
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow?.show();
  }
});

// before-quit handler — graceful teardown of all background services
app.on('before-quit', async () => {
  forceQuit = true;

  // Stop scraper, download worker, close DB, and any other registered cleanups
  try {
    appCleanup?.();
  } catch (err) {
    console.error('[before-quit] cleanup error:', err);
  }

  // Process any pending failed downloads before quitting
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      await mainWindow.webContents.executeJavaScript(`
        if (typeof useDownloadStore !== 'undefined') {
          const store = useDownloadStore.getState();
          if (store.checkFinishedDownloads) {
            store.checkFinishedDownloads();
          }
        }
      `);
    } catch (error) {
      console.log('Could not process failed downloads on quit:', error);
    }
  }
});
