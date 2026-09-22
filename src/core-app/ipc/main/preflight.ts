/**
 * Startup reachability check for the binaries the app shells out to.
 *
 * The failure this exists to catch is silent by nature: yt-dlp-helper reports
 * a binary that cannot be spawned exactly the same way as one that ran and
 * printed nothing — `null`. That surfaced as a blank version in the About
 * modal and a generic "No info returned" on every metadata call, with nothing
 * anywhere naming the real cause (see bundledBinaries.ts for the two ways the
 * path can be wrong on macOS).
 *
 * So this probes each binary directly and reports *why* it failed: missing,
 * not executable, killed by the OS, timed out, or exited non-zero. It
 * deliberately resolves nothing itself — callers pass the paths the app
 * actually uses, so a passing preflight means the app's own resolution works,
 * not merely that a binary exists somewhere.
 *
 * Everything above `runPreflight` is pure and spawn-free so the reporting is
 * testable without the binaries present.
 */

import { spawn } from 'child_process';

export type BinaryName = 'yt-dlp' | 'ffmpeg' | 'ffprobe';

/** Raw result of one spawn, before it is interpreted. */
export interface SpawnOutcome {
  code: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  spawnError: { code?: string; message: string } | null;
  timedOut: boolean;
  durationMs: number;
}

export interface ProbeResult {
  name: BinaryName;
  /** The path that was probed, or null when nothing was resolved to probe. */
  path: string | null;
  ok: boolean;
  version: string | null;
  error: string | null;
  durationMs: number;
}

export interface MetadataResult {
  ok: boolean;
  title?: string;
  error?: string;
  durationMs: number;
}

export interface PreflightReport {
  binaries: ProbeResult[];
  metadata: MetadataResult | null;
  /** Binary probes only — the live fetch never gates this. */
  ok: boolean;
}

const VERSION_TIMEOUT_MS = 15_000;
const METADATA_TIMEOUT_MS = 60_000;

/** Longest stderr excerpt carried into a failure reason. */
const STDERR_EXCERPT = 300;

export function parseVersion(name: BinaryName, output: string): string | null {
  if (name === 'yt-dlp') {
    // yt-dlp --version prints the bare version and nothing else.
    const line = output
      .split('\n')
      .map((candidate) => candidate.trim())
      .find((candidate) => candidate.length > 0);
    return line && /\d/.test(line) ? line : null;
  }
  // ffmpeg/ffprobe print a banner whose first token after "version" is what we
  // want. Which stream it lands on varies by build, so callers concatenate
  // stdout and stderr and let this find it anywhere in the text.
  const match = output.match(new RegExp(`${name} version (\\S+)`));
  return match ? match[1] : null;
}

/**
 * Why a probe failed, or null if it succeeded. The distinctions matter: a
 * missing file, a non-executable one and one the kernel killed all look
 * identical downstream but have completely different fixes.
 */
export function probeFailureReason(outcome: SpawnOutcome): string | null {
  if (outcome.spawnError) {
    const { code, message } = outcome.spawnError;
    if (code === 'ENOENT') return 'not found at that path (ENOENT)';
    if (code === 'EACCES' || code === 'EPERM') {
      return `not executable (${code}) — missing the +x bit`;
    }
    return `could not be started: ${message}`;
  }
  if (outcome.timedOut) {
    return `timed out after ${outcome.durationMs}ms with no output`;
  }
  if (outcome.signal) {
    // On macOS this is the hardened-runtime/Gatekeeper case: the process
    // starts, the kernel refuses it, and nothing is ever written.
    return `killed by ${outcome.signal} on launch — usually an unsigned or untrusted binary`;
  }
  if (outcome.code !== 0) {
    const detail = outcome.stderr.trim().slice(0, STDERR_EXCERPT);
    return `exited with code ${outcome.code}${detail ? `: ${detail}` : ''}`;
  }
  return null;
}

export function buildReport(
  binaries: ProbeResult[],
  metadata: MetadataResult | null,
): PreflightReport {
  return {
    binaries,
    metadata,
    // No probes at all means nothing was verified — that is a failure, not a
    // vacuous pass.
    ok: binaries.length > 0 && binaries.every((probe) => probe.ok),
  };
}

export function formatReport(report: PreflightReport): string {
  const lines = report.binaries.map((probe) => {
    const status = probe.ok ? 'ok  ' : 'FAIL';
    const version = probe.version ?? '—';
    const where = probe.path ?? '<none>';
    const detail = probe.error ? `  ${probe.error}` : '';
    return `[preflight] ${probe.name.padEnd(8)} ${status} ${version.padEnd(
      14,
    )} ${where} (${probe.durationMs}ms)${detail}`;
  });

  const { metadata } = report;
  if (metadata) {
    lines.push(
      metadata.ok
        ? `[preflight] metadata ok   fetched "${metadata.title ?? '(untitled)'}" (${
            metadata.durationMs
          }ms)`
        : `[preflight] metadata WARN (non-fatal) ${metadata.error ?? 'failed'} (${
            metadata.durationMs
          }ms)`,
    );
  }

  lines.push(
    report.ok
      ? '[preflight] all binaries reachable'
      : '[preflight] FAILED — the app cannot reach one or more binaries',
  );
  return lines.join('\n');
}

