/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

import { BrowserWindow, ipcMain } from 'electron';

/**
 * Handles the behavior of the base app such as closing, minimizing, maximizing, etc.
 * @param mainWindow - The main window of the base app
 * @returns void
 */
function getCpuUsagePercent() {
  const startTime = process.hrtime();
  const startUsage = process.cpuUsage();

  // Simulate some work or wait for a short interval
  const now = Date.now();
  while (Date.now() - now < 500) {
    /* spin the CPU for 500ms */
  }

  const elapTime = process.hrtime(startTime);
  const elapUsage = process.cpuUsage(startUsage);

  const elapTimeMS = elapTime[0] * 1000 + elapTime[1] / 1000000;
  const elapUserMS = elapUsage.user / 1000;
  const elapSystMS = elapUsage.system / 1000;

  const cpuPercent = Math.round((100 * (elapUserMS + elapSystMS)) / elapTimeMS);
  return cpuPercent;
}
export const appPerformanceHandler = (mainWindow: BrowserWindow) => {
  // IPC handlers for various functionalities
  ipcMain.handle('getPerformanceMetrics', async () => {
    try {
      const cpuUsage = getCpuUsagePercent();
      return {
        cpu_usage: cpuUsage,
      };
    } catch (error) {
      return null;
    }
  });
};
