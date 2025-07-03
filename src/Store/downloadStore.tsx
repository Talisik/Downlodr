/**
 * Zustand store for managing downloads in the application.
 * It provides functionalities to track the state of downloads, including those
 * that are currently downloading, finished, or in history. The store also allows
 * for managing tags and categories associated with downloads.
 *
 * CLEANED UP TWO-PHASE DOWNLOAD SYSTEM:
 *
 * The download process now follows a clear, reliable flow:
 *
 * 1. QUEUE MANAGEMENT:
 *    - Downloads are queued and processed by the DownloadController
 *    - Respects maxDownloadNum setting for concurrent downloads
 *    - Uses Token Bucket algorithm for rate limiting
 *
 * 2. PHASE 1 - VIDEO DOWNLOAD (0-50%):
 *    - downloadPhase: 'video'
 *    - rawProgress: 0-100% (actual engine progress)
 *    - progress: 0-50% (display progress)
 *    - When rawProgress reaches 100%, completionCount increases to 1
 *    - Switches to audio phase
 *
 * 3. PHASE 2 - AUDIO DOWNLOAD (51-100%):
 *    - downloadPhase: 'audio'
 *    - rawProgress: 0-100% (actual engine progress for audio)
 *    - progress: 51-100% (display progress)
 *    - When rawProgress reaches 100%, completionCount increases to 2
 *    - Status changes to 'initializing' (waiting for merger)
 *
 * 4. PHASE 3 - MERGING & PROCESSING:
 *    - status: 'initializing'
 *    - progress: 100%
 *    - Detected via log messages: "[Merger]" or "Merging formats"
 *    - Followed by "[VideoRemuxer]" messages
 *    - No progress updates during this phase
 *
 * 5. COMPLETION:
 *    - Detected via log message: "Process 'id' exited with code: X"
 *    - Exit code 0 = success (status: 'finished')
 *    - Exit code != 0 = failure (status: 'failed')
 *    - Moved to finishedDownloads and historyDownloads
 *    - Queue processing continues
 *
 * KEY IMPROVEMENTS:
 * - Reliable completion detection through log parsing
 * - Simplified progress tracking logic
 * - Better error handling and status management
 * - Cleaner phase transitions
 * - More robust queue processing
 *
 * Dependencies:
 * - Zustand: A small, fast state-management solution.
 * - Zustand middleware for persistence.
 * - VideoFormatService: A service for processing video formats.
 * - Toast: A notification system for user feedback.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { toast } from '../Components/SubComponents/shadcn/hooks/use-toast';
import { downloadEnglishCaptions } from '../DataFunctions/captionsHelper';
import { VideoFormatService } from '../DataFunctions/GetDownloadMetaData';
import { useMainStore } from './mainStore'; // Add this import

// give unique id to downloads
function uuidv4() {
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (
      +c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
    ).toString(16),
  );
}

// Download Controller - implements Token Bucket Algorithm for rate limiting
class DownloadController {
  private static instance: DownloadController;
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | undefined;
  private stalledCheckInterval: NodeJS.Timeout | undefined;

  static getInstance(): DownloadController {
    if (!DownloadController.instance) {
      DownloadController.instance = new DownloadController();
    }
    return DownloadController.instance;
  }

  // Start the download worker if not already running
  startWorker() {
    if (this.processingInterval) return; // Already running

    console.log('DownloadController: Starting worker');
    this.processingInterval = setInterval(() => {
      this.processNextDownload();
    }, 500); // Check every 500ms for smoother processing

    // Also start the stalled download checker
    this.startStalledChecker();
  }

  // Start the stalled download checker
  startStalledChecker() {
    if (this.stalledCheckInterval) return; // Already running

    console.log('DownloadController: Starting stalled download checker');
    this.stalledCheckInterval = setInterval(() => {
      useDownloadStore.getState().checkStalledDownloads();
    }, 30000); // Check every 30 seconds
  }

  // Stop the download worker
  stopWorker() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
      console.log('DownloadController: Worker stopped');
    }

    // Don't stop the stalled checker when stopping the worker
    // It should continue running to catch any remaining stalled downloads
  }

  // Stop the stalled checker
  stopStalledChecker() {
    if (this.stalledCheckInterval) {
      clearInterval(this.stalledCheckInterval);
      this.stalledCheckInterval = undefined;
      console.log('DownloadController: Stalled checker stopped');
    }
  }

  // Process one download at a time (Worker Pattern)
  private async processNextDownload() {
    if (this.isProcessing) return; // Prevent concurrent processing

    const store = useDownloadStore.getState();
    const { queuedDownloads, downloading } = store;

    // Get current settings
    const maxConcurrentDownloads =
      useMainStore.getState().settings.maxDownloadNum;
    const currentActiveDownloads = downloading.filter(
      (d) => d.status === 'downloading' || d.status === 'initializing',
    ).length;

    // Token Bucket Algorithm: Check if we have available "tokens" (slots)
    const availableTokens = maxConcurrentDownloads - currentActiveDownloads;

    if (availableTokens <= 0) {
      // No tokens available, wait for next cycle
      return;
    }

    if (queuedDownloads.length === 0) {
      // No work to do, stop worker to save resources
      this.stopWorker();
      return;
    }

    // Get the next download from queue (FIFO)
    const nextDownload = queuedDownloads[0];

    this.isProcessing = true;

    try {
      // Atomic operation: Remove from queue and start download
      useDownloadStore.setState((state) => ({
        queuedDownloads: state.queuedDownloads.filter(
          (q) => q.id !== nextDownload.id,
        ),
      }));

      // Start the download using the original addDownload logic
      await this.startDownloadDirectly(nextDownload);

      toast({
        title: 'Download Started from Queue',
        description: `"${nextDownload.name}" has started downloading.`,
        duration: 2000,
      });
    } catch (error) {
      console.error('DownloadController: Error starting download:', error);
      // Put the download back in queue on error
      useDownloadStore.setState((state) => ({
        queuedDownloads: [nextDownload, ...state.queuedDownloads],
      }));
    } finally {
      this.isProcessing = false;
    }
  }

  // Direct download start (bypasses queue checks)
  private async startDownloadDirectly(download: QueuedDownload) {
    // const store = useDownloadStore.getState();

    // Replicate the addDownload logic without queue checks
    if (!download.location || !download.downloadName) {
      console.error('Invalid path parameters:', {
        location: download.location,
        downloadName: download.downloadName,
      });
      return;
    }

    let finalLocation = await window.downlodrFunctions.joinDownloadPath(
      download.location,
      download.downloadName,
    );
    let zustandLocation = download.location;

    if (download.isCreateFolder) {
      // Create subfolder logic (same as original addDownload)
      const sanitizedTitle = download.name.replace(/[\\/:*?"<>.|]/g, '_');
      let subfolderPath = await window.downlodrFunctions.joinDownloadPath(
        download.location,
        sanitizedTitle,
      );

      let counter = 1;
      let folderExists = await window.downlodrFunctions.fileExists(
        subfolderPath,
      );

      while (folderExists) {
        const newFolderName = `${sanitizedTitle} (${counter})`;
        subfolderPath = await window.downlodrFunctions.joinDownloadPath(
          download.location,
          newFolderName,
        );
        folderExists = await window.downlodrFunctions.fileExists(subfolderPath);
        counter++;
      }

      const dirCreated = await window.downlodrFunctions.ensureDirectoryExists(
        subfolderPath,
      );
      if (!dirCreated) {
        console.error('Failed to create subfolder:', subfolderPath);
      }

      zustandLocation = dirCreated ? subfolderPath : download.location;
      finalLocation = await window.downlodrFunctions.joinDownloadPath(
        zustandLocation,
        download.downloadName,
      );
    }

    // Start the actual download
    const downloadId = (window as any).ytdlp.download(
      {
        url: download.videoUrl,
        outputFilepath: finalLocation,
        videoFormat: download.formatId,
        remuxVideo: download.ext,
        audioExt: download.audioExt,
        audioFormatId: download.audioFormatId,
        limitRate: download.limitRate,
      },
      async (result: any) => {
        // Use the optimized updateDownload method instead of inline callbacks
        useDownloadStore.getState().updateDownload(downloadId, result);
      },
    );

    // Handle captions and thumbnails (same as original)
    let captionsPath = '';
    let thumbnailPath = ' ';

    if (download.isCreateFolder) {
      if (download.automaticCaption && download.getTranscript) {
        captionsPath = await downloadEnglishCaptions(
          download.automaticCaption,
          zustandLocation,
          download.downloadName,
        );
      }

      if (download.thumbnails && download.getThumbnail) {
        thumbnailPath = await window.downlodrFunctions.joinDownloadPath(
          zustandLocation,
          `thumb1.jpg`,
        );
        try {
          await window.downlodrFunctions.downloadFile(
            download.thumbnails,
            thumbnailPath,
          );
        } catch (error) {
          console.log('Error downloading thumbnail:', error);
        }
      }
    }

    // Add to downloading state
    useDownloadStore.setState((state) => ({
      downloading: [
        ...state.downloading,
        {
          id: downloadId,
          videoUrl: download.videoUrl,
          name: download.name,
          downloadName: download.downloadName,
          size: download.size,
          speed: download.speed,
          timeLeft: download.timeLeft,
          DateAdded: download.DateAdded,
          progress: download.progress,
          location: zustandLocation,
          status: 'downloading',
          ext: download.ext,
          formatId: download.formatId,
          backupExt: download.ext,
          backupFormatId: download.formatId,
          backupAudioExt: download.audioExt,
          backupAudioFormatId: download.audioFormatId,
          controllerId: '---',
          tags: download.tags || [],
          category: download.category || [],
          extractorKey: download.extractorKey,
          audioExt: download.audioExt,
          audioFormatId: download.audioFormatId,
          isLive: download.isLive,
          elapsed: download.elapsed,
          automaticCaption: download.automaticCaption,
          thumbnails: download.thumbnails,
          autoCaptionLocation: captionsPath,
          thumnailsLocation: thumbnailPath,
          getTranscript: download.getTranscript,
          getThumbnail: download.getThumbnail,
          duration: download.duration,
          isCreateFolder: download.isCreateFolder,
          log: download.log,
          // New fields for two-phase download tracking
          downloadPhase: 'video',
          completionCount: 0,
          rawProgress: download.progress,
        },
      ],
    }));
  }

  // Cleanup method
  cleanup() {
    this.stopWorker();
    this.stopStalledChecker();
    this.isProcessing = false;
  }
}

// Get the singleton instance
const downloadController = DownloadController.getInstance();

// Base interface for all download types
export interface BaseDownload {
  id: string; // Unique identifier for the download
  videoUrl: string; // URL of the video to be downloaded
  name: string; // Name of the video
  downloadName: string; // Name used for the download file
  size: number; // Size of the download in bytes
  speed: string; // Current download speed
  timeLeft: string; // Estimated time left for the download
  DateAdded: string; // Date when the download was added
  progress: number; // Current progress of the download (0-100)
  location: string; // File path where the download will be saved
  status: string; // Current status of the download
  ext: string; // File extension of the download
  controllerId?: string; // ID of the download controller
  tags: string[]; // Tags associated with the download
  category: string[]; // Categories associated with the download
  extractorKey: string; // Key for the extractor used
  formatId: string; // ID of the selected format
  audioExt: string; // Audio file extension
  audioFormatId: string; // ID of the audio format
  isLive: boolean; // Indicates if the download is a live stream
  elapsed: number;
  automaticCaption: any;
  thumbnails: any;
  autoCaptionLocation: string;
  thumnailsLocation: string;
  getTranscript: boolean;
  getThumbnail: boolean;
  duration: number;
  isCreateFolder: boolean;
  log: string;
  // New fields for two-phase download tracking
  downloadPhase: 'video' | 'audio'; // Current download phase
  completionCount: number; // Number of times reached 100%
  rawProgress: number; // Raw progress from the download engine (0-100)
}

// Interface for downloads that are currently being processed
export interface ForDownload extends BaseDownload {
  status: string; // Current status of the download
  downloadStart: boolean; // Indicates if the download has started
  formatId: string; // ID of the selected format
  audioExt: string; // Audio file extension
  audioFormatId: string; // ID of the audio format
}

// Interface for downloads that are currently downloading
interface Downloading extends Omit<BaseDownload, 'status'> {
  status:
    | 'downloading'
    | 'finished'
    | 'failed'
    | 'cancelled'
    | 'initializing'
    | 'fetching metadata'
    | 'paused';
  formatId: string; // ID of the selected format
  backupExt?: string; // Backup file extension
  backupFormatId?: string; // Backup format ID
  backupAudioExt?: string; // Backup audio file extension
  backupAudioFormatId?: string; // Backup audio format ID
}

// Interface for finished downloads
export interface FinishedDownloads extends BaseDownload {
  status: string; // Status of the finished download
  transcriptLocation: string;
}

// Interface for historical downloads
export interface HistoryDownloads extends BaseDownload {
  status: string; // Status of the historical download
  transcriptLocation: string;
}

// Add this interface after the existing interfaces
export interface QueuedDownload extends BaseDownload {
  id: string;
  videoUrl: string;
  name: string;
  downloadName: string;
  size: number;
  speed: string;
  timeLeft: string;
  DateAdded: string;
  progress: number;
  location: string;
  status: string;
  ext: string;
  formatId: string;
  audioExt: string;
  audioFormatId: string;
  extractorKey: string;
  limitRate: string;
  automaticCaption: any;
  thumbnails: any;
  getTranscript: boolean;
  getThumbnail: boolean;
  duration: number;
  isCreateFolder: boolean;
  queuedAt: string; // Timestamp when added to queue
  // New fields are inherited from BaseDownload
}

// Main interface for the download store
interface DownloadStore {
  downloading: Downloading[]; // List of currently downloading items
  finishedDownloads: FinishedDownloads[]; // List of finished downloads
  historyDownloads: HistoryDownloads[]; // List of download history logs
  forDownloads: ForDownload[]; // List of downloads that are queued
  queuedDownloads: QueuedDownload[]; // List of downloads waiting in queue
  availableTags: string[]; // List of available tags
  availableCategories: string[]; // List of available categories

  // Methods for managing downloads
  checkFinishedDownloads: () => void; // Check and update finished downloads
  updateDownload: (id: string, result: any) => void; // Update a specific download's status
  addDownload: (
    videoUrl: string,
    name: string,
    downloadName: string,
    size: number,
    speed: string,
    timeLeft: string,
    DateAdded: string,
    progress: number,
    location: string,
    status: string,
    ext: string,
    formatId: string,
    audioExt: string,
    audioFormatId: string,
    extractorKey: string,
    limitRate: string,
    automaticCaption: any,
    thumbnails: any,
    getTranscript: boolean,
    getThumbnail: boolean,
    duration: number,
    isCreateFolder: boolean,
  ) => void; // Add a new download
  setDownload: (
    videoUrl: string,
    location: string,
    limitRate: string,
    options?: { getTranscript: boolean; getThumbnail: boolean },
  ) => Promise<string | undefined>; // Set a download with metadata
  deleteDownload: (id: string) => void; // Delete a specific download
  deleteDownloading: (id: string) => void; // Delete a downloading item
  removeFromForDownloads: (id: string) => void; // Remove a download from the queue
  addTag: (downloadId: string, tag: string) => void; // Add a tag to a download
  removeTag: (downloadId: string, tag: string) => void; // Remove a tag from a download
  addCategory: (downloadId: string, category: string) => void; // Add a category to a download
  removeCategory: (downloadId: string, category: string) => void; // Remove a category from a download
  renameCategory: (oldName: string, newName: string) => void; // Rename a category
  deleteCategory: (category: string) => void; // Delete a category
  renameTag: (oldName: string, newName: string) => void; // Rename a tag
  deleteTag: (tag: string) => void; // Delete a tag
  updateDownloadStatus: (
    id: string,
    status:
      | 'downloading'
      | 'finished'
      | 'failed'
      | 'cancelled'
      | 'initializing'
      | 'fetching metadata'
      | 'paused',
  ) => void; // Update the status of a download
  renameDownload: (downloadId: string, newName: string) => void; // Rename a download

  // Add these new queue methods
  addQueue: (
    videoUrl: string,
    name: string,
    downloadName: string,
    size: number,
    speed: string,
    timeLeft: string,
    DateAdded: string,
    progress: number,
    location: string,
    status: string,
    ext: string,
    formatId: string,
    audioExt: string,
    audioFormatId: string,
    extractorKey: string,
    limitRate: string,
    automaticCaption: any,
    thumbnails: any,
    getTranscript: boolean,
    getThumbnail: boolean,
    duration: number,
    isCreateFolder: boolean,
  ) => void;
  processQueue: () => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  moveQueueItem: (id: string, direction: 'up' | 'down') => void;
  getQueuePosition: (id: string) => number;

  // Add cleanup method
  cleanup: () => void;

  // Add method to check for stalled downloads
  checkStalledDownloads: () => void;

  // Add manual trigger for checking stalled downloads
  manualCheckStalledDownloads: () => void;
}

const useDownloadStore = create<DownloadStore>()(
  persist(
    (set, get) => ({
      forDownloads: [] as ForDownload[],
      downloading: [] as Downloading[],
      finishedDownloads: [] as FinishedDownloads[],
      historyDownloads: [] as HistoryDownloads[],
      queuedDownloads: [] as QueuedDownload[], // Add queue state
      availableTags: [] as string[],
      availableCategories: [] as string[],

      checkFinishedDownloads: async () => {
        const currentDownloads = get().downloading;

        // Find downloads that are marked as finished and ready to be moved
        const finishedDownloads = currentDownloads.filter(
          (downloading) =>
            downloading.status === 'finished' &&
            downloading.completionCount >= 2, // Both phases completed
        );

        if (finishedDownloads.length > 0) {
          for (const download of finishedDownloads) {
            try {
              // Get the final file path
              const filePath = await window.downlodrFunctions.joinDownloadPath(
                download.location,
                download.downloadName,
              );

              // Get actual file size if file exists
              let actualSize = download.size;
              const fileExists = await window.downlodrFunctions.fileExists(
                filePath,
              );

              if (fileExists) {
                const fileSize = await window.downlodrFunctions.getFileSize(
                  filePath,
                );
                if (fileSize) {
                  actualSize = fileSize;
                }
              }

              // Create finished download entry
              const finishedDownload = {
                ...download,
                status: 'finished',
                size: actualSize,
                transcriptLocation: download.autoCaptionLocation || '',
              };

              // Update state: move to finished and history, remove from downloading
              set((state) => ({
                finishedDownloads: state.finishedDownloads.some(
                  (fd) => fd.id === download.id,
                )
                  ? state.finishedDownloads
                  : [...state.finishedDownloads, finishedDownload],

                historyDownloads: state.historyDownloads.some(
                  (hd) => hd.id === download.id,
                )
                  ? state.historyDownloads
                  : [...state.historyDownloads, finishedDownload],

                downloading: state.downloading.filter(
                  (d) => d.id !== download.id,
                ),
              }));

              console.log(
                `Successfully moved download "${download.name}" to finished downloads`,
              );
            } catch (error) {
              console.error(
                `Error processing finished download "${download.name}":`,
                error,
              );
            }
          }

          // Process queue after downloads finish
          get().processQueue();
        }

        // Handle failed downloads
        const failedDownloads = currentDownloads.filter(
          (downloading) => downloading.status === 'failed',
        );

        if (failedDownloads.length > 0) {
          for (const download of failedDownloads) {
            const failedDownload = {
              ...download,
              status: 'failed',
              transcriptLocation: download.autoCaptionLocation || '',
            };

            // Move failed downloads to history
            set((state) => ({
              historyDownloads: state.historyDownloads.some(
                (hd) => hd.id === download.id,
              )
                ? state.historyDownloads
                : [...state.historyDownloads, failedDownload],

              downloading: state.downloading.filter(
                (d) => d.id !== download.id,
              ),
            }));
          }

          // Process queue after handling failures
          get().processQueue();
        }
      },

      removeFromForDownloads: (id: string) => {
        set((state) => ({
          forDownloads: state.forDownloads.filter(
            (download) => download.id !== id,
          ),
        }));
      },

      updateDownload: (id: string, result: any) => {
        // Early return if no meaningful data to update
        if (!result) {
          return;
        }

        // Handle controller ID assignment
        if (result.type === 'controller' && result.controllerId) {
          set((state) => ({
            downloading: state.downloading.map((download) =>
              download.id === id
                ? { ...download, controllerId: result.controllerId }
                : download,
            ),
          }));
          return;
        }

        // Handle process completion messages from main process
        if (result.type === 'completion') {
          const completionMessage = result.data.log;
          const completeLog = result.data.completeLog || completionMessage;
          const exitCode = result.data.exitCode || 0;

          set((state) => ({
            downloading: state.downloading.map((downloading) => {
              if (downloading.id !== id) return downloading;

              // Don't override paused status with completion messages
              if ((downloading.status as any) === 'paused') {
                return {
                  ...downloading,
                  log: completeLog, // Still update log for debugging
                };
              }

              const updates: Partial<typeof downloading> = {
                log: completeLog, // Use complete log directly
                completionCount: Math.max(2, downloading.completionCount), // Ensure completion
                progress: 100,
              };

              if (exitCode === 0) {
                updates.status = 'finished';
              } else {
                updates.status = 'failed';
              }

              return { ...downloading, ...updates };
            }),
          }));

          // Trigger finished downloads check
          setTimeout(() => {
            get().checkFinishedDownloads();
          }, 100);
          return;
        }

        // Process regular download updates (progress, logs, etc.)
        if (result.data) {
          set((state) => ({
            downloading: state.downloading.map((downloading) => {
              if (downloading.id !== id) return downloading;

              // CRITICAL FIX: Don't process progress updates for paused, failed, or finished downloads
              if (
                (downloading.status as any) === 'paused' ||
                (downloading.status as any) === 'failed' ||
                (downloading.status as any) === 'finished'
              ) {
                const updates: Partial<typeof downloading> = {};

                // Still update log for debugging purposes, but don't change progress or status
                if (result.completeLog) {
                  updates.log = result.completeLog;
                }

                return Object.keys(updates).length > 0
                  ? { ...downloading, ...updates }
                  : downloading;
              }

              const updates: Partial<typeof downloading> = {};

              // Use complete log if available
              if (result.completeLog) {
                updates.log = result.completeLog;
              }

              // Handle progress data updates
              if (result.data.value) {
                const value = result.data.value;

                // Update basic download info
                if (value._speed_str) updates.speed = value._speed_str;
                if (value._eta_str) updates.timeLeft = value._eta_str;
                if (value.elapsed) updates.elapsed = value.elapsed;

                // Update size information
                if (value.downloaded_bytes) {
                  updates.size =
                    parseFloat(value.downloaded_bytes) || downloading.size;
                }
                if (value.total_bytes) {
                  updates.size =
                    parseFloat(value.total_bytes) || downloading.size;
                }

                // Handle two-phase progress system
                if (value._percent_str) {
                  const rawProgress = parseFloat(value._percent_str) || 0;
                  updates.rawProgress = rawProgress;

                  // Detect phase completion (when progress reaches 100%)
                  if (rawProgress >= 100 && downloading.rawProgress < 100) {
                    const newCompletionCount = downloading.completionCount + 1;
                    updates.completionCount = newCompletionCount;

                    // Phase 1 complete (Video) - Switch to audio phase
                    if (newCompletionCount === 1) {
                      updates.downloadPhase = 'audio';
                      updates.progress = 50; // Video phase complete, now at 50%
                    }
                    // Phase 2 complete (Audio) - Both phases done
                    else if (newCompletionCount === 2) {
                      updates.progress = 100;
                      updates.status = 'initializing'; // Waiting for merger
                    }
                  } else {
                    // Calculate display progress based on current phase
                    if (downloading.downloadPhase === 'video') {
                      // Video phase: 0-50%
                      updates.progress = Math.min(50, (rawProgress / 100) * 50);
                    } else if (downloading.downloadPhase === 'audio') {
                      // Audio phase: 51-100%
                      updates.progress =
                        50 + Math.min(50, (rawProgress / 100) * 50);
                    }
                  }
                }

                // Handle status updates - ENHANCED to protect paused status
                if (value.status) {
                  // CRITICAL FIX: Never override paused status with other updates
                  if ((downloading.status as any) === 'paused') {
                    // Keep paused status, don't update it from progress updates
                  } else {
                    // Don't override finished status if we already detected completion
                    if (
                      value.status === 'finished' &&
                      downloading.completionCount < 2
                    ) {
                      // Keep downloading status until both phases complete
                      updates.status = 'downloading';
                    } else if (
                      value.status === 'finished' &&
                      downloading.completionCount >= 2
                    ) {
                      // Both phases complete, wait for merger
                      updates.status = 'initializing';
                    } else if (value.status !== 'finished') {
                      // Only update status if it's not a 'finished' status that might conflict
                      updates.status = value.status;
                    }
                  }
                }
              }

              // Detect merger and remuxer phases from complete log
              if (updates.log && (downloading.status as any) !== 'paused') {
                if (
                  updates.log.includes('[Merger]') ||
                  updates.log.includes('Merging formats')
                ) {
                  updates.status = 'initializing';
                  updates.progress = 100;
                }

                if (updates.log.includes('[VideoRemuxer]')) {
                  updates.status = 'initializing';
                }
              }

              // Return updated download object
              return Object.keys(updates).length > 0
                ? { ...downloading, ...updates }
                : downloading;
            }),
          }));
        }
      },

      addDownload: async (
        videoUrl,
        name,
        downloadName,
        size,
        speed,
        timeLeft,
        DateAdded,
        progress,
        location,
        status,
        ext,
        formatId,
        audioExt,
        audioFormatId,
        extractorKey,
        limitRate,
        automatic_caption,
        thumbnails,
        getTranscript,
        getThumbnail,
        duration,
        isCreateFolder,
      ) => {
        if (!location || !downloadName) {
          return;
        }
        let finalLocation = await window.downlodrFunctions.joinDownloadPath(
          location,
          downloadName,
        );
        let zustandLocation = location;
        if (isCreateFolder) {
          // Create a sanitized name for the subfolder
          const sanitizedTitle = name.replace(/[\\/:'*ñ?"<>.|]/g, '_');

          // Create initial subfolder path
          let subfolderPath = await window.downlodrFunctions.joinDownloadPath(
            location,
            sanitizedTitle,
          );

          // Check if folder already exists and append counter if needed
          let counter = 1;
          let folderExists = await window.downlodrFunctions.fileExists(
            subfolderPath,
          );

          while (folderExists) {
            // Create a new path with counter appended
            const newFolderName = `${sanitizedTitle} (${counter})`;
            subfolderPath = await window.downlodrFunctions.joinDownloadPath(
              location,
              newFolderName,
            );

            // Check if this new path exists
            folderExists = await window.downlodrFunctions.fileExists(
              subfolderPath,
            );
            counter++;
          }

          // Ensure directory exists
          const dirCreated =
            await window.downlodrFunctions.ensureDirectoryExists(subfolderPath);
          if (!dirCreated) {
            console.error('Failed to create subfolder:', subfolderPath);
          }

          // Use subfolder path if created successfully, otherwise use original location
          zustandLocation = dirCreated ? subfolderPath : location;
          finalLocation = await window.downlodrFunctions.joinDownloadPath(
            zustandLocation,
            downloadName,
          );
        }
        // Create a download ID before starting the download
        const downloadId = (window as any).ytdlp.download(
          {
            url: videoUrl,
            outputFilepath: finalLocation,
            videoFormat: formatId,
            remuxVideo: ext,
            audioExt: audioExt,
            audioFormatId: audioFormatId,
            limitRate: limitRate,
          },
          async (result: any) => {
            // Use the optimized updateDownload method instead of inline callbacks
            useDownloadStore.getState().updateDownload(downloadId, result);
          },
        );
        let captionsPath = '';
        let thumbnailPath = ' ';
        if (isCreateFolder) {
          if (automatic_caption && getTranscript) {
            captionsPath = await downloadEnglishCaptions(
              automatic_caption,
              zustandLocation,
              downloadName,
            );
          } else {
            captionsPath = '';
            console.log('No transcript requested or available');
          }
          thumbnailPath = await window.downlodrFunctions.joinDownloadPath(
            zustandLocation,
            `thumb1.jpg`,
          );
          if (thumbnails && getThumbnail) {
            try {
              // Extract the URL from the thumbnails object
              const thumbnailUrl = thumbnails;
              if (thumbnailUrl) {
                await window.downlodrFunctions.downloadFile(
                  thumbnailUrl,
                  thumbnailPath,
                );
              }
            } catch (error) {
              console.log('Error downloading thumbnail:', error);
            }
          } else {
            console.log('No thumbnail requested or available');
          }
        }
        // Add the download to state with the final location
        set((state) => ({
          downloading: [
            ...state.downloading,
            {
              id: downloadId,
              videoUrl,
              name,
              downloadName,
              size,
              speed,
              timeLeft,
              DateAdded,
              progress,
              location: zustandLocation, // Use the subfolder path for the download location
              status: 'downloading',
              ext: ext,
              formatId,
              backupExt: ext,
              backupFormatId: formatId,
              backupAudioExt: audioExt,
              backupAudioFormatId: audioFormatId,
              controllerId: '---',
              tags: [],
              category: [],
              extractorKey,
              audioExt: audioExt,
              audioFormatId: '',
              isLive: false,
              elapsed: null,
              automaticCaption: automatic_caption,
              thumbnails: thumbnails,
              autoCaptionLocation: captionsPath,
              thumnailsLocation: thumbnailPath,
              getTranscript,
              getThumbnail,
              duration: duration,
              isCreateFolder: isCreateFolder,
              log: '',
              // New fields for two-phase download tracking
              downloadPhase: 'video',
              completionCount: 0,
              rawProgress: progress,
            },
          ],
        }));
      },

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setDownload: async (
        videoUrl: string,
        location: string,
        limitRate: string,
        options = { getTranscript: false, getThumbnail: false },
      ) => {
        if (!location) {
          console.error('Invalid path parameters:', { location });
          return;
        }

        const downloadId = uuidv4();

        // Add initial entry with minimal info
        set((state) => ({
          ...state,
          forDownloads: [
            ...state.forDownloads,
            {
              // BaseDownload properties
              id: downloadId,
              videoUrl,
              name: 'Fetching metadata...',
              downloadName: '',
              size: 0,
              speed: '',
              timeLeft: '',
              DateAdded: new Date().toISOString(),
              progress: 0,
              location,
              status: 'fetching metadata',
              ext: '',
              controllerId: undefined,
              tags: [],
              category: [],
              extractorKey: '',
              isLive: false,
              // ForDownload specific properties
              downloadStart: false,
              formatId: '',
              audioExt: '',
              audioFormatId: '',
              elapsed: null,
              automaticCaption: null,
              thumbnails: null,
              autoCaptionLocation: null,
              thumnailsLocation: null,
              // Store the user preferences
              getTranscript: options.getTranscript,
              getThumbnail: options.getThumbnail,
              duration: 0,
              isCreateFolder: null,
              log: '',
              // New fields for two-phase download tracking
              downloadPhase: 'video',
              completionCount: 0,
              rawProgress: 0,
            },
          ],
        }));

        try {
          // Fetch metadata in background
          const info = await window.ytdlp.getInfo(videoUrl);

          // Only set caption if transcript is requested
          let caption = '—';
          if (options.getTranscript) {
            const subtitles = info.data?.subtitles;
            const automaticCaptions = info.data?.automatic_captions;

            // Get first available language from subtitles (excluding live_chat)
            if (subtitles) {
              const availableLanguages = Object.keys(subtitles).filter(
                (lang) => lang !== 'live_chat',
              );
              if (availableLanguages.length > 0) {
                caption = subtitles[availableLanguages[0]];
              }
            }

            // If no manual subtitles, try automatic captions
            if (caption === '—' && automaticCaptions) {
              const availableLanguages = Object.keys(automaticCaptions);

              // First, try to find original language captions (containing "orig")
              const originalLanguage = availableLanguages.find((lang) =>
                lang.includes('orig'),
              );
              if (originalLanguage) {
                caption = automaticCaptions[originalLanguage];
              } else if (availableLanguages.length > 0) {
                // Fall back to first available language if no original found
                caption = automaticCaptions[availableLanguages[0]];
              }
            }
          }

          // Only set thumbnail if thumbnail is requested
          let thumbnail = '—';
          if (
            options.getThumbnail &&
            info.data?.thumbnails &&
            info.data.thumbnails.length > 0
          ) {
            thumbnail = info.data.thumbnail;
          }
          // Process formats using the service
          const { formatOptions, defaultFormatId, defaultExt } =
            await VideoFormatService.processVideoFormats(info);

          // Get default audio format if available
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const defaultAudioFormat = formatOptions.find((f) =>
            f.label.includes('Audio Only'),
          );

          // Update the forDownloads entry with metadata AND the new folder path
          set((state) => ({
            ...state,
            forDownloads: state.forDownloads.map((download) =>
              download.id === downloadId
                ? {
                    ...download,
                    name: `${info.data?.title || 'Untitled'}`,
                    downloadName: `${info.data?.title || 'Untitled'}`,
                    status: 'to download',
                    ext: defaultExt,
                    formatId: defaultFormatId,
                    extractorKey: info.data?.extractor_key || '',
                    audioExt: '',
                    audioFormatId: '',
                    downloadStart: false,
                    formats: formatOptions,
                    isLive: info.data?.is_live || false,
                    elapsed: info.data?.elapsed || null,
                    location: location,
                    automaticCaption: caption,
                    thumbnails: thumbnail,
                    getTranscript: options.getTranscript,
                    getThumbnail: options.getThumbnail,
                    duration: info.data?.duration,
                    // New fields for two-phase download tracking
                    downloadPhase: 'video',
                    completionCount: 0,
                    rawProgress: 0,
                  }
                : download,
            ),
          }));
          const currentDownload = get().forDownloads.find(
            (d) => d.id === downloadId,
          );

          if (currentDownload?.isLive) {
            toast({
              variant: 'destructive',
              title: 'Live Video Links Not Allowed',
              description:
                'Live video links are not supported. Please enter a valid URL.',
              duration: 3000,
            });

            const { removeFromForDownloads } = get(); // Get the current state methods
            removeFromForDownloads(downloadId); // Call the method            return;
          }
        } catch (error) {
          toast({
            variant: 'destructive',
            title: `Could not find video metadata`,
            description: 'Please enter a valid video URL',
            duration: 3000,
          });

          // Access the method correctly
          const { removeFromForDownloads } = get(); // Get the current state methods
          removeFromForDownloads(downloadId); // Call the method

          // Update status to error
          set((state) => ({
            ...state,
            forDownloads: state.forDownloads.map((download) =>
              download.id === downloadId
                ? {
                    ...download,
                    status: 'metadata_error',
                    error: 'Failed to fetch video information',
                  }
                : download,
            ),
          }));
        }

        return downloadId;
      },

      deleteDownload: (id: string) => {
        set((state) => ({
          downloading: state.downloading.filter((d) => d.id !== id),
          finishedDownloads: state.finishedDownloads.filter((d) => d.id !== id),
          historyDownloads: state.historyDownloads.filter((d) => d.id !== id),
          forDownloads: state.forDownloads.filter((d) => d.id !== id),
          queuedDownloads: state.queuedDownloads.filter((d) => d.id !== id), // Add queue cleanup
        }));
      },

      setDownloadingToCancelled: () => {
        set((state) => ({
          downloading: state.downloading.map((downloading) => ({
            ...downloading,
            status: 'cancelled',
          })),
        }));
      },

      deleteDownloading: (id: string) => {
        set((state) => ({
          downloading: state.downloading.filter(
            (downloading) => downloading.id !== id,
          ),
        }));
      },

      addTag: (downloadId: string, tag: string) => {
        set((state) => {
          const updateDownloadTags = <T extends BaseDownload>(
            downloads: T[],
          ): T[] => {
            return downloads.map((download) =>
              download.id === downloadId
                ? { ...download, tags: [...(download.tags || []), tag] }
                : download,
            );
          };

          return {
            ...state,
            availableTags: state.availableTags.includes(tag)
              ? state.availableTags
              : [...state.availableTags, tag],
            downloading: updateDownloadTags(state.downloading),
            finishedDownloads: updateDownloadTags(state.finishedDownloads),
            historyDownloads: updateDownloadTags(state.historyDownloads),
            forDownloads: updateDownloadTags(state.forDownloads),
          };
        });
      },

      removeTag: (downloadId: string, tag: string) => {
        set((state) => {
          const updateDownloadTags = <T extends BaseDownload>(
            downloads: T[],
          ): T[] => {
            return downloads.map((download) =>
              download.id === downloadId
                ? { ...download, tags: download.tags.filter((t) => t !== tag) }
                : download,
            );
          };

          return {
            ...state,
            downloading: updateDownloadTags(state.downloading),
            finishedDownloads: updateDownloadTags(state.finishedDownloads),
            historyDownloads: updateDownloadTags(state.historyDownloads),
            forDownloads: updateDownloadTags(state.forDownloads),
          };
        });
      },

      addCategory: (downloadId: string, category: string) => {
        set((state) => {
          const updateDownloadCategories = <T extends BaseDownload>(
            downloads: T[],
          ): T[] => {
            return downloads.map((download) =>
              download.id === downloadId
                ? {
                    ...download,
                    category: [...(download.category || []), category],
                  }
                : download,
            );
          };

          return {
            ...state,
            availableCategories: state.availableCategories.includes(category)
              ? state.availableCategories
              : [...state.availableCategories, category],
            downloading: updateDownloadCategories(state.downloading),
            finishedDownloads: updateDownloadCategories(
              state.finishedDownloads,
            ),
            historyDownloads: updateDownloadCategories(state.historyDownloads),
            forDownloads: updateDownloadCategories(state.forDownloads),
          };
        });
      },

      removeCategory: (downloadId: string, category: string) => {
        set((state) => {
          const updateDownloadCategories = <T extends BaseDownload>(
            downloads: T[],
          ): T[] => {
            return downloads.map((download) =>
              download.id === downloadId
                ? {
                    ...download,
                    category: (download.category || []).filter(
                      (c) => c !== category,
                    ),
                  }
                : download,
            );
          };

          return {
            ...state,
            downloading: updateDownloadCategories(state.downloading),
            finishedDownloads: updateDownloadCategories(
              state.finishedDownloads,
            ),
            historyDownloads: updateDownloadCategories(state.historyDownloads),
            forDownloads: updateDownloadCategories(state.forDownloads),
          };
        });
      },

      renameCategory: (oldName: string, newName: string) =>
        set((state) => {
          const updateDownloads = <T extends BaseDownload>(
            downloads: T[],
          ): T[] =>
            downloads.map((download) => ({
              ...download,
              category: download.category?.map((cat) =>
                cat === oldName ? newName : cat,
              ),
            }));

          return {
            ...state,
            availableCategories: state.availableCategories.map((cat) =>
              cat === oldName ? newName : cat,
            ),
            downloading: updateDownloads(state.downloading),
            finishedDownloads: updateDownloads(state.finishedDownloads),
            historyDownloads: updateDownloads(state.historyDownloads),
            forDownloads: updateDownloads(state.forDownloads),
          };
        }),

      deleteCategory: (category: string) =>
        set((state) => {
          const updateDownloads = <T extends BaseDownload>(
            downloads: T[],
          ): T[] =>
            downloads.map((download) => ({
              ...download,
              category: download.category?.filter((cat) => cat !== category),
            }));

          return {
            ...state,
            availableCategories: state.availableCategories.filter(
              (cat) => cat !== category,
            ),
            downloading: updateDownloads(state.downloading),
            finishedDownloads: updateDownloads(state.finishedDownloads),
            historyDownloads: updateDownloads(state.historyDownloads),
            forDownloads: updateDownloads(state.forDownloads),
          };
        }),

      renameTag: (oldName: string, newName: string) =>
        set((state) => {
          const updateDownloads = <T extends BaseDownload>(
            downloads: T[],
          ): T[] =>
            downloads.map((download) => ({
              ...download,
              tags: download.tags?.map((tag) =>
                tag === oldName ? newName : tag,
              ),
            }));

          return {
            ...state,
            availableTags: state.availableTags.map((tag) =>
              tag === oldName ? newName : tag,
            ),
            downloading: updateDownloads(state.downloading),
            finishedDownloads: updateDownloads(state.finishedDownloads),
            historyDownloads: updateDownloads(state.historyDownloads),
            forDownloads: updateDownloads(state.forDownloads),
          };
        }),

      deleteTag: (tag: string) =>
        set((state) => {
          const updateDownloads = <T extends BaseDownload>(
            downloads: T[],
          ): T[] =>
            downloads.map((download) => ({
              ...download,
              tags: download.tags?.filter((t) => t !== tag),
            }));

          return {
            ...state,
            availableTags: state.availableTags.filter((t) => t !== tag),
            downloading: updateDownloads(state.downloading),
            finishedDownloads: updateDownloads(state.finishedDownloads),
            historyDownloads: updateDownloads(state.historyDownloads),
            forDownloads: updateDownloads(state.forDownloads),
          };
        }),

      updateDownloadStatus: (
        id: string,
        status:
          | 'downloading'
          | 'finished'
          | 'failed'
          | 'cancelled'
          | 'initializing'
          | 'fetching metadata'
          | 'paused',
      ) => {
        set((state) => {
          const newState = {
            ...state,
            downloading: state.downloading.map((download) => {
              if (download.id === id) {
                return { ...download, status };
              }
              return download;
            }),
          };
          return newState;
        });
      },

      renameDownload: (downloadId: string, newName: string) => {
        set((state) => {
          // Update name in all relevant arrays
          const updateDownloadsArray = (downloads: ForDownload[]) =>
            downloads.map((download) =>
              download.id === downloadId
                ? { ...download, name: newName }
                : download,
            );

          return {
            forDownloads: updateDownloadsArray(state.forDownloads),
          };
        });
      },

      addQueue: (
        videoUrl,
        name,
        downloadName,
        size,
        speed,
        timeLeft,
        DateAdded,
        progress,
        location,
        status,
        ext,
        formatId,
        audioExt,
        audioFormatId,
        extractorKey,
        limitRate,
        automatic_caption,
        thumbnails,
        getTranscript,
        getThumbnail,
        duration,
        isCreateFolder,
      ) => {
        const queueId = uuidv4();

        set((state) => ({
          queuedDownloads: [
            ...state.queuedDownloads,
            {
              id: queueId,
              videoUrl,
              name,
              downloadName,
              size,
              speed,
              timeLeft,
              DateAdded,
              progress,
              location,
              status: 'queued',
              ext,
              formatId,
              audioExt,
              audioFormatId,
              extractorKey,
              limitRate,
              automaticCaption: automatic_caption,
              thumbnails,
              getTranscript,
              getThumbnail,
              duration,
              isCreateFolder,
              queuedAt: new Date().toISOString(),
              // Add missing BaseDownload properties
              tags: [],
              category: [],
              isLive: false,
              elapsed: 0,
              autoCaptionLocation: '',
              thumnailsLocation: '',
              controllerId: undefined,
              log: '',
              // New fields for two-phase download tracking
              downloadPhase: 'video',
              completionCount: 0,
              rawProgress: 0,
            },
          ],
        }));

        toast({
          title: 'Download Added to Queue',
          description: `"${name}" has been added to the download queue. Position: ${
            get().queuedDownloads.length
          }`,
          duration: 3000,
        });
        // Start the worker to process the queue
        downloadController.startWorker();
      },

      processQueue: () => {
        // Start the download worker - it will automatically stop when queue is empty
        downloadController.startWorker();
      },

      removeFromQueue: (id: string) => {
        set((state) => ({
          queuedDownloads: state.queuedDownloads.filter((q) => q.id !== id),
        }));
      },

      clearQueue: () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        set((state) => ({
          queuedDownloads: [],
        }));

        toast({
          title: 'Queue Cleared',
          description: 'All queued downloads have been removed.',
          duration: 2000,
        });
      },

      moveQueueItem: (id: string, direction: 'up' | 'down') => {
        set((state) => {
          const queuedDownloads = [...state.queuedDownloads];
          const currentIndex = queuedDownloads.findIndex((q) => q.id === id);

          if (currentIndex === -1) return state;

          const newIndex =
            direction === 'up'
              ? Math.max(0, currentIndex - 1)
              : Math.min(queuedDownloads.length - 1, currentIndex + 1);

          if (newIndex === currentIndex) return state;

          // Swap items
          [queuedDownloads[currentIndex], queuedDownloads[newIndex]] = [
            queuedDownloads[newIndex],
            queuedDownloads[currentIndex],
          ];

          return { queuedDownloads };
        });
      },

      getQueuePosition: (id: string) => {
        const queuedDownloads = get().queuedDownloads;
        return queuedDownloads.findIndex((q) => q.id === id) + 1;
      },

      // Cleanup method to prevent memory leaks
      cleanup: () => {
        downloadController.cleanup();
      },

      // Add method to check for stalled downloads
      checkStalledDownloads: async () => {
        const currentDownloads = get().downloading;

        // Find downloads that might be stalled:
        // - Status is 'initializing' for too long (merger/remuxer phase taking too long)
        // - Or downloads stuck in downloading state with both phases complete
        const potentialStalledDownloads = currentDownloads.filter(
          (download) => {
            // Check for downloads stuck in initializing state
            if (
              download.status === 'initializing' &&
              download.completionCount >= 2
            ) {
              return true;
            }

            // Check for downloads that completed both phases but still in downloading state
            if (
              download.status === 'downloading' &&
              download.completionCount >= 2
            ) {
              return true;
            }

            return false;
          },
        );

        if (potentialStalledDownloads.length === 0) {
          console.log('No stalled downloads detected');
          return;
        }
        for (const download of potentialStalledDownloads) {
          try {
            const filePath = await window.downlodrFunctions.joinDownloadPath(
              download.location,
              download.downloadName,
            );
            const fileExists = await window.downlodrFunctions.fileExists(
              filePath,
            );

            if (fileExists) {
              console.log(
                `Found stalled download: "${download.name}" - file exists but download not completed. Fixing...`,
              );

              // Get file size to update the download
              const actualFileSize = await window.downlodrFunctions.getFileSize(
                filePath,
              );

              // Mark as fully completed
              set((state) => ({
                downloading: state.downloading.map((d) =>
                  d.id === download.id
                    ? {
                        ...d,
                        completionCount: 2,
                        progress: 100,
                        status: 'finished',
                        size: actualFileSize || d.size,
                      }
                    : d,
                ),
              }));
              // Trigger finished downloads check for this specific download
              setTimeout(() => {
                get().checkFinishedDownloads();
              }, 100);
            } else {
              console.log(
                `Download "${download.name}" appears stalled but file doesn't exist yet. Keeping current state.`,
              );
            }
          } catch (error) {
            console.error(
              `Error checking stalled download "${download.name}":`,
              error,
            );
          }
        }
      },

      // manual trigger for checking stalled downloads
      manualCheckStalledDownloads: () => {
        get().checkStalledDownloads();
      },

      //End of store
    }),
    {
      name: 'downlodr-storage', // Name of the storage
      storage: createJSONStorage(() => localStorage), // Use local storage for persistence
      partialize: (state) => ({
        historyDownloads: state.historyDownloads,
        availableTags: state.availableTags,
        availableCategories: state.availableCategories,
        finishedDownloads: state.finishedDownloads,
        // queuedDownloads: state.queuedDownloads, // Persist queue
      }),
    },
  ),
);

export default useDownloadStore;

// performance monitoring utilities
// Memoized selectors to prevent unnecessary re-renders
export const useDownloadingSelectors = {
  // Get only downloading items
  downloading: () => useDownloadStore((state) => state.downloading),

  // Get downloading count without full array
  downloadingCount: () => useDownloadStore((state) => state.downloading.length),

  // Get specific download by ID (most efficient)
  downloadById: (id: string) =>
    useDownloadStore((state) => state.downloading.find((d) => d.id === id)),

  // Get only progress data for UI updates (minimal re-renders) - updated with phase info
  downloadProgress: (id: string) =>
    useDownloadStore((state) => {
      const download = state.downloading.find((d) => d.id === id);
      return download
        ? {
            id: download.id,
            progress: download.progress,
            rawProgress: download.rawProgress,
            speed: download.speed,
            timeLeft: download.timeLeft,
            status: download.status,
            downloadPhase: download.downloadPhase,
            completionCount: download.completionCount,
          }
        : null;
    }),

  // Get only essential UI data - updated with phase info
  downloadingEssentials: () =>
    useDownloadStore((state) =>
      state.downloading.map((d) => ({
        id: d.id,
        name: d.name,
        progress: d.progress,
        rawProgress: d.rawProgress,
        speed: d.speed,
        status: d.status,
        timeLeft: d.timeLeft,
        downloadPhase: d.downloadPhase,
        completionCount: d.completionCount,
      })),
    ),
};

// Performance monitoring utility
export const PerformanceMonitor = {
  updateCount: 0,
  lastUpdateTime: 0,

  trackUpdate() {
    this.updateCount++;
    this.lastUpdateTime = Date.now();
  },

  getStats() {
    return {
      totalUpdates: this.updateCount,
      lastUpdate: this.lastUpdateTime,
      updatesPerSecond:
        this.updateCount / ((Date.now() - this.lastUpdateTime) / 1000),
    };
  },

  reset() {
    this.updateCount = 0;
    this.lastUpdateTime = Date.now();
  },
};

// Add to your utilities or directly in the component that displays elapsed time
export function formatElapsedTime(elapsedSeconds: number | undefined): string {
  if (!elapsedSeconds || elapsedSeconds < 60) {
    if (elapsedSeconds == 0) {
      return '< 1s';
    }
    return elapsedSeconds ? `${Math.floor(elapsedSeconds)}s` : '';
  }

  const minutes = Math.floor(elapsedSeconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else {
    return `${minutes}m ${Math.floor(elapsedSeconds % 60)}s`;
  }
}

// Utility function to get progress phase information
export function getProgressPhaseInfo(download: {
  downloadPhase: 'video' | 'audio';
  completionCount: number;
  progress: number;
  status: string;
}): {
  phaseLabel: string;
  phaseProgress: number;
  overallProgress: number;
  isComplete: boolean;
} {
  const { downloadPhase, completionCount, progress, status } = download;

  let phaseLabel: string;
  let phaseProgress: number;
  let overallProgress: number;
  let isComplete = false;

  // Handle special states
  if (status === 'initializing') {
    phaseLabel = 'Merging & Processing';
    phaseProgress = 100;
    overallProgress = 100;
    isComplete = completionCount >= 2;
  } else if (status === 'finished') {
    phaseLabel = 'Complete';
    phaseProgress = 100;
    overallProgress = 100;
    isComplete = true;
  } else if (status === 'failed') {
    phaseLabel = 'Failed';
    phaseProgress = 0;
    overallProgress = progress;
    isComplete = false;
  } else {
    // Normal download phases
    if (downloadPhase === 'video') {
      phaseLabel = 'Downloading Video';
      phaseProgress = progress <= 50 ? (progress / 50) * 100 : 100;
    } else {
      phaseLabel = 'Downloading Audio';
      phaseProgress = progress > 50 ? ((progress - 50) / 50) * 100 : 0;
    }

    overallProgress = progress;
    isComplete = completionCount >= 2;
  }

  return {
    phaseLabel,
    phaseProgress: Math.max(0, Math.min(100, phaseProgress)),
    overallProgress,
    isComplete,
  };
}
