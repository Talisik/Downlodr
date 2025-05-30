/**
 * Main process entry point for the Electron application.
 * This file is responsible for creating the main application window,
 * handling IPC (Inter-Process Communication) events, and managing
 * application lifecycle events.
 */
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  protocol,
  shell,
  Tray,
} from 'electron';
import started from 'electron-squirrel-startup';
import fs, { existsSync } from 'fs';
import https from 'https';
import os from 'os';
import path from 'path';
import * as YTDLP from 'yt-dlp-helper';
import { checkForUpdates } from './DataFunctions/updateChecker';
import { PluginManager } from './plugins/pluginManager';
import { pluginRegistry } from './plugins/registry';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Prevent multiple instances of the app
const isSingleInstance = app.requestSingleInstanceLock();

if (!isSingleInstance) {
  console.log('Another instance is already running. Quitting this instance.');
  app.quit();
}

// focus first window instead
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let forceQuit = false;
let runInBackgroundSetting = true;

let normalTrayIcon: Electron.NativeImage;
let alertTrayIcon: Electron.NativeImage;
let isDownloadComplete = false;

let pluginManager: PluginManager;

// Function to create the main application window
const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 680,
    frame: false,
    autoHideMenuBar: true,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      nodeIntegration: true,
      // devTools: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // Only open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Handle window close events - hide instead of close
  mainWindow.on('close', async (event) => {
    if (!forceQuit) {
      // Get the real-time setting
      const shouldRunInBackground = await getRunInBackgroundSetting();
      console.log('Window closing, checking setting:', shouldRunInBackground);

      if (shouldRunInBackground) {
        event.preventDefault();
        mainWindow?.hide();
        return false;
      }
    }
  });

  // MAIN FUNCTIONS FOR TITLE BAR
  ipcMain.on('close-btn', () => {
    if (!mainWindow) return;

    if (runInBackgroundSetting) {
      // If running in background is enabled, hide the window
      console.log('Close button clicked, hiding window (background enabled)');
      mainWindow.hide();
    } else {
      // If running in background is disabled, actually quit the app
      console.log('Close button clicked, quitting app (background disabled)');
      forceQuit = true;
      app.quit();
    }
  });

  ipcMain.on('minimize-btn', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('maximize-btn', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  // Prevent navigation to external URLs
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
  });
};

const createTray = () => {
  // Get correct path based on whether in dev or production
  let iconPath, alertIconPath;

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // Development mode paths
    iconPath = path.join(
      process.cwd(),
      'src/Assets/AppLogo/systemTray/systemTray.png',
    );
    alertIconPath = path.join(
      process.cwd(),
      'src/Assets/AppLogo/systemTray/systemNotif.png',
    );
  } else {
    // Production mode paths
    iconPath = path.join(
      process.resourcesPath,
      'AppLogo/systemTray/systemTray.png', // "C:\Users\Mikaela\Desktop\Development\codebase\Electron\v2\Electron\ui_downlodr_v2\src\Assets\AppLogo\systemTray\systemIcon.svg"
    );
    alertIconPath = path.join(
      process.resourcesPath,
      'AppLogo/systemTray/systemNotif.png',
    );
  }

  // Create both icons upfront
  normalTrayIcon = nativeImage.createFromPath(iconPath);
  alertTrayIcon = nativeImage.createFromPath(alertIconPath);

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
        forceQuit = true;
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

// set the alert icon
function setAlertTrayIcon() {
  if (tray && alertTrayIcon) {
    console.log('Setting alert tray icon');
    tray.setImage(alertTrayIcon);
    isDownloadComplete = true;
    tray.setToolTip('Downlodr - Download(s) complete!');
    // Force tray update by setting context menu
    // tray.setContextMenu(tray.getContextMenu());
  } else {
    console.log(
      'Cannot set alert icon - tray or icon missing',
      !!tray,
      !!alertTrayIcon,
    );
  }
}

// reset the icon to normal
function resetTrayIcon() {
  if (tray && normalTrayIcon && isDownloadComplete) {
    tray.setImage(normalTrayIcon);
    isDownloadComplete = false;
    tray.setToolTip('Downlodr');
  }
}

// IPC handlers for various functionalities
ipcMain.on('openExternalLink', (_event, link: string) => {
  shell.openExternal(link);
});

