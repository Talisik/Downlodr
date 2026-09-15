import { BrowserWindow, ipcMain } from 'electron';
import {
  SO_CHANNELS,
  SmartOrganizeDownloadInput,
  SmartOrganizeProgress,
} from '../../schema/smartOrganizeTypes.js';
import {
  isRunning,
  runSmartOrganize,
} from '../../service/smartOrganizeService.js';

/**
 * Register Smart Organize IPC handlers on the main process.
 *
 * Channels:
 *   smart-organize:start  (handle) — kick off the pipeline
 *   smart-organize:cancel (on)     — abort the running job
 *
 * Progress events are pushed to the renderer via:
 *   smart-organize:progress
 */
export function smartOrganizeHandler(mainWindow: BrowserWindow, addonPath?: string): void {
  let abortController: AbortController | null = null;

  // ── Cancel ────────────────────────────────────────────────────────────────
  ipcMain.on(SO_CHANNELS.CANCEL, () => {
    abortController?.abort();
  });

  // ── Start ─────────────────────────────────────────────────────────────────
  ipcMain.handle(
    SO_CHANNELS.START,
    async (_event, downloads: SmartOrganizeDownloadInput[]) => {
      if (isRunning()) {
        return {
          ok: false,
          reason: 'error',
          message: 'A Smart Organize job is already running.',
        };
      }

      abortController = new AbortController();
      const { signal } = abortController;

      const onProgress = (progress: SmartOrganizeProgress) => {
        // Guard: window may have been closed by the time progress fires
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send(SO_CHANNELS.PROGRESS, progress);
        }
      };

      const result = await runSmartOrganize(downloads, signal, onProgress, addonPath);
      abortController = null;
      return result;
    },
  );
}
