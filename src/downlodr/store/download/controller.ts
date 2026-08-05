/**
 * Download Controller - implements Token Bucket Algorithm for rate limiting
 * Manages the download queue and processes downloads based on concurrency limits
 */

import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import i18n from '@/core-app/i18n';
import { useSettingStore } from '@/core-app/store/settingsStore';
import { formatFileSize } from '@/downlodr/pages/status/statusPageUtils';
import { MetadataService } from '@/downlodr/utils/metadata/metadataService';
import { subscriptionDownloadSync } from '@/skedulosa/services/subscriptionDownloadSync';
import { Downloading, QueuedDownload, SpeedDataPoint } from './types';

// Floor used when the format's size is unknown, and a safety margin on top
// of a known size to cover temp fragments / muxing overhead.
const MIN_REQUIRED_FREE_BYTES = 250 * 1024 * 1024; // 250 MB
// const MIN_REQUIRED_FREE_BYTES = 9999 * 1024 ** 4; // 100 MB
const SPACE_SAFETY_MARGIN = 1.1;

/**
 * Store interface for DownloadController to avoid circular dependencies
 */
export interface DownloadStoreInterface {
  getState: () => {
    queuedDownloads: QueuedDownload[];
    downloading: Downloading[];
  };
  setState: (updater: (state: any) => any) => void;
  updateDownload: (id: string, result: any) => void;
  checkStalledDownloads: () => void;
}

/**
 * Download Controller - implements Token Bucket Algorithm for rate limiting
 */
export class DownloadController {
  private static instance: DownloadController;
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | undefined;
  private stalledCheckInterval: NodeJS.Timeout | undefined;
  private store: DownloadStoreInterface | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  static getInstance(): DownloadController {
    if (!DownloadController.instance) {
      DownloadController.instance = new DownloadController();
    }
    return DownloadController.instance;
  }

  /**
   * Set the store reference (called after store is created)
   */
  setStore(store: DownloadStoreInterface): void {
    this.store = store;
  }

  /**
   * Start the download worker if not already running
   */
  startWorker(): void {
    if (this.processingInterval) return; // Already running

    console.log('DownloadController: Starting worker');
    this.processingInterval = setInterval(() => {
      this.processNextDownload();
    }, 500); // Check every 500ms for smoother processing

    // Also start the stalled download checker
    this.startStalledChecker();
  }