// Functions for Download Verification
ipcMain.handle('joinDownloadPath', async (event, downloadPath, fileName) => {
  const normalizedPath = downloadPath.endsWith(path.sep)
    ? downloadPath
    : downloadPath + path.sep;
  return path.join(normalizedPath, fileName);
});

ipcMain.handle('createFolder', async (_event, dirPath) => {
  if (!fs.existsSync(dirPath)) {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }
  return true;
});

// Function for getting default download folder from each OS
ipcMain.handle('getDownloadFolder', async () => {
  try {
    const homedir = os.homedir();
    let downloadsPath;

    switch (process.platform) {
      case 'win32':
        downloadsPath = path.join(homedir, 'Downloads') + path.sep;
        break;
      case 'darwin':
        downloadsPath = path.join(homedir, 'Downloads') + path.sep;
        break;
      case 'linux':
        downloadsPath = path.join(homedir, 'Downloads') + path.sep;
        break;
      default:
        downloadsPath = path.join(homedir, 'Downloads') + path.sep;
    }

    return downloadsPath;
  } catch (error) {
    console.error('Error determining Downloads folder:', error);
    return null;
  }
});

// Function for validating path of download location
ipcMain.handle('validatePath', async (event, folderPath) => {
  try {
    const resolvedPath = path.resolve(folderPath);

    // Check if the resolved path exists and is a directory
    const stats = await fs.promises.stat(resolvedPath);
    if (!stats.isDirectory()) {
      console.error('Path is not a directory:', resolvedPath);
      return false;
    }
    await fs.promises.access(
      resolvedPath,
      fs.constants.R_OK | fs.constants.W_OK,
    );

    return true;
  } catch (err) {
    console.error('Path is not accessible or invalid:');
    return false;
  }
});

// open directory to choose location, add path sep to work with different OS
ipcMain.handle('dialog:openDirectory', async (event) => {
  // Get the parent browser window
  const browserWindow = BrowserWindow.fromWebContents(event.sender);

  const result = await dialog.showOpenDialog(browserWindow, {
    properties: ['openDirectory'],
    // Explicitly set modal behavior
    // modal: true,
  });

  // Process the result as before
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0].endsWith(path.sep)
    ? result.filePaths[0]
    : result.filePaths[0] + path.sep;
});
// open folder with optional file highlighting
ipcMain.handle('open-folder', async (_, folderPath, filePath = null) => {
  try {
    // If a file path is provided, show the file in the folder (will highlight it)
    if (filePath) {
      await shell.showItemInFolder(filePath);
      return { success: true };
    } else {
      // Otherwise just open the folder without highlighting anything
      const result = await shell.openPath(folderPath);
      if (result) {
        console.error(`Error opening folder: ${result}`);
        return { success: false, error: result };
      }
      return { success: true };
    }
  } catch (error) {
    console.error('Failed to open folder:', error);
    return { success: false, error: error.message };
  }
});

// Function for checking if file exists in the directory
ipcMain.handle('file-exists', async (_event, path) => {
  return existsSync(path);
});

// Function for opening video
ipcMain.handle('openVideo', async (event, filePath) => {
  shell.openPath(filePath);
});

// delete file from drive
ipcMain.handle('deleteFile', async (event, filepath) => {
  try {
    // Normalize the file path
    const normalizedPath = path.normalize(filepath);

    // Check if the file exists
    if (!fs.existsSync(normalizedPath)) {
      console.error('File does not exist:', normalizedPath);
      return false;
    }

    // Move the file to trash
    await shell.trashItem(normalizedPath);
    //console.log('File moved to trash successfully');
    return true;
  } catch (error) {
    console.error('Failed to move file to trash:', error);
    return false;
  }
});

// adjust pathname to ensure its safe
ipcMain.handle('normalizePath', async (event, filepath) => {
  try {
    // Normalize the file path
    const normalizedPath = path.normalize(filepath);
    return normalizedPath;
  } catch (error) {
    console.error('Failed to normalize:', error);
    return '';
  }
});

// get the playlist information
ipcMain.handle('ytdlp:playlist:info', async (e, videoUrl) => {
  try {
    const info = await YTDLP.getPlaylistInfo({
      url: videoUrl.url,
      //ytdlpDownloadDestination: os.tmpdir(),
      // ffmpegDownloadDestination: os.tmpdir(),
    });
    return info;
  } catch (error) {
    console.error('Error fetching playlist info:', error);
    throw error; // Propagate the error to the renderer process
  }
});

