/* Handler for local (no re-download) video/audio format conversion.
 *
 * Historically the "Format Converter" plugin converted a file by asking
 * yt-dlp to re-download the source video in the target format, which
 * required a fresh yt-dlp metadata fetch (`ytdlp:info`) before every single
 * conversion -- a mandatory, format-independent network round trip to the
 * source site that caused a flat ~30s delay before any conversion visibly
 * started, regardless of which output format was picked (see
 * downlodr-converter-plugin's handleUseYTDLP). This handler instead
 * transcodes the file the user already has on disk with a local ffmpeg
 * process, eliminating that round trip entirely.
 */

import { BrowserWindow, ipcMain } from 'electron';
import { ChildProcess, spawn } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, stat, unlink } from 'fs/promises';
import path from 'path';
import { ensureBundledFfmpegOnPath } from './bundledBinariesEnv';
import {
  computeConversionProgress,
  parseFfmpegDuration,
  parseLatestFfmpegStatus,
} from './formatConversionProgress';

interface ConvertFileOptions {
  inputPath: string;
  outputPath: string;
  /** Target file extension, e.g. 'mp3', 'mp4', 'mkv', 'm4a'. */
  format: string;
}

interface ConvertJob {
  proc: ChildProcess;
  paused: boolean;
  /** Set when the user (Stop/Remove) asked for the kill, as opposed to the OS. */
  cancelRequested: boolean;
}

/** How often a running job reports progress to the renderer. */
const PROGRESS_INTERVAL_MS = 500;

// Module-level so the yt-dlp `kill-controller` handler can reach conversions
// too: a conversion's download-list row carries its jobId as controllerId,
// and every Stop/Remove path in the renderer goes through killController.
const activeJobs = new Map<string, ConvertJob>();

/**
 * Kills a running conversion at the user's request. Returns false when no
 * such job is running (unknown id or already finished), true otherwise.
 * SIGKILL also ends a SIGSTOP-paused process, so this works on paused jobs.
 */
export function cancelConversionJob(jobId: string): boolean {
  const job = activeJobs.get(jobId);
  if (!job) return false;
  job.cancelRequested = true;
  job.proc.kill('SIGKILL');
  return true;
}

const AUDIO_FORMATS = new Set(['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg']);

/** Signal-based pause/resume only exists on POSIX (SIGSTOP/SIGCONT). */
const SUPPORTS_SIGNAL_PAUSE = process.platform !== 'win32';

function buildFfmpegArgs(
  inputPath: string,
  outputPath: string,
  format: string,
): string[] {
  const args = ['-y', '-i', inputPath];
  const ext = format.toLowerCase();

  if (AUDIO_FORMATS.has(ext)) {
    args.push('-vn');
    switch (ext) {
      case 'mp3':
        args.push('-c:a', 'libmp3lame', '-q:a', '2');
        break;
      case 'm4a':
      case 'aac':
        args.push('-c:a', 'aac', '-b:a', '192k');
        break;
      case 'wav':
        args.push('-c:a', 'pcm_s16le');
        break;
      case 'flac':
        args.push('-c:a', 'flac');
        break;
      case 'ogg':
        args.push('-c:a', 'libopus');
        break;
    }
  } else {
    switch (ext) {
      case 'webm':
        args.push('-c:v', 'libvpx', '-b:v', '2M', '-c:a', 'libopus');
        break;
      case 'mkv':
        args.push('-c:v', 'libx264', '-preset', 'fast', '-c:a', 'aac');
        break;
      // mp4 and any other video container fall through to the same
      // widely-compatible h264/aac pair.
      default:
        args.push(
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-c:a',
          'aac',
          '-movflags',
          '+faststart',
        );
        break;
    }
  }

  args.push(outputPath);
  return args;
}

type ConvertCompletePayload = {
  jobId: string;
  success: boolean;
  outputPath?: string;
  /** Size of the verified output file, on success. */
  size?: number;
  error?: string;
};

