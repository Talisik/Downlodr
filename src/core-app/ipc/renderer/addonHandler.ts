import { contextBridge, ipcRenderer } from 'electron';
import type { PackName } from '@/core-app/ipc/main/addonManager';

contextBridge.exposeInMainWorld('addonBridge', {
  getStatus: () => ipcRenderer.invoke('addon:status'),

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
  },
});