// get the video information
ipcMain.handle('ytdlp:info', async (e, url) => {
  YTDLP.Config.log = true;
  try {
    const info = await YTDLP.getInfo(url);
    if (!info) {
      throw new Error('No info returned from YTDLP.getInfo');
    }
    console.log(info);
    return info;
  } catch (error) {
    console.error('Error fetching video info:', error);
    return { error: error.message };
  }
});

// after identifying ID kill/stop the id
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function killControllerById(id: any) {
  try {
    const controller = YTDLP.getTerminalFromID(id);

    if (controller) {
      controller.kill();
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error(`Failed to kill controller with ID ${id}:`, error);
    return false;
  }
}

// get the terminal or controller of the download to stop, then call killControllerById
ipcMain.handle('ytdlp:stop', (e, id: string) => {
  try {
    const terminal = YTDLP.getTerminalFromID(id);
    if (!terminal) {
      return false;
    }
    terminal.kill('SIGKILL');
    return true;
  } catch (error) {
    return false;
  }
});

// Listen for the kill-controller event from the renderer
ipcMain.handle('kill-controller', async (_, id) => {
  return killControllerById(id); // Call the function and return the result
});

// download video from link
ipcMain.handle('ytdlp:download', async (e, id, args) => {
  try {
    const controller = await YTDLP.download({
      // args needed for download
      args: {
        url: args.url,
        output: args.outputFilepath,
        videoFormat: args.videoFormat,
        remuxVideo: args.remuxVideo,
        audioFormat: args.audioExt,
        audioQuality: args.audioFormatId,
        limitRate: args.limitRate,
      },
    });

    if (!controller || typeof controller.listen !== 'function') {
      throw new Error(
        'Controller is not defined or does not have a listen method',
      );
    }
    // Send the controller ID back to the renderer process
    e.sender.send(`ytdlp:controller:${id}`, {
      downloadId: id,
      controllerId: controller.id,
    });

    for await (const chunk of controller.listen()) {
      // Send the download status back to the renderer process
      e.sender.send(`ytdlp:download:status:${id}`, chunk);
      console.log(chunk);

      if (chunk != null) {
        if (chunk.data.status === 'finished') {
          console.log('Download complete, updating tray icon...');
          setAlertTrayIcon();

          // Notify the main process about the finished download
          const win = BrowserWindow.getAllWindows()[0];
          if (win) {
            win.webContents.send('download-finished', {
              name: args.name,
              id: id,
              location: args.outputFilepath,
            });
          }
        }
      }
    }
    // Return the download ID and controller ID
    return { downloadId: id, controllerId: controller.id };
  } catch (error) {
    console.error('Error during download:', error);
    e.sender.send(`ytdlp:download:error:${id}`, error.message);
    throw error; // Ensure the error is propagated
  }
});

// once the app opens
app.on('ready', async () => {
  createWindow();
  createTray();
  updateCloseHandler();

  // Check for updates when app starts
  setTimeout(async () => {
    const updateInfo = await checkForUpdates();
    if (updateInfo.hasUpdate) {
      BrowserWindow.getAllWindows().forEach((win) =>
        win.webContents.send('update-available', updateInfo),
      );
    }
  }, 5000); // Check after 5 seconds to not slow startup

  // Set up periodic update checking
  const UPDATE_CHECK_INTERVAL = 1000 * 60 * 60 * 4; // Check every 4 hours
  setInterval(async () => {
    const updateInfo = await checkForUpdates();
    if (updateInfo.hasUpdate) {
      BrowserWindow.getAllWindows().forEach((win) =>
        win.webContents.send('update-available', updateInfo),
      );
    }
  }, UPDATE_CHECK_INTERVAL);

  // Create plugin manager instance
  pluginManager = new PluginManager();

  // Load plugins
  await pluginManager.loadPlugins();

  // Set up IPC handlers AFTER app is ready
  pluginManager.setupIPC();

  // Register a custom protocol with better security
  protocol.registerFileProtocol('app-image', (request, callback) => {
    try {
      const filePath = decodeURIComponent(
        request.url.slice('app-image://'.length),
      );

      // Security check: Validate the file exists and is an image
      if (!fs.existsSync(filePath)) {
        throw new Error('File does not exist');
      }

      // Check file extension to ensure it's an image
      const ext = path.extname(filePath).toLowerCase();
      const allowedExtensions = [
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.webp',
        '.bmp',
        '.svg',
      ];

      if (!allowedExtensions.includes(ext)) {
        throw new Error('Not an allowed image type');
      }

      return callback(filePath);
    } catch (error) {
      console.error('Error in protocol handler:', error);
      // Return a placeholder or error image instead
      callback({ path: path.join(__dirname, 'assets', 'error-image.png') });
    }
  });

  // Listen for plugin state changes
  ipcMain.on('plugins:stateChanged', (event, { pluginId, enabled }) => {
    // Update the registry's knowledge of enabled plugins
    pluginRegistry.updateEnabledStates(pluginManager.getEnabledPlugins());
  });

  // Initial loading of enabled states into the registry
  pluginRegistry.updateEnabledStates(pluginManager.getEnabledPlugins());
});

// Change this to keep app running in background
app.on('window-all-closed', () => {
  // Do nothing here to keep app running when windows are closed
  // Note: macOS has its own behavior for this already
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow?.show();
  }

  // Reset the tray icon when the app is activated
  resetTrayIcon();
});

