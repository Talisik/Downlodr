import type { IpcMainInvokeEvent } from 'electron';
import { app, BrowserWindow, ipcMain, session } from 'electron';
import { existsSync } from 'fs';
import { mkdir, readFile, rename, rm, stat, unlink } from 'fs/promises';
import path from 'path';
import * as YTDLP from 'yt-dlp-helper';
import { DownloadOptions } from '../../../downlodr/schema/ytdlpSchema';
import { resolveCookiesForCall } from './cookieAuth/state';
import {
  canMakeGitHubApiCall,
  getCachedVersion,
  getGitHubApiCooldownRemainingSeconds,
  markGitHubApiCall,
  setCachedVersion,
} from './githubHandler';
import { hydratePlaylistEntries } from './playlistEntryMetadata';
import { notifyTrayDownloadComplete } from './trayHandler';
import { isYtdlpUpgrade } from './ytdlpVersion';
import { spawn } from 'child_process';

const PROGRESS_THROTTLE_MS = 150;

const MAX_LOG_BYTES = 51200;

const BINARY_LOCK_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);

const BUSY_RETRY_MAX_DELAY_MS = 10_000;

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

const YTDLP_BINARY_NAME =
  process.platform === 'win32'
    ? 'yt-dlp.exe'
    : process.platform === 'darwin'
    ? 'yt-dlp_macos'
    : 'yt-dlp_linux';

/**
 * Where forge.config.ts ships the binary in a packaged build, most-preferred
 * first. darwin gets it copied (and codesigned) into Contents/Resources;
 * win32 gets it dropped next to the executable by the postPackage hook.
 * app.getPath('exe') on darwin resolves to Contents/MacOS/Downlodr, hence
 * checking resourcesPath first.
 */
function ytdlpBundleCandidates(): string[] {
  const exeAdjacent = path.join(
    path.dirname(app.getPath('exe')),
    YTDLP_BINARY_NAME,
  );
  return process.resourcesPath
    ? [path.join(process.resourcesPath, YTDLP_BINARY_NAME), exeAdjacent]
    : [exeAdjacent];
}

/**
 * The binary every YTDLP.* call must be pointed at explicitly.
 *
 * yt-dlp-helper defaults to `./yt-dlp_macos` (or `./yt-dlp.exe`) **relative
 * to process.cwd()** when handed no path. A packaged .app launched from
 * Finder or the Dock has cwd `/`, so every call spawned a path that does not
 * exist: getYTDLPVersion() returned null — which renders as a blank version
 * in the About modal — and metadata, playlist and download calls all failed
 * with a generic error. Windows only ever worked by accident, because
 * launching from the installed shortcut happens to set cwd to the install
 * directory, which is exactly where the postPackage hook drops yt-dlp.exe.
 *
 * On darwin the bundled copy is additionally spawned *in place*: yt-dlp_macos
 * is a PyInstaller bundle that only starts under the hardened runtime with
 * the entitlements forge.config.ts signs it with, and it is sealed into the
 * .app's signature and covered by its notarization ticket. A copy run from
 * outside the bundle is evaluated standalone by Gatekeeper instead.
 */
function getYtdlpBinaryPath(): string {
  if (app.isPackaged) {
    const bundled = ytdlpBundleCandidates().find((candidate) =>
      existsSync(candidate),
    );
    if (bundled) return bundled;
    // Nothing bundled — a broken build. Point at a writable location the
    // updater can populate rather than a cwd-relative name whose meaning
    // depends on how the app happened to be launched.
    return path.join(app.getPath('userData'), YTDLP_BINARY_NAME);
  }
  const devPath = path.join(app.getAppPath(), YTDLP_BINARY_NAME);
  return existsSync(devPath) ? devPath : YTDLP_BINARY_NAME;
}

/**
 * Whether the resolved binary may be overwritten in place.
 *
 * False on packaged macOS: the binary lives inside the signed .app, and
 * writing there invalidates the bundle signature and leaves the app unable
 * to launch. macOS picks up a new yt-dlp with the next app release — which
 * is what actually happened before this change too, since the old
 * cwd-relative update target never resolved to the bundled binary anyway.
 */
