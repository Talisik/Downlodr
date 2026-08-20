/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { createWriteStream, existsSync } from 'fs';
import { unlink } from 'fs/promises';
import os from 'os';
import path from 'path';
import axios from 'axios';
import { checkForUpdates, UpdateInfo } from '../../hook/updateCheckerHook';
/**
 * Handles the behavior of the base app such as closing, minimizing, maximizing, etc.
 * @param mainWindow - The main window of the base app
 * @returns void
 */

let downloadAbortController: AbortController | null = null;
let isAutoDownloading = false;

type AutoUpdateStatus =
  | { status: 'idle' }
  | { status: 'downloading'; percent: number; transferred: number; total: number; updateInfo?: UpdateInfo }
  | { status: 'ready'; filePath: string; updateInfo?: UpdateInfo }
  | { status: 'error'; error: string };

let autoUpdateState: AutoUpdateStatus = { status: 'idle' };

function broadcastToWindows(channel: string, payload: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  });
}

/**
 * Silently downloads an update in the background, emitting toast-friendly
 * progress events. Tracks state so latecomers can sync on mount.
 */
export async function autoDownloadUpdate(downloadUrl: string, updateInfo?: UpdateInfo): Promise<void> {
  if (isAutoDownloading) return;

  const destPath = path.join(os.tmpdir(), 'downlodr-update.exe');

  if (existsSync(destPath)) {
    autoUpdateState = { status: 'ready', filePath: destPath, updateInfo };
    broadcastToWindows('auto-update-ready', { filePath: destPath, updateInfo });
    return;
  }

  isAutoDownloading = true;
  autoUpdateState = { status: 'downloading', percent: 0, transferred: 0, total: 0, updateInfo };
  broadcastToWindows('auto-update-started', { updateInfo });

  try {
    const response = await axios.get(downloadUrl, { responseType: 'stream' });
    const total = parseInt(response.headers['content-length'] || '0', 10);
    let transferred = 0;
    let lastPercent = -1;

    await new Promise<void>((resolve, reject) => {
      const writer = createWriteStream(destPath);
      response.data.on('data', (chunk: Buffer) => {
        transferred += chunk.length;
        const percent = total > 0 ? Math.round((transferred / total) * 100) : 0;
        if (percent !== lastPercent) {
          lastPercent = percent;
          autoUpdateState = { status: 'downloading', percent, transferred, total, updateInfo };
          broadcastToWindows('auto-update-progress', { percent, transferred, total });
        }
      });
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', (err) => { writer.destroy(); reject(err); });
      response.data.on('error', (err: Error) => { writer.destroy(); reject(err); });
    });

    autoUpdateState = { status: 'ready', filePath: destPath, updateInfo };
    broadcastToWindows('auto-update-ready', { filePath: destPath, updateInfo });
  } catch (error: any) {
    const isCancelled =
      error.name === 'CanceledError' ||
      error.code === 'ERR_CANCELED' ||
      error.message?.includes('canceled');
    if (!isCancelled) {
      const msg = error.message || 'Download failed';
      console.error('Auto-update download failed:', msg);
      autoUpdateState = { status: 'error', error: msg };
      broadcastToWindows('auto-update-error', { error: msg });
    }
    try { await unlink(destPath); } catch { /* partial file */ }
  } finally {
    isAutoDownloading = false;
  }
}

export function getBundledBinaryPath(binaryName: string): string | null {
  const isPackaged = app.isPackaged;

  if (isPackaged && process.resourcesPath) {
    const bundledPath = path.join(process.resourcesPath, binaryName);
    if (existsSync(bundledPath)) {
      return bundledPath;
    }
  }

  // In development the bundled binaries all sit in the repo root, so resolve
  // any of them from the app directory or cwd regardless of where the process
  // was started from. This used to special-case ggml-small.bin and return null
  // for every other name, which silently sent ffprobe.exe back to a bare-name
  // PATH lookup that only worked by accident.
  if (!isPackaged) {
    const appDirPath = path.join(app.getAppPath(), binaryName);
    if (existsSync(appDirPath)) {
      return appDirPath;
    }
    const cwdPath = path.join(process.cwd(), binaryName);
    if (existsSync(cwdPath)) {
      return cwdPath;
    }
  }

  return null;
}

