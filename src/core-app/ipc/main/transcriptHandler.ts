/* Handler for developer tools of base app such as opening dev tools, etc. */
/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

import { execFileSync, execSync } from 'child_process';
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

function getDurationMs(filePath: string): number {
  // Note: ffprobe.exe is not bundled, using system PATH
  // If you need bundled ffprobe, add './ffprobe.exe' to extraResource in forge.config.ts
  const output = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
  );
  return Math.floor(parseFloat(output.toString().trim()) * 1000);
}

/**
 * Whisper models are trained on 16kHz mono PCM audio. The whisper filter will
 * resample internally if fed something else, but that internal conversion is
 * opaque and has been observed to produce worse transcriptions than an
 * explicit pre-conversion pass (matches the whisper.cpp CLI workflow, which
 * always runs `ffmpeg -ar 16000 -ac 1 -c:a pcm_s16le` before transcribing).
 */
function resampleTo16kMono(ffmpegPath: string, inputFile: string): string {
  const tempFilePath = path.join(
    os.tmpdir(),
    `downlodr-whisper-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.wav`,
  );

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
    tempFilePath,
  ]);

  return tempFilePath;
}

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

  function getDurationMs(filePath: string): number {
    // Note: ffprobe.exe is not bundled, using system PATH
    // If you need bundled ffprobe, add './ffprobe.exe' to extraResource in forge.config.ts
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
    );
    return Math.floor(parseFloat(output.toString().trim()) * 1000);
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

          // Send total duration to renderer once at the start
          if (totalDurationMs > 0) {
            event.sender.send(
              'ffmpeg:progress',
              JSON.stringify({
                type: 'duration',
                totalDurationMs,
              }),
            );
          }

          // Function to parse progress from FFmpeg output
          function parseLine(line: string): void {
            const match = line.match(/run transcription at (\d+) ms/);
            if (match && totalDurationMs > 0) {
              const currentMs = parseInt(match[1], 10);
              let percent = (currentMs / totalDurationMs) * 100;
              if (percent > 100) percent = 100;
              process.stdout.write(`\rProgress: ${percent.toFixed(2)}%`);

              // Send structured progress data to renderer
              event.sender.send(
                'ffmpeg:progress',
                JSON.stringify({
                  type: 'progress',
                  currentMs,
                  totalDurationMs,
                  percent: percent.toFixed(2),
                  raw: line.trim(),
                }),
              );
            } else if (match) {
              // If we don't have total duration, just send the raw line
              event.sender.send('ffmpeg:progress', line);
            }
          }

          let resampledInputPath: string | undefined;

          try {
            if (!existsSync(options.inputFile)) {
              reject(new Error(`Input file not found: ${options.inputFile}`));
              return;
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

            // Build the filter - use absolute paths
            const language = options.language || 'auto';
            const format = options.format || 'srt';

            // Normalize paths for FFmpeg filter syntax on Windows
            // Convert backslashes to forward slashes
            let normalizedModelPath = modelPath.replace(/\\/g, '/');
            let normalizedOutputPath = outputFilePath.replace(/\\/g, '/');

            // Escape the colon in drive letters (C: becomes C\:)
            // Then wrap in single quotes for FFmpeg filter syntax
            normalizedModelPath = normalizedModelPath.replace(
              /^([A-Za-z]):/,
              '$1\\:',
            );
            normalizedOutputPath = normalizedOutputPath.replace(
              /^([A-Za-z]):/,
              '$1\\:',
            );

            // Build filter complex - use single quotes with escaped colon, forward slashes
            const filterComplex = `[0:a]whisper=model='${normalizedModelPath}':language=${language}:queue=30:destination='${normalizedOutputPath}':format=${format}`;

            // Resample to 16kHz mono PCM before transcribing, matching the
            // known-good whisper.cpp CLI workflow rather than relying on the
            // whisper filter's implicit internal conversion.
            resampledInputPath = resampleTo16kMono(
              ffmpegPath,
              options.inputFile,
            );

            // Build FFmpeg arguments
            const args = [
              '-i',
              resampledInputPath,
              '-filter_complex',
              filterComplex,
              '-f',
              'null',
              '-',
            ];

            // Spawn the FFmpeg process
            const ffmpegProcess = spawn(ffmpegPath, args, {
              stdio: ['pipe', 'pipe', 'pipe'],
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
              if (resampledInputPath && existsSync(resampledInputPath)) {
                fs.unlink(resampledInputPath, () => {
                  /* best-effort cleanup of temp resampled audio */
                });
              }
              if (code === 0) {
                // FFmpeg's whisper filter writes plain UTF-8 with no BOM, which
                // causes editors/viewers that don't auto-detect UTF-8 (e.g.
                // Notepad) to misread non-ASCII transcripts as mojibake. Prepend
                // a BOM so those tools recognize the encoding; readCaptionFile
                // strips it back off before parsing.
                try {
                  const UTF8_BOM = '\uFEFF';
                  const contents = fs.readFileSync(outputFilePath, 'utf-8');
                  if (!contents.startsWith(UTF8_BOM)) {
                    fs.writeFileSync(
                      outputFilePath,
                      UTF8_BOM + contents,
                      'utf-8',
                    );
                  }
                } catch (bomError) {
                  console.error(
                    'Failed to add UTF-8 BOM to transcript file:',
                    bomError,
                  );
                }
                resolve({
                  success: true,
                  outputFile: outputFilePath,
                  stdout,
                  stderr,
                });
              } else {
                // Extract more detailed error information from stderr
                let errorDetails = stderr;

                // Look for specific error patterns
                if (stderr.includes('No such filter')) {
                  errorDetails =
                    'Whisper filter not found in FFmpeg build. Please install FFmpeg 8.0+ with Whisper support.';
                } else if (
                  stderr.includes('No such file') ||
                  stderr.includes('not found')
                ) {
                  errorDetails = `File not found. Check model path: ${modelPath}`;
                } else if (stderr.includes('Invalid argument')) {
                  errorDetails = `Invalid argument. Check paths:\nModel: ${modelPath}\nOutput: ${outputFilePath}\n\nFFmpeg error: ${stderr.substring(
                    0,
                    500,
                  )}`;
                } else if (stderr.includes('Permission denied')) {
                  errorDetails = `Permission denied. Check write permissions for output: ${outputFilePath}`;
                }
                reject(
                  new Error(
                    `FFmpeg process exited with code ${code}.\n${errorDetails}`,
                  ),
                );
              }
            });

            // Handle process errors
            ffmpegProcess.on('error', (error) => {
              if (resampledInputPath && existsSync(resampledInputPath)) {
                fs.unlink(resampledInputPath, () => {
                  /* best-effort cleanup of temp resampled audio */
                });
              }
              reject(
                new Error(`Failed to start FFmpeg process: ${error.message}`),
              );
            });
          } catch (error) {
            if (resampledInputPath && existsSync(resampledInputPath)) {
              fs.unlink(resampledInputPath, () => {
                /* best-effort cleanup of temp resampled audio */
              });
            }
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            reject(new Error(`FFmpeg execution failed: ${errorMessage}`));
          }
        });
      })();
    },
  );
};
