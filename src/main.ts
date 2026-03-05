/* eslint-disable @typescript-eslint/no-explicit-any */
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
import http from 'http';
import https from 'https';
import os from 'os';
import path from 'path';
import { checkForUpdates } from './DataFunctions/updateChecker';
import { initializeYTDLP, ensureYTDLPBinary } from './Utils/ytdlpWrapper';
import {
  checkSystemFFmpeg,
  copySystemFFmpegToApp,
} from './Utils/ffmpegDownloader';

// Lazy-load YTDLP to prevent file system errors
let YTDLP: any = null;

// Configure FFmpeg binary for production
async function setupFFmpegBinary() {
  const ffmpegName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

  // In production, use app's user data directory which is writable
  // In development, use system FFmpeg
  if (app.isPackaged) {
    const targetDir = app.getPath('userData');
    const expectedPath = path.join(targetDir, ffmpegName);

    // Determine architecture-specific FFmpeg binary
    const arch = process.arch;
    const ffmpegResourceName = arch === 'arm64' ? 'ffmpeg-arm64' : 'ffmpeg-x64';
    const sourcePath = path.join(process.resourcesPath, ffmpegResourceName);

    console.log('Setting up FFmpeg binary for production...');
    console.log(`Architecture: ${arch}`);
    console.log('Source path:', sourcePath);
    console.log('Target path:', expectedPath);

    // First, check if we have a local copy
    if (existsSync(expectedPath)) {
      console.log('FFmpeg binary already exists at:', expectedPath);
      process.env.FFMPEG_PATH = expectedPath;
      return;
    }

    // Check if FFmpeg exists in resources (bundled with app)
    if (existsSync(sourcePath)) {
      try {
        // Copy the binary to the user data location
        fs.copyFileSync(sourcePath, expectedPath);

        // Make it executable on Unix systems
        if (process.platform !== 'win32') {
          fs.chmodSync(expectedPath, 0o755);
        }

        console.log(
          '✅ FFmpeg binary copied from bundled resources to:',
          expectedPath,
        );
        process.env.FFMPEG_PATH = expectedPath;
        return;
      } catch (error) {
        console.error('Failed to copy bundled FFmpeg binary:', error);
        // Try to use directly from resources if copy fails
        try {
          if (process.platform !== 'win32') {
            fs.chmodSync(sourcePath, 0o755);
          }
          process.env.FFMPEG_PATH = sourcePath;
          console.log('✅ Using FFmpeg directly from resources:', sourcePath);
          return;
        } catch (directUseError) {
          console.error('Failed to use FFmpeg from resources:', directUseError);
        }
      }
    } else {
      console.warn(`⚠️ Bundled FFmpeg not found at: ${sourcePath}`);
    }

    // Fallback: Try to find system FFmpeg (should not be needed with bundled binaries)
    console.log('Checking for system FFmpeg as fallback...');
    const systemFFmpeg = await checkSystemFFmpeg();

    if (systemFFmpeg) {
      console.log('✅ Found system FFmpeg at:', systemFFmpeg);

      // Try to copy system FFmpeg to app directory for faster access
      const copied = await copySystemFFmpegToApp();
      if (copied && existsSync(expectedPath)) {
        process.env.FFMPEG_PATH = expectedPath;
        console.log('Copied system FFmpeg to app directory');
      } else {
        // Use system FFmpeg directly
        process.env.FFMPEG_PATH = systemFFmpeg;
        console.log('Using system FFmpeg directly');
      }
    } else {
      console.error('❌ Critical: FFmpeg not found in bundle or system!');
      console.error(
        'The app bundle should include FFmpeg. This is a build issue.',
      );
      console.error(
        'Downloads will likely fail to merge video and audio streams.',
      );
      // Set a fallback path anyway
      process.env.FFMPEG_PATH = 'ffmpeg';
    }
  } else {
    // In development, use binaries from the binaries folder
    const arch = process.arch;
    const devBinaryName = arch === 'arm64' ? 'ffmpeg-arm64' : 'ffmpeg-x64';
    const devBinaryPath = path.join(__dirname, 'binaries', devBinaryName);

    if (existsSync(devBinaryPath)) {
      process.env.FFMPEG_PATH = devBinaryPath;
      console.log(
        '✅ Development mode: using bundled FFmpeg at:',
        devBinaryPath,
      );
    } else {
      // Fallback to system FFmpeg in development
      const systemFFmpeg = await checkSystemFFmpeg();
      process.env.FFMPEG_PATH = systemFFmpeg || 'ffmpeg';
      console.log(
        'Development mode: using system FFmpeg at:',
        process.env.FFMPEG_PATH,
      );
    }
  }

  console.log('FFmpeg configured at:', process.env.FFMPEG_PATH);
}

