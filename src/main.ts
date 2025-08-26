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

// File system watcher approach - monitor Downloads directory for CC plugin files
import * as chokidar from 'chokidar';
const downloadsDir = path.join(os.homedir(), 'Downloads');

// Set up file watcher for CC plugin files
const watcher = chokidar.watch(`${downloadsDir}/**/*_mp4/**/*.{txt,docx,md}`, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true,
});

watcher.on('add', (filePath) => {
  console.log('🔍 [WATCHER] CC plugin file detected:', filePath);

  try {
    // Read the file content
    const content = fs.readFileSync(filePath, 'utf8');

    // Determine the correct save location (same directory as video)
    const fileName = path.basename(filePath);
    const videoName = fileName.split('.')[0]; // Remove extension
    const extension = path.extname(filePath);

    // Find the actual video file
    const files = fs.readdirSync(downloadsDir);
    const videoFiles = files.filter(
      (file) =>
        file.includes(videoName) &&
        (file.endsWith('.mp4') ||
          file.endsWith('.mkv') ||
          file.endsWith('.avi')),
    );

    if (videoFiles.length > 0) {
      // Save to correct location
      const correctPath = path.join(
        downloadsDir,
        `${path.parse(videoFiles[0]).name}${extension}`,
      );

      console.log(`🔍 [WATCHER] Moving file from: ${filePath}`);
      console.log(`🔍 [WATCHER] Moving file to: ${correctPath}`);

      fs.writeFileSync(correctPath, content, 'utf8');

      // Remove the original file and the _mp4 directory if empty
      fs.unlinkSync(filePath);

      try {
        const mp4Dir = path.dirname(filePath);
        if (fs.readdirSync(mp4Dir).length === 0) {
          fs.rmdirSync(mp4Dir);
        }
      } catch (error) {
        console.log('🔍 [WATCHER] Could not remove empty directory:', error);
      }

      console.log('🔍 [WATCHER] File successfully moved to video directory!');
    }
  } catch (error) {
    console.error('🔍 [WATCHER] Error moving file:', error);
  }
});

console.log(
  '🔍 [WATCHER] Monitoring Downloads directory for CC plugin files...',
);

// Also intercept any other potential file operations
const originalWriteFile = fs.writeFile;
fs.writeFile = function (filePath, data, options, callback) {
  if (typeof filePath === 'string') {
    console.log('🔍 [FS DEBUG] fs.writeFile called:', filePath);
  }
  return originalWriteFile.call(this, filePath, data, options, callback);
};

// Intercept dialog operations too
let originalShowSaveDialog: any;
// Global IPC interception to catch ALL IPC calls
const originalHandle = ipcMain.handle;
ipcMain.handle = function (channel: string, listener: (...args: any[]) => any) {
  const wrappedListener = async (...args: any[]) => {
    // Log ALL IPC calls to see what the CC plugin is using
    console.log(`🔍 [IPC INTERCEPT] ${channel} called`);
    if (args.length > 1) {
      console.log(
        `🔍 [IPC INTERCEPT] ${channel} args:`,
        JSON.stringify(args.slice(1), null, 2),
      );
    }

    const result = await listener(...args);

    // Log results for file-related operations
    if (
      channel.includes('file') ||
      channel.includes('save') ||
      channel.includes('write')
    ) {
      console.log(
        `🔍 [IPC INTERCEPT] ${channel} result:`,
        JSON.stringify(result, null, 2),
      );
    }

    return result;
  };
  return originalHandle.call(this, channel, wrappedListener);
};

app.whenReady().then(() => {
  originalShowSaveDialog = dialog.showSaveDialog;
  (dialog as any).showSaveDialog = async function (...args: any[]) {
    console.log(
      '🔍 [DIALOG DEBUG] showSaveDialog called with args:',
      JSON.stringify(args, null, 2),
    );
    const result = await originalShowSaveDialog.apply(this, args);
    console.log(
      '🔍 [DIALOG DEBUG] showSaveDialog result:',
      JSON.stringify(result, null, 2),
    );
    return result;
  };
});
import http from 'http';
import https from 'https';
import os from 'os';
import path from 'path';
import * as YTDLP from 'yt-dlp-helper';
import { checkForUpdates } from './DataFunctions/updateChecker';
import { PluginManager } from './plugins/pluginManager';
import { pluginRegistry } from './plugins/registry';

// Enhanced FFmpeg binary path configuration with Apple Silicon support
function getFfmpegBinaryPath(): string {
  console.log(
    `🏗️  System architecture: ${process.arch}, platform: ${process.platform}`,
  );

  // Try system installations first (prioritize Apple Silicon paths)
  const systemPaths = [
    '/opt/homebrew/bin/ffmpeg', // Apple Silicon Homebrew (M1/M2/M3/M4)
    '/usr/local/bin/ffmpeg', // Intel Homebrew (via Rosetta)
    '/opt/local/bin/ffmpeg', // MacPorts
    '/usr/bin/ffmpeg', // System installation
  ];

  for (const systemPath of systemPaths) {
    if (fs.existsSync(systemPath)) {
      console.log(`✅ Found system FFmpeg at: ${systemPath}`);
      try {
        // Quick accessibility check
        fs.accessSync(systemPath, fs.constants.X_OK);
        return systemPath;
      } catch (error) {
        console.warn(
          `⚠️ System FFmpeg at ${systemPath} is not executable:`,
          error.message,
        );
      }
    }
  }

  // Fallback to bundled FFmpeg with architecture detection
  if (app.isPackaged) {
    const arch = process.arch;
    console.log(
      `📦 Packaged app detected, looking for architecture-specific binaries...`,
    );

    // Try architecture-specific binary first
    const archSpecificPaths = [
      path.join(process.resourcesPath, `ffmpeg-${arch}`), // e.g., ffmpeg-arm64
      path.join(process.resourcesPath, 'binaries', `ffmpeg-${arch}`),
    ];

    for (const archPath of archSpecificPaths) {
      if (fs.existsSync(archPath)) {
        console.log(`✅ Using architecture-specific FFmpeg: ${archPath}`);
        return archPath;
      }
    }

    // Try universal/default binary
    const fallbackPaths = [
      path.join(process.resourcesPath, 'ffmpeg'),
      path.join(process.resourcesPath, 'binaries', 'ffmpeg'),
    ];

    for (const fallbackPath of fallbackPaths) {
      if (fs.existsSync(fallbackPath)) {
        console.log(`✅ Using fallback FFmpeg binary: ${fallbackPath}`);
        return fallbackPath;
      }
    }

    console.warn('⚠️ No bundled FFmpeg found! Some features may not work.');
    console.warn('💡 Install FFmpeg via Homebrew: brew install ffmpeg');
    return '/usr/bin/ffmpeg'; // Graceful fallback
  } else {
    // Development mode - enhanced detection
    const arch = process.arch;
    const devPaths = [
      path.join(__dirname, '..', '..', 'binaries', `ffmpeg-${arch}`),
      path.join(__dirname, '..', '..', `ffmpeg-${arch}`),
      path.join(__dirname, '..', '..', 'ffmpeg'),
      path.join(__dirname, '..', '..', 'binaries', 'ffmpeg'),
    ];

    for (const devPath of devPaths) {
      if (fs.existsSync(devPath)) {
        console.log(`🔧 Development: Using FFmpeg at ${devPath}`);
        return devPath;
      }
    }

    console.warn('⚠️ Development: No FFmpeg found in project directory');
    return '/usr/bin/ffmpeg';
  }
}

