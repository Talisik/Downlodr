import { contextBridge, ipcRenderer } from 'electron';
import { BalancedDownloadThrottler } from '../../utils/downloadThrottle';
import { uuidv4 } from '../../utils/uuid';
// Ytdlp exclusive functions
contextBridge.exposeInMainWorld('ytdlpFunctionsBridge', {
  getPlaylistInfo: async (url: string) => {
    return await ipcRenderer.invoke('ytdlp:playlist:info', url);
  },

  getInfo: async (url: string) => {
    return await ipcRenderer.invoke('ytdlp:info', url);
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

          // Clean up on finish
          if (chunk.data?.status === 'finished') {
            ipcRenderer.removeAllListeners(channel);
            ipcRenderer.removeAllListeners(controllerChannel);
            throttler.cleanup(id);
          }
        });
      } catch (error) {
        console.error('Error during download:', error);
      }
    }

    startDownload().catch(console.error);
    return id;
  },

  getDirectUrl: async (url: string): Promise<string> => {
    return await ipcRenderer.invoke('ytdlp:getDirectUrl', url);
  },

  downloadPreview: async (requestId: string, url: string): Promise<string> => {
    return await ipcRenderer.invoke('ytdlp:downloadPreview', requestId, url);
  },

  cancelPreviewDownload: async (requestId: string): Promise<void> => {
    return await ipcRenderer.invoke('ytdlp:cancelPreviewDownload', requestId);
  },

  releasePreviewFile: async (tempPath: string): Promise<void> => {
    return await ipcRenderer.invoke('ytdlp:releasePreviewFile', tempPath);
  },

  readCaptionFile: async (filePath: string): Promise<string> => {
    return await ipcRenderer.invoke('ytdlp:readCaptionFile', filePath);
  },
});