// before-quit' handler to properly set force quit
app.on('before-quit', () => {
  forceQuit = true;
});

// function to handle the dev tools or console open
ipcMain.on('toggle-dev-tools', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    } else {
      win.webContents.openDevTools();
    }
  }
});

// allows right click functions
ipcMain.on('show-input-context-menu', (event) => {
  const menu = Menu.buildFromTemplate([
    { label: 'Cut', role: 'cut' },
    { label: 'Copy', role: 'copy' },
    { label: 'Paste', role: 'paste' },
    { type: 'separator' },
    { label: 'Select All', role: 'selectAll' },
  ]);

  const win = BrowserWindow.fromWebContents(event.sender);
  menu.popup({ window: win });
});

// opening external link
ipcMain.handle('openExternalLink', async (_event, link: string) => {
  try {
    await shell.openExternal(link);
  } catch (error) {
    console.error('Failed to open external link:', error);
    throw error;
  }
});

ipcMain.handle('ensureDirectoryExists', async (event, dirPath) => {
  try {
    try {
      await fs.promises.access(dirPath, fs.constants.F_OK);
      return true; // Directory already exists
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.promises.mkdir(dirPath, { recursive: true });
      return true;
    }
  } catch (error) {
    console.error('Error creating directory:', error);
    return false;
  }
});

// check for download updates
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

// function for showing window by opening it
ipcMain.handle('show-window', () => {
  if (mainWindow) {
    mainWindow.show();
    resetTrayIcon(); // Reset icon when window is explicitly shown
    return true;
  }
  return false;
});

// function for hiding window not close it
ipcMain.handle('hide-window', () => {
  if (mainWindow) {
    mainWindow.hide();
    return true;
  }
  return false;
});

// function for forcibly closing the app
ipcMain.handle('exit-app', () => {
  forceQuit = true;
  app.quit();
});

// function for running the appolication in the background
ipcMain.handle('set-run-in-background', (_event, value) => {
  console.log('Main process received runInBackground:', value);
  runInBackgroundSetting = value;
  updateCloseHandler();
  return true;
});

// function for getting the current behaviour of run in the background
ipcMain.handle('get-run-in-background', () => {
  return runInBackgroundSetting;
});

// function for handling how the close button reacts
function updateCloseHandler() {
  if (!mainWindow) return;

  // Remove existing listeners
  mainWindow.removeAllListeners('close');

  // Add the updated handler
  mainWindow.on('close', async (event) => {
    if (!forceQuit) {
      // Get the real-time setting
      const shouldRunInBackground = await getRunInBackgroundSetting();
      console.log('Window closing, checking setting:', shouldRunInBackground);

      if (shouldRunInBackground) {
        event.preventDefault();
        mainWindow?.hide();
        return false;
      }
    }
  });
}

// Use a function to get the current setting instead of a variable
async function getRunInBackgroundSetting() {
  return runInBackgroundSetting;
}

// function for syncing settings on startup
ipcMain.handle('sync-background-setting-on-startup', (_event, value) => {
  console.log('Syncing background setting on startup:', value);
  runInBackgroundSetting = value;
  return true;
});

