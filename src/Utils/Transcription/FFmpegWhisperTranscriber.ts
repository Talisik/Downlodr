/**
 * FFmpeg Whisper Transcription Utility
 *
 * Provides a user-friendly interface for transcribing audio files using FFmpeg's Whisper filter.
 * This utility wraps the existing FFmpeg Whisper implementation with enhanced error handling,
 * validation, and convenience methods.
 */

import { toast } from '@/Components/SubComponents/shadcn/hooks/use-toast';

interface WhisperUIHandlers {
  onStart?: (msg: string) => void;
  onProgress?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

export interface WhisperTranscriptionOptions {
  /** Path to the input audio file */
  inputFile: string;
  /** Path where the transcription file will be saved */
  outputFile?: string;
  /** Path to the Whisper model file (defaults to ggml-base.bin in project root) */
  modelPath?: string;
  /** Language code for transcription (e.g., 'en', 'tl', 'es') */
  language?: string;
  /** Output format ('srt', 'vtt', 'txt') */
  format?: 'srt' | 'vtt' | 'txt';
  /** Progress callback function (currently not supported due to IPC limitations) */
  onProgress?: (progress: string) => void;
}

export interface RedownloadTranscriptionOptions {
  inputFile: string;
  outputFile: string;
  modelPath: string;
  language: string;
  format: 'srt' | 'vtt' | 'txt';
}

export interface WhisperTranscriptionResult {
  success: boolean;
  outputFile: string;
  duration?: number;
  error?: string;
  stdout?: string;
  stderr?: string;
}

export class FFmpegWhisperTranscriber {
  private static readonly DEFAULT_MODEL_NAME = 'ggml-base.bin';
  private static readonly SUPPORTED_FORMATS = ['srt', 'vtt', 'txt'] as const;
  private static readonly SUPPORTED_AUDIO_EXTENSIONS = [
    '.mp3',
    '.wav',
    '.m4a',
    '.aac',
    '.ogg',
    '.flac',
    '.wma',
    '.mp4',
    '.mkv',
    '.avi',
  ];

