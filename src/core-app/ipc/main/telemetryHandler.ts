/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

import { BrowserWindow, ipcMain } from 'electron';
import { logError, logInfo, logWarning } from '../../telemetry/otel-logs';
/**
 * Handles the behavior of the base app such as closing, minimizing, maximizing, etc.
 * @param mainWindow - The main window of the base app
 * @returns void
 */
export const telemetryHandler = (mainWindow: BrowserWindow) => {
  // IPC handlers for logging
  ipcMain.handle('log-message', async (event, level, message, data) => {
    switch (level) {
      case 'info':
        await logInfo(message, { source: 'renderer', ...data });
        break;
      case 'error':
        await logError(message, data?.error, { source: 'renderer', ...data });
        break;
      case 'warning':
        await logWarning(message, { source: 'renderer', ...data });
        break;
    }
  });
};
