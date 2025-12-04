/**
 * Auto-Updater Module for Downlodr
 *
 * This module handles automatic download and installation of app updates.
 * It integrates with update.electronjs.org for seamless updates via GitHub Releases.
 *
 * Features:
 * - Automatic update checking on app startup
 * - Background download of updates
 * - User notification for available updates
 * - Version channel support (exp-macos, stable, etc.)
 * - Respects user preferences for auto-updates
 */

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import log from 'electron-log';

// Configure electron-log for auto-updater
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Type definitions for update-electron-app
interface UpdateElectronAppOptions {
  updateInterval?: string;
  logger?: typeof log;
  notifyUser?: boolean;
  repo?: string;
}

// Update status types
export type UpdateStatus =
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateInfo {
  status: UpdateStatus;
  version?: string;
  releaseNotes?: string;
  releaseDate?: string;
  downloadUrl?: string;
  error?: string;
}

// Store the main window reference for IPC communication
let mainWindowRef: BrowserWindow | null = null;

// Track update state
let currentUpdateStatus: UpdateStatus = 'not-available';
let lastUpdateInfo: UpdateInfo | null = null;

/**
 * Helper function to extract version channel (exp-macos, stable, etc.)
 */
function getVersionChannel(version: string): string | null {
  const cleanVersion = version.replace(/^v/, '');
  const match = cleanVersion.match(/-(.+)$/);
  return match ? match[1] : null;
}

/**
 * Get the current app version channel
 */
export function getCurrentChannel(): string | null {
  return getVersionChannel(app.getVersion());
}

/**
 * Initialize the auto-updater system
 *
 * @param mainWindow - The main BrowserWindow instance for IPC communication
 */
