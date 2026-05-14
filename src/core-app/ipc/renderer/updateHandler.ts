import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('updateFunctionsBridge', {
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
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getCurrentVersion: () => ipcRenderer.invoke('get-current-version'),
});
