/**
 * Electron-facing wrappers over the pure resolvers in `bundledBinaries.ts`.
 * Kept separate so those resolvers stay testable without an Electron runtime.
 */

import { app } from 'electron';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import path from 'path';
import {
  materializeFfmpegAliases,
  planFfmpegPathEntry,
  prependToPath,
  resolveBundledFfmpeg,
  resolveWhisperFfmpeg,
  isYtdlpUserCopyActive,
  resolveBundledYtdlpPath,
  resolveYtdlpPath,
  usesYtdlpUserCopy,
  ytdlpBinaryName,
  ytdlpUserCopyPaths,
  type BinaryEnv,
  type YtdlpUserCopyMarker,
} from './bundledBinaries';

export function electronBinaryEnv(): BinaryEnv {
  return {
    platform: process.platform,
    arch: process.arch,
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath || null,
    exeDir: path.dirname(app.getPath('exe')),
    appPath: app.getAppPath(),
    userDataPath: app.getPath('userData'),
    exists: existsSync,
    readText: (file) => {
      try {
        return readFileSync(file, 'utf8');
      } catch {
        return null;
      }
    },
    fileStamp: (file) => {
      try {
        const st = statSync(file);
        return `${st.size}:${Math.trunc(st.mtimeMs)}`;
      } catch {
        return null;
      }
    },
  };
}

/** The yt-dlp binary every spawn in the app must be pointed at. */
export function getYtdlpBinaryPath(): string {
  return resolveYtdlpPath(electronBinaryEnv());
}

/**
 * The file a yt-dlp update must be written to: the userData copy on packaged
 * macOS (never the signed bundle), the resolved binary everywhere else.
 */
export function getYtdlpUpdateTarget(): string {
  const env = electronBinaryEnv();
  if (!usesYtdlpUserCopy(env)) return resolveYtdlpPath(env);
  const { binary } = ytdlpUserCopyPaths(env);
  mkdirSync(path.dirname(binary), { recursive: true });
  return binary;
}

/** Whether updates go to the userData copy rather than the binary in use. */
export function updatesYtdlpUserCopy(): boolean {
  return usesYtdlpUserCopy(electronBinaryEnv());
}

/**
 * Activates a freshly installed and verified userData copy. From here on
 * getYtdlpBinaryPath() returns it.
 */
export function markYtdlpUserCopyInstalled(version: string): void {
  const env = electronBinaryEnv();
  const bundledStamp = env.fileStamp?.(resolveBundledYtdlpPath(env));
  if (!bundledStamp) {
    throw new Error('cannot stamp the bundled yt-dlp; keeping it in use');
  }
  const marker: YtdlpUserCopyMarker = { version, bundledStamp };
  writeFileSync(ytdlpUserCopyPaths(env).marker, JSON.stringify(marker));
}

/**
 * Removes a userData copy that is not in use — one left behind by an app
 * update (see isYtdlpUserCopyActive) or by an interrupted install. Never
 * touches an active copy, which running handlers may be spawning.
 */
export function discardInactiveYtdlpUserCopy(): void {
  const env = electronBinaryEnv();
  if (!usesYtdlpUserCopy(env) || isYtdlpUserCopyActive(env)) return;
  const { binary, marker } = ytdlpUserCopyPaths(env);
  for (const file of [marker, binary]) {
    if (existsSync(file)) {
      rmSync(file, { force: true });
      console.log(`[ytdlp] removed unused self-updated copy: ${file}`);
    }
  }
}

/** Where forge ships yt-dlp, for diagnostics when none of them exist. */
export function ytdlpBundleCandidates(): string[] {
  const env = electronBinaryEnv();
  const name = ytdlpBinaryName(env.platform);
  return env.resourcesPath
    ? [path.join(env.resourcesPath, name), path.join(env.exeDir, name)]
    : [path.join(env.exeDir, name)];
}

let ffmpegPathDir: string | null | undefined;

/**
 * Puts the bundled FFmpeg on PATH, once per process.
 *
 * Without this, yt-dlp-helper finds no ffmpeg (it scans PATH via ffbinaries),
 * so it omits `--ffmpeg-location` *and* tries to download its own copy into
 * process.cwd() on every metadata call — which on a packaged .app launched
 * from Finder means writing to `/`. The bundled binary sat in Resources
 * unused, leaving format merging and audio conversion broken on a clean Mac.
 *
 * Returns the directory added to PATH, or null when this build ships no
 * FFmpeg (in which case PATH is left exactly as it was and yt-dlp falls back
 * to whatever the user has installed).
 */
export function ensureBundledFfmpegOnPath(): string | null {
  if (ffmpegPathDir !== undefined) return ffmpegPathDir;

  const env = electronBinaryEnv();
  const plan = planFfmpegPathEntry(env);
  if (!plan) {
    console.warn(
      '[ffmpeg] no bundled FFmpeg found — merging and audio conversion will ' +
        'depend on a system install',
    );
    ffmpegPathDir = null;
    return null;
  }

  if (plan.aliases.length > 0 && !materializeFfmpegAliases(plan)) {
    console.warn(
      `[ffmpeg] could not prepare ${plan.dir} — leaving PATH unchanged`,
    );
    ffmpegPathDir = null;
    return null;
  }

  process.env.PATH = prependToPath(plan.dir, process.env.PATH);
  console.log(`[ffmpeg] using bundled binaries via ${plan.dir}`);
  ffmpegPathDir = plan.dir;
  return plan.dir;
}

/** The bundled FFmpeg with the whisper filter, or null when absent. */
export function getWhisperFfmpegPath(): string | null {
  return resolveWhisperFfmpeg(electronBinaryEnv());
}

/** Absolute paths to the bundled FFmpeg binaries, or null when absent. */
export function getBundledFfmpegPaths(): {
  ffmpeg: string | null;
  ffprobe: string | null;
} {
  return resolveBundledFfmpeg(electronBinaryEnv());
}