export function setupAutoUpdater(mainWindow: BrowserWindow | null): void {
  // Skip in development mode
  if (!app.isPackaged) {
    log.info('[AutoUpdater] Development mode - auto-updater disabled');
    return;
  }

  // Store window reference for IPC
  mainWindowRef = mainWindow;

  log.info('[AutoUpdater] Initializing auto-updater');
  log.info(`[AutoUpdater] Current version: ${app.getVersion()}`);
  log.info(`[AutoUpdater] Version channel: ${getCurrentChannel() || 'stable'}`);

  try {
    // Dynamic import to handle the ESM module
    const { updateElectronApp, UpdateSourceType } = require('update-electron-app');

    // Initialize the updater with configuration
    updateElectronApp({
      // Check for updates every 4 hours
      updateInterval: '4 hours',

      // Use electron-log for logging
      logger: log,

      // Show native notification to user when update is available
      notifyUser: true,

      // Use GitHub as update source (reads from package.json repository field)
      updateSource: {
        type: UpdateSourceType.ElectronPublicUpdateService,
        repo: 'Talisik/Downlodr',
      },
    });

    log.info('[AutoUpdater] Auto-updater initialized successfully');

    // Send status to renderer
    sendUpdateStatus({
      status: 'not-available',
    });
  } catch (error) {
    log.error('[AutoUpdater] Failed to initialize auto-updater:', error);
    sendUpdateStatus({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Advanced auto-updater setup using electron-updater for more control
 * This provides more granular control over the update process
 *
 * Note: This requires electron-updater package instead of update-electron-app
 * Use this if you need features like:
 * - Download progress tracking
 * - Manual download/install triggers
 * - Custom update dialogs
 *
 * @param mainWindow - The main BrowserWindow instance
 */
export function setupAdvancedAutoUpdater(
  mainWindow: BrowserWindow | null,
): void {
  // Skip in development mode
  if (!app.isPackaged) {
    log.info(
      '[AutoUpdater] Development mode - advanced auto-updater disabled',
    );
    return;
  }

  mainWindowRef = mainWindow;

  log.info('[AutoUpdater] Initializing advanced auto-updater');

  try {
    // Note: This requires electron-updater package
    // yarn add electron-updater
    const { autoUpdater } = require('electron-updater');

    // Configure updater
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false; // Manual download control
    autoUpdater.autoInstallOnAppQuit = true;

    // Set the update feed URL for version channels
    const channel = getCurrentChannel();
    if (channel) {
      autoUpdater.channel = channel;
      log.info(`[AutoUpdater] Set update channel to: ${channel}`);
    }

    // Event: Checking for updates
    autoUpdater.on('checking-for-update', () => {
      log.info('[AutoUpdater] Checking for updates...');
      currentUpdateStatus = 'checking';
      sendUpdateStatus({ status: 'checking' });
    });

    // Event: Update available
    autoUpdater.on(
      'update-available',
      (info: { version: string; releaseDate: string; releaseNotes: string }) => {
        log.info('[AutoUpdater] Update available:', info);
        currentUpdateStatus = 'available';

        const updateInfo: UpdateInfo = {
          status: 'available',
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes:
            typeof info.releaseNotes === 'string'
              ? info.releaseNotes
              : undefined,
        };

        lastUpdateInfo = updateInfo;
        sendUpdateStatus(updateInfo);

        // Show dialog to user
        if (mainWindowRef) {
          dialog
            .showMessageBox(mainWindowRef, {
              type: 'info',
              title: 'Update Available',
              message: `A new version (${info.version}) is available!`,
              detail: 'Would you like to download it now?',
              buttons: ['Download', 'Later'],
              defaultId: 0,
              cancelId: 1,
            })
            .then((result) => {
              if (result.response === 0) {
                autoUpdater.downloadUpdate();
              }
            });
        }
      },
    );

    // Event: Update not available
    autoUpdater.on('update-not-available', (info: { version: string }) => {
      log.info('[AutoUpdater] Update not available:', info);
      currentUpdateStatus = 'not-available';
      sendUpdateStatus({
        status: 'not-available',
        version: info.version,
      });
    });

    // Event: Download progress
    autoUpdater.on(
      'download-progress',
      (progressObj: {
        percent: number;
        transferred: number;
        total: number;
        bytesPerSecond: number;
      }) => {
        const message = `Download speed: ${Math.round(progressObj.bytesPerSecond / 1024)} KB/s - ${Math.round(progressObj.percent)}%`;
        log.info('[AutoUpdater]', message);
        currentUpdateStatus = 'downloading';

        if (mainWindowRef && mainWindowRef.webContents) {
          mainWindowRef.webContents.send('app-update-download-progress', {
            percent: progressObj.percent,
            transferred: progressObj.transferred,
            total: progressObj.total,
            bytesPerSecond: progressObj.bytesPerSecond,
          });
        }
      },
    );

    // Event: Update downloaded
    autoUpdater.on('update-downloaded', (info: { version: string }) => {
      log.info('[AutoUpdater] Update downloaded:', info);
      currentUpdateStatus = 'downloaded';

      sendUpdateStatus({
        status: 'downloaded',
        version: info.version,
      });

      // Show dialog to restart app
      if (mainWindowRef) {
        dialog
          .showMessageBox(mainWindowRef, {
            type: 'info',
            title: 'Update Ready',
            message: 'Update downloaded successfully!',
            detail:
              'The application will restart to apply the update. Make sure to save any work.',
            buttons: ['Restart Now', 'Later'],
            defaultId: 0,
            cancelId: 1,
          })
          .then((result) => {
            if (result.response === 0) {
              autoUpdater.quitAndInstall(false, true);
            }
          });
      }
    });

    // Event: Error
    autoUpdater.on('error', (error: Error) => {
      log.error('[AutoUpdater] Error:', error);
      currentUpdateStatus = 'error';

      sendUpdateStatus({
        status: 'error',
        error: error.message,
      });
    });

    // Initial update check after 10 seconds
    setTimeout(() => {
      log.info('[AutoUpdater] Performing initial update check...');
      autoUpdater.checkForUpdates().catch((error: Error) => {
        log.error('[AutoUpdater] Initial update check failed:', error);
      });
    }, 10000);

    // Periodic update check every 4 hours
    const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours
    setInterval(() => {
      log.info('[AutoUpdater] Performing periodic update check...');
      autoUpdater.checkForUpdates().catch((error: Error) => {
        log.error('[AutoUpdater] Periodic update check failed:', error);
      });
    }, UPDATE_CHECK_INTERVAL);

    log.info('[AutoUpdater] Advanced auto-updater initialized successfully');
  } catch (error) {
    log.error('[AutoUpdater] Failed to initialize advanced auto-updater:', error);
  }
}

/**
 * Send update status to renderer process
 */
function sendUpdateStatus(info: UpdateInfo): void {
  lastUpdateInfo = info;

  if (mainWindowRef && mainWindowRef.webContents) {
    mainWindowRef.webContents.send('app-update-status', info);
  }
}

/**
 * Get the current update status
 */
export function getUpdateStatus(): UpdateInfo {
  return (
    lastUpdateInfo || {
      status: currentUpdateStatus,
    }
  );
}

/**
 * Setup IPC handlers for auto-updater
 * Call this function once during app initialization
 */
export function setupAutoUpdaterIPC(): void {
  // Get current update status
  ipcMain.handle('app-update:get-status', () => {
    return getUpdateStatus();
  });

  // Manually trigger update check
  ipcMain.handle('app-update:check', async () => {
    if (!app.isPackaged) {
      return {
        status: 'error' as UpdateStatus,
        error: 'Auto-updates are disabled in development mode',
      };
    }

    try {
      const { autoUpdater } = require('electron-updater');
      await autoUpdater.checkForUpdates();
      return getUpdateStatus();
    } catch (error) {
      log.error('[AutoUpdater] Manual update check failed:', error);
      return {
        status: 'error' as UpdateStatus,
        error: error instanceof Error ? error.message : 'Update check failed',
      };
    }
  });

  // Manually trigger download
  ipcMain.handle('app-update:download', async () => {
    if (!app.isPackaged) {
      return { success: false, error: 'Auto-updates are disabled in development mode' };
    }

    try {
      const { autoUpdater } = require('electron-updater');
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      log.error('[AutoUpdater] Download failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
      };
    }
  });

  // Install downloaded update and restart
  ipcMain.handle('app-update:install', () => {
    if (!app.isPackaged) {
      return { success: false, error: 'Auto-updates are disabled in development mode' };
    }

    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.quitAndInstall(false, true);
      return { success: true };
    } catch (error) {
      log.error('[AutoUpdater] Install failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Install failed',
      };
    }
  });

  log.info('[AutoUpdater] IPC handlers registered');
}

/**
 * Check if auto-updates are supported on the current platform
 */
export function isAutoUpdateSupported(): boolean {
  // Auto-updates are supported on macOS (darwin) and Windows (win32)
  // Linux requires different handling (AppImage, Snap, etc.)
  return process.platform === 'darwin' || process.platform === 'win32';
}

/**
 * Get user-friendly error message for update errors
 */
export function getUserFriendlyErrorMessage(error: string): string {
  const errorMessages: Record<string, string> = {
    ENOTFOUND:
      'Unable to connect to update server. Please check your internet connection.',
    ETIMEDOUT: 'Update check timed out. Please try again later.',
    ERR_UPDATER_INVALID_RELEASE_FEED: 'Update service temporarily unavailable.',
    'net::ERR_INTERNET_DISCONNECTED':
      'No internet connection. Please check your network.',
    'net::ERR_CONNECTION_REFUSED':
      'Update server is not responding. Please try again later.',
  };

  for (const [key, message] of Object.entries(errorMessages)) {
    if (error.includes(key)) {
      return message;
    }
  }

  return 'An error occurred while checking for updates. Please try again later.';
}

export default {
  setupAutoUpdater,
  setupAdvancedAutoUpdater,
  setupAutoUpdaterIPC,
  getUpdateStatus,
  getCurrentChannel,
  isAutoUpdateSupported,
  getUserFriendlyErrorMessage,
};
