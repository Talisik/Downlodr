/**
 * Auto-Updater Module for Downlodr
 *
 * This module handles automatic download and installation of app updates
 * using electron-updater with GitHub Releases as the update source.
 *
 * Features:
 * - Automatic update checking on app startup
 * - Background download of updates
 * - User notification for available updates
 * - Download progress tracking
 * - Automatic installation on quit or manual restart
 * - Version channel support (exp-macos, stable, etc.)
 */

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { autoUpdater, UpdateInfo as ElectronUpdateInfo } from 'electron-updater';
import log from 'electron-log';

// Configure electron-log for auto-updater
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Configure autoUpdater logging
autoUpdater.logger = log;

// Update status types
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateInfo {
  status: UpdateStatus;
  version?: string;
  currentVersion?: string;
  releaseNotes?: string;
  releaseDate?: string;
  downloadUrl?: string;
  error?: string;
  progress?: {
    percent: number;
    transferred: number;
    total: number;
    bytesPerSecond: number;
  };
}

// Store the main window reference for IPC communication
let mainWindowRef: BrowserWindow | null = null;

// Track update state
let currentUpdateStatus: UpdateStatus = 'idle';
let lastUpdateInfo: UpdateInfo | null = null;
let updateDownloaded = false;

/**
 * Helper function to extract version channel (exp-macos, exp-auto, stable, etc.)
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
 * Send update status to renderer process
 */
function sendUpdateStatus(info: UpdateInfo): void {
  lastUpdateInfo = info;
  currentUpdateStatus = info.status;

  if (mainWindowRef && mainWindowRef.webContents && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('app-update-status', info);
  }
}

/**
 * Send download progress to renderer process
 */
function sendDownloadProgress(progress: UpdateInfo['progress']): void {
  if (mainWindowRef && mainWindowRef.webContents && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('app-update-download-progress', progress);
  }
}

