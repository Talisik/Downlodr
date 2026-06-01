/**
 * Metadata service
 * Handles metadata extraction and processing for downloads
 */

import useDownloadStore from '@/downlodr/store/download/downloadStore';
import { FFmpegWhisperTranscriber } from '@/downlodr/utils/transcription/ffmpegWhisperTranscriber';
import { downloadEnglishCaptions } from './captionsHelper';

/**
 * Wait for a file to exist using adaptive polling
 * Uses longer intervals initially, then shorter intervals as download progresses
 * @param filePath Path to the file to wait for
 * @param options Polling options
 * @returns Promise<boolean> True if file exists, false if timeout reached
 */
async function waitForFile(
  filePath: string,
  options: {
    initialIntervalMs?: number;
    activeIntervalMs?: number;
    timeoutMs?: number;
  } = {},
): Promise<boolean> {
  const {
    initialIntervalMs = 5000, // Check every 5s initially (less frequent)
    activeIntervalMs = 2000, // Check every 2s when file is growing
    timeoutMs = 300000, // 5 minute timeout
  } = options;

  const startTime = Date.now();
  let lastFileSize = 0;
  let consecutiveNoChange = 0;
  let currentInterval = initialIntervalMs;

  // Quick initial check
  const initialExists = await window.downlodrFunctions.fileExists(filePath);
  if (initialExists) {
    return true;
  }

  while (Date.now() - startTime < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, currentInterval));

    const exists = await window.downlodrFunctions.fileExists(filePath);
    if (exists) {
      // File exists, but check if it's still growing (download in progress)
      try {
        const fileSize = await window.downlodrFunctions.getFileSize(filePath);
        if (fileSize !== null && fileSize > lastFileSize) {
          // File is growing, download in progress - use shorter interval
          lastFileSize = fileSize;
          consecutiveNoChange = 0;
          currentInterval = activeIntervalMs;
          continue; // Keep waiting for download to complete
        } else if (fileSize !== null && fileSize === lastFileSize) {
          // File size hasn't changed - might be complete
          consecutiveNoChange++;
          if (consecutiveNoChange >= 2) {
            // File exists and size is stable (likely complete)
            return true;
          }
        } else {
          // File exists, assume it's ready
          return true;
        }
      } catch {
        // If we can't get file size, assume file is ready if it exists
        return true;
      }
    } else {
      // File doesn't exist yet - reset tracking
      lastFileSize = 0;
      consecutiveNoChange = 0;
      currentInterval = initialIntervalMs;
    }
  }

  return false;
}

/**
 * Service for handling download metadata operations
 */
export class MetadataService {
  /**
   * Downloads English captions for a video
   * First attempts to download captions from yt-dlp, then falls back to FFmpeg Whisper transcription
   * @param videoInfo The video info object returned from ytdlp.getInfo
   * @param outputPath Path to save the captions file
   * @param fileName File name to save the captions file
   * @param videoFilePath Optional path to the downloaded video file (required for Whisper fallback)
   * @param downloadId Optional download ID to track transcription progress in the store
   * @param runAsync If true, transcription runs in background without blocking (default: false)
   * @returns Promise<string | undefined> Path to the downloaded/transcribed captions file or undefined if not available
   */
  static async downloadEnglishCaptions(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    videoInfo: any,
    outputPath: string,
    fileName: string,
    videoFilePath?: string,
    downloadId?: string,
    runAsync = false,
  ): Promise<string | undefined> {
    // First, try to download captions from yt-dlp
    const ytdlpCaptionsPath = await downloadEnglishCaptions(
      videoInfo,
      outputPath,
      fileName,
    );

    // If yt-dlp captions were successfully downloaded, update store and return the path
    if (ytdlpCaptionsPath) {
      console.log(
        'Successfully downloaded captions from yt-dlp:',
        ytdlpCaptionsPath,
      );

      // Update download store with caption location if downloadId is provided
      if (downloadId) {
        try {
          // Directly update the download store state
          useDownloadStore.setState((state) => ({
            downloading: state.downloading.map((d) => {
              if (d.id !== downloadId) return d;
              return {
                ...d,
                autoCaptionLocation: ytdlpCaptionsPath,
              };
            }),
          }));
        } catch (error) {
          console.error(
            'Error updating download store with yt-dlp caption path:',
            error,
          );
        }
      }

      return ytdlpCaptionsPath;
    }

    // If yt-dlp captions failed and we have a video file path, try FFmpeg Whisper transcription
    if (videoFilePath) {
      console.log(
        'yt-dlp captions not available, attempting FFmpeg Whisper transcription fallback...',
      );

      // Set transcription status to transcribing so UI can show progress immediately
      if (downloadId) {
        this.updateTranscriptionProgress(downloadId, 0, 'transcribing');
      }

      console.log('downloadId', downloadId);

      // If runAsync is true, start transcription in background and return immediately
      if (runAsync) {
        // Start transcription in background without blocking
        this.startTranscriptionAsync(
          videoFilePath,
          outputPath,
          fileName,
          downloadId,
        );
        return undefined; // Return immediately, transcription will update store when done
      }

      // Otherwise, run synchronously (original behavior)
      try {
        const result = await this.runTranscription(
          videoFilePath,
          outputPath,
          fileName,
          downloadId,
        );
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          'Error during Whisper transcription fallback:',
          errorMessage,
        );
        return undefined;
      }
    }

