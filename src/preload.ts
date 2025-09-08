/**
 * Preload script for the Electron application.
 * This script runs in the context of the renderer process and exposes
 * certain functions and properties to the renderer via the context bridge.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { contextBridge, ipcRenderer } from 'electron';
import { MenuItemRegistration, TaskBarItemRegistration } from './plugins/types';

// CRITICAL: Intercept fs operations in renderer process for CC plugin
// Since nodeIntegration is true, plugins can access fs directly
// We need to intercept this at the global level before plugins load

declare global {
  interface Window {
    require: any;
  }
}

// Comprehensive renderer-side interception for CC plugin debugging
console.log(
  '🔍 [PRELOAD DEBUG] Preload script executing, setting up interceptions...',
);

// Method 1: Intercept require calls to patch fs module
if (window.require) {
  console.log('🔍 [PRELOAD DEBUG] window.require available, patching...');
  const originalRequire = window.require;
  window.require = function (moduleName: string) {
    console.log('🔍 [PRELOAD DEBUG] Module required:', moduleName);
    const module = originalRequire(moduleName);

    if (moduleName === 'fs') {
      console.log('🔍 [RENDERER DEBUG] fs module required by plugin');

      // Patch writeFileSync
      const originalWriteFileSync = module.writeFileSync;
      module.writeFileSync = function (
        filePath: string,
        data: any,
        options?: any,
      ) {
        console.log('🔍 [RENDERER DEBUG] fs.writeFileSync called:', filePath);

        // Detect CC plugin pattern and redirect
        if (
          typeof filePath === 'string' &&
          (filePath.includes('_mp4\\') || filePath.includes('_mp4/'))
        ) {
          console.log('🔍 [RENDERER DEBUG] CC plugin detected! Redirecting...');

          // Remove the _mp4 subfolder and save directly in Downloads
          const correctedPath = filePath.replace(
            /RAG Just Got Updated[^\\\/]*_mp4[\\\/]/,
            '',
          );
          console.log(`🔍 [RENDERER DEBUG] Redirecting from: ${filePath}`);
          console.log(`🔍 [RENDERER DEBUG] Redirecting to: ${correctedPath}`);

          return originalWriteFileSync.call(this, correctedPath, data, options);
        }

        return originalWriteFileSync.call(this, filePath, data, options);
      };

      // Patch writeFile as well
      const originalWriteFile = module.writeFile;
      module.writeFile = function (
        filePath: string,
        data: any,
        options?: any,
        callback?: any,
      ) {
        console.log('🔍 [RENDERER DEBUG] fs.writeFile called:', filePath);

        if (
          typeof filePath === 'string' &&
          (filePath.includes('_mp4\\') || filePath.includes('_mp4/'))
        ) {
          const correctedPath = filePath.replace(
            /RAG Just Got Updated[^\\\/]*_mp4[\\\/]/,
            '',
          );
          console.log(
            `🔍 [RENDERER DEBUG] Async redirect: ${filePath} -> ${correctedPath}`,
          );
          return originalWriteFile.call(
            this,
            correctedPath,
            data,
            options,
            callback,
          );
        }

        return originalWriteFile.call(this, filePath, data, options, callback);
      };
    }

    return module;
  };
} else {
  console.log('🔍 [PRELOAD DEBUG] window.require NOT available');
}

// Method 2: Intercept via global object monitoring
(window as any).ccDebugFileWrites = [];
const originalPostMessage = window.postMessage;
window.postMessage = function (
  message: any,
  targetOrigin: string,
  transfer?: any,
) {
  if (typeof message === 'object' && message.action === 'show-success-popup') {
    console.log('🔍 [PRELOAD DEBUG] Intercepted panel message:', message);
    if (message.savePath && message.savePath.includes('_mp4\\')) {
      console.log(
        '🔍 [PRELOAD DEBUG] CC plugin save detected via postMessage!',
      );
      // Log this for debugging
      (window as any).ccDebugFileWrites.push({
        originalPath: message.savePath,
        timestamp: Date.now(),
        method: 'postMessage',
      });
    }
  }
  return originalPostMessage.call(this, message, targetOrigin, transfer);
};

// Method 3: Set up a global hook that plugins might use
(window as any).saveFile = function (filePath: string, content: any) {
  console.log('🔍 [PRELOAD DEBUG] Global saveFile called:', filePath);
  // This could be how the plugin saves files
};

// Main electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  convertFile: (options: {
    downloadId: string;
    inputPath: string;
    targetFormat: string;
    keepOriginal: boolean;
    downloadName: string;
    saveToCustomLocation?: boolean;
  }) => ipcRenderer.invoke('convert-file', options),
  checkFfmpegStatus: () => ipcRenderer.invoke('check-ffmpeg-status'),
  pauseConversion: (downloadId: string) => ipcRenderer.invoke('pause-conversion', downloadId),
  resumeConversion: (downloadId: string) => ipcRenderer.invoke('resume-conversion', downloadId),
  stopConversion: (downloadId: string) => ipcRenderer.invoke('stop-conversion', downloadId),
});

// downlodr exlusive functions
contextBridge.exposeInMainWorld('downlodrFunctions', {
  invoke: (channel: any, ...args: any) => ipcRenderer.invoke(channel, ...args),
  closeApp: () => ipcRenderer.send('close-btn'), // close app
  openExternalLink: (link: string) =>
    ipcRenderer.invoke('openExternalLink', link),
  minimizeApp: () => ipcRenderer.send('minimize-btn'),
  maximizeApp: () => ipcRenderer.send('maximize-btn'),
  openVideo: (filePath: string) => ipcRenderer.invoke('openVideo', filePath),
  deleteFile: (filepath: string) => ipcRenderer.invoke('deleteFile', filepath),
  deleteFolder: (folderpath: string) =>
    ipcRenderer.invoke('deleteFolder', folderpath),
  normalizePath: (filepath: string) =>
    ipcRenderer.invoke('normalizePath', filepath),
  getDownloadFolder: () => ipcRenderer.invoke('getDownloadFolder'),
  isValidPath: (filepath: string) =>
    ipcRenderer.invoke('isValidPath', filepath),
  joinDownloadPath: (downloadPath: string, fileName: string) =>
    ipcRenderer.invoke('joinDownloadPath', downloadPath, fileName),
  validatePath: (folderPath: string) =>
    ipcRenderer.invoke('validatePath', folderPath),
  openFolder: (folderPath: string, filePath: string) =>
    ipcRenderer.invoke('open-folder', folderPath, filePath),
  fileExists: (path: string) => ipcRenderer.invoke('file-exists', path),
  getFileSize: (path: string) => ipcRenderer.invoke('get-file-size', path),
  getDirectorySize: (path: string) =>
    ipcRenderer.invoke('get-directory-size', path),
  // Enhanced FFmpeg status checking
  checkFfmpegStatus: () => ipcRenderer.invoke('check-ffmpeg-status'),
  // Check if app is packaged (dev/prod detection)
  checkAppPackaged: () => ipcRenderer.invoke('check-app-packaged'),
  // File conversion functionality
  convertFile: (options: {
    downloadId: string;
    inputPath: string;
    targetFormat: string;
    keepOriginal: boolean;
    downloadName: string;
    saveToCustomLocation?: boolean;
  }) => ipcRenderer.invoke('convert-file', options),
  showInputContextMenu: () => ipcRenderer.send('show-input-context-menu'),
  invokeMainProcess: (channel: any, ...args: any) => {
    return ipcRenderer.invoke(channel, ...args);
  },
  downloadFile: (url: string, outputPath: string) =>
    ipcRenderer.invoke('downloadFile', url, outputPath),
  ensureDirectoryExists: (dirPath: string) =>
    ipcRenderer.invoke('ensureDirectoryExists', dirPath),
  getThumbnailDataUrl: (path: string) =>
    ipcRenderer.invoke('get-thumbnail-data-url', path),
  getOSType: () => ipcRenderer.invoke('get-os-type'),
  getPathSeparator: () => ipcRenderer.invoke('get-path-separator'),
});

// give download a unique id
function uuidv4() {
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (
      +c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
    ).toString(16),
  );
}

// Balanced throttling utility - optimized for both performance and UX
class BalancedDownloadThrottler {
  private static instance: BalancedDownloadThrottler;
  private pendingUpdates = new Map<string, any>();
  private throttleTimers = new Map<string, NodeJS.Timeout>();

  // Balanced intervals - responsive but not overwhelming
  // Can be adjusted based on system performance needs
  private PROGRESS_UPDATE_DELAY = 150; // 150ms = ~7 FPS (smooth but efficient)
  private LOG_UPDATE_DELAY = 500; // 500ms for logs (less critical)

  static getInstance(): BalancedDownloadThrottler {
    if (!BalancedDownloadThrottler.instance) {
      BalancedDownloadThrottler.instance = new BalancedDownloadThrottler();
    }
    return BalancedDownloadThrottler.instance;
  }

  // Allow runtime adjustment of throttling based on performance needs
  configure(options: { progressDelay?: number; logDelay?: number }) {
    if (options.progressDelay !== undefined) {
      this.PROGRESS_UPDATE_DELAY = Math.max(50, options.progressDelay); // Min 50ms
    }
    if (options.logDelay !== undefined) {
      this.LOG_UPDATE_DELAY = Math.max(100, options.logDelay); // Min 100ms
    }
  }

  throttleUpdate(
    downloadId: string,
    update: any,
    callback: (update: any) => void,
  ) {
    // Critical updates go through immediately
    if (this.isCriticalUpdate(update)) {
      this.forceUpdate(downloadId, update, callback);
      return;
    }

    // Store the latest update
    this.pendingUpdates.set(downloadId, update);

    // Clear existing timer
    const existingTimer = this.throttleTimers.get(downloadId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set appropriate delay based on update type
    const delay = this.isLogOnlyUpdate(update)
      ? this.LOG_UPDATE_DELAY
      : this.PROGRESS_UPDATE_DELAY;

    // Schedule update
    const timer = setTimeout(() => {
      const latestUpdate = this.pendingUpdates.get(downloadId);
      if (latestUpdate) {
        callback(latestUpdate);
        this.pendingUpdates.delete(downloadId);
        this.throttleTimers.delete(downloadId);
      }
    }, delay);

    this.throttleTimers.set(downloadId, timer);
  }

  private isCriticalUpdate(update: any): boolean {
    return (
      update.type === 'controller' ||
      update.data?.value?.status === 'finished' ||
      update.data?.value?.status === 'failed' ||
      update.data?.value?.status === 'cancelled' ||
      update.data?.value?.status === 'error' ||
      update.data?.status === 'paused' // Ensure paused conversion updates are sent immediately
    );
  }

  private isLogOnlyUpdate(update: any): boolean {
    // True if it's only a log update without progress data
    return update.data?.log && !update.data?.value;
  }

  forceUpdate(
    downloadId: string,
    update: any,
    callback: (update: any) => void,
  ) {
    // Clear any pending update
    const existingTimer = this.throttleTimers.get(downloadId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.throttleTimers.delete(downloadId);
    }

    this.pendingUpdates.delete(downloadId);
    callback(update);
  }

  cleanup(downloadId: string) {
    const timer = this.throttleTimers.get(downloadId);
    if (timer) {
      clearTimeout(timer);
      this.throttleTimers.delete(downloadId);
    }
    this.pendingUpdates.delete(downloadId);
  }

  cleanupAll() {
    this.throttleTimers.forEach((timer) => clearTimeout(timer));
    this.throttleTimers.clear();
    this.pendingUpdates.clear();
  }
}

// Ytdlp exclusive functions
contextBridge.exposeInMainWorld('ytdlp', {
  getPlaylistInfo: async (url: string) => {
    return await ipcRenderer.invoke('ytdlp:playlist:info', url);
  },

  getInfo: async (url: string) => {
    try {
      const info = await ipcRenderer.invoke('ytdlp:info', url);
      return info;
    } catch {
      return null;
    }
  },

  killController: (id: any) => ipcRenderer.invoke('kill-controller', id),

  stop: async (id: any) => {
    return await ipcRenderer.invoke('ytdlp:stop', id);
  },

  selectDownloadDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  downloadYTDLP: async (options?: {
    filePath?: string;
    version?: string;
    platform?: string;
    forceDownload?: boolean;
  }) => {
    return await ipcRenderer.invoke('ytdlp:downloadYTDLP', options);
  },

  getCurrentVersion: async () => {
    return await ipcRenderer.invoke('ytdlp:getCurrentVersion');
  },

  getLatestVersion: async () => {
    return await ipcRenderer.invoke('ytdlp:getLatestVersion');
  },

  checkAndUpdate: async () => {
    return await ipcRenderer.invoke('ytdlp:checkAndUpdate');
  },

  download(args: object, callback: (result: object) => void) {
    const id = uuidv4();
    const channel = `ytdlp:download:status:${id}`;
    const controllerChannel = `ytdlp:controller:${id}`;
    const throttler = BalancedDownloadThrottler.getInstance();

    async function startDownload() {
      try {
        ipcRenderer.invoke('ytdlp:download', id, args);

        // Listen for controller ID from the main process
        ipcRenderer.on(controllerChannel, (event, data) => {
          // Controller data is critical, send immediately
          throttler.forceUpdate(
            id,
            {
              type: 'controller',
              downloadId: data.downloadId,
              controllerId: data.controllerId,
            },
            callback,
          );
        });

        ipcRenderer.on(channel, (event, chunk) => {
          // Use balanced throttling for all updates
          throttler.throttleUpdate(id, chunk, callback);

          // Clean up on finish - but NOT on pause (conversion can be resumed)
          if (chunk.data?.status === 'finished') {
            ipcRenderer.removeAllListeners(channel);
            ipcRenderer.removeAllListeners(controllerChannel);
            throttler.cleanup(id);
          }
          // NOTE: Do NOT clean up on 'paused' status - listeners needed for resume
        });
      } catch (error) {
        console.error('Error during download:', error);
      }
    }

    startDownload().catch(console.error);
    return id;
  },
});

contextBridge.exposeInMainWorld('electronDevTools', {
  toggle: () => ipcRenderer.send('toggle-dev-tools'),
});

contextBridge.exposeInMainWorld('updateAPI', {
  onUpdateAvailable: (callback: any) => {
    const wrappedCallback = (_: any, updateInfo: any) => callback(updateInfo);
    ipcRenderer.on('update-available', wrappedCallback);
    return () =>
      ipcRenderer.removeListener('update-available', wrappedCallback);
  },
  onYtdlpAutoUpdated: (callback: any) => {
    const wrappedCallback = (_: any, updateInfo: any) => callback(updateInfo);
    ipcRenderer.on('ytdlp-auto-updated', wrappedCallback);
    return () =>
      ipcRenderer.removeListener('ytdlp-auto-updated', wrappedCallback);
  },
  onYtdlpAutoInstalled: (callback: any) => {
    const wrappedCallback = (_: any, installInfo: any) => callback(installInfo);
    ipcRenderer.on('ytdlp-auto-installed', wrappedCallback);
    return () =>
      ipcRenderer.removeListener('ytdlp-auto-installed', wrappedCallback);
  },
  /*
  onYtdlpUpdateAvailable: (callback: any) => {
    const wrappedCallback = (_: any, updateInfo: any) => callback(updateInfo);
    ipcRenderer.on('ytdlp-update-available', wrappedCallback);
    return () =>
      ipcRenderer.removeListener('ytdlp-update-available', wrappedCallback);
  },
  */
  onUpdateCheckStarted: (callback: any) => {
    const wrappedCallback = (_: any) => callback();
    ipcRenderer.on('update-check-started', wrappedCallback);
    return () =>
      ipcRenderer.removeListener('update-check-started', wrappedCallback);
  },
  onUpdateCheckCompleted: (callback: any) => {
    const wrappedCallback = (_: any, updateInfo: any) => callback(updateInfo);
    ipcRenderer.on('update-check-completed', wrappedCallback);
    return () =>
      ipcRenderer.removeListener('update-check-completed', wrappedCallback);
  },
  onUpdateCheckError: (callback: any) => {
    const wrappedCallback = (_: any, error: any) => callback(error);
    ipcRenderer.on('update-check-error', wrappedCallback);
    return () =>
      ipcRenderer.removeListener('update-check-error', wrappedCallback);
  },
  onOpenSettingsModal: (callback: any) => {
    const wrappedCallback = (_: any) => callback();
    ipcRenderer.on('open-settings-modal', wrappedCallback);
    return () =>
      ipcRenderer.removeListener('open-settings-modal', wrappedCallback);
  },
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getCurrentVersion: () => ipcRenderer.invoke('get-current-version'),
});