/**
 * Initialize the auto-updater system with electron-updater
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

  log.info('[AutoUpdater] Initializing auto-updater with electron-updater');
  log.info(`[AutoUpdater] Current version: ${app.getVersion()}`);
  log.info(`[AutoUpdater] Version channel: ${getCurrentChannel() || 'stable'}`);

  // Configure auto-updater
  autoUpdater.autoDownload = true; // Automatically download updates
  autoUpdater.autoInstallOnAppQuit = true; // Install on app quit
  autoUpdater.autoRunAppAfterInstall = true; // Restart app after install
  autoUpdater.allowDowngrade = false; // Don't allow downgrading

  // Set update channel based on current version
  const channel = getCurrentChannel();
  if (channel) {
    // For experimental versions, only get updates from the same channel
    autoUpdater.channel = channel;
    log.info(`[AutoUpdater] Set update channel to: ${channel}`);
  }

  // Event: Checking for updates
  autoUpdater.on('checking-for-update', () => {
    log.info('[AutoUpdater] Checking for updates...');
    sendUpdateStatus({
      status: 'checking',
      currentVersion: app.getVersion(),
    });
  });

  // Event: Update available
  autoUpdater.on('update-available', (info: ElectronUpdateInfo) => {
    log.info('[AutoUpdater] Update available:', info.version);

    sendUpdateStatus({
      status: 'available',
      version: info.version,
      currentVersion: app.getVersion(),
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map(n => typeof n === 'string' ? n : n.note).join('\n')
          : undefined,
    });

    // Show notification dialog (non-blocking since autoDownload is true)
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      dialog.showMessageBox(mainWindowRef, {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available!`,
        detail: 'The update is being downloaded in the background. You will be notified when it\'s ready to install.',
        buttons: ['OK'],
        defaultId: 0,
      });
    }
  });

  // Event: Update not available
  autoUpdater.on('update-not-available', (info: ElectronUpdateInfo) => {
    log.info('[AutoUpdater] No update available. Current version is up-to-date:', info.version);
    sendUpdateStatus({
      status: 'not-available',
      version: info.version,
      currentVersion: app.getVersion(),
    });
  });

  // Event: Download progress
  autoUpdater.on('download-progress', (progressObj) => {
    const message = `Download speed: ${Math.round(progressObj.bytesPerSecond / 1024)} KB/s - ${Math.round(progressObj.percent)}% (${Math.round(progressObj.transferred / 1024 / 1024)}MB / ${Math.round(progressObj.total / 1024 / 1024)}MB)`;
    log.info('[AutoUpdater]', message);

    const progress = {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond,
    };

    sendUpdateStatus({
      status: 'downloading',
      currentVersion: app.getVersion(),
      progress,
    });

    sendDownloadProgress(progress);
  });

  // Event: Update downloaded
  autoUpdater.on('update-downloaded', (info: ElectronUpdateInfo) => {
    log.info('[AutoUpdater] Update downloaded:', info.version);
    updateDownloaded = true;

    sendUpdateStatus({
      status: 'downloaded',
      version: info.version,
      currentVersion: app.getVersion(),
      releaseNotes: typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map(n => typeof n === 'string' ? n : n.note).join('\n')
          : undefined,
    });

    // Show dialog to restart app
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      dialog
        .showMessageBox(mainWindowRef, {
          type: 'info',
          title: 'Update Ready',
          message: `Version ${info.version} has been downloaded!`,
          detail: 'The update will be installed when you restart the application. Would you like to restart now?',
          buttons: ['Restart Now', 'Later'],
          defaultId: 0,
          cancelId: 1,
        })
        .then((result) => {
          if (result.response === 0) {
            log.info('[AutoUpdater] User chose to restart now');
            autoUpdater.quitAndInstall(false, true);
          } else {
            log.info('[AutoUpdater] User chose to install later');
          }
        });
    }
  });

  // Event: Error
  autoUpdater.on('error', (error: Error) => {
    log.error('[AutoUpdater] Error:', error.message);

    sendUpdateStatus({
      status: 'error',
      currentVersion: app.getVersion(),
      error: getUserFriendlyErrorMessage(error.message),
    });
  });

  // Initial update check after 10 seconds (give app time to fully load)
  setTimeout(() => {
    log.info('[AutoUpdater] Performing initial update check...');
    autoUpdater.checkForUpdates().catch((error: Error) => {
      log.error('[AutoUpdater] Initial update check failed:', error.message);
    });
  }, 10000);

  // Periodic update check every 4 hours
  const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours in ms
  setInterval(() => {
    log.info('[AutoUpdater] Performing periodic update check...');
    autoUpdater.checkForUpdates().catch((error: Error) => {
      log.error('[AutoUpdater] Periodic update check failed:', error.message);
    });
  }, UPDATE_CHECK_INTERVAL);

  log.info('[AutoUpdater] Auto-updater initialized successfully');
}

/**
 * Get the current update status
 */
export function getUpdateStatus(): UpdateInfo {
  return lastUpdateInfo || {
    status: currentUpdateStatus,
    currentVersion: app.getVersion(),
  };
}

/**
 * Check if an update has been downloaded and is ready to install
 */
export function isUpdateDownloaded(): boolean {
  return updateDownloaded;
}

/**
 * Manually trigger an update check
 */
export async function checkForUpdatesManually(): Promise<UpdateInfo> {
  if (!app.isPackaged) {
    return {
      status: 'error',
      currentVersion: app.getVersion(),
      error: 'Auto-updates are disabled in development mode',
    };
  }

  try {
    log.info('[AutoUpdater] Manual update check triggered');
    const result = await autoUpdater.checkForUpdates();

    if (result?.updateInfo) {
      return {
        status: result.updateInfo.version !== app.getVersion() ? 'available' : 'not-available',
        version: result.updateInfo.version,
        currentVersion: app.getVersion(),
        releaseDate: result.updateInfo.releaseDate,
      };
    }

    return getUpdateStatus();
  } catch (error) {
    log.error('[AutoUpdater] Manual update check failed:', error);
    return {
      status: 'error',
      currentVersion: app.getVersion(),
      error: error instanceof Error ? getUserFriendlyErrorMessage(error.message) : 'Update check failed',
    };
  }
}