// Enhanced yt-dlp binary path configuration with comprehensive fallback
function getYtdlpBinaryPath(): string {
  console.log('🔍 Resolving yt-dlp binary path...');
  console.log(`   App packaged: ${app.isPackaged}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   Process resourcesPath: ${process.resourcesPath}`);
  console.log(`   __dirname: ${__dirname}`);

  if (app.isPackaged) {
    // In packaged app, try multiple potential locations
    const candidatePaths = [
      path.join(process.resourcesPath, 'yt-dlp'),
      path.join(process.resourcesPath, 'yt-dlp_macos'),
      path.join(path.dirname(process.execPath), 'yt-dlp'),
      path.join(path.dirname(process.execPath), 'Resources', 'yt-dlp'),
      path.join(path.dirname(process.execPath), 'Resources', 'yt-dlp_macos'),
    ];

    console.log('   Checking packaged app paths:');
    for (const candidatePath of candidatePaths) {
      const exists = fs.existsSync(candidatePath);
      console.log(`     ${candidatePath}: ${exists ? '✅' : '❌'}`);

      if (exists) {
        try {
          // Check if binary is executable
          fs.accessSync(candidatePath, fs.constants.X_OK);
          console.log(`   ✅ Selected packaged binary: ${candidatePath}`);
          return candidatePath;
        } catch (accessError) {
          console.warn(
            `   ⚠️  Binary found but not executable: ${candidatePath}`,
          );
          // Try to make it executable
          try {
            fs.chmodSync(candidatePath, 0o755);
            console.log(`   ✅ Made binary executable: ${candidatePath}`);
            return candidatePath;
          } catch (chmodError) {
            console.warn(
              `   ❌ Failed to make binary executable: ${chmodError.message}`,
            );
          }
        }
      }
    }

    console.warn('⚠️  No valid yt-dlp binary found in packaged app!');
    // Return the expected path anyway for error handling
    return path.join(process.resourcesPath, 'yt-dlp');
  } else {
    // Development mode - enhanced detection
    const candidatePaths = [
      path.join(__dirname, '..', '..', 'yt-dlp'),
      path.join(__dirname, '..', '..', 'yt-dlp_macos'),
      path.join(process.cwd(), 'yt-dlp'),
      path.join(process.cwd(), 'yt-dlp_macos'),
    ];

    console.log('   Checking development paths:');
    for (const candidatePath of candidatePaths) {
      const exists = fs.existsSync(candidatePath);
      console.log(`     ${candidatePath}: ${exists ? '✅' : '❌'}`);

      if (exists) {
        try {
          // Check if binary is executable
          fs.accessSync(candidatePath, fs.constants.X_OK);
          console.log(`   ✅ Selected development binary: ${candidatePath}`);

          // Create compatibility symlinks if needed
          const expectedPaths = [
            path.join(__dirname, '..', '..', 'yt-dlp'),
            path.join(__dirname, '..', '..', 'yt-dlp_macos'),
          ];

          for (const expectedPath of expectedPaths) {
            if (
              !fs.existsSync(expectedPath) &&
              expectedPath !== candidatePath
            ) {
              try {
                fs.symlinkSync(candidatePath, expectedPath);
                console.log(
                  `   ✅ Created compatibility symlink: ${expectedPath}`,
                );
              } catch (symlinkError) {
                try {
                  fs.copyFileSync(candidatePath, expectedPath);
                  fs.chmodSync(expectedPath, 0o755);
                  console.log(
                    `   ✅ Created compatibility copy: ${expectedPath}`,
                  );
                } catch (copyError) {
                  console.warn(
                    `   ⚠️  Failed to create compatibility binary: ${copyError.message}`,
                  );
                }
              }
            }
          }

          return candidatePath;
        } catch (accessError) {
          console.warn(
            `   ⚠️  Binary found but not executable: ${candidatePath}`,
          );
          // Try to make it executable
          try {
            fs.chmodSync(candidatePath, 0o755);
            console.log(`   ✅ Made binary executable: ${candidatePath}`);
            return candidatePath;
          } catch (chmodError) {
            console.warn(
              `   ❌ Failed to make binary executable: ${chmodError.message}`,
            );
          }
        }
      }
    }

    console.warn('⚠️  No valid yt-dlp binary found in development!');
    // Return the expected path anyway for error handling
    return path.join(__dirname, '..', '..', 'yt-dlp');
  }
}

// Enhanced FFmpeg setup with verification and PATH management
async function setupFfmpegPath(): Promise<void> {
  const ffmpegPath = getFfmpegBinaryPath();

  console.log(`🔧 Setting up FFmpeg: ${ffmpegPath}`);

  // Verify the binary works
  const isValid = await verifyFfmpegBinary(ffmpegPath);

  if (isValid) {
    // Add to PATH for yt-dlp integration
    const ffmpegDir = path.dirname(ffmpegPath);
    const currentPath = process.env.PATH || '';
    if (!currentPath.includes(ffmpegDir)) {
      process.env.PATH = ffmpegDir + path.delimiter + currentPath;
      console.log(`✅ Added FFmpeg to PATH: ${ffmpegDir}`);
    }
  } else {
    console.warn('⚠️ FFmpeg verification failed - some features may not work');
  }
}

// Enhanced binary verification
async function verifyFfmpegBinary(binaryPath: string): Promise<boolean> {
  if (!fs.existsSync(binaryPath)) {
    console.warn(`❌ FFmpeg binary not found: ${binaryPath}`);
    return false;
  }

  try {
    // Check if binary is executable
    await fs.promises.access(binaryPath, fs.constants.X_OK);

    // Quick version check to ensure it's working
    const { exec } = require('child_process'); // eslint-disable-line @typescript-eslint/no-var-requires
    return new Promise((resolve) => {
      exec(
        `"${binaryPath}" -version`,
        { timeout: 5000 },
        (error: any, stdout: any) => {
          if (error) {
            console.warn(`⚠️ FFmpeg verification failed: ${error.message}`);
            resolve(false);
          } else {
            const versionLine = stdout.split('\n')[0];
            console.log(`✅ FFmpeg verified: ${versionLine}`);
            resolve(true);
          }
        },
      );
    });
  } catch (error) {
    console.warn(`⚠️ FFmpeg access check failed: ${error.message}`);
    return false;
  }
}

// Add IPC handler for FFmpeg status checking
async function getFfmpegStatus(): Promise<{
  available: boolean;
  version?: string;
  path?: string;
  architecture?: string;
}> {
  const ffmpegPath = getFfmpegBinaryPath();
  const isValid = await verifyFfmpegBinary(ffmpegPath);

  if (!isValid) {
    return { available: false };
  }

  try {
    const { exec } = require('child_process'); // eslint-disable-line @typescript-eslint/no-var-requires
    return new Promise((resolve) => {
      exec(
        `"${ffmpegPath}" -version && file "${ffmpegPath}"`,
        { timeout: 5000 },
        (error: any, stdout: any) => {
          if (error) {
            resolve({ available: false });
          } else {
            const lines = stdout.split('\n');
            const versionLine = lines[0];
            const archLine =
              lines.find((line: string) => line.includes('Mach-O')) || '';
            const architecture = archLine.includes('arm64')
              ? 'Apple Silicon (ARM64)'
              : archLine.includes('x86_64')
              ? 'Intel (x86_64)'
              : 'Unknown';

            resolve({
              available: true,
              version: versionLine,
              path: ffmpegPath,
              architecture,
            });
          }
        },
      );
    });
  } catch (error) {
    return { available: false };
  }
}

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
let pluginManager: PluginManager;