// Add these to your existing preload API exposures
contextBridge.exposeInMainWorld('appControl', {
  showWindow: () => ipcRenderer.invoke('show-window'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  quitApp: () => ipcRenderer.invoke('exit-app'),
  setAutoLaunch: (enabled: boolean) =>
    ipcRenderer.invoke('set-auto-launch', enabled),

  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),

  // Clipboard monitoring
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
  onClipboardChange: (callback: (text: string) => void) => {
    ipcRenderer.on('clipboard-changed', (_event, text: string) =>
      callback(text),
    );
  },
  offClipboardChange: () => {
    ipcRenderer.removeAllListeners('clipboard-changed');
  },
  startClipboardMonitoring: () =>
    ipcRenderer.invoke('start-clipboard-monitoring'),
  stopClipboardMonitoring: () =>
    ipcRenderer.invoke('stop-clipboard-monitoring'),
  isClipboardMonitoringActive: () =>
    ipcRenderer.invoke('is-clipboard-monitoring-active'),
  isWindowFocused: () => ipcRenderer.invoke('is-window-focused'),
  clearLastClipboardText: () => ipcRenderer.invoke('clear-last-clipboard-text'),
  clearClipboard: () => ipcRenderer.invoke('clear-clipboard'),
});

// Activity indicator controls
contextBridge.exposeInMainWorld('activityIndicator', {
  start: () => ipcRenderer.invoke('start-activity-indicator'),
  stop: () => ipcRenderer.invoke('stop-activity-indicator'),
});

