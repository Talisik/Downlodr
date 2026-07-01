import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('extensionDownloadBridge', {
  onDownload: (
    callback: (data: {
      url: string;
      title: string;
      format_id?: string;
      autoDownload?: boolean;
    }) => void,
  ) => {
    ipcRenderer.on('extension:download', (_event, data) => callback(data));
  },
  offDownload: () => {
    ipcRenderer.removeAllListeners('extension:download');
  },
});
