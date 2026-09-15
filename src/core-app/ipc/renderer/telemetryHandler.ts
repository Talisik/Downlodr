import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('telemetry', {
  // Basic logging methods
  logInfo: (message: string, data: string) =>
    ipcRenderer.invoke('log-message', 'info', message, data),
  logError: (message: string, data: any, error: string) =>
    ipcRenderer.invoke('log-message', 'error', message, { error, ...data }),
  logWarning: (message: string, data: string) =>
    ipcRenderer.invoke('log-message', 'warning', message, data),
  getTelemetryAppInfo: () => ipcRenderer.invoke('get-app-info'),
});

// Global error handler for renderer process
window.addEventListener('error', (event) => {
  ipcRenderer.invoke('log-message', 'error', 'Uncaught error in renderer', {
    error: {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    },
    timestamp: Date.now(),
  });
});

window.addEventListener('unhandledrejection', (event) => {
  ipcRenderer.invoke(
    'log-message',
    'error',
    'Unhandled promise rejection in renderer',
    {
      error: {
        reason: event.reason?.toString(),
        stack: event.reason?.stack,
      },
      timestamp: Date.now(),
    },
  );
});
