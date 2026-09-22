/**
 * One place that knows where the binaries forge ships actually land, for every
 * platform and arch.
 *
 * Every function here is pure and takes its view of the world through
 * `BinaryEnv`, so the darwin layout is testable from a Windows dev box. The
 * Electron-flavoured wrappers live in `bundledBinariesEnv.ts`.
 *
 * This exists because the same bug kept reappearing in different handlers:
 * each one hardcoded a Windows filename, or fell back to a cwd-relative name,
 * and broke on a packaged .app whose cwd is `/`.
 */

import fs from 'fs';
import path from 'path';

export interface BinaryEnv {
  platform: NodeJS.Platform;
  arch: string;
  isPackaged: boolean;
  /** process.resourcesPath, or null outside a packaged build. */
  resourcesPath: string | null;
  /** Directory holding the app executable (Contents/MacOS on darwin). */
  exeDir: string;
  /** app.getAppPath() — the repo root in development. */
  appPath: string;
  userDataPath: string;
  exists: (candidate: string) => boolean;
}

export function ytdlpBinaryName(platform: NodeJS.Platform): string {
  if (platform === 'win32') return 'yt-dlp.exe';
  if (platform === 'darwin') return 'yt-dlp_macos';
  return 'yt-dlp_linux';
}

/**
 * The yt-dlp binary every spawn must be pointed at explicitly.
 *
 * yt-dlp-helper defaults to `./yt-dlp_macos` (or `./yt-dlp.exe`) **relative to
 * process.cwd()** when handed no path. A packaged .app launched from Finder or
 * the Dock has cwd `/`, so every call spawned a path that cannot exist:
 * getYTDLPVersion() returned null — which renders as a blank version in the
 * About modal — and metadata, playlist and download calls all failed with a
 * generic error. Windows only ever worked by accident, because launching from
 * the installed shortcut happens to set cwd to the install directory, which is
 * exactly where the postPackage hook drops yt-dlp.exe.
 *
 * On darwin the bundled copy is additionally spawned *in place*: yt-dlp_macos
 * is a PyInstaller bundle that only starts under the hardened runtime with the
 * entitlements forge.config.ts signs it with, and it is sealed into the .app's
 * signature and covered by its notarization ticket. A copy run from outside
 * the bundle is evaluated standalone by Gatekeeper instead — which is what
 * canSelfUpdateYtdlp() (ytdlpHandler.ts) exists to prevent.
 */
export function resolveYtdlpPath(env: BinaryEnv): string {
  const name = ytdlpBinaryName(env.platform);

  if (env.isPackaged) {
    // Resources first: on darwin the executable lives in Contents/MacOS, and
    // only the Resources copy is covered by the bundle's notarization ticket.
    const candidates = env.resourcesPath
      ? [path.join(env.resourcesPath, name), path.join(env.exeDir, name)]
      : [path.join(env.exeDir, name)];
    const bundled = candidates.find(env.exists);
    if (bundled) return bundled;

    // Nothing bundled — a broken build. Name a writable location the updater
    // can populate rather than a cwd-relative name whose meaning depends on
    // how the app happened to be launched.
    return path.join(env.userDataPath, name);
  }

  const devPath = path.join(env.appPath, name);
  return env.exists(devPath) ? devPath : name;
}

/** Bundled basenames, most-preferred first. */
function ffmpegBundleNames(
  env: BinaryEnv,
  component: 'ffmpeg' | 'ffprobe',
): string[] {
  if (env.platform === 'win32') return [`${component}.exe`];
  if (env.platform !== 'darwin') return [component];

  // Apple Silicon prefers its native static but runs the x64 one under
  // Rosetta 2, which is the only option for ffprobe — no arm64 ffprobe static
  // is published, so binaries/ffprobe-arm64 does not exist.
  return env.arch === 'arm64'
    ? [`${component}-arm64`, `${component}-x64`]
    : [`${component}-x64`];
}

function ffmpegSearchDirs(env: BinaryEnv): string[] {
  if (env.isPackaged) return env.resourcesPath ? [env.resourcesPath] : [];
  // extraResource flattens binaries/* into Resources when packaging, so the
  // subdirectory only has to be searched in development.
  return [env.appPath, path.join(env.appPath, 'binaries')];
}