export type Spawner = (
  command: string,
  args: string[],
  timeoutMs: number,
) => Promise<SpawnOutcome>;

/** Runs a command to completion, capturing both streams. Never rejects. */
export const spawnCapture: Spawner = (command, args, timeoutMs) =>
  new Promise<SpawnOutcome>((resolve) => {
    const startedAt = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const finish = (
      partial: Pick<SpawnOutcome, 'code' | 'signal' | 'spawnError'>,
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ...partial,
        stdout,
        stderr,
        timedOut,
        durationMs: Date.now() - startedAt,
      });
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, { windowsHide: true });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      finish({
        code: null,
        signal: null,
        spawnError: { code: err.code, message: err.message },
      });
      return;
    }

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => (stdout += chunk.toString()));
    child.stderr?.on('data', (chunk) => (stderr += chunk.toString()));
    child.on('error', (error) => {
      const err = error as NodeJS.ErrnoException;
      finish({
        code: null,
        signal: null,
        spawnError: { code: err.code, message: err.message },
      });
    });
    child.on('close', (code, signal) => {
      // A timeout kills the child, so suppress the SIGKILL we just sent —
      // otherwise the reason would blame the kernel for our own kill.
      finish({
        code,
        signal: timedOut ? null : signal,
        spawnError: null,
      });
    });
  });

async function probeBinary(
  name: BinaryName,
  binaryPath: string | null,
  spawner: Spawner,
): Promise<ProbeResult> {
  if (!binaryPath) {
    return {
      name,
      path: null,
      ok: false,
      version: null,
      error: 'not found — this build ships no copy and none is on PATH',
      durationMs: 0,
    };
  }

  // yt-dlp uses --version; ffmpeg/ffprobe print their banner for -version.
  const args = name === 'yt-dlp' ? ['--version'] : ['-version'];
  const outcome = await spawner(binaryPath, args, VERSION_TIMEOUT_MS);
  const failure = probeFailureReason(outcome);
  const version = failure
    ? null
    : parseVersion(name, `${outcome.stdout}\n${outcome.stderr}`);

  return {
    name,
    path: binaryPath,
    ok: failure === null && version !== null,
    version,
    error:
      failure ??
      (version === null ? 'ran but reported no parseable version' : null),
    durationMs: outcome.durationMs,
  };
}

async function fetchMetadata(
  ytdlpPath: string,
  url: string,
  spawner: Spawner,
): Promise<MetadataResult> {
  const outcome = await spawner(
    ytdlpPath,
    ['--no-warnings', '--no-playlist', '--dump-json', url],
    METADATA_TIMEOUT_MS,
  );
  const failure = probeFailureReason(outcome);
  if (failure) {
    return { ok: false, error: failure, durationMs: outcome.durationMs };
  }
  try {
    const line = outcome.stdout
      .split('\n')
      .find((candidate) => candidate.trim().startsWith('{'));
    if (!line) throw new Error('no JSON object in output');
    const title = (JSON.parse(line) as { title?: string }).title;
    return { ok: true, title, durationMs: outcome.durationMs };
  } catch (error) {
    return {
      ok: false,
      error: `could not read metadata: ${(error as Error).message}`,
      durationMs: outcome.durationMs,
    };
  }
}

export interface PreflightOptions {
  ytdlpPath: string | null;
  ffmpegPath: string | null;
  ffprobePath: string | null;
  /** Fetch metadata for this URL as a live end-to-end check; null to skip. */
  metadataUrl?: string | null;
  spawner?: Spawner;
}

export async function runPreflight({
  ytdlpPath,
  ffmpegPath,
  ffprobePath,
  metadataUrl = null,
  spawner = spawnCapture,
}: PreflightOptions): Promise<PreflightReport> {
  const binaries = await Promise.all([
    probeBinary('yt-dlp', ytdlpPath, spawner),
    probeBinary('ffmpeg', ffmpegPath, spawner),
    probeBinary('ffprobe', ffprobePath, spawner),
  ]);

  // Only worth attempting once yt-dlp itself answered — otherwise the fetch
  // would just restate the failure above with a longer timeout.
  const ytdlpOk = binaries.find((probe) => probe.name === 'yt-dlp')?.ok;
  const metadata =
    metadataUrl && ytdlpOk && ytdlpPath
      ? await fetchMetadata(ytdlpPath, metadataUrl, spawner)
      : null;

  return buildReport(binaries, metadata);
}
