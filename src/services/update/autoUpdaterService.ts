/**
 * Auto-updater service using electron-updater
 * Handles background downloads and update lifecycle for VS Code/Cursor-style updates
 */

import { BrowserWindow, app } from 'electron';
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import log from 'electron-log';

// Configure logging for auto-updater
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Configuration
autoUpdater.autoDownload = false; // Manual control over download timing
autoUpdater.autoInstallOnAppQuit = true; // Install on quit if downloaded
autoUpdater.allowDowngrade = false;

// Rate limiting - align with existing update service
const AUTO_UPDATE_COOLDOWN = 5 * 60 * 1000; // 5 minutes between checks
let lastAutoUpdateCheck = 0;

// Update state tracking
export interface UpdateState {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  progress: ProgressInfo | null;
  updateInfo: UpdateInfo | null;
  error: string | null;
}

let updateState: UpdateState = {
  checking: false,
  available: false,
  downloading: false,
  downloaded: false,
  progress: null,
  updateInfo: null,
  error: null,
};

/**
 * Check if enough time has passed since the last update check
 */
export function canCheckForAutoUpdate(): boolean {
  return Date.now() - lastAutoUpdateCheck >= AUTO_UPDATE_COOLDOWN;
}

/**
 * Get remaining cooldown time in seconds
 */
export function getRemainingCooldown(): number {
  const elapsed = Date.now() - lastAutoUpdateCheck;
  const remaining = AUTO_UPDATE_COOLDOWN - elapsed;
  return Math.max(0, Math.ceil(remaining / 1000));
}

/**
 * Notify all renderer windows of an event
 */
function notifyRenderer(channel: string, data?: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  });
}

/**
 * Reset update state to initial values
 */
function resetUpdateState(): void {
  updateState = {
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    progress: null,
    updateInfo: null,
    error: null,
  };
}

/**
 * Initialize the auto-updater and set up event listeners
 * Should be called once during app startup (production only)
 */
export function initAutoUpdater(): void {
  // Configure for GitHub releases
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Talisik',
    repo: 'Downlodr',
  });

  // Event: Checking for update
  autoUpdater.on('checking-for-update', () => {
    log.info('Auto-updater: Checking for updates...');
    updateState = {
      ...updateState,
      checking: true,
      error: null,
    };
    notifyRenderer('auto-update-checking');
  });

  // Event: Update available - start background download automatically
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log.info(`Auto-updater: Update available - ${info.version}`);
    updateState = {
      ...updateState,
      checking: false,
      available: true,
      updateInfo: info,
    };
    notifyRenderer('auto-update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate,
    });

    // Automatically start background download
    log.info('Auto-updater: Starting background download...');
    autoUpdater.downloadUpdate();
  });

  // Event: Update not available
  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    log.info(`Auto-updater: No update available. Current: ${app.getVersion()}`);
    updateState = {
      ...updateState,
      checking: false,
      available: false,
      updateInfo: info,
    };
    notifyRenderer('auto-update-not-available', {
      version: info.version,
    });
  });

  // Event: Download progress
  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    log.info(
      `Auto-updater: Download progress - ${Math.round(progress.percent)}%`,
    );
    updateState = {
      ...updateState,
      downloading: true,
      progress: progress,
    };
    notifyRenderer('auto-update-download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  // Event: Update downloaded - READY TO INSTALL
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    log.info(`Auto-updater: Update downloaded - ${info.version}`);
    updateState = {
      ...updateState,
      downloading: false,
      downloaded: true,
      progress: null,
      updateInfo: info,
    };
    notifyRenderer('auto-update-downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate,
    });
  });

  // Event: Error during update process
  autoUpdater.on('error', (error: Error) => {
    log.error('Auto-updater error:', error);
    updateState = {
      ...updateState,
      checking: false,
      downloading: false,
      error: error.message,
    };
    notifyRenderer('auto-update-error', {
      message: error.message,
    });
  });

  log.info('Auto-updater: Initialized');
}

/**
 * Check for updates
 * Respects rate limiting to prevent API spam
 */
export async function checkForAutoUpdate(): Promise<UpdateState> {
  // Check rate limiting
  if (!canCheckForAutoUpdate()) {
    const remaining = getRemainingCooldown();
    log.info(`Auto-updater: Skipping check - rate limited (${remaining}s remaining)`);
    return {
      ...updateState,
      error: `Please wait ${remaining} seconds before checking again.`,
    };
  }

  // Update last check timestamp
  lastAutoUpdateCheck = Date.now();

  try {
    await autoUpdater.checkForUpdates();
    return getUpdateState();
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    log.error('Auto-updater: Check failed -', errorMessage);
    updateState = {
      ...updateState,
      checking: false,
      error: errorMessage,
    };
    return updateState;
  }
}

/**
 * Manually trigger download of available update
 * Usually not needed as download starts automatically on update-available
 */
export async function downloadUpdate(): Promise<void> {
  if (!updateState.available) {
    log.warn('Auto-updater: No update available to download');
    return;
  }

  try {
    await autoUpdater.downloadUpdate();
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Download failed';
    log.error('Auto-updater: Download failed -', errorMessage);
    updateState = {
      ...updateState,
      downloading: false,
      error: errorMessage,
    };
    notifyRenderer('auto-update-error', { message: errorMessage });
  }
}

/**
 * Quit the application and install the downloaded update
 * This will close the app, run the installer, and restart
 */
export function quitAndInstall(): void {
  if (!updateState.downloaded) {
    log.warn('Auto-updater: No update downloaded to install');
    return;
  }

  log.info('Auto-updater: Quitting and installing update...');

  // isSilent = false: Show installer UI
  // isForceRunAfter = true: Restart app after install
  autoUpdater.quitAndInstall(false, true);
}

/**
 * Get the current update state
 */
export function getUpdateState(): UpdateState {
  return { ...updateState };
}

/**
 * Reset state and clear any cached data
 * Useful for testing or manual retry scenarios
 */
export function resetAutoUpdater(): void {
  resetUpdateState();
  lastAutoUpdateCheck = 0;
  log.info('Auto-updater: State reset');
}

/**
 * Check if an update has been downloaded and is ready to install
 */
export function isUpdateReadyToInstall(): boolean {
  return updateState.downloaded;
}

/**
 * Get the version of the downloaded update (if any)
 */
export function getDownloadedVersion(): string | null {
  return updateState.updateInfo?.version || null;
}
