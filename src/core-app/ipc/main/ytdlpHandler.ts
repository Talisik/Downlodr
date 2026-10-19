/* Handler for ytdlp operations of base app such as getting version, getting latest version, checking and updating, downloading, etc. */
/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

import type { IpcMainInvokeEvent } from 'electron';
import { app, BrowserWindow, ipcMain, session } from 'electron';
import { existsSync } from 'fs';
import { mkdir, readFile, rename, rm, stat, unlink } from 'fs/promises';
import path from 'path';
import * as YTDLP from 'yt-dlp-helper';
import { DownloadOptions } from '../../../downlodr/schema/ytdlpSchema';
import { resolveCookiesForCall } from './cookieAuth/state';
import {
  cookieCliArgs,
  cookiesForVideo,
  hasCookies,
  isCookieSessionRejected,
  NO_COOKIES,
  retryInfoWithoutCookies,
  shouldRetryDownloadWithoutCookies,
  type CookieOptions,
} from './cookieFallback';
import {
  canMakeGitHubApiCall,
  getCachedVersion,
  getGitHubApiCooldownRemainingSeconds,
  markGitHubApiCall,
  setCachedVersion,
} from './githubHandler';
import { toExtractorUrl } from './extractorUrl';
import { isBlockedBySite } from './ytdlpSiteBlock';
import { runExclusiveYtdlpUpdate, waitForYtdlpUpdate } from './ytdlpUpdateGate';
import { isOnline } from './appBehaviorHandler';
import {
  finalizeFinishedRecording,
  remuxMpegTsRecording,
} from './liveRecordingRemux';
import { hydratePlaylistEntries } from './playlistEntryMetadata';
import { notifyTrayDownloadComplete } from './trayHandler';
import { isYtdlpUpgrade } from './ytdlpVersion';
import {
  getBundledFfmpegPaths,
  getYtdlpBinaryPath,
  ytdlpBundleCandidates,
} from './bundledBinariesEnv';
import { ytdlpBinaryName } from './bundledBinaries';
import { cancelConversionJob } from './formatConversionHandler';
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

/**
 * yt-dlp binary resolution lives in bundledBinaries.ts, shared with
 * skedulosaHandler.ts so the two cannot drift apart again. See that module for
 * why a cwd-relative name is never acceptable here.
 */
const YTDLP_BINARY_NAME = ytdlpBinaryName(process.platform);

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
  const targetPath = getYtdlpBinaryPath();
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

/** Tells every window how a yt-dlp self-update is going (for the toast). */
function broadcastYtdlpUpdateStatus(status: {
  state: 'updating' | 'updated' | 'failed';
  version: string | null;
}): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('ytdlp:update-status', status);
  }
}

/**
 * Runs the actual download/swap of a yt-dlp update: holds new yt-dlp work
 * until it's done (see ytdlpUpdateGate) and reports progress to the UI.
 * Only this phase is gated — the version check before it is quick and
 * usually ends in "already up to date".
 */
async function runVisibleYtdlpUpdate(
  version: string | null,
  update: () => Promise<unknown>,
): Promise<void> {
  broadcastYtdlpUpdateStatus({ state: 'updating', version });
  try {
    await runExclusiveYtdlpUpdate(update);
    broadcastYtdlpUpdateStatus({ state: 'updated', version });
  } catch (error) {
    broadcastYtdlpUpdateStatus({ state: 'failed', version });
    throw error;
  }
}

