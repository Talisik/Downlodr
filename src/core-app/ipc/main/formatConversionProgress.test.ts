import { describe, expect, it } from 'vitest';
import {
  computeConversionProgress,
  formatEta,
  formatSpeed,
  parseFfmpegDuration,
  parseFfmpegTimestamp,
  parseLatestFfmpegStatus,
} from './formatConversionProgress';

describe('parseFfmpegTimestamp', () => {
  it('parses HH:MM:SS.ms', () => {
    expect(parseFfmpegTimestamp('01:02:03.50')).toBe(3723.5);
  });

  it('rejects non-timestamps', () => {
    expect(parseFfmpegTimestamp('N/A')).toBeNull();
  });
});

describe('parseFfmpegDuration', () => {
  it('reads the input duration from the header', () => {
    const header =
      "Input #0, matroska,webm, from 'in.mkv':\n  Duration: 00:12:34.56, start: 0.000000, bitrate: 1000 kb/s";
    expect(parseFfmpegDuration(header)).toBeCloseTo(754.56);
  });

  it('returns null for unknown-length inputs', () => {
    expect(parseFfmpegDuration('  Duration: N/A, start: 0')).toBeNull();
  });
});

describe('parseLatestFfmpegStatus', () => {
  it('uses the last status line in the buffer', () => {
    const text =
      'size=  100kB time=00:00:10.00 bitrate=1 speed=5.0x\r' +
      'size=  200kB time=00:00:20.00 bitrate=1 speed=10.5x\r';
    expect(parseLatestFfmpegStatus(text)).toEqual({
      time: 20,
      speedFactor: 10.5,
    });
  });

  it('returns null before the first status line', () => {
    expect(parseLatestFfmpegStatus('Duration: 00:01:00.00')).toBeNull();
  });

  it('treats a zero speed as unknown', () => {
    expect(parseLatestFfmpegStatus('time=00:00:00.00 speed=   0x')).toEqual({
      time: 0,
      speedFactor: null,
    });
  });
});

describe('formatEta / formatSpeed', () => {
  it('formats ETAs like yt-dlp', () => {
    expect(formatEta(65)).toBe('01:05');
    expect(formatEta(3725)).toBe('1:02:05');
  });

  it('formats speeds the way SpeedGraph parses them', () => {
    expect(formatSpeed(5 * 1024 * 1024)).toBe('5.00MiB/s');
    expect(formatSpeed(0)).toBe('');
  });
});

describe('computeConversionProgress', () => {
  it('derives percent, speed and time left', () => {
    const progress = computeConversionProgress({
      status: { time: 30, speedFactor: 10 },
      durationSec: 120,
      inputSize: 120 * 1024 * 1024,
    });
    // 1 MiB of source per media-second, processed at 10x.
    expect(progress).toEqual({
      percent: 25,
      speed: '10.00MiB/s',
      timeLeft: '00:09',
    });
  });

  it('never reports 100 before the file is verified', () => {
    const progress = computeConversionProgress({
      status: { time: 120, speedFactor: null },
      durationSec: 120,
      inputSize: 1,
    });
    expect(progress.percent).toBe(99);
    expect(progress.speed).toBe('');
  });
});
