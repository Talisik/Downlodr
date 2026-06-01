/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

import { app, BrowserWindow, ipcMain } from 'electron';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { checkForUpdates } from '../../hook/updateCheckerHook';
/**
 * Handles the behavior of the base app such as closing, minimizing, maximizing, etc.
 * @param mainWindow - The main window of the base app
 * @returns void
 */

export function getBundledBinaryPath(binaryName: string): string | null {
  const isPackaged = app.isPackaged;

  if (isPackaged && process.resourcesPath) {
    const bundledPath = path.join(process.resourcesPath, binaryName);
    if (existsSync(bundledPath)) {
      return bundledPath;
    }
  }

  // In development, resolve ggml-base.bin from app directory or cwd
  // so it works regardless of where the process was started from
  if (!isPackaged && binaryName === 'ggml-base.bin') {
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
