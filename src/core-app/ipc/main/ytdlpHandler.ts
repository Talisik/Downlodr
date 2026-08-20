/* Handler for ytdlp operations of base app such as getting version, getting latest version, checking and updating, downloading, etc. */
/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

import { app, BrowserWindow, ipcMain, session } from 'electron';
import { existsSync } from 'fs';
import { mkdir, readFile, rename, rm, stat, unlink } from 'fs/promises';
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
import { isYtdlpUpgrade } from './ytdlpVersion';
import { spawn } from 'child_process';

// How often progress chunks are forwarded to the renderer (ms).
// Status-change and completion chunks always bypass this throttle.
const PROGRESS_THROTTLE_MS = 150;

// Maximum bytes kept in the per-download log buffer.
// Older content is trimmed so memory stays bounded.
const MAX_LOG_BYTES = 51200; // 50 KB

// File-lock error codes Windows returns while a process still holds
// yt-dlp.exe (EBUSY from open, EPERM/EACCES from rename over a running exe).
const BINARY_LOCK_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);

// Longest single wait between retries. Locks from the async taskkill of the
// version probe clear in well under a second, but AV scans or an in-flight
// yt-dlp download can hold the exe for a while — cap the backoff instead of
// letting it grow into multi-minute waits.
const BUSY_RETRY_MAX_DELAY_MS = 10_000;

/**
 * Retries an fs/download operation while Windows reports the yt-dlp binary
 * as locked. The lock holder is usually the `--version` probe that
 * yt-dlp-helper spawns and tree-kills asynchronously (taskkill returns
 * before the process actually dies), but can also be an AV scan or a
 * running download. Backoff: 1s doubling, capped at 10s (~65s total across
 * the default 10 attempts).
 */
