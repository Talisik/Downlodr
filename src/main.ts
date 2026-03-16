/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Main process entry point for the Electron application.
 * This file is responsible for creating the main application window,
 * handling IPC (Inter-Process Communication) events, and managing
 * application lifecycle events.
 */
import 'dotenv/config';
import { execSync } from 'child_process';
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
import http from 'http';
import https from 'https';
import os from 'os';
import path from 'path';
import * as YTDLP from 'yt-dlp-helper';
import { PluginManager } from './plugins/pluginManager';
import { pluginRegistry } from './plugins/registry';
import { DownloadOptions } from './Schema/ytdlp';
import { checkForUpdates } from './services/update/updateService';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Disable Chrome sandbox for development to avoid permission issues
// Remove this in production builds
if (process.env.NODE_ENV === 'development' || process.env.ELECTRON_DISABLE_SANDBOX === '1') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-setuid-sandbox');
  console.log('🛡️  Chrome sandbox disabled for development');
}

// Fix /dev/shm shared memory issues (common on Linux)
app.commandLine.appendSwitch('disable-dev-shm-usage');
console.log('🔧 Disabled /dev/shm usage to prevent shared memory errors');

// Add FFmpeg binaries to PATH so yt-dlp can find them
// This must be done BEFORE any yt-dlp operations
(() => {
  let ffmpegDir: string;
  
  if (app.isPackaged) {
    // Production: Use bundled binaries from resources/bin
    ffmpegDir = path.join(process.resourcesPath, 'bin');
  } else {
    // Development: Use binaries from project directory
    ffmpegDir = path.join(process.cwd(), 'binaries', 'linux');
  }

  // Add to beginning of PATH so our binaries are found first
  const currentPath = process.env.PATH || '';
  process.env.PATH = `${ffmpegDir}${path.delimiter}${currentPath}`;
  
  console.log('🔧 Added FFmpeg directory to PATH:', ffmpegDir);
  console.log('🔧 FFmpeg should now be available for yt-dlp merging');
})();

// Prevent multiple instances of the app
const isSingleInstance = app.requestSingleInstanceLock();

if (!isSingleInstance) {
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

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let forceQuit = false;
let runInBackgroundSetting = true;
let pluginManager: PluginManager;

let normalTrayIcon: Electron.NativeImage;
let alertTrayIcon: Electron.NativeImage;
let isDownloadComplete = false;

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

/**
 * Checks if internet connectivity is available
 * Makes an actual HTTPS request to verify real connectivity (more reliable than DNS-only check)
 * @param timeout - Maximum time to wait for check in milliseconds (default: 5000)
 * @returns Promise<boolean> - true if online, false if offline
 */
async function isOnline(timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const timeoutHandle = setTimeout(() => {
      console.log('Internet connectivity check timed out');
      resolve(false);
    }, timeout);

    // Try to make an actual HTTPS request to a reliable endpoint
    // This is more reliable than just DNS resolution
    const req = https.request(
      {
        hostname: 'www.google.com',
        port: 443,
        path: '/favicon.ico',
        method: 'HEAD', // HEAD request is lighter than GET
        timeout: timeout,
      },
      (res) => {
        clearTimeout(timeoutHandle);
        console.log(
          'Internet connectivity check succeeded with status:',
          res.statusCode,
        );
        resolve(true);
      },
    );

    req.on('error', (err) => {
      clearTimeout(timeoutHandle);
      const errorMessage =
        err && typeof err === 'object' && 'code' in err
          ? (err as { code?: string; message?: string }).code || err.message
          : err.message || String(err);
      console.log('Internet connectivity check failed:', errorMessage);
      resolve(false);
    });

    req.on('timeout', () => {
      clearTimeout(timeoutHandle);
      console.log('Internet connectivity check timed out');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Function to create the main application window
const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1350,
    height: 680,
    frame: false,
    autoHideMenuBar: true,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      // Disable sandbox for development to avoid chrome-sandbox permission issues
      sandbox: false,
      nodeIntegration: true,
      // devTools: false,
    },
  });
  if (mainWindow) {
    if (
      process.env.NODE_ENV === 'development' &&
      MAIN_WINDOW_VITE_DEV_SERVER_URL
    ) {
      mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      );

      // 🚫 Remove all default menus so "View → Toggle Developer Tools" disappears
      Menu.setApplicationMenu(null);

      // 🚫 Block keyboard shortcuts
      mainWindow.webContents.on('before-input-event', (event, input) => {
        if (
          (input.control && input.shift && input.key.toLowerCase() === 'i') || // Ctrl+Shift+I
          input.key === 'F12' || // F12
          (process.platform === 'darwin' &&
            input.meta &&
            input.alt &&
            input.key.toLowerCase() === 'i') // Cmd+Opt+I
        ) {
          event.preventDefault();
        }
      });

      // 🚫 If DevTools somehow open, force-close them
      mainWindow.webContents.on('devtools-opened', () => {
        mainWindow?.webContents.closeDevTools();
      });

      // 🚫 Disable right-click → Inspect Element
      mainWindow.webContents.on('context-menu', (e) => {
        e.preventDefault();
      });
    }

    // Handle window close events - hide instead of close
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

    // Focus tracking for clipboard monitoring
    mainWindow.on('focus', () => {
      isWindowFocused = true;
      // console.log('Window focused - clipboard monitoring paused');
    });

    mainWindow.on('blur', () => {
      isWindowFocused = false;
      // console.log('Window unfocused - clipboard monitoring resumed');
    });

    // Prevent navigation to external URLs
    mainWindow.webContents.on('will-navigate', (event) => {
      event.preventDefault();
    });
  }
};

