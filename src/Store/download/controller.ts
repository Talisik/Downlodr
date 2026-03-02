/**
 * Download Controller - implements Token Bucket Algorithm for rate limiting
 * Manages the download queue and processes downloads based on concurrency limits
 */

import { toast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import { useMainStore } from '@/Store/mainStore';
import { MetadataService } from '@/services/download/metadataService';
import { Downloading, QueuedDownload, SpeedDataPoint } from './types';

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
      this.store.setState((state) => ({
        queuedDownloads: state.queuedDownloads.filter(
          (q: QueuedDownload) => q.id !== nextDownload.id,
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
  private async startDownloadDirectly(download: QueuedDownload): Promise<void> {
    if (!this.store) return;

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
        if (this.store) {
          this.store.updateDownload(downloadId, result);
        }
      },
    );
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

    if (download.isCreateFolder) {
      if (download.automaticCaption && download.getTranscript) {
        console.log(download.automaticCaption);
        // Start transcription asynchronously so it doesn't block download progress
        MetadataService.downloadEnglishCaptions(
          download.automaticCaption,
          zustandLocation,
          download.downloadName,
          finalLocation, // Pass video file path for Whisper fallback
          downloadId, // Pass download ID to track progress
          true, // Run asynchronously
        );
        const fileNameWithoutExt = download.downloadName
          ? download.downloadName.replace(/\.[^/.]+$/, '')
          : 'video';
        const sanitizedTitle = fileNameWithoutExt.replace(
          /[\\ñ'/:*?"<>|]/g,
          '_',
        );
        const captionFileName = `${sanitizedTitle}.srt`;
        captionsPath = await window.downlodrFunctions.joinDownloadPath(
          zustandLocation,
          captionFileName,
        );
        // Don't await - let it run in background
        captionsPath = ''; // Will be updated in store when transcription completes
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

    // downloading state
    this.store.setState((state) => ({
      downloading: [
        ...state.downloading,
        {
          id: downloadId,
          videoUrl: download.videoUrl,
          name: download.name,
          downloadName: download.downloadName,
          displayName: download.displayName,
          size: download.size,
          speed: download.speed,
          timeLeft: download.timeLeft,
          DateAdded: download.DateAdded,
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
          autoCaptionLocation: captionsPath,
          thumnailsLocation: thumbnailPath,
          getTranscript: download.getTranscript,
          getThumbnail: download.getThumbnail,
          duration: download.duration,
          isCreateFolder: download.isCreateFolder,
          log: download.log,
          downloadPhase: 'video' as const,
          completionCount: 0,
          rawProgress: download.progress,
          speedHistory: [] as SpeedDataPoint[],
        },
      ],
    }));
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