let normalTrayIcon: Electron.NativeImage;
let alertTrayIcon: Electron.NativeImage;
let activityTrayIcon: Electron.NativeImage;
let isDownloadComplete = false;
let activityBlinkTimer: NodeJS.Timeout | null = null;
let isActivityActive = false;
let isBlinkOn = false;

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
  // Platform-specific window configuration
  const windowConfig: Electron.BrowserWindowConstructorOptions = {
    width: 1350,
    height: 680,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      nodeIntegration: true,
      // devTools: false,
    },
  };

  // Configure title bar based on platform
  if (process.platform === 'darwin') {
    // macOS: Use native title bar with traffic light buttons
    windowConfig.frame = true;
    windowConfig.titleBarStyle = 'hidden';
    windowConfig.trafficLightPosition = { x: 10, y: 10 };
    windowConfig.title = 'Downlodr';
    windowConfig.transparent = false;
    windowConfig.vibrancy = 'titlebar';
    windowConfig.visualEffectState = 'active';
  } else {
    // Windows/Linux: Keep custom frame
    windowConfig.frame = false;
    windowConfig.autoHideMenuBar = true;
  }

  // Create the browser window.
  mainWindow = new BrowserWindow(windowConfig);

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

  // focus tracking for clipboard monitoring
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

// Function to start activity indicator (blinking green dot)
function startActivityIndicator() {
  if (isActivityActive || !tray || !activityTrayIcon || !normalTrayIcon) {
    return;
  }

  isActivityActive = true;
  isBlinkOn = false;

  // Set initial activity icon
  tray.setImage(activityTrayIcon);
  tray.setToolTip('Downlodr - Download in progress');

  // Start blinking timer (blink every 800ms)
  activityBlinkTimer = setInterval(() => {
    if (!tray || !isActivityActive) {
      return;
    }

    if (isBlinkOn) {
      tray.setImage(normalTrayIcon);
      isBlinkOn = false;
    } else {
      tray.setImage(activityTrayIcon);
      isBlinkOn = true;
    }
  }, 800);
}

// Function to stop activity indicator
function stopActivityIndicator() {
  if (!isActivityActive) {
    return;
  }

  isActivityActive = false;
  isBlinkOn = false;

  // Clear the blinking timer
  if (activityBlinkTimer) {
    clearInterval(activityBlinkTimer);
    activityBlinkTimer = null;
  }

  // Reset to normal icon
  if (tray && normalTrayIcon) {
    tray.setImage(normalTrayIcon);
    tray.setToolTip('Downlodr');
  }
}

const createTray = () => {
  // Get correct path based on whether in dev or production
  let iconPath, alertIconPath;

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // Development mode paths
    iconPath = path.join(
      process.cwd(),
      'src/Assets/AppLogo/systemTray/logo/systemIcon.png',
    );
    alertIconPath = path.join(
      process.cwd(),
      'src/Assets/AppLogo/systemTray/logo/systemNotif.png',
    );
  } else {
    // Production mode paths
    iconPath = path.join(
      process.resourcesPath,
      'AppLogo/systemTray/logo/systemIcon.png',
    );
    alertIconPath = path.join(
      process.resourcesPath,
      'AppLogo/systemTray/logo/systemNotif.png',
    );
  }

  // Create both icons with proper sizing for macOS
  normalTrayIcon = nativeImage.createFromPath(iconPath);
  alertTrayIcon = nativeImage.createFromPath(alertIconPath);

  // Use alert icon as activity icon for simplicity
  activityTrayIcon = alertTrayIcon;

  // Resize icons for macOS tray (16x16 points with 2x scale for Retina)
  if (process.platform === 'darwin') {
    normalTrayIcon = normalTrayIcon.resize({ width: 16, height: 16 });
    alertTrayIcon = alertTrayIcon.resize({ width: 16, height: 16 });
    activityTrayIcon = activityTrayIcon.resize({ width: 16, height: 16 });

    // Set template image for macOS (enables dark mode adaptation)
    normalTrayIcon.setTemplateImage(true);
    alertTrayIcon.setTemplateImage(true);
    // Don't set activity icon as template to preserve green color
  }

  // Initialize with normal icon
  tray = new Tray(normalTrayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Downlodr',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          resetTrayIcon(); // Reset icon when showing app

          // On macOS, bring app to front
          if (process.platform === 'darwin') {
            app.dock.show();
          }
        }
      },
    },

    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: async () => {
        if (mainWindow) {
          // Show the window first to ensure toast notifications are visible
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();

          if (process.platform === 'darwin') {
            app.dock.show();
          }

          // Send checking message to renderer
          mainWindow.webContents.send('update-check-started');

          try {
            const updateInfo = await checkForUpdates();
            // Send update result to renderer for proper toast handling
            mainWindow.webContents.send('update-check-completed', updateInfo);
          } catch (error) {
            // Send error to renderer for error toast
            mainWindow.webContents.send('update-check-error', error);
          }
        }
      },
    },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();

          // Open settings modal
          mainWindow.webContents.send('open-settings-modal');

          if (process.platform === 'darwin') {
            app.dock.show();
          }
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Downlodr',
      accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
      click: () => {
        forceQuit = true;
        // Set to BLANK_STATE before quitting
        lastClipboardText = 'BLANK_STATE';
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Downlodr - Download Manager');
  tray.setContextMenu(contextMenu);

  // Handle tray icon click behavior (different per platform)
  if (process.platform === 'darwin') {
    // macOS: Single click shows context menu, double click shows app
    tray.on('double-click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        resetTrayIcon();
        app.dock.show();
      }
    });
  } else {
    // Windows/Linux: Single click shows app
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        resetTrayIcon();
      }
    });
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
  if (!browserWindow) {
    return null;
  }

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
    const ytdlpPath = getYtdlpBinaryPath();
    console.log('🔄 Fetching playlist info for:', videoUrl.url);
    console.log('Using yt-dlp binary for playlist at:', ytdlpPath);
    console.log('Playlist binary exists:', fs.existsSync(ytdlpPath));

    // Validate the URL before processing
    if (!videoUrl.url || typeof videoUrl.url !== 'string') {
      throw new Error('Invalid URL provided for playlist fetching');
    }

    const ffmpegPath = getFfmpegBinaryPath();
    console.log('Using ffmpeg binary at:', ffmpegPath);
    console.log('FFmpeg binary exists:', fs.existsSync(ffmpegPath));

    // Use custom playlist implementation to fix chunking issue
    // The original yt-dlp-helper has a bug where it tries to parse each chunk
    // of JSON individually instead of accumulating all chunks first
    const { getPlaylistInfo } = await import('./Utils/customPlaylistHelper.js');

    const info = await getPlaylistInfo({
      url: videoUrl.url,
      ytdlpPath,
      ffmpegPath,
    });

    console.log('📊 Playlist info result:', {
      success: info.ok,
      hasData: !!info.data,
      title: info.data?.title || 'No title',
      entryCount: info.data?.entries?.length || 0,
    });

    // If the result is not ok, provide more detailed error information
    if (!info.ok) {
      console.warn('⚠️ Playlist info fetch was not successful');
      console.warn('Error details:', info.error);

      // Return a more descriptive error
      return {
        ok: false,
        error:
          info.error ||
          'Failed to fetch playlist information. This could be due to a private playlist, network issues, or the playlist being unavailable.',
        originalResult: info,
      };
    }

    return info;
  } catch (error) {
    console.error('❌ Error fetching playlist info:', {
      message: error.message,
      stack: error.stack,
      url: videoUrl.url,
    });

    // Provide more specific error messages based on error content
    let userFriendlyMessage = 'Failed to fetch playlist information';

    if (error.message.includes('spawn') || error.message.includes('ENOENT')) {
      userFriendlyMessage = 'yt-dlp binary not found or not executable';
    } else if (
      error.message.includes('network') ||
      error.message.includes('timeout')
    ) {
      userFriendlyMessage = 'Network error while fetching playlist information';
    } else if (error.message.includes('playlist does not exist')) {
      userFriendlyMessage =
        'The playlist is private, does not exist, or is unavailable';
    } else if (
      error.message.includes('permission') ||
      error.message.includes('forbidden')
    ) {
      userFriendlyMessage =
        'Access denied - the playlist may be private or restricted';
    }

    // Create an enhanced error object
    const enhancedError = new Error(userFriendlyMessage) as Error & {
      originalError?: Error;
      url?: string;
    };
    enhancedError.originalError = error;
    enhancedError.url = videoUrl.url;

    throw enhancedError;
  }
});

