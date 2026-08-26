import { contextBridge, ipcRenderer } from 'electron';

type BootProgress = {
 label: string;
 copiedBytes: number;
 totalBytes: number;
 step: number;
 totalSteps: number;
};

/**
 * Boot status bridge — consumed only by the static splash screen in
 * index.html (not by React code), so it is intentionally NOT re-exported
 * through composeWindowApi.ts.
 */
contextBridge.exposeInMainWorld('bootStatusBridge', {
 onStatus: (cb: (message: string) => void) => {
  const wrapped = (_: unknown, message: string) => cb(message);
  ipcRenderer.on('boot:status', wrapped);
  return () => ipcRenderer.removeListener('boot:status', wrapped);
 },
 onProgress: (cb: (progress: BootProgress) => void) => {
  const wrapped = (_: unknown, progress: BootProgress) => cb(progress);
  ipcRenderer.on('boot:progress', wrapped);
  return () => ipcRenderer.removeListener('boot:progress', wrapped);
 },
 onProgressDone: (cb: () => void) => {
  const wrapped = () => cb();
  ipcRenderer.on('boot:progress-done', wrapped);
  return () => ipcRenderer.removeListener('boot:progress-done', wrapped);
 },
});