// function for update the download-finished handler to also change the tray icon
ipcMain.on('download-finished', (_event, downloadInfo) => {
  const { name } = downloadInfo;

  // Show notification
  showNotification(
    'Download Complete',
    `"${name}" has finished downloading`,
    () => {
      // Show the app window when notification is clicked
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        resetTrayIcon(); // Reset icon when app is shown via notification
      }
    },
  );

  // Change the tray icon to the alert version
  setAlertTrayIcon();
});

// function to display notifications
function showNotification(title: string, body: string, onClick?: () => void) {
  // Check if notifications are supported
  if (!Notification.isSupported()) {
    console.log('Notifications not supported on this system');
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

// Function to get file size
ipcMain.handle('get-file-size', async (_event, filePath) => {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.size; // Returns size in bytes
  } catch (error) {
    console.error('Error getting file size:', error);
    return null;
  }
});

// Add IPC handlers for plugin management
/*
ipcMain.handle('plugins:list', () => {
  return pluginManager.getPlugins();
});

ipcMain.handle('plugins:install', async (_event, pluginPath) => {
  return await pluginManager.installPlugin(pluginPath);
});

ipcMain.handle('plugins:uninstall', async (_event, pluginId) => {
  return await pluginManager.unloadPlugin(pluginId);
});
*/
// Add a handler to get plugin menu items
ipcMain.handle('plugins:menu-items', (event, context) => {
  return pluginRegistry.getMenuItems(context);
});

/*ipcMain.handle('plugins:loadUnzipped', async (_event, pluginDirPath) => {
  return await pluginManager.loadUnzippedPlugin(pluginDirPath);
});
*/
ipcMain.handle('plugins:execute-menu-item', (event, id, contextData) => {
  console.log('Executing menu item action:', id, contextData);
  pluginRegistry.executeMenuItemAction(id, contextData);
  return true;
});

ipcMain.handle('plugins:register-menu-item', (event, menuItem) => {
  console.log('Main process registering menu item:', menuItem);
  return pluginRegistry.registerMenuItem(menuItem);
});

ipcMain.handle('plugins:unregister-menu-item', (event, id) => {
  console.log('Main process unregistering menu item:', id);
  pluginRegistry.unregisterMenuItem(id);
  return true;
});

ipcMain.handle('plugins:get-data-path', (event, pluginId) => {
  const pluginDataDir = path.join(
    app.getPath('userData'),
    'plugin-data',
    pluginId,
  );
  // Ensure the directory exists
  if (!fs.existsSync(pluginDataDir)) {
    fs.mkdirSync(pluginDataDir, { recursive: true });
  }
  return pluginDataDir;
});

// Update the reload handler
ipcMain.handle('plugins:reload', async (event) => {
  console.log('Reloading plugins...');

  // Clear existing registry items before reloading
  pluginRegistry.clearAllRegistrations();

  // Only reload the plugins from disk, don't re-setup IPC handlers
  await pluginManager.loadPlugins();

  // Notify renderer that plugins have been reloaded
  event.sender.send('plugins:reloaded');

  return true;
});

// When uninstalling a specific plugin
ipcMain.handle('plugins:uninstall', async (event, pluginId) => {
  // Clear registrations specific to this plugin
  pluginRegistry.clearAllRegistrations(pluginId);

  const success = await pluginManager.unloadPlugin(pluginId);
  if (success) {
    await pluginManager.loadPlugins();
    event.sender.send('plugins:reloaded');
  }
  return success;
});

ipcMain.handle('plugins:loadUnzipped', async (event, pluginDirPath) => {
  if (!pluginManager) {
    console.error('Plugin manager not initialized');
    return false;
  }
  return await pluginManager.loadUnzippedPlugin(pluginDirPath);
});

// Add this near your other ipcMain handlers
ipcMain.handle('downloadFile', async (_event, url, outputPath) => {
  try {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);
      https
        .get(url, (response) => {
          response.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve({ success: true, path: outputPath });
          });
        })
        .on('error', (err) => {
          fs.unlink(outputPath, (unlinkErr) => {
            // Ignoring deletion errors since the download already failed
            if (unlinkErr)
              console.error('Failed to delete incomplete file:', unlinkErr);
          });
          reject({ success: false, error: err.message });
        });
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    return { success: false, error: error.message };
  }
});