  /**
   * Select a video/audio file and transcribe it
   * Opens a file picker dialog for the user to select a file
   */
  static async redownloadTranscript(
    options: RedownloadTranscriptionOptions,
  ): Promise<WhisperTranscriptionResult> {
    try {
      // Open file picker dialog
      if (!options.inputFile) {
        return {
          success: false,
          outputFile: '',
          error: 'No file selected',
        };
      }

      console.log('Selected file:', options);
      console.log('Options:', options);

      // Transcribe the selected file
      const result = await FFmpegWhisperTranscriber.transcribe({
        ...options,
        inputFile: options.inputFile,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('Error in selectAndTranscribe:', error);

      toast({
        title: 'Transcription Error',
        description: errorMessage,
        variant: 'destructive',
        duration: 7000,
      });

      return {
        success: false,
        outputFile: '',
        error: errorMessage,
      };
    }
  }

  /**
   * Select a video/audio file and transcribe it
   * Opens a file picker dialog for the user to select a file
   */
  static async selectAndTranscribe(
    options: Omit<WhisperTranscriptionOptions, 'inputFile'> = {},
  ): Promise<WhisperTranscriptionResult> {
    try {
      // Open file picker dialog
      const selectedFile = await window.downlodrFunctions.selectVideoFile();

      if (!selectedFile) {
        toast({
          title: 'No File Selected',
          description: 'Please select a video or audio file to transcribe.',
          variant: 'destructive',
          duration: 3000,
        });
        return {
          success: false,
          outputFile: '',
          error: 'No file selected',
        };
      }

      console.log('Selected file:', selectedFile);
      console.log('Options:', options);

      // Transcribe the selected file
      const result = await FFmpegWhisperTranscriber.transcribe({
        ...options,
        inputFile: selectedFile,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('Error in selectAndTranscribe:', error);

      toast({
        title: 'Transcription Error',
        description: errorMessage,
        variant: 'destructive',
        duration: 7000,
      });

      return {
        success: false,
        outputFile: '',
        error: errorMessage,
      };
    }
  }

  /**
   * Transcribe an audio file using FFmpeg Whisper
   */
  static async transcribe(
    options: WhisperTranscriptionOptions,
    ui?: WhisperUIHandlers,
  ): Promise<WhisperTranscriptionResult> {
    const startTime = Date.now();
    let progressCleanup: (() => void) | null = null;
    const initialToast: ReturnType<typeof toast> | null = null;
    let totalDurationMs: number | null = null;

    try {
      console.log('Starting transcription with options:', options);

      // Show initial toast immediately (before validation to give user feedback)
      const inputFileName = this.getFileName(options.inputFile);
      ui?.onStart?.(`Preparing to transcribe "${inputFileName}"...`);
      // progressToastId = initialToast.id;

      // Validate and prepare options
      console.log('Validating options...');
      let validatedOptions;
      try {
        validatedOptions = await this.validateAndPrepareOptions(options);
        console.log('Validation successful:', validatedOptions);
      } catch (validationError) {
        console.error('Validation failed:', validationError);
        const errorMessage =
          validationError instanceof Error
            ? validationError.message
            : String(validationError);

        ui?.onProgress?.(errorMessage);

        throw validationError;
      }

      // Update toast with validated information
      const outputFileName = this.getFileName(validatedOptions.outputFile);
      ui?.onProgress?.(
        `Transcribing "${inputFileName}"...\nWill save to: ${outputFileName}`,
      );

      // Set up progress listener
      if (window.downlodrFunctions.onFFmpegProgress) {
        let lastProgressUpdate = Date.now();
        progressCleanup = window.downlodrFunctions.onFFmpegProgress(
          (progress: string) => {
            // Try to parse as structured progress data (JSON)
            try {
              const parsed = JSON.parse(progress);

              if (parsed.type === 'duration') {
                // Store total duration when received
                totalDurationMs = parsed.totalDurationMs;
                console.log(`Received total duration: ${totalDurationMs}ms`);
                return;
              }

              if (parsed.type === 'progress') {
                // Use structured progress data
                const percent = parseFloat(parsed.percent);
                const currentMs = parsed.currentMs;
                const totalMs = parsed.totalDurationMs || totalDurationMs;

                // Update total duration if provided
                if (parsed.totalDurationMs) {
                  totalDurationMs = parsed.totalDurationMs;
                }

                // Throttle progress updates to avoid too many toast updates
                const now = Date.now();
                if (now - lastProgressUpdate > 1000) {
                  const progressInfo = this.formatProgressInfo(
                    percent,
                    currentMs,
                    totalMs,
                  );

                  if (progressInfo && initialToast) {
                    ui?.onProgress?.(progressInfo);
                    lastProgressUpdate = now;
                  }
                }
                return;
              }
            } catch {
              // Not JSON, treat as raw progress line (backward compatibility)
            }

            // Fallback: Extract useful progress information from raw FFmpeg output
            const progressInfo = this.extractProgressInfo(
              progress,
              totalDurationMs,
            );
            if (progressInfo) {
              // Throttle progress updates to avoid too many toast updates
              const now = Date.now();
              if (now - lastProgressUpdate > 2000) {
                ui?.onProgress?.(progressInfo);
                lastProgressUpdate = now;
              }
            }
          },
        );
      }

      // Execute FFmpeg transcription
      const result = await window.downlodrFunctions.ffmpegWhisperTranscribe(
        validatedOptions,
      );

      // Clean up progress listener
      if (progressCleanup) {
        progressCleanup();
      }

      const duration = Date.now() - startTime;
      const finalOutputFile = result.outputFile || validatedOptions.outputFile;
      const finalOutputFileName = this.getFileName(finalOutputFile);

      // Show success toast
      ui?.onSuccess?.(
        `Saved to: ${finalOutputFileName}\nDuration: ${(
          duration / 1000
        ).toFixed(1)}s`,
      );

      return {
        success: true,
        outputFile: finalOutputFile,
        duration,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (error) {
      // Clean up progress listener
      if (progressCleanup) {
        progressCleanup();
      }

      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Show error toast
      ui?.onError?.(errorMessage);

      return {
        success: false,
        outputFile: options.outputFile || '',
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Format progress information for display
   */
  private static formatProgressInfo(
    percent: number,
    currentMs: number,
    totalMs: number | null,
  ): string {
    if (totalMs && totalMs > 0) {
      const currentTime = this.formatTime(currentMs);
      const totalTime = this.formatTime(totalMs);
      return `Progress: ${percent.toFixed(1)}% (${currentTime} / ${totalTime})`;
    } else {
      return `Progress: ${percent.toFixed(1)}%`;
    }
  }

  /**
   * Format milliseconds to readable time string (HH:MM:SS)
   */
  private static formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Extract useful progress information from FFmpeg output
   * Now supports the new "run transcription at X ms" format
   */
  private static extractProgressInfo(
    progress: string,
    totalDurationMs: number | null = null,
  ): string | null {
    // Look for the new Whisper transcription progress format
    const transcriptionMatch = progress.match(/run transcription at (\d+) ms/);
    if (transcriptionMatch && totalDurationMs && totalDurationMs > 0) {
      const currentMs = parseInt(transcriptionMatch[1], 10);
      const percent = (currentMs / totalDurationMs) * 100;
      const clampedPercent = Math.min(percent, 100);
      return this.formatProgressInfo(
        clampedPercent,
        currentMs,
        totalDurationMs,
      );
    }

    // Look for time information (e.g., "time=00:01:23.45")
    const timeMatch = progress.match(/time=(\d+):(\d+):(\d+\.\d+)/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = parseFloat(timeMatch[3]);
      return `Processing... ${hours}:${minutes
        .toString()
        .padStart(2, '0')}:${seconds.toFixed(1).padStart(5, '0')}`;
    }

    // Look for frame information
    const frameMatch = progress.match(/frame=\s*(\d+)/);
    if (frameMatch) {
      return `Processing frame ${frameMatch[1]}...`;
    }

    // Look for any percentage indicators
    const percentMatch = progress.match(/(\d+(?:\.\d+)?)%/);
    if (percentMatch) {
      return `Processing... ${percentMatch[1]}%`;
    }

    // Return null if no useful progress info found
    return null;
  }

  /**
   * Get just the filename from a full path
   */
  private static getFileName(filePath: string): string {
    const lastSlash = Math.max(
      filePath.lastIndexOf('/'),
      filePath.lastIndexOf('\\'),
    );
    return lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;
  }

  /**
   * Convenience method to transcribe with automatic output file naming
   */
  static async transcribeAuto(
    inputFile: string,
    options: Omit<WhisperTranscriptionOptions, 'inputFile' | 'outputFile'> = {},
  ): Promise<WhisperTranscriptionResult> {
    const outputFile = this.generateOutputFileName(
      inputFile,
      options.format || 'srt',
    );

    return this.transcribe({
      ...options,
      inputFile,
      outputFile,
    });
  }

  /**
   * Get the proper model path for the current environment
   * In packaged app: uses bundled model from process.resourcesPath
   * In development: uses model from project root
   */
  private static async getModelPath(providedPath?: string): Promise<string> {
    if (providedPath) {
      return providedPath;
    }

    // Try to get bundled model path first (works in packaged app)
    try {
      const bundledModelPath =
        await window.downlodrFunctions.getBundledBinaryPath(
          this.DEFAULT_MODEL_NAME,
        );
      if (bundledModelPath) {
        console.log(`Using bundled model: ${bundledModelPath}`);
        return bundledModelPath;
      }
    } catch (error) {
      console.warn('Could not get bundled model path:', error);
    }

    // Fallback to default model name (for development or if bundled not found)
    console.log(
      `Falling back to default model name: ${this.DEFAULT_MODEL_NAME}`,
    );
    return this.DEFAULT_MODEL_NAME;
  }

  /**
   * Validate and prepare transcription options
   */
  private static async validateAndPrepareOptions(
    options: WhisperTranscriptionOptions,
  ): Promise<Required<Omit<WhisperTranscriptionOptions, 'onProgress'>>> {
    // Validate input file
    if (!options.inputFile) {
      throw new Error('Input file path is required');
    }

    // Check if input file exists
    const inputExists = await window.downlodrFunctions.fileExists(
      options.inputFile,
    );
    if (!inputExists) {
      throw new Error(`Input file not found: ${options.inputFile}`);
    }

    // Validate file extension
    const inputExt = this.getFileExtension(options.inputFile).toLowerCase();
    if (!this.SUPPORTED_AUDIO_EXTENSIONS.includes(inputExt)) {
      console.warn(
        `Warning: ${inputExt} may not be supported. Supported formats: ${this.SUPPORTED_AUDIO_EXTENSIONS.join(
          ', ',
        )}`,
      );
    }

    // Set default output file if not provided
    const outputFile =
      options.outputFile ||
      this.generateOutputFileName(options.inputFile, options.format || 'srt');

    // Get proper model path for current environment
    const modelPath = await this.getModelPath(options.modelPath);
    console.log(`Checking for model at: ${modelPath}`);

    // Check if model file exists
    const modelExists = await window.downlodrFunctions.fileExists(modelPath);
    console.log(`Model exists check result: ${modelExists}`);

    if (!modelExists) {
      const errorMsg = `Whisper model not found: ${modelPath}. Please ensure the model file exists in the project root or specify the full path.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    console.log(`Model found at: ${modelPath}`);

    // Validate format
    const format = (options.format ||
      'srt') as (typeof this.SUPPORTED_FORMATS)[number];
    if (!this.SUPPORTED_FORMATS.includes(format)) {
      throw new Error(
        `Unsupported format: ${format}. Supported formats: ${this.SUPPORTED_FORMATS.join(
          ', ',
        )}`,
      );
    }

    // Set default language
    const language = options.language || 'en';

    return {
      inputFile: options.inputFile,
      outputFile,
      modelPath,
      language,
      format,
    };
  }

  /**
   * Generate output file name based on input file and format
   */
  private static generateOutputFileName(
    inputFile: string,
    format: string,
  ): string {
    const lastDotIndex = inputFile.lastIndexOf('.');
    const lastSlashIndex = Math.max(
      inputFile.lastIndexOf('/'),
      inputFile.lastIndexOf('\\'),
    );

    if (lastDotIndex > lastSlashIndex && lastDotIndex !== -1) {
      // File has extension
      const nameWithoutExt = inputFile.substring(0, lastDotIndex);
      return `${nameWithoutExt}.${format}`;
    } else {
      // File has no extension
      return `${inputFile}.${format}`;
    }
  }

  /**
   * Get file extension from file path (browser-compatible)
   */
  private static getFileExtension(filePath: string): string {
    const lastDotIndex = filePath.lastIndexOf('.');
    const lastSlashIndex = Math.max(
      filePath.lastIndexOf('/'),
      filePath.lastIndexOf('\\'),
    );

    if (lastDotIndex > lastSlashIndex && lastDotIndex !== -1) {
      return filePath.substring(lastDotIndex);
    }
    return '';
  }

  /**
   * Get supported audio file extensions
   */
  static getSupportedExtensions(): string[] {
    return [...this.SUPPORTED_AUDIO_EXTENSIONS];
  }

  /**
   * Get supported output formats
   */
  static getSupportedFormats(): string[] {
    return [...this.SUPPORTED_FORMATS];
  }

  /**
   * Check if FFmpeg with Whisper support is available
   */
  static async checkFFmpegAvailability(): Promise<{
    available: boolean;
    error?: string;
  }> {
    try {
      // Get proper model path for current environment
      const modelPath = await this.getModelPath();

      // Try to run a simple FFmpeg command to check availability
      await window.downlodrFunctions.ffmpegWhisperTranscribe({
        inputFile: 'non-existent-file.mp3', // This will fail, but we can check the error type
        outputFile: 'test.srt',
        modelPath: modelPath,
        language: 'en',
        format: 'srt',
      });

      return { available: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // If the error is about missing input file, FFmpeg is available
      if (errorMessage.includes('Input file not found')) {
        return { available: true };
      }

      // If the error is about FFmpeg not being found, it's not available
      if (
        errorMessage.includes('Failed to start FFmpeg') ||
        errorMessage.includes('command not found') ||
        errorMessage.includes('is not recognized')
      ) {
        return {
          available: false,
          error:
            'FFmpeg not found. Please ensure FFmpeg with Whisper support is installed and available in PATH.',
        };
      }

      return {
        available: false,
        error: `FFmpeg availability check failed: ${errorMessage}`,
      };
    }
  }
}

// Export convenience functions for direct use
export const redownloadTranscript =
  FFmpegWhisperTranscriber.redownloadTranscript;
export const transcribeAudio = FFmpegWhisperTranscriber.transcribe;
export const transcribeAudioAuto = FFmpegWhisperTranscriber.transcribeAuto;
export const selectAndTranscribe = FFmpegWhisperTranscriber.selectAndTranscribe;
export const checkFFmpegAvailability =
  FFmpegWhisperTranscriber.checkFFmpegAvailability;
