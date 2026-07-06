/* eslint-disable prettier/prettier */
/**
 * Lifecycle actions for the download store: updateDownload, checkFinishedDownloads,
 * checkStalledDownloads, etc. Receives Zustand set/get from the store.
 */

const MAX_STORE_LOG_BYTES = 51200; // 50 KB — matches main-process cap

function appendLog(existing: string | undefined, incoming: string): string {
  const next = existing ? `${existing}${incoming}` : incoming;
  return next.length > MAX_STORE_LOG_BYTES
    ? next.slice(next.length - MAX_STORE_LOG_BYTES)
    : next;
}
import { config } from '@/core-app/client/config';
import { TelemetryService } from '@/core-app/telemetry/utils/telemetryService';
import { subscriptionDownloadSync } from '@/skedulosa/services/subscriptionDownloadSync';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import type {
  Downloading,
  DownloadStoreState,
  FailedDownloads,
  FinishedDownloads
} from '../types';

/** Zustand setter: accepts partial state or updater function */
type SetState = (
  partial:
    | Partial<DownloadStoreState>
    | ((state: DownloadStoreState) => Partial<DownloadStoreState>),
) => void;

/** Store getter */
type GetState = () => {
  checkFinishedDownloads: () => void;
  downloading: Downloading[];
  processQueue: () => void;
  checkStalledDownloads: () => void;
};

/** Shape of payloads passed to updateDownload from the download engine */
interface UpdateDownloadResult {
  type?: 'controller' | 'completion';
  controllerId?: string;
  data?: {
    log?: string;
    completeLog?: string;
    exitCode?: number;
    value?: {
      _speed_str?: string;
      _eta_str?: string;
      elapsed?: number;
      downloaded_bytes?: string | number;
      total_bytes?: string | number;
      _percent_str?: string;
      status?: string;
    };
  };
  completeLog?: string;
}

export function createLifecycleActions(set: SetState, get: GetState) {
  return {
    updateDownload: (id: string, result: UpdateDownloadResult) => {
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
              completionCount: Math.max(2, downloading.completionCount || 0), // Ensure completion
              progress: 100,
            };

            if (exitCode === 0) {
              updates.status = 'finished';
              // Sync completion to subscription store
              subscriptionDownloadSync.onDownloadCompleted(id, 'finished');
            } else {
              updates.status = 'failed';
              // Sync failure to subscription store
              subscriptionDownloadSync.onDownloadCompleted(id, 'failed');

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
                      fileExtension: downloading.ext || downloading.audioExt,
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
              } else if (result.data?.log) {
                updates.log = appendLog(downloading.log, result.data.log);
              }

              return Object.keys(updates).length > 0
                ? { ...downloading, ...updates }
                : downloading;
            }

            const updates: Partial<Downloading> = {};

            // Use complete log if available, otherwise append incremental line
            if (result.completeLog) {
              updates.log = result.completeLog;
            } else if (result.data?.log) {
              updates.log = appendLog(downloading.log, result.data.log);
            }

            // Handle progress data updates
            if (result.data.value) {
              const value = result.data.value;

              // Update basic download info
              if (value._speed_str) updates.speed = value._speed_str;
              if (value._eta_str) updates.timeLeft = value._eta_str;
              if (value.elapsed) updates.elapsed = value.elapsed;

              // Update size information
              if (value.downloaded_bytes !== undefined) {
                updates.size =
                  parseFloat(String(value.downloaded_bytes)) ||
                  downloading.size;
              }
              if (value.total_bytes !== undefined) {
                updates.size =
                  parseFloat(String(value.total_bytes)) || downloading.size;
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
                    updates.progress = Math.min(50, (rawProgress / 100) * 50);
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

            // Sync status updates to subscription store if there are meaningful changes
            if (Object.keys(updates).length > 0 && (updates.status || updates.speed || updates.progress !== undefined || updates.size !== undefined)) {
              subscriptionDownloadSync.syncDownloadStatus(id, {
                status: updates.status,
                speed: updates.speed,
                progress: updates.progress,
                size: updates.size !== undefined ? String(updates.size) : undefined,
                thumbnail_location: downloading.thumnailsLocation || undefined,
              });
            }

            // Return updated download object
            return Object.keys(updates).length > 0
              ? { ...downloading, ...updates }
              : downloading;
          }),
        }));
      }
    },
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

            // Preserve any pre-set transcript location (e.g. from converter plugin),
            // then override with the actual location if a transcript was requested.
            let transcriptLocation = download.transcriptLocation || '';
            if (download.getTranscript) {
              if (
                download.autoCaptionLocation &&
                download.autoCaptionLocation.trim() !== ''
              ) {
                // Use existing location if available
                transcriptLocation = download.autoCaptionLocation;
              } else if (!transcriptLocation && download.downloadName) {
                // Calculate expected transcript location path
                // This matches the logic used in metadataService and controller
                const fileNameWithoutExt = download.downloadName.replace(
                  /\.[^/.]+$/,
                  '',
                );
                const sanitizedTitle = fileNameWithoutExt.replace(
                  /[\\ñ'/:*?"<>|]/g,
                  '_',
                );
                const captionFileName = `${sanitizedTitle}.srt`;
                transcriptLocation =
                  await window.downlodrFunctions.joinDownloadPath(
                    download.location,
                    captionFileName,
                  );
              }
            }

            // Update state: move to finished and history, remove from downloading
            set((state) => {
              // Re-read the live downloading entry inside the set callback — any
              // async updates (e.g. yt-dlp caption completing) that landed after
              // the snapshot was taken will be present in state.downloading but
              // NOT in the `download` snapshot captured before the async I/O.
              const liveDownload = state.downloading.find(
                (d) => d.id === download.id,
              );

              // Merge snapshot with live transcription fields so we never
              // promote a stale 'transcribing' status into finishedDownloads.
              const finishedDownload: FinishedDownloads = {
                ...download,
                ...(liveDownload && {
                  transcriptionStatus: liveDownload.transcriptionStatus,
                  transcriptionProgress: liveDownload.transcriptionProgress,
                  autoCaptionLocation: liveDownload.autoCaptionLocation,
                }),
                status: 'finished',
                size: actualSize,
                transcriptLocation:
                  liveDownload?.autoCaptionLocation?.trim()
                    ? liveDownload.autoCaptionLocation
                    : transcriptLocation,
              };

              return {
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
              };
            });

            // Sync final video location and confirmed size to skedulosa subscription record.
            // The sync service maps are already cleaned up at this point so we write directly.
            if (download.subscriptionId) {
              useSkedulosaStore.getState().updateSubscriptionDownload(
                download.subscriptionId,
                download.id,
                {
                  video_location: filePath,
                  size: String(actualSize),
                  thumbnail_location: download.thumnailsLocation || undefined,
                },
              );
            }

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
            transcriptLocation:
              download.autoCaptionLocation &&
              download.autoCaptionLocation.trim() !== ''
                ? download.autoCaptionLocation
                : '',
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
      manualCheckStalledDownloads: () => {
        get().checkStalledDownloads();
      },
  };
}