function canSelfUpdateYtdlp(): boolean {
  return !(app.isPackaged && process.platform === 'darwin');
}

async function downloadYtdlpUpdateSafely(version: string): Promise<void> {
  const targetPath = getYtdlpBinaryPath();
  const tempPath = `${targetPath}.download`;
  const oldPath = `${targetPath}.old`;
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
    await unlink(oldPath).catch(() => undefined);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

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
    await rename(oldPath, targetPath).catch(() => undefined);
    throw err;
  }
}

export async function runYtdlpCheckAndUpdate(): Promise<void> {
  try {
    const ytdlpPath = getYtdlpBinaryPath();

    // Nothing below may write to the binary on packaged macOS — it sits
    // inside the signed .app. See canSelfUpdateYtdlp().
    if (!canSelfUpdateYtdlp()) return;

    await unlink(`${ytdlpPath}.old`).catch(() => undefined);

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
      await withBusyRetry(() => YTDLP.downloadYTDLP({ filePath: ytdlpPath }));
      return;
    }

    if (latestVersion && isYtdlpUpgrade(currentVersion, latestVersion)) {
      await downloadYtdlpUpdateSafely(latestVersion);
    }
  } catch (error) {
    console.error('[ytdlp startup] check-and-update failed:', error);
  }
}

