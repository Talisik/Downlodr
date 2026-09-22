/**
 * Electron-facing wrappers over the pure resolvers in `bundledBinaries.ts`.
 * Kept separate so those resolvers stay testable without an Electron runtime.
 */

import { app } from 'electron';
import { existsSync } from 'fs';
import path from 'path';
import {
  materializeFfmpegAliases,
  planFfmpegPathEntry,
  prependToPath,
  resolveBundledFfmpeg,
  resolveYtdlpPath,
  ytdlpBinaryName,
  type BinaryEnv,
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
  };
}

/** The yt-dlp binary every spawn in the app must be pointed at. */
export function getYtdlpBinaryPath(): string {
  return resolveYtdlpPath(electronBinaryEnv());
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

/** Absolute paths to the bundled FFmpeg binaries, or null when absent. */
export function getBundledFfmpegPaths(): {
  ffmpeg: string | null;
  ffprobe: string | null;
} {
  return resolveBundledFfmpeg(electronBinaryEnv());
}
