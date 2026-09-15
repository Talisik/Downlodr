import { contextBridge, ipcRenderer } from 'electron';
import type { SmartOrganizeDownloadInput, SmartOrganizeHandlerResult, SmartOrganizeProgress } from '../../schema/smartOrganizeTypes.js';
import { SO_CHANNELS } from '../../schema/smartOrganizeTypes.js';

contextBridge.exposeInMainWorld('smartOrganizeBridge', {
  /**
   * Start a Smart Organize job.
   * Resolves with SmartOrganizeHandlerResult when the job completes or fails.
   * Always resolves — never rejects.
   */
  start: (downloads: SmartOrganizeDownloadInput[]): Promise<SmartOrganizeHandlerResult> =>
    ipcRenderer.invoke(SO_CHANNELS.START, downloads),

  /**
   * Abort the currently running job.
   * No-op if no job is running.
   */
  cancel: (): void =>
    ipcRenderer.send(SO_CHANNELS.CANCEL),

  /**
   * Subscribe to progress events pushed from the main process.
   * Returns an unsubscribe function — call it on component unmount.
   */
  onProgress: (callback: (progress: SmartOrganizeProgress) => void): (() => void) => {
    const wrapped = (_: Electron.IpcRendererEvent, progress: SmartOrganizeProgress) =>
      callback(progress);
    ipcRenderer.on(SO_CHANNELS.PROGRESS, wrapped);
    return () => ipcRenderer.removeListener(SO_CHANNELS.PROGRESS, wrapped);
  },
});
