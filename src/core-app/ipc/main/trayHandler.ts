/* Handler for developer tools of base app such as opening dev tools, etc. */
/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

import { checkForUpdates } from '@/core-app/hook/updateCheckerHook';
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  Tray,
} from 'electron';
import fs from 'fs';
import path from 'path';

export type TrayHandlerOptions = {
  onBeforeQuit?: () => void;
};
/**
 * Handles the behavior of the base app such as closing, minimizing, maximizing, etc.
 * @param mainWindow - The main window of the base app
 * @returns void
 */

let runInBackgroundSetting = true;
let tray: Tray | null = null;
let normalTrayIcon: Electron.NativeImage | undefined;
let alertTrayIcon: Electron.NativeImage | undefined;
let isDownloadComplete = false;

/** Shared state: allow other handlers to set last clipboard text (e.g. on exit). */
export function setRunInBackgroundSetting(value: boolean): void {
  runInBackgroundSetting = value;
}

/** Shared state: read-only access for other modules that need to read (not assign). */
export function getRunInBackgroundSetting(): boolean {
  return runInBackgroundSetting;
}

export function setTray(value: Tray): void {
  tray = value;
}

export function setTrayIcons(
  normalIcon: Electron.NativeImage,
  alertIcon: Electron.NativeImage,
): void {
  normalTrayIcon = normalIcon;
  alertTrayIcon = alertIcon;
}

/** Shared state: read-only access for other modules that need to read (not assign). */
export function getTray(): Tray | null {
  return tray;
}

export function resetTrayIcon() {
  if (tray && normalTrayIcon && isDownloadComplete) {
    tray.setImage(normalTrayIcon);
    isDownloadComplete = false;
    tray.setToolTip('Downlodr');
  }
}

export function showNotification(
  title: string,
  body: string,
  onClick?: () => void,
) {
  // Check if notifications are supported
  if (!Notification.isSupported()) {
    return;
  }

  const notification = new Notification({
    title,
    body,
    icon: normalTrayIcon,
  });

  if (onClick) {
    notification.on('click', onClick);
  }
  notification.show();
}

/** Call from main process when a download completes (e.g. from ytdlpHandler). Updates tray icon and shows notification. */
export function notifyTrayDownloadComplete(downloadInfo: {
  name: string;
}): void {
  const { name } = downloadInfo;
  showNotification(
    'Download Complete',
    `"${name}" has finished downloading`,
    () => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        win.show();
        win.focus();
        resetTrayIcon();
      }
    },
  );
  if (tray && alertTrayIcon && !alertTrayIcon.isEmpty()) {
    tray.setImage(alertTrayIcon);
    isDownloadComplete = true;
    tray.setToolTip('Downlodr - Download Complete');
  } else if (tray && normalTrayIcon) {
    tray.setToolTip('Downlodr - Download Complete');
  }
}

export const trayHandler = (
  mainWindow: BrowserWindow,
  options?: TrayHandlerOptions,
) => {
  const onBeforeQuit = options?.onBeforeQuit;

  const createTray = () => {
    // Get correct path based on whether in dev or production
    let iconPath, alertIconPath;

    if (process.env.NODE_ENV === 'development') {
      // Development: resolve from project root (process.cwd())
      const devIcon = 'src/assets/logo/downlodr_icon.png';
      const devAlertIcon = 'src/assets/system-tray/notifCat.png';
      iconPath = path.join(process.cwd(), devIcon);
      alertIconPath = path.join(process.cwd(), devAlertIcon);
    } else {
      // Production: extraResource copies ./src/assets/logo as "logo" in resources
      const prodIcon = path.join('logo', 'downlodr_icon.png');
      const prodAlertIcon = path.join('system-tray', 'notifCat.png');
      iconPath = path.join(process.resourcesPath, prodIcon);
      alertIconPath = path.join(process.resourcesPath, prodAlertIcon);
    }

    // macOS menu bar icons should be ~18px tall; the source assets are 256x256,
    // so resize them before handing them to the Tray or they render huge.
    const TRAY_ICON_SIZE = 18;
    const toTrayIcon = (p: string): Electron.NativeImage => {
      const img = nativeImage.createFromPath(p);
      if (process.platform === 'darwin' && !img.isEmpty()) {
        return img.resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE });
      }
      return img;
    };

    normalTrayIcon = toTrayIcon(iconPath);
    alertTrayIcon = toTrayIcon(alertIconPath);
    if (!alertTrayIcon || alertTrayIcon.isEmpty()) {
      alertTrayIcon = normalTrayIcon;
    }

    // Initialize with normal icon
    tray = new Tray(normalTrayIcon);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Downlodr',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            resetTrayIcon(); // Reset icon when showing app
          }
        },
      },
      {
        label: 'Check for Updates',
        click: async () => {
          const updateInfo = await checkForUpdates();
          if (updateInfo.hasUpdate && mainWindow) {
            mainWindow.webContents.send('update-available', updateInfo);
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          onBeforeQuit?.();
          app.quit();
        },
      },
    ]);

    tray.setToolTip('Downlodr');
    tray.setContextMenu(contextMenu);

    // Double click on tray icon shows the app and resets the icon
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        resetTrayIcon();
      }
    });
  };

  createTray();

  // Single path: renderer can trigger tray notification via IPC (e.g. when store marks finished)
  ipcMain.on(
    'download-finished',
    (
      _event,
      downloadInfo: { name?: string; id?: string; location?: string },
    ) => {
      const name = downloadInfo?.name ?? 'Download';
      notifyTrayDownloadComplete({ name });
    },
  );

  // Function to get file size
  ipcMain.handle('get-file-size', async (_event, filePath) => {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.size; // Returns size in bytes
    } catch (error) {
      return null;
    }
  });

  // Function to get directory size (sum of all files)
  ipcMain.handle('get-directory-size', async (_event, dirPath) => {
    try {
      const stats = await fs.promises.stat(dirPath);

      if (stats.isFile()) {
        return stats.size;
      }

      if (!stats.isDirectory()) {
        return 0;
      }

      let totalSize = 0;
      const calculateSize = async (currentPath: string): Promise<void> => {
        const items = await fs.promises.readdir(currentPath);

        for (const item of items) {
          const itemPath = path.join(currentPath, item);
          try {
            const itemStats = await fs.promises.stat(itemPath);

            if (itemStats.isFile()) {
              totalSize += itemStats.size;
            } else if (itemStats.isDirectory()) {
              await calculateSize(itemPath);
            }
          } catch (error) {
            // Skip files/directories that can't be accessed
            console.warn(`Skipping ${itemPath}: ${error.message}`);
          }
        }
      };

      await calculateSize(dirPath);
      return totalSize;
    } catch (error) {
      console.error('Error calculating directory size:', error);
      return 0;
    }
  });
};