    // No captions available from either source
    console.log(
      'No captions available from yt-dlp and no video file provided for transcription',
    );
    return undefined;
  }

  /**
   * Start transcription asynchronously in the background
   * Updates download store with progress without blocking
   */
  private static async startTranscriptionAsync(
    videoFilePath: string,
    outputPath: string,
    fileName: string,
    downloadId?: string,
  ): Promise<void> {
    // Run transcription in background
    this.runTranscription(
      videoFilePath,
      outputPath,
      fileName,
      downloadId,
    ).catch((error) => {
      console.error('Background transcription failed:', error);
      if (downloadId) {
        this.updateTranscriptionProgress(downloadId, undefined, 'failed');
      }
    });
  }

  /**
   * Run transcription and update store with progress
   */
  private static async runTranscription(
    videoFilePath: string,
    outputPath: string,
    fileName: string,
    downloadId?: string,
  ): Promise<string | undefined> {
    try {
      // Generate output path for transcription early (similar to yt-dlp format)
      // This allows us to set the location in the store immediately
      const fileNameWithoutExt = fileName
        ? fileName.replace(/\.[^/.]+$/, '')
        : 'video';
      const sanitizedTitle = fileNameWithoutExt.replace(/[\\ñ'/:*?"<>|]/g, '_');
      const captionFileName = `${sanitizedTitle}.srt`;

      // Join with output path
      const transcriptionOutputPath =
        await window.downlodrFunctions.joinDownloadPath(
          outputPath,
          captionFileName,
        );

      // Mark transcription as in progress; do not set autoCaptionLocation until file exists
      if (downloadId) {
        this.updateTranscriptionProgress(downloadId, 0, 'transcribing');
      }

      // Wait for video file to exist (adaptive polling with timeout)
      console.log(`Waiting for video file to exist at: ${videoFilePath}...`);
      const videoExists = await waitForFile(videoFilePath, {
        initialIntervalMs: 5000, // Check every 5 seconds initially
        activeIntervalMs: 2000, // Check every 2 seconds when file is growing
        timeoutMs: 300000, // Wait up to 5 minutes
      });

      if (!videoExists) {
        console.warn(
          `Video file not found at ${videoFilePath} after waiting, skipping Whisper transcription`,
        );
        if (downloadId) {
          this.updateTranscriptionProgress(downloadId, undefined, 'failed');
        }
        return undefined;
      }

      console.log(
        `Video file found at ${videoFilePath}, proceeding with transcription...`,
      );

      // Set up progress listener to capture transcription progress
      // Note: FFmpegWhisperTranscriber also sets up a listener, but we need to
      // capture progress for the download store. We'll use a wrapper approach.
      let progressCleanup: (() => void) | null = null;
      let lastReportedProgress = 0;

      if (downloadId && window.downlodrFunctions.onFFmpegProgress) {
        // Wrap the existing progress handler to also update download store
        progressCleanup = window.downlodrFunctions.onFFmpegProgress(
          (progress: string) => {
            try {
              const parsed = JSON.parse(progress);
              if (
                parsed.type === 'progress' &&
                parsed.percent != null &&
                downloadId
              ) {
                const percent = parseFloat(parsed.percent);
                // Update on 0% (stream start) or when progress increased by >1% (avoid spam)
                const shouldUpdate =
                  percent === 0 || percent > lastReportedProgress + 1;
                if (shouldUpdate) {
                  lastReportedProgress = percent;
                  this.updateTranscriptionProgress(
                    downloadId,
                    percent,
                    'transcribing',
                  );
                }
              }
            } catch {
              // Try to extract progress from raw string
              if (downloadId) {
                const percentMatch = progress.match(/(\d+(?:\.\d+)?)%/);
                if (percentMatch) {
                  const percent = parseFloat(percentMatch[1]);
                  const shouldUpdate =
                    percent === 0 || percent > lastReportedProgress + 1;
                  if (shouldUpdate) {
                    lastReportedProgress = percent;
                    this.updateTranscriptionProgress(
                      downloadId,
                      percent,
                      'transcribing',
                    );
                  }
                }
              }
            }
          },
        );
      }

      // Transcribe using FFmpeg Whisper
      const transcriptionResult = await FFmpegWhisperTranscriber.transcribe({
        inputFile: videoFilePath,
        outputFile: transcriptionOutputPath,
        language: 'en',
        format: 'srt',
      });

      // Clean up progress listener
      if (progressCleanup) {
        progressCleanup();
      }

      if (transcriptionResult.success && transcriptionResult.outputFile) {
        console.log(
          'Successfully transcribed video using FFmpeg Whisper:',
          transcriptionResult.outputFile,
        );

        // Update store with success and caption location
        if (downloadId) {
          this.updateTranscriptionProgress(
            downloadId,
            100,
            'completed',
            transcriptionResult.outputFile,
          );
        }

        return transcriptionResult.outputFile;
      } else {
        console.error(
          'FFmpeg Whisper transcription failed:',
          transcriptionResult.error,
        );
        if (downloadId) {
          this.updateTranscriptionProgress(downloadId, undefined, 'failed');
        }
        return undefined;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('Error during Whisper transcription:', errorMessage);
      if (downloadId) {
        this.updateTranscriptionProgress(downloadId, undefined, 'failed');
      }
      return undefined;
    }
  }

  /**
   * Update download store with transcription progress
   * Updates both downloading and finished/history downloads to handle cases
   * where transcription completes after download has finished
   */
  private static updateTranscriptionProgress(
    downloadId: string,
    progress: number | undefined,
    status: 'transcribing' | 'completed' | 'failed',
    captionPath?: string,
  ): void {
    try {
      // Directly update the download store state
      useDownloadStore.setState((state) => {
        // Helper function to create log message
        const createLogMessage = () => {
          if (status === 'transcribing' && progress !== undefined) {
            return `[Transcription] ${progress.toFixed(1)}%`;
          } else if (status === 'completed') {
            return '[Transcription] Complete';
          } else if (status === 'failed') {
            return '[Transcription] Failed';
          }
          return '';
        };

        const logMessage = createLogMessage();

        return {
          // Update downloading array
          downloading: state.downloading.map((d) => {
            if (d.id !== downloadId) return d;

            const updates: Partial<typeof d> = {};

            updates.transcriptionStatus = status;
            if (progress !== undefined) {
              updates.transcriptionProgress = progress;
            }

            if (captionPath) {
              console.log(
                'Updating caption location in downloading:',
                captionPath,
              );
              console.log('Download ID:', downloadId);
              updates.autoCaptionLocation = captionPath;
            }

            if (logMessage) {
              const currentLog = d.log || '';
              updates.log = currentLog
                ? `${currentLog}\n${logMessage}`
                : logMessage;
            }

            return { ...d, ...updates };
          }),

          // Update finished downloads array (for downloads that finished before transcription completed)
          finishedDownloads: state.finishedDownloads.map((d) => {
            if (d.id !== downloadId) return d;

            const updates: Partial<typeof d> = {};
            updates.transcriptionStatus = status;
            if (progress !== undefined) {
              updates.transcriptionProgress = progress;
            }

            if (captionPath) {
              console.log(
                'Updating transcript location in finishedDownloads:',
                captionPath,
              );
              console.log('Download ID:', downloadId);
              updates.transcriptLocation = captionPath;
            }

            // Add transcription progress to log
            if (logMessage) {
              const currentLog = d.log || '';
              updates.log = currentLog
                ? `${currentLog}\n${logMessage}`
                : logMessage;
            }

            return { ...d, ...updates };
          }),

          // Update history downloads array (for downloads that are in history)
          historyDownloads: state.historyDownloads.map((d) => {
            if (d.id !== downloadId) return d;

            const updates: Partial<typeof d> = {};
            updates.transcriptionStatus = status;
            if (progress !== undefined) {
              updates.transcriptionProgress = progress;
            }

            if (captionPath) {
              console.log(
                'Updating transcript location in historyDownloads:',
                captionPath,
              );
              console.log('Download ID:', downloadId);
              updates.transcriptLocation = captionPath;
            }

            // Add transcription progress to log
            if (logMessage) {
              const currentLog = d.log || '';
              updates.log = currentLog
                ? `${currentLog}\n${logMessage}`
                : logMessage;
            }

            return { ...d, ...updates };
          }),
        };
      });
    } catch (error) {
      console.error('Error updating transcription progress:', error);
    }
  }

  // Additional metadata operations can be added here
  // e.g., extractThumbnails, getVideoInfo, etc.
}