// Configure YTDLP binary for production by copying it to a writable location
function setupYTDLPBinary() {
  const binaryName =
    process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp_macos';

  // In production, use app's user data directory which is writable
  // In development, use current working directory
  const targetDir = app.isPackaged ? app.getPath('userData') : process.cwd();

  const expectedPath = path.join(targetDir, binaryName);

  if (app.isPackaged) {
    // In production, copy the binary from Resources to user data directory
    const sourcePath = path.join(process.resourcesPath, binaryName);

    console.log('Setting up YTDLP binary for production...');
    console.log('Source path:', sourcePath);
    console.log('Target path:', expectedPath);
    console.log('User data directory:', app.getPath('userData'));

    // Check if the binary exists in resources
    if (existsSync(sourcePath)) {
      try {
        // Create user data directory if it doesn't exist
        const userDataDir = app.getPath('userData');
        if (!existsSync(userDataDir)) {
          fs.mkdirSync(userDataDir, { recursive: true });
        }

        // Copy the binary to the user data location if it doesn't exist or is outdated
        if (!existsSync(expectedPath)) {
          fs.copyFileSync(sourcePath, expectedPath);

          // Make it executable on Unix systems
          if (process.platform !== 'win32') {
            fs.chmodSync(expectedPath, 0o755);
          }

          console.log('YTDLP binary copied and configured at:', expectedPath);
        } else {
          // Check if source is newer than target (for updates)
          const sourceStats = fs.statSync(sourcePath);
          const targetStats = fs.statSync(expectedPath);

          if (sourceStats.mtime > targetStats.mtime) {
            fs.copyFileSync(sourcePath, expectedPath);
            if (process.platform !== 'win32') {
              fs.chmodSync(expectedPath, 0o755);
            }
            console.log('YTDLP binary updated at:', expectedPath);
          } else {
            console.log('YTDLP binary already up-to-date at:', expectedPath);
          }
        }

        // Update YTDLP configuration to use the correct path
        process.env.YTDLP_PATH = expectedPath;
      } catch (error) {
        console.error('Failed to copy YTDLP binary:', error);

        // Fallback: try to use the binary directly from resources
        if (existsSync(sourcePath)) {
          process.env.YTDLP_PATH = sourcePath;
          console.log(
            'Using YTDLP binary directly from resources:',
            sourcePath,
          );
        }
      }
    } else {
      console.error('YTDLP binary not found in resources at:', sourcePath);
    }
  } else {
    // In development, check if the binary exists
    if (existsSync(expectedPath)) {
      console.log('Development YTDLP binary found at:', expectedPath);
      process.env.YTDLP_PATH = expectedPath;
    } else {
      console.log('Development YTDLP binary not found at:', expectedPath);
    }
  }
}

import { PluginManager } from './plugins/pluginManager';
import { pluginRegistry } from './plugins/registry';
import { DownloadOptions } from './schema/ytdlp';

// YTDLP will be initialized after app is ready to prevent file system errors

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Initialize YTDLP configuration when app is ready
app.on('will-finish-launching', () => {
  // Set up working directory early
  if (app.isPackaged) {
    try {
      const userDataPath = app.getPath('userData');
      process.chdir(userDataPath);
      console.log('Changed working directory to:', userDataPath);
    } catch (error) {
      console.error('Failed to change working directory:', error);
    }
  }
});

// Configure YTDLP after app is ready
app.whenReady().then(async () => {
  try {
    // Setup FFmpeg binary first (needed for merging)
    await setupFFmpegBinary();

    // Setup additional binary configuration
    setupYTDLPBinary();

    // Ensure binary is in place
    await ensureYTDLPBinary();

    // Initialize YTDLP with proper configuration
    YTDLP = await initializeYTDLP();
    console.log('YTDLP initialized successfully');
  } catch (error) {
    console.error('Failed to initialize YTDLP:', error);
  }
});

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

