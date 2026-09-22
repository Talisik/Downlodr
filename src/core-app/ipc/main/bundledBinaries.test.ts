import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  planFfmpegPathEntry,
  resolveBundledFfmpeg,
  resolveYtdlpPath,
  ytdlpBinaryName,
  type BinaryEnv,
} from './bundledBinaries';

/**
 * Builds an env whose `exists` answers true only for the listed paths, so each
 * test states exactly which files the hypothetical install has on disk.
 */
function env(
  overrides: Partial<BinaryEnv> & { present?: string[] },
): BinaryEnv {
  const { present = [], ...rest } = overrides;
  const set = new Set(present);
  return {
    platform: 'darwin',
    arch: 'arm64',
    isPackaged: true,
    resourcesPath: '/App.app/Contents/Resources',
    exeDir: '/App.app/Contents/MacOS',
    appPath: '/repo',
    userDataPath: '/userData',
    exists: (p) => set.has(p),
    ...rest,
  };
}

describe('ytdlpBinaryName', () => {
  it('uses the macOS-suffixed name on darwin', () => {
    expect(ytdlpBinaryName('darwin')).toBe('yt-dlp_macos');
  });

  it('uses the .exe name on win32', () => {
    expect(ytdlpBinaryName('win32')).toBe('yt-dlp.exe');
  });
});

describe('resolveYtdlpPath', () => {
  it('prefers Resources over the executable directory on packaged darwin', () => {
    const inResources = path.join(
      '/App.app/Contents/Resources',
      'yt-dlp_macos',
    );
    expect(
      resolveYtdlpPath(
        env({
          present: [
            inResources,
            path.join('/App.app/Contents/MacOS', 'yt-dlp_macos'),
          ],
        }),
      ),
    ).toBe(inResources);
  });

  it('falls back to the executable directory when Resources has no copy', () => {
    const exeAdjacent = path.join('/App.app/Contents/MacOS', 'yt-dlp_macos');
    expect(resolveYtdlpPath(env({ present: [exeAdjacent] }))).toBe(exeAdjacent);
  });

  it('points at a writable userData path when a packaged build bundles nothing', () => {
    expect(resolveYtdlpPath(env({ present: [] }))).toBe(
      path.join('/userData', 'yt-dlp_macos'),
    );
  });

  it('resolves the platform-suffixed binary in the repo root during darwin development', () => {
    // Regression: skedulosaHandler looked for a bare 'yt-dlp' here, which the
    // repo does not contain, so every subscription spawn hit ENOENT.
    const devPath = path.join('/repo', 'yt-dlp_macos');
    expect(
      resolveYtdlpPath(env({ isPackaged: false, present: [devPath] })),
    ).toBe(devPath);
  });

  it('resolves next to the executable on packaged win32', () => {
    const exeAdjacent = path.join('C:/Program Files/Downlodr', 'yt-dlp.exe');
    expect(
      resolveYtdlpPath(
        env({
          platform: 'win32',
          exeDir: 'C:/Program Files/Downlodr',
          resourcesPath: 'C:/Program Files/Downlodr/resources',
          present: [exeAdjacent],
        }),
      ),
    ).toBe(exeAdjacent);
  });
});

