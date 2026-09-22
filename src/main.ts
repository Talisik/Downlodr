/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Main process entry point for the Electron application.
 * This file is responsible for creating the main application window,
 * handling IPC (Inter-Process Communication) events, and managing
 * application lifecycle events.
 */
import './core-app/ipc/main/electronPathsInit';
import { app, BrowserWindow, session } from 'electron';
import started from 'electron-squirrel-startup';
import http from 'http';
import path from 'path';
import { detectAddon } from './core-app/ipc/main/addonManager';
import { checkForUpdates } from './core-app/hook/updateCheckerHook';
import { autoDownloadUpdate } from './core-app/ipc/main/appInfoHandler'; // used by 4h interval
import { setLastClipboardText } from './core-app/ipc/main/clipboardHandler';
import { registerMainIpcHandlers } from './core-app/ipc/main/registerHandlers';
import { getRunInBackgroundSetting } from './core-app/ipc/main/trayHandler';
import {
  ensureBundledFfmpegOnPath,
  getBundledFfmpegPaths,
  getYtdlpBinaryPath,
} from './core-app/ipc/main/bundledBinariesEnv';
import { formatReport, runPreflight } from './core-app/ipc/main/preflight';
import { setupExtendr } from './extension/utils/extensionLoader';
import {
  startMcpBridgeServer,
  stopMcpBridgeServer,
} from './core-app/ipc/main/mcpBridgeServer';

// Set app identity early so Windows notifications show "Downlodr" instead of "app.electron"
app.setName('Downlodr');
if (process.platform === 'win32') {
  app.setAppUserModelId('Downlodr');
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Prevent multiple instances of the app
const isSingleInstance = app.requestSingleInstanceLock();

if (!isSingleInstance) {
  console.log('Another instance is already running. Quitting this instance.');
  // app.quit() only requests an async shutdown — without stopping here, this
  // second instance keeps executing the rest of this file (including
  // app.on('ready') -> startMcpBridgeServer()), which crashes with
  // EADDRINUSE trying to bind the port the first instance already owns.
  // app.exit() terminates immediately instead.
  app.exit(0);
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

let mainWindow: BrowserWindow | null = null;
let forceQuit = false;
let appCleanup: (() => void) | null = null;
let extensionServer: http.Server | null = null;

// Function to create the main application window
const createWindow = async () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 680,
    frame: false,
    autoHideMenuBar: true,
    minWidth: 1200,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      nodeIntegration: true,
      // devTools: false,
    },
  });

  // Twitch's VOD CDNs serve HLS manifests/segments without CORS headers,
  // which blocks hls.js's XHR fetches in the renderer (a plain <video src>
  // is no-CORS and unaffected). Inject a permissive ACAO for those hosts only.
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['*://*.cloudfront.net/*', '*://*.ttvnw.net/*'] },
    (details, callback) => {
      const responseHeaders = { ...(details.responseHeaders ?? {}) };
      for (const key of Object.keys(responseHeaders)) {
        if (key.toLowerCase() === 'access-control-allow-origin') {
          delete responseHeaders[key];
        }
      }
      responseHeaders['Access-Control-Allow-Origin'] = ['*'];
      callback({ responseHeaders });
    },
  );

  const { cleanup } = await registerMainIpcHandlers(mainWindow, {
    tray: {
      onBeforeQuit: () => {
        forceQuit = true;
        setLastClipboardText('BLANK_STATE');
      },
    },
  });
  appCleanup = cleanup;

  startMcpBridgeServer();

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
      const shouldRunInBackground = getRunInBackgroundSetting();
      if (shouldRunInBackground) {
        event.preventDefault();
        mainWindow?.hide();
      } else {
        forceQuit = true;
        app.quit();
      }
    }
  });

  // focus tracking for clipboard monitoring
  mainWindow.on('focus', () => {
    // console.log('Window focused - clipboard monitoring paused');
  });

  mainWindow.on('blur', () => {
    // console.log('Window unfocused - clipboard monitoring resumed');
  });

  // Prevent navigation to external URLs
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
  });

  // The AI chat side panel lives in the main window, so the chat IPC handlers
  // must exist even if the separate chat window is never opened. Passing null
  // is fine: every reply path resolves its target window from the sender.
  // createChatWindow() tears this down (chatCleanup?.()) and re-registers with
  // the real window, so there is never a double registration.
};

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// A stable, long-lived public video. Only used by `--preflight`, never at
// normal startup.
const PREFLIGHT_METADATA_URL = 'https://www.youtube.com/watch?v=s3ok84NeMdU';

/**
 * The binaries to probe, resolved exactly the way the running app resolves
 * them — that is the point of the check. Falling back to the bare name when
 * nothing is bundled keeps the probe honest: yt-dlp would find that same
 * PATH copy, so reporting a miss would be wrong.
 */
