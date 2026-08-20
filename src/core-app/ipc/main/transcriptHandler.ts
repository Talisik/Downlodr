/* Handler for developer tools of base app such as opening dev tools, etc. */
/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

import { execFileSync } from 'child_process';
import { BrowserWindow, app, ipcMain } from 'electron';
import fs, { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { getBundledBinaryPath } from './appInfoHandler';
/**
 * Handles the behavior of the base app such as closing, minimizing, maximizing, etc.
 * @param mainWindow - The main window of the base app
 * @returns void
 */

/**
 * Whisper models are trained on 16kHz mono PCM audio. The whisper filter will
 * resample internally if fed something else, but that internal conversion is
 * opaque and has been observed to produce worse transcriptions than an
 * explicit pre-conversion pass (matches the whisper.cpp CLI workflow, which
 * always runs `ffmpeg -ar 16000 -ac 1 -c:a pcm_s16le` before transcribing).
 */
function resampleTo16kMono(
  ffmpegPath: string,
  inputFile: string,
  outputPath: string,
): string {
  execFileSync(ffmpegPath, [
    '-y',
    '-i',
    inputFile,
    '-ar',
    '16000',
    '-ac',
    '1',
    '-c:a',
    'pcm_s16le',
    outputPath,
  ]);

  return outputPath;
}

/**
 * Fixed, filter-safe basenames used inside the whisper working directory.
 *
 * FFmpeg unescapes a filtergraph twice (once parsing the graph, once parsing
 * each filter's arguments), and no quoting form survives both passes for a
 * path containing an apostrophe — a very common character in video titles.
 * The old code wrapped paths in single quotes and escaped only the drive
 * colon, so `Don't Stop.srt` reached the filter as `Dont Stop.srt`: it either
 * wrote the transcript to the wrong path (exit 0, silent data loss) or, when
 * the apostrophe was in a *folder* name, failed to open the destination and
 * exited -2 — which the error handler below then misreported as a bad model
 * path.
 *
 * Rather than escape user text, we keep it out of the filtergraph entirely:
 * ffmpeg runs with cwd set to a private working directory and every path in
 * the filter is one of these generated basenames.
 */
const WHISPER_WORK_INPUT = 'in.wav';
const WHISPER_WORK_MODEL = 'model.bin';
const WHISPER_WORK_VAD = 'vad.bin';

/** Silero VAD weights, fetched into the repo root by scripts/binaries.mjs. */
const VAD_MODEL_NAME = 'ggml-silero-v5.1.2.bin';

/**
 * OFF pending investigation — do not enable without re-running the comparison
 * below.
 *
 * VAD is meant to make the filter cut on detected silence instead of on the
 * clock, which would stop windows splitting mid-sentence. Measured on 120s of
 * Mandarin drama audio (ggml-small, queue=30) it instead truncated the
 * transcript: 44 cues / 329 chars covering the full two minutes without VAD,
 * against 7 cues / 49 chars stopping dead at 00:00:15 with it. ffmpeg read the
 * whole file and exited 0 either way, so this is silent data loss, and the
 * apparent 16% speedup was only the cost of the ~87% of the audio it skipped.
 * The VAD run also emitted overlapping cues (7.87->13.37 alongside
 * 9.69->10.69), which is malformed SRT irrespective of coverage.
 *
 * Suspected cause is af_whisper.c transcribing nothing when VAD reports no
 * segments and letting the buffer keep filling — plausible on dialogue mixed
 * under music, which this clip is. Unconfirmed. vad_threshold (default 0.5)
 * and its interaction with queue are the next things to rule out.
 */
const VAD_ENABLED = false;

/**
 * Creates the private working directory. Its own path may contain anything
 * (the user's Windows account name can hold an apostrophe too) — that is fine,
 * because it is passed via `cwd`, never through the filtergraph.
 */
function createWhisperWorkDir(): string {
  const workDir = path.join(
    os.tmpdir(),
    `downlodr-whisper-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(workDir, { recursive: true });
  return workDir;
}

/**
 * Places the model inside workDir under WHISPER_WORK_MODEL. Hardlinks first —
 * the model is ~490MB and a hardlink costs nothing — falling back to a copy
 * only when the model and the temp dir sit on different volumes.
 */
function linkModelInto(workDir: string, modelPath: string): void {
  const target = path.join(workDir, WHISPER_WORK_MODEL);
  try {
    fs.linkSync(modelPath, target);
  } catch {
    fs.copyFileSync(modelPath, target);
  }
}

/**
 * Locates the Silero VAD weights, or null when they are not installed.
 *
 * VAD is an enhancement, not a requirement: a missing file degrades to
 * fixed-window slicing rather than failing the job, so an install that
 * predates `yarn binaries:setup` fetching it still transcribes.
 */
function findVadModel(): string | null {
  if (!VAD_ENABLED) return null;

  const bundled = getBundledBinaryPath(VAD_MODEL_NAME);
  if (bundled && existsSync(bundled)) return bundled;

  const cwdPath = path.join(process.cwd(), VAD_MODEL_NAME);
  return existsSync(cwdPath) ? cwdPath : null;
}

/**
 * Window size handed to the whisper filter.
 *
 * The filter fills a `queue`-second buffer, transcribes it, discards it and
 * refills — the windows do not overlap and no decoder context carries across
 * them, so any word straddling a boundary is split and each half is decoded
 * blind. Whisper also pads every window to a 30s mel spectrogram regardless of
 * how much audio it holds, so a small window costs the same inference as a
 * large one and simply spends the difference decoding silence, which is the
 * regime where it hallucinates and emits `[Music]`.
 *
 * This was a hardcoded 30 until c20f8e4 replaced it with
 * `max(3, min(30, duration/4000))`, scaling the window down to as little as 3s
 * so that a short-form clip got several windows instead of being collapsed
 * into a single `[Music]` cue by a window longer than the clip itself. That
 * fixed the symptom by making every window worse: up to 10x the inferences,
 * each mostly padding, and the language auto-detect (which runs once, on the
 * first window) left guessing from 3 seconds of intro. Note it only ever
 * shrank below 30 for clips under two minutes.
 *
 * 30 is whisper's own native window, so it is the one value that wastes no
 * padding at all. Measured against the old scaling on Mandarin drama audio:
 *
 *   30s clip   q=7  49.5s   vs  q=30  19.2s  — better text as well as faster
 *                                              (caught a line q=7 missed, and
 *                                               got 酒瓶子 where q=7 had 九瓶子)
 *   60s clip   q=15 48.5s   vs  q=30  37.3s  — equivalent text
 *   10s clip   q=3  46.5s   vs  q=30  12.1s  — WORSE text: q=30 lost the line
 *                                              "好 上来 小林子" entirely
 *
 * So this is a deliberate trade, not a free win: clips under roughly fifteen
 * seconds transcribe worse than they did before, and everything above that
 * transcribes better and 1.3-2.6x faster. It is the right default because
 * typical downloads are minutes long, but short-form is a real regression.
 *
 * VAD was meant to remove the trade by cutting on detected silence instead of
 * on the clock. It does not work — see VAD_ENABLED above — so the short-clip
 * case is currently unprotected. Restoring a floor here (never below ~10s)
 * would recover it; that is unmeasured.
 */
const WHISPER_QUEUE_SECONDS = 30;

export const transcriptHandler = (mainWindow: BrowserWindow) => {
  /**
   * Dynamically finds FFmpeg executable path (synchronous version).
   * In production: uses bundled FFmpeg from resources.
   * In development: returns first found FFmpeg (may not have Whisper support).
   * Use getFFmpegPathWithWhisper() for validated FFmpeg 8.0+.
   * @deprecated Use getFFmpegPathWithWhisper() instead for Whisper support validation
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function getFFmpegPath(): string {
    const isDev = process.env.NODE_ENV === 'development';

    // Production mode: use bundled FFmpeg from resources
    const bundledFFmpeg = getBundledBinaryPath('ffmpeg.exe');
    if (bundledFFmpeg) {
      return bundledFFmpeg;
    }

    // Development mode: search for user's FFmpeg installation
    if (isDev) {
      const platform = process.platform;
      const searchPaths: string[] = [];

      if (platform === 'win32') {
        // Windows common installation locations
        const homeDir = os.homedir();
        const localAppData =
          process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
        const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
        const programFilesX86 =
          process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

        // WinGet installation paths (common patterns) - this already prioritizes 8.0+
        const wingetBase = path.join(
          localAppData,
          'Microsoft',
          'WinGet',
          'Packages',
        );
        searchPaths.push(
          // Try to find any FFmpeg installation in WinGet packages (8.0+ first)
          ...findFFmpegInDirectory(wingetBase),
          // Chocolatey
          path.join(
            process.env['ChocolateyInstall'] || 'C:\\ProgramData\\chocolatey',
            'bin',
            'ffmpeg.exe',
          ),
          // Scoop
          path.join(
            homeDir,
            'scoop',
            'apps',
            'ffmpeg',
            'current',
            'bin',
            'ffmpeg.exe',
          ),
          // Direct Program Files installations
          path.join(programFiles, 'ffmpeg', 'bin', 'ffmpeg.exe'),
          path.join(programFilesX86, 'ffmpeg', 'bin', 'ffmpeg.exe'),
          // Common user installations
          path.join(homeDir, 'ffmpeg', 'bin', 'ffmpeg.exe'),
          path.join(localAppData, 'ffmpeg', 'bin', 'ffmpeg.exe'),
        );
      } else if (platform === 'darwin') {
        // macOS common locations
        const homeDir = os.homedir();
        searchPaths.push(
          // Homebrew
          '/opt/homebrew/bin/ffmpeg',
          '/usr/local/bin/ffmpeg',
          path.join(homeDir, 'homebrew', 'bin', 'ffmpeg'),
          // MacPorts
          '/opt/local/bin/ffmpeg',
        );
      } else {
        // Linux common locations
        searchPaths.push(
          '/usr/bin/ffmpeg',
          '/usr/local/bin/ffmpeg',
          path.join(os.homedir(), '.local', 'bin', 'ffmpeg'),
        );
      }

      // Check project directory (likely to be 8.0+ if bundled)
      const projectPath = path.join(process.cwd(), 'ffmpeg.exe');
      if (existsSync(projectPath)) {
        return projectPath;
      }

      // Check all search paths
      for (const searchPath of searchPaths) {
        if (searchPath && existsSync(searchPath)) {
          return searchPath;
        }
      }
    }

    // Final fallback: system PATH
    return 'ffmpeg';
  }

  /**
   * Finds FFmpeg executable with Whisper support (8.0+).
   * Validates each found FFmpeg and returns the first one that has Whisper support.
   * @returns Promise resolving to FFmpeg path with Whisper support, or throws error
   */
  async function getFFmpegPathWithWhisper(): Promise<string> {
    const isDev = process.env.NODE_ENV === 'development';
    const isPackaged = app.isPackaged;

    // Production mode: use bundled FFmpeg from resources or app directory
    if (isPackaged) {
      // First try the bundled FFmpeg from process.resourcesPath
      const bundledFFmpeg = getBundledBinaryPath('ffmpeg.exe');
      if (bundledFFmpeg) {
        // Validate it has Whisper support
        const check = await checkFFmpegWhisperSupport(bundledFFmpeg);
        if (check.hasWhisper) {
          return bundledFFmpeg;
        } else {
          console.warn(
            `Bundled FFmpeg at ${bundledFFmpeg} does not have Whisper support: ${check.error}`,
          );
        }
      }

      // If bundled FFmpeg not found or doesn't have Whisper, check other locations
      const possiblePaths = [];

      // 2. Check app directory (where postPackage hook copies files)
      const appPath = app.getAppPath();
      possiblePaths.push(path.join(path.dirname(appPath), 'ffmpeg.exe'));

      // 3. Check process.resourcesPath parent (sometimes resources are one level up)
      if (process.resourcesPath) {
        const resourcesParent = path.dirname(process.resourcesPath);
        possiblePaths.push(path.join(resourcesParent, 'ffmpeg.exe'));
      }

      // 4. Check executable directory
      const exeDir = path.dirname(process.execPath);
      possiblePaths.push(path.join(exeDir, 'ffmpeg.exe'));

      // Try each path and validate if found
      for (const bundledPath of possiblePaths) {
        if (existsSync(bundledPath)) {
          // Validate it has Whisper support
          const check = await checkFFmpegWhisperSupport(bundledPath);
          if (check.hasWhisper) {
            return bundledPath;
          } else {
            console.warn(
              `Bundled FFmpeg at ${bundledPath} does not have Whisper support: ${check.error}`,
            );
          }
        }
      }

      // If bundled FFmpeg not found or doesn't have Whisper, throw error
      throw new Error(
        'Bundled FFmpeg not found or does not have Whisper support. Please ensure ffmpeg.exe (8.0+) is included in the app bundle.',
      );
    }

    // Development mode: search and validate FFmpeg installations
    if (isDev) {
      const platform = process.platform;
      const searchPaths: string[] = [];

      if (platform === 'win32') {
        // Windows common installation locations
        const homeDir = os.homedir();
        const localAppData =
          process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
        const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
        const programFilesX86 =
          process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

        // WinGet installation paths (common patterns) - this already prioritizes 8.0+
        const wingetBase = path.join(
          localAppData,
          'Microsoft',
          'WinGet',
          'Packages',
        );
        searchPaths.push(
          // Try to find any FFmpeg installation in WinGet packages (8.0+ first)
          ...findFFmpegInDirectory(wingetBase),
          // Chocolatey
          path.join(
            process.env['ChocolateyInstall'] || 'C:\\ProgramData\\chocolatey',
            'bin',
            'ffmpeg.exe',
          ),
          // Scoop
          path.join(
            homeDir,
            'scoop',
            'apps',
            'ffmpeg',
            'current',
            'bin',
            'ffmpeg.exe',
          ),
          // Direct Program Files installations
          path.join(programFiles, 'ffmpeg', 'bin', 'ffmpeg.exe'),
          path.join(programFilesX86, 'ffmpeg', 'bin', 'ffmpeg.exe'),
          // Common user installations
          path.join(homeDir, 'ffmpeg', 'bin', 'ffmpeg.exe'),
          path.join(localAppData, 'ffmpeg', 'bin', 'ffmpeg.exe'),
        );
      } else if (platform === 'darwin') {
        // macOS common locations
        const homeDir = os.homedir();
        searchPaths.push(
          // Homebrew
          '/opt/homebrew/bin/ffmpeg',
          '/usr/local/bin/ffmpeg',
          path.join(homeDir, 'homebrew', 'bin', 'ffmpeg'),
          // MacPorts
          '/opt/local/bin/ffmpeg',
        );
      } else {
        // Linux common locations
        searchPaths.push(
          '/usr/bin/ffmpeg',
          '/usr/local/bin/ffmpeg',
          path.join(os.homedir(), '.local', 'bin', 'ffmpeg'),
        );
      }

      // Check project directory first (likely to be 8.0+ if bundled)
      const projectPath = path.join(process.cwd(), 'ffmpeg.exe');
      if (existsSync(projectPath)) {
        const check = await checkFFmpegWhisperSupport(projectPath);
        if (check.hasWhisper) {
          return projectPath;
        }
      }

      // Check all search paths and validate each one
      for (const searchPath of searchPaths) {
        if (searchPath && existsSync(searchPath)) {
          const check = await checkFFmpegWhisperSupport(searchPath);
          if (check.hasWhisper) {
            return searchPath;
          }
        }
      }

      // If we get here, no valid FFmpeg was found
      throw new Error(
        'No FFmpeg 8.0+ with Whisper support found. Please install FFmpeg 8.0 or higher with Whisper filter support.',
      );
    }

    // Final fallback: try system PATH (but validate it)
    const systemFFmpeg = 'ffmpeg';
    try {
      const check = await checkFFmpegWhisperSupport(systemFFmpeg);
      if (check.hasWhisper) {
        return systemFFmpeg;
      }
      throw new Error(
        check.error ||
          'FFmpeg found in system PATH but does not have Whisper support. Please install FFmpeg 8.0+ with Whisper filter support.',
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `FFmpeg not found or does not have Whisper support: ${errorMessage}`,
      );
    }
  }

  /**
   * Helper function to recursively search for FFmpeg in a directory (useful for WinGet packages)
   * Prioritizes FFmpeg 8.0+ installations
   */
  function findFFmpegInDirectory(dir: string): string[] {
    const paths: string[] = [];
    const paths80Plus: string[] = [];
    try {
      if (!existsSync(dir)) {
        return paths;
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Check common FFmpeg directory patterns - prioritize 8.0+
          const possiblePaths = [
            path.join(
              dir,
              entry.name,
              'ffmpeg-8.0-full_build',
              'bin',
              'ffmpeg.exe',
            ),
            path.join(dir, entry.name, 'bin', 'ffmpeg.exe'),
            path.join(dir, entry.name, 'ffmpeg.exe'),
          ];

          for (const possiblePath of possiblePaths) {
            if (existsSync(possiblePath)) {
              // Check if it's FFmpeg 8.0+ by checking directory name or validating
              if (
                possiblePath.includes('ffmpeg-8.0') ||
                possiblePath.includes('ffmpeg-8.') ||
                entry.name.includes('8.0')
              ) {
                paths80Plus.push(possiblePath);
              } else {
                paths.push(possiblePath);
              }
            }
          }

          // Recursively search subdirectories (limit depth to avoid performance issues)
          const subPaths = findFFmpegInDirectory(path.join(dir, entry.name));
          // Separate 8.0+ from others
          for (const subPath of subPaths) {
            if (
              subPath.includes('ffmpeg-8.0') ||
              subPath.includes('ffmpeg-8.')
            ) {
              paths80Plus.push(subPath);
            } else {
              paths.push(subPath);
            }
          }
        }
      }
    } catch (error) {
      // Silently fail if directory access is denied or other errors occur
      console.debug(`Could not search directory ${dir}:`, error);
    }
    // Return 8.0+ paths first, then others
    return [...paths80Plus, ...paths];
  }

  /**
   * Checks if FFmpeg has Whisper filter support
   * @param ffmpegPath Path to FFmpeg executable
   * @returns Promise resolving to object with hasWhisper and version info
   */
  async function checkFFmpegWhisperSupport(ffmpegPath: string): Promise<{
    hasWhisper: boolean;
    version?: string;
    error?: string;
  }> {
    const { spawn } = await import('child_process');

    return new Promise((resolve) => {
      // First check version
      const versionProcess = spawn(ffmpegPath, ['-version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let versionOutput = '';
      let versionError = '';

      versionProcess.stdout.on('data', (data: Buffer) => {
        versionOutput += data.toString();
      });

      versionProcess.stderr.on('data', (data: Buffer) => {
        versionError += data.toString();
      });

      versionProcess.on('close', () => {
        // Extract version number
        const versionMatch =
          versionOutput.match(/ffmpeg version (\d+)\.(\d+)/) ||
          versionError.match(/ffmpeg version (\d+)\.(\d+)/);
        const majorVersion = versionMatch ? parseInt(versionMatch[1], 10) : 0;
        const version = versionMatch
          ? `${versionMatch[1]}.${versionMatch[2]}`
          : undefined;

        // FFmpeg 8.0+ is required for Whisper filter
        if (majorVersion < 8) {
          resolve({
            hasWhisper: false,
            version,
            error: `FFmpeg version ${version} detected. FFmpeg 8.0 or higher is required for Whisper filter support.`,
          });
          return;
        }

        // Check if whisper filter exists
        const filterProcess = spawn(ffmpegPath, ['-filters'], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let filterOutput = '';
        let filterError = '';

        filterProcess.stdout.on('data', (data: Buffer) => {
          filterOutput += data.toString();
        });

        filterProcess.stderr.on('data', (data: Buffer) => {
          filterError += data.toString();
        });

        filterProcess.on('close', () => {
          const allOutput = filterOutput + filterError;
          const hasWhisper = /whisper/i.test(allOutput);

          if (!hasWhisper) {
            resolve({
              hasWhisper: false,
              version,
              error: `FFmpeg ${version} found, but Whisper filter is not available. Please install FFmpeg 8.0+ with Whisper support.`,
            });
          } else {
            resolve({
              hasWhisper: true,
              version,
            });
          }
        });

        filterProcess.on('error', () => {
          resolve({
            hasWhisper: false,
            version,
            error:
              'Failed to check FFmpeg filters. Whisper support cannot be verified.',
          });
        });
      });

      versionProcess.on('error', () => {
        resolve({
          hasWhisper: false,
          error: 'Failed to check FFmpeg version.',
        });
      });
    });
  }

  /**
   * ffprobe.exe *is* bundled (see forge.config.ts extraResource). Resolving it
   * matters: these probes previously invoked a bare `ffprobe` from PATH, which
   * most users do not have, so getDurationMs always threw and the caller fell
   * back to a zero duration — which in turn pinned the whisper window to its
   * shortest setting for every video.
   */
  function ffprobePath(): string {
    return getBundledBinaryPath('ffprobe.exe') ?? 'ffprobe';
  }

  function getDurationMs(filePath: string): number {
    const output = execFileSync(ffprobePath(), [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    return Math.floor(parseFloat(output.toString().trim()) * 1000);
  }

  /**
   * Some downloaded videos (e.g. muted/template TikTok clips) have no audio
   * stream at all, which makes the later ffmpeg resample-to-WAV step fail
   * with an opaque "Output file does not contain any stream" error. Check
   * up front so we can surface a clear message instead.
   */
  function hasAudioStream(filePath: string): boolean {
    const output = execFileSync(ffprobePath(), [
      '-v',
      'error',
      '-select_streams',
      'a',
      '-show_entries',
      'stream=index',
      '-of',
      'csv=p=0',
      filePath,
    ]);
    return output.toString().trim().length > 0;
  }

  // handler to execute FFmpeg with Whisper transcription
  ipcMain.handle(
    'ffmpeg:whisper-transcribe',
    async (
      event,
      options: {
        inputFile: string;
        outputFile: string;
        modelPath: string;
        language?: string;
        format?: string;
        /**
         * Correlates progress events with the caller that started them.
         * 'ffmpeg:progress' is one channel shared by every concurrent
         * transcription (transcriptQueue runs two at a time, and the UI
         * buttons start jobs outside the queue entirely), so without this
         * every listener saw every job's events: a new job's first progress
         * event reset an already-running job's bar from its real value to 0.
         */
        jobId?: string;
      },
    ) => {
      return (async () => {
        const { spawn } = await import('child_process');

        // Get FFmpeg path with Whisper support (validates and finds best match)
        const ffmpegPath = await getFFmpegPathWithWhisper();

        return new Promise((resolve, reject) => {
          // Get actual duration of the input file
          let totalDurationMs: number;
          try {
            totalDurationMs = getDurationMs(options.inputFile);
          } catch (error) {
            console.warn('Failed to get file duration, using fallback:', error);
            // Fallback to a reasonable default if duration cannot be determined
            totalDurationMs = 0;
          }

          // Every emission on this shared channel is stamped with jobId so
          // listeners can discard other transcriptions' events.
          const jobId = options.jobId;
          const sendProgress = (payload: Record<string, unknown>): void => {
            event.sender.send(
              'ffmpeg:progress',
              JSON.stringify({ ...payload, jobId }),
            );
          };

          // Send total duration to renderer once at the start
          if (totalDurationMs > 0) {
            sendProgress({ type: 'duration', totalDurationMs });
          }

          // Function to parse progress from FFmpeg output
          function parseLine(line: string): void {
            const match = line.match(/run transcription at (\d+) ms/);
            if (!match) return;

            if (totalDurationMs > 0) {
              const currentMs = parseInt(match[1], 10);
              let percent = (currentMs / totalDurationMs) * 100;
              if (percent > 100) percent = 100;
              process.stdout.write(`\rProgress: ${percent.toFixed(2)}%`);

              sendProgress({
                type: 'progress',
                currentMs,
                totalDurationMs,
                percent: percent.toFixed(2),
                raw: line.trim(),
              });
            } else {
              // Duration unknown, so there is no percentage to report — but
              // this still has to be a tagged payload, not a bare string, or
              // it lands in every other job's listener uncorrelated.
              sendProgress({ type: 'raw', raw: line.trim() });
            }
          }

          let workDir: string | undefined;

          /** Removes the working directory (resampled audio, linked model, transcript). */
          const cleanupWorkDir = (): void => {
            if (!workDir) return;
            try {
              fs.rmSync(workDir, { recursive: true, force: true });
            } catch {
              /* best-effort cleanup of temp working directory */
            }
          };

          try {
            if (!existsSync(options.inputFile)) {
              reject(new Error(`Input file not found: ${options.inputFile}`));
              return;
            }

            try {
              if (!hasAudioStream(options.inputFile)) {
                reject(
                  new Error(
                    'This video has no audio track, so there is nothing to transcribe.',
                  ),
                );
                return;
              }
            } catch (error) {
              console.warn(
                'Failed to check for audio stream, proceeding anyway:',
                error,
              );
            }

            if (!existsSync(options.modelPath)) {
              reject(
                new Error(`Whisper model not found: ${options.modelPath}`),
              );
              return;
            }

            // Ensure output file path is absolute and in a user-accessible location
            let outputFilePath = options.outputFile;
            const isPackaged = app.isPackaged;

            // If output path is relative or not absolute, determine proper location
            if (!path.isAbsolute(outputFilePath)) {
              if (isPackaged) {
                // In packaged app: save to user's Documents folder or next to input file
                // Try to save next to input file first (if input is in user-accessible location)
                const inputDir = path.dirname(options.inputFile);
                const inputFileName = path.basename(
                  options.inputFile,
                  path.extname(options.inputFile),
                );
                const outputFileName =
                  path.basename(outputFilePath, path.extname(outputFilePath)) ||
                  inputFileName;

                // Check if input directory is writable (user-accessible)
                try {
                  const testPath = path.join(inputDir, '.test-write');
                  fs.writeFileSync(testPath, 'test');
                  fs.unlinkSync(testPath);
                  // Directory is writable, save next to input file
                  outputFilePath = path.join(
                    inputDir,
                    `${outputFileName}.${options.format || 'srt'}`,
                  );
                } catch {
                  // Directory not writable, use Documents folder
                  const documentsPath = app.getPath('documents');
                  outputFilePath = path.join(
                    documentsPath,
                    'Downlodr',
                    'Transcriptions',
                    `${outputFileName}.${options.format || 'srt'}`,
                  );
                  // Ensure directory exists
                  const outputDir = path.dirname(outputFilePath);
                  if (!existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                  }
                }
              } else {
                // In dev mode: save next to input file
                const inputDir = path.dirname(options.inputFile);
                const outputFileName =
                  path.basename(outputFilePath, path.extname(outputFilePath)) ||
                  path.basename(
                    options.inputFile,
                    path.extname(options.inputFile),
                  );
                outputFilePath = path.join(inputDir, `${outputFileName}.srt`);
              }
            }

            // Ensure model path is absolute
            let modelPath = options.modelPath;
            if (!path.isAbsolute(modelPath)) {
              // Try project root first (dev mode)
              const projectModelPath = path.join(process.cwd(), modelPath);
              if (existsSync(projectModelPath)) {
                modelPath = projectModelPath;
              } else if (isPackaged) {
                // In packaged app, first try bundled model from process.resourcesPath
                const bundledModel = getBundledBinaryPath(modelPath);
                if (bundledModel) {
                  modelPath = bundledModel;
                } else {
                  // If not found in bundle, check other possible locations
                  const possibleModelPaths = [];

                  // 2. Check app directory (where postPackage hook copies files)
                  const appPath = app.getAppPath();
                  possibleModelPaths.push(
                    path.join(path.dirname(appPath), modelPath),
                  );

                  // 3. Check process.resourcesPath parent
                  if (process.resourcesPath) {
                    const resourcesParent = path.dirname(process.resourcesPath);
                    possibleModelPaths.push(
                      path.join(resourcesParent, modelPath),
                    );
                  }

                  // 4. Check executable directory
                  const exeDir = path.dirname(process.execPath);
                  possibleModelPaths.push(path.join(exeDir, modelPath));

                  // Try each path
                  let found = false;
                  for (const possiblePath of possibleModelPaths) {
                    if (existsSync(possiblePath)) {
                      modelPath = possiblePath;
                      found = true;
                      break;
                    }
                  }

                  // If not found in app bundle, try next to input file
                  if (!found) {
                    const inputDir = path.dirname(options.inputFile);
                    const inputDirModelPath = path.join(inputDir, modelPath);
                    if (existsSync(inputDirModelPath)) {
                      modelPath = inputDirModelPath;
                    }
                  }
                }
              } else {
                // Try next to input file (dev mode)
                const inputDir = path.dirname(options.inputFile);
                const inputDirModelPath = path.join(inputDir, modelPath);
                if (existsSync(inputDirModelPath)) {
                  modelPath = inputDirModelPath;
                }
              }
            }

            // Verify model exists with absolute path
            if (!existsSync(modelPath)) {
              reject(
                new Error(
                  `Whisper model not found: ${modelPath}. Please ensure the model file exists.`,
                ),
              );
              return;
            }

            const language = options.language || 'auto';
            const format = options.format || 'srt';
            const workOutputName = `out.${format}`;

            // Stage the model and the resampled audio in a private working
            // directory under generated basenames, so the filtergraph below
            // contains no user-controlled text at all. See WHISPER_WORK_INPUT.
            workDir = createWhisperWorkDir();
            linkModelInto(workDir, modelPath);

            // Resample to 16kHz mono PCM before transcribing, matching the
            // known-good whisper.cpp CLI workflow rather than relying on the
            // whisper filter's implicit internal conversion.
            resampleTo16kMono(
              ffmpegPath,
              options.inputFile,
              path.join(workDir, WHISPER_WORK_INPUT),
            );

            // Stage the VAD weights alongside the model when they are present,
            // under a generated basename for the same filtergraph-escaping
            // reason. 864KB, so a plain copy is cheap enough.
            const vadModelPath = findVadModel();
            if (vadModelPath) {
              fs.copyFileSync(
                vadModelPath,
                path.join(workDir, WHISPER_WORK_VAD),
              );
            }

            // Every path here is a bare generated basename, resolved against
            // the process cwd set on spawn() below.
            const vadArgs = vadModelPath
              ? `:vad_model='${WHISPER_WORK_VAD}'`
              : '';
            const filterComplex = `[0:a]whisper=model='${WHISPER_WORK_MODEL}':language=${language}:queue=${WHISPER_QUEUE_SECONDS}${vadArgs}:destination='${workOutputName}':format=${format}`;

            // Build FFmpeg arguments
            const args = [
              '-i',
              WHISPER_WORK_INPUT,
              '-filter_complex',
              filterComplex,
              '-f',
              'null',
              '-',
            ];

            // cwd is what resolves the bare basenames in `args` and in the
            // filtergraph, keeping user-controlled paths out of both.
            const ffmpegProcess = spawn(ffmpegPath, args, {
              stdio: ['pipe', 'pipe', 'pipe'],
              cwd: workDir,
            });

            let stdout = '';
            let stderr = '';

            // Collect stdout
            ffmpegProcess.stdout.on('data', (data) => {
              stdout += data.toString();
              // Parse each line for progress information
              const lines = data.toString().split('\n');
              lines.forEach((line: string) => {
                if (line.trim()) {
                  parseLine(line);
                }
              });
            });

            ffmpegProcess.stderr.on('data', (data) => {
              const chunk = data.toString();
              stderr += chunk;
              // Parse each line for progress information
              const lines = chunk.split('\n');
              lines.forEach((line: string) => {
                if (line.trim()) {
                  parseLine(line);
                }
              });
            });

            // Handle process completion
            ffmpegProcess.on('close', (code) => {
              const producedPath = workDir
                ? path.join(workDir, workOutputName)
                : '';

              if (code === 0 && producedPath && existsSync(producedPath)) {
                try {
                  // FFmpeg writes plain UTF-8 with no BOM, which causes
                  // editors/viewers that don't auto-detect UTF-8 (e.g.
                  // Notepad) to misread non-ASCII transcripts as mojibake.
                  // Prepend a BOM so those tools recognize the encoding;
                  // readCaptionFile strips it back off before parsing.
                  const UTF8_BOM = '\uFEFF';
                  const contents = fs.readFileSync(producedPath, 'utf-8');
                  const withBom = contents.startsWith(UTF8_BOM)
                    ? contents
                    : UTF8_BOM + contents;

                  // Write to the real destination, which may contain any
                  // characters \u2014 unlike the filtergraph, this path is ours.
                  fs.mkdirSync(path.dirname(outputFilePath), {
                    recursive: true,
                  });
                  fs.writeFileSync(outputFilePath, withBom, 'utf-8');
                } catch (writeError) {
                  cleanupWorkDir();
                  reject(
                    new Error(
                      `Transcription succeeded but the transcript could not be written to ${outputFilePath}: ${
                        writeError instanceof Error
                          ? writeError.message
                          : String(writeError)
                      }`,
                    ),
                  );
                  return;
                }

                cleanupWorkDir();
                resolve({
                  success: true,
                  outputFile: outputFilePath,
                  stdout,
                  stderr,
                });
                return;
              }

              // Exiting 0 without producing a file means the filter silently
              // wrote nowhere \u2014 treat it as the failure it is rather than
              // reporting success for a transcript that does not exist.
              const tail = stderr.trim().split('\n').slice(-12).join('\n');
              let errorDetails: string;
              if (stderr.includes('No such filter')) {
                errorDetails =
                  'Whisper filter not found in FFmpeg build. Please install FFmpeg 8.0+ with Whisper support.';
              } else if (code === 0) {
                errorDetails = `FFmpeg reported success but wrote no transcript.\n\nFFmpeg output:\n${tail}`;
              } else {
                // Always surface the real stderr; guessing a cause from a
                // substring match previously reported a bad destination as a
                // missing model and sent debugging in the wrong direction.
                errorDetails = `FFmpeg output:\n${tail}`;
              }
              cleanupWorkDir();
              reject(
                new Error(
                  `FFmpeg process exited with code ${code}.\n${errorDetails}`,
                ),
              );
            });

            // Handle process errors
            ffmpegProcess.on('error', (error) => {
              cleanupWorkDir();
              reject(
                new Error(`Failed to start FFmpeg process: ${error.message}`),
              );
            });
          } catch (error) {
            cleanupWorkDir();
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            reject(new Error(`FFmpeg execution failed: ${errorMessage}`));
          }
        });
      })();
    },
  );
};