// get the video information
ipcMain.handle('ytdlp:info', async (e, url) => {
  YTDLP.Config.log = true;
  try {
    const ytdlpPath = getYtdlpBinaryPath();
    console.log('🔍 YT-DLP Info Request Details:');
    console.log('  URL:', url);
    console.log('  Binary path:', ytdlpPath);
    console.log('  Binary exists:', fs.existsSync(ytdlpPath));
    console.log('  App is packaged:', app.isPackaged);
    console.log('  Process resourcesPath:', process.resourcesPath);

    // Enhanced binary validation
    if (!fs.existsSync(ytdlpPath)) {
      const errorMessage = `yt-dlp binary not found at: ${ytdlpPath}`;
      console.error('❌', errorMessage);
      return {
        error: errorMessage,
        ok: false,
        details: {
          path: ytdlpPath,
          exists: false,
          executable: false,
          packaged: app.isPackaged,
        },
      };
    }

    // Check binary permissions on macOS/Linux
    if (process.platform !== 'win32') {
      try {
        const stats = fs.statSync(ytdlpPath);
        const isExecutable = !!(stats.mode & parseInt('111', 8));
        console.log('  Binary mode:', stats.mode.toString(8));
        console.log('  Binary is executable:', isExecutable);

        if (!isExecutable) {
          console.log('  🔧 Attempting to make binary executable...');
          try {
            fs.chmodSync(ytdlpPath, 0o755);
            console.log('  ✅ Binary made executable');
          } catch (chmodError) {
            const errorMessage = `yt-dlp binary is not executable and cannot be made executable: ${chmodError.message}`;
            console.error('❌', errorMessage);
            return {
              error: errorMessage,
              ok: false,
              details: {
                path: ytdlpPath,
                exists: true,
                executable: false,
                chmodError: chmodError.message,
              },
            };
          }
        }

        // Test if the binary can actually be accessed
        try {
          fs.accessSync(ytdlpPath, fs.constants.X_OK);
          console.log('  ✅ Binary access confirmed');
        } catch (accessError) {
          const errorMessage = `yt-dlp binary cannot be executed: ${accessError.message}`;
          console.error('❌', errorMessage);
          return {
            error: errorMessage,
            ok: false,
            details: {
              path: ytdlpPath,
              exists: true,
              executable: false,
              accessError: accessError.message,
            },
          };
        }
      } catch (permError) {
        console.warn(
          '  ⚠️  Could not check binary permissions:',
          permError.message,
        );
      }
    }

    if (!fs.existsSync(ytdlpPath)) {
      // Try alternative paths if the main path doesn't exist
      const alternativePaths: string[] = [];

      if (app.isPackaged) {
        // Alternative packaged paths
        alternativePaths.push(
          path.join(process.resourcesPath, 'yt-dlp_macos'),
          path.join(process.resourcesPath, 'yt-dlp.exe'),
          path.join(path.dirname(process.execPath), 'yt-dlp'),
          path.join(path.dirname(process.execPath), 'Resources', 'yt-dlp'),
        );
      } else {
        // Alternative development paths
        alternativePaths.push(
          path.join(__dirname, '..', '..', 'yt-dlp_macos'),
          path.join(process.cwd(), 'yt-dlp'),
          path.join(process.cwd(), 'yt-dlp_macos'),
        );
      }

      console.log('  Checking alternative paths:');
      for (const altPath of alternativePaths) {
        const exists = fs.existsSync(altPath);
        console.log(`    ${altPath}: ${exists ? '✅' : '❌'}`);
        if (exists) {
          console.log(`  Using alternative path: ${altPath}`);
          // Try to make it executable
          try {
            fs.chmodSync(altPath, 0o755);
          } catch (chmodError) {
            console.warn(
              '  Could not make binary executable:',
              chmodError.message,
            );
          }

          // Update the path for this request
          const ffmpegPath = getFfmpegBinaryPath();
          const result = await YTDLP.invoke({
            args: [
              url,
              '--no-warnings',
              '--dump-json',
              '--ffmpeg-location',
              ffmpegPath,
            ],
            ytdlpDownloadDestination: altPath,
            downloadBinary: { ytdlp: false, ffmpeg: false }, // Don't download ffmpeg, use bundled
          });

          if (!result.ok) {
            throw new Error(
              `yt-dlp execution failed: ${result.data || 'Unknown error'}`,
            );
          }

          const info = {
            ok: true,
            data: JSON.parse(result.data || '{}'),
          };
          return info;
        }
      }

      throw new Error(
        `yt-dlp binary not found at ${ytdlpPath} or any alternative locations`,
      );
    }

    // Make sure binary is executable
    try {
      fs.chmodSync(ytdlpPath, 0o755);
    } catch (chmodError) {
      console.warn('Could not make binary executable:', chmodError.message);
    }

    // Use invoke instead of getInfo to specify binary path
    const ffmpegPath = getFfmpegBinaryPath();
    console.log('🔧 FFmpeg Configuration:');
    console.log('  Binary path:', ffmpegPath);
    console.log('  Binary exists:', fs.existsSync(ffmpegPath));

    // Check FFmpeg binary permissions on macOS/Linux
    if (process.platform !== 'win32' && fs.existsSync(ffmpegPath)) {
      try {
        const ffmpegStats = fs.statSync(ffmpegPath);
        const ffmpegExecutable = !!(ffmpegStats.mode & parseInt('111', 8));
        console.log('  Binary mode:', ffmpegStats.mode.toString(8));
        console.log('  Binary is executable:', ffmpegExecutable);

        if (!ffmpegExecutable) {
          console.log('  🔧 Attempting to make FFmpeg executable...');
          try {
            fs.chmodSync(ffmpegPath, 0o755);
            console.log('  ✅ FFmpeg made executable');
          } catch (ffmpegChmodError) {
            console.warn(
              '  ⚠️  Could not make FFmpeg executable:',
              ffmpegChmodError.message,
            );
          }
        }
      } catch (ffmpegPermError) {
        console.warn(
          '  ⚠️  Could not check FFmpeg permissions:',
          ffmpegPermError.message,
        );
      }
    }

    const result = await YTDLP.invoke({
      args: [
        url,
        '--no-warnings',
        '--dump-json',
        '--ffmpeg-location',
        ffmpegPath,
      ],
      ytdlpDownloadDestination: ytdlpPath,
      downloadBinary: { ytdlp: false, ffmpeg: false }, // Don't download ffmpeg, use bundled
    });

    if (!result.ok) {
      throw new Error(
        `yt-dlp execution failed: ${result.data || 'Unknown error'}`,
      );
    }

    const info = {
      ok: true,
      data: JSON.parse(result.data || '{}'),
    };

    if (!info.data || Object.keys(info.data).length === 0) {
      throw new Error('yt-dlp returned empty data');
    }

    console.log('✅ Video info fetched successfully:', {
      title: info.data.title || 'Unknown',
      extractor: info.data.extractor_key || 'Unknown',
    });

    return info;
  } catch (error) {
    console.error('❌ Error fetching video info:', {
      message: error.message,
      stack: error.stack,
      url: url,
    });
    return { error: error.message, ok: false };
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
    const ytdlpPath = getYtdlpBinaryPath();
    console.log('Using yt-dlp binary for download at:', ytdlpPath);
    console.log('Download binary exists:', fs.existsSync(ytdlpPath));

    const ffmpegPath = getFfmpegBinaryPath();
    console.log('Using ffmpeg binary for download at:', ffmpegPath);
    console.log('FFmpeg binary exists:', fs.existsSync(ffmpegPath));

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
      ytdlpDownloadDestination: ytdlpPath,
      ffmpegDownloadDestination: ffmpegPath, // Use our bundled ffmpeg
      downloadBinary: { ytdlp: false, ffmpeg: false }, // Don't download ffmpeg, use bundled
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

  // Setup ffmpeg path for yt-dlp merging
  await setupFfmpegPath();

  // Test yt-dlp path on startup
  console.log('=== YT-DLP PATH TEST ===');
  const testPath = getYtdlpBinaryPath();
  console.log('Resolved yt-dlp path:', testPath);
  console.log('=== END PATH TEST ===');

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
  if (win) {
    menu.popup({ window: win });
  }
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

// Activity indicator controls
ipcMain.handle('start-activity-indicator', async () => {
  startActivityIndicator();
  return true;
});

ipcMain.handle('stop-activity-indicator', async () => {
  stopActivityIndicator();
  return true;
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

  console.log('📱 Download finished event received:', name);

  // NOTE: Notification is now handled by NotificationManager component in renderer
  // This maintains the legacy tray icon behavior only

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

// Enhanced notification system with native macOS support
let notificationPermissionGranted = false;

// Check for notification permissions
async function checkNotificationPermissions(): Promise<boolean> {
  if (!Notification.isSupported()) {
    console.warn('Notifications not supported on this platform');
    return false;
  }

  // On macOS, ensure dock icon is visible for notifications to work
  if (process.platform === 'darwin') {
    try {
      // Show dock icon to enable notifications
      if (app.dock) {
        app.dock.show();
        console.log('✅ Dock icon shown for notifications');
      }
    } catch (error) {
      console.warn('Failed to show dock icon:', error);
    }
  }

  // On macOS, Electron handles permissions automatically for bundled apps
  notificationPermissionGranted = true;
  console.log('✅ Notification permissions granted');
  return true;
}

// Native notification handler
ipcMain.handle(
  'notification:show',
  async (
    _event,
    config: {
      title: string;
      body: string;
      icon?: string;
      actions?: Array<{ action: string; title: string }>;
    },
  ) => {
    try {
      console.log(
        '📱 Main process: Received notification request:',
        config.title,
      );
      console.log('🔍 Notification.isSupported():', Notification.isSupported());
      console.log(
        '🔍 notificationPermissionGranted:',
        notificationPermissionGranted,
      );

      if (!Notification.isSupported() || !notificationPermissionGranted) {
        console.warn(
          '❌ Notifications not supported or permission not granted',
        );
        return null;
      }

      // Resolve notification icon path
      let iconPath: string;

      if (config.icon) {
        if (app.isPackaged) {
          // In production, notification icon is in Contents/Resources/AppLogo/
          const productionIconPath = path.join(
            process.resourcesPath,
            'AppLogo',
            'notif.png',
          );

          // Check if notification icon exists, otherwise use tray icon path
          if (fs.existsSync(productionIconPath)) {
            iconPath = productionIconPath;
            console.log(
              '✅ Using production notification icon:',
              productionIconPath,
            );
          } else {
            console.log(
              '⚠️ Notification icon not found at:',
              productionIconPath,
              'using tray icon',
            );
            iconPath = normalTrayIcon.toDataURL
              ? normalTrayIcon.toDataURL()
              : (normalTrayIcon as any);
          }
        } else {
          // In development, use relative path
          const devIconPath = path.join(
            __dirname,
            '..',
            'src',
            'Assets',
            'AppLogo',
            'notif.png',
          );
          if (fs.existsSync(devIconPath)) {
            iconPath = devIconPath;
            console.log('✅ Using development notification icon:', devIconPath);
          } else {
            console.log('⚠️ Dev notification icon not found, using tray icon');
            iconPath = normalTrayIcon.toDataURL
              ? normalTrayIcon.toDataURL()
              : (normalTrayIcon as any);
          }
        }
      } else {
        // Use tray icon as fallback
        iconPath = normalTrayIcon.toDataURL
          ? normalTrayIcon.toDataURL()
          : (normalTrayIcon as any);
      }

      console.log(
        `📱 Creating notification with icon: ${
          typeof iconPath === 'string' ? iconPath : 'NativeImage'
        }`,
      );

      const notification = new Notification({
        title: config.title,
        body: config.body,
        icon: iconPath,
        sound: 'default', // macOS system sound
        urgency: 'normal' as const,
      });

      // Handle notification click to show app window
      notification.on('click', () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.show();
          mainWindow.focus();

          // Reset tray icon when app is shown via notification
          resetTrayIcon();
        }
      });

      // Show the notification
      notification.show();

      return {
        title: config.title,
        body: config.body,
        icon: config.icon,
      };
    } catch (error) {
      console.error('Failed to show notification:', error);
      return null;
    }
  },
);

// Request notification permissions
ipcMain.handle('notification:request-permissions', async () => {
  try {
    notificationPermissionGranted = await checkNotificationPermissions();
    return notificationPermissionGranted;
  } catch (error) {
    console.error('Failed to request notification permissions:', error);
    return false;
  }
});

// Check if notifications are allowed
ipcMain.handle('notification:has-permissions', async () => {
  return notificationPermissionGranted;
});

// Dock badge counter management
let currentBadgeCount = 0;

// Set dock badge count
ipcMain.handle('dock-badge:set-count', async (_event, count: number) => {
  try {
    currentBadgeCount = Math.max(0, count);

    // On macOS, set the dock badge
    if (process.platform === 'darwin') {
      // Ensure dock icon is visible when setting badge
      if (app.dock && currentBadgeCount > 0) {
        app.dock.show();
      }

      const success = app.setBadgeCount(currentBadgeCount);
      console.log(
        `🏷️ Dock badge set to ${currentBadgeCount}, success:`,
        success !== false,
      );

      // Verify the badge was set
      const actualCount = app.getBadgeCount();
      console.log(`🔍 Actual dock badge count: ${actualCount}`);
    }

    return true;
  } catch (error) {
    console.error('Failed to set dock badge count:', error);
    return false;
  }
});

// Get current dock badge count
ipcMain.handle('dock-badge:get-count', async () => {
  return currentBadgeCount;
});

// Clear dock badge
ipcMain.handle('dock-badge:clear', async () => {
  try {
    currentBadgeCount = 0;

    if (process.platform === 'darwin') {
      const success = app.setBadgeCount(0);
      console.log('🏷️ Dock badge cleared, success:', success !== false);

      // Verify the badge was cleared
      const actualCount = app.getBadgeCount();
      console.log(`🔍 Actual dock badge count after clear: ${actualCount}`);
    }

    return true;
  } catch (error) {
    console.error('Failed to clear dock badge:', error);
    return false;
  }
});

// Initialize notification permissions on app ready
app.whenReady().then(async () => {
  await checkNotificationPermissions();
});

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

// Storage for current plugin context (video path)
let currentPluginVideoPath: string | null = null;

// handler to execute plugin menu items
ipcMain.handle('plugins:execute-menu-item', (event, id, contextData) => {
  console.log(
    '🔍 [CC DEBUG] executeMenuItem called with contextData:',
    JSON.stringify(contextData, null, 2),
  );

  // Store video path for CC-related plugins
  if (
    contextData &&
    contextData.location &&
    typeof contextData.location === 'string'
  ) {
    // Check if this is a CC-related plugin by ID or context
    if (
      id.includes('cc') ||
      id.includes('markdown') ||
      id.includes('transcript')
    ) {
      currentPluginVideoPath = contextData.location;
      console.log(
        `🔍 [CC DEBUG] Stored video path for CC plugin: ${currentPluginVideoPath}`,
      );

      // Clear the stored path after 30 seconds to prevent stale context
      setTimeout(() => {
        if (currentPluginVideoPath === contextData.location) {
          currentPluginVideoPath = null;
          console.log('🔍 [CC DEBUG] Cleared stored video path (timeout)');
        }
      }, 30000);
    }
  }

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
  console.log(
    '🔍 [CC DEBUG] plugins:save-file-dialog called with options:',
    JSON.stringify(options, null, 2),
  );

  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  if (!browserWindow) {
    return { canceled: true };
  }

  // Enhanced default path logic for CC/transcript files
  let defaultPath = app.getPath('downloads');
  console.log(`🔍 [CC DEBUG] Initial defaultPath: ${defaultPath}`);

  // If this is a CC to Markdown or transcript-related operation, try to use video directory
  // First check explicit videoPath, then check stored plugin context
  const videoPath = options.videoPath || currentPluginVideoPath;

  if (videoPath && typeof videoPath === 'string') {
    console.log(
      `🔍 [CC DEBUG] Using video path: ${videoPath} (explicit: ${!!options.videoPath}, stored: ${!!currentPluginVideoPath})`,
    );

    const videoDir = path.dirname(videoPath);
    const videoBaseName = path.basename(videoPath, path.extname(videoPath));

    // Determine file extension from title or options
    let extension = '.txt';
    if (options.title && typeof options.title === 'string') {
      if (options.title.toLowerCase().includes('markdown')) {
        extension = '.md';
      } else if (options.title.toLowerCase().includes('docx')) {
        extension = '.docx';
      }
    }

    // Use exact video filename with new extension (direct approach)
    const suggestedFileName = `${videoBaseName}${extension}`;
    defaultPath = path.join(videoDir, suggestedFileName);
    console.log(`🔍 [CC DEBUG] Using explicit videoPath: ${defaultPath}`);
  } else if (
    // Auto-detect CC/transcript operations even without videoPath
    options.title &&
    (options.title.toLowerCase().includes('cc') ||
      options.title.toLowerCase().includes('markdown') ||
      options.title.toLowerCase().includes('transcript') ||
      options.title.toLowerCase().includes('caption') ||
      options.title.toLowerCase().includes('subtitle'))
  ) {
    console.log(
      '🔍 Auto-detecting CC operation, searching for video context...',
    );

    const downloadsDir = app.getPath('downloads');
    let videoFile = null;

    try {
      // Get all video files in Downloads directory
      const files = fs.readdirSync(downloadsDir);
      const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];

      const videoFiles = files
        .filter((file) =>
          videoExtensions.some((ext) =>
            file.toLowerCase().endsWith(ext.toLowerCase()),
          ),
        )
        .map((file) => {
          const fullPath = path.join(downloadsDir, file);
          const stats = fs.statSync(fullPath);
          return { path: fullPath, mtime: stats.mtime, name: file };
        })
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // Most recent first

      if (videoFiles.length > 0) {
        // Use most recent video file
        videoFile = videoFiles[0].path;
        console.log(`📽️ Using most recent video file: ${videoFiles[0].name}`);
      }
    } catch (error) {
      console.warn('Error scanning for video files:', error);
    }

    if (videoFile) {
      const videoDir = path.dirname(videoFile);
      const videoBaseName = path.basename(videoFile, path.extname(videoFile));

      // Determine extension from title
      let extension = '.txt';
      if (options.title.toLowerCase().includes('markdown')) {
        extension = '.md';
      } else if (options.title.toLowerCase().includes('docx')) {
        extension = '.docx';
      }

      // Use exact video filename with new extension (direct approach)
      const suggestedFileName = `${videoBaseName}${extension}`;
      defaultPath = path.join(videoDir, suggestedFileName);
      console.log(`🔍 [CC DEBUG] Auto-detected CC save path: ${defaultPath}`);
    }
  } else if (options.defaultPath && typeof options.defaultPath === 'string') {
    defaultPath = options.defaultPath;
    console.log(`🔍 [CC DEBUG] Using provided defaultPath: ${defaultPath}`);
  } else {
    console.log(
      `🔍 [CC DEBUG] No CC detection, using Downloads folder: ${defaultPath}`,
    );
  }

  console.log(`🔍 [CC DEBUG] Final defaultPath before dialog: ${defaultPath}`);

  // Security check: validate options
  const sanitizedOptions = {
    title: typeof options.title === 'string' ? options.title : 'Save File',
    defaultPath,
    filters: Array.isArray(options.filters) ? options.filters : undefined,
    message: typeof options.message === 'string' ? options.message : undefined,
  };

  try {
    console.log(
      `🔍 [CC DEBUG] Showing save dialog with sanitizedOptions:`,
      JSON.stringify(sanitizedOptions, null, 2),
    );
    const result = await dialog.showSaveDialog(browserWindow, sanitizedOptions);
    console.log(
      `🔍 [CC DEBUG] Save dialog result:`,
      JSON.stringify(result, null, 2),
    );

    // Clear stored video path after successful save dialog (user has seen the correct path)
    if (!result.canceled && currentPluginVideoPath) {
      console.log(
        '🔍 [CC DEBUG] Clearing stored video path after successful save dialog',
      );
      currentPluginVideoPath = null;
    }

    return result;
  } catch (error) {
    console.log(`🔍 [CC DEBUG] Save dialog error:`, error);
    return { canceled: true };
  }
});

// handler to register taskbar items
ipcMain.handle('plugins:register-taskbar-item', (event, taskBarItem) => {
  //console.log('Main process registering taskbar item:', taskBarItem);
  return pluginRegistry.registerTaskBarItem(taskBarItem);
});

// handler to unregister taskbar items
ipcMain.handle('plugins:unregister-taskbar-item', (event, id) => {
  //console.log('Main process unregistering taskbar item:', id);
  pluginRegistry.unregisterTaskBarItem(id);
  return true;
});

// handler to get taskbar items
ipcMain.handle('plugins:taskbar-items', (event) => {
  return pluginRegistry.getTaskBarItems();
});

// handler to execute taskbar items
ipcMain.handle('plugins:execute-taskbar-item', (event, id, contextData) => {
  console.log('Executing taskbar item action:', id, contextData);
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
    if (mainWindow) {
      mainWindow.webContents.send('plugin:close-panel');
    }
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

// Enhanced FFmpeg status IPC handler
ipcMain.handle('check-ffmpeg-status', async () => {
  try {
    const status = await getFfmpegStatus();
    console.log('🔧 FFmpeg status check result:', status);
    return status;
  } catch (error) {
    console.error('❌ FFmpeg status check failed:', error);
    return { available: false, error: error.message };
  }
});

// Helper function to handle text format conversions (CC to Markdown, etc.)
async function handleTextFormatConversion(
  inputPath: string,
  outputPath: string,
  targetFormat: string,
  downloadId: string,
  event: Electron.IpcMainInvokeEvent,
  saveToCustomLocation = false,
): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  try {
    const targetFormatLower = targetFormat.toLowerCase();

    // Check if there's a caption file associated with the video
    const inputDir = path.dirname(inputPath);
    const inputBaseName = path.basename(inputPath, path.extname(inputPath));

    // Look for various caption file formats that might exist
    const possibleCaptionExtensions = [
      '.vtt',
      '.srt',
      '.ass',
      '.ssa',
      '.ttml',
      '.en.vtt',
    ];
    let captionFilePath = null;

    for (const ext of possibleCaptionExtensions) {
      const candidatePath = path.join(inputDir, `${inputBaseName}${ext}`);
      if (fs.existsSync(candidatePath)) {
        captionFilePath = candidatePath;
        break;
      }
    }

    if (!captionFilePath) {
      // If no caption file found, try to extract captions from the video using FFmpeg
      const ffmpegPath = getFfmpegBinaryPath();
      if (fs.existsSync(ffmpegPath)) {
        // Try to extract subtitles using FFmpeg (if embedded)
        const tempCaptionPath = path.join(
          inputDir,
          `${inputBaseName}_temp.vtt`,
        );

        const { spawn } = require('child_process'); // eslint-disable-line @typescript-eslint/no-var-requires
        const extractProcess = spawn(ffmpegPath, [
          '-i',
          inputPath,
          '-map',
          '0:s:0', // Extract first subtitle stream
          '-c:s',
          'webvtt',
          '-y',
          tempCaptionPath,
        ]);

        await new Promise((resolve) => {
          extractProcess.on('close', (code: number) => {
            if (code === 0 && fs.existsSync(tempCaptionPath)) {
              captionFilePath = tempCaptionPath;
            }
            resolve(code);
          });

          extractProcess.on('error', () => {
            resolve(-1);
          });
        });
      }
    }

    if (!captionFilePath) {
      return {
        success: false,
        error:
          'No caption file found for conversion. Please ensure the video has captions or download captions first.',
      };
    }

    // Read the caption content
    let captionContent = '';
    try {
      captionContent = fs.readFileSync(captionFilePath, 'utf8');
    } catch (error) {
      return {
        success: false,
        error: `Failed to read caption file: ${error.message}`,
      };
    }

    // Convert to the target format
    let convertedContent = '';

    switch (targetFormatLower) {
      case 'txt':
        convertedContent = convertVttToPlainText(captionContent);
        break;
      case 'md':
      case 'markdown':
        convertedContent = convertVttToMarkdown(captionContent);
        break;
      case 'docx':
        // For DOCX, we'll create a simple text format and let the user know
        convertedContent = convertVttToPlainText(captionContent);
        break;
      default:
        return {
          success: false,
          error: `Unsupported text format: ${targetFormat}`,
        };
    }

    let finalOutputPath = outputPath;

    // Handle custom location saving vs automatic saving
    if (saveToCustomLocation) {
      // Show save dialog for custom location
      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      if (browserWindow) {
        const saveResult = await dialog.showSaveDialog(browserWindow, {
          title: `Save ${targetFormat.toUpperCase()} File`,
          defaultPath: outputPath,
          filters: [
            {
              name: `${targetFormat.toUpperCase()} files`,
              extensions: [targetFormatLower],
            },
            { name: 'All files', extensions: ['*'] },
          ],
        });

        if (saveResult.canceled) {
          return {
            success: false,
            error: 'Save operation was canceled by user',
          };
        }

        finalOutputPath = saveResult.filePath;
      }
    }

    // Write the converted content to the final output path
    fs.writeFileSync(finalOutputPath, convertedContent, 'utf8');

    // Clean up temporary caption file if we created one
    if (captionFilePath.includes('_temp.vtt')) {
      try {
        fs.unlinkSync(captionFilePath);
      } catch (error) {
        console.warn(
          'Could not clean up temporary caption file:',
          error.message,
        );
      }
    }

    return {
      success: true,
      outputPath: finalOutputPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Unknown error during text format conversion',
    };
  }
}

// Helper function to convert VTT captions to plain text
function convertVttToPlainText(vttContent: string): string {
  const lines = vttContent.split('\n');
  const textLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip VTT header, timestamps, and empty lines
    if (
      trimmedLine === 'WEBVTT' ||
      trimmedLine === '' ||
      trimmedLine.match(
        /^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/,
      ) ||
      trimmedLine.match(/^NOTE/)
    ) {
      continue;
    }

    // Remove HTML tags and style formatting
    const cleanedLine = trimmedLine
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"');

    if (cleanedLine.length > 0) {
      textLines.push(cleanedLine);
    }
  }

  return textLines.join('\n\n');
}

// Helper function to convert VTT captions to Markdown
function convertVttToMarkdown(vttContent: string): string {
  const plainText = convertVttToPlainText(vttContent);
  const lines = plainText.split('\n\n');

  // Create a simple markdown format
  let markdown = '# Video Transcript\n\n';

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) {
      // Add paragraph numbers for better navigation
      markdown += `**${i + 1}.** ${lines[i]}\n\n`;
    }
  }

  markdown += '\n---\n*Transcript generated by Downlodr CC to Markdown*\n';

  return markdown;
}