export const appInfoHandler = () => {
  ipcMain.handle('getHostInfo', async () => {
    try {
      if (os) {
        const cpus = os.cpus();
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        return {
          host_name: os.hostname(),
          host_id: os.hostname(),
          host_type: 'desktop',
          host_arch: os.arch(),
          os_type: os.platform(),
          os_description: `${os.type()} ${os.release()}`,
          os_name: os.type(),
          os_version: os.release(),
          cpu_model: cpus[0]?.model || 'unknown',
          cpu_cores: cpus.length,
          cpu_threads: cpus.length,
          memory_total_gb:
            Math.round((totalMemory / 1024 / 1024 / 1024) * 10) / 10,
          memory_available_gb:
            Math.round((freeMemory / 1024 / 1024 / 1024) * 10) / 10,
        };
      } else {
        // Renderer process fallbacks using available web APIs
        const navigatorInfo =
          typeof navigator !== 'undefined' ? navigator : null;

        return {
          host_name: 'renderer-host',
          host_id: 'www',
          host_type: 'desktop',
          host_arch: navigatorInfo?.platform || 'unknown',
          os_type: 'unknown',
          os_description: navigatorInfo?.userAgent || 'Unknown OS',
          os_name: 'unknown',
          os_version: 'unknown',
          cpu_model: 'unknown',
          cpu_cores: navigatorInfo?.hardwareConcurrency || 4,
          cpu_threads: navigatorInfo?.hardwareConcurrency || 4,
          memory_total_gb: 0,
          memory_available_gb: 0,
        };
      }
    } catch (error) {
      return null;
    }
  });

  ipcMain.handle('getAppInfo', async () => {
    try {
      return {
        app_name: 'Downlodr',
        app_platform: process.platform,
        electron_version: process.versions.electron,
        app_arch: os.arch(),
      };
    } catch (error) {
      return null;
    }
  });

  ipcMain.handle('get-auto-update-state', () => autoUpdateState);

  ipcMain.handle('start-auto-update-check', async () => {
    // If already downloading or ready, nothing to do
    if (autoUpdateState.status === 'downloading' || autoUpdateState.status === 'ready') {
      return { checked: false, reason: 'already-in-progress' };
    }
    const updateInfo = await checkForUpdates();
    if (updateInfo.hasUpdate && updateInfo.downloadUrl) {
      // Fire and forget — do not await, so the IPC call returns quickly
      autoDownloadUpdate(updateInfo.downloadUrl, updateInfo);
    }
    return { checked: true, hasUpdate: updateInfo.hasUpdate };
  });

  ipcMain.handle('check-for-updates', async () => {
    const updateInfo = await checkForUpdates();
    if (updateInfo.hasUpdate) {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('update-available', updateInfo);
      }
    }
    return updateInfo;
  });

  ipcMain.handle('get-current-version', async () => {
    // Get version from package.json or app.getVersion()
    return app.getVersion();
  });

  ipcMain.handle('download-update', async (_event, downloadUrl: string) => {
    if (downloadAbortController) {
      downloadAbortController.abort();
      downloadAbortController = null;
    }

    const mainWindow = BrowserWindow.getAllWindows()[0];
    const destPath = path.join(os.tmpdir(), 'downlodr-update.exe');

    downloadAbortController = new AbortController();

    try {
      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
        signal: downloadAbortController.signal,
      });

      const total = parseInt(response.headers['content-length'] || '0', 10);
      let transferred = 0;

      await new Promise<void>((resolve, reject) => {
        const writer = createWriteStream(destPath);

        response.data.on('data', (chunk: Buffer) => {
          transferred += chunk.length;
          const percent = total > 0 ? Math.round((transferred / total) * 100) : 0;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download-progress', { percent, transferred, total });
          }
        });

        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', (err) => { writer.destroy(); reject(err); });
        response.data.on('error', (err: Error) => { writer.destroy(); reject(err); });
      });

      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('download-complete', { filePath: destPath });
      return { success: true, filePath: destPath };
    } catch (error: any) {
      try { await unlink(destPath); } catch { /* partial file may not exist */ }

      const isCancelled =
        error.name === 'CanceledError' ||
        error.code === 'ERR_CANCELED' ||
        error.message?.includes('canceled');

      const message = isCancelled ? 'Download cancelled' : (error.message || 'Download failed');
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('download-error', { error: message });
      return { success: false, error: message };
    } finally {
      downloadAbortController = null;
    }
  });

  ipcMain.handle('cancel-download', async () => {
    downloadAbortController?.abort();
  });

  ipcMain.handle('install-update', async () => {
    const filePath = path.join(os.tmpdir(), 'downlodr-update.exe');
    if (!existsSync(filePath)) {
      return { success: false, error: 'Installer file not found' };
    }

    const error = await shell.openPath(filePath);
    if (error) {
      return { success: false, error };
    }

    app.quit();
    return { success: true };
  });

  // handler to get operating system type
  ipcMain.handle('get-os-type', async () => {
    try {
      const platform = os.platform();

      // Normalize platform names to user-friendly values
      switch (platform) {
        case 'win32':
          return 'windows';
        case 'darwin':
          return 'macos';
        case 'linux':
          return 'linux';
        default:
          return platform; // Return raw platform for other systems
      }
    } catch (error) {
      console.error('Error getting OS type:', error);
      return 'unknown';
    }
  });

  ipcMain.handle('get-path-separator', async () => {
    try {
      return path.sep;
    } catch (error) {
      console.error('Error getting path separator:', error);
      return '/'; // Default to Unix-style separator
    }
  });

  ipcMain.handle('get-bundled-binary-path', async (_, binaryName: string) => {
    try {
      const bundledPath = getBundledBinaryPath(binaryName);
      return bundledPath;
    } catch (error) {
      console.error('Error getting bundled binary path:', error);
      return null;
    }
  });
};
