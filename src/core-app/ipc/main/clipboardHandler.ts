/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

import { BrowserWindow, clipboard, ipcMain } from 'electron';
/**
 * Handles the behavior of the base app such as closing, minimizing, maximizing, etc.
 * @param mainWindow - The main window of the base app
 * @returns void
 */

// set up clipboard monitoring
let clipboardInterval: NodeJS.Timeout | null = null;
let lastClipboardText = 'BLANK_STATE';
let isMonitoring = false;

/** Shared state: allow other handlers to set last clipboard text (e.g. on exit). */
export function setLastClipboardText(value: string): void {
  lastClipboardText = value;
}

/** Shared state: read-only access for other modules that need to read (not assign). */
export function getLastClipboardText(): string {
  return lastClipboardText;
}
// focus tracking variable
let isWindowFocused = false;

// start clipboard monitoring
const startClipboardMonitoring = () => {
  if (clipboardInterval) {
    clearInterval(clipboardInterval);
  }

  isMonitoring = true;
  // set internal state to BLANK_STATE for fallback tracking
  lastClipboardText = 'BLANK_STATE';

  // actually clear the clipboard by writing an empty string
  try {
    clipboard.writeText('');
  } catch (error) {
    console.log(
      'Could not clear clipboard, using BLANK_STATE fallback:',
      error,
    );
  }

  // function to start the monitoring interval with appropriate timing
  const startMonitoringInterval = () => {
    clipboardInterval = setInterval(() => {
      if (!isMonitoring) {
        return;
      }

      // Skip processing if window is focused - reduce log noise
      if (isWindowFocused) {
        return;
      }

      try {
        const currentText = clipboard.readText();

        // Only process if content has changed and is reasonable size
        if (currentText !== lastClipboardText && currentText.length <= 10000) {
          // Only send clipboard change event if:
          // 1. We're not going from BLANK_STATE to new content (prevents initial triggers)
          // 2. Current content is not empty (prevents triggers when clearing clipboard)
          // 3. Window is not focused (new condition)
          if (
            lastClipboardText !== 'BLANK_STATE' &&
            currentText.trim() !== '' &&
            !isWindowFocused
          ) {
            // Send clipboard change event to all renderer processes
            BrowserWindow.getAllWindows().forEach((win) => {
              if (!win.isDestroyed()) {
                win.webContents.send('clipboard-changed', currentText);
              }
            });
          }

          // Always update the last clipboard text for comparison
          lastClipboardText = currentText;
        }
      } catch (error) {
        console.debug('Clipboard monitoring error:', error);
      }
    }, 1000); // Standard 1 second polling
  };

  // delay to prevent immediate detection of current clipboard content
  setTimeout(startMonitoringInterval, 500);
};

const stopClipboardMonitoring = () => {
  isMonitoring = false;
  if (clipboardInterval) {
    clearInterval(clipboardInterval);
    clipboardInterval = null;
  }
  lastClipboardText = 'BLANK_STATE';
};

export const clipboardHandler = (mainWindow: BrowserWindow) => {
  mainWindow.on('focus', () => {
    isWindowFocused = true;
  });

  mainWindow.on('blur', () => {
    isWindowFocused = false;
  });

  mainWindow.on('closed', () => {
    isWindowFocused = false;
  });

  // get clipboard text
  ipcMain.handle('get-clipboard-text', () => {
    return clipboard.readText();
  });

  // start clipboard monitoring
  ipcMain.handle('start-clipboard-monitoring', () => {
    startClipboardMonitoring();
    return true;
  });

  // stop clipboard monitoring
  ipcMain.handle('stop-clipboard-monitoring', () => {
    stopClipboardMonitoring();
    return true;
  });

  // check if clipboard monitoring is active
  ipcMain.handle('is-clipboard-monitoring-active', () => {
    return isMonitoring;
  });

  // check if window is focused
  ipcMain.handle('is-window-focused', () => {
    return isWindowFocused;
  });

  // clear last clipboard text
  ipcMain.handle('clear-last-clipboard-text', () => {
    lastClipboardText = 'BLANK_STATE';
    return true;
  });

  // actually clear the clipboard
  ipcMain.handle('clear-clipboard', () => {
    try {
      clipboard.writeText('');
      lastClipboardText = 'BLANK_STATE';
      return true;
    } catch (error) {
      return false;
    }
  });
};