export const ytdlpHandler = (_mainWindow: BrowserWindow): (() => void) => {
  YTDLP.Config.log = true;

  // The single binary every YTDLP.* call below is pointed at. Passing this
  // explicitly is what keeps the helper off its cwd-relative default — see
  // getYtdlpBinaryPath().
  const ytdlpPath = getYtdlpBinaryPath();
  if (app.isPackaged && !existsSync(ytdlpPath)) {
    // A build that shipped without yt-dlp cannot fetch metadata or download
    // anything. Name it once, loudly, at startup: the per-call failures that
    // follow are generic ("No info returned from YTDLP.getInfo") because the
    // helper swallows spawn errors, so without this there is nothing anywhere
    // that says the binary is simply missing.
    console.error(
      `[ytdlp] no binary at ${ytdlpPath} — checked ${ytdlpBundleCandidates().join(
        ', ',
      )}. This build shipped without a downloader; metadata and downloads cannot work.`,
    );
  }

  const activeControllerIds = new Set<string>();
  const cancelledControllerIds = new Set<string>();
  const controllerOwner = new Map<string, string>();
  const cancelledDownloadIds = new Set<string>();
  const cancelledPreviewRequests = new Set<string>();
  const activeDirectUrlProcs = new Set<ReturnType<typeof spawn>>();

  const coalesce = <T>(
    inFlight: Map<string, Promise<T>>,
    key: string,
    start: () => Promise<T>,
  ): Promise<T> => {
    const running = inFlight.get(key);
    if (running) return running;
    const p = start().finally(() => {
      if (inFlight.get(key) === p) inFlight.delete(key);
    });
    inFlight.set(key, p);
    return p;
  };
  const infoInFlight = new Map<string, Promise<unknown>>();
  const directUrlInFlight = new Map<string, Promise<string>>();

  const hostOf = (url: string): string | null => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
  };
  const hostIs = (host: string | null, base: string): boolean =>
    host !== null && (host === base || host.endsWith(`.${base}`));
  const RETRYABLE_HOSTS = ['tiktok.com', 'bilibili.tv'];
  const isRetryableHost = (url: string): boolean =>
    RETRYABLE_HOSTS.some((h) => hostIs(hostOf(url), h));
  const isTikTokHost = (url: string): boolean =>
    hostIs(hostOf(url), 'tiktok.com');

  const TRANSIENT_MEMORY_MS = 60_000;
  const EXTRACTION_RETRY_ATTEMPTS = 8;
  const DOWNLOAD_RETRY_ATTEMPTS = 3;
  const RETRY_BASE_DELAY_MS = 1_000;
  const RETRY_MAX_DELAY_MS = 8_000;
  const CIRCUIT_FAILURE_THRESHOLD = 12;
  const CIRCUIT_COOLDOWN_MS = 60_000;
  const TRANSIENT_TAG = 'TRANSIENT_EXTRACTION';
  const transientHosts = new Map<string, number>();
  const circuitState = new Map<
    string,
    { failures: number; openedAt: number }
  >();

  const isTransientErrorText = (text: string): boolean =>
    /Unable to extract universal data for rehydration|IP address is blocked|HTTP Error 412/i.test(
      text,
    );
  const noteTransient = (url: string, errorText: string): void => {
    if (!isTransientErrorText(errorText)) return;
    const host = hostOf(url);
    if (host) transientHosts.set(host, Date.now());
  };
  const isKnownTransientHost = (url: string): boolean => {
    const host = hostOf(url);
    if (!host) return false;
    const at = transientHosts.get(host);
    if (at === undefined) return false;
    if (Date.now() - at > TRANSIENT_MEMORY_MS) {
      transientHosts.delete(host);
      return false;
    }
    return true;
  };

  const isCircuitOpen = (url: string): boolean => {
    const host = hostOf(url);
    if (host === null) return false;
    const state = circuitState.get(host);
    if (!state || state.failures < CIRCUIT_FAILURE_THRESHOLD) return false;
    if (Date.now() - state.openedAt > CIRCUIT_COOLDOWN_MS) {
      circuitState.delete(host);
      return false;
    }
    return true;
  };
  const noteTransientFailure = (url: string): void => {
    const host = hostOf(url);
    if (host === null) return;
    const state = circuitState.get(host) ?? { failures: 0, openedAt: 0 };
    state.failures += 1;
    if (state.failures === CIRCUIT_FAILURE_THRESHOLD) {
      state.openedAt = Date.now();
      console.log(
        `[ytdlp] ${host}: ${CIRCUIT_FAILURE_THRESHOLD} consecutive extraction failures — pausing retries for ${
          CIRCUIT_COOLDOWN_MS / 1000
        }s`,
      );
    }
    circuitState.set(host, state);
  };
  const noteExtractionSuccess = (url: string): void => {
    const host = hostOf(url);
    if (host !== null) circuitState.delete(host);
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));
  const retryDelayMs = (attempt: number): number => {
    const cap = Math.min(
      RETRY_MAX_DELAY_MS,
      RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
    );
    return Math.round(cap * (0.5 + Math.random() * 0.5));
  };

  const HOST_MIN_REQUEST_GAP_MS: Record<string, number> = {
    'bilibili.tv': 3_000,
  };
  const hostGateChain = new Map<string, Promise<void>>();
  const hostLastRequestAt = new Map<string, number>();
  const minRequestGapFor = (url: string): [string, number] | null => {
    const host = hostOf(url);
    if (host === null) return null;
    for (const [base, gap] of Object.entries(HOST_MIN_REQUEST_GAP_MS)) {
      if (hostIs(host, base)) return [base, gap];
    }
    return null;
  };
  const paceHost = (url: string): Promise<void> => {
    const entry = minRequestGapFor(url);
    if (entry === null) return Promise.resolve();
    const [base, gap] = entry;
    const previous = hostGateChain.get(base) ?? Promise.resolve();
    const next = previous.then(async () => {
      const wait = (hostLastRequestAt.get(base) ?? 0) + gap - Date.now();
      if (wait > 0) {
        console.log(`[ytdlp] ${base}: pacing next request by ${wait}ms`);
        await sleep(wait);
      }
      hostLastRequestAt.set(base, Date.now());
    });
    hostGateChain.set(
      base,
      next.catch(() => undefined),
    );
    return next;
  };
  const POST_METADATA_COOLDOWN_MS = 10_000;

  const isTransientError = (error: unknown): boolean =>
    error instanceof Error &&
    (error.message.startsWith(TRANSIENT_TAG) ||
      isTransientErrorText(error.message));

  async function retryTransient<T>(
    label: string,
    url: string,
    attempt: (opts: { isFinal: boolean }) => Promise<T>,
  ): Promise<T> {
    if (!isRetryableHost(url)) return attempt({ isFinal: true });

    let lastError: unknown;
    for (let i = 1; i <= EXTRACTION_RETRY_ATTEMPTS; i += 1) {
      try {
        const value = await attempt({
          isFinal: i === EXTRACTION_RETRY_ATTEMPTS,
        });
        noteExtractionSuccess(url);
        return value;
      } catch (error) {
        lastError = error;
        if (!isTransientError(error)) break;
        noteTransientFailure(url);
        if (i === EXTRACTION_RETRY_ATTEMPTS || isCircuitOpen(url)) break;
        const wait = retryDelayMs(i);
        console.log(
          `[ytdlp] ${label}: transient extraction failure, retrying in ${wait}ms (attempt ${
            i + 1
          }/${EXTRACTION_RETRY_ATTEMPTS})`,
        );
        await sleep(wait);
      }
    }
    if (isTransientError(lastError)) {
      throw new Error(
        'EXTRACTION_FAILED: The site did not return video data after several attempts. Please try again.',
      );
    }
    throw lastError;
  }

  ipcMain.handle(
    'ytdlp:playlist:info',
    async (_e, videoUrl: string | { url: string }) => {
      try {
        const url = typeof videoUrl === 'string' ? videoUrl : videoUrl?.url;
        if (!url) {
          throw new Error('Playlist URL is required');
        }
        await paceHost(url);
        const info = await YTDLP.getPlaylistInfo({
          url,
          ...(await resolveCookiesForCall(url)),
          ytdlpDownloadDestination: ytdlpPath,
        });
        return hydratePlaylistEntries(info);
      } catch (error) {
        console.error('Error fetching playlist info:', error);
        throw error;
      }
    },
  );

  ipcMain.handle('ytdlp:info', async (e, url) => {
    if (!url) {
      throw new Error('Video URL is required');
    }
    return coalesce(infoInFlight, String(url), async () => {
      const info = await retryTransient(
        'ytdlp:info',
        String(url),
        ({ isFinal }) => fetchInfoOnce(url, isFinal),
      );
      if (isTikTokHost(String(url))) {
        console.log(
          `[ytdlp] ytdlp:info: metadata ready, settling ${POST_METADATA_COOLDOWN_MS}ms before the download may start`,
        );
        await sleep(POST_METADATA_COOLDOWN_MS);
      }
      return info;
    });
  });

  async function fetchInfoOnce(url: string, allowDiagnostic = true) {
    try {
      await paceHost(url);
      const info = await YTDLP.getInfo(
        url,
        {
          ...(await resolveCookiesForCall(url)),
          noPlaylist: true,
        },
        ytdlpPath,
      );
      if (!info?.ok) {
        if (info?.isPlaylist) {
          throw new Error(
            `PLAYLIST_URL:${
              info.entryCount ?? ''
            }: This URL is a playlist or series, not a single video.`,
          );
        }
        if (!allowDiagnostic && isKnownTransientHost(url)) {
          throw new Error(
            `${TRANSIENT_TAG}: extractor returned no data for ${url}`,
          );
        }
        await paceHost(url);
        const diagnostic = await YTDLP.invoke({
          args: ['--no-warnings', '--simulate', url],
          ytdlpDownloadDestination: ytdlpPath,
        }).catch(() => null);
        if (diagnostic?.data) noteTransient(url, diagnostic.data);
        if (diagnostic?.data && /Unsupported URL/i.test(diagnostic.data)) {
          throw new Error(
            'UNSUPPORTED_SITE: This website is not supported by yt-dlp, the tool Downlodr uses to fetch videos.',
          );
        }
        if (diagnostic?.data && /Cannot parse data/i.test(diagnostic.data)) {
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
        if (
          diagnostic?.data &&
          (/age-restricted and only available on YouTube/i.test(
            diagnostic.data,
          ) ||
            /Sign in to confirm your age/i.test(diagnostic.data))
        ) {
          const resolved = await resolveCookiesForCall(url);
          const cookiesConfigured = Boolean(
            resolved.cookiesFromBrowser || resolved.cookies,
          );
          if (cookiesConfigured) {
            throw new Error(
              "AGE_RESTRICTED_UNVERIFIED: This video is age-restricted, and the signed-in Google account hasn't completed age verification. Verify your age at myaccount.google.com, or try a different signed-in browser.",
            );
          }
          throw new Error(
            'AGE_RESTRICTED: This video is age-restricted. Sign in to YouTube in Firefox or Brave, then enable it under Advanced Settings → Authentication.',
          );
        }
        if (diagnostic?.data && /page needs to be reloaded/i.test(diagnostic.data)) {
          throw new Error(
            'EXTRACTION_BLOCKED: YouTube is currently blocking this video from being extracted (a known, ongoing yt-dlp limitation, not fixed by signing in). Try again later, or check for a yt-dlp update.',
          );
        }
        if (diagnostic?.data && isKnownTransientHost(url)) {
          throw new Error(
            `${TRANSIENT_TAG}: extractor returned no data for ${url}`,
          );
        }
        throw new Error('No info returned from YTDLP.getInfo');
      }
      return info;
    } catch (error) {
      console.error('Error fetching video info:', error);
      throw error;
    }
  }

  ipcMain.handle('ytdlp:getCurrentVersion', async () => {
    try {
      const version = await YTDLP.getYTDLPVersion(ytdlpPath);
      // getYTDLPVersion() returns null for *any* spawn that produced no
      // output — a missing binary, or one the OS refused to start. Reporting
      // that as a success is why the About modal rendered an empty version
      // with nothing anywhere explaining it.
      if (!version) {
        const error = `yt-dlp at ${ytdlpPath} did not report a version — it is missing, not executable, or was terminated on launch.`;
        console.error('[ytdlp] version probe failed:', error);
        return { success: false, error, version: null };
      }
      return { success: true, version };
    } catch (error) {
      console.error('Error getting current YT-DLP version:', error);
      return { success: false, error: error.message, version: null };
    }
  });

  ipcMain.handle('ytdlp:getLatestVersion', async () => {
    try {
      const cachedVersion = getCachedVersion();
      if (cachedVersion) {
        return {
          success: true,
          version: cachedVersion,
          message: 'Retrieved from cache',
        };
      }

      if (!canMakeGitHubApiCall()) {
        const remainingTime = getGitHubApiCooldownRemainingSeconds();
        return {
          success: false,
          error: `Rate limited. Please wait ${remainingTime} seconds before checking again.`,
          version: null,
        };
      }

      markGitHubApiCall();
      const response = await YTDLP.getLatestYTDLPVersionFromGitHub();

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

  ipcMain.handle('ytdlp:checkAndUpdate', async () => {
    try {
      // Updating writes over the resolved binary, which on packaged macOS
      // lives inside the signed .app — see canSelfUpdateYtdlp().
      if (!canSelfUpdateYtdlp()) {
        return {
          success: true,
          action: 'bundled',
          message:
            'yt-dlp ships inside the app on macOS and updates with it — no separate update is available.',
          currentVersion: await YTDLP.getYTDLPVersion(ytdlpPath),
          latestVersion: getCachedVersion(),
        };
      }

      const currentVersion = await YTDLP.getYTDLPVersion(ytdlpPath);

      let latestVersion = getCachedVersion();
      let latestResponse;

      if (!latestVersion) {
        if (!canMakeGitHubApiCall()) {
          const remainingTime = getGitHubApiCooldownRemainingSeconds();
          return {
            success: false,
            error: `Rate limited. Please wait ${remainingTime} seconds before checking again.`,
            action: 'error',
          };
        }

        markGitHubApiCall();
        latestResponse = await YTDLP.getLatestYTDLPVersionFromGitHub();

        if (!latestResponse.ok || !latestResponse.version) {
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

  ipcMain.handle('ytdlp:downloadYTDLP', async (_event, options = {}) => {
    try {
      // Without an explicit destination this defaults to ytdlpPath below,
      // which on packaged macOS is inside the signed .app — a write there
      // invalidates the bundle signature. See canSelfUpdateYtdlp().
      if (!canSelfUpdateYtdlp() && !options.filePath?.trim()) {
        return {
          success: false,
          error:
            'yt-dlp ships inside the app on macOS and cannot be replaced at runtime; update the app instead.',
        };
      }

      const downloadOptions: DownloadOptions = {
        forceDownload: options.forceDownload || false,
      };

      if (options.filePath && options.filePath.trim()) {
        const filePath = options.filePath.trim();

        if (
          !path.extname(filePath) ||
          path.extname(filePath).toLowerCase() !== '.exe'
        ) {
          // YTDLP_BINARY_NAME, not a bare 'yt-dlp': the helper looks for
          // the platform-suffixed name (yt-dlp_macos / yt-dlp_linux), so
          // writing an unsuffixed file here produced one it never finds.
          downloadOptions.filePath = path.join(filePath, YTDLP_BINARY_NAME);
        } else {
          downloadOptions.filePath = filePath;
        }
      }

      // No caller-supplied path — target the resolved binary rather than
      // letting the helper fall back to its cwd-relative default.
      if (!downloadOptions.filePath) {
        downloadOptions.filePath = ytdlpPath;
      }

      if (
        options.version &&
        options.version.trim() &&
        options.version.trim().toLowerCase() !== 'latest'
      ) {
        downloadOptions.version = options.version.trim();
      }

      if (options.platform && options.platform !== 'auto') {
        downloadOptions.platform = options.platform;
      }
      await YTDLP.downloadYTDLP(downloadOptions);
      return { success: true };
    } catch (error) {
      console.error('Error downloading YTDLP:', error);
      return { success: false, error: error.message };
    }
  });

  const GRACEFUL_STOP_TIMEOUT_MS = 8000;

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

  async function gracefulKill(controller: YTDLP.Terminal): Promise<boolean> {
    cancelledControllerIds.add(controller.id);
    const owner = controllerOwner.get(controller.id);
    if (owner !== undefined) cancelledDownloadIds.add(owner);
    const proc = controller.process;
    if (!proc || proc.killed) return true;

    const exited = new Promise<boolean>((resolve) => {
      proc.once('exit', () => resolve(true));
    });

    if (process.platform !== 'win32' || !proc.pid) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function killControllerById(id: any) {
    try {
      const controller = YTDLP.getTerminalFromID(id);

      if (controller) {
        return await gracefulKill(controller);
      }
      const owner = controllerOwner.get(id);
      if (owner !== undefined) {
        cancelledDownloadIds.add(owner);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to kill controller with ID ${id}:`, error);
      return false;
    }
  }

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

  // getDirectUrl/downloadPreview spawn yt-dlp themselves rather than going
  // through yt-dlp-helper, but must resolve the same binary. This used to
  // duplicate the lookup and searched for an unsuffixed 'yt-dlp' on darwin,
  // which only worked because forge.config.ts happens to drop the binary
  // under both names.
  function resolveYtdlpBinaryPath(): string {
    return ytdlpPath;
  }

  ipcMain.handle('ytdlp:getDirectUrl', async (_e, url: string) => {
    return coalesce(directUrlInFlight, url, () =>
      retryTransient('ytdlp:getDirectUrl', url, () => spawnDirectUrl(url)),
    );
  });

  function spawnDirectUrl(url: string): Promise<string> {
    const binaryPath = resolveYtdlpBinaryPath();

    return new Promise<string>((resolve, reject) => {
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
          noteTransient(url, error);
          reject(new Error(error.trim()));
          return;
        }
        try {
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
  }

  const previewTempDir = path.join(app.getPath('temp'), 'downlodr-preview');
  const activePreviewDownloads = new Map<
    string,
    { proc: ReturnType<typeof spawn>; tempPath: string }
  >();

  const previewTempDirSwept = rm(previewTempDir, {
    recursive: true,
    force: true,
  }).catch(() => undefined);

  function sanitizePreviewRequestId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  }

  async function cancelPreviewDownload(requestId: string): Promise<void> {
    cancelledPreviewRequests.add(requestId);
    const entry = activePreviewDownloads.get(requestId);
    if (!entry) return;
    activePreviewDownloads.delete(requestId);
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
      cancelledPreviewRequests.delete(requestId);
      await mkdir(previewTempDir, { recursive: true });
      const binaryPath = resolveYtdlpBinaryPath();

      return retryTransient('ytdlp:downloadPreview', url, () => {
        if (cancelledPreviewRequests.has(requestId)) {
          return Promise.reject(
            new Error('PREVIEW_CANCELLED: preview request was cancelled'),
          );
        }
        const tempPath = path.join(
          previewTempDir,
          `${sanitizePreviewRequestId(requestId)}-${Date.now()}.mp4`,
        );
        return new Promise<string>((resolve, reject) => {
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
              noteTransient(url, error);
              unlink(tempPath).catch(() => undefined);
              reject(
                new Error(error.trim() || `yt-dlp exited with code ${code}`),
              );
              return;
            }
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
    if (
      typeof tempPath !== 'string' ||
      !tempPath.startsWith(previewTempDir + path.sep)
    )
      return;
    await withBusyRetry(() => unlink(tempPath), 5).catch(() => undefined);
  });

  ipcMain.handle('kill-controller', async (_, id) => {
    return killControllerById(id);
  });

  type YtdlpDownloadArgs = Parameters<typeof YTDLP.download>[0]['args'];
  type DownloadRequestArgs = {
    url: string;
    outputFilepath: string;
    videoFormat: YtdlpDownloadArgs['videoFormat'];
    remuxVideo: YtdlpDownloadArgs['remuxVideo'];
    audioExt: YtdlpDownloadArgs['audioFormat'];
    audioFormatId: YtdlpDownloadArgs['audioQuality'];
    limitRate: YtdlpDownloadArgs['limitRate'];
  };

  type DownloadAttemptResult = {
    retry: boolean;
    transient?: boolean;
    succeeded?: boolean;
    value?: { downloadId: unknown; controllerId: string };
  };

  const GENERIC_DOWNLOAD_ATTEMPTS = 2;

  ipcMain.handle('ytdlp:download', async (e, id, args) => {
    const isRetryable = isRetryableHost(args.url);
    const maxAttempts = isRetryable
      ? DOWNLOAD_RETRY_ATTEMPTS
      : GENERIC_DOWNLOAD_ATTEMPTS;
    const downloadKey = String(id);
    cancelledDownloadIds.delete(downloadKey);
    let lastValue: DownloadAttemptResult['value'];
    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        await paceHost(args.url);
        const result = await runDownloadAttempt(e, id, args, {
          canRetryTransient:
            isRetryable && attempt < maxAttempts && !isCircuitOpen(args.url),
          canRetryGeneric: attempt === 1 && attempt < maxAttempts,
        });
        lastValue = result.value ?? lastValue;
        if (!result.retry) {
          if (isRetryable && result.succeeded) noteExtractionSuccess(args.url);
          return result.value;
        }
        if (isRetryable && result.transient) noteTransientFailure(args.url);
        const wait = retryDelayMs(attempt);
        console.log(
          `[ytdlp] ytdlp:download: attempt ${attempt} failed${
            result.transient ? ' (transient extraction)' : ''
          }, retrying in ${wait}ms (attempt ${attempt + 1}/${maxAttempts})`,
        );
        await sleep(wait);
        if (cancelledDownloadIds.has(downloadKey)) {
          console.log(
            `[ytdlp] ytdlp:download: cancelled during retry backoff — not restarting`,
          );
          return lastValue;
        }
      }
      throw new Error('EXTRACTION_FAILED: download retries exhausted');
    } finally {
      cancelledDownloadIds.delete(downloadKey);
      for (const [controllerId, owner] of controllerOwner) {
        if (owner === downloadKey) controllerOwner.delete(controllerId);
      }
    }
  });

  async function runDownloadAttempt(
    e: IpcMainInvokeEvent,
    id: unknown,
    args: DownloadRequestArgs,
    {
      canRetryTransient,
      canRetryGeneric,
    }: {
      canRetryTransient: boolean;
      canRetryGeneric: boolean;
    },
  ): Promise<DownloadAttemptResult> {
    let spawned: YTDLP.Terminal | null = null;
    try {
      const controller = await YTDLP.download({
        ytdlpDownloadDestination: ytdlpPath,
        args: {
          url: args.url,
          output: args.outputFilepath,
          videoFormat: args.videoFormat,
          remuxVideo: args.remuxVideo,
          audioFormat: args.audioExt,
          audioQuality: args.audioFormatId,
          limitRate: args.limitRate,
          ...(await resolveCookiesForCall(args.url)),
          noPlaylist: true,
        },
      });

      if (!controller || typeof controller.listen !== 'function') {
        throw new Error(
          'Controller is not defined or does not have a listen method',
        );
      }

      spawned = controller;
      activeControllerIds.add(controller.id);
      controllerOwner.set(controller.id, String(id));
      e.sender.send(`ytdlp:controller:${id}`, {
        downloadId: id,
        controllerId: controller.id,
      });

      let processCompletionHandled = false;
      let deferredCompletion: (() => void) | null = null;
      let finalExitCode: number | null = null;
      let trayNotificationSent = false;
      let completeLog = '';
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
          if (processCompletionHandled) return;
          processCompletionHandled = true;
          activeControllerIds.delete(controller.id);

          if (fallbackTimeout !== null) {
            clearTimeout(fallbackTimeout);
            fallbackTimeout = null;
          }

          finalExitCode = code;
          const completionMessage = `Process '${controller.id}' ${eventType} with code: ${code}, signal: ${signal}`;
          completeLog += `\n${completionMessage}`;

          const sendCompletion = () => {
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
            if (code === 0) {
              sendTrayNotificationOnce();
            }
          };
          if (code !== 0 && (canRetryTransient || canRetryGeneric)) {
            deferredCompletion = sendCompletion;
            return;
          }
          setTimeout(sendCompletion, 100);
        };

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

      let lastProgressSentTime = 0;

      for await (const chunk of controller.listen()) {
        if (chunk?.data?.log) {
          completeLog += chunk.data.log;
          if (completeLog.length > MAX_LOG_BYTES) {
            completeLog = completeLog.slice(completeLog.length - MAX_LOG_BYTES);
          }
        }

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

        e.sender.send(`ytdlp:download:status:${id}`, chunk);

        if (chunk != null && chunk.data && chunk.data.status === 'finished') {
          sendTrayNotificationOnce();
        }
      }

      if (deferredCompletion) {
        const wasCancelled =
          cancelledControllerIds.has(controller.id) ||
          cancelledDownloadIds.has(String(id));
        const transient = isTransientErrorText(completeLog);
        const shouldRetry =
          !wasCancelled &&
          ((transient && canRetryTransient) || canRetryGeneric);
        if (shouldRetry) {
          return { retry: true, transient };
        }
        deferredCompletion();
      }

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

      return {
        retry: false,
        succeeded: finalExitCode === 0,
        value: { downloadId: id, controllerId: controller.id },
      };
    } catch (error) {
      if (isTransientError(error) && canRetryTransient) {
        return { retry: true, transient: true };
      }
      if (canRetryGeneric) {
        return { retry: true, transient: false };
      }
      e.sender.send(`ytdlp:download:error:${id}`, (error as Error).message);
      throw error;
    } finally {
      if (spawned) cancelledControllerIds.delete(spawned.id);
    }
  }

  ipcMain.handle('ytdlp:readCaptionFile', async (_e, filePath: string) => {
    try {
      if (!filePath) throw new Error('filePath is required');
      const ALLOWED_EXTENSIONS = ['.vtt', '.srt'];
      const ext = path.extname(filePath).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        throw new Error(`Unsupported caption extension: ${ext}`);
      }
      const content = await readFile(filePath, 'utf-8');
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
