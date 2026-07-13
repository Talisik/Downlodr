/* Handler for ytdlp operations of base app such as getting version, getting latest version, checking and updating, downloading, etc. */
/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

import { app, BrowserWindow, ipcMain } from 'electron';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import * as YTDLP from 'yt-dlp-helper';
import { DownloadOptions } from '../../../downlodr/schema/ytdlpSchema';
import {
  canMakeGitHubApiCall,
  getCachedVersion,
  getGitHubApiCooldownRemainingSeconds,
  markGitHubApiCall,
  setCachedVersion,
} from './githubHandler';
import { notifyTrayDownloadComplete } from './trayHandler';
import { spawn } from 'child_process';

// How often progress chunks are forwarded to the renderer (ms).
// Status-change and completion chunks always bypass this throttle.
const PROGRESS_THROTTLE_MS = 150;

// Maximum bytes kept in the per-download log buffer.
// Older content is trimmed so memory stays bounded.
const MAX_LOG_BYTES = 51200; // 50 KB

/**
 * Resolves the absolute path to the yt-dlp binary.
 *
 * The yt-dlp-helper library defaults to "./yt-dlp_macos" on darwin, which
 * resolves inside the read-only .app bundle in packaged builds, causing
 * EROFS errors.  This function returns the correct absolute path so callers
 * can pass it via `ytdlpDownloadDestination` / `filePath`.
 */