// Function to create the main application window
const createWindow = () => {
  // If window already exists and isn't destroyed, just show it
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1350,
    height: 680,
    frame: process.platform !== 'darwin', // Use native frame on non-macOS platforms
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    titleBarOverlay:
      process.platform === 'darwin'
        ? false
        : {
            color: '#2f3241',
            symbolColor: '#74b1be',
            height: 40,
          },
    autoHideMenuBar: process.platform !== 'darwin', // Keep menu on macOS
    minWidth: 1000,
    minHeight: 600,
    icon: (() => {
      const iconName =
        process.platform === 'darwin' ? 'icon.icns' : '256x256.ico';

      if (process.env.NODE_ENV === 'development') {
        return path.join(process.cwd(), 'src/Assets/AppLogo', iconName);
      } else {
        // Try multiple paths for production
        const possiblePaths = [
          path.join(
            process.resourcesPath,
            'app.asar.unpacked',
            'Assets/AppLogo',
            iconName,
          ),
          path.join(process.resourcesPath, 'Assets/AppLogo', iconName),
          path.join(__dirname, '../Assets/AppLogo', iconName),
        ];

        for (const iconPath of possiblePaths) {
          if (fs.existsSync(iconPath)) {
            return iconPath;
          }
        }

        // Fallback to the original path
        return path.join(__dirname, '../Assets/AppLogo', iconName);
      }
    })(),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
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

      // Set up platform-appropriate menu
      if (process.platform === 'darwin') {
        // macOS needs a proper application menu
        const template = [
          {
            label: app.getName(),
            submenu: [
              { label: 'About ' + app.getName(), role: 'about' },
              { type: 'separator' },
              { label: 'Services', role: 'services', submenu: [] as any[] },
              { type: 'separator' },
              {
                label: 'Hide ' + app.getName(),
                accelerator: 'Command+H',
                role: 'hide',
              },
              {
                label: 'Hide Others',
                accelerator: 'Command+Shift+H',
                role: 'hideothers',
              },
              { label: 'Show All', role: 'unhide' },
              { type: 'separator' },
              { label: 'Quit', accelerator: 'Command+Q', role: 'quit' },
            ],
          },
          {
            label: 'Edit',
            submenu: [
              { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
              { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
              { type: 'separator' },
              { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
              { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
              { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
              {
                label: 'Select All',
                accelerator: 'CmdOrCtrl+A',
                role: 'selectall',
              },
            ],
          },
          {
            label: 'View',
            submenu: [
              { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
              {
                label: 'Force Reload',
                accelerator: 'CmdOrCtrl+Shift+R',
                role: 'forceReload',
              },
              ...(process.env.NODE_ENV === 'development'
                ? [
                    {
                      label: 'Toggle Developer Tools',
                      accelerator:
                        process.platform === 'darwin'
                          ? 'Alt+Command+I'
                          : 'Ctrl+Shift+I',
                      role: 'toggleDevTools',
                    },
                  ]
                : []),
              { type: 'separator' },
              {
                label: 'Actual Size',
                accelerator: 'CmdOrCtrl+0',
                role: 'resetZoom',
              },
              {
                label: 'Zoom In',
                accelerator: 'CmdOrCtrl+Plus',
                role: 'zoomIn',
              },
              {
                label: 'Zoom Out',
                accelerator: 'CmdOrCtrl+-',
                role: 'zoomOut',
              },
              { type: 'separator' },
              {
                label: 'Toggle Fullscreen',
                accelerator:
                  process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
                role: 'togglefullscreen',
              },
            ],
          },
          {
            label: 'Window',
            submenu: [
              {
                label: 'Minimize',
                accelerator: 'CmdOrCtrl+M',
                role: 'minimize',
              },
              { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' },
            ],
          },
        ];

        const menu = Menu.buildFromTemplate(template as any);
        Menu.setApplicationMenu(menu);
      } else {
        // Remove all default menus on Windows/Linux so "View → Toggle Developer Tools" disappears
        Menu.setApplicationMenu(null);
      }

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
        console.log('Window closing, checking setting:', shouldRunInBackground);

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

  // For macOS, ensure proper sizing and template image behavior
  if (process.platform === 'darwin') {
    // Resize icons to proper macOS tray size (16x16 points)
    normalTrayIcon = normalTrayIcon.resize({ width: 16, height: 16 });
    alertTrayIcon = alertTrayIcon.resize({ width: 16, height: 16 });

    // Set as template images for dark mode compatibility
    normalTrayIcon.setTemplateImage(true);
    alertTrayIcon.setTemplateImage(true);
  }

  // Initialize with normal icon
  tray = new Tray(normalTrayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Downlodr',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          resetTrayIcon(); // Reset icon when showing app
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          // Send message to open settings modal
          mainWindow.webContents.send('open-settings-modal');
          resetTrayIcon();
        }
      },
    },
    {
      label: 'Check for Updates',
      click: async () => {
        try {
          const updateInfo = await checkForUpdates();
          if (updateInfo.hasUpdate) {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
              mainWindow.webContents.send('update-available', updateInfo);
            }
            // Show native notification
            const notification = new Notification({
              title: 'Update Available',
              body: `Version ${
                updateInfo.latestVersion || 'Unknown'
              } is available for download`,
              icon: path.join(__dirname, '../Assets/AppLogo/256x256.png'),
            });
            notification.show();
          } else {
            // Show "no updates" notification
            const notification = new Notification({
              title: 'Downlodr is up to date',
              body: 'You have the latest version installed',
              icon: path.join(__dirname, '../Assets/AppLogo/256x256.png'),
            });
            notification.show();
          }
        } catch (error) {
          console.error('Failed to check for updates:', error);
          // Show error notification
          const notification = new Notification({
            title: 'Update Check Failed',
            body: 'Unable to check for updates. Please try again later.',
            icon: path.join(__dirname, '../Assets/AppLogo/256x256.png'),
          });
          notification.show();
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

// Function to manage tray visibility based on runInBackground setting
const updateTrayVisibility = () => {
  if (runInBackgroundSetting) {
    // Create tray if it doesn't exist and background mode is enabled
    if (!tray) {
      createTray();
      console.log('Tray created - background mode enabled');
    }
  } else {
    // Destroy tray if it exists and background mode is disabled
    if (tray) {
      tray.destroy();
      tray = null;
      console.log('Tray destroyed - background mode disabled');
    }
  }
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
    console.error('Error determining Downloads folder:', error);
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
    console.error('Error determining Downloads folder:', error);
    return null;
  }
});

// Check if app is packaged (dev/prod detection)
ipcMain.handle('check-app-packaged', () => {
  return app.isPackaged;
});

// Enhanced FFmpeg status checking
ipcMain.handle('check-ffmpeg-status', async () => {
  try {
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    const exists = fs.existsSync(ffmpegPath);

    // If it's just 'ffmpeg' (not a full path), we need to check if it's in PATH
    let available = false;
    if (exists) {
      available = true;
    } else if (ffmpegPath === 'ffmpeg') {
      const systemFFmpeg = await checkSystemFFmpeg();
      available = !!systemFFmpeg;
    }

    return {
      available,
      path: ffmpegPath,
      version: available ? 'Available' : 'Not found',
    };
  } catch (error) {
    console.error('Error checking FFmpeg status:', error);
    return { available: false, error: error.message };
  }
});

async function getCpuUsagePercent() {
  const startUsage = process.cpuUsage();
  const startTime = process.hrtime();

  // Wait for 100ms without blocking the event loop
  await new Promise((resolve) => setTimeout(resolve, 100));

  const elapUsage = process.cpuUsage(startUsage);
  const elapTime = process.hrtime(startTime);

  const elapTimeMS = elapTime[0] * 1000 + elapTime[1] / 1000000;
  const elapUserMS = elapUsage.user / 1000;
  const elapSystMS = elapUsage.system / 1000;

  const cpuPercent = Math.round((100 * (elapUserMS + elapSystMS)) / elapTimeMS);
  return cpuPercent;
}

ipcMain.handle('getPerformanceMetrics', async () => {
  try {
    const cpuUsage = await getCpuUsagePercent();
    return {
      cpu_usage: cpuUsage,
    };
  } catch (error) {
    console.error('Error determining Downloads folder:', error);
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

// Validates if a path exists
ipcMain.handle('isValidPath', async (_event, filePath) => {
  try {
    return existsSync(filePath);
  } catch (error) {
    return false;
  }
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

// Reset Application Data functionality
ipcMain.handle('reset-app-data', async () => {
  try {
    console.log('🧹 Resetting application data...');
    const userDataPath = app.getPath('userData');

    // Stop all active conversions
    for (const [id, conversion] of activeConversions.entries()) {
      if (conversion.process) {
        console.log(`🛑 Stopping conversion ${id} for reset`);
        conversion.status = 'stopped';
        conversion.process.kill('SIGKILL');
      }
    }
    activeConversions.clear();

    // Close the main window first if it exists
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }

    // Give some time for file handles to close
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get all items in userData
    const items = fs.readdirSync(userDataPath);

    for (const item of items) {
      // Don't delete the app itself or its binaries if they are in this path (unlikely but safe)
      if (item === 'Downlodr' || item === 'Downlodr.exe') continue;

      const itemPath = path.join(userDataPath, item);

      try {
        const stats = fs.statSync(itemPath);
        if (stats.isDirectory()) {
          fs.rmSync(itemPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(itemPath);
        }
        console.log(`🗑️ Deleted: ${item}`);
      } catch (err) {
        console.error(`Failed to delete ${itemPath}:`, err);
      }
    }

    console.log('✅ Application data cleared. Relaunching...');

    // Relaunch the app
    app.relaunch();
    app.exit(0);

    return { success: true };
  } catch (error) {
    console.error('❌ Failed to reset application data:', error);
    return { success: false, error: error.message };
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
    // Ensure YTDLP is initialized
    if (!YTDLP) {
      YTDLP = await initializeYTDLP();
    }

    // Ensure YTDLP binary is set up before getting playlist info
    setupYTDLPBinary();

    // Configure YTDLP to use the correct binary path
    if (process.env.YTDLP_PATH) {
      YTDLP.Config.ytdlpPath = process.env.YTDLP_PATH;
    }

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
  try {
    // Ensure YTDLP is initialized
    if (!YTDLP) {
      YTDLP = await initializeYTDLP();
    }

    YTDLP.Config.log = true;

    // Ensure YTDLP binary is set up before getting info
    setupYTDLPBinary();

    // Configure YTDLP to use the correct binary path
    if (process.env.YTDLP_PATH) {
      YTDLP.Config.ytdlpPath = process.env.YTDLP_PATH;
    }

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

// Get current YT-DLP version
ipcMain.handle('ytdlp:getCurrentVersion', async () => {
  try {
    // Ensure YTDLP is initialized
    if (!YTDLP) {
      YTDLP = await initializeYTDLP();
    }

    // Ensure YTDLP binary is set up before checking version
    setupYTDLPBinary();

    // Configure YTDLP to use the correct binary path
    if (process.env.YTDLP_PATH) {
      YTDLP.Config.ytdlpPath = process.env.YTDLP_PATH;
    }

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

    // Ensure YTDLP is initialized
    if (!YTDLP) {
      YTDLP = initializeYTDLP();
    }

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
    // Ensure YTDLP is initialized
    if (!YTDLP) {
      YTDLP = await initializeYTDLP();
    }

    // Ensure YTDLP binary is set up before checking version
    setupYTDLPBinary();

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

      // Ensure YTDLP is initialized
      if (!YTDLP) {
        YTDLP = initializeYTDLP();
      }

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

      // Ensure YTDLP is initialized
      if (!YTDLP) {
        YTDLP = initializeYTDLP();
      }

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
    // Ensure YTDLP binary is set up first
    setupYTDLPBinary();

    // Configure YTDLP to use the correct binary path
    if (process.env.YTDLP_PATH) {
      YTDLP.Config.ytdlpPath = process.env.YTDLP_PATH;
    }

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

    // Ensure YTDLP is initialized
    if (!YTDLP) {
      YTDLP = await initializeYTDLP();
    }

    await YTDLP.downloadYTDLP(downloadOptions);
    return { success: true };
  } catch (error) {
    console.error('Error downloading YTDLP:', error);
    return { success: false, error: error.message };
  }
});

// after identifying ID kill/stop the id
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function killControllerById(id: any) {
  try {
    // Ensure YTDLP is initialized
    if (!YTDLP) {
      YTDLP = await initializeYTDLP();
    }

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
ipcMain.handle('ytdlp:stop', async (e, id: string) => {
  try {
    // Ensure YTDLP is initialized
    if (!YTDLP) {
      YTDLP = await initializeYTDLP();
    }

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
    // Ensure YTDLP is initialized
    if (!YTDLP) {
      YTDLP = await initializeYTDLP();
    }

    // Ensure YTDLP binary is set up before downloading
    setupYTDLPBinary();

    // Configure YTDLP to use the correct binary path
    if (process.env.YTDLP_PATH) {
      YTDLP.Config.ytdlpPath = process.env.YTDLP_PATH;
    }

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
ipcMain.handle('check-clipboard-monitoring', () => {
  return isMonitoring;
});

// Alias for clipboard monitoring to match preload name
ipcMain.handle('is-clipboard-monitoring-active', () => {
  return isMonitoring;
});

// Activity indicator handlers
ipcMain.handle('start-activity-indicator', () => {
  return true;
});

ipcMain.handle('stop-activity-indicator', () => {
  return true;
});

// Telemetry consent handlers
ipcMain.handle('telemetry-consent-required', () => {
  return false;
});

ipcMain.handle('telemetry-consent-completed', () => {
  return true;
});

// Auto-launch handlers
ipcMain.handle('set-auto-launch', (_event, _enabled) => {
  return true;
});

ipcMain.handle('get-auto-launch', () => {
  return false;
});

// Manual merge handler for troubleshooting
ipcMain.handle('merge-video-audio', async (event, options) => {
  const { videoPath, audioPath, outputPath } = options;

  try {
    const { spawn } = await import('child_process');
    const ffmpegPath =
      process.env.FFMPEG_PATH ||
      (process.platform === 'darwin' ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');

    console.log(`🎬 Manual merge requested: ${path.basename(outputPath)}`);

    return new Promise((resolve) => {
      const ffmpeg = spawn(ffmpegPath, [
        '-i',
        videoPath,
        '-i',
        audioPath,
        '-c:v',
        'copy',
        '-c:a',
        'copy',
        '-map',
        '0:v:0',
        '-map',
        '1:a:0',
        '-movflags',
        '+faststart',
        '-y',
        outputPath,
      ]);

      let errorOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(
            `✅ Manual merge successful: ${path.basename(outputPath)}`,
          );
          resolve({ success: true, outputPath });
        } else {
          console.error(`❌ Manual merge failed with code ${code}`);
          resolve({ success: false, error: errorOutput });
        }
      });

      ffmpeg.on('error', (error) => {
        console.error('❌ FFmpeg error:', error.message);
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error) {
    console.error('Manual merge error:', error);
    return { success: false, error: error.message };
  }
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
  // Setup YTDLP binary first
  setupYTDLPBinary();

  // Set application icon for dock on macOS
  if (process.platform === 'darwin') {
    let iconPath: string;

    if (process.env.NODE_ENV === 'development') {
      iconPath = path.join(process.cwd(), 'src/Assets/AppLogo/icon.icns');
    } else {
      // In production, try different possible paths
      iconPath = path.join(
        process.resourcesPath,
        'app.asar.unpacked',
        'Assets/AppLogo/icon.icns',
      );

      // Fallback to resourcesPath if asar path doesn't exist
      if (!fs.existsSync(iconPath)) {
        iconPath = path.join(process.resourcesPath, 'Assets/AppLogo/icon.icns');
      }

      // Another fallback relative to main process
      if (!fs.existsSync(iconPath)) {
        iconPath = path.join(__dirname, '../Assets/AppLogo/icon.icns');
      }
    }

    console.log('Attempting to set dock icon from path:', iconPath);
    console.log('Icon file exists:', fs.existsSync(iconPath));

    try {
      // Set both app icon and dock icon
      const iconImage = nativeImage.createFromPath(iconPath);
      if (!iconImage.isEmpty()) {
        app.dock.setIcon(iconImage);
        console.log('Successfully set dock icon with nativeImage');
      } else {
        // Fallback to string path
        app.dock.setIcon(iconPath);
        console.log('Successfully set dock icon with path string');
      }
    } catch (error) {
      console.error('Failed to set dock icon:', error);

      // Try one more fallback - set it as application icon
      try {
        if (mainWindow) {
          mainWindow.setIcon(iconPath);
          console.log('Set icon on main window as fallback');
        }
      } catch (windowError) {
        console.error('Failed to set window icon as fallback:', windowError);
      }
    }
  }

  createWindow();

  // Wait for the renderer to load and sync the background setting
  mainWindow?.webContents.once('did-finish-load', () => {
    // Request the current runInBackground setting from the renderer
    mainWindow?.webContents.send('request-background-setting-sync');
  });

  // Initialize tray based on runInBackground setting
  updateTrayVisibility();
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

  // Check for YT-DLP updates when app starts
  setTimeout(async () => {
    try {
      console.log('Checking for YT-DLP updates on startup...');

      // Ensure YTDLP is initialized
      if (!YTDLP) {
        YTDLP = await initializeYTDLP();
      }

      // Ensure YTDLP binary is set up before checking version
      setupYTDLPBinary();

      // Configure YTDLP to use the correct binary path
      if (process.env.YTDLP_PATH) {
        YTDLP.Config.ytdlpPath = process.env.YTDLP_PATH;
      }

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
          win.webContents.send('ytdlp-auto-updated', {
            fromVersion: currentVersion,
            toVersion: latestVersion,
            message: `YT-DLP automatically updated from ${currentVersion} to ${latestVersion}`,
          });
        });
      } else if (!currentVersion) {
        console.log('YT-DLP not found, downloading latest version...');
        await YTDLP.downloadYTDLP();
        console.log('YT-DLP downloaded successfully!');

        // Notify renderer about the installation
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send('ytdlp-auto-installed', {
            version: latestVersion || 'latest',
            message: 'YT-DLP was automatically downloaded and installed',
          });
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
    const updateInfo = await checkForUpdates();
    if (updateInfo.hasUpdate) {
      BrowserWindow.getAllWindows().forEach((win) =>
        win.webContents.send('update-available', updateInfo),
      );
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
          win.webContents.send('ytdlp-update-available', {
            currentVersion,
            latestVersion: latestResponse.version,
            message: `YT-DLP update available: ${currentVersion} → ${latestResponse.version}`,
          });
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
  if (app.isReady()) {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
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

// Notification system IPC handlers
ipcMain.handle('notification:show', async (event, config) => {
  try {
    console.log('📱 Showing notification via main process:', config.title);

    const notification = new Notification({
      title: config.title,
      body: config.body,
      icon: config.icon
        ? path.join(__dirname, '../Assets/AppLogo', config.icon)
        : undefined,
      silent: false,
    });

    notification.show();

    // Handle notification click
    notification.on('click', () => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
        mainWindow.show();
      }
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Failed to show notification:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('notification:request-permissions', async () => {
  // On macOS, notification permissions are handled by the system
  // Return true as Electron handles this automatically
  return true;
});

ipcMain.handle('notification:has-permissions', async () => {
  // On macOS, we assume notifications are available
  return true;
});

// Dock Badge API handlers
ipcMain.handle('dock-badge:set-count', async (event, count) => {
  try {
    if (process.platform === 'darwin') {
      console.log(`🏷️ Setting dock badge count to: ${count}`);
      if (count > 0) {
        app.dock.setBadge(count.toString());
      } else {
        app.dock.setBadge('');
      }
    } else {
      console.log('🏷️ Dock badge not supported on this platform');
    }
  } catch (error) {
    console.error('❌ Failed to set dock badge count:', error);
    throw error;
  }
});

ipcMain.handle('dock-badge:get-count', async () => {
  try {
    if (process.platform === 'darwin') {
      const badge = app.dock.getBadge();
      return badge ? parseInt(badge, 10) : 0;
    } else {
      return 0;
    }
  } catch (error) {
    console.error('❌ Failed to get dock badge count:', error);
    return 0;
  }
});

ipcMain.handle('dock-badge:clear', async () => {
  try {
    if (process.platform === 'darwin') {
      console.log('🏷️ Clearing dock badge');
      app.dock.setBadge('');
    } else {
      console.log('🏷️ Dock badge not supported on this platform');
    }
  } catch (error) {
    console.error('❌ Failed to clear dock badge:', error);
    throw error;
  }
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

// Conversion process management
interface ConversionProcess {
  id: string;
  process: any | null; // FFmpeg process (null when paused)
  status: 'converting' | 'paused' | 'stopped';
  inputPath: string;
  outputPath: string;
  targetFormat: string;
  downloadName: string;
  progress: number;
}

const activeConversions = new Map<string, ConversionProcess>();

// File conversion functionality
ipcMain.handle('convert-file', async (event, options) => {
  const {
    downloadId,
    inputPath,
    targetFormat,
    keepOriginal,
    downloadName,
    // saveToCustomLocation,
  } = options;

  try {
    console.log(
      `🔄 Starting conversion for ${downloadName} to ${targetFormat}`,
    );

    // Check if FFmpeg is available - use configured path
    const ffmpegPath =
      process.env.FFMPEG_PATH ||
      (process.platform === 'darwin' ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');

    // Generate output path
    const inputDir = path.dirname(inputPath);
    const inputName = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(inputDir, `${inputName}.${targetFormat}`);

    // Check if output file already exists
    if (existsSync(outputPath)) {
      return {
        success: false,
        error: `Output file already exists: ${outputPath}`,
      };
    }

    // Import spawn dynamically
    const { spawn } = await import('child_process');

    // Prepare FFmpeg command
    const ffmpegArgs = [
      '-i',
      inputPath,
      '-c:v',
      'libx264', // Video codec
      '-c:a',
      'aac', // Audio codec
      '-y', // Overwrite output file
      outputPath,
    ];

    console.log(`🎬 Running FFmpeg: ${ffmpegPath} ${ffmpegArgs.join(' ')}`);

    // Start FFmpeg process
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

    // Store the process for pause/resume/stop functionality
    const conversionProcess: ConversionProcess = {
      id: downloadId,
      process: ffmpegProcess,
      status: 'converting',
      inputPath,
      outputPath,
      targetFormat,
      downloadName,
      progress: 0,
    };

    activeConversions.set(downloadId, conversionProcess);

    return new Promise((resolve) => {
      let errorOutput = '';
      let isResolved = false; // Track if promise has been resolved

      ffmpegProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        errorOutput += output;

        // Parse progress from FFmpeg output (basic implementation)
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
        if (timeMatch) {
          // Update progress (simplified - would need duration to calculate percentage)
          // Increment by a small amount each time we get an update from FFmpeg
          // Limit to 95% to leave room for the final completion message
          if (conversionProcess.progress < 95) {
            conversionProcess.progress += 1;
          }

          // Send update to renderer so progress bar and speed graph can update
          if (mainWindow) {
            mainWindow.webContents.send(`ytdlp:download:status:${downloadId}`, {
              type: 'conversion',
              data: {
                status: 'converting',
                progress: conversionProcess.progress,
                log: `Conversion progress: ${conversionProcess.progress}%`,
              },
            });
          }
        }
      });

      ffmpegProcess.on('close', (code) => {
        const conversion = activeConversions.get(downloadId);

        // Check if this was an intentional pause or stop
        if (
          conversion &&
          (conversion.status === 'paused' || conversion.status === 'stopped')
        ) {
          console.log(
            `⏸️ FFmpeg process closed due to ${conversion.status} for download ${downloadId}`,
          );
          // Don't delete from activeConversions for paused, don't resolve promise
          // The pause/stop handler already returned success
          // For pause, we keep the conversion in the map
          // For stop, the stop handler will clean up
          return;
        }

        // Prevent duplicate resolutions
        if (isResolved) return;

        // Only delete if not intentionally paused/stopped
        if (
          !conversion ||
          (conversion.status !== 'paused' && conversion.status !== 'stopped')
        ) {
          activeConversions.delete(downloadId);
        }

        if (code === 0) {
          console.log(`✅ Conversion completed successfully: ${outputPath}`);

          // If not keeping original, delete the input file
          if (!keepOriginal) {
            try {
              fs.unlinkSync(inputPath);
              console.log(`🗑️ Removed original file: ${inputPath}`);
            } catch (error) {
              console.warn(
                `⚠️ Could not remove original file: ${error.message}`,
              );
            }
          }

          isResolved = true;
          resolve({
            success: true,
            outputPath,
            message: `Successfully converted to ${targetFormat}`,
          });
        } else {
          console.error(`❌ Conversion failed with code ${code}`);
          console.error(`FFmpeg error output: ${errorOutput}`);

          // Clean up partial output file
          if (existsSync(outputPath)) {
            try {
              fs.unlinkSync(outputPath);
            } catch (cleanupError) {
              console.warn(
                `Could not clean up partial file: ${cleanupError.message}`,
              );
            }
          }

          isResolved = true;
          resolve({
            success: false,
            error: `Conversion failed: FFmpeg exited with code ${code}`,
          });
        }
      });

      ffmpegProcess.on('error', (error) => {
        const conversion = activeConversions.get(downloadId);

        // Check if this was an intentional pause or stop
        if (
          conversion &&
          (conversion.status === 'paused' || conversion.status === 'stopped')
        ) {
          console.log(
            `⏸️ FFmpeg process error during ${conversion.status} (expected): ${error.message}`,
          );
          // Don't resolve with error if this was a pause/stop
          return;
        }

        // Prevent duplicate resolutions
        if (isResolved) return;

        // Only delete if not intentionally paused/stopped
        if (
          !conversion ||
          (conversion.status !== 'paused' && conversion.status !== 'stopped')
        ) {
          activeConversions.delete(downloadId);
        }

        console.error(`❌ FFmpeg process error: ${error.message}`);

        isResolved = true;
        resolve({
          success: false,
          error: `FFmpeg error: ${error.message}`,
        });
      });
    });
  } catch (error) {
    console.error(`❌ Conversion setup error: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
});

// Pause conversion
ipcMain.handle('pause-conversion', async (event, downloadId) => {
  try {
    const conversion = activeConversions.get(downloadId);

    if (!conversion) {
      return {
        success: false,
        error: 'Conversion not found or already completed',
      };
    }

    if (conversion.status === 'paused') {
      return {
        success: true,
        message: 'Conversion is already paused',
      };
    }

    // Mark as paused BEFORE killing the process to prevent race conditions
    conversion.status = 'paused';

    // Kill the FFmpeg process but keep the conversion state
    try {
      if (conversion.process) {
        conversion.process.kill('SIGTERM');
        console.log(`🛑 FFmpeg process terminated for pause: ${downloadId}`);
      }
    } catch (killError) {
      console.warn(`⚠️ Could not kill FFmpeg process: ${killError.message}`);
    }

    conversion.process = null; // Clear the dead process reference
    console.log(`⏸️ Conversion paused for download ${downloadId}`);

    // Send update to renderer to mark as paused
    if (event.sender && !event.sender.isDestroyed()) {
      event.sender.send('conversion-status-update', {
        downloadId,
        status: 'paused',
        message: 'Conversion paused',
      });
    }

    return {
      success: true,
      message: 'Conversion paused successfully',
    };
  } catch (error) {
    console.error(`❌ Error pausing conversion: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
});

// Resume conversion
ipcMain.handle('resume-conversion', async (event, downloadId) => {
  try {
    const conversion = activeConversions.get(downloadId);

    if (!conversion) {
      return {
        success: false,
        error: 'Conversion not found or already completed',
      };
    }

    if (conversion.status === 'converting') {
      return {
        success: true,
        message: 'Conversion is already running',
      };
    }

    if (conversion.status !== 'paused') {
      return {
        success: false,
        error: 'Conversion is not paused',
      };
    }

    // Restart the FFmpeg process from where we left off
    console.log(`🔄 Restarting FFmpeg process for download ${downloadId}`);

    try {
      // Import spawn dynamically
      const { spawn } = await import('child_process');

      // Check if FFmpeg is available
      const ffmpegPath =
        process.platform === 'darwin' ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';

      // Check if partial output exists and remove it to restart cleanly
      if (existsSync(conversion.outputPath)) {
        try {
          fs.unlinkSync(conversion.outputPath);
          console.log(
            `🗑️ Removed partial output file: ${conversion.outputPath}`,
          );
        } catch (cleanupError) {
          console.warn(
            `Could not remove partial file: ${cleanupError.message}`,
          );
        }
      }

      // Prepare FFmpeg command (same as original)
      const ffmpegArgs = [
        '-i',
        conversion.inputPath,
        '-c:v',
        'libx264', // Video codec
        '-c:a',
        'aac', // Audio codec
        '-y', // Overwrite output file
        conversion.outputPath,
      ];

      console.log(
        `🎬 Restarting FFmpeg: ${ffmpegPath} ${ffmpegArgs.join(' ')}`,
      );

      // Start new FFmpeg process
      const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

      // Update the conversion with new process
      conversion.process = ffmpegProcess;
      conversion.status = 'converting';

      // Set up event handlers for the new process
      return new Promise((resolve) => {
        let errorOutput = '';

        ffmpegProcess.stderr?.on('data', (data) => {
          const output = data.toString();
          errorOutput += output;

          // Parse progress from FFmpeg output
          const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
          if (timeMatch) {
            conversion.progress += 5;
            console.log(
              `⏳ Resumed conversion progress: ${conversion.progress}%`,
            );
          }
        });

        ffmpegProcess.on('close', (code) => {
          activeConversions.delete(downloadId);

          if (code === 0) {
            console.log(
              `✅ Resumed conversion completed successfully: ${conversion.outputPath}`,
            );
          } else {
            console.error(`❌ Resumed conversion failed with code ${code}`);
            console.error(`FFmpeg error output: ${errorOutput}`);

            // Clean up partial output file
            if (existsSync(conversion.outputPath)) {
              try {
                fs.unlinkSync(conversion.outputPath);
              } catch (cleanupError) {
                console.warn(
                  `Could not clean up partial file: ${cleanupError.message}`,
                );
              }
            }
          }
        });

        ffmpegProcess.on('error', (error) => {
          activeConversions.delete(downloadId);
          console.error(`❌ Resumed FFmpeg process error: ${error.message}`);
        });

        // Return success immediately since process started
        console.log(`▶️ Conversion resumed for download ${downloadId}`);
        resolve({
          success: true,
          message: 'Conversion resumed successfully',
        });
      });
    } catch (error) {
      console.error(`❌ Error restarting FFmpeg process: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  } catch (error) {
    console.error(`❌ Error resuming conversion: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
});

// Stop conversion
ipcMain.handle('stop-conversion', async (event, downloadId) => {
  try {
    const conversion = activeConversions.get(downloadId);

    if (!conversion) {
      return {
        success: false,
        error: 'Conversion not found or already completed',
      };
    }

    // Mark as stopped BEFORE killing the process to prevent race conditions
    conversion.status = 'stopped';

    // Kill the FFmpeg process
    if (conversion.process) {
      try {
        conversion.process.kill('SIGTERM');
        console.log(`🛑 FFmpeg process terminated for stop: ${downloadId}`);
      } catch (killError) {
        console.warn(`⚠️ Could not kill FFmpeg process: ${killError.message}`);
      }
    }

    // Clean up partial output file
    if (existsSync(conversion.outputPath)) {
      try {
        fs.unlinkSync(conversion.outputPath);
        console.log(
          `🗑️ Cleaned up partial conversion file: ${conversion.outputPath}`,
        );
      } catch (cleanupError) {
        console.warn(
          `Could not clean up partial file: ${cleanupError.message}`,
        );
      }
    }

    activeConversions.delete(downloadId);
    console.log(`🛑 Conversion stopped for download ${downloadId}`);

    return {
      success: true,
      message: 'Conversion stopped successfully',
    };
  } catch (error) {
    console.error(`❌ Error stopping conversion: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
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
  updateTrayVisibility();
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