/**
 * Absolute paths to the bundled ffmpeg/ffprobe, or null when this build does
 * not ship one. Never guesses a bare name: a PATH fallback silently resolves
 * to whatever the user happens to have installed, which is how an ffmpeg
 * without `--enable-whisper` used to get picked up.
 */
export function resolveBundledFfmpeg(env: BinaryEnv): {
  ffmpeg: string | null;
  ffprobe: string | null;
} {
  const dirs = ffmpegSearchDirs(env);
  const locate = (component: 'ffmpeg' | 'ffprobe'): string | null => {
    for (const name of ffmpegBundleNames(env, component)) {
      for (const dir of dirs) {
        const candidate = path.join(dir, name);
        if (env.exists(candidate)) return candidate;
      }
    }
    return null;
  };

  return { ffmpeg: locate('ffmpeg'), ffprobe: locate('ffprobe') };
}

export interface FfmpegPathPlan {
  /** Directory to prepend to PATH. */
  dir: string;
  /** Canonically-named links to create in `dir` before it is used. */
  aliases: { target: string; linkPath: string }[];
}

/**
 * How to make the bundled ffmpeg visible to a PATH scan.
 *
 * yt-dlp-helper hands yt-dlp `--ffmpeg-location` only when ffbinaries finds a
 * file named exactly `ffmpeg` on PATH (ffbinaries-lib.js locateBinariesSync),
 * and otherwise tries to *download* ffmpeg into process.cwd() on every
 * metadata call. yt-dlp itself also searches PATH. One directory on PATH
 * therefore fixes both, for every call site at once.
 *
 * On win32 the bundled names are already canonical, so Resources goes on PATH
 * as-is. On darwin the statics are arch-suffixed and invisible to that scan,
 * so canonically-named links are planned in userData instead.
 */
export function planFfmpegPathEntry(env: BinaryEnv): FfmpegPathPlan | null {
  const { ffmpeg, ffprobe } = resolveBundledFfmpeg(env);
  if (!ffmpeg) return null;

  const suffix = env.platform === 'win32' ? '.exe' : '';
  const canonical = (component: string) => `${component}${suffix}`;

  const resolved: [string, string][] = [['ffmpeg', ffmpeg]];
  if (ffprobe) resolved.push(['ffprobe', ffprobe]);

  const alreadyCanonical = resolved.every(
    ([component, full]) => path.basename(full) === canonical(component),
  );
  if (alreadyCanonical) {
    return { dir: path.dirname(ffmpeg), aliases: [] };
  }

  const dir = path.join(env.userDataPath, 'ffmpeg-bin');
  return {
    dir,
    aliases: resolved.map(([component, target]) => ({
      target,
      linkPath: path.join(dir, canonical(component)),
    })),
  };
}

/** PATH with `dir` in front, without growing on repeated calls. */
export function prependToPath(
  dir: string,
  currentPath: string | undefined,
  delimiter: string = path.delimiter,
): string {
  if (!currentPath) return dir;
  const entries = currentPath.split(delimiter);
  if (entries[0] === dir) return currentPath;
  return [dir, ...entries].join(delimiter);
}

/**
 * Creates the plan's canonically-named entries, returning whether all of them
 * are now usable.
 *
 * Symlinks first: on darwin the bundled static is covered by the .app's
 * signature, and Gatekeeper follows a symlink to evaluate the real file in
 * place. A copy is evaluated standalone instead, so it is only the fallback —
 * for filesystems and Windows accounts where symlinking is not permitted.
 */
export function materializeFfmpegAliases(plan: FfmpegPathPlan): boolean {
  try {
    fs.mkdirSync(plan.dir, { recursive: true });
  } catch {
    return false;
  }

  let ok = true;
  for (const { target, linkPath } of plan.aliases) {
    if (!fs.existsSync(target)) {
      ok = false;
      continue;
    }
    try {
      // Always replace: an in-place app update leaves aliases pointing at a
      // Resources path from the previous version.
      fs.rmSync(linkPath, { force: true });
    } catch {
      /* a stale entry we cannot remove is handled by the write below */
    }
    try {
      fs.symlinkSync(target, linkPath);
    } catch {
      try {
        fs.copyFileSync(target, linkPath);
        fs.chmodSync(linkPath, 0o755);
      } catch {
        ok = false;
      }
    }
  }
  return ok;
}