function preflightPaths() {
  const { ffmpeg, ffprobe } = getBundledFfmpegPaths();
  return {
    ytdlpPath: getYtdlpBinaryPath(),
    ffmpegPath: ffmpeg ?? 'ffmpeg',
    ffprobePath: ffprobe ?? 'ffprobe',
  };
}

async function runPreflightAndExit(): Promise<void> {
  try {
    const report = await runPreflight({
      ...preflightPaths(),
      metadataUrl: PREFLIGHT_METADATA_URL,
    });
    console.log(formatReport(report));
    app.exit(report.ok ? 0 : 1);
  } catch (error) {
    console.error('[preflight] the check itself failed:', error);
    app.exit(1);
  }
}

async function logStartupPreflight(): Promise<void> {
  try {
    console.log(formatReport(await runPreflight(preflightPaths())));
  } catch (error) {
    console.error('[preflight]', error);
  }
}

// once the app opens
app.on('ready', async () => {
  // Must run before anything can reach yt-dlp: the helper reads PATH to decide
  // whether to pass --ffmpeg-location, and otherwise tries to download its own
  // ffmpeg into process.cwd() (`/` for a .app opened from Finder).
  ensureBundledFfmpegOnPath();

  // `--preflight` turns the app into a one-shot binary check and exits. It
  // runs here, before any window, database or IPC handler exists, so CI can
  // launch a packaged .app on a headless runner and read the result off the
  // exit code. Nothing below this block runs in that mode.
  if (process.argv.includes('--preflight')) {
    await runPreflightAndExit();
    return;
  }

  // Normal startup: probe in the background and log one summary line. Costs
  // nothing and means a user's log says whether the binaries were reachable,
  // instead of leaving a blank version and a generic download error as the
  // only symptoms.
  void logStartupPreflight();

  // Install the Claude Code Agent Skills bundle into <repoRoot>/.claude/skills so
  // the embedded chat agent discovers the downlodr-* skills. Idempotent +
  // version-stamped; runs once at startup before any chat window/spawn. (The
  // chatHandler() constructor also calls this when a chat window is created, so
  // this call and that one are both safe no-ops if the version already matches.)

  // Start extension setup but don't await it — run it concurrently with window
  // creation so the window appears immediately instead of waiting for extensions.
  const extendrReady = setupExtendr().catch((err) =>
    console.error('[setupExtendr]', err),
  );

  try {
    await createWindow();
  } catch (err) {
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'createWindow failed',
      String(err instanceof Error ? err.stack : err),
    );
  }

  extensionServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/subscribe') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        const { url, title } = JSON.parse(body);
        mainWindow?.webContents.send('extension:download', { url, title });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'queued' }));
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/download') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        const { url, title, format_id } = JSON.parse(body);
        mainWindow?.webContents.send('extension:download', {
          url,
          title,
          format_id,
          autoDownload: true,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'queued' }));
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/downloadArticle') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        const { url } = JSON.parse(body);

        if (detectAddon('afda-backend').status !== 'ready') {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              status: 'error',
              error: 'addon_not_installed',
              message:
                'The Article Fetcher add-on is not installed. Install it from Downlodr to download articles.',
            }),
          );
          return;
        }

        mainWindow?.webContents.send('extension:download', {
          url,
          autoDownload: true,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'queued' }));
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  extensionServer.listen(57000, '127.0.0.1', () => {
    console.log('Downlodr extension server listening on port 57000');
  });

  extensionServer.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code === 'EADDRINUSE') console.warn('Port 57000 already in use');
  });

  // Periodic update check every 4 hours (renderer handles the startup check)
  const UPDATE_CHECK_INTERVAL = 1000 * 60 * 60 * 4;
  setInterval(async () => {
    const updateInfo = await checkForUpdates();
    if (updateInfo.hasUpdate && updateInfo.downloadUrl) {
      autoDownloadUpdate(updateInfo.downloadUrl, updateInfo);
    }
  }, UPDATE_CHECK_INTERVAL);
});

// Change this to keep app running in background
app.on('window-all-closed', () => {
  // Do nothing here to keep app running when windows are closed
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((err) => {
      console.error('[createWindow]', err);
    });
  } else {
    mainWindow?.show();
  }
});

// before-quit handler — graceful teardown of all background services
app.on('before-quit', async () => {
  forceQuit = true;

  extensionServer?.close();

  // Stop scraper, download worker, close DB, and any other registered cleanups
  try {
    appCleanup?.();
  } catch (err) {
    console.error('[before-quit] cleanup error:', err);
  }

  stopMcpBridgeServer();

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