  /**
   * Start the stalled download checker
   */
  startStalledChecker(): void {
    if (this.stalledCheckInterval) return; // Already running

    console.log('DownloadController: Starting stalled download checker');
    this.stalledCheckInterval = setInterval(() => {
      if (this.store) {
        this.store.checkStalledDownloads();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop the download worker
   */
  stopWorker(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
      console.log('DownloadController: Worker stopped');
    }

    // Don't stop the stalled checker when stopping the worker
    // It should continue running to catch any remaining stalled downloads
  }

  /**
   * Stop the stalled checker
   */
  stopStalledChecker(): void {
    if (this.stalledCheckInterval) {
      clearInterval(this.stalledCheckInterval);
      this.stalledCheckInterval = undefined;
      console.log('DownloadController: Stalled checker stopped');
    }
  }

  /**
   * Process one download at a time (Worker Pattern)
   */
  private async processNextDownload(): Promise<void> {
    if (this.isProcessing || !this.store) return; // Prevent concurrent processing

    const storeState = this.store.getState();
    const { queuedDownloads, downloading } = storeState;

    // Get current settings
    const maxConcurrentDownloads =
      useSettingStore.getState().settings.maxDownloadNum;
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
      this.store.setState((state) => ({
        queuedDownloads: state.queuedDownloads.filter(
          (q: QueuedDownload) => q.id !== nextDownload.id,
        ),
      }));

      // Start the download using the original addDownload logic. A false
      // result means it was rejected before starting (e.g. insufficient
      // disk space) — startDownloadDirectly already surfaced why, and the
      // item should not be re-queued or reported as started.
      const started = await this.startDownloadDirectly(nextDownload);

      if (started) {
        toast({
          title: i18n.t('downloadController.downloadStarted', {
            ns: 'downlodr',
          }),
          description: i18n.t('downloadController.downloadStartedDesc', {
            ns: 'downlodr',
            name: nextDownload.name,
          }),
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('DownloadController: Error starting download:', error);
      // Put the download back in queue on error
      this.store.setState((state) => ({
        queuedDownloads: [nextDownload, ...state.queuedDownloads],
      }));
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Direct download start (bypasses queue checks)
   */
  private async startDownloadDirectly(
    download: QueuedDownload,
  ): Promise<boolean> {
    if (!this.store) return false;

    // Replicate the addDownload logic without queue checks
    if (!download.location || !download.downloadName) {
      console.error('Invalid path parameters:', {
        location: download.location,
        downloadName: download.downloadName,
      });
      return false;
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

    // Pre-flight free space check. Runs once, right before the download
    // starts — not a poll. If the check itself fails (e.g. an unreadable
    // path), freeSpace is null and we fail open rather than block a
    // download we can't actually evaluate.
    const freeSpace = await window.downlodrFunctions.getFreeDiskSpace(
      zustandLocation,
    );
    console.log(
      `DownloadController: free space at "${zustandLocation}" =`,
      freeSpace === null ? 'unknown' : `${formatFileSize(freeSpace)} (${freeSpace} bytes)`,
    );
    if (freeSpace !== null) {
      const requiredSpace =
        download.size > 0
          ? download.size * SPACE_SAFETY_MARGIN
          : MIN_REQUIRED_FREE_BYTES;

      if (freeSpace < requiredSpace) {
        toast({
          title: i18n.t('downloadController.insufficientStorage', {
            ns: 'downlodr',
          }),
          description: i18n.t('downloadController.insufficientStorageDesc', {
            ns: 'downlodr',
            name: download.name,
            needed: formatFileSize(requiredSpace),
            free: formatFileSize(freeSpace),
          }),
          variant: 'destructive',
          duration: 5000,
        });
        return false;
      }
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
        if (this.store) {
          this.store.updateDownload(downloadId, result);
        }
      },
    );

    // Register the store entry immediately, before any further async work.
    // The main process starts sending controller-ID/progress messages for
    // `downloadId` right after the process spawns above — often within
    // milliseconds. Previously this entry wasn't created until after the
    // caption/thumbnail prep below (which can include a real network fetch
    // for the thumbnail image), so a controller-ID message could arrive
    // while no matching row existed yet: updateDownload's `.map()` silently
    // no-ops when it finds no match, there's no retry, and the row was
    // permanently stranded at controllerId: '---' — blocking Pause/Stop for
    // its entire life. Creating the row here, synchronously, closes that gap.
    this.store.setState((state) => ({
      downloading: [
        ...state.downloading,
        {
          id: downloadId,
          subscriptionId: download.subscriptionId,
          videoUrl: download.videoUrl,
          name: download.name,
          downloadName: download.downloadName,
          displayName: download.displayName,
          size: download.size,
          speed: download.speed,
          timeLeft: download.timeLeft,
          DateAdded: download.DateAdded,
          uploadDate: download.uploadDate,
          channelName: download.channelName,
          progress: download.progress,
          location: zustandLocation,
          status: 'downloading' as const,
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
          // Patched in below once resolved — kept out of the initial insert
          // so it doesn't delay the row (and the controllerId patch race).
          autoCaptionLocation: '',
          thumnailsLocation: ' ',
          getTranscript: download.getTranscript,
          getThumbnail: download.getThumbnail,
          duration: download.duration,
          isCreateFolder: download.isCreateFolder,
          description: download.description,
          chapters: download.chapters,
          transcriptLocation: download.transcriptLocation,
          log: download.log,
          downloadPhase: 'video' as const,
          completionCount: 0,
          rawProgress: download.progress,
          speedHistory: [] as SpeedDataPoint[],
          ...(download.getTranscript
            ? {
                transcriptionStatus: 'transcribing' as const,
                transcriptionProgress: 0,
              }
            : {}),
        },
      ],
    }));

    // When this download was initiated by a subscription, notify the sync service
    // that the download has actually started with the real download ID
    if (download.subscriptionId) {
      subscriptionDownloadSync.onDownloadStarted(downloadId, download);
    }
    const fileNameWithoutExt = download.downloadName
      ? download.downloadName.replace(/\.[^/.]+$/, '')
      : 'video';
    const sanitizedTitle = fileNameWithoutExt.replace(/[\\ñ'/:*?"<>|]/g, '_');
    const captionFileName = `${sanitizedTitle}.srt`;
    let captionsPath = await window.downlodrFunctions.joinDownloadPath(
      zustandLocation,
      captionFileName,
    );
    // Handle captions and thumbnails (same as original)
    let thumbnailPath = ' ';
    let transcriptReusedFromSource = false;

    if (download.getTranscript) {
      console.log(download.automaticCaption);
      captionsPath = await window.downlodrFunctions.joinDownloadPath(
        zustandLocation,
        captionFileName,
      );

      // If a transcript already exists for this download (e.g. this is a
      // format conversion of a video that was already transcribed), point
      // straight at the source file instead of copying it — the converted
      // download's transcript viewer should open the exact same file as the
      // original, not a duplicate on disk.
      const sourceTranscriptPath = download.transcriptLocation;
      const sourceTranscriptExists =
        !!sourceTranscriptPath &&
        (await window.downlodrFunctions.fileExists(sourceTranscriptPath));

      if (sourceTranscriptExists) {
        transcriptReusedFromSource = true;
        captionsPath = sourceTranscriptPath;
      } else {
        // Don't await - let it run in background
        captionsPath = ''; // Will be updated in store when transcription completes
      }
    }

    // Patch the caption fields now that they're known — the row already
    // exists, so no controller/progress messages get dropped waiting on this.
    this.store.setState((state) => ({
      downloading: state.downloading.map((d: Downloading) =>
        d.id === downloadId
          ? {
              ...d,
              autoCaptionLocation: captionsPath,
              transcriptLocation: transcriptReusedFromSource
                ? captionsPath
                : download.transcriptLocation,
              ...(download.getTranscript && transcriptReusedFromSource
                ? {
                    transcriptionStatus: 'completed' as const,
                    transcriptionProgress: 100,
                  }
                : {}),
            }
          : d,
      ),
    }));

    if (download.thumbnails && download.getThumbnail) {
      console.log('download.thumbnails', download.thumbnails);
      console.log('zustandLocation', zustandLocation);
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
      this.store.setState((state) => ({
        downloading: state.downloading.map((d: Downloading) =>
          d.id === downloadId ? { ...d, thumnailsLocation: thumbnailPath } : d,
        ),
      }));
    }

    // Fire the caption/transcription download AFTER the row exists in `downloading`.
    // Zustand setState above is synchronous, so by the time the async caption call
    // yields on its first await the row is guaranteed registered — every subsequent
    // updateTranscriptionProgress() now has a row to land on instead of no-opping
    // across all three arrays and stranding the entry at 'transcribing' 0%.
    if (download.getTranscript && !transcriptReusedFromSource) {
      // Start transcription asynchronously so it doesn't block download progress
      MetadataService.downloadEnglishCaptions(
        download.automaticCaption,
        zustandLocation,
        download.downloadName,
        finalLocation, // Pass video file path for Whisper fallback
        downloadId, // Pass download ID to track progress
        true, // Run asynchronously
      );
    }

    return true;
  }

  /**
   * Restarts the yt-dlp process for an already-active live download that
   * just errored, reusing the existing row's id instead of creating a new
   * one — so the same table row keeps updating in place (progress,
   * controllerId, completion) and no second visible entry appears. Used by
   * the live-download auto-retry flow in lifecycleActions.ts; see
   * docs/superpowers/specs/2026-07-30-live-download-auto-retry-design.md.
   */
  async restartLiveDownload(existingId: string): Promise<void> {
    if (!this.store) return;
    const download = this.store
      .getState()
      .downloading.find((d: Downloading) => d.id === existingId);
    if (!download) return;

    const outputFilepath = await window.downlodrFunctions.joinDownloadPath(
      download.location,
      download.downloadName,
    );

    // Reset progress-tracking fields so the restarted process's own
    // progress stream renders correctly instead of picking up from the
    // errored attempt's phase/completion state.
    this.store.setState((state) => ({
      downloading: state.downloading.map((d: Downloading) =>
        d.id === existingId
          ? {
              ...d,
              rawProgress: 0,
              completionCount: 0,
              downloadPhase: 'video' as const,
              controllerId: '---',
            }
          : d,
      ),
    }));

    (window as any).ytdlp.download(
      {
        url: download.videoUrl,
        outputFilepath,
        videoFormat: download.formatId,
        remuxVideo: download.ext,
        audioExt: download.audioExt,
        audioFormatId: download.audioFormatId,
      },
      (result: any) => {
        if (this.store) {
          this.store.updateDownload(existingId, result);
        }
      },
    );
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    this.stopWorker();
    this.stopStalledChecker();
    this.isProcessing = false;
  }
}
