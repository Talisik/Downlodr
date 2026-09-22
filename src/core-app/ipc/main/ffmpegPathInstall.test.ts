import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { materializeFfmpegAliases, prependToPath } from './bundledBinaries';

describe('prependToPath', () => {
  it('puts the directory ahead of everything already on PATH', () => {
    expect(prependToPath('/bundled', '/usr/bin:/bin', ':')).toBe(
      '/bundled:/usr/bin:/bin',
    );
  });

  it('handles an unset PATH without emitting a stray delimiter', () => {
    expect(prependToPath('/bundled', undefined, ':')).toBe('/bundled');
  });

  it('does not re-add a directory that is already first', () => {
    // ensureBundledFfmpegOnPath() is cheap to call more than once; repeated
    // calls must not grow PATH without bound.
    expect(prependToPath('/bundled', '/bundled:/usr/bin', ':')).toBe(
      '/bundled:/usr/bin',
    );
  });
});

describe('materializeFfmpegAliases', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'downlodr-ffmpeg-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('makes the arch-suffixed binary reachable under its canonical name', () => {
    const target = path.join(tmp, 'ffmpeg-arm64');
    fs.writeFileSync(target, 'STATIC-BUILD');
    const dir = path.join(tmp, 'ffmpeg-bin');
    const linkPath = path.join(dir, 'ffmpeg');

    materializeFfmpegAliases({ dir, aliases: [{ target, linkPath }] });

    expect(fs.readFileSync(linkPath, 'utf-8')).toBe('STATIC-BUILD');
  });

  it('repoints an alias left over from a previous version', () => {
    // The app updates in place, so userData can hold an alias aimed at a
    // Resources path that no longer exists.
    const dir = path.join(tmp, 'ffmpeg-bin');
    const linkPath = path.join(dir, 'ffmpeg');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(linkPath, 'STALE');

    const target = path.join(tmp, 'ffmpeg-arm64');
    fs.writeFileSync(target, 'CURRENT');
    materializeFfmpegAliases({ dir, aliases: [{ target, linkPath }] });

    expect(fs.readFileSync(linkPath, 'utf-8')).toBe('CURRENT');
  });

  it('reports failure rather than throwing when the target is gone', () => {
    // A missing bundled binary must degrade to "no ffmpeg on PATH", not crash
    // app startup.
    const dir = path.join(tmp, 'ffmpeg-bin');
    expect(
      materializeFfmpegAliases({
        dir,
        aliases: [
          {
            target: path.join(tmp, 'absent'),
            linkPath: path.join(dir, 'ffmpeg'),
          },
        ],
      }),
    ).toBe(false);
  });

  it('reports success once every alias is in place', () => {
    const target = path.join(tmp, 'ffmpeg-arm64');
    fs.writeFileSync(target, 'STATIC-BUILD');
    const dir = path.join(tmp, 'ffmpeg-bin');
    expect(
      materializeFfmpegAliases({
        dir,
        aliases: [{ target, linkPath: path.join(dir, 'ffmpeg') }],
      }),
    ).toBe(true);
  });
});
