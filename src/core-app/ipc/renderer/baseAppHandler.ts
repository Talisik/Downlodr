/**
 * Preload script for the Electron application.
 * This script runs in the context of the renderer process and exposes
 * certain functions and properties to the renderer via the context bridge.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { contextBridge, ipcRenderer } from 'electron';

// Increase the max listeners to prevent memory leak warnings
// This should be done before setting up any listeners
ipcRenderer.setMaxListeners(20);

// Synchronous platform read for layout decisions that can't wait on an IPC
// round-trip (e.g. TitleBar.tsx reserving space for macOS's native
// traffic-light buttons before first paint). `process` is only ever
// reachable here, in the preload script — contextIsolation keeps it out of
// the page's own JS even with nodeIntegration enabled — so the value is
// captured once and exposed as plain data, not a live binding.
contextBridge.exposeInMainWorld('platformInfo', {
  platform: process.platform,
});

contextBridge.exposeInMainWorld('appBehaviorBridge', {
  invoke: (channel: any, ...args: any) => ipcRenderer.invoke(channel, ...args),
  showInputContextMenu: () => ipcRenderer.send('show-input-context-menu'),
  invokeMainProcess: (channel: any, ...args: any) => {
    return ipcRenderer.invoke(channel, ...args);
  },
  minimizeApp: () => ipcRenderer.send('minimize-btn'),
  maximizeApp: () => ipcRenderer.send('maximize-btn'),
  closeApp: () => ipcRenderer.send('close-btn'), // close app
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on('window-maximize-change', (_event, value: boolean) =>
      callback(value),
    );
  },
  offMaximizeChange: () => {
    ipcRenderer.removeAllListeners('window-maximize-change');
  },
});

contextBridge.exposeInMainWorld('appInfoBridge', {
  getBundledBinaryPath: (binaryName: string) =>
    ipcRenderer.invoke('get-bundled-binary-path', binaryName),
  getHostInfo: () => ipcRenderer.invoke('getHostInfo'),
  getBrowserInfo: () => ipcRenderer.invoke('getBrowserInfo'),
  getAppInfo: () => ipcRenderer.invoke('getAppInfo'),
  getOSType: () => ipcRenderer.invoke('get-os-type'),
});

contextBridge.exposeInMainWorld('electronDevToolsBridge', {
  toggle: () => ipcRenderer.send('toggle-dev-tools'),
});

contextBridge.exposeInMainWorld('appControlBridge', {
  showWindow: () => ipcRenderer.invoke('show-window'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  quitApp: () => ipcRenderer.invoke('exit-app'),
  setAutoLaunch: (enabled: boolean) =>
    ipcRenderer.invoke('set-auto-launch', enabled),

  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),

  // Clipboard monitoring
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
  onClipboardChange: (callback: (text: string) => void) => {
    ipcRenderer.on('clipboard-changed', (_event, text: string) =>
      callback(text),
    );
  },
  offClipboardChange: () => {
    ipcRenderer.removeAllListeners('clipboard-changed');
  },
  startClipboardMonitoring: () =>
    ipcRenderer.invoke('start-clipboard-monitoring'),
  stopClipboardMonitoring: () =>
    ipcRenderer.invoke('stop-clipboard-monitoring'),
  isClipboardMonitoringActive: () =>
    ipcRenderer.invoke('is-clipboard-monitoring-active'),
  isWindowFocused: () => ipcRenderer.invoke('is-window-focused'),
  clearLastClipboardText: () => ipcRenderer.invoke('clear-last-clipboard-text'),
  clearClipboard: () => ipcRenderer.invoke('clear-clipboard'),
});

// Change this from a separate exposure to include both functions
contextBridge.exposeInMainWorld('backgroundSettings', {
  getRunInBackground: () => ipcRenderer.invoke('get-run-in-background'),
  setRunInBackground: (value: boolean) =>
    ipcRenderer.invoke('set-run-in-background', value),
});

contextBridge.exposeInMainWorld('notifications', {
  notifyDownloadFinished: (downloadInfo: any) => {
    ipcRenderer.send('download-finished', downloadInfo);
  },
});