// MAIN FUNCTIONS FOR TITLE BAR
ipcMain.on('close-btn', () => {
  if (!mainWindow) return;

  if (runInBackgroundSetting) {
    // If running in background is enabled, hide the window
    // console.log('Close button clicked, hiding window (background enabled)');
    mainWindow.hide();
  } else {
    // If running in background is disabled, actually quit the app
    // console.log('Close button clicked, quitting app (background disabled)');
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

const createTray = () => {
  // Get correct path based on whether in dev or production
  let iconPath, alertIconPath;

  if (process.env.NODE_ENV === 'development') {
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
      'AppLogo/systemTray/systemTray.png',
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

  // Single click on tray icon shows the app and resets the icon
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      resetTrayIcon();
    }
  });

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
    // console.error('Error determining Downloads folder:', error);
    return null;
  }
});

// Find actual file path when extension might have changed after remux
ipcMain.handle('findActualFilePath', async (_event, expectedPath) => {
  try {
    // First check if the expected path exists
    if (fs.existsSync(expectedPath)) {
      return expectedPath;
    }

    // Get directory and filename without extension
    const dir = path.dirname(expectedPath);
    const ext = path.extname(expectedPath);
    const baseName = path.basename(expectedPath, ext);

    // Common video extensions that yt-dlp might use after remux
    const possibleExtensions = ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.flv', '.m4a', '.mp3', '.opus', '.ogg', '.wav'];

    // Try each possible extension
    for (const possibleExt of possibleExtensions) {
      if (possibleExt === ext) continue; // Skip the original extension (already checked)
      
      const alternatePath = path.join(dir, baseName + possibleExt);
      if (fs.existsSync(alternatePath)) {
        console.log(`Found file with different extension: ${alternatePath} (expected: ${expectedPath})`);
        return alternatePath;
      }
    }

    // If still not found, try searching the directory for files with matching basename
    try {
      const files = fs.readdirSync(dir);
      const matchingFile = files.find(file => {
        const fileBaseName = path.basename(file, path.extname(file));
        return fileBaseName === baseName;
      });

      if (matchingFile) {
        const foundPath = path.join(dir, matchingFile);
        console.log(`Found file with pattern match: ${foundPath} (expected: ${expectedPath})`);
        return foundPath;
      }
    } catch (readDirError) {
      console.error('Error reading directory for file search:', readDirError);
    }

    // File not found
    return null;
  } catch (error) {
    console.error('Error finding actual file path:', error);
    return null;
  }
});

// Function for getting default download folder from each OS
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
      const navigatorInfo = typeof navigator !== 'undefined' ? navigator : null;

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

// Handler to check internet connectivity
ipcMain.handle('check-internet-connection', async () => {
  return await isOnline();
});

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

// Function for getting default download folder from each OS
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
      const navigatorInfo = typeof navigator !== 'undefined' ? navigator : null;

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

