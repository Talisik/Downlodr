import { contextBridge, ipcRenderer } from 'electron';
import type { PackName } from '@/core-app/ipc/main/addonManager';

contextBridge.exposeInMainWorld('addonBridge', {
  getStatus: () => ipcRenderer.invoke('addon:status'),

  // Query counterpart to on.afdaWorkerReady/on.afdaUnavailable: the worker
  // can become ready before initFromMain has subscribed to those push
  // events, so callers must seed their initial state from this rather than
  // rely on the event alone.
  getAfdaWorkerStatus: (): Promise<boolean> =>
    ipcRenderer.invoke('addon:afda-worker-status'),

  download: (pack: PackName) => ipcRenderer.invoke('addon:download', { pack }),

  restart: () => ipcRenderer.invoke('addon:restart'),

  delete: (pack: PackName) => ipcRenderer.invoke('addon:delete', { pack }),
  openFolder: (pack: PackName) => ipcRenderer.invoke('addon:openFolder', { pack }),
  cancel: (pack: PackName) => ipcRenderer.invoke('addon:cancel', { pack }),

  on: {
    progress: (cb: (data: { pack: PackName; percent: number }) => void) => {
      const wrapped = (_: unknown, data: { pack: PackName; percent: number }) => cb(data);
      ipcRenderer.on('addon:progress', wrapped);
      return () => ipcRenderer.removeListener('addon:progress', wrapped);
    },
    complete: (cb: (data: { pack: PackName; success: boolean; error?: string }) => void) => {
      const wrapped = (_: unknown, data: { pack: PackName; success: boolean; error?: string }) => cb(data);
      ipcRenderer.on('addon:complete', wrapped);
      return () => ipcRenderer.removeListener('addon:complete', wrapped);
    },
    servicesReady: (cb: () => void) => {
      const wrapped = () => cb();
      ipcRenderer.on('addons:services-ready', wrapped);
      return () => ipcRenderer.removeListener('addons:services-ready', wrapped);
    },
    afdaWorkerReady: (cb: () => void) => {
      const wrapped = () => cb();
      ipcRenderer.on('addons:afda-worker-ready', wrapped);
      return () => ipcRenderer.removeListener('addons:afda-worker-ready', wrapped);
    },
    afdaUnavailable: (cb: () => void) => {
      const wrapped = () => cb();
      ipcRenderer.on('addons:afda-unavailable', wrapped);
      return () => ipcRenderer.removeListener('addons:afda-unavailable', wrapped);
    },
  },
});
