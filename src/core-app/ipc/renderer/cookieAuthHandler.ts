import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('cookieAuthBridge', {
  getState: () => ipcRenderer.invoke('cookieAuth:getState'),
  setMode: (mode: string, browser: string | null) =>
    ipcRenderer.invoke('cookieAuth:setMode', mode, browser),
  import: (browser: string) => ipcRenderer.invoke('cookieAuth:import', browser),
  importFile: () => ipcRenderer.invoke('cookieAuth:importFile'),
  siteLogin: {
    open: (url: string) => ipcRenderer.invoke('cookieAuth:siteLogin:open', url),
    list: () => ipcRenderer.invoke('cookieAuth:siteLogin:list'),
    remove: (domain: string) =>
      ipcRenderer.invoke('cookieAuth:siteLogin:remove', domain),
  },
});
