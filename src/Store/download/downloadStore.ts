/**
 * Zustand store for managing downloads in the application.
 *
 * REFACTORED VERSION - Uses modular structure for better maintainability
 *
 * This store has been split into focused modules:
 * - types.ts: All TypeScript interfaces
 * - utils.ts: Utility functions
 * - storage.ts: Storage utilities
 * - migration.ts: Data migration logic
 * - controller.ts: DownloadController for queue management
 * - selectors.ts: Optimized selectors
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
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { toast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import { config } from '@/config';
import { useMainStore } from '@/Store/mainStore';
import { MetadataService } from '@/services/download/metadataService';
import { FormatService } from '@/services/download/formatService';
import { TelemetryService } from '@/services/telemetry/telemetryService';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createIndexedDBStorageWithMigration } from '@/Utils/indexedDBStorage';
import { selectOptimalCaption } from '@/Utils/Metadata/languageHelper';

// Import from extracted modules
import {
  type DownloadStoreState,
  type Downloading,
  type FinishedDownloads,
  type FailedDownloads,
  type HistoryDownloads,
  type ForDownload,
  type QueuedDownload,
  type BaseDownload,
  type SpeedDataPoint,
} from './types';
import {
  truncateTitle,
  uuidv4,
  updateDownloadTags,
  updateDownloadCategories,
  updateDownloadsInAllArrays,
} from './utils';
import {
  createDebouncedStorage,
  checkIndexedDBUsage,
  checkLocalStorageUsage,
  DOWNLOAD_STORE_VERSION,
} from './storage';
import { migrateDownloadStore } from './migration';
import { DownloadController } from './controller';
import { createDownloadSelectors, PerformanceMonitor } from './selectors';

// Get the singleton controller instance
const downloadController = DownloadController.getInstance();

// Main interface for the download store (extends state with methods)
interface DownloadStore extends DownloadStoreState {
  // Methods for managing downloads
  checkFinishedDownloads: () => void;
  updateDownload: (id: string, result: any) => void;
  addDownload: (
    videoUrl: string,
    name: string,
    downloadName: string,
    displayName: string,
    size: number,
    speed: string,
    channelName: string,
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
    autoCaptionLocation?: string,
    thumnailsLocation?: string,
  ) => void;
  retryDownload: (
    videoUrl: string,
    name: string,
    downloadName: string,
    displayName: string,
    size: number,
    speed: string,
    channelName: string,
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
    thumnailsLocation: string,
    autoCaptionLocation: string,
    isCreateFolder: boolean,
  ) => void;
  setDownload: (
    videoUrl: string,
    location: string,
    limitRate: string,
    options?: {
      getTranscript: boolean;
      getThumbnail: boolean;
      isFromPlaylist?: boolean;
      playlistBatchId?: string;
    },
  ) => Promise<string | undefined>;
  deleteDownload: (id: string) => void;
  deleteDownloading: (id: string) => void;
  removeFromForDownloads: (id: string) => void;
  addTag: (downloadId: string, tag: string) => void;
  removeTag: (downloadId: string, tag: string) => void;
  addCategory: (downloadId: string, category: string) => void;
  removeCategory: (downloadId: string, category: string) => void;
  renameCategory: (oldName: string, newName: string) => void;
  deleteCategory: (category: string) => void;
  renameTag: (oldName: string, newName: string) => void;
  deleteTag: (tag: string) => void;
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
  ) => void;
  renameDownload: (downloadId: string, newName: string) => void;
  addQueue: (
    videoUrl: string,
    name: string,
    downloadName: string,
    displayName: string,
    size: number,
    speed: string,
    channelName: string,
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
  cleanup: () => void;
  checkStalledDownloads: () => void;
  manualCheckStalledDownloads: () => void;
  removeFailedDownload: (id: string) => void;
  clearFailedDownloads: () => void;
  testLocalStorage: () => void;
}

const useDownloadStore = create<DownloadStore>()(
  persist(
    (set, get) => {
      return {
        // Initial state
        forDownloads: [] as ForDownload[],
        downloading: [] as Downloading[],
        finishedDownloads: [] as FinishedDownloads[],
        failedDownloads: [] as FailedDownloads[],
        historyDownloads: [] as HistoryDownloads[],
        queuedDownloads: [] as QueuedDownload[],
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
                const filePath =
                  await window.downlodrFunctions.joinDownloadPath(
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
                const finishedDownload: FinishedDownloads = {
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
              const failedDownload: FailedDownloads = {
                ...download,
                status: 'failed',
                transcriptLocation: download.autoCaptionLocation || '',
                failureReason: 'Download process failed',
                canRetry: true,
              };

              // Move failed downloads to both failed downloads array and history
              set((state) => ({
                failedDownloads: state.failedDownloads.some(
                  (fd) => fd.id === download.id,
                )
                  ? state.failedDownloads
                  : [...state.failedDownloads, failedDownload],

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
                if (downloading.status === 'paused') {
                  return {
                    ...downloading,
                    log: completeLog, // Still update log for debugging
                  };
                }

                const updates: Partial<Downloading> = {
                  log: completeLog, // Use complete log directly
                  completionCount: Math.max(
                    2,
                    downloading.completionCount || 0,
                  ), // Ensure completion
                  progress: 100,
                };

                if (exitCode === 0) {
                  updates.status = 'finished';
                } else {
                  updates.status = 'failed';

                  // 📊 TELEMETRY: Send error report when download fails
                  // Non-blocking background telemetry - won't interfere with store updates
                  setTimeout(async () => {
                    try {
                      const telemetryService = new TelemetryService({
                        apiEndpoint: config.telemetry.endpoint,
                      });
                      await telemetryService.init();

                      const success = await telemetryService.sendDownloadError({
                        error: new Error(
                          `Download failed: ${downloading.status || 'failed'}`,
                        ),
                        logMessage: completeLog || '',
                        downloadContext: {
                          url: downloading.videoUrl || '',
                          format:
                            downloading.formatId ||
                            downloading.audioFormatId ||
                            'unknown',
                          quality:
                            downloading.formatId ||
                            downloading.audioFormatId ||
                            'unknown',
                          downloadName: downloading.name || 'Unknown Download',
                          downloadId: downloading.id,
                          progress: downloading.progress || 0,
                          location: downloading.location || '',
                          fileExtension:
                            downloading.ext || downloading.audioExt,
                          sessionDurationSeconds: downloading.elapsed || 0,
                        },
                      });

                      console.log(
                        success
                          ? `📊 Auto-telemetry sent for failed download: ${downloading.name}`
                          : `⚠️ Auto-telemetry failed for download: ${downloading.name}`,
                      );
                    } catch (error) {
                      console.error(
                        'Error sending auto-telemetry from store:',
                        error,
                      );
                      // Don't throw - telemetry failures shouldn't break the app
                    }
                  }, 0); // Non-blocking async execution
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

                // Don't process progress updates for paused, failed, or finished downloads
                if (
                  downloading.status === 'paused' ||
                  downloading.status === 'failed' ||
                  downloading.status === 'finished'
                ) {
                  const updates: Partial<Downloading> = {};

                  // still update log for debugging purposes, but don't change progress or status
                  if (result.completeLog) {
                    updates.log = result.completeLog;
                  }

                  return Object.keys(updates).length > 0
                    ? { ...downloading, ...updates }
                    : downloading;
                }

                const updates: Partial<Downloading> = {};

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
                    if (
                      rawProgress >= 100 &&
                      (downloading.rawProgress || 0) < 100
                    ) {
                      const newCompletionCount =
                        (downloading.completionCount || 0) + 1;
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
                        updates.progress = Math.min(
                          50,
                          (rawProgress / 100) * 50,
                        );
                      } else if (downloading.downloadPhase === 'audio') {
                        // Audio phase: 51-100%
                        updates.progress =
                          50 + Math.min(50, (rawProgress / 100) * 50);
                      }
                    }
                  }

                  // Handle status updates
                  // Note: paused/failed/finished statuses are already handled above with early return
                  if (value.status) {
                    // Don't override finished status if we already detected completion
                    if (
                      value.status === 'finished' &&
                      (downloading.completionCount || 0) < 2
                    ) {
                      // Keep downloading status until both phases complete
                      updates.status = 'downloading';
                    } else if (
                      value.status === 'finished' &&
                      (downloading.completionCount || 0) >= 2
                    ) {
                      // Both phases complete, wait for merger
                      updates.status = 'initializing';
                    } else if (value.status !== 'finished') {
                      // Only update status if it's not a 'finished' status that might conflict
                      updates.status = value.status as Downloading['status'];
                    }
                  }
                }

                // Detect merger and remuxer phases from complete log
                // Note: paused status is already handled above with early return
                if (updates.log) {
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
          displayName,
          size,
          speed,
          channelName,
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
          autoCaptionLocation,
          thumnailsLocation,
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
              await window.downlodrFunctions.ensureDirectoryExists(
                subfolderPath,
              );
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
          let captionsPath = autoCaptionLocation || '';
          let thumbnailPath = thumnailsLocation || '';
          if (isCreateFolder) {
            if (automatic_caption && getTranscript) {
              captionsPath = await MetadataService.downloadEnglishCaptions(
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
                displayName: displayName,
                size,
                speed,
                timeLeft,
                DateAdded,
                progress,
                location: zustandLocation, // Use the subfolder path for the download location
                status: 'downloading' as const,
                channelName: channelName,
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
                downloadPhase: 'video' as const,
                completionCount: 0,
                rawProgress: 0,
                speedHistory: [] as SpeedDataPoint[],
              },
            ],
          }));
        },

        retryDownload: async (
          videoUrl,
          name,
          downloadName,
          displayName,
          size,
          speed,
          channelName,
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
          thumnailsLocation,
          autoCaptionLocation,
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
              const success = await window.downlodrFunctions.deleteFolder(
                subfolderPath,
              );
              if (!success) {
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
            }

            // Ensure directory exists
            const dirCreated =
              await window.downlodrFunctions.ensureDirectoryExists(
                subfolderPath,
              );
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
          let captionsPath = autoCaptionLocation;
          let thumbnailPath = thumnailsLocation;
          if (isCreateFolder) {
            if (automatic_caption && getTranscript) {
              captionsPath = await MetadataService.downloadEnglishCaptions(
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
                displayName: displayName,
                size,
                speed,
                timeLeft,
                DateAdded,
                progress,
                location: zustandLocation, // Use the subfolder path for the download location
                status: 'downloading' as const,
                channelName: channelName,
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
                downloadPhase: 'video' as const,
                completionCount: 0,
                rawProgress: 0,
                speedHistory: [] as SpeedDataPoint[],
              },
            ],
          }));
        },

        setDownload: async (
          videoUrl: string,
          location: string,
          limitRate: string,
          options = {
            getTranscript: false,
            getThumbnail: false,
            isFromPlaylist: false,
            playlistBatchId: undefined,
          },
        ) => {
          if (!location) {
            console.error('Invalid path parameters:', { location });
            return;
          }

          const downloadId = uuidv4();

          set((state) => ({
            ...state,
            forDownloads: [
              ...state.forDownloads,
              {
                id: downloadId,
                videoUrl,
                channelName: '',
                name: 'Fetching metadata...',
                downloadName: '',
                displayName: 'Fetching metadata...',
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
                downloadStart: false,
                formatId: '',
                audioExt: '',
                audioFormatId: '',
                elapsed: null,
                automaticCaption: null,
                thumbnails: null,
                autoCaptionLocation: null,
                thumnailsLocation: null,
                getTranscript: options.getTranscript,
                getThumbnail: options.getThumbnail,
                duration: 0,
                isCreateFolder: false,
                log: '',
                downloadPhase: 'video',
                completionCount: 0,
                rawProgress: 0,
                speedHistory: [] as SpeedDataPoint[],
                isFromPlaylist: options.isFromPlaylist,
                playlistBatchId: options.playlistBatchId,
              },
            ],
          }));

          try {
            // Fetch metadata in background
            const info = await window.ytdlp.getInfo(videoUrl);

            // Get channel name from info
            const channelName = info.data?.channel || info.data?.uploader || '';
            const subtitles = info.data?.subtitles;
            const automaticCaptions = info.data?.automatic_captions;
            // Only set caption if transcript is requested
            let caption = '—';
            const caption2 = selectOptimalCaption(subtitles, automaticCaptions);
            if (options.getTranscript && caption2) {
              if (!caption2 == null && automaticCaptions) {
                console.log(
                  `Selected: ${caption2.languageName} (${caption2.source})`,
                );
                console.log(`Original language: ${caption2.isOriginal}`);
                // Use selectedCaption.caption.url for download
              }
              // Get caption from the optimal selection result
              if (caption2.source === 'subtitle' && subtitles) {
                caption = subtitles[caption2.languageCode];
              }

              // If no manual subtitles, try automatic captions
              if (caption2.source === 'automatic' && automaticCaptions) {
                caption = automaticCaptions[caption2.languageCode];
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
              await FormatService.processVideoFormats(info);

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
                      name: truncateTitle(info.data?.title || 'Untitled'),
                      downloadName: truncateTitle(
                        info.data?.title || 'Untitled',
                      ),
                      displayName: info.data?.title || 'Untitled',
                      status: 'to download',
                      ext: defaultExt,
                      formatId: defaultFormatId,
                      extractorKey: info.data?.extractor_key || '',
                      audioExt: '',
                      audioFormatId: '',
                      channelName: channelName,
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
                      downloadPhase: 'video',
                      completionCount: 0,
                      rawProgress: 0,
                      speedHistory: [] as SpeedDataPoint[],
                      isFromPlaylist: download.isFromPlaylist,
                      playlistBatchId: download.playlistBatchId,
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
              removeFromForDownloads(downloadId); // Call the method
              return;
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
            finishedDownloads: state.finishedDownloads.filter(
              (d) => d.id !== id,
            ),
            failedDownloads: state.failedDownloads.filter((d) => d.id !== id),
            historyDownloads: state.historyDownloads.filter((d) => d.id !== id),
            forDownloads: state.forDownloads.filter((d) => d.id !== id),
            queuedDownloads: state.queuedDownloads.filter((d) => d.id !== id),
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
            return {
              ...state,
              availableTags: state.availableTags.includes(tag)
                ? state.availableTags
                : [...state.availableTags, tag],
              downloading: updateDownloadTags(
                state.downloading,
                downloadId,
                (tags) => [...tags, tag],
              ),
              finishedDownloads: updateDownloadTags(
                state.finishedDownloads,
                downloadId,
                (tags) => [...tags, tag],
              ),
              historyDownloads: updateDownloadTags(
                state.historyDownloads,
                downloadId,
                (tags) => [...tags, tag],
              ),
              forDownloads: updateDownloadTags(
                state.forDownloads,
                downloadId,
                (tags) => [...tags, tag],
              ),
            };
          });
        },

        removeTag: (downloadId: string, tag: string) => {
          set((state) => {
            return {
              ...state,
              downloading: updateDownloadTags(
                state.downloading,
                downloadId,
                (tags) => tags.filter((t) => t !== tag),
              ),
              finishedDownloads: updateDownloadTags(
                state.finishedDownloads,
                downloadId,
                (tags) => tags.filter((t) => t !== tag),
              ),
              historyDownloads: updateDownloadTags(
                state.historyDownloads,
                downloadId,
                (tags) => tags.filter((t) => t !== tag),
              ),
              forDownloads: updateDownloadTags(
                state.forDownloads,
                downloadId,
                (tags) => tags.filter((t) => t !== tag),
              ),
            };
          });
        },

        addCategory: (downloadId: string, category: string) => {
          set((state) => {
            return {
              ...state,
              availableCategories: state.availableCategories.includes(category)
                ? state.availableCategories
                : [...state.availableCategories, category],
              downloading: updateDownloadCategories(
                state.downloading,
                downloadId,
                (categories) => [...categories, category],
              ),
              finishedDownloads: updateDownloadCategories(
                state.finishedDownloads,
                downloadId,
                (categories) => [...categories, category],
              ),
              historyDownloads: updateDownloadCategories(
                state.historyDownloads,
                downloadId,
                (categories) => [...categories, category],
              ),
              forDownloads: updateDownloadCategories(
                state.forDownloads,
                downloadId,
                (categories) => [...categories, category],
              ),
            };
          });
        },

        removeCategory: (downloadId: string, category: string) => {
          set((state) => {
            return {
              ...state,
              downloading: updateDownloadCategories(
                state.downloading,
                downloadId,
                (categories) => categories.filter((c) => c !== category),
              ),
              finishedDownloads: updateDownloadCategories(
                state.finishedDownloads,
                downloadId,
                (categories) => categories.filter((c) => c !== category),
              ),
              historyDownloads: updateDownloadCategories(
                state.historyDownloads,
                downloadId,
                (categories) => categories.filter((c) => c !== category),
              ),
              forDownloads: updateDownloadCategories(
                state.forDownloads,
                downloadId,
                (categories) => categories.filter((c) => c !== category),
              ),
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
          displayName,
          size,
          speed,
          channelName,
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
                displayName: displayName,
                size,
                speed,
                channelName: channelName || '',
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
                tags: [],
                category: [],
                isLive: false,
                elapsed: 0,
                autoCaptionLocation: '',
                thumnailsLocation: '',
                controllerId: undefined,
                log: '',
                downloadPhase: 'video' as const,
                completionCount: 0,
                rawProgress: 0,
                speedHistory: [] as SpeedDataPoint[],
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

        // cleanup method to prevent memory leaks
        cleanup: () => {
          downloadController.cleanup();
        },

        // stalled downloads
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
                (download.completionCount || 0) >= 2
              ) {
                return true;
              }

              // Check for downloads that completed both phases but still in downloading state
              if (
                download.status === 'downloading' &&
                (download.completionCount || 0) >= 2
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
                const actualFileSize =
                  await window.downlodrFunctions.getFileSize(filePath);

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

        removeFailedDownload: (id: string) => {
          set((state) => ({
            failedDownloads: state.failedDownloads.filter((fd) => fd.id !== id),
          }));

          toast({
            title: 'Failed Download Removed',
            description: 'The failed download has been removed from the list.',
            duration: 2000,
          });
        },

        clearFailedDownloads: () => {
          const count = get().failedDownloads.length;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          set((state) => ({
            failedDownloads: [],
          }));

          toast({
            title: 'Failed Downloads Cleared',
            description: `${count} failed downloads have been removed.`,
            duration: 2000,
          });
        },

        // Debug method to test IndexedDB storage
        testLocalStorage: async () => {
          try {
            const indexedDBStats = await checkIndexedDBUsage();
            const localStorageStats = checkLocalStorageUsage();

            toast({
              title: 'Storage Test Results',
              description: `IndexedDB: ${(indexedDBStats.total / 1024).toFixed(
                2,
              )} KB (${indexedDBStats.itemCount} items) | localStorage: ${(
                localStorageStats.total / 1024
              ).toFixed(2)} KB`,
              duration: 8000,
            });

            console.log('Complete storage analysis:', {
              indexedDB: indexedDBStats,
              localStorage: localStorageStats,
            });
          } catch (error) {
            console.error('Error testing storage:', error);
            const { total, downlodrSize } = checkLocalStorageUsage();
            toast({
              title: 'Storage Test (localStorage fallback)',
              description: `Total: ${(total / 1024).toFixed(
                2,
              )} KB, downlodr: ${(downlodrSize / 1024).toFixed(2)} KB`,
              duration: 5000,
            });
          }
        },
      };
    },
    {
      name: 'downlodr-storage',
      version: DOWNLOAD_STORE_VERSION,
      storage: createJSONStorage(() =>
        createDebouncedStorage(
          createIndexedDBStorageWithMigration({
            dbName: 'downlodr-database',
            storeName: 'zustand-storage',
            version: DOWNLOAD_STORE_VERSION,
            localStorageKey: 'downlodr-storage',
          }),
          250, // Debounce IndexedDB writes by 250ms (faster than default 500ms for better responsiveness)
        ),
      ),
      partialize: (state) => ({
        historyDownloads: state.historyDownloads,
        availableTags: state.availableTags,
        availableCategories: state.availableCategories,
        finishedDownloads: state.finishedDownloads,
        failedDownloads: state.failedDownloads,
        forDownloads: state.forDownloads.map((download) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { formats, ...downloadWithoutFormats } = download;
          return downloadWithoutFormats;
        }),
      }),
      migrate: migrateDownloadStore,
      onRehydrateStorage: () => {
        console.log(
          'Rehydrating download store from IndexedDB with concurrent write protection',
        );
        return (state, error) => {
          if (error) {
            console.error('Error rehydrating download store:', error);
          } else {
            console.log('Successfully rehydrated download store');
          }
        };
      },
    },
  ),
);

// Initialize controller with store interface after store is created
const storeInterface = {
  getState: () => ({
    queuedDownloads: useDownloadStore.getState().queuedDownloads,
    downloading: useDownloadStore.getState().downloading,
  }),
  setState: (updater: (state: any) => any) => {
    useDownloadStore.setState(updater);
  },
  updateDownload: (id: string, result: any) => {
    useDownloadStore.getState().updateDownload(id, result);
  },
  checkStalledDownloads: () => {
    useDownloadStore.getState().checkStalledDownloads();
  },
};
downloadController.setStore(storeInterface);

// Create selectors - these are Zustand hooks that can be used in components
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

  // Failed downloads selectors
  failedDownloads: () => useDownloadStore((state) => state.failedDownloads),
  failedDownloadsCount: () =>
    useDownloadStore((state) => state.failedDownloads.length),
  failedDownloadById: (id: string) =>
    useDownloadStore((state) => state.failedDownloads.find((d) => d.id === id)),

  // Get essential failed downloads data
  failedDownloadsEssentials: () =>
    useDownloadStore((state) =>
      state.failedDownloads.map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        failureReason: d.failureReason,
        canRetry: d.canRetry,
        DateAdded: d.DateAdded,
      })),
    ),
};

// Export the store
export default useDownloadStore;

// Re-export types and utilities for convenience
export type {
  Downloading,
  FinishedDownloads,
  FailedDownloads,
  HistoryDownloads,
  ForDownload,
  QueuedDownload,
  BaseDownload,
  SpeedDataPoint,
} from './types';

export { PerformanceMonitor } from './selectors';
export { getProgressPhaseInfo } from './utils';
export { checkIndexedDBUsage, checkLocalStorageUsage } from './storage';