export const formatConversionHandler = (mainWindow: BrowserWindow) => {
  const sendToRenderer = (channel: string, payload: unknown) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  // Starts the ffmpeg process and returns immediately with a jobId once
  // it's spawned -- does NOT wait for the conversion to finish. Progress is
  // streamed via 'format:convertProgress' and completion is reported via
  // 'format:convertComplete', so the renderer can drive a download-list row
  // and track multiple concurrent jobs (batch conversion), cancelling or
  // pausing any of them by jobId while they're still running.
  ipcMain.handle(
    'format:startConvert',
    async (_event, options: ConvertFileOptions) => {
      const { inputPath, outputPath, format } = options;

      if (!inputPath || !existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }
      if (!outputPath) {
        throw new Error('Output path is required');
      }

      // Same PATH staging yt-dlp downloads use, so the bare `ffmpeg` below
      // resolves to the bundled build (binaries/ffmpeg-<arch> on darwin).
      const ffmpegDir = ensureBundledFfmpegOnPath();
      await mkdir(path.dirname(outputPath), { recursive: true }).catch(
        () => undefined,
      );
      const inputSize = await stat(inputPath)
        .then((s) => s.size)
        .catch(() => 0);

      const jobId = `convert-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
      const args = buildFfmpegArgs(inputPath, outputPath, format);
      console.log(
        `[convert] ${jobId} ffmpeg (${ffmpegDir ?? 'from PATH'}) ${args
          .map((a) => JSON.stringify(a))
          .join(' ')}`,
      );
      const proc = spawn('ffmpeg', args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      const job: ConvertJob = { proc, paused: false, cancelRequested: false };
      activeJobs.set(jobId, job);

      let stderrTail = '';
      let durationSec: number | null = null;
      let headerText = '';
      let lastProgressAt = 0;
      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderrTail += text;
        if (stderrTail.length > 4000) stderrTail = stderrTail.slice(-4000);

        // The input's Duration line comes once, in the header, before any
        // status line -- stop collecting once it's found (or clearly absent).
        if (durationSec === null && headerText.length < 64 * 1024) {
          headerText += text;
          durationSec = parseFfmpegDuration(headerText);
        }

        const now = Date.now();
        if (!durationSec || now - lastProgressAt < PROGRESS_INTERVAL_MS) {
          return;
        }
        const status = parseLatestFfmpegStatus(stderrTail);
        if (!status) return;
        lastProgressAt = now;
        sendToRenderer('format:convertProgress', {
          jobId,
          ...computeConversionProgress({ status, durationSec, inputSize }),
        });
      });

      let settled = false;
      const complete = (payload: ConvertCompletePayload) => {
        if (settled) return;
        settled = true;
        activeJobs.delete(jobId);
        console.log(
          `[convert] ${jobId} ${
            payload.success ? 'finished' : `failed: ${payload.error}`
          }`,
        );
        sendToRenderer('format:convertComplete', payload);
      };

      proc.once('error', (err) => {
        complete({ jobId, success: false, error: err.message });
      });

      proc.once('close', async (code, signal) => {
        if (job.cancelRequested) {
          // The user stopped it: the half-written output is garbage.
          await unlink(outputPath).catch(() => undefined);
          complete({ jobId, success: false, error: 'CANCELLED' });
          return;
        }
        if (signal) {
          // Nobody in the app asked for this kill. On macOS a SIGKILL here
          // is typically the system refusing to run the binary (code
          // signature / Gatekeeper), which must not read as a user cancel.
          await unlink(outputPath).catch(() => undefined);
          complete({
            jobId,
            success: false,
            error: `ffmpeg was terminated by the system (${signal})`,
          });
          return;
        }
        if (code !== 0) {
          complete({
            jobId,
            success: false,
            error:
              stderrTail.trim().slice(-500) ||
              `ffmpeg exited with code ${code}`,
          });
          return;
        }
        // Exit 0 is not proof enough: only report success for a real file.
        const size = await stat(outputPath)
          .then((s) => s.size)
          .catch(() => 0);
        if (size > 0) {
          complete({ jobId, success: true, outputPath, size });
        } else {
          complete({
            jobId,
            success: false,
            error: `ffmpeg exited without writing ${outputPath}`,
          });
        }
      });

      return { jobId };
    },
  );

  ipcMain.handle('format:cancelConvert', async (_event, jobId: string) => {
    return cancelConversionJob(jobId);
  });

  ipcMain.handle('format:pauseConvert', async (_event, jobId: string) => {
    const job = activeJobs.get(jobId);
    if (!job) return { success: false, error: 'Job not found' };
    if (!SUPPORTS_SIGNAL_PAUSE) {
      return {
        success: false,
        error: 'Pausing a local conversion is not supported on Windows.',
      };
    }
    if (job.paused) return { success: true };
    job.proc.kill('SIGSTOP');
    job.paused = true;
    return { success: true };
  });

  ipcMain.handle('format:resumeConvert', async (_event, jobId: string) => {
    const job = activeJobs.get(jobId);
    if (!job) return { success: false, error: 'Job not found' };
    if (!SUPPORTS_SIGNAL_PAUSE) {
      return {
        success: false,
        error: 'Resuming a local conversion is not supported on Windows.',
      };
    }
    if (!job.paused) return { success: true };
    job.proc.kill('SIGCONT');
    job.paused = false;
    return { success: true };
  });

  // Cancel every in-flight conversion. Used when the app is quitting so no
  // orphaned ffmpeg process outlives the window.
  return () => {
    for (const job of activeJobs.values()) {
      job.cancelRequested = true;
      job.proc.kill('SIGKILL');
    }
    activeJobs.clear();
  };
};