// File conversion handler
ipcMain.handle('convert-file', async (event, options) => {
  const {
    downloadId,
    inputPath,
    targetFormat,
    keepOriginal,
    downloadName,
    saveToCustomLocation,
  } = options;

  try {
    console.log(
      `🔄 Starting conversion for ${downloadName} (${downloadId}) to ${targetFormat}`,
    );
    console.log(`📁 Input path: ${inputPath}`);

    // Validate input file exists
    if (!fs.existsSync(inputPath)) {
      throw new Error('Input file does not exist');
    }

    const inputDir = path.dirname(inputPath);
    const inputBaseName = path.basename(inputPath, path.extname(inputPath));
    const targetFormatLower = targetFormat.toLowerCase();

    // Check if this is a text-based format (CC to Markdown conversion)
    const isTextFormat = ['txt', 'docx', 'md', 'markdown'].includes(
      targetFormatLower,
    );

    if (isTextFormat) {
      // Handle CC to Markdown and other text-based conversions
      // Save directly in the same directory as the video file using exact video filename + new extension
      const outputExtension =
        targetFormatLower === 'txt'
          ? '.txt'
          : targetFormatLower === 'docx'
          ? '.docx'
          : targetFormatLower === 'md' || targetFormatLower === 'markdown'
          ? '.md'
          : '.txt';

      // Use exact video filename with new extension (no timestamp, no underscore)
      const outputFileName = `${inputBaseName}${outputExtension}`;
      const outputPath = path.join(inputDir, outputFileName); // Save in same directory as video

      // Send conversion start status
      event.sender.send(`ytdlp:download:status:${downloadId}`, {
        type: 'conversion',
        data: {
          status: 'converting',
          format: targetFormat,
          log: `Starting CC to ${targetFormat} conversion...`,
        },
      });

      // For text formats, we delegate to the plugin system but provide the correct output path
      // The plugin should use the calculated outputPath to save in the video directory
      try {
        // Call the CC to Markdown plugin or create the file directly
        const conversionResult = await handleTextFormatConversion(
          inputPath,
          outputPath,
          targetFormat,
          downloadId,
          event,
          saveToCustomLocation || false,
        );

        if (conversionResult.success) {
          event.sender.send(`ytdlp:download:status:${downloadId}`, {
            type: 'conversion',
            data: {
              status: 'conversion_complete',
              format: targetFormat,
              outputPath: conversionResult.outputPath,
              log: `CC to ${targetFormat} conversion completed successfully. File saved in video directory.`,
            },
          });

          return conversionResult;
        } else {
          throw new Error(
            conversionResult.error || 'Text format conversion failed',
          );
        }
      } catch (error) {
        event.sender.send(`ytdlp:download:status:${downloadId}`, {
          type: 'conversion',
          data: {
            status: 'conversion_failed',
            format: targetFormat,
            error: error.message,
            log: `CC to ${targetFormat} conversion failed: ${error.message}`,
          },
        });

        throw error;
      }
    }

    // For video formats, continue with FFmpeg conversion
    // Get FFmpeg path (only needed for video conversions)
    const ffmpegPath = getFfmpegBinaryPath();
    if (!fs.existsSync(ffmpegPath)) {
      throw new Error('FFmpeg binary not found');
    }

    // Generate output path - create a single FormatConverter directory for video formats
    const outputExtension =
      targetFormatLower === 'mp3'
        ? '.mp3'
        : targetFormatLower === 'mp4'
        ? '.mp4'
        : targetFormatLower === 'mov'
        ? '.mov'
        : targetFormatLower === 'avi'
        ? '.avi'
        : targetFormatLower === 'mkv'
        ? '.mkv'
        : '.mp4';

    // Check if we're already in a FormatConverter directory to prevent nesting
    const parentDirName = path.basename(inputDir);
    const formatConverterDir =
      parentDirName === 'FormatConverter'
        ? inputDir // Use the current directory if it's already FormatConverter
        : path.join(inputDir, 'FormatConverter'); // Create new FormatConverter subdirectory

    // Ensure the FormatConverter directory exists
    if (!fs.existsSync(formatConverterDir)) {
      fs.mkdirSync(formatConverterDir, { recursive: true });
    }

    // Generate unique filename to avoid conflicts
    const timestamp = new Date().getTime();
    const outputFileName = `${inputBaseName}_${targetFormatLower}_${timestamp}${outputExtension}`;
    const outputPath = path.join(formatConverterDir, outputFileName);

    // Build FFmpeg command based on target format
    const ffmpegArgs = ['-i', inputPath];

    switch (targetFormatLower) {
      case 'mp3':
        ffmpegArgs.push('-vn', '-acodec', 'libmp3lame', '-ab', '192k');
        break;
      case 'mp4':
        ffmpegArgs.push('-c:v', 'libx264', '-c:a', 'aac', '-preset', 'medium');
        break;
      case 'mov':
        ffmpegArgs.push('-c:v', 'libx264', '-c:a', 'aac');
        break;
      case 'avi':
        ffmpegArgs.push('-c:v', 'libx264', '-c:a', 'libmp3lame');
        break;
      case 'mkv':
        ffmpegArgs.push('-c:v', 'libx264', '-c:a', 'aac');
        break;
      default:
        throw new Error(`Unsupported format: ${targetFormat}`);
    }

    // Add output path and overwrite flag
    ffmpegArgs.push('-y', outputPath);

    console.log(`🎬 FFmpeg command: ${ffmpegPath} ${ffmpegArgs.join(' ')}`);

    // Execute FFmpeg conversion
    const { spawn } = require('child_process'); // eslint-disable-line @typescript-eslint/no-var-requires
    const conversionProcess = spawn(ffmpegPath, ffmpegArgs);

    return new Promise((resolve, reject) => {
      let errorOutput = '';
      let lastOutput = '';

      // Send conversion start status
      event.sender.send(`ytdlp:download:status:${downloadId}`, {
        type: 'conversion',
        data: {
          status: 'converting',
          format: targetFormat,
          log: `Starting conversion to ${targetFormat}...`,
        },
      });

      conversionProcess.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        errorOutput += output;
        lastOutput = output;

        // Send progress updates if available
        event.sender.send(`ytdlp:download:status:${downloadId}`, {
          type: 'conversion',
          data: {
            status: 'converting',
            format: targetFormat,
            log: `Converting: ${output.trim()}`,
          },
        });
      });

      conversionProcess.on('close', (code: number | null) => {
        if (code === 0) {
          console.log(`✅ Conversion completed successfully!`);
          console.log(`📁 Output location: ${outputPath}`);

          // Send completion status
          event.sender.send(`ytdlp:download:status:${downloadId}`, {
            type: 'conversion',
            data: {
              status: 'conversion_complete',
              format: targetFormat,
              outputPath: outputPath,
              log: `Conversion to ${targetFormat} completed successfully. File saved to FormatConverter folder.`,
            },
          });

          // Remove original file if not keeping it
          if (!keepOriginal) {
            try {
              fs.unlinkSync(inputPath);
              console.log(`🗑️ Removed original file: ${inputPath}`);
            } catch (unlinkError) {
              console.warn(
                `⚠️ Could not remove original file: ${unlinkError.message}`,
              );
            }
          }

          resolve({
            success: true,
            outputPath: outputPath,
          });
        } else {
          console.error(`❌ Conversion failed with exit code ${code}`);
          console.error(`Error output: ${errorOutput}`);

          const errorMessage =
            errorOutput || lastOutput || `Process exited with code ${code}`;

          // Send failure status
          event.sender.send(`ytdlp:download:status:${downloadId}`, {
            type: 'conversion',
            data: {
              status: 'conversion_failed',
              format: targetFormat,
              error: errorMessage,
              log: `Conversion to ${targetFormat} failed: ${errorMessage}`,
            },
          });

          reject(new Error(errorMessage));
        }
      });

      conversionProcess.on('error', (error: Error) => {
        console.error(`❌ Conversion process error: ${error.message}`);

        // Send failure status
        event.sender.send(`ytdlp:download:status:${downloadId}`, {
          type: 'conversion',
          data: {
            status: 'conversion_failed',
            format: targetFormat,
            error: error.message,
            log: `Conversion to ${targetFormat} failed: ${error.message}`,
          },
        });

        reject(error);
      });
    });
  } catch (error) {
    console.error(`❌ Conversion setup error: ${error.message}`);

    // Send failure status
    event.sender.send(`ytdlp:download:status:${downloadId}`, {
      type: 'conversion',
      data: {
        status: 'conversion_failed',
        format: targetFormat,
        error: error.message,
        log: `Conversion to ${targetFormat} failed: ${error.message}`,
      },
    });

    return {
      success: false,
      error: error.message,
    };
  }
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
