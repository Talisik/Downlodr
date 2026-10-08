/**
 * Pure helpers that turn ffmpeg's stderr into the progress fields a download
 * row shows (percent, speed, time left). Kept free of Electron so they stay
 * unit-testable; formatConversionHandler.ts feeds them the live stderr.
 *
 * ffmpeg prints the input's length once (`Duration: 00:12:34.56`) and then a
 * status line roughly twice a second:
 *   size=    1024kB time=00:01:02.50 bitrate= 134.2kbits/s speed=41.7x
 */

/** `HH:MM:SS(.ms)` -> seconds, or null when it isn't a timestamp. */
export function parseFfmpegTimestamp(value: string): number | null {
  const match = /^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(value.trim());
  if (!match) return null;
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/** The input's total length in seconds, from ffmpeg's header output. */
export function parseFfmpegDuration(text: string): number | null {
  // Live/unknown-length inputs print `Duration: N/A`, which never matches.
  const match = /Duration:\s*(\d+:\d{2}:\d{2}(?:\.\d+)?)/.exec(text);
  if (!match) return null;
  const seconds = parseFfmpegTimestamp(match[1]);
  return seconds && seconds > 0 ? seconds : null;
}

export interface FfmpegStatus {
  /** Media seconds processed so far. */
  time: number;
  /** Processing speed as a multiple of real time (41.7 for `speed=41.7x`). */
  speedFactor: number | null;
}

/** The most recent status line in `text`, or null when there is none yet. */
export function parseLatestFfmpegStatus(text: string): FfmpegStatus | null {
  const times = [...text.matchAll(/time=\s*(\d+:\d{2}:\d{2}(?:\.\d+)?)/g)];
  if (times.length === 0) return null;
  const time = parseFfmpegTimestamp(times[times.length - 1][1]);
  if (time === null) return null;

  const speeds = [...text.matchAll(/speed=\s*([\d.]+)x/g)];
  const speedFactor =
    speeds.length > 0 ? Number(speeds[speeds.length - 1][1]) : null;
  return {
    time,
    speedFactor:
      speedFactor !== null && Number.isFinite(speedFactor) && speedFactor > 0
        ? speedFactor
        : null,
  };
}

/** Seconds -> yt-dlp style ETA (`MM:SS`, or `H:MM:SS` past an hour). */
export function formatEta(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Bytes/second -> yt-dlp style speed (`12.34MiB/s`), the format SpeedGraph
 * and the status bar already parse for download rows.
 */
export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '';
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  let value = bytesPerSecond;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(2)}${units[unit]}/s`;
}

export interface ConversionProgress {
  /** 0-99 while running; 100 is reserved for a verified finished file. */
  percent: number;
  speed: string;
  timeLeft: string;
}

/**
 * Progress for a conversion, given the media time processed so far. Speed is
 * expressed as how fast the *source file* is being worked through
 * (inputSize × fraction done per second), so a conversion reads like a
 * download of that file in the row's speed column and the status bar.
 */
export function computeConversionProgress(args: {
  status: FfmpegStatus;
  durationSec: number;
  inputSize: number;
}): ConversionProgress {
  const { status, durationSec, inputSize } = args;
  const fraction = Math.min(1, Math.max(0, status.time / durationSec));
  const percent = Math.min(99, Math.floor(fraction * 100));

  let speed = '';
  let timeLeft = '';
  if (status.speedFactor) {
    // speedFactor media-seconds per wall-second; durationSec media-seconds
    // span the whole input file.
    speed = formatSpeed((inputSize / durationSec) * status.speedFactor);
    timeLeft = formatEta((durationSec - status.time) / status.speedFactor);
  }
  return { percent, speed, timeLeft };
}