// Function for validating path of download location
ipcMain.handle('validatePath', async (event, folderPath) => {
  try {
    const resolvedPath = path.resolve(folderPath);

    // Check if the resolved path exists and is a directory
    const stats = await fs.promises.stat(resolvedPath);
    if (!stats.isDirectory()) {
      return false;
    }
    await fs.promises.access(
      resolvedPath,
      fs.constants.R_OK | fs.constants.W_OK,
    );

    return true;
  } catch (err) {
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

// Open file dialog to select video/audio file for transcription
ipcMain.handle('dialog:selectVideoFile', async (event) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);

  const result = await dialog.showOpenDialog(browserWindow, {
    properties: ['openFile'],
    title: 'Select Video or Audio File to Transcribe',
    filters: [
      {
        name: 'Video & Audio Files',
        extensions: [
          'mp4',
          'mkv',
          'avi',
          'mov',
          'wmv',
          'flv',
          'webm',
          'mp3',
          'wav',
          'm4a',
          'aac',
          'ogg',
          'flac',
          'wma',
        ],
      },
      {
        name: 'Video Files',
        extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'],
      },
      {
        name: 'Audio Files',
        extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'wma'],
      },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
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
    return false;
  }
});

ipcMain.handle('deleteFolder', async (event, filepath) => {
  try {
    // Normalize the folder path
    const normalizedPath = path.normalize(filepath);

    // Check if the folder exists
    if (!fs.existsSync(normalizedPath)) {
      return false;
    }

    // Check if it's actually a directory
    const stats = await fs.promises.stat(normalizedPath);
    if (!stats.isDirectory()) {
      return false;
    }

    // Move the folder to trash
    await shell.trashItem(normalizedPath);
    return true;
  } catch (error) {
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
    console.log(info);
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
    return { error: error.message };
  }
});

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

    if (latestVersion && currentVersion !== latestVersion) {
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
    // PATH is already set at app startup, so yt-dlp will find ffmpeg
    console.log(`🎬 Starting download with yt-dlp`);
    console.log(`📁 Output: ${args.outputFilepath}`);
    
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

        // completion message to complete log
        completeLog += `\n${completionMessage}`;

        // Send completion with complete log after a small delay to ensure all other logs are processed first
        setTimeout(() => {
          e.sender.send(`ytdlp:download:status:${id}`, {
            type: 'completion',
            data: {
              log: completionMessage,
              completeLog: completeLog,
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
        if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
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
    }, 2000);

    // Return the download ID and controller ID
    return { downloadId: id, controllerId: controller.id };
  } catch (error) {
    e.sender.send(`ytdlp:download:error:${id}`, error.message);
    throw error; // Ensure the error is propagated
  }
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

// set up clipboard monitoring
let clipboardInterval: NodeJS.Timeout | null = null;
let lastClipboardText = 'BLANK_STATE';
let isMonitoring = false;
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
    const online = await isOnline();
    if (!online) {
      console.log('Skipping app update check: No internet connection');
      return;
    }

    const updateInfo = await checkForUpdates();
    if (updateInfo.hasUpdate) {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
          win.webContents.send('update-available', updateInfo);
        }
      });
    }
  }, 5000); // Check after 5 seconds to not slow startup

  // Check for YT-DLP updates when app starts
  setTimeout(async () => {
    try {
      const online = await isOnline();
      if (!online) {
        console.log('Skipping YT-DLP update check: No internet connection');
        return;
      }

      console.log('Checking for YT-DLP updates on startup...');

      // Get current version first
      const currentVersion = await YTDLP.getYTDLPVersion();

      // Check if we have a cached version first
      let latestVersion = getCachedVersion();

      if (!latestVersion && canMakeGitHubApiCall()) {
        // Make the API call if we can
        lastGitHubApiCall = Date.now();
        const latestResponse = await YTDLP.getLatestYTDLPVersionFromGitHub();

        if (latestResponse.ok && latestResponse.version) {
          latestVersion = latestResponse.version;
          // Cache the result
          cachedLatestVersion = {
            version: latestVersion,
            timestamp: Date.now(),
          };
        }
      }

      // Only auto-update if we have both versions and they differ
      if (currentVersion && latestVersion && currentVersion !== latestVersion) {
        console.log(
          `Auto-updating YT-DLP from ${currentVersion} to ${latestVersion}...`,
        );
        await YTDLP.downloadYTDLP({
          version: latestVersion,
          forceDownload: true,
        });
        console.log('YT-DLP auto-update completed!');

        // Notify renderer about the update
        BrowserWindow.getAllWindows().forEach((win) => {
          if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
            win.webContents.send('ytdlp-auto-updated', {
              fromVersion: currentVersion,
              toVersion: latestVersion,
              message: `YT-DLP automatically updated from ${currentVersion} to ${latestVersion}`,
            });
          }
        });
      } else if (!currentVersion) {
        console.log('YT-DLP not found, downloading latest version...');
        await YTDLP.downloadYTDLP();
        console.log('YT-DLP downloaded successfully!');

        // Notify renderer about the installation
        BrowserWindow.getAllWindows().forEach((win) => {
          if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
            win.webContents.send('ytdlp-auto-installed', {
              version: latestVersion || 'latest',
              message: 'YT-DLP was automatically downloaded and installed',
            });
          }
        });
      } else {
        console.log(
          'YT-DLP is up to date or update check skipped due to rate limiting',
        );
      }
    } catch (error) {
      console.error('Error during automatic YT-DLP update check:', error);
      // Don't notify user about auto-update failures to avoid spam
    }
  }, 7000); // Check after 7 seconds, after app updates

  // Set up periodic update checking
  const UPDATE_CHECK_INTERVAL = 1000 * 60 * 60 * 4; // Check every 4 hours
  setInterval(async () => {
    const online = await isOnline();
    if (!online) {
      console.log('Skipping periodic update check: No internet connection');
      return;
    }

    const updateInfo = await checkForUpdates();
    if (updateInfo.hasUpdate) {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
          win.webContents.send('update-available', updateInfo);
        }
      });
    }
  }, UPDATE_CHECK_INTERVAL);
  /*
  // Set up periodic YT-DLP update checking (less frequent to respect rate limits)
  const YTDLP_UPDATE_CHECK_INTERVAL = 1000 * 60 * 60 * 12; // Check every 12 hours
  setInterval(async () => {
    try {
      if (!canMakeGitHubApiCall()) {
        console.log('Skipping periodic YT-DLP check due to rate limiting');
        return;
      }
      
      const currentVersion = await YTDLP.getYTDLPVersion();
      if (!currentVersion) return; // Skip if YT-DLP not installed
      
      lastGitHubApiCall = Date.now();
      const latestResponse = await YTDLP.getLatestYTDLPVersionFromGitHub();
      
      if (latestResponse.ok && latestResponse.version && 
          currentVersion !== latestResponse.version) {
        // Cache the result
        cachedLatestVersion = {
          version: latestResponse.version,
          timestamp: Date.now(),
        };
        
        // Don't auto-update during periodic checks, just notify
        BrowserWindow.getAllWindows().forEach((win) => {
          if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
            win.webContents.send('ytdlp-update-available', {
              currentVersion,
              latestVersion: latestResponse.version,
              message: `YT-DLP update available: ${currentVersion} → ${latestResponse.version}`,
            });
          }
        });
      }
    } catch (error) {
      console.error('Error during periodic YT-DLP update check:', error);
    }
  }, YTDLP_UPDATE_CHECK_INTERVAL);
*/
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

  // listen for plugin state changes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ipcMain.on('plugins:stateChanged', (event, { pluginId, enabled }) => {
    // update the registry's knowledge of enabled plugins
    pluginRegistry.updateEnabledStates(pluginManager.getEnabledPlugins());
  });

  // Initial loading of enabled states into the registry
  pluginRegistry.updateEnabledStates(pluginManager.getEnabledPlugins());
});

