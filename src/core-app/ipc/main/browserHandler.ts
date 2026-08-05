/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

import { BrowserWindow, ipcMain, shell } from 'electron';
import os from 'os';
/**
 * Handles the behavior of the base app such as closing, minimizing, maximizing, etc.
 * @param mainWindow - The main window of the base app
 * @returns void
 */
export const browserHandler = (mainWindow: BrowserWindow) => {
  // IPC handlers for various functionalities
  ipcMain.handle('openExternalLink', async (_event, link: string) => {
    try {
      await shell.openExternal(link);
    } catch (error) {
      console.error('Failed to open external link:', error);
      throw error;
    }
  });

  ipcMain.handle('getBrowserInfo', async () => {
    try {
      if (os) {
        return {
          browser_name: 'Chromium',
          browser_version: process.versions.chrome,
          browser_arch: os.arch(),
        };
      } else {
        // Renderer process fallbacks using available web APIs
        const navigatorInfo =
          typeof navigator !== 'undefined' ? navigator : null;

        return {
          host_name: 'renderer-host',
          host_id: 'host_id',
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
};