async function withBusyRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 10,
): Promise<T> {
  let delayMs = 1000;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (!code || !BINARY_LOCK_CODES.has(code) || attempt >= maxAttempts) {
        throw err;
      }
      console.warn(
        `[ytdlp update] binary busy (${code}), retrying in ${delayMs}ms (attempt ${attempt}/${maxAttempts})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 2, BUSY_RETRY_MAX_DELAY_MS);
    }
  }
}

// Mirrors yt-dlp-helper's getYTDLPFileName() (not exported by the package).
const YTDLP_BINARY_NAME =
  process.platform === 'win32'
    ? 'yt-dlp.exe'
    : process.platform === 'darwin'
    ? 'yt-dlp_macos'
    : 'yt-dlp_linux';

/**
 * Updates the yt-dlp binary to `version` without writing over the live exe.
 *
 * yt-dlp-helper's downloadYTDLP() streams the new binary directly onto
 * yt-dlp.exe right after its internal version probe spawns and tree-kills
 * that same exe. taskkill is asynchronous, so the exe is often still locked
 * when the write stream opens — and the helper attaches no 'error' listener
 * to that stream, so the EBUSY escapes as an uncaught exception that no
 * try/catch around downloadYTDLP() can see. It also truncates the live
 * binary before the download finishes, corrupting it if the download fails.
 *
 * Downloading to a sibling temp file keeps the helper's flow (same release
 * URL, redirect handling, and probe) while the only operation touching the
 * live exe is a rename we control and can retry.
 */
async function downloadYtdlpUpdateSafely(version: string): Promise<void> {
  const targetPath = path.resolve(process.cwd(), YTDLP_BINARY_NAME);
  const tempPath = `${targetPath}.download`;
  const oldPath = `${targetPath}.old`;
  // A leftover .old from a previous update can linger while its lock holder
  // lived on; clear it now so the swap fallback below has a free slot.
  await unlink(oldPath).catch(() => undefined);
  try {
    await YTDLP.downloadYTDLP({
      filePath: tempPath,
      version,
      forceDownload: true,
    });
    const downloaded = await stat(tempPath);
    if (downloaded.size === 0) {
      throw new Error('Downloaded yt-dlp binary is empty');
    }
    await withBusyRetry(() => swapInNewBinary(tempPath, targetPath, oldPath));
    // Best-effort: fails while a process still runs from the moved-aside
    // binary; the unlink at the top of the next update sweeps it then.
    await unlink(oldPath).catch(() => undefined);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

/**
 * Puts the downloaded binary in place of the live one. A direct rename onto
 * the target fails while any yt-dlp process is running (long scrapes or
 * downloads can hold the lock indefinitely), but Windows does allow
 * renaming a running exe — so fall back to moving the live binary aside to
 * `.old` (running processes keep executing from the moved file) and
 * dropping the new one into the now-free name.
 */
async function swapInNewBinary(
  tempPath: string,
  targetPath: string,
  oldPath: string,
): Promise<void> {
  try {
    await rename(tempPath, targetPath);
    return;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (!code || !BINARY_LOCK_CODES.has(code)) {
      throw err;
    }
  }
  await rename(targetPath, oldPath);
  try {
    await rename(tempPath, targetPath);
  } catch (err) {
    // Put the original binary back so the app is never left without one.
    await rename(oldPath, targetPath).catch(() => undefined);
    throw err;
  }
}

/**
 * Fire-and-forget function to check and update yt-dlp at startup.
 * Errors are caught and logged silently. Rate-limit blocks return early.
 */
export async function runYtdlpCheckAndUpdate(): Promise<void> {
  try {
    // Sweep any .old left behind by a previous swap whose lock holder
    // outlived the update — deletion fails (silently) while a process still
    // runs from it, and the in-update sweep only fires on the next release.
    await unlink(path.resolve(process.cwd(), `${YTDLP_BINARY_NAME}.old`)).catch(
      () => undefined,
    );

    const currentVersion = await YTDLP.getYTDLPVersion();

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
      await withBusyRetry(() => YTDLP.downloadYTDLP());
      return;
    }

    // Only ever move forward. A plain inequality check treats a manually
    // installed nightly (2026.08.17.073947) as "not the latest stable"
    // and force-downgrades it on every launch.
    if (latestVersion && isYtdlpUpgrade(currentVersion, latestVersion)) {
      await downloadYtdlpUpdateSafely(latestVersion);
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
      // Disable Chrome cookies to avoid "Could not copy Chrome cookie database" error
      // YouTube content is typically public and doesn't require authentication
      // noPlaylist: this handler describes one video — playlists come in
      // through ytdlp:playlist:info. Without it, a URL whose extractor
      // resolves to a container (bilibili multi-part 分P videos, viu:ott
      // series) makes --dump-json emit one object per entry, and getInfo's
      // single JSON.parse rejects the concatenation and returns { ok: false }.
      const info = await YTDLP.getInfo(url, {
        cookiesFromBrowser: '',
        noPlaylist: true,
      });
      if (!info?.ok) {
        // The URL is genuinely a container with no single video attached — a
        // bilibili.tv season (/play/{season} with no episode id), a YouTube
        // playlist page. --no-playlist above is a no-op for these, so yt-dlp
        // still describes every entry and getInfo reports isPlaylist. Nothing
        // is wrong with the URL; it just belongs to ytdlp:playlist:info, so
        // say so and skip the diagnostic re-run below.
        if (info?.isPlaylist) {
          throw new Error(
            `PLAYLIST_URL:${info.entryCount ?? ''}: This URL is a playlist or series, not a single video.`,
          );
        }
        // getInfo() swallows yt-dlp's stderr on failure — it tries to
        // JSON.parse the process output and just returns { ok: false } when
        // that fails, discarding the actual reason. Re-run through the raw
        // invoke() (same binary resolution/download logic) to recover it,
        // most commonly "Unsupported URL" for sites yt-dlp has no extractor
        // for, so the renderer can show something more useful than a
        // generic metadata-fetch failure.
        const diagnostic = await YTDLP.invoke({
          args: ['--no-warnings', '--simulate', url],
        }).catch(() => null);
        if (diagnostic?.data && /Unsupported URL/i.test(diagnostic.data)) {
          throw new Error(
            'UNSUPPORTED_SITE: This website is not supported by yt-dlp, the tool Downlodr uses to fetch videos.',
          );
        }
        if (diagnostic?.data && /Cannot parse data/i.test(diagnostic.data)) {
          // Generic yt-dlp extractor failure — it couldn't find the expected
          // data blob in the page. Not specific to any one site or cause:
          // commonly a private/restricted/age-gated video (site served a
          // login-wall page instead), but can also be a genuine extractor
          // bug after a site layout change. Capture the extractor name
          // (e.g. "[facebook]") when present so the renderer can name the
          // site without claiming which of those it actually was.
          const siteMatch = diagnostic.data.match(
            /\[(\w+)\][^:]*:\s*Cannot parse data/i,
          );
          const site = siteMatch?.[1] || '';
          throw new Error(
            `PARSE_ERROR:${site}: yt-dlp could not read the expected video data from ${
              site ? site[0].toUpperCase() + site.slice(1) : 'this site'
            }.`,
          );
        }
        throw new Error('No info returned from YTDLP.getInfo');
      }
      return info;
    } catch (error) {
      console.error('Error fetching video info:', error);
      throw error; // Propagate the error to the renderer process
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
      const currentVersion = await YTDLP.getYTDLPVersion();

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
        await YTDLP.downloadYTDLP();
        return {
          success: true,
          action: 'downloaded',
          message: 'YT-DLP was not found and has been downloaded.',
          currentVersion: null,
          latestVersion,
        };
      }

      if (latestVersion && isYtdlpUpgrade(currentVersion, latestVersion)) {
        await downloadYtdlpUpdateSafely(latestVersion);
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
          message:
            latestVersion && currentVersion !== latestVersion
              ? `YT-DLP is newer than the latest release (${currentVersion} > ${latestVersion}); keeping it.`
              : 'YT-DLP is already up to date',
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
      await YTDLP.downloadYTDLP(downloadOptions);
      return { success: true };
    } catch (error) {
      console.error('Error downloading YTDLP:', error);
      return { success: false, error: error.message };
    }
  });

  // How long to wait for yt-dlp to exit gracefully after a CTRL_C before
  // giving up and force-killing the process tree.
  const GRACEFUL_STOP_TIMEOUT_MS = 8000;

  // On Windows, tree-kill (used internally by yt-dlp-helper's Terminal.kill)
  // always runs `taskkill /T /F` regardless of the signal it's given — that
  // force-terminates yt-dlp *and* its ffmpeg subprocess simultaneously, so
  // ffmpeg never gets to write its trailer or let yt-dlp run its FixupM3u8
  // remux. This is harmless for finished/near-finished downloads (yt-dlp
  // resumes them with --continue) but for a live HLS stream it leaves a
  // corrupt, unresumable .part file, since there's nothing to resume.
  //
  // A real terminal Ctrl+C works because Windows delivers an actual
  // CTRL_C_EVENT to yt-dlp's console, letting its own signal handler tell
  // ffmpeg to quit cleanly (via stdin) before yt-dlp does its fixup pass.
  // Node's child.kill('SIGINT') does not reproduce that on Windows, so we
  // shell out to a short PowerShell helper that calls the same Win32 APIs
  // (AttachConsole + GenerateConsoleCtrlEvent) to deliver a genuine
  // CTRL_C_EVENT. yt-dlp is spawned with `windowsHide: true` and no
  // `detached`, so Windows gives it its own hidden console that ffmpeg
  // inherits — attaching to it and broadcasting CTRL_C reaches both
  // processes, exactly like pressing Ctrl+C in a terminal running yt-dlp
  // directly.
  function sendCtrlC(pid: number): Promise<void> {
    return new Promise((resolve) => {
      const script = [
        "Add-Type -Name Win -Namespace Native -MemberDefinition '",
        '[DllImport("kernel32.dll", SetLastError=true)] public static extern bool AttachConsole(uint pid);',
        '[DllImport("kernel32.dll", SetLastError=true)] public static extern bool FreeConsole();',
        '[DllImport("kernel32.dll", SetLastError=true)] public static extern bool SetConsoleCtrlHandler(IntPtr HandlerRoutine, bool Add);',
        '[DllImport("kernel32.dll", SetLastError=true)] public static extern bool GenerateConsoleCtrlEvent(uint dwCtrlEvent, uint dwProcessGroupId);',
        "'",
        '[Native.Win]::FreeConsole() | Out-Null',
        `if (-not [Native.Win]::AttachConsole(${pid})) { exit 1 }`,
        '[Native.Win]::SetConsoleCtrlHandler([IntPtr]::Zero, $true) | Out-Null',
        '[Native.Win]::GenerateConsoleCtrlEvent(0, 0) | Out-Null',
        'Start-Sleep -Milliseconds 200',
        '[Native.Win]::FreeConsole() | Out-Null',
      ].join('\n');

      try {
        const ps = spawn(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-Command', script],
          { windowsHide: true },
        );
        ps.once('exit', () => resolve());
        ps.once('error', () => resolve());
      } catch {
        resolve();
      }
    });
  }

  // Ask yt-dlp to stop the way a terminal Ctrl+C would, and only fall back
  // to a forceful tree-kill if it doesn't exit within the grace period.
  async function gracefulKill(controller: YTDLP.Terminal): Promise<boolean> {
    const proc = controller.process;
    if (!proc || proc.killed) return true;

    const exited = new Promise<boolean>((resolve) => {
      proc.once('exit', () => resolve(true));
    });

    if (process.platform !== 'win32' || !proc.pid) {
      // POSIX: child.kill('SIGINT') delivers a real signal, but yt-dlp/ffmpeg
      // can still ignore or fail to act on it (e.g. mid-syscall, unresponsive
      // ffmpeg). Wait for the same grace period as Windows before falling
      // back to SIGKILL, instead of reporting success the instant the signal
      // is sent.
      controller.kill('SIGINT');
    } else {
      await sendCtrlC(proc.pid);
    }

    const exitedGracefully = await Promise.race([
      exited,
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), GRACEFUL_STOP_TIMEOUT_MS),
      ),
    ]);

    if (!exitedGracefully) {
      controller.kill('SIGKILL');
    }
    return true;
  }

  // after identifying ID kill/stop the id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function killControllerById(id: any) {
    try {
      const controller = YTDLP.getTerminalFromID(id);

      if (controller) {
        return await gracefulKill(controller);
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
      const terminal = YTDLP.getTerminalFromID(id);
      if (!terminal) {
        return false;
      }
      return await gracefulKill(terminal);
    } catch (error) {
      return false;
    }
  });

  // yt-dlp's `cookies` field is a Set-Cookie-style string with attributes
  // (Domain, Path, Secure, Expires…) — reduce it to `name=value` pairs
  // usable as a Cookie request header.
  function toCookieHeader(cookies?: string): string {
    if (!cookies) return '';
    const COOKIE_ATTRS = new Set([
      'domain',
      'path',
      'expires',
      'max-age',
      'secure',
      'httponly',
      'samesite',
      'priority',
    ]);
    return cookies
      .split(';')
      .map((part) => part.trim())
      .filter((part) => {
        const eq = part.indexOf('=');
        if (eq === -1) return false;
        return !COOKIE_ATTRS.has(part.slice(0, eq).trim().toLowerCase());
      })
      .join('; ');
  }

  // Some CDNs only serve a direct URL when the request carries the
  // cookies/Referer/User-Agent from the same yt-dlp extraction run. The
  // renderer's <video> element can't set those itself, so inject them here
  // for requests to the media origin. Re-registering replaces the previous
  // listener, which is fine — only the currently playing source matters.
  // Note: this doesn't help every site — TikTok's CDN rejects requests
  // based on TLS/client fingerprinting regardless of headers, so it 403s
  // even with correct cookies. The renderer falls back to downloadPreview()
  // (below) when direct playback fails.
  function applyMediaRequestHeaders(
    mediaUrl: string,
    cookieHeader: string,
    httpHeaders: Record<string, string>,
  ) {
    let origin: string;
    try {
      origin = new URL(mediaUrl).origin;
    } catch {
      return;
    }
    const inject: Record<string, string> = {};
    if (cookieHeader) inject['Cookie'] = cookieHeader;
    if (httpHeaders['Referer']) inject['Referer'] = httpHeaders['Referer'];
    if (httpHeaders['User-Agent'])
      inject['User-Agent'] = httpHeaders['User-Agent'];
    if (Object.keys(inject).length === 0) return;
    session.defaultSession.webRequest.onBeforeSendHeaders(
      { urls: [`${origin}/*`] },
      (details, callback) => {
        callback({ requestHeaders: { ...details.requestHeaders, ...inject } });
      },
    );
  }

  function resolveYtdlpBinaryPath(): string {
    const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    if (app.isPackaged && process.resourcesPath) {
      const bundled = path.join(process.resourcesPath, binaryName);
      return existsSync(bundled) ? bundled : binaryName;
    }
    const devPath = path.join(app.getAppPath(), binaryName);
    return existsSync(devPath) ? devPath : binaryName;
  }

  ipcMain.handle('ytdlp:getDirectUrl', async (_e, url: string) => {
    const binaryPath = resolveYtdlpBinaryPath();

    return new Promise<string>((resolve, reject) => {
      // -j (not -g): direct URLs on some sites are only valid together with
      // the cookies issued during the same extraction, which -g discards.
      const proc = spawn(binaryPath, [
        '--no-warnings',
        '-j',
        '-f',
        'best[ext=mp4]',
        url,
      ]);
      activeDirectUrlProcs.add(proc);
      let output = '';
      let error = '';
      proc.stdout.on('data', (d) => (output += d.toString()));
      proc.stderr.on('data', (d) => (error += d.toString()));
      proc.on('close', (code) => {
        activeDirectUrlProcs.delete(proc);
        if (code !== 0) {
          reject(new Error(error.trim()));
          return;
        }
        try {
          // Some extractors (e.g. TikTok) print more than one JSON object —
          // one per line — for a single URL when extraction resolves through
          // multiple code paths internally. JSON.parse on the whole blob
          // would throw on the concatenated output, so parse line-by-line
          // and keep the last object that parses AND carries a url — other
          // JSON lines (status/metadata objects without a url) must not
          // clobber an earlier usable result.
          type DirectUrlInfo = {
            url?: string;
            cookies?: string;
            http_headers?: Record<string, string>;
          };
          let info: DirectUrlInfo | undefined;
          for (const line of output.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed) as DirectUrlInfo;
              if (parsed?.url) info = parsed;
            } catch {
              // not a JSON line (e.g. stray log output) — skip it
            }
          }
          if (!info?.url) {
            reject(new Error('yt-dlp returned no direct URL'));
            return;
          }
          applyMediaRequestHeaders(
            info.url,
            toCookieHeader(info.cookies),
            info.http_headers ?? {},
          );
          resolve(info.url);
        } catch (parseError) {
          reject(parseError as Error);
        }
      });
    });
  });

  // Fallback for sites whose CDN rejects direct-URL playback (e.g. TikTok —
  // see the note on applyMediaRequestHeaders above). Downloads the video to
  // a temp file the same way a real download would, so the renderer can
  // play it locally via a file:// URL instead of hitting the CDN directly.
  // requestId is caller-supplied (one per preview attempt) so a fast video
  // switch can cancel the previous in-flight download instead of leaving it
  // to finish and orphan its temp file.
  const previewTempDir = path.join(app.getPath('temp'), 'downlodr-preview');
  const activePreviewDownloads = new Map<
    string,
    { proc: ReturnType<typeof spawn>; tempPath: string }
  >();

  // Best-effort sweep of leftover files from a previous session that
  // crashed or was killed before its cleanup ran. downloadPreview awaits
  // this before writing so an early preview request can't have its fresh
  // temp dir deleted out from under it by a still-running sweep.
  const previewTempDirSwept = rm(previewTempDir, {
    recursive: true,
    force: true,
  }).catch(() => undefined);

  function sanitizePreviewRequestId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  }

  async function cancelPreviewDownload(requestId: string): Promise<void> {
    const entry = activePreviewDownloads.get(requestId);
    if (!entry) return;
    activePreviewDownloads.delete(requestId);
    // On Windows the killed process doesn't release its handle on the file
    // synchronously, so wait for exit (bounded — kill can't be relied on to
    // always surface 'close') and retry the unlink through the same
    // lock-code backoff used for the yt-dlp binary itself.
    const exited = new Promise<void>((resolve) => {
      if (entry.proc.exitCode !== null || entry.proc.signalCode !== null) {
        resolve();
        return;
      }
      entry.proc.once('close', () => resolve());
      setTimeout(resolve, 5000);
    });
    entry.proc.kill('SIGKILL');
    await exited;
    await withBusyRetry(() => unlink(entry.tempPath), 5).catch(() => undefined);
  }

  ipcMain.handle(
    'ytdlp:downloadPreview',
    async (_e, requestId: string, url: string) => {
      await previewTempDirSwept;
      await cancelPreviewDownload(requestId);
      await mkdir(previewTempDir, { recursive: true });
      const tempPath = path.join(
        previewTempDir,
        `${sanitizePreviewRequestId(requestId)}-${Date.now()}.mp4`,
      );
      const binaryPath = resolveYtdlpBinaryPath();

      return new Promise<string>((resolve, reject) => {
        // The renderer plays the result back through getVideoBlob, whose
        // buffer path tops out just under 2GB (readFileSync limit) — prefer
        // a format known to fit, and hard-abort anything that would exceed
        // the limit rather than downloading a file playback can't consume.
        const proc = spawn(binaryPath, [
          '--no-warnings',
          '-f',
          'best[ext=mp4][filesize<1.9G]/best[ext=mp4][filesize_approx<1.9G]/best[ext=mp4]',
          '--max-filesize',
          '1.9G',
          '-o',
          tempPath,
          url,
        ]);
        activePreviewDownloads.set(requestId, { proc, tempPath });
        let error = '';
        proc.stderr.on('data', (d) => (error += d.toString()));
        proc.on('error', (err) => {
          activePreviewDownloads.delete(requestId);
          reject(err);
        });
        proc.on('close', (code) => {
          if (activePreviewDownloads.get(requestId)?.proc === proc) {
            activePreviewDownloads.delete(requestId);
          }
          if (code !== 0) {
            unlink(tempPath).catch(() => undefined);
            reject(
              new Error(error.trim() || `yt-dlp exited with code ${code}`),
            );
            return;
          }
          // --max-filesize makes yt-dlp skip the download (still exit 0)
          // when the file is too large — surface that instead of handing
          // the renderer a path to a file that doesn't exist.
          if (!existsSync(tempPath)) {
            reject(
              new Error(
                'yt-dlp produced no preview file (video may exceed the preview size limit)',
              ),
            );
            return;
          }
          resolve(tempPath);
        });
      });
    },
  );

  ipcMain.handle(
    'ytdlp:cancelPreviewDownload',
    async (_e, requestId: string) => {
      await cancelPreviewDownload(requestId);
    },
  );

  ipcMain.handle('ytdlp:releasePreviewFile', async (_e, tempPath: string) => {
    // Only ever delete files we created — guards against a malformed path
    // reaching here across the IPC boundary.
    if (
      typeof tempPath !== 'string' ||
      !tempPath.startsWith(previewTempDir + path.sep)
    )
      return;
    await withBusyRetry(() => unlink(tempPath), 5).catch(() => undefined);
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
          // Every download here is exactly one video: playlists are expanded
          // up front via getPlaylistInfo and queued one URL at a time
          // (see startPlaylistDownload). Without this, extractors that resolve
          // a single-item URL to its whole container — viu:ott returns every
          // episode of a series for a /vod/{episode_id}/ URL — pull the entire
          // list instead of the requested item.
          noPlaylist: true,
        },
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

    for (const { proc } of activePreviewDownloads.values()) {
      try {
        proc.kill('SIGKILL');
      } catch (err) {
        console.error(
          '[ytdlp cleanup] failed to kill preview-download proc:',
          err,
        );
      }
    }
    activePreviewDownloads.clear();
    rm(previewTempDir, { recursive: true, force: true }).catch(() => undefined);
  };
};
