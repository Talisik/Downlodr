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
import { mkdir } from 'fs/promises';
import path from 'path';
import { ensureFfmpegReady } from './ytdlpHandler';

interface ConvertFileOptions {
  inputPath: string;
  outputPath: string;
  /** Target file extension, e.g. 'mp3', 'mp4', 'mkv', 'm4a'. */
  format: string;
}

interface ConvertJob {
  proc: ChildProcess;
  paused: boolean;
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

export const formatConversionHandler = (mainWindow: BrowserWindow) => {
  const activeJobs = new Map<string, ConvertJob>();

  // Starts the ffmpeg process and returns immediately with a jobId once
  // it's spawned -- does NOT wait for the conversion to finish. Completion
  // is reported asynchronously via the 'format:convertComplete' event so
  // the renderer can track multiple concurrent jobs (batch conversion) and
  // cancel/pause any of them by jobId while they're still running.
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

      await ensureFfmpegReady();
      await mkdir(path.dirname(outputPath), { recursive: true }).catch(
        () => undefined,
      );

      const jobId = `convert-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
      const args = buildFfmpegArgs(inputPath, outputPath, format);
      const proc = spawn('ffmpeg', args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      activeJobs.set(jobId, { proc, paused: false });

      let stderrTail = '';
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderrTail += chunk.toString();
        if (stderrTail.length > 4000) stderrTail = stderrTail.slice(-4000);
      });

      const send = (payload: {
        jobId: string;
        success: boolean;
        outputPath?: string;
        error?: string;
      }) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('format:convertComplete', payload);
        }
      };

      proc.once('error', (err) => {
        activeJobs.delete(jobId);
        send({ jobId, success: false, error: err.message });
      });

      proc.once('close', (code, signal) => {
        activeJobs.delete(jobId);
        if (signal === 'SIGKILL' || signal === 'SIGTERM') {
          send({ jobId, success: false, error: 'CANCELLED' });
          return;
        }
        if (code === 0) {
          send({ jobId, success: true, outputPath });
        } else {
          send({
            jobId,
            success: false,
            error:
              stderrTail.trim().slice(-500) ||
              `ffmpeg exited with code ${code}`,
          });
        }
      });

      return { jobId };
    },
  );

  ipcMain.handle('format:cancelConvert', async (_event, jobId: string) => {
    const job = activeJobs.get(jobId);
    if (!job) return false;
    job.proc.kill('SIGKILL');
    return true;
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
      job.proc.kill('SIGKILL');
    }
    activeJobs.clear();
  };
};
