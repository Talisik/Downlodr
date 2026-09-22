import { describe, expect, it } from 'vitest';
import {
  buildReport,
  formatReport,
  parseVersion,
  probeFailureReason,
  type ProbeResult,
  type SpawnOutcome,
} from './preflight';

function outcome(overrides: Partial<SpawnOutcome> = {}): SpawnOutcome {
  return {
    code: 0,
    signal: null,
    stdout: '',
    stderr: '',
    spawnError: null,
    timedOut: false,
    durationMs: 10,
    ...overrides,
  };
}

function probe(overrides: Partial<ProbeResult> = {}): ProbeResult {
  return {
    name: 'yt-dlp',
    path: '/App.app/Contents/Resources/yt-dlp_macos',
    ok: true,
    version: '2026.08.19',
    error: null,
    durationMs: 10,
    ...overrides,
  };
}

describe('parseVersion', () => {
  it('reads yt-dlp’s bare version line', () => {
    expect(parseVersion('yt-dlp', '2026.08.19\n')).toBe('2026.08.19');
  });

  it('reads the version out of ffmpeg’s banner', () => {
    const banner =
      'ffmpeg version 8.0.1-static https://johnvansickle.com/ffmpeg/\n' +
      'built with gcc 8 (Debian 8.3.0-6)\n';
    expect(parseVersion('ffmpeg', banner)).toBe('8.0.1-static');
  });

  it('reads the version out of ffprobe’s banner', () => {
    expect(parseVersion('ffprobe', 'ffprobe version 8.0.1 Copyright (c)')).toBe(
      '8.0.1',
    );
  });

  // The banner goes to stderr on some builds and stdout on others, so the
  // caller concatenates both — parsing must not care which half it came from.
  it('finds the banner when it is preceded by unrelated output', () => {
    expect(parseVersion('ffmpeg', 'noise\nffmpeg version 7.1 blah')).toBe(
      '7.1',
    );
  });

  it('returns null when there is no version to find', () => {
    expect(parseVersion('yt-dlp', '')).toBeNull();
    expect(parseVersion('ffmpeg', 'command not found')).toBeNull();
  });
});

describe('probeFailureReason', () => {
  it('reports a missing binary distinctly', () => {
    const reason = probeFailureReason(
      outcome({ spawnError: { code: 'ENOENT', message: 'spawn ENOENT' } }),
    );
    expect(reason).toMatch(/not found/i);
  });

  it('reports a permissions failure distinctly', () => {
    const reason = probeFailureReason(
      outcome({ spawnError: { code: 'EACCES', message: 'spawn EACCES' } }),
    );
    expect(reason).toMatch(/not executable/i);
  });

  // The Gatekeeper/hardened-runtime case: the process starts and is then
  // killed by the kernel, so there is no spawn error and no output at all.
  // This is the failure that originally showed up as a blank version.
  it('names the kill signal when the OS terminated the process', () => {
    const reason = probeFailureReason(
      outcome({ code: null, signal: 'SIGKILL' }),
    );
    expect(reason).toMatch(/SIGKILL/);
    expect(reason).toMatch(/killed/i);
  });

  it('reports a timeout distinctly', () => {
    expect(probeFailureReason(outcome({ timedOut: true }))).toMatch(
      /timed out/i,
    );
  });

  it('includes stderr for a plain non-zero exit', () => {
    const reason = probeFailureReason(
      outcome({ code: 127, stderr: 'dyld: Library not loaded' }),
    );
    expect(reason).toMatch(/127/);
    expect(reason).toMatch(/dyld/);
  });

  it('returns null when the process succeeded', () => {
    expect(probeFailureReason(outcome())).toBeNull();
  });
});

describe('buildReport', () => {
  it('is ok when every binary probe succeeded', () => {
    const report = buildReport(
      [probe({ name: 'yt-dlp' }), probe({ name: 'ffmpeg' })],
      null,
    );
    expect(report.ok).toBe(true);
  });

  it('is not ok when any binary probe failed', () => {
    const report = buildReport(
      [probe({ name: 'yt-dlp' }), probe({ name: 'ffmpeg', ok: false })],
      null,
    );
    expect(report.ok).toBe(false);
  });

  // The live fetch depends on the network and on YouTube not blocking the
  // runner, so it is reported but must never decide the exit code.
  it('stays ok when only the metadata fetch failed', () => {
    const report = buildReport([probe()], {
      ok: false,
      error: 'HTTP Error 429',
      durationMs: 900,
    });
    expect(report.ok).toBe(true);
  });

  it('is not ok when there are no probes at all', () => {
    expect(buildReport([], null).ok).toBe(false);
  });
});

describe('formatReport', () => {
  it('renders one line per binary with path and version', () => {
    const text = formatReport(buildReport([probe()], null));
    expect(text).toContain('yt-dlp');
    expect(text).toContain('2026.08.19');
    expect(text).toContain('/App.app/Contents/Resources/yt-dlp_macos');
  });

  it('shows the failure reason and marks the line FAIL', () => {
    const text = formatReport(
      buildReport(
        [probe({ ok: false, version: null, error: 'killed by SIGKILL' })],
        null,
      ),
    );
    expect(text).toContain('FAIL');
    expect(text).toContain('killed by SIGKILL');
  });

  it('says where a binary was expected when none was found', () => {
    const text = formatReport(
      buildReport(
        [probe({ ok: false, path: null, version: null, error: 'not found' })],
        null,
      ),
    );
    expect(text).toMatch(/not found|<none>/i);
  });

  it('marks a failed metadata fetch as non-fatal so a red line is not misread', () => {
    const text = formatReport(
      buildReport([probe()], {
        ok: false,
        error: 'HTTP Error 429',
        durationMs: 900,
      }),
    );
    expect(text).toContain('HTTP Error 429');
    expect(text).toMatch(/non-fatal|not fatal|warning/i);
  });

  it('includes the fetched title when the metadata fetch worked', () => {
    const text = formatReport(
      buildReport([probe()], {
        ok: true,
        title: 'Some Video Title',
        durationMs: 2100,
      }),
    );
    expect(text).toContain('Some Video Title');
  });
});