/**
 * Manually trigger download (if autoDownload is false)
 */
export async function downloadUpdate(): Promise<{ success: boolean; error?: string }> {
  if (!app.isPackaged) {
    return { success: false, error: 'Auto-updates are disabled in development mode' };
  }

  try {
    log.info('[AutoUpdater] Manual download triggered');
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    log.error('[AutoUpdater] Download failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Download failed',
    };
  }
}

/**
 * Install downloaded update and restart
 */
export function installUpdate(): { success: boolean; error?: string } {
  if (!app.isPackaged) {
    return { success: false, error: 'Auto-updates are disabled in development mode' };
  }

  if (!updateDownloaded) {
    return { success: false, error: 'No update has been downloaded yet' };
  }

  try {
    log.info('[AutoUpdater] Installing update and restarting...');
    // isSilent = false (show installer), isForceRunAfter = true (restart app after install)
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  } catch (error) {
    log.error('[AutoUpdater] Install failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Install failed',
    };
  }
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
    return checkForUpdatesManually();
  });

  // Manually trigger download
  ipcMain.handle('app-update:download', async () => {
    return downloadUpdate();
  });

  // Install downloaded update and restart
  ipcMain.handle('app-update:install', () => {
    return installUpdate();
  });

  // Check if update is downloaded
  ipcMain.handle('app-update:is-downloaded', () => {
    return isUpdateDownloaded();
  });

  log.info('[AutoUpdater] IPC handlers registered');
}

/**
 * Update the main window reference (call this if window is recreated)
 */
export function setMainWindow(window: BrowserWindow | null): void {
  mainWindowRef = window;
}

/**
 * Check if auto-updates are supported on the current platform
 */
export function isAutoUpdateSupported(): boolean {
  // Auto-updates are supported on macOS (darwin) and Windows (win32)
  // Linux requires different handling (AppImage with electron-updater)
  return process.platform === 'darwin' || process.platform === 'win32';
}

/**
 * Get user-friendly error message for update errors
 */
export function getUserFriendlyErrorMessage(error: string): string {
  const errorMessages: Record<string, string> = {
    ENOTFOUND: 'Unable to connect to update server. Please check your internet connection.',
    ETIMEDOUT: 'Update check timed out. Please try again later.',
    ECONNREFUSED: 'Update server is not responding. Please try again later.',
    ERR_UPDATER_INVALID_RELEASE_FEED: 'No compatible update found for your version.',
    ERR_UPDATER_CHANNEL_FILE_NOT_FOUND: 'Update channel not found. Please try again later.',
    ERR_UPDATER_LATEST_VERSION_NOT_FOUND: 'No updates available for your platform.',
    'net::ERR_INTERNET_DISCONNECTED': 'No internet connection. Please check your network.',
    'net::ERR_CONNECTION_REFUSED': 'Update server is not responding. Please try again later.',
    'net::ERR_NAME_NOT_RESOLVED': 'Unable to reach update server. Please check your internet connection.',
    'Cannot parse releases feed': 'Unable to check for updates. No releases found.',
    'No published versions': 'No updates available yet.',
  };

  for (const [key, message] of Object.entries(errorMessages)) {
    if (error.includes(key)) {
      return message;
    }
  }

  // For GitHub rate limit errors
  if (error.includes('403') || error.includes('rate limit')) {
    return 'GitHub API rate limit exceeded. Please try again in a few minutes.';
  }

  return 'An error occurred while checking for updates. Please try again later.';
}

export default {
  setupAutoUpdater,
  setupAutoUpdaterIPC,
  getUpdateStatus,
  checkForUpdatesManually,
  downloadUpdate,
  installUpdate,
  isUpdateDownloaded,
  setMainWindow,
  getCurrentChannel,
  isAutoUpdateSupported,
  getUserFriendlyErrorMessage,
};
