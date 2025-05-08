/**
 * Preload script for the Electron application.
 * This script runs in the context of the renderer process and exposes
 * certain functions and properties to the renderer via the context bridge.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { contextBridge, ipcRenderer } from 'electron';

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
      console.log('error');
    }
  },

  killController: (id: any) => ipcRenderer.invoke('kill-controller', id),

  stop: async (id: any) => {
    return await ipcRenderer.invoke('ytdlp:stop', id);
  },

  selectDownloadDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  download(args: object, callback: (result: object) => void) {
    const id = uuidv4();
    const channel = `ytdlp:download:status:${id}`;
    const controllerChannel = `ytdlp:controller:${id}`;

    async function startDownload() {
      try {
        ipcRenderer.invoke('ytdlp:download', id, args);
        // Listen for controller ID from the main process
        ipcRenderer.on(controllerChannel, (event, data) => {
          //console.log('Received controller data:', data);
          callback({
            type: 'controller',
            downloadId: data.downloadId,
            controllerId: data.controllerId,
          });
        });
        ipcRenderer.on(channel, (event, chunk) => {
          callback(chunk);
          if (chunk.data.status === 'finished') {
            console.log('Preload done');
            ipcRenderer.removeAllListeners(channel);
          }
        });
      } catch (error) {
        console.error('Error during download:');
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
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
});

// Add these to your existing preload API exposures
contextBridge.exposeInMainWorld('appControl', {
  showWindow: () => ipcRenderer.invoke('show-window'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  quitApp: () => ipcRenderer.invoke('exit-app'),
  setAutoLaunch: (enabled: boolean) =>
    ipcRenderer.invoke('set-auto-launch', enabled),

  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
});

// Change this from a separate exposure to include both functions
contextBridge.exposeInMainWorld('backgroundSettings', {
  getRunInBackground: () => ipcRenderer.invoke('get-run-in-background'),
  setRunInBackground: (value: boolean) =>
    ipcRenderer.invoke('set-run-in-background', value),
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

  // Safe file operations for plugins
  writeFile: (options: any) => ipcRenderer.invoke('plugins:writeFile', options),

  registerMenuItem: (menuItem: any) =>
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
  registerTaskBarItem: (item: any) =>
    ipcRenderer.invoke('plugins:register-taskbar-item', item),

  unregisterTaskBarItem: (id: string) =>
    ipcRenderer.invoke('plugins:unregister-taskbar-item', id),

  getTaskBarItems: () => ipcRenderer.invoke('plugins:taskbar-items'),

  executeTaskBarItem: (id: string, contextData?: any) =>
    ipcRenderer.invoke('plugins:execute-taskbar-item', id, contextData),

  readFile: (filePath: string) =>
    ipcRenderer.invoke('plugin:fs:readFile', { filePath }),
});