// Change this from a separate exposure to include both functions
contextBridge.exposeInMainWorld('backgroundSettings', {
  getRunInBackground: () => ipcRenderer.invoke('get-run-in-background'),
  setRunInBackground: (value: boolean) =>
    ipcRenderer.invoke('set-run-in-background', value),
});

// Telemetry consent API for system tray integration
contextBridge.exposeInMainWorld('telemetryAPI', {
  consentRequired: () => ipcRenderer.invoke('telemetry-consent-required'),
  consentCompleted: () => ipcRenderer.invoke('telemetry-consent-completed'),
});

contextBridge.exposeInMainWorld('notifications', {
  notifyDownloadFinished: (downloadInfo: any) => {
    ipcRenderer.send('download-finished', downloadInfo);
  },
});

// Plugin control functions
contextBridge.exposeInMainWorld('plugins', {
  list: () => ipcRenderer.invoke('plugins:list'),
  getCode: (pluginId: string) =>
    ipcRenderer.invoke('plugins:get-code', pluginId),
  install: (pluginPath: string) =>
    ipcRenderer.invoke('plugins:install', pluginPath),
  uninstall: (pluginId: string) =>
    ipcRenderer.invoke('plugins:uninstall', pluginId),
  getMenuItems: (context: any) =>
    ipcRenderer.invoke('plugins:menu-items', context),
  executeMenuItem: (id: any, contextData?: any) =>
    ipcRenderer.invoke('plugins:execute-menu-item', id, contextData),
  loadUnzipped: (pluginDirPath: any) =>
    ipcRenderer.invoke('plugins:loadUnzipped', pluginDirPath),
  extractPlugin: (zipPath: string, extractTo: string) =>
    ipcRenderer.invoke('plugins:extractPlugin', zipPath, extractTo),

  // Safe file operations for plugins
  writeFile: (options: any) => ipcRenderer.invoke('plugins:writeFile', options),

  registerMenuItem: (menuItem: MenuItemRegistration) =>
    ipcRenderer.invoke('plugins:register-menu-item', menuItem),
  unregisterMenuItem: (id: any) =>
    ipcRenderer.invoke('plugins:unregister-menu-item', id),

  getPluginDataPath: (pluginId: string) =>
    ipcRenderer.invoke('plugins:get-data-path', pluginId),
  saveFileDialog: (options: any) =>
    ipcRenderer.invoke('plugins:save-file-dialog', options),
  reload: () => ipcRenderer.invoke('plugins:reload'),
  onReloaded: (callback: () => void) => {
    ipcRenderer.on('plugins:reloaded', callback);
    return () => {
      ipcRenderer.removeListener('plugins:reloaded', callback);
    };
  },
  getEnabledPlugins: () => ipcRenderer.invoke('plugins:getEnabled'),
  setPluginEnabled: (pluginId: string, enabled: boolean) =>
    ipcRenderer.invoke('plugins:setEnabled', pluginId, enabled),
  onPluginStateChanged: (callback: any) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('plugins:stateChanged', subscription);
    return () => {
      ipcRenderer.removeListener('plugins:stateChanged', subscription);
    };
  },
  getPluginLocation: (pluginId: string) =>
    ipcRenderer.invoke('plugins:get-location', pluginId),
  openPluginFolder: (pluginId: string) =>
    ipcRenderer.invoke('plugins:open-folder', pluginId),

  // TaskBar items
  registerTaskBarItem: (item: TaskBarItemRegistration) =>
    ipcRenderer.invoke('plugins:register-taskbar-item', item),

  unregisterTaskBarItem: (id: string) =>
    ipcRenderer.invoke('plugins:unregister-taskbar-item', id),

  getTaskBarItems: () => ipcRenderer.invoke('plugins:taskbar-items'),

  executeTaskBarItem: (id: string, contextData?: any) =>
    ipcRenderer.invoke('plugins:execute-taskbar-item', id, contextData),

  readFile: (filePath: string) =>
    ipcRenderer.invoke('plugin:fs:readFile', { filePath }),

  readFileContents: (options: { filePath: string; pluginId?: string }) =>
    ipcRenderer.invoke('plugin:readFileContents', { options }),

  // Close plugin panel
  closePluginPanel: () => ipcRenderer.invoke('plugins:close-panel'),
});

// Notification API exposure
contextBridge.exposeInMainWorld('notificationAPI', {
  showNotification: (config: {
    title: string;
    body: string;
    icon?: string;
    actions?: Array<{ action: string; title: string }>;
  }) => ipcRenderer.invoke('notification:show', config),

  requestPermissions: () =>
    ipcRenderer.invoke('notification:request-permissions'),

  hasPermissions: () => ipcRenderer.invoke('notification:has-permissions'),
});

// Dock Badge API exposure
contextBridge.exposeInMainWorld('dockBadgeAPI', {
  setBadgeCount: (count: number) =>
    ipcRenderer.invoke('dock-badge:set-count', count),

  getBadgeCount: () => ipcRenderer.invoke('dock-badge:get-count'),

  clearBadge: () => ipcRenderer.invoke('dock-badge:clear'),
});