function resolveYtDlpBinaryPath(): string {
  const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

  if (app.isPackaged && process.resourcesPath) {
    // Packaged app: binaries live in Resources/
    const candidates = [
      path.join(process.resourcesPath, binaryName),
      path.join(process.resourcesPath, 'yt-dlp_macos'),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    // Fallback to bare name (relies on PATH)
    return binaryName;
  }

  // Development: look next to the app entry point
  const devCandidates = [
    path.join(app.getAppPath(), binaryName),
    path.join(app.getAppPath(), 'yt-dlp_macos'),
  ];
  for (const candidate of devCandidates) {
    if (existsSync(candidate)) return candidate;
  }
  return binaryName;
}

/**
 * Retries a yt-dlp download fn on Windows EBUSY errors.
 *
 * yt-dlp-helper's downloadYTDLP() calls getYTDLPVersion() internally, which
 * spawns yt-dlp.exe, kills it as soon as output arrives, then immediately
 * streams the new binary to the same path. On Windows, the killed process can
 * still hold the file handle for a brief moment, causing createWriteStream to
 * fail with EBUSY. Retrying after a short delay reliably clears the lock.
 */
async function downloadWithBusyRetry(
  fn: () => Promise<void>,
  maxAttempts = 3,
): Promise<void> {
  let delayMs = 2000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fn();
      return;
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'EBUSY' && attempt < maxAttempts) {
        console.warn(
          `[ytdlp update] binary busy, retrying in ${delayMs}ms (attempt ${attempt}/${maxAttempts})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
      } else {
        throw err;
      }
    }
  }
}

/**
 * Fire-and-forget function to check and update yt-dlp at startup.
 * Errors are caught and logged silently. Rate-limit blocks return early.
 */
export async function runYtdlpCheckAndUpdate(): Promise<void> {
  try {
    const ytdlpPath = resolveYtDlpBinaryPath();
    const currentVersion = await YTDLP.getYTDLPVersion(ytdlpPath);

    let latestVersion = getCachedVersion();

    if (!latestVersion) {
      if (!canMakeGitHubApiCall()) {
        return;
      }
      markGitHubApiCall();
      const latestResponse = await YTDLP.getLatestYTDLPVersionFromGitHub();
      if (!latestResponse.ok || !latestResponse.version) {
        return;
      }
      latestVersion = latestResponse.version;
      setCachedVersion(latestVersion);
    }

    if (!currentVersion) {
      await downloadWithBusyRetry(() =>
        YTDLP.downloadYTDLP({ filePath: ytdlpPath }),
      );
      return;
    }

    if (latestVersion && currentVersion !== latestVersion) {
      await downloadWithBusyRetry(() =>
        YTDLP.downloadYTDLP({
          filePath: ytdlpPath,
          version: latestVersion!,
          forceDownload: true,
        }),
      );
    }
  } catch (error) {
    console.error('[ytdlp startup] check-and-update failed:', error);
  }
}

/**
 * Handles the behavior of the base app such as closing, minimizing, maximizing, etc.
 * @param mainWindow - The main window of the base app
 * @returns void
 */
export const ytdlpHandler = (_mainWindow: BrowserWindow): (() => void) => {
  // Set once at initialisation — not on every info call (fix #9)
  YTDLP.Config.log = true;

  // Resolve the yt-dlp binary path once at init so every library call uses the
  // correct absolute path instead of the default "./yt-dlp_macos" which breaks
  // in packaged macOS builds (EROFS — read-only .app bundle).
  const ytdlpPath = resolveYtDlpBinaryPath();

  // Tracks IDs of yt-dlp controllers that are currently downloading.
  // Used by the cleanup function to SIGKILL orphaned processes on app quit.
  // On Windows, child processes are not automatically killed when the parent exits,
  // so without this, active yt-dlp instances linger in Task Manager after close.
  const activeControllerIds = new Set<string>();
  const activeDirectUrlProcs = new Set<ReturnType<typeof spawn>>();

  // get the playlist information (renderer sends URL as string)
  ipcMain.handle(
    'ytdlp:playlist:info',
    async (_e, videoUrl: string | { url: string }) => {
      try {
        const url = typeof videoUrl === 'string' ? videoUrl : videoUrl?.url;
        if (!url) {
          throw new Error('Playlist URL is required');
        }
        // Disable Chrome cookies to avoid "Could not copy Chrome cookie database" error
        const info = await YTDLP.getPlaylistInfo({
          url,
          cookiesFromBrowser: '',
          ytdlpDownloadDestination: ytdlpPath,
        });
        return info;
      } catch (error) {
        console.error('Error fetching playlist info:', error);
        throw error; // Propagate the error to the renderer process
      }
    },
  );

  // get the video information
  ipcMain.handle('ytdlp:info', async (e, url) => {
    try {
      if (!url) {
        throw new Error('Video URL is required');
      }
      // getInfo() doesn't accept a binary path — use invoke() directly so
      // the resolved absolute path is used instead of "./yt-dlp_macos".
      const result = await YTDLP.invoke({
        ytdlpDownloadDestination: ytdlpPath,
        args: [
          '--no-warnings',
          '--dump-json',
          url,
        ],
        downloadBinary: { ytdlp: false, ffmpeg: false },
      });
      if (!result.ok || !result.data) {
        throw new Error('No info returned from yt-dlp');
      }
      let data: any;
      try {
        data = JSON.parse(result.data);
      } catch {
        throw new Error('Failed to parse yt-dlp JSON output');
      }
      return data;
    } catch (error) {
      console.error('Error fetching video info:', error);
      throw error; // Propagate the error to the renderer process
    }
  });

  // Get current YT-DLP version
  ipcMain.handle('ytdlp:getCurrentVersion', async () => {
    try {
      const version = await YTDLP.getYTDLPVersion(ytdlpPath);
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
        return {
          success: true,
          version: cachedVersion,
          message: 'Retrieved from cache',
        };
      }

      // Check rate limiting
      if (!canMakeGitHubApiCall()) {
        const remainingTime = getGitHubApiCooldownRemainingSeconds();
        return {
          success: false,
          error: `Rate limited. Please wait ${remainingTime} seconds before checking again.`,
          version: null,
        };
      }

      // Make the API call
      markGitHubApiCall();
      const response = await YTDLP.getLatestYTDLPVersionFromGitHub();

      // Cache the result if successful
      if (response.ok && response.version) {
        setCachedVersion(response.version);
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
      const currentVersion = await YTDLP.getYTDLPVersion(ytdlpPath);

      // Check if we have a cached version first
      let latestVersion = getCachedVersion();
      let latestResponse;

      if (!latestVersion) {
        // Check rate limiting
        if (!canMakeGitHubApiCall()) {
          const remainingTime = getGitHubApiCooldownRemainingSeconds();
          return {
            success: false,
            error: `Rate limited. Please wait ${remainingTime} seconds before checking again.`,
            action: 'error',
          };
        }

        // Make the API call
        markGitHubApiCall();
        latestResponse = await YTDLP.getLatestYTDLPVersionFromGitHub();

        if (!latestResponse.ok || !latestResponse.version) {
          // Check if it's a rate limit error
          if (
            latestResponse.message &&
            latestResponse.message.includes('403')
          ) {
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
        setCachedVersion(latestVersion);
      }

      if (!currentVersion) {
        await YTDLP.downloadYTDLP({ filePath: ytdlpPath });
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
          filePath: ytdlpPath,
          version: latestVersion,
          forceDownload: true,
        });
        return {
          success: true,
          action: 'updated',
          message: `YT-DLP updated from ${currentVersion} to ${latestVersion}`,
          currentVersion,
          latestVersion,
        };
      } else {
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
        filePath: ytdlpPath,
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

  ipcMain.handle('ytdlp:getDirectUrl', async (_e, url: string) => {
    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };

      let proc: ReturnType<typeof spawn>;
      try {
        proc = spawn(ytdlpPath, ['-g', '-f', 'best[ext=mp4]', url]);
      } catch (err) {
        reject(err);
        return;
      }

      activeDirectUrlProcs.add(proc);
      let output = '';
      let stderrOutput = '';

      proc.on('error', (err) => {
        activeDirectUrlProcs.delete(proc);
        settle(() => reject(err));
      });

      proc.stdout.on('data', (d) => (output += d.toString()));
      proc.stderr.on('data', (d) => (stderrOutput += d.toString()));
      proc.on('close', (code) => {
        activeDirectUrlProcs.delete(proc);
        settle(() =>
          code === 0
            ? resolve(output.trim())
            : reject(new Error(stderrOutput.trim())),
        );
      });
    });
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
        ytdlpDownloadDestination: ytdlpPath,
      });

      if (!controller || typeof controller.listen !== 'function') {
        throw new Error(
          'Controller is not defined or does not have a listen method',
        );
      }

      activeControllerIds.add(controller.id);
      // Send the controller ID back to the renderer process
      e.sender.send(`ytdlp:controller:${id}`, {
        downloadId: id,
        controllerId: controller.id,
      });

      let processCompletionHandled = false;
      let trayNotificationSent = false;
      let completeLog = '';
      // Store fallback timer so it can be cancelled when process exits normally (fix #7)
      let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;

      const sendTrayNotificationOnce = () => {
        if (trayNotificationSent) return;
        trayNotificationSent = true;
        notifyTrayDownloadComplete({
          name: path.basename(args.outputFilepath),
        });
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
          win.webContents.send('download-finished', {
            name: path.basename(args.outputFilepath),
            id,
            location: args.outputFilepath,
          });
        }
      };

      if (controller.process) {
        const handleProcessCompletion = (
          code: number,
          signal: string,
          eventType: string,
        ) => {
          if (processCompletionHandled) return; // Prevent duplicate handling
          processCompletionHandled = true;
          activeControllerIds.delete(controller.id);

          // Cancel the fallback timer — process exited normally (fix #7)
          if (fallbackTimeout !== null) {
            clearTimeout(fallbackTimeout);
            fallbackTimeout = null;
          }

          const completionMessage = `Process '${controller.id}' ${eventType} with code: ${code}, signal: ${signal}`;
          completeLog += `\n${completionMessage}`;

          setTimeout(() => {
            e.sender.send(`ytdlp:download:status:${id}`, {
              type: 'completion',
              data: {
                log: completionMessage,
                // completeLog is only sent here — not on every progress chunk (fix #6)
                completeLog: completeLog,
                exitCode: code,
                signal: signal,
                controllerId: controller.id,
              },
            });
            if (code === 0) {
              sendTrayNotificationOnce();
            }
          }, 100);
        };

        // Use once() so listeners auto-remove after firing — no manual cleanup needed (fix #8)
        controller.process.once('exit', (code: number, signal: string) => {
          handleProcessCompletion(code, signal, 'exited');
        });

        controller.process.once('close', (code: number, signal: string) => {
          if (!processCompletionHandled) {
            handleProcessCompletion(code, signal, 'closed');
          }
        });
      } else {
        console.log(
          `⚠️ Controller ${controller.id} does not expose process - will rely on stream completion`,
        );
      }

      // Throttle state for progress chunks (fix #5)
      let lastProgressSentTime = 0;

      // Process the main download stream
      for await (const chunk of controller.listen()) {
        if (chunk?.data?.log) {
          completeLog += chunk.data.log;
          // Cap log buffer to prevent unbounded memory growth (fix #6)
          if (completeLog.length > MAX_LOG_BYTES) {
            completeLog = completeLog.slice(completeLog.length - MAX_LOG_BYTES);
          }
        }

        // Throttle pure progress updates — status changes always go through immediately (fix #5)
        const isProgressOnly =
          chunk?.data?.progress !== undefined &&
          (!chunk?.data?.status || chunk?.data?.status === 'downloading');
        const now = Date.now();
        if (
          isProgressOnly &&
          now - lastProgressSentTime < PROGRESS_THROTTLE_MS
        ) {
          continue;
        }
        if (isProgressOnly) {
          lastProgressSentTime = now;
        }

        // Send chunk without completeLog attached — full log is only in completion event (fix #6)
        e.sender.send(`ytdlp:download:status:${id}`, chunk);

        if (chunk != null && chunk.data && chunk.data.status === 'finished') {
          sendTrayNotificationOnce();
        }
      }

      // Fallback: if process events never fired, notify renderer after a delay.
      // Timer reference is stored so it can be cancelled if the process exits normally (fix #7).
      fallbackTimeout = setTimeout(() => {
        fallbackTimeout = null;
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
      e.sender.send(`ytdlp:download:error:${id}`, (error as Error).message);
      throw error; // Ensure the error is propagated
    }
  });

  // read a local caption file as UTF-8 text
  ipcMain.handle('ytdlp:readCaptionFile', async (_e, filePath: string) => {
    try {
      if (!filePath) throw new Error('filePath is required');
      const ALLOWED_EXTENSIONS = ['.vtt', '.srt'];
      const ext = path.extname(filePath).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        throw new Error(`Unsupported caption extension: ${ext}`);
      }
      const content = await readFile(filePath, 'utf-8');
      // Strip a leading UTF-8 BOM (added so external editors like Notepad
      // detect the encoding correctly) so it doesn't leak into caption parsing.
      return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
    } catch (error) {
      console.error('Error reading caption file:', error);
      throw error;
    }
  });

  return () => {
    for (const id of activeControllerIds) {
      try {
        YTDLP.getTerminalFromID(id)?.kill('SIGKILL');
      } catch (err) {
        console.error(`[ytdlp cleanup] failed to kill controller ${id}:`, err);
      }
    }
    activeControllerIds.clear();

    for (const proc of activeDirectUrlProcs) {
      try {
        proc.kill('SIGKILL');
      } catch (err) {
        console.error('[ytdlp cleanup] failed to kill direct-url proc:', err);
      }
    }
    activeDirectUrlProcs.clear();
  };
};
