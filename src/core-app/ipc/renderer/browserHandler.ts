import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('browserFunctionsBridge', {
  openExternalLink: (link: string) =>
    ipcRenderer.invoke('openExternalLink', link),
  getThumbnailDataUrl: (path: string) =>
    ipcRenderer.invoke('get-thumbnail-data-url', path),
  checkInternetConnection: () =>
    ipcRenderer.invoke('check-internet-connection'),
  checkSiteReachable: (url: string) =>
    ipcRenderer.invoke('check-site-reachable', url),
});
