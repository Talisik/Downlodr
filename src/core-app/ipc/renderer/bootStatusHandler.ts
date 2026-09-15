import { contextBridge, ipcRenderer } from 'electron';

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
});