// Add this near your other ipcMain handlers
ipcMain.handle('get-thumbnail-data-url', async (_event, imagePath) => {
  try {
    if (!fs.existsSync(imagePath)) {
      return null;
    }

    // Read the file as a buffer
    const buffer = await fs.promises.readFile(imagePath);

    // Determine MIME type based on file extension
    const ext = path.extname(imagePath).toLowerCase();
    let mimeType = 'image/jpeg'; // Default

    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';

    // Convert to base64 and return as data URL
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Error creating thumbnail data URL:', error);
    return null;
  }
});

// In main.ts or wherever you set up your IPC handlers
ipcMain.handle('plugins:save-file-dialog', async (event, options) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);

  // Security check: validate options
  const sanitizedOptions = {
    title: typeof options.title === 'string' ? options.title : 'Save File',
    defaultPath:
      typeof options.defaultPath === 'string'
        ? options.defaultPath
        : app.getPath('downloads'),
    filters: Array.isArray(options.filters) ? options.filters : undefined,
    message: typeof options.message === 'string' ? options.message : undefined,
  };

  try {
    const result = await dialog.showSaveDialog(browserWindow, sanitizedOptions);
    return result;
  } catch (error) {
    console.error('Error showing save dialog:', error);
    return { canceled: true };
  }
});

// Add these new IPC handlers for taskbar items
ipcMain.handle('plugins:register-taskbar-item', (event, taskBarItem) => {
  console.log('Main process registering taskbar item:', taskBarItem);
  return pluginRegistry.registerTaskBarItem(taskBarItem);
});

ipcMain.handle('plugins:unregister-taskbar-item', (event, id) => {
  console.log('Main process unregistering taskbar item:', id);
  pluginRegistry.unregisterTaskBarItem(id);
  return true;
});

ipcMain.handle('plugins:taskbar-items', (event) => {
  return pluginRegistry.getTaskBarItems();
});

ipcMain.handle('plugins:execute-taskbar-item', (event, id, contextData) => {
  console.log('Executing taskbar item action:', id, contextData);
  pluginRegistry.executeTaskBarItemAction(id, contextData);
  return true;
});

// Add this with the other plugin-related IPC handlers
ipcMain.handle('plugin:fs:readFile', async (event, options) => {
  try {
    const { filePath, pluginId } = options;

    // Security check: Make sure we're not reading outside allowed directories
    // You might want to add additional validation here

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File does not exist' };
    }

    const fileContents = await fs.promises.readFile(filePath, 'utf8');
    return { success: true, data: fileContents };
  } catch (error) {
    console.error('Error reading file:', error);
    return { success: false, error: error.message };
  }
});

// Add this with the other plugin-related IPC handlers
ipcMain.handle('plugin:readFileContents', async (event, { options }) => {
  try {
    const { filePath, pluginId } = options;
    console.log('got this', options);
    // Security check: Make sure we're not reading outside allowed directories
    // Get the plugin's data directory as a safe base path
    const pluginDataDir = path.join(
      app.getPath('userData'),
      'plugin-data',
      pluginId || '',
    );

    // Ensure the requested path is within the plugin's data directory or another safe location
    const normalizedPath = path.normalize(filePath);
    if (
      !normalizedPath.startsWith(pluginDataDir) &&
      !normalizedPath.startsWith(app.getPath('downloads'))
    ) {
      return {
        success: false,
        error: 'Access denied: Path is outside allowed directories',
      };
    }

    if (!fs.existsSync(normalizedPath)) {
      return { success: false, error: 'File does not exist' };
    }

    const fileContents = await fs.promises.readFile(normalizedPath, 'utf8');
    console.log(fileContents);
    return { success: true, data: fileContents };
  } catch (error) {
    console.error('Error reading file contents:', error);
    return { success: false, error: error.message };
  }
});

// Handle closing the plugin panel
ipcMain.handle('plugins:close-panel', async () => {
  try {
    // Send an event to the renderer to close the panel
    mainWindow.webContents.send('plugin:close-panel');
    return { success: true };
  } catch (error) {
    console.error('Error closing plugin panel:', error);
    return { success: false, error: error.message };
  }
});

// Add this handler to get version without GitHub API call
ipcMain.handle('get-current-version', async () => {
  // Get version from package.json or app.getVersion()
  return app.getVersion();
});