// Change this to keep app running in background
app.on('window-all-closed', () => {
  // Do nothing here to keep app running when windows are closed
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
app.on('before-quit', async () => {
  forceQuit = true;
  stopClipboardMonitoring();

  // Process any pending failed downloads before quitting
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      await mainWindow.webContents.executeJavaScript(`
        if (typeof useDownloadStore !== 'undefined') {
          const store = useDownloadStore.getState();
          if (store.checkFinishedDownloads) {
            store.checkFinishedDownloads();
          }
        }
      `);
    } catch (error) {
      console.log('Could not process failed downloads on quit:', error);
    }
  }
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

// handler to get plugin menu items
ipcMain.handle('plugins:menu-items', (event, context) => {
  return pluginRegistry.getMenuItems(context);
});

// handler to execute plugin menu items
ipcMain.handle('plugins:execute-menu-item', (event, id, contextData) => {
  pluginRegistry.executeMenuItemAction(id, contextData);
  return true;
});

// handler to register plugin menu items
ipcMain.handle('plugins:register-menu-item', (event, menuItem) => {
  //console.log('Main process registering menu item:', menuItem);
  return pluginRegistry.registerMenuItem(menuItem);
});

// handler to unregister plugin menu items
ipcMain.handle('plugins:unregister-menu-item', (event, id) => {
  //console.log('Main process unregistering menu item:', id);
  pluginRegistry.unregisterMenuItem(id);
  return true;
});

// handler to get plugin data path
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

// handler to reload plugins
ipcMain.handle('plugins:reload', async (event) => {
  // Clear existing registry items before reloading
  pluginRegistry.clearAllRegistrations();

  // Only reload the plugins from disk, don't re-setup IPC handlers
  await pluginManager.loadPlugins();

  // Notify renderer that plugins have been reloaded
  event.sender.send('plugins:reloaded');

  return true;
});

//  near your other ipcMain handlers
ipcMain.handle('downloadFile', async (_event, url, outputPath) => {
  try {
    return new Promise((resolve, reject) => {
      const downloadWithRedirects = (downloadUrl: string, maxRedirects = 5) => {
        if (maxRedirects <= 0) {
          reject({ success: false, error: 'Too many redirects' });
          return;
        }

        // Choose http or https based on URL
        const client = downloadUrl.startsWith('https:') ? https : http;

        const file = fs.createWriteStream(outputPath);

        client
          .get(downloadUrl, (response: any) => {
            // Handle redirects
            if (
              response.statusCode >= 300 &&
              response.statusCode < 400 &&
              response.headers.location
            ) {
              file.close();
              fs.unlink(outputPath, (unlinkErr) => {
                // Ignore deletion errors for cleanup
                if (unlinkErr)
                  console.warn('Failed to clean up partial file:', unlinkErr);
              });
              console.log(`Redirecting to: ${response.headers.location}`);
              downloadWithRedirects(
                response.headers.location,
                maxRedirects - 1,
              );
              return;
            }

            // Handle non-success status codes
            if (response.statusCode !== 200) {
              file.close();
              fs.unlink(outputPath, (unlinkErr) => {
                if (unlinkErr)
                  console.warn(
                    'Failed to clean up failed download:',
                    unlinkErr,
                  );
              });
              reject({
                success: false,
                error: `HTTP ${response.statusCode}: ${response.statusMessage}`,
              });
              return;
            }

            // Pipe the response to file
            response.pipe(file);

            file.on('finish', () => {
              file.close();
              resolve({ success: true, path: outputPath });
            });

            file.on('error', (err: any) => {
              fs.unlink(outputPath, (unlinkErr) => {
                if (unlinkErr)
                  console.warn('Failed to clean up partial file:', unlinkErr);
              });
              reject({
                success: false,
                error: `File write error: ${err.message}`,
              });
            });
          })
          .on('error', (err: any) => {
            file.close();
            fs.unlink(outputPath, (unlinkErr) => {
              if (unlinkErr)
                console.error('Failed to delete incomplete file:', unlinkErr);
            });
            reject({ success: false, error: `Network error: ${err.message}` });
          });
      };

      downloadWithRedirects(url);
    });
  } catch (error: any) {
    console.error('Error downloading file:', error);
    return { success: false, error: error.message };
  }
});

// handler to get thumbnail data url
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

// handler to save a file
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

// handler to register taskbar items
ipcMain.handle('plugins:register-taskbar-item', (event, taskBarItem) => {
  //console.log('Main process registering taskbar item:', taskBarItem);
  return pluginRegistry.registerTaskBarItem(taskBarItem);
});

// handler to unregister taskbar items
ipcMain.handle('plugins:unregister-taskbar-item', (_, id) => {
  //console.log('Main process unregistering taskbar item:', id);
  pluginRegistry.unregisterTaskBarItem(id);
  return true;
});

// handler to get taskbar items
ipcMain.handle('plugins:taskbar-items', () => {
  return pluginRegistry.getTaskBarItems();
});

// handler to execute taskbar items
ipcMain.handle('plugins:execute-taskbar-item', (event, id, contextData) => {
  // console.log('Executing taskbar item action:', id, contextData);
  pluginRegistry.executeTaskBarItemAction(id, contextData);
  return true;
});

// handler to read file contents
ipcMain.handle('plugin:fs:readFile', async (event, options) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { filePath, pluginId } = options;

    // Security check: Make sure we're not reading outside allowed directories
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

// handler to read file contents
ipcMain.handle('plugin:readFileContents', async (event, { options }) => {
  try {
    const { filePath } = options;
    // Security check: Make sure we're not reading outside allowed directories

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
      // console.log('file doesnt exist');
      return { success: false, error: 'File does not exist' };
    }
    // console.log('path given to read:', resolvedPath);

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

// handler to get version without GitHub API call
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

// handler to get path separator for current OS
ipcMain.handle('get-path-separator', async () => {
  try {
    return path.sep;
  } catch (error) {
    console.error('Error getting path separator:', error);
    return '/'; // Default to Unix-style separator
  }
});

// handler to get bundled binary path
ipcMain.handle('get-bundled-binary-path', async (_, binaryName: string) => {
  try {
    const bundledPath = getBundledBinaryPath(binaryName);
    return bundledPath;
  } catch (error) {
    console.error('Error getting bundled binary path:', error);
    return null;
  }
});

/**
 * Helper function to get bundled binary path from process.resourcesPath
 * @param binaryName - Name of the binary file (e.g., 'ffmpeg.exe', 'ggml-base.bin')
 * @returns Full path to the bundled binary or null if not found
 */
function getBundledBinaryPath(binaryName: string): string | null {
  const isPackaged = app.isPackaged;

  if (isPackaged && process.resourcesPath) {
    const bundledPath = path.join(process.resourcesPath, binaryName);
    if (existsSync(bundledPath)) {
      return bundledPath;
    }
  }

  return null;
}

/**
 * Dynamically finds FFmpeg executable path (synchronous version).
 * In production: uses bundled FFmpeg from resources.
 * In development: returns first found FFmpeg (may not have Whisper support).
 * Use getFFmpegPathWithWhisper() for validated FFmpeg 8.0+.
 * @deprecated Use getFFmpegPathWithWhisper() instead for Whisper support validation
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getFFmpegPath(): string {
  const isDev = process.env.NODE_ENV === 'development';

  // Production mode: use bundled FFmpeg from resources
  const bundledFFmpeg = getBundledBinaryPath('ffmpeg.exe');
  if (bundledFFmpeg) {
    return bundledFFmpeg;
  }

  // Development mode: search for user's FFmpeg installation
  if (isDev) {
    const platform = process.platform;
    const searchPaths: string[] = [];

    if (platform === 'win32') {
      // Windows common installation locations
      const homeDir = os.homedir();
      const localAppData =
        process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
      const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const programFilesX86 =
        process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

      // WinGet installation paths (common patterns) - this already prioritizes 8.0+
      const wingetBase = path.join(
        localAppData,
        'Microsoft',
        'WinGet',
        'Packages',
      );
      searchPaths.push(
        // Try to find any FFmpeg installation in WinGet packages (8.0+ first)
        ...findFFmpegInDirectory(wingetBase),
        // Chocolatey
        path.join(
          process.env['ChocolateyInstall'] || 'C:\\ProgramData\\chocolatey',
          'bin',
          'ffmpeg.exe',
        ),
        // Scoop
        path.join(
          homeDir,
          'scoop',
          'apps',
          'ffmpeg',
          'current',
          'bin',
          'ffmpeg.exe',
        ),
        // Direct Program Files installations
        path.join(programFiles, 'ffmpeg', 'bin', 'ffmpeg.exe'),
        path.join(programFilesX86, 'ffmpeg', 'bin', 'ffmpeg.exe'),
        // Common user installations
        path.join(homeDir, 'ffmpeg', 'bin', 'ffmpeg.exe'),
        path.join(localAppData, 'ffmpeg', 'bin', 'ffmpeg.exe'),
      );
    } else if (platform === 'darwin') {
      // macOS common locations
      const homeDir = os.homedir();
      searchPaths.push(
        // Homebrew
        '/opt/homebrew/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        path.join(homeDir, 'homebrew', 'bin', 'ffmpeg'),
        // MacPorts
        '/opt/local/bin/ffmpeg',
      );
    } else {
      // Linux common locations
      searchPaths.push(
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        path.join(os.homedir(), '.local', 'bin', 'ffmpeg'),
      );
    }

    // Check project directory (likely to be 8.0+ if bundled)
    const projectPath = path.join(process.cwd(), 'ffmpeg.exe');
    if (existsSync(projectPath)) {
      return projectPath;
    }

    // Check all search paths
    for (const searchPath of searchPaths) {
      if (searchPath && existsSync(searchPath)) {
        return searchPath;
      }
    }
  }

  // Final fallback: system PATH
  return 'ffmpeg';
}

/**
 * Finds FFmpeg executable with Whisper support (8.0+).
 * Validates each found FFmpeg and returns the first one that has Whisper support.
 * @returns Promise resolving to FFmpeg path with Whisper support, or throws error
 */
async function getFFmpegPathWithWhisper(): Promise<string> {
  const isDev = process.env.NODE_ENV === 'development';
  const isPackaged = app.isPackaged;

  // Production mode: use bundled FFmpeg from resources or app directory
  if (isPackaged) {
    // First try the bundled FFmpeg from process.resourcesPath
    const bundledFFmpeg = getBundledBinaryPath('ffmpeg.exe');
    if (bundledFFmpeg) {
      console.log(`Found bundled FFmpeg at: ${bundledFFmpeg}`);
      // Validate it has Whisper support
      const check = await checkFFmpegWhisperSupport(bundledFFmpeg);
      if (check.hasWhisper) {
        return bundledFFmpeg;
      } else {
        console.warn(
          `Bundled FFmpeg at ${bundledFFmpeg} does not have Whisper support: ${check.error}`,
        );
      }
    }

    // If bundled FFmpeg not found or doesn't have Whisper, check other locations
    const possiblePaths = [];

    // 2. Check app directory (where postPackage hook copies files)
    const appPath = app.getAppPath();
    possiblePaths.push(path.join(path.dirname(appPath), 'ffmpeg.exe'));

    // 3. Check process.resourcesPath parent (sometimes resources are one level up)
    if (process.resourcesPath) {
      const resourcesParent = path.dirname(process.resourcesPath);
      possiblePaths.push(path.join(resourcesParent, 'ffmpeg.exe'));
    }

    // 4. Check executable directory
    const exeDir = path.dirname(process.execPath);
    possiblePaths.push(path.join(exeDir, 'ffmpeg.exe'));

    // Try each path and validate if found
    for (const bundledPath of possiblePaths) {
      if (existsSync(bundledPath)) {
        console.log(`Found bundled FFmpeg at: ${bundledPath}`);
        // Validate it has Whisper support
        const check = await checkFFmpegWhisperSupport(bundledPath);
        if (check.hasWhisper) {
          return bundledPath;
        } else {
          console.warn(
            `Bundled FFmpeg at ${bundledPath} does not have Whisper support: ${check.error}`,
          );
        }
      }
    }

    // If bundled FFmpeg not found or doesn't have Whisper, throw error
    throw new Error(
      'Bundled FFmpeg not found or does not have Whisper support. Please ensure ffmpeg.exe (8.0+) is included in the app bundle.',
    );
  }

  // Development mode: search and validate FFmpeg installations
  if (isDev) {
    const platform = process.platform;
    const searchPaths: string[] = [];

    if (platform === 'win32') {
      // Windows common installation locations
      const homeDir = os.homedir();
      const localAppData =
        process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
      const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const programFilesX86 =
        process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

      // WinGet installation paths (common patterns) - this already prioritizes 8.0+
      const wingetBase = path.join(
        localAppData,
        'Microsoft',
        'WinGet',
        'Packages',
      );
      searchPaths.push(
        // Try to find any FFmpeg installation in WinGet packages (8.0+ first)
        ...findFFmpegInDirectory(wingetBase),
        // Chocolatey
        path.join(
          process.env['ChocolateyInstall'] || 'C:\\ProgramData\\chocolatey',
          'bin',
          'ffmpeg.exe',
        ),
        // Scoop
        path.join(
          homeDir,
          'scoop',
          'apps',
          'ffmpeg',
          'current',
          'bin',
          'ffmpeg.exe',
        ),
        // Direct Program Files installations
        path.join(programFiles, 'ffmpeg', 'bin', 'ffmpeg.exe'),
        path.join(programFilesX86, 'ffmpeg', 'bin', 'ffmpeg.exe'),
        // Common user installations
        path.join(homeDir, 'ffmpeg', 'bin', 'ffmpeg.exe'),
        path.join(localAppData, 'ffmpeg', 'bin', 'ffmpeg.exe'),
      );
    } else if (platform === 'darwin') {
      // macOS common locations
      const homeDir = os.homedir();
      searchPaths.push(
        // Homebrew
        '/opt/homebrew/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        path.join(homeDir, 'homebrew', 'bin', 'ffmpeg'),
        // MacPorts
        '/opt/local/bin/ffmpeg',
      );
    } else {
      // Linux common locations
      searchPaths.push(
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        path.join(os.homedir(), '.local', 'bin', 'ffmpeg'),
      );
    }

    // Check project directory first (likely to be 8.0+ if bundled)
    const projectPath = path.join(process.cwd(), 'ffmpeg.exe');
    if (existsSync(projectPath)) {
      const check = await checkFFmpegWhisperSupport(projectPath);
      if (check.hasWhisper) {
        return projectPath;
      }
    }

    // Check all search paths and validate each one
    for (const searchPath of searchPaths) {
      if (searchPath && existsSync(searchPath)) {
        const check = await checkFFmpegWhisperSupport(searchPath);
        if (check.hasWhisper) {
          return searchPath;
        }
      }
    }

    // If we get here, no valid FFmpeg was found
    throw new Error(
      'No FFmpeg 8.0+ with Whisper support found. Please install FFmpeg 8.0 or higher with Whisper filter support.',
    );
  }

  // Final fallback: try system PATH (but validate it)
  const systemFFmpeg = 'ffmpeg';
  try {
    const check = await checkFFmpegWhisperSupport(systemFFmpeg);
    if (check.hasWhisper) {
      return systemFFmpeg;
    }
    throw new Error(
      check.error ||
        'FFmpeg found in system PATH but does not have Whisper support. Please install FFmpeg 8.0+ with Whisper filter support.',
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `FFmpeg not found or does not have Whisper support: ${errorMessage}`,
    );
  }
}

/**
 * Helper function to recursively search for FFmpeg in a directory (useful for WinGet packages)
 * Prioritizes FFmpeg 8.0+ installations
 */
function findFFmpegInDirectory(dir: string): string[] {
  const paths: string[] = [];
  const paths80Plus: string[] = [];
  try {
    if (!existsSync(dir)) {
      return paths;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Check common FFmpeg directory patterns - prioritize 8.0+
        const possiblePaths = [
          path.join(
            dir,
            entry.name,
            'ffmpeg-8.0-full_build',
            'bin',
            'ffmpeg.exe',
          ),
          path.join(dir, entry.name, 'bin', 'ffmpeg.exe'),
          path.join(dir, entry.name, 'ffmpeg.exe'),
        ];

        for (const possiblePath of possiblePaths) {
          if (existsSync(possiblePath)) {
            // Check if it's FFmpeg 8.0+ by checking directory name or validating
            if (
              possiblePath.includes('ffmpeg-8.0') ||
              possiblePath.includes('ffmpeg-8.') ||
              entry.name.includes('8.0')
            ) {
              paths80Plus.push(possiblePath);
            } else {
              paths.push(possiblePath);
            }
          }
        }

        // Recursively search subdirectories (limit depth to avoid performance issues)
        const subPaths = findFFmpegInDirectory(path.join(dir, entry.name));
        // Separate 8.0+ from others
        for (const subPath of subPaths) {
          if (subPath.includes('ffmpeg-8.0') || subPath.includes('ffmpeg-8.')) {
            paths80Plus.push(subPath);
          } else {
            paths.push(subPath);
          }
        }
      }
    }
  } catch (error) {
    // Silently fail if directory access is denied or other errors occur
    console.debug(`Could not search directory ${dir}:`, error);
  }
  // Return 8.0+ paths first, then others
  return [...paths80Plus, ...paths];
}

/**
 * Checks if FFmpeg has Whisper filter support
 * @param ffmpegPath Path to FFmpeg executable
 * @returns Promise resolving to object with hasWhisper and version info
 */
async function checkFFmpegWhisperSupport(ffmpegPath: string): Promise<{
  hasWhisper: boolean;
  version?: string;
  error?: string;
}> {
  const { spawn } = await import('child_process');

  return new Promise((resolve) => {
    // First check version
    const versionProcess = spawn(ffmpegPath, ['-version'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let versionOutput = '';
    let versionError = '';

    versionProcess.stdout.on('data', (data: Buffer) => {
      versionOutput += data.toString();
    });

    versionProcess.stderr.on('data', (data: Buffer) => {
      versionError += data.toString();
    });

    versionProcess.on('close', () => {
      // Extract version number
      const versionMatch =
        versionOutput.match(/ffmpeg version (\d+)\.(\d+)/) ||
        versionError.match(/ffmpeg version (\d+)\.(\d+)/);
      const majorVersion = versionMatch ? parseInt(versionMatch[1], 10) : 0;
      const version = versionMatch
        ? `${versionMatch[1]}.${versionMatch[2]}`
        : undefined;

      // FFmpeg 8.0+ is required for Whisper filter
      if (majorVersion < 8) {
        resolve({
          hasWhisper: false,
          version,
          error: `FFmpeg version ${version} detected. FFmpeg 8.0 or higher is required for Whisper filter support.`,
        });
        return;
      }

      // Check if whisper filter exists
      const filterProcess = spawn(ffmpegPath, ['-filters'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let filterOutput = '';
      let filterError = '';

      filterProcess.stdout.on('data', (data: Buffer) => {
        filterOutput += data.toString();
      });

      filterProcess.stderr.on('data', (data: Buffer) => {
        filterError += data.toString();
      });

      filterProcess.on('close', () => {
        const allOutput = filterOutput + filterError;
        const hasWhisper = /whisper/i.test(allOutput);

        if (!hasWhisper) {
          resolve({
            hasWhisper: false,
            version,
            error: `FFmpeg ${version} found, but Whisper filter is not available. Please install FFmpeg 8.0+ with Whisper support.`,
          });
        } else {
          resolve({
            hasWhisper: true,
            version,
          });
        }
      });

      filterProcess.on('error', () => {
        resolve({
          hasWhisper: false,
          version,
          error:
            'Failed to check FFmpeg filters. Whisper support cannot be verified.',
        });
      });
    });

    versionProcess.on('error', () => {
      resolve({
        hasWhisper: false,
        error: 'Failed to check FFmpeg version.',
      });
    });
  });
}

function getDurationMs(filePath: string): number {
  // Note: ffprobe.exe is not bundled, using system PATH
  // If you need bundled ffprobe, add './ffprobe.exe' to extraResource in forge.config.ts
  const output = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
  );
  return Math.floor(parseFloat(output.toString().trim()) * 1000);
}

// handler to execute FFmpeg with Whisper transcription
ipcMain.handle(
  'ffmpeg:whisper-transcribe',
  async (
    event,
    options: {
      inputFile: string;
      outputFile: string;
      modelPath: string;
      language?: string;
      format?: string;
    },
  ) => {
    return (async () => {
      const { spawn } = await import('child_process');

      // Get FFmpeg path with Whisper support (validates and finds best match)
      const ffmpegPath = await getFFmpegPathWithWhisper();

      return new Promise((resolve, reject) => {
        // Get actual duration of the input file
        let totalDurationMs: number;
        try {
          totalDurationMs = getDurationMs(options.inputFile);
          console.log(
            `File duration: ${totalDurationMs}ms (${(
              totalDurationMs / 1000
            ).toFixed(2)}s)`,
          );
        } catch (error) {
          console.warn('Failed to get file duration, using fallback:', error);
          // Fallback to a reasonable default if duration cannot be determined
          totalDurationMs = 0;
        }

        // Send total duration to renderer once at the start
        if (totalDurationMs > 0) {
          event.sender.send(
            'ffmpeg:progress',
            JSON.stringify({
              type: 'duration',
              totalDurationMs,
            }),
          );
        }

        // Function to parse progress from FFmpeg output
        function parseLine(line: string): void {
          const match = line.match(/run transcription at (\d+) ms/);
          if (match && totalDurationMs > 0) {
            const currentMs = parseInt(match[1], 10);
            let percent = (currentMs / totalDurationMs) * 100;
            if (percent > 100) percent = 100;
            process.stdout.write(`\rProgress: ${percent.toFixed(2)}%`);

            // Send structured progress data to renderer
            event.sender.send(
              'ffmpeg:progress',
              JSON.stringify({
                type: 'progress',
                currentMs,
                totalDurationMs,
                percent: percent.toFixed(2),
                raw: line.trim(),
              }),
            );
          } else if (match) {
            // If we don't have total duration, just send the raw line
            event.sender.send('ffmpeg:progress', line);
          }
        }

        try {
          if (!existsSync(options.inputFile)) {
            reject(new Error(`Input file not found: ${options.inputFile}`));
            return;
          }

          if (!existsSync(options.modelPath)) {
            reject(new Error(`Whisper model not found: ${options.modelPath}`));
            return;
          }

          // Ensure output file path is absolute and in a user-accessible location
          let outputFilePath = options.outputFile;
          const isPackaged = app.isPackaged;

          // If output path is relative or not absolute, determine proper location
          if (!path.isAbsolute(outputFilePath)) {
            if (isPackaged) {
              // In packaged app: save to user's Documents folder or next to input file
              // Try to save next to input file first (if input is in user-accessible location)
              const inputDir = path.dirname(options.inputFile);
              const inputFileName = path.basename(
                options.inputFile,
                path.extname(options.inputFile),
              );
              const outputFileName =
                path.basename(outputFilePath, path.extname(outputFilePath)) ||
                inputFileName;

              // Check if input directory is writable (user-accessible)
              try {
                const testPath = path.join(inputDir, '.test-write');
                fs.writeFileSync(testPath, 'test');
                fs.unlinkSync(testPath);
                // Directory is writable, save next to input file
                outputFilePath = path.join(
                  inputDir,
                  `${outputFileName}.${options.format || 'srt'}`,
                );
              } catch {
                // Directory not writable, use Documents folder
                const documentsPath = app.getPath('documents');
                outputFilePath = path.join(
                  documentsPath,
                  'Downlodr',
                  'Transcriptions',
                  `${outputFileName}.${options.format || 'srt'}`,
                );
                // Ensure directory exists
                const outputDir = path.dirname(outputFilePath);
                if (!existsSync(outputDir)) {
                  fs.mkdirSync(outputDir, { recursive: true });
                }
              }
            } else {
              // In dev mode: save next to input file
              const inputDir = path.dirname(options.inputFile);
              const outputFileName =
                path.basename(outputFilePath, path.extname(outputFilePath)) ||
                path.basename(
                  options.inputFile,
                  path.extname(options.inputFile),
                );
              outputFilePath = path.join(
                inputDir,
                `${outputFileName}.${options.format || 'srt'}`,
              );
            }
          }

          // Ensure model path is absolute
          let modelPath = options.modelPath;
          if (!path.isAbsolute(modelPath)) {
            // Try project root first (dev mode)
            const projectModelPath = path.join(process.cwd(), modelPath);
            if (existsSync(projectModelPath)) {
              modelPath = projectModelPath;
            } else if (isPackaged) {
              // In packaged app, first try bundled model from process.resourcesPath
              const bundledModel = getBundledBinaryPath(modelPath);
              if (bundledModel) {
                modelPath = bundledModel;
                console.log(`Found bundled model at: ${modelPath}`);
              } else {
                // If not found in bundle, check other possible locations
                const possibleModelPaths = [];

                // 2. Check app directory (where postPackage hook copies files)
                const appPath = app.getAppPath();
                possibleModelPaths.push(
                  path.join(path.dirname(appPath), modelPath),
                );

                // 3. Check process.resourcesPath parent
                if (process.resourcesPath) {
                  const resourcesParent = path.dirname(process.resourcesPath);
                  possibleModelPaths.push(
                    path.join(resourcesParent, modelPath),
                  );
                }

                // 4. Check executable directory
                const exeDir = path.dirname(process.execPath);
                possibleModelPaths.push(path.join(exeDir, modelPath));

                // Try each path
                let found = false;
                for (const possiblePath of possibleModelPaths) {
                  if (existsSync(possiblePath)) {
                    modelPath = possiblePath;
                    found = true;
                    console.log(`Found model at: ${modelPath}`);
                    break;
                  }
                }

                // If not found in app bundle, try next to input file
                if (!found) {
                  const inputDir = path.dirname(options.inputFile);
                  const inputDirModelPath = path.join(inputDir, modelPath);
                  if (existsSync(inputDirModelPath)) {
                    modelPath = inputDirModelPath;
                  }
                }
              }
            } else {
              // Try next to input file (dev mode)
              const inputDir = path.dirname(options.inputFile);
              const inputDirModelPath = path.join(inputDir, modelPath);
              if (existsSync(inputDirModelPath)) {
                modelPath = inputDirModelPath;
              }
            }
          }

          // Verify model exists with absolute path
          if (!existsSync(modelPath)) {
            reject(
              new Error(
                `Whisper model not found: ${modelPath}. Please ensure the model file exists.`,
              ),
            );
            return;
          }

          console.log(`Using model path: ${modelPath}`);
          console.log(`Output file path: ${outputFilePath}`);

          // Build the filter - use absolute paths
          const language = options.language || 'en';
          const format = options.format || 'srt';

          // Normalize paths for FFmpeg filter syntax on Windows
          // Convert backslashes to forward slashes
          let normalizedModelPath = modelPath.replace(/\\/g, '/');
          let normalizedOutputPath = outputFilePath.replace(/\\/g, '/');

          // Escape the colon in drive letters (C: becomes C\:)
          // Then wrap in single quotes for FFmpeg filter syntax
          normalizedModelPath = normalizedModelPath.replace(
            /^([A-Za-z]):/,
            '$1\\:',
          );
          normalizedOutputPath = normalizedOutputPath.replace(
            /^([A-Za-z]):/,
            '$1\\:',
          );

          // Build filter complex - use single quotes with escaped colon, forward slashes
          const filterComplex = `[0:a]whisper=model='${normalizedModelPath}':language=${language}:destination='${normalizedOutputPath}':format=${format}`;

          console.log(`Filter complex: ${filterComplex}`);

          // Build FFmpeg arguments
          const args = [
            '-i',
            options.inputFile,
            '-filter_complex',
            filterComplex,
            '-f',
            'null',
            '-',
          ];

          // Spawn the FFmpeg process
          const ffmpegProcess = spawn(ffmpegPath, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          let stdout = '';
          let stderr = '';

          // Collect stdout
          ffmpegProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            // Parse each line for progress information
            const lines = data.toString().split('\n');
            lines.forEach((line: string) => {
              if (line.trim()) {
                parseLine(line);
              }
            });
          });

          ffmpegProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            // Parse each line for progress information
            const lines = chunk.split('\n');
            lines.forEach((line: string) => {
              if (line.trim()) {
                parseLine(line);
              }
            });
          });

          // Handle process completion
          ffmpegProcess.on('close', (code) => {
            if (code === 0) {
              resolve({
                success: true,
                outputFile: outputFilePath,
                stdout,
                stderr,
              });
            } else {
              // Extract more detailed error information from stderr
              let errorDetails = stderr;

              // Look for specific error patterns
              if (stderr.includes('No such filter')) {
                errorDetails =
                  'Whisper filter not found in FFmpeg build. Please install FFmpeg 8.0+ with Whisper support.';
              } else if (
                stderr.includes('No such file') ||
                stderr.includes('not found')
              ) {
                errorDetails = `File not found. Check model path: ${modelPath}`;
              } else if (stderr.includes('Invalid argument')) {
                errorDetails = `Invalid argument. Check paths:\nModel: ${modelPath}\nOutput: ${outputFilePath}\n\nFFmpeg error: ${stderr.substring(
                  0,
                  500,
                )}`;
              } else if (stderr.includes('Permission denied')) {
                errorDetails = `Permission denied. Check write permissions for output: ${outputFilePath}`;
              }

              console.error('FFmpeg error details:', stderr);
              console.error('Exit code:', code);
              console.error('Model path used:', modelPath);
              console.error('Output path used:', outputFilePath);
              reject(
                new Error(
                  `FFmpeg process exited with code ${code}.\n${errorDetails}`,
                ),
              );
            }
          });

          // Handle process errors
          ffmpegProcess.on('error', (error) => {
            reject(
              new Error(`Failed to start FFmpeg process: ${error.message}`),
            );
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          reject(new Error(`FFmpeg execution failed: ${errorMessage}`));
        }
      });
    })();
  },
);
