/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('downlodrFunctions', {
  invoke: (channel: any, ...args: any) => ipcRenderer.invoke(channel, ...args),
  closeApp: () => ipcRenderer.send('close-btn'),
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
  openFolder: (folderPath: string) =>
    ipcRenderer.invoke('open-folder', folderPath),
  fileExists: (path: string) => ipcRenderer.invoke('file-exists', path),
});
// let isOperationInProgress = false;

function uuidv4() {
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (
      +c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
    ).toString(16),
  );
}
