/**
 * Main process entry point for the Electron application.
 * This file is responsible for creating the main application window,
 * handling IPC (Inter-Process Communication) events, and managing
 * application lifecycle events.
 */
import {
  app,
  BrowserWindow,
  clipboard,
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

/*
// Rate limiting for GitHub API calls
const GITHUB_API_COOLDOWN = 5 * 60 * 1000; // 5 minutes between API calls
let lastGitHubApiCall = 0;
let cachedLatestVersion: { version: string; timestamp: number } | null = null;
const VERSION_CACHE_DURATION = 30 * 60 * 1000; // Cache for 30 minutes

// Helper function to check if we can make a GitHub API call
function canMakeGitHubApiCall(): boolean {
  const now = Date.now();
  return now - lastGitHubApiCall >= GITHUB_API_COOLDOWN;
}

// Helper function to get cached version if still valid
function getCachedVersion(): string | null {
  if (!cachedLatestVersion) return null;

  const now = Date.now();
  const isExpired =
    now - cachedLatestVersion.timestamp > VERSION_CACHE_DURATION;

  return isExpired ? null : cachedLatestVersion.version;
}
*/
// Function to create the main application window
const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1250,
    height: 680,
    frame: false,
    autoHideMenuBar: true,
    minWidth: 900,
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

  // Add focus tracking for clipboard monitoring
  mainWindow.on('focus', () => {
    isWindowFocused = true;
    console.log('Window focused - clipboard monitoring paused');
  });

  mainWindow.on('blur', () => {
    isWindowFocused = false;
    console.log('Window unfocused - clipboard monitoring resumed');
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
        // Set to BLANK_STATE before quitting
        lastClipboardText = 'BLANK_STATE';
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
    tray.setImage(alertTrayIcon);
    isDownloadComplete = true;
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

ipcMain.handle('deleteFolder', async (event, filepath) => {
  try {
    // Normalize the folder path
    const normalizedPath = path.normalize(filepath);

    // Check if the folder exists
    if (!fs.existsSync(normalizedPath)) {
      console.error('Folder does not exist:', normalizedPath);
      return false;
    }

    // Check if it's actually a directory
    const stats = await fs.promises.stat(normalizedPath);
    if (!stats.isDirectory()) {
      console.error('Path is not a directory:', normalizedPath);
      return false;
    }

    // Move the folder to trash
    await shell.trashItem(normalizedPath);
    return true;
  } catch (error) {
    console.error('Failed to move folder to trash:', error);
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
    return info;
  } catch (error) {
    console.error('Error fetching video info:', error);
    return { error: error.message };
  }
});

/*
// Get current YT-DLP version
ipcMain.handle('ytdlp:getCurrentVersion', async () => {
  try {
    const version = await YTDLP.getYTDLPVersion();
    return { success: true, version };
  } catch (error) {
    console.error('Error getting current YT-DLP version:', error);
    return { success: false, error: error.message, version: null };
  }
});

// Get latest YT-DLP version
ipcMain.handle('ytdlp:getLatestVersion', async () => {
  try {
    // Check if we have a cached version first
    const cachedVersion = getCachedVersion();
    if (cachedVersion) {
      console.log('Using cached YT-DLP version:', cachedVersion);
      return {
        success: true,
        version: cachedVersion,
        message: 'Retrieved from cache',
      };
    }

    // Check rate limiting
    if (!canMakeGitHubApiCall()) {
      const remainingTime = Math.ceil(
        (GITHUB_API_COOLDOWN - (Date.now() - lastGitHubApiCall)) / 1000,
      );
      return {
        success: false,
        error: `Rate limited. Please wait ${remainingTime} seconds before checking again.`,
        version: null,
      };
    }

    // Make the API call
    lastGitHubApiCall = Date.now();
    const response = await YTDLP.getLatestYTDLPVersionFromGitHub();

    // Cache the result if successful
    if (response.ok && response.version) {
      cachedLatestVersion = {
        version: response.version,
        timestamp: Date.now(),
      };
    }

    return {
      success: response.ok,
      version: response.version,
      message: response.message,
    };
  } catch (error) {
    console.error('Error getting latest YT-DLP version:', error);

    // Check if it's a rate limit error
    if (error.message && error.message.includes('403')) {
      return {
        success: false,
        error:
          'GitHub API rate limit exceeded. Please wait an hour before trying again.',
        version: null,
      };
    }

    return { success: false, error: error.message, version: null };
  }
});

// Check and update YT-DLP
ipcMain.handle('ytdlp:checkAndUpdate', async () => {
  try {
    const currentVersion = await YTDLP.getYTDLPVersion();

    // Check if we have a cached version first
    let latestVersion = getCachedVersion();
    let latestResponse;

    if (!latestVersion) {
      // Check rate limiting
      if (!canMakeGitHubApiCall()) {
        const remainingTime = Math.ceil(
          (GITHUB_API_COOLDOWN - (Date.now() - lastGitHubApiCall)) / 1000,
        );
        return {
          success: false,
          error: `Rate limited. Please wait ${remainingTime} seconds before checking again.`,
          action: 'error',
        };
      }

      // Make the API call
      lastGitHubApiCall = Date.now();
      latestResponse = await YTDLP.getLatestYTDLPVersionFromGitHub();

      if (!latestResponse.ok || !latestResponse.version) {
        // Check if it's a rate limit error
        if (latestResponse.message && latestResponse.message.includes('403')) {
          throw new Error(
            'GitHub API rate limit exceeded. Please wait an hour before trying again.',
          );
        }
        throw new Error(
          latestResponse.message || 'Failed to get latest version',
        );
      }

      latestVersion = latestResponse.version;

      // Cache the result
      cachedLatestVersion = {
        version: latestVersion,
        timestamp: Date.now(),
      };
    }

    if (!currentVersion) {
      console.log('YT-DLP not found. Downloading latest version...');
      await YTDLP.downloadYTDLP();
      return {
        success: true,
        action: 'downloaded',
        message: 'YT-DLP was not found and has been downloaded.',
        currentVersion: null,
        latestVersion,
      };
    }

    console.log(`Current version: ${currentVersion}`);
    console.log(`Latest version: ${latestVersion}`);

    if (latestVersion && currentVersion !== latestVersion) {
      console.log('Updating YT-DLP to latest version...');
      await YTDLP.downloadYTDLP({
        version: latestVersion,
        forceDownload: true,
      });
      console.log('Update completed!');
      return {
        success: true,
        action: 'updated',
        message: `YT-DLP updated from ${currentVersion} to ${latestVersion}`,
        currentVersion,
        latestVersion,
      };
    } else {
      console.log('YT-DLP is up to date!');
      return {
        success: true,
        action: 'up-to-date',
        message: 'YT-DLP is already up to date',
        currentVersion,
        latestVersion,
      };
    }
  } catch (error) {
    console.error('Error managing YT-DLP version:', error);
    return {
      success: false,
      error: error.message,
      action: 'error',
      message: `Error managing YT-DLP version: ${error.message}`,
    };
  }
});

// Download YTDLP binary with custom options
ipcMain.handle('ytdlp:downloadYTDLP', async (_event, options = {}) => {
  try {
    console.log('YTDLP download options:', options);

    const downloadOptions: DownloadOptions = {
      forceDownload: options.forceDownload || false,
    };

    // Handle filePath - if it's provided, ensure it's a proper file path
    if (options.filePath && options.filePath.trim()) {
      const filePath = options.filePath.trim();

      // Check if the path is a directory (doesn't end with an executable extension)
      if (
        !path.extname(filePath) ||
        path.extname(filePath).toLowerCase() !== '.exe'
      ) {
        // If it's a directory or doesn't have .exe extension, append the default filename
        const defaultFilename =
          process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
        downloadOptions.filePath = path.join(filePath, defaultFilename);
      } else {
        downloadOptions.filePath = filePath;
      }
    }
    // If no filePath provided, let YTDLP use its default location

    // Handle version
    if (
      options.version &&
      options.version.trim() &&
      options.version.trim().toLowerCase() !== 'latest'
    ) {
      downloadOptions.version = options.version.trim();
    }
    // If no version provided or 'latest', let YTDLP use latest

    // Handle platform
    if (options.platform && options.platform !== 'auto') {
      downloadOptions.platform = options.platform;
    }
    // If no platform provided or 'auto', let YTDLP auto-detect

    console.log('Final YTDLP download options:', downloadOptions);

    await YTDLP.downloadYTDLP(downloadOptions);
    return { success: true };
  } catch (error) {
    console.error('Error downloading YTDLP:', error);
    return { success: false, error: error.message };
  }
});
*/
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

    // Set up process completion detection WITHOUT interfering with the main stream
    let processCompletionHandled = false;
    let completeLog = ''; // Collect all logs here

    if (controller.process) {
      const handleProcessCompletion = (
        code: number,
        signal: string,
        eventType: string,
      ) => {
        if (processCompletionHandled) return; // Prevent duplicate handling
        processCompletionHandled = true;

        const completionMessage = `Process '${controller.id}' ${eventType} with code: ${code}, signal: ${signal}`;

        // Add completion message to complete log
        completeLog += `\n${completionMessage}`;

        // Send completion with complete log after a small delay to ensure all other logs are processed first
        setTimeout(() => {
          e.sender.send(`ytdlp:download:status:${id}`, {
            type: 'completion',
            data: {
              log: completionMessage,
              completeLog: completeLog, // Send complete log
              exitCode: code,
              signal: signal,
              controllerId: controller.id,
            },
          });
        }, 100); // Small delay to ensure stream logs are processed first
      };

      controller.process.on('exit', (code: number, signal: string) => {
        handleProcessCompletion(code, signal, 'exited');
      });

      controller.process.on('close', (code: number, signal: string) => {
        // Only handle close if exit wasn't already handled
        if (!processCompletionHandled) {
          handleProcessCompletion(code, signal, 'closed');
        }
      });
    } else {
      console.log(
        `⚠️ Controller ${controller.id} does not expose process - will rely on stream completion`,
      );
    }

    // Process the main download stream normally
    for await (const chunk of controller.listen()) {
      // Collect ALL logs in the main process
      if (chunk?.data?.log) {
        completeLog += chunk.data.log; // Add to complete log
      }

      // Send chunks normally for progress updates, but also include complete log so far
      const enhancedChunk = {
        ...chunk,
        completeLog: completeLog, // Add complete log to every chunk
      };
      e.sender.send(`ytdlp:download:status:${id}`, enhancedChunk);

      // Handle download completion notifications
      if (chunk != null && chunk.data && chunk.data.status === 'finished') {
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
    // If process completion wasn't handled through events, send a fallback after delay
    setTimeout(() => {
      if (!processCompletionHandled) {
        e.sender.send(`ytdlp:download:status:${id}`, {
          type: 'stream_ended',
          data: {
            log: `Process '${controller.id}' stream completed`,
            controllerId: controller.id,
          },
        });
      }
    }, 2000); // Wait 2 seconds after stream ends

    // Return the download ID and controller ID
    return { downloadId: id, controllerId: controller.id };
  } catch (error) {
    e.sender.send(`ytdlp:download:error:${id}`, error.message);
    throw error; // Ensure the error is propagated
  }
});

// Add clipboard monitoring IPC handlers
ipcMain.handle('get-clipboard-text', () => {
  return clipboard.readText();
});

// Add IPC handlers to control clipboard monitoring
ipcMain.handle('start-clipboard-monitoring', () => {
  startClipboardMonitoring();
  return true;
});

ipcMain.handle('stop-clipboard-monitoring', () => {
  stopClipboardMonitoring();
  return true;
});

ipcMain.handle('is-clipboard-monitoring-active', () => {
  return isMonitoring;
});

// Add IPC handler to check window focus state
ipcMain.handle('is-window-focused', () => {
  return isWindowFocused;
});

// Add IPC handler to clear last clipboard text
ipcMain.handle('clear-last-clipboard-text', () => {
  lastClipboardText = 'BLANK_STATE';
  return true;
});

// Add IPC handler to actually clear the clipboard
ipcMain.handle('clear-clipboard', () => {
  try {
    clipboard.writeText('');
    lastClipboardText = 'BLANK_STATE';
    return true;
  } catch (error) {
    return false;
  }
});

// Set up clipboard monitoring
let clipboardInterval: NodeJS.Timeout | null = null;
let lastClipboardText = 'BLANK_STATE';
let isMonitoring = false;
// Add focus tracking variable
let isWindowFocused = false;

const startClipboardMonitoring = () => {
  if (clipboardInterval) {
    clearInterval(clipboardInterval);
  }

  isMonitoring = true;
  // Set internal state to BLANK_STATE for fallback tracking
  lastClipboardText = 'BLANK_STATE';

  // Actually clear the clipboard by writing an empty string
  try {
    clipboard.writeText('');
  } catch (error) {
    console.log(
      'Could not clear clipboard, using BLANK_STATE fallback:',
      error,
    );
  }

  // Function to start the monitoring interval with appropriate timing
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

  // Add a small delay to prevent immediate detection of current clipboard content
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

// App lifecycle events

// once the app opens
app.on('ready', async () => {
  createWindow();
  createTray();
  updateCloseHandler();

  // Start clipboard monitoring
  // Don't start automatically - let the renderer control it
  // startClipboardMonitoring();

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  stopClipboardMonitoring();
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
  // Set to BLANK_STATE before quitting
  lastClipboardText = 'BLANK_STATE';
  app.quit();
});

// function for running the appolication in the background
ipcMain.handle('set-run-in-background', (_event, value) => {
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
  pluginRegistry.executeMenuItemAction(id, contextData);
  return true;
});

ipcMain.handle('plugins:register-menu-item', (event, menuItem) => {
  //console.log('Main process registering menu item:', menuItem);
  return pluginRegistry.registerMenuItem(menuItem);
});

ipcMain.handle('plugins:unregister-menu-item', (event, id) => {
  //console.log('Main process unregistering menu item:', id);
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
    return { canceled: true };
  }
});

// Add these new IPC handlers for taskbar items
ipcMain.handle('plugins:register-taskbar-item', (event, taskBarItem) => {
  //console.log('Main process registering taskbar item:', taskBarItem);
  return pluginRegistry.registerTaskBarItem(taskBarItem);
});

ipcMain.handle('plugins:unregister-taskbar-item', (event, id) => {
  //console.log('Main process unregistering taskbar item:', id);
  pluginRegistry.unregisterTaskBarItem(id);
  return true;
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
ipcMain.handle('plugins:taskbar-items', (event) => {
  return pluginRegistry.getTaskBarItems();
});

ipcMain.handle('plugins:execute-taskbar-item', (event, id, contextData) => {
  console.log('Executing taskbar item action:', id, contextData);
  pluginRegistry.executeTaskBarItemAction(id, contextData);
  return true;
});

ipcMain.handle('plugin:fs:readFile', async (event, options) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // Security check: Make sure we're not reading outside allowed directories
    // Get the plugin's data directory as a safe base path
    const pluginDataDir = path.join(
      app.getPath('userData'),
      'plugin-data',
      pluginId || '',
    );

    // Ensure the requested path is within the plugin's data directory or another safe location
    // Normalize the path to fix double backslashes caused by JSON.stringify/parse
    let adjustedPath;
    if (typeof filePath === 'string') {
      // Replace any escaped backslashes (\\) with single backslashes (\)
      adjustedPath = filePath.replace(/\\\\/g, '\\');
    }

    const normalizedPath = path.normalize(adjustedPath);
    const resolvedPath = path.resolve(normalizedPath);

    if (!fs.existsSync(resolvedPath)) {
      console.log('file doesnt exist');
      return { success: false, error: 'File does not exist' };
    }
    console.log('path given to read:', resolvedPath);

    const fileContents = await fs.promises.readFile(resolvedPath, 'utf8');
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