export async function runYtdlpCheckAndUpdate(): Promise<void> {
  try {
    const ytdlpPath = getYtdlpBinaryPath();

    // Nothing below may write to the binary on packaged macOS — it sits
    // inside the signed .app. See canSelfUpdateYtdlp().
    if (!canSelfUpdateYtdlp()) return;

    await unlink(`${ytdlpPath}.old`).catch(() => undefined);

    // Offline: nothing to check against, and the GitHub/download calls would
    // only fail (or hang) — skip until the next launch.
    if (!(await isOnline())) {
      console.log('[ytdlp startup] offline — skipping yt-dlp update check');
      return;
    }

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
      await runVisibleYtdlpUpdate(latestVersion ?? null, () =>
        withBusyRetry(() => YTDLP.downloadYTDLP({ filePath: ytdlpPath })),
      );
      return;
    }

    // Only ever move forward. A plain inequality check treats a manually
    // installed nightly (2026.08.17.073947) as "not the latest stable"
    // and force-downgrades it on every launch.
    if (latestVersion && isYtdlpUpgrade(currentVersion, latestVersion)) {
      const target = latestVersion;
      await runVisibleYtdlpUpdate(target, () =>
        downloadYtdlpUpdateSafely(target),
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

  // Tracks IDs of yt-dlp controllers that are currently downloading.
  // Used by the cleanup function to SIGKILL orphaned processes on app quit.
  // On Windows, child processes are not automatically killed when the parent exits,
  // so without this, active yt-dlp instances linger in Task Manager after close.
  const activeControllerIds = new Set<string>();
  // Controllers the user (or app shutdown) deliberately killed. A cancelled
  // download exits nonzero exactly like a failed one, and on Windows the stop
  // path is a Ctrl+C rather than a signal, so the exit code and `signal` alone
  // cannot tell the two apart. Without this, the generic retry below would
  // cheerfully restart a download the user just stopped.
  const cancelledControllerIds = new Set<string>();
  // A retrying download outlives any single controller: between attempts no
  // process exists at all, so a stop arriving in that window used to find no
  // terminal, report failure to the user, and leave the retry loop running.
  // Cancellation therefore has to be tracked against something that survives
  // the retries — the download id for downloads, the requestId for previews.
  const controllerOwner = new Map<string, string>();
  const cancelledDownloadIds = new Set<string>();
  // Controllers stopped via "Finish recording" rather than Stop: their exit
  // is a success whenever a recording exists (see handleProcessCompletion).
  const finishingControllerIds = new Set<string>();
  const cancelledPreviewRequests = new Set<string>();
  const activeDirectUrlProcs = new Set<ReturnType<typeof spawn>>();

  // Merges extractions that overlap in time. Callers that ask for the same
  // URL while an identical extraction is still running await that one instead
  // of spawning a second yt-dlp. Entries are dropped the moment the promise
  // settles, so this is NOT a cache — nothing is ever reused after the fact
  // and signed CDN URLs can't go stale here.
  //
  // Why: the video panel re-runs its fetch effect when its deps change, and
  // its generation guard only discards the stale *result* — the process has
  // already spawned and already hit the site. That produced bursts of four
  // near-simultaneous extractions of one TikTok URL (~300ms apart), which is
  // what trips TikTok's bot check and blocks everything after it.
  //
  // Keyed per handler, not globally: ytdlp:info and ytdlp:getDirectUrl run
  // different yt-dlp args and return different shapes, so they can't share a
  // result.
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

  // TikTok serves a data-stripped page instead of the real one for a randomly
  // varying share of requests; yt-dlp then reports "Unable to extract universal
  // data for rehydration" or "Your IP address is blocked from accessing this
  // post". Measured against tiktok.com a single attempt succeeds only ~20% of
  // the time, and that rate is independent of impersonation target and of
  // browser cookies — so the only thing that helps is asking again.
  //
  // SCOPE: retrying is deliberately limited to TikTok, by hostname. Both error
  // strings below are raised only by yt-dlp's tiktok.py, but matching on text
  // alone would be one careless regex edit away from multiplying traffic to
  // every other site — and with up to `maxDownloadNum` (default 5) downloads
  // plus 3 concurrent info fetches in flight, that multiplies. isRetryableHost
  // is the hard gate: every other site takes the single-attempt path it always
  // took, byte for byte.
  //
  // bilibili.tv joins the list for a different failure with the same shape:
  // its playurl endpoint (the one that enumerates formats) answers HTTP 412
  // Precondition Failed once the client trips bilibili's risk control, while
  // the season/episode-list endpoints keep returning 200. That asymmetry is
  // why a series URL fills the playlist page and then every per-episode fetch
  // fails. Confirmed with plain curl, no yt-dlp involved, on episodes that had
  // returned full formats minutes earlier — so it is throttling, not a broken
  // URL, and the cure is the same one TikTok gets: back off and ask again.
  // See HOST_MIN_REQUEST_GAP_MS below for the half that stops us tripping it.
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
  // Kept separate from isRetryableHost: some knobs below were measured against
  // TikTok specifically and must not silently apply to every retryable host.
  const isTikTokHost = (url: string): boolean =>
    hostIs(hostOf(url), 'tiktok.com');

  const TRANSIENT_MEMORY_MS = 60_000;
  const EXTRACTION_RETRY_ATTEMPTS = 8;
  // The download runs after a successful info fetch, so it starts inside a
  // window we already know is good — it needs far fewer attempts than the
  // cold info fetch does.
  const DOWNLOAD_RETRY_ATTEMPTS = 3;
  const RETRY_BASE_DELAY_MS = 1_000;
  const RETRY_MAX_DELAY_MS = 8_000;
  // Circuit breaker: once a host has failed this many times in a row we stop
  // paying for retries until the cooldown expires. Without it, a fully-bad
  // TikTok window makes every queued item burn its full attempt budget —
  // 5 downloads x 3 attempts plus 5 info fetches x 8 is ~55 requests spent
  // learning the same thing 55 times.
  const CIRCUIT_FAILURE_THRESHOLD = 12;
  const CIRCUIT_COOLDOWN_MS = 60_000;
  const TRANSIENT_TAG = 'TRANSIENT_EXTRACTION';
  const transientHosts = new Map<string, number>();
  const circuitState = new Map<
    string,
    { failures: number; openedAt: number }
  >();

  // 412 is bilibili's risk-control answer on the playurl endpoint; it is not a
  // property of the URL, so it is worth asking again. Text alone never
  // triggers a retry — isRetryableHost is still the hard gate in
  // retryTransient — so widening this regex cannot leak retries to other sites.
  const isTransientErrorText = (text: string): boolean =>
    /Unable to extract universal data for rehydration|IP address is blocked|HTTP Error 412/i.test(
      text,
    );
  // Remember that this host fails this way so later attempts can skip the
  // diagnostic re-run in fetchInfoOnce — the diagnostic is itself a full
  // extraction, and running one per retry would double the request count for
  // information we already have.
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
    // Stamp the moment the breaker trips, so the cooldown runs from there
    // rather than from the first failure in the streak.
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
  // Any success means the host is answering again — clear the streak so a
  // later bad patch starts counting from zero.
  const noteExtractionSuccess = (url: string): void => {
    const host = hostOf(url);
    if (host !== null) circuitState.delete(host);
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));
  // Exponential backoff with jitter. The jitter matters more than the growth:
  // several queued downloads fail at once, and a fixed delay would make them
  // all retry in lockstep, producing exactly the synchronised bursts that get
  // a client flagged.
  const retryDelayMs = (attempt: number): number => {
    const cap = Math.min(
      RETRY_MAX_DELAY_MS,
      RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
    );
    return Math.round(cap * (0.5 + Math.random() * 0.5));
  };

  // Minimum gap between yt-dlp launches aimed at the same throttled host.
  //
  // Retrying alone is not enough for bilibili: what trips its risk control in
  // the first place is the burst. Queueing a 26-episode season runs three
  // concurrent info fetches (MAX_CONCURRENT_INFO_FETCHES in the renderer)
  // roughly 200ms apart, and each extraction is ~3 HTTP requests, so bilibili
  // sees a dozen-plus hits per second and starts answering 412 to everything
  // — including entries that had just worked.
  //
  // The gate lives here rather than in the renderer's queue because this is
  // the one funnel every caller passes through: the status page, the plugin
  // API, and the MCP bridge all arrive at these handlers, and none of them can
  // opt out. Hosts absent from the table are handed straight through with no
  // await added, so every other site behaves exactly as before.
  //
  // 3s is a starting point, not a measured optimum: it holds the effective
  // rate under one extraction per 3s (~1 request/s), which has not been
  // refused. Raise it if 412s come back.
  const HOST_MIN_REQUEST_GAP_MS: Record<string, number> = {
    'bilibili.tv': 3_000,
  };
  // Per-host promise chain: each waiter queues behind the previous one, then
  // waits out whatever remains of the gap since the last launch. Serialising
  // the *wait* is what makes the spacing hold when several fetches are in
  // flight at once — three parallel callers leave 0s/3s/6s apart rather than
  // all three reading the same "last launch" timestamp and leaving together.
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
    // The chain must never inherit a rejection, or one failure would wedge
    // the host forever. `next` itself only rejects if sleep does, which it
    // does not.
    hostGateChain.set(
      base,
      next.catch(() => undefined),
    );
    return next;
  };
  // Observed in normal use: starting a download the instant its metadata
  // fetch returns fails far more often than starting it a few seconds later.
  // Sampled over 17 runs this pointed the same way but did not reach
  // significance (12% vs 33% success, p is roughly 0.3), so it is a cheap
  // precaution rather than a proven fix.
  //
  // The wait is held at the END of the metadata fetch rather than in front of
  // the download: the row simply spends a moment longer in its
  // metadata/initializing state, which reads as normal startup, and the
  // download then begins from a clean gap instead of stalling at 0%.
  // Applied only after a SUCCESSFUL fetch, and only for TikTok — a failure
  // propagates immediately, and every other site is untouched.
  const POST_METADATA_COOLDOWN_MS = 10_000;

  const isTransientError = (error: unknown): boolean =>
    error instanceof Error &&
    (error.message.startsWith(TRANSIENT_TAG) ||
      isTransientErrorText(error.message));

  // Retries `attempt` while it keeps failing the transient way. Non-TikTok
  // URLs are handed straight through untouched. Anything that is not a
  // transient extraction failure — unsupported site, parse error, playlist
  // URL, a cancelled preview — is rethrown on the first try, so this never
  // masks a real error or turns a fast failure into a slow one.
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

  // get the playlist information (renderer sends URL as string)
  ipcMain.handle(
    'ytdlp:playlist:info',
    async (_e, videoUrl: string | { url: string }) => {
      try {
        const url = typeof videoUrl === 'string' ? videoUrl : videoUrl?.url;
        if (!url) {
          throw new Error('Playlist URL is required');
        }
        await waitForYtdlpUpdate();
        await paceHost(url);
        const info = await YTDLP.getPlaylistInfo({
          url,
          ...(await resolveCookiesForCall(url)),
          ytdlpDownloadDestination: ytdlpPath,
        });
        // --flat-playlist entries can arrive bare (bilibili.tv seasons and
        // friends carry title/thumbnail in the URL fragment instead), which
        // would leave the selection page showing unlabelled rows.
        return hydratePlaylistEntries(info);
      } catch (error) {
        console.error('Error fetching playlist info:', error);
        throw error; // Propagate the error to the renderer process
      }
    },
  );

  ipcMain.handle('ytdlp:info', async (e, rawUrl) => {
    if (!rawUrl) {
      throw new Error('Video URL is required');
    }
    const url = toExtractorUrl(String(rawUrl));
    await waitForYtdlpUpdate();
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
      // Disable Chrome cookies to avoid "Could not copy Chrome cookie database" error
      // YouTube content is typically public and doesn't require authentication
      // noPlaylist: this handler describes one video — playlists come in
      // through ytdlp:playlist:info. Without it, a URL whose extractor
      // resolves to a container (bilibili multi-part 分P videos, viu:ott
      // series) makes --dump-json emit one object per entry, and getInfo's
      // single JSON.parse rejects the concatenation and returns { ok: false }.
      await paceHost(url);
      const cookies = cookiesForVideo(url, await resolveCookiesForCall(url));
      const info = await YTDLP.getInfo(
        url,
        {
          ...cookies,
          noPlaylist: true,
        },
        ytdlpPath,
      );
      if (!info?.ok) {
        // The URL is genuinely a container with no single video attached — a
        // bilibili.tv season (/play/{season} with no episode id), a YouTube
        // playlist page. --no-playlist above is a no-op for these, so yt-dlp
        // still describes every entry and getInfo reports isPlaylist. Nothing
        // is wrong with the URL; it just belongs to ytdlp:playlist:info, so
        // say so and skip the diagnostic re-run below.
        if (info?.isPlaylist) {
          throw new Error(
            `PLAYLIST_URL:${
              info.entryCount ?? ''
            }: This URL is a playlist or series, not a single video.`,
          );
        }
        // We have already classified this host as failing transiently, so the
        // diagnostic below — a second full extraction — would spend another
        // request to learn something we know. Signal transient immediately so
        // retryTransient can just try again, which is what actually works.
        //
        // The final attempt always runs the diagnostic even for a flagged
        // host: without that, a genuinely broken TikTok URL (private, deleted,
        // malformed) pasted within the memory window would be reported as a
        // transient failure rather than its real reason.
        if (!allowDiagnostic && isKnownTransientHost(url)) {
          throw new Error(
            `${TRANSIENT_TAG}: extractor returned no data for ${url}`,
          );
        }
        // getInfo() swallows yt-dlp's stderr on failure — it tries to
        // JSON.parse the process output and just returns { ok: false } when
        // that fails, discarding the actual reason. Re-run through the raw
        // invoke() (same binary resolution/download logic) to recover it,
        // most commonly "Unsupported URL" for sites yt-dlp has no extractor
        // for, so the renderer can show something more useful than a
        // generic metadata-fetch failure.
        await paceHost(url);
        // Same cookies as the lookup above: a cookie-less diagnostic can pass
        // where the real call failed, and then misreports why.
        const diagnostic = await YTDLP.invoke({
          args: ['--no-warnings', '--simulate', ...cookieCliArgs(cookies), url],
          ytdlpDownloadDestination: ytdlpPath,
        }).catch(() => null);
        if (diagnostic?.data) noteTransient(url, diagnostic.data);
        const withoutCookies = await retryInfoWithoutCookies({
          cookies,
          diagnosticLog: diagnostic?.data,
          retry: async (noCookies) => {
            console.log(
              `[ytdlp] ytdlp:info: YouTube rejected the signed-in session; retrying without cookies`,
            );
            await paceHost(url);
            return YTDLP.getInfo(
              url,
              { ...noCookies, noPlaylist: true },
              ytdlpPath,
            );
          },
        });
        if (withoutCookies) return withoutCookies;
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
        // Two YouTube age-gate messages exist ("Sign in to confirm your
        // age" and the more specific "age-restricted and only available on
        // YouTube"), but the diagnostic re-run above never carries cookies
        // — it's a fixed, cookie-less probe — so its own wording can't tell
        // "no cookies configured" apart from "cookies configured but this
        // account isn't age-verified". What actually distinguishes the two
        // cases is the app's real cookie config, not which string the
        // diagnostic happened to hit.
        if (
          diagnostic?.data &&
          (/age-restricted and only available on YouTube/i.test(
            diagnostic.data,
          ) ||
            /Sign in to confirm your age/i.test(diagnostic.data))
        ) {
          if (hasCookies(cookies)) {
            throw new Error(
              "AGE_RESTRICTED_UNVERIFIED: This video is age-restricted, and the signed-in Google account hasn't completed age verification. Verify your age at myaccount.google.com, or try a different signed-in browser.",
            );
          }
          throw new Error(
            "AGE_RESTRICTED: This video is age-restricted. Downlodr can't download age-restricted YouTube videos yet.",
          );
        }
        // YouTube's "PO token" anti-bot requirement — an ongoing, unresolved
        // arms race between yt-dlp and YouTube (see yt-dlp issue tracker).
        // Reached only when the cookie-less retry above also failed, or no
        // cookies were sent in the first place.
        if (diagnostic?.data && isCookieSessionRejected(diagnostic.data)) {
          throw new Error(
            'EXTRACTION_BLOCKED: YouTube refused to return this video. Try again later, or check for a yt-dlp update.',
          );
        }
        // The site refused the request itself (Cloudflare challenge, CAPTCHA,
        // 403). Checked after the YouTube-specific cases above so their more
        // precise messages win. Not transient for this purpose — retrying
        // immediately hits the same wall.
        if (diagnostic?.data && isBlockedBySite(diagnostic.data)) {
          throw new Error(
            'BLOCKED_BY_SITE: The website blocked the request (bot protection or access denied).',
          );
        }
        // The diagnostic just told us this is the transient stripped-page
        // failure (first time we've seen it for this host — noteTransient
        // above recorded it, so the early return further up handles the
        // remaining attempts without paying for another diagnostic).
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
      throw error; // Propagate the error to the renderer process
    }
  }

  // Get current YT-DLP version
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

      // Handle filePath - if it's provided, ensure it's a proper file path
      if (options.filePath && options.filePath.trim()) {
        const filePath = options.filePath.trim();

        // Check if the path is a directory (doesn't end with an executable extension)
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
      // If no filePath provided, let YTDLP use its default location

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
    cancelledControllerIds.add(controller.id);
    const owner = controllerOwner.get(controller.id);
    if (owner !== undefined) cancelledDownloadIds.add(owner);
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
      // A Format Converter row carries its ffmpeg jobId as controllerId, so
      // the list's Stop/Remove actions land here for conversions too.
      if (typeof id === 'string' && cancelConversionJob(id)) return true;

      const controller = YTDLP.getTerminalFromID(id);

      if (controller) {
        return await gracefulKill(controller);
      }
      // No live terminal for this id. If it belonged to a download that is
      // currently between retry attempts, the stop is still valid: record it
      // so the retry loop gives up, and report success — otherwise the user
      // is told the stop failed while the download quietly carries on.
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

  // getDirectUrl/downloadPreview spawn yt-dlp themselves rather than going
  // through yt-dlp-helper, but must resolve the same binary. This used to
  // duplicate the lookup and searched for an unsuffixed 'yt-dlp' on darwin,
  // which only worked because forge.config.ts happens to drop the binary
  // under both names.
  function resolveYtdlpBinaryPath(): string {
    return ytdlpPath;
  }

  ipcMain.handle('ytdlp:getDirectUrl', async (_e, rawUrl: string) => {
    const url = toExtractorUrl(rawUrl);
    await waitForYtdlpUpdate();
    return coalesce(directUrlInFlight, url, () =>
      retryTransient('ytdlp:getDirectUrl', url, () => spawnDirectUrl(url)),
    );
  });

  function spawnDirectUrl(url: string): Promise<string> {
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
          noteTransient(url, error);
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
  }

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
    // Recorded before the early return: between retry attempts there is no
    // process to kill, and without this the cancel would be a silent no-op
    // and the retry loop would start a fresh download after the user
    // cancelled.
    cancelledPreviewRequests.add(requestId);
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
    async (_e, requestId: string, rawUrl: string) => {
      const url = toExtractorUrl(rawUrl);
      await waitForYtdlpUpdate();
      await previewTempDirSwept;
      // Supersede any previous request reusing this id, then clear the flag
      // that cancel just set — it belonged to the old request, not this one.
      await cancelPreviewDownload(requestId);
      cancelledPreviewRequests.delete(requestId);
      await mkdir(previewTempDir, { recursive: true });
      const binaryPath = resolveYtdlpBinaryPath();

      return retryTransient('ytdlp:downloadPreview', url, () => {
        // Checked per attempt: a cancel landing during the backoff must stop
        // the loop. PREVIEW_CANCELLED is not a transient error, so
        // retryTransient rethrows it immediately instead of retrying.
        if (cancelledPreviewRequests.has(requestId)) {
          return Promise.reject(
            new Error('PREVIEW_CANCELLED: preview request was cancelled'),
          );
        }
        // Fresh temp path per attempt: a failed attempt unlinks its own
        // file below, so reusing the name across retries would race that
        // cleanup.
        const tempPath = path.join(
          previewTempDir,
          `${sanitizePreviewRequestId(requestId)}-${Date.now()}.mp4`,
        );
        return new Promise<string>((resolve, reject) => {
          // The renderer plays the result back through getVideoBlob, whose
          // buffer path tops out just under 2GB (readFileSync limit) — prefer
          // a format known to fit, and hard-abort anything that would exceed
          // the limit rather than downloading a file playback can't consume.
          // YouTube no longer serves any single file with both video and
          // audio (every format is video-only or audio-only), so after the
          // single-file choices fall back to a video + audio pair merged into
          // mp4 — H.264 first, since every Chromium build plays it. 720p while
          // the video stream stays under 400MB (the preview is downloaded and
          // held in memory before it plays); 360p for anything longer.
          const proc = spawn(binaryPath, [
            '--no-warnings',
            '-f',
            'best[ext=mp4][filesize<1.9G]/best[ext=mp4][filesize_approx<1.9G]/best[ext=mp4]' +
              '/bv*[height<=720][vcodec^=avc1][filesize<400M]+ba[ext=m4a]' +
              '/bv*[height<=360][vcodec^=avc1]+ba[ext=m4a]/bv*[height<=360]+ba',
            '--merge-output-format',
            'mp4',
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

  // Same graceful stop as kill-controller, but marks the exit as a finished
  // live recording rather than a cancelled download.
  ipcMain.handle('ytdlp:finishRecording', async (_, id: string) => {
    finishingControllerIds.add(id);
    const stopped = await killControllerById(id);
    if (!stopped) finishingControllerIds.delete(id);
    return stopped;
  });

  // download video from link
  // The download spawns its own extraction, so it hits the same intermittent
  // stripped-page failure as ytdlp:info — but asynchronously, through the
  // controller's process exit, which retryTransient() cannot wrap. Detect it
  // from the exit code plus the accumulated log, suppress the completion event
  // the renderer would otherwise treat as a hard failure, and spawn a fresh
  // controller.
  // Mirrors the yt-dlp-helper arg shape the handler forwards to, so the
  // extracted function keeps the exact typing the inline handler had.
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
    // Whether the failure was the TikTok stripped-page kind, so the caller
    // knows whether to count it against that host's circuit breaker.
    transient?: boolean;
    /** Retry without cookies — see cookieFallback.ts. */
    dropCookies?: boolean;
    // True only when the process exited 0. Distinguishes a real success from
    // "stop looping, this failed for good" — both of which set retry: false.
    succeeded?: boolean;
    value?: { downloadId: unknown; controllerId: string };
  };

  // Every download, on every site, gets one extra attempt: a first attempt
  // that dies on a dropped connection or a transient server error usually
  // succeeds on the second. Retryable hosts get more than that because their
  // failure mode is a coin flip (TikTok's stripped page, bilibili's 412)
  // rather than a one-off blip.
  const GENERIC_DOWNLOAD_ATTEMPTS = 2;

  ipcMain.handle('ytdlp:download', async (e, id, rawArgs) => {
    const args = { ...rawArgs, url: toExtractorUrl(rawArgs.url) };
    await waitForYtdlpUpdate();
    const isRetryable = isRetryableHost(args.url);
    const maxAttempts = isRetryable
      ? DOWNLOAD_RETRY_ATTEMPTS
      : GENERIC_DOWNLOAD_ATTEMPTS;
    const downloadKey = String(id);
    cancelledDownloadIds.delete(downloadKey);
    let lastValue: DownloadAttemptResult['value'];
    let cookies = cookiesForVideo(
      args.url,
      await resolveCookiesForCall(args.url),
    );
    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        // The download re-extracts before it fetches bytes, so it hits the
        // same throttled endpoint the info fetch did and belongs behind the
        // same gate. Only the start is spaced — the transfer itself is not.
        await paceHost(args.url);
        const result = await runDownloadAttempt(e, id, args, cookies, {
          canRetryTransient:
            isRetryable && attempt < maxAttempts && !isCircuitOpen(args.url),
          // The blanket one-shot retry, for any site and any failure that is not
          // a cancellation. Only ever offered on the first attempt.
          canRetryGeneric: attempt === 1 && attempt < maxAttempts,
        });
        lastValue = result.value ?? lastValue;
        if (result.dropCookies) {
          // A different request, not a repeat of the failed one, so it does
          // not use up an attempt. Happens at most once: cookies are now off.
          console.log(
            `[ytdlp] ytdlp:download: YouTube rejected the signed-in session; retrying without cookies`,
          );
          cookies = NO_COOKIES;
          attempt -= 1;
          continue;
        }
        if (!result.retry) {
          // Only an exit code of 0 clears the breaker. `retry: false` also means
          // "stop looping" for a download that failed for good, and treating
          // that as a success would reset the failure streak every time.
          if (isRetryable && result.succeeded) noteExtractionSuccess(args.url);
          return result.value;
        }
        // Only a retryable host's transient failures feed the breaker; a
        // one-off blip on any other site is not evidence that the host is
        // refusing us.
        if (isRetryable && result.transient) noteTransientFailure(args.url);
        const wait = retryDelayMs(attempt);
        console.log(
          `[ytdlp] ytdlp:download: attempt ${attempt} failed${
            result.transient ? ' (transient extraction)' : ''
          }, retrying in ${wait}ms (attempt ${attempt + 1}/${maxAttempts})`,
        );
        await sleep(wait);
        // The stop may have arrived while we were sleeping, when no process
        // existed to receive it.
        if (cancelledDownloadIds.has(downloadKey)) {
          console.log(
            `[ytdlp] ytdlp:download: cancelled during retry backoff — not restarting`,
          );
          return lastValue;
        }
      }
      // Unreachable: the last attempt is called with canRetry === false, so it
      // either returns a value or throws.
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
    cookies: CookieOptions,
    {
      canRetryTransient,
      canRetryGeneric,
    }: {
      canRetryTransient: boolean;
      canRetryGeneric: boolean;
    },
  ): Promise<DownloadAttemptResult> {
    const canRetryWithoutCookies = hasCookies(cookies);
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
          ...cookies,
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

      spawned = controller;
      activeControllerIds.add(controller.id);
      // Lets a stop that arrives between retry attempts map this controller
      // back to the download it belonged to.
      controllerOwner.set(controller.id, String(id));
      // Send the controller ID back to the renderer process
      e.sender.send(`ytdlp:controller:${id}`, {
        downloadId: id,
        controllerId: controller.id,
      });

      let processCompletionHandled = false;
      let deferredCompletion: (() => void) | null = null;
      let finalExitCode: number | null = null;
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

          finalExitCode = code;
          const completionMessage = `Process '${controller.id}' ${eventType} with code: ${code}, signal: ${signal}`;
          completeLog += `\n${completionMessage}`;

          const sendCompletion = (exitCode: number = code) => {
            e.sender.send(`ytdlp:download:status:${id}`, {
              type: 'completion',
              data: {
                log: completionMessage,
                // completeLog is only sent here — not on every progress chunk (fix #6)
                completeLog: completeLog,
                exitCode,
                signal: signal,
                controllerId: controller.id,
              },
            });
            if (exitCode === 0) {
              sendTrayNotificationOnce();
            }
          };
          // Not getBundledBinaryPath('ffmpeg'): on darwin the static build
          // lives at binaries/ffmpeg-<arch>.
          const ffmpegPath = getBundledFfmpegPaths().ffmpeg;
          // "Finish recording": the exit was our own Ctrl+C, so its code says
          // nothing about the result — yt-dlp usually exits 0 but can exit 1.
          // Judge by whether a recording exists, and never hand this exit to
          // either retry path (ours below, or the renderer's live retry):
          // restarting spawns a process the finish never reaches, and the row
          // sits on "Finishing…" forever.
          if (finishingControllerIds.delete(controller.id)) {
            void finalizeFinishedRecording(args.outputFilepath, ffmpegPath)
              .catch(() => false)
              .then((recorded) => {
                if (recorded && code !== 0) {
                  completeLog += `\nRecording finished by user (yt-dlp exited ${code}); keeping the recorded file.`;
                }
                finalExitCode = recorded ? 0 : code;
                setTimeout(() => sendCompletion(finalExitCode ?? code), 100);
              });
            return;
          }
          // A nonzero exit may be the intermittent extraction failure, but the
          // log that proves it is still draining through the listen() loop
          // below. Hold the completion event until the loop ends so the retry
          // decision sees the whole log — telling the renderer the download
          // failed and then retrying behind its back would leave the row
          // stuck in a failed state.
          if (
            code !== 0 &&
            (canRetryTransient || canRetryGeneric || canRetryWithoutCookies)
          ) {
            deferredCompletion = sendCompletion;
            return;
          }
          if (code === 0) {
            // A stopped live recording is left as MPEG-TS inside a .mp4,
            // which the in-app player can't open — fix the container before
            // the renderer marks the download playable. A no-op (one small
            // header read) for every other download.
            void remuxMpegTsRecording(args.outputFilepath, ffmpegPath).finally(
              () => setTimeout(sendCompletion, 100),
            );
            return;
          }
          setTimeout(sendCompletion, 100);
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

      // The process exited nonzero and we held its completion event back.
      // Now that listen() has drained, completeLog is final: if this is the
      // intermittent stripped-page failure, drop the event and let the caller
      // spawn a fresh controller; otherwise report it as usual.
      if (deferredCompletion) {
        const wasCancelled =
          cancelledControllerIds.has(controller.id) ||
          cancelledDownloadIds.has(String(id));
        if (
          shouldRetryDownloadWithoutCookies({
            cookies,
            log: completeLog,
            cancelled: wasCancelled,
          })
        ) {
          return { retry: true, dropCookies: true };
        }
        const transient = isTransientErrorText(completeLog);
        // A cancelled download is never retried — the user asked for it to
        // stop, and restarting it would be the opposite of that.
        const shouldRetry =
          !wasCancelled &&
          ((transient && canRetryTransient) || canRetryGeneric);
        if (shouldRetry) {
          return { retry: true, transient };
        }
        deferredCompletion();
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
      throw error; // Ensure the error is propagated
    } finally {
      // Per-controller cancellation state is only meaningful while that
      // controller exists; the per-download entry is what survives retries and
      // it is cleared by the handler's own finally.
      if (spawned) cancelledControllerIds.delete(spawned.id);
    }
  }

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