describe('resolveBundledFfmpeg', () => {
  it('picks the arm64 static on Apple Silicon', () => {
    const ffmpeg = path.join('/App.app/Contents/Resources', 'ffmpeg-arm64');
    expect(resolveBundledFfmpeg(env({ present: [ffmpeg] })).ffmpeg).toBe(
      ffmpeg,
    );
  });

  it('picks the x64 static on Intel', () => {
    const ffmpeg = path.join('/App.app/Contents/Resources', 'ffmpeg-x64');
    expect(
      resolveBundledFfmpeg(env({ arch: 'x64', present: [ffmpeg] })).ffmpeg,
    ).toBe(ffmpeg);
  });

  it('falls back to the x64 ffprobe on Apple Silicon, which has no arm64 build', () => {
    // binaries/ffprobe-arm64 is not published; forge.config.ts documents the
    // Rosetta 2 fallback, and nothing else ships an arm64 ffprobe.
    const ffprobe = path.join('/App.app/Contents/Resources', 'ffprobe-x64');
    expect(resolveBundledFfmpeg(env({ present: [ffprobe] })).ffprobe).toBe(
      ffprobe,
    );
  });

  it('resolves the .exe names on win32', () => {
    const resources = 'C:/Program Files/Downlodr/resources';
    const ffmpeg = path.join(resources, 'ffmpeg.exe');
    const ffprobe = path.join(resources, 'ffprobe.exe');
    expect(
      resolveBundledFfmpeg(
        env({
          platform: 'win32',
          resourcesPath: resources,
          present: [ffmpeg, ffprobe],
        }),
      ),
    ).toEqual({ ffmpeg, ffprobe });
  });

  it('resolves from binaries/ in development, where the mac statics are committed', () => {
    // extraResource flattens binaries/* into Resources at package time, so the
    // dev layout is the one place the subdirectory still has to be searched.
    const ffmpeg = path.join('/repo', 'binaries', 'ffmpeg-arm64');
    expect(
      resolveBundledFfmpeg(env({ isPackaged: false, present: [ffmpeg] }))
        .ffmpeg,
    ).toBe(ffmpeg);
  });

  it('resolves from the repo root in win32 development', () => {
    // scripts/binaries.mjs fetches ffmpeg.exe straight into the repo root.
    const ffmpeg = path.join('/repo', 'ffmpeg.exe');
    expect(
      resolveBundledFfmpeg(
        env({ platform: 'win32', isPackaged: false, present: [ffmpeg] }),
      ).ffmpeg,
    ).toBe(ffmpeg);
  });

  it('reports null rather than a guess when nothing is bundled', () => {
    expect(resolveBundledFfmpeg(env({ present: [] }))).toEqual({
      ffmpeg: null,
      ffprobe: null,
    });
  });
});

describe('planFfmpegPathEntry', () => {
  it('exposes Resources directly on win32, where the names are already canonical', () => {
    // ffbinaries and yt-dlp both look for a file named exactly 'ffmpeg.exe',
    // which is what forge ships on Windows — no aliasing needed.
    const resources = 'C:/Program Files/Downlodr/resources';
    const plan = planFfmpegPathEntry(
      env({
        platform: 'win32',
        resourcesPath: resources,
        present: [
          path.join(resources, 'ffmpeg.exe'),
          path.join(resources, 'ffprobe.exe'),
        ],
      }),
    );
    expect(plan).toEqual({
      dir: path.dirname(path.join(resources, 'ffmpeg.exe')),
      aliases: [],
    });
  });

  it('aliases the arch-suffixed mac statics to canonical names in userData', () => {
    // 'ffmpeg-arm64' is invisible to a PATH scan for 'ffmpeg', so the bundled
    // binary needs a canonically-named entry pointing back at it.
    const resources = '/App.app/Contents/Resources';
    const plan = planFfmpegPathEntry(
      env({
        present: [
          path.join(resources, 'ffmpeg-arm64'),
          path.join(resources, 'ffprobe-x64'),
        ],
      }),
    );
    expect(plan).toEqual({
      dir: path.join('/userData', 'ffmpeg-bin'),
      aliases: [
        {
          target: path.join(resources, 'ffmpeg-arm64'),
          linkPath: path.join('/userData', 'ffmpeg-bin', 'ffmpeg'),
        },
        {
          target: path.join(resources, 'ffprobe-x64'),
          linkPath: path.join('/userData', 'ffmpeg-bin', 'ffprobe'),
        },
      ],
    });
  });

  it('plans nothing when no ffmpeg is bundled, leaving PATH untouched', () => {
    expect(planFfmpegPathEntry(env({ present: [] }))).toBeNull();
  });
});
