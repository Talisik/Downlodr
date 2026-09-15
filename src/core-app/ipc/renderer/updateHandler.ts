import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('updateFunctionsBridge', {
  onUpdateAvailable: (callback: any) => {
    const wrappedCallback = (_: any, updateInfo: any) => callback(updateInfo);
    ipcRenderer.on('update-available', wrappedCallback);
    return () => ipcRenderer.removeListener('update-available', wrappedCallback);
  },
  onYtdlpAutoUpdated: (callback: any) => {
    const wrappedCallback = (_: any, updateInfo: any) => callback(updateInfo);
    ipcRenderer.on('ytdlp-auto-updated', wrappedCallback);
    return () => ipcRenderer.removeListener('ytdlp-auto-updated', wrappedCallback);
  },
  onYtdlpAutoInstalled: (callback: any) => {
    const wrappedCallback = (_: any, installInfo: any) => callback(installInfo);
    ipcRenderer.on('ytdlp-auto-installed', wrappedCallback);
    return () => ipcRenderer.removeListener('ytdlp-auto-installed', wrappedCallback);
  },
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getCurrentVersion: () => ipcRenderer.invoke('get-current-version'),

  // --- Auto-update download/install ---
  downloadUpdate: (url: string) => ipcRenderer.invoke('download-update', url),
  cancelDownload: () => ipcRenderer.invoke('cancel-download'),
  onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => {
    const wrapped = (_: any, progress: any) => callback(progress);
    ipcRenderer.on('download-progress', wrapped);
    return () => ipcRenderer.removeListener('download-progress', wrapped);
  },
  onDownloadComplete: (callback: (info: { filePath: string }) => void) => {
    const wrapped = (_: any, info: any) => callback(info);
    ipcRenderer.on('download-complete', wrapped);
    return () => ipcRenderer.removeListener('download-complete', wrapped);
  },
  onDownloadError: (callback: (info: { error: string }) => void) => {
    const wrapped = (_: any, info: any) => callback(info);
    ipcRenderer.on('download-error', wrapped);
    return () => ipcRenderer.removeListener('download-error', wrapped);
  },
  installUpdate: () => ipcRenderer.invoke('install-update'),

  getAutoUpdateState: () => ipcRenderer.invoke('get-auto-update-state'),
  startAutoUpdateCheck: () => ipcRenderer.invoke('start-auto-update-check'),

  // --- Background auto-download events (separate from manual download) ---
  onAutoUpdateStarted: (callback: (info: { updateInfo?: any }) => void) => {
    const wrapped = (_: any, info: any) => callback(info);
    ipcRenderer.on('auto-update-started', wrapped);
    return () => ipcRenderer.removeListener('auto-update-started', wrapped);
  },
  onAutoUpdateProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => {
    const wrapped = (_: any, progress: any) => callback(progress);
    ipcRenderer.on('auto-update-progress', wrapped);
    return () => ipcRenderer.removeListener('auto-update-progress', wrapped);
  },
  onAutoUpdateReady: (callback: (info: { filePath: string; updateInfo?: any }) => void) => {
    const wrapped = (_: any, info: any) => callback(info);
    ipcRenderer.on('auto-update-ready', wrapped);
    return () => ipcRenderer.removeListener('auto-update-ready', wrapped);
  },
  onAutoUpdateError: (callback: (info: { error: string }) => void) => {
    const wrapped = (_: any, info: any) => callback(info);
    ipcRenderer.on('auto-update-error', wrapped);
    return () => ipcRenderer.removeListener('auto-update-error', wrapped);
  },
});
