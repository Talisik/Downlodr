import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('videoBridge', {
  getVideoBlob: (filePath: string) =>
    ipcRenderer.invoke('get-video-blob', filePath),
  getVideoChunk: (filePath: string, start: number, end: number) =>
    ipcRenderer.invoke('get-video-chunk', filePath, start, end),
});

contextBridge.exposeInMainWorld('fileInfoBridge', {
  getPathSeparator: () => ipcRenderer.invoke('get-path-separator'),
  ensureDirectoryExists: (dirPath: string) =>
    ipcRenderer.invoke('ensureDirectoryExists', dirPath),

  normalizePath: (filepath: string) =>
    ipcRenderer.invoke('normalizePath', filepath),
  getDownloadFolder: () => ipcRenderer.invoke('getDownloadFolder'),
  isValidPath: (filepath: string) =>
    ipcRenderer.invoke('isValidPath', filepath),
  joinDownloadPath: (downloadPath: string, fileName: string) =>
    ipcRenderer.invoke('joinDownloadPath', downloadPath, fileName),
  validatePath: (folderPath: string) =>
    ipcRenderer.invoke('validatePath', folderPath),

  fileExists: (path: string) => ipcRenderer.invoke('file-exists', path),
  getFileSize: (path: string) => ipcRenderer.invoke('get-file-size', path),
  getDirectorySize: (path: string) =>
    ipcRenderer.invoke('get-directory-size', path),
  getFreeDiskSpace: (path: string) =>
    ipcRenderer.invoke('get-free-disk-space', path),
});

contextBridge.exposeInMainWorld('fileFunctionsBridge', {
  selectVideoFile: () => ipcRenderer.invoke('dialog:selectVideoFile'),
  downloadFile: (url: string, outputPath: string) =>
    ipcRenderer.invoke('downloadFile', url, outputPath),
  openVideo: (filePath: string) => ipcRenderer.invoke('openVideo', filePath),
  deleteFile: (filepath: string) => ipcRenderer.invoke('deleteFile', filepath),
  deleteFolder: (folderpath: string) =>
    ipcRenderer.invoke('deleteFolder', folderpath),
  copyFile: (sourcePath: string, destinationPath: string) =>
    ipcRenderer.invoke('copyFile', sourcePath, destinationPath),
  openFolder: (folderPath: string, filePath: string) =>
    ipcRenderer.invoke('open-folder', folderPath, filePath),
  saveBufferToFile: (data: number[], filePath: string) =>
    ipcRenderer.invoke('save-buffer-to-file', data, filePath),
  htmlToPdf: (htmlContent: string) =>
    ipcRenderer.invoke('article-html-to-pdf', htmlContent),
});
