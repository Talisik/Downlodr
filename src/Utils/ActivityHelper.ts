/**
 * Activity Helper - Tracks download progress and provides structured activity data
 *
 * This helper function monitors download states and provides detailed activity information
 * for the ActivityTracker component. It tracks the complete download lifecycle from
 * fetching metadata to completion.
 */

import useDownloadStore, {
  Downloading,
  FinishedDownloads,
  QueuedDownload,
} from '@/Store/downloadStore';
import {
  generateErrorMessage,
  getErrorCodeInfo,
  isRetryableError,
  parseErrorCodeFromLog,
  type ErrorCodeInfo,
} from './ErrorCodeHelper';

// Activity stage definitions
export type ActivityStage =
  | 'fetching_metadata'
  | 'readying_download'
  | 'queued'
  | 'downloading'
  | 'initializing'
  | 'finished'
  | 'failed'
  | 'cancelled'
  | 'paused';

// Activity item interface
export interface ActivityItem {
  id: string;
  stage: ActivityStage;
  title: string;
  description: string;
  timestamp: string;
  status: 'active' | 'completed' | 'failed' | 'pending';
  progress?: number;
  details?: {
    progress?: string;
    speed?: string;
    timeLeft?: string;
    size?: number;
    elapsed?: number;
    error?: string;
    // Enhanced error details
    errorCode?: number | string;
    errorInfo?: ErrorCodeInfo;
    canRetry?: boolean;
  };
}

// Complete activity log for a download
export interface ActivityLog {
  downloadId: string;
  downloadName: string;
  videoUrl: string;
  currentStage: ActivityStage;
  activities: ActivityItem[];
  overallProgress: number;
  isComplete: boolean;
  hasError: boolean;
  startTime?: string;
  endTime?: string;
  // Enhanced error information
  errorCode?: number | string;
  errorInfo?: ErrorCodeInfo;
  canRetry?: boolean;
}

/**
 * Get activity log for a specific download
 * @param downloadId - The ID of the download to track
 * @returns ActivityLog object with complete activity information
 */
export function getDownloadActivityLog(downloadId: string): ActivityLog | null {
  const store = useDownloadStore.getState();

  // Find the download in all possible states
  const allDownloads = [
    ...store.forDownloads,
    ...store.downloading,
    ...store.finishedDownloads,
    ...store.failedDownloads,
    ...store.queuedDownloads,
  ];

  const download = allDownloads.find((d) => d.id === downloadId);

  if (!download) {
    return null;
  }

  const activities: ActivityItem[] = [];
  let currentStage: ActivityStage = 'fetching_metadata';
  let overallProgress = 0;
  let isComplete = false;
  let hasError = false;

  // Determine current stage and error state first
  if (store.failedDownloads.find((d) => d.id === downloadId)) {
    hasError = true;
    // For failed downloads, determine how far they got before failing
    const failedDownload = download as Downloading;
    if (failedDownload.status === 'failed') {
      // Check progress to determine where it failed
      if (failedDownload.progress > 0) {
        if (failedDownload.progress >= 95) {
          currentStage = 'initializing' as ActivityStage;
        } else {
          currentStage = 'downloading' as ActivityStage;
        }
      } else {
        currentStage = 'readying_download';
      }
    } else {
      currentStage = 'failed';
    }
    overallProgress = Math.min(failedDownload.progress || 0, 90);
  } else if (store.finishedDownloads.find((d) => d.id === downloadId)) {
    currentStage = 'finished';
    overallProgress = 100;
    isComplete = true;
  } else if (store.downloading.find((d) => d.id === downloadId)) {
    const downloadingItem = download as Downloading;

    // Check if download failed while in downloading state
    if (downloadingItem.status === 'failed') {
      hasError = true;
      currentStage = 'failed';
      overallProgress = Math.min(downloadingItem.progress || 0, 90);
    } else if (downloadingItem.status === 'paused') {
      // Priority check: if status is paused, don't override with log-based analysis
      currentStage = 'paused';
      overallProgress = Math.min(20 + downloadingItem.progress * 0.7, 90);
    } else if (
      downloadingItem.status === 'initializing' ||
      (downloadingItem.log &&
        (downloadingItem.log.includes('[Merger]') ||
          downloadingItem.log.includes('[VideoRemuxer]')))
    ) {
      currentStage = 'initializing';
      overallProgress = 95;
    } else {
      currentStage = 'downloading';
      overallProgress = Math.min(20 + downloadingItem.progress * 0.7, 90);
    }
  } else if (store.queuedDownloads.find((d) => d.id === downloadId)) {
    currentStage = 'queued';
    overallProgress = 15;
  } else if (store.forDownloads.find((d) => d.id === downloadId)) {
    currentStage =
      download.status === 'fetching metadata'
        ? 'fetching_metadata'
        : 'readying_download';
    overallProgress = 10;
  }

  // Build activity timeline dynamically based on actual stages reached

  // Stage 1: Fetching metadata - always present
  activities.push(
    createActivityItem(
      'metadata',
      'fetching_metadata',
      'Fetching metadata',
      `Download ID: ${downloadId.substring(0, 30)}...`,
      download.DateAdded,
      currentStage === 'fetching_metadata' ? 'active' : 'completed',
    ),
  );

  // Stage 2: Readying download - only if we progressed past fetching metadata
  if (currentStage !== 'fetching_metadata') {
    const progressDetails = buildProgressDetails(download as Downloading);
    activities.push(
      createActivityItem(
        'ready',
        'readying_download',
        'Readying Download',
        progressDetails,
        download.DateAdded,
        currentStage === 'readying_download' ? 'active' : 'completed',
      ),
    );
  }

  // Stage 3: Queued - only if the download was actually queued
  const wasQueued = store.queuedDownloads.find((d) => d.id === downloadId);
  const isInLaterStage =
    currentStage === 'downloading' ||
    currentStage === 'paused' ||
    currentStage === 'initializing' ||
    currentStage === 'finished' ||
    currentStage === 'failed' ||
    currentStage === 'cancelled';

  if (wasQueued || isInLaterStage) {
    activities.push(
      createActivityItem(
        'queue',
        'queued',
        'Queued',
        `Position in queue: ${
          store.queuedDownloads.findIndex((d) => d.id === downloadId) + 1
        }`,
        (download as QueuedDownload).queuedAt || download.DateAdded,
        currentStage === 'queued' ? 'active' : 'completed',
      ),
    );
  }

  // Stage 4: Downloading - only if download actually started
  if (
    currentStage === 'downloading' ||
    currentStage === 'paused' ||
    currentStage === 'initializing' ||
    isComplete ||
    (hasError && currentStage === 'failed')
  ) {
    const downloadingItem = download as Downloading;
    const isActive = currentStage === 'downloading';
    const isPaused = currentStage === 'paused';

    // Determine status based on current state
    let status: 'active' | 'completed' | 'failed' | 'pending';
    if (hasError && currentStage === 'failed') {
      status = 'failed';
    } else if (isComplete) {
      status = 'completed';
    } else if (isActive) {
      status = 'active';
    } else if (isPaused) {
      status = 'pending'; // Show paused downloads as pending
    } else {
      status = 'pending';
    }

    // Extract URL for display
    const extractedUrl = extractVideoUrl(download.videoUrl);

    // Determine download phase based on progress
    const isVideoPhase = downloadingItem.progress < 51;
    const downloadPhase = isVideoPhase ? 'video' : 'audio';
    const downloadTitle = isPaused ? 'Paused' : 'Downloading';
    const downloadDescription = `Extracting URL: ${extractedUrl}`;
    const downloadProgress = isPaused
      ? `Paused at ${downloadingItem.progress}% (${downloadPhase} part)`
      : `Downloading ${downloadPhase} part - ${downloadingItem.progress}%`;

    activities.push(
      createActivityItem(
        'download',
        'downloading',
        downloadTitle,
        downloadDescription,
        download.DateAdded,
        status,
        downloadingItem.progress,
        {
          progress: downloadProgress,
          speed: isPaused ? 'Paused' : downloadingItem.speed,
          timeLeft: isPaused ? 'Paused' : downloadingItem.timeLeft,
          size: downloadingItem.size,
          elapsed: downloadingItem.elapsed,
          error: hasError ? 'Download failed during processing' : undefined,
        },
      ),
    );
  }

  // Stage 5: Initializing - only if download reached this stage and didn't fail before
  if ((currentStage === 'initializing' || isComplete) && !hasError) {
    const downloadingItem = download as Downloading;
    const initializingStatus =
      currentStage === 'initializing' ? 'active' : 'completed';

    // Progressive display based on actual logs
    const selectedExt = downloadingItem.ext || 'mp4';
    const initializingSteps: string[] = [];

    // Check logs to determine which steps have occurred
    if (downloadingItem.log) {
      const logContent = downloadingItem.log;

      // Step 1: Merger
      if (
        logContent.includes('[Merger]') ||
        logContent.includes('Merging formats')
      ) {
        initializingSteps.push(
          `[Merger] Merging formats into (${selectedExt})`,
        );
      }

      // Step 2: Deleting video file
      if (
        logContent.includes('Deleting original file') &&
        (logContent.includes('.mp4') ||
          logContent.includes('.webm') ||
          logContent.includes('.mkv'))
      ) {
        initializingSteps.push(`Deleting original file video`);
      }

      // Step 3: Deleting audio file
      if (
        logContent.includes('Deleting original file') &&
        (logContent.includes('.m4a') ||
          logContent.includes('.webm') ||
          logContent.includes('.opus'))
      ) {
        initializingSteps.push(`Deleting original file audio`);
      }

      // Step 4: VideoRemuxer
      if (logContent.includes('[VideoRemuxer]')) {
        initializingSteps.push(
          `[VideoRemuxer] Not remuxing media file - already is in target format ${selectedExt}`,
        );
      }

      // Step 5: Exit code
      if (logContent.includes('exited with code')) {
        initializingSteps.push(`exited with code: 0, signal: null`);
      }
    }

    // If no specific logs found but we're in initializing stage, show at least the first step
    if (initializingSteps.length === 0 && currentStage === 'initializing') {
      initializingSteps.push(`[Merger] Merging formats into (${selectedExt})`);
    }

    // If completed, show all steps
    if (isComplete) {
      initializingSteps.length = 0; // Clear any partial steps
      initializingSteps.push(
        `[Merger] Merging formats into (${selectedExt})`,
        `Deleting original file video`,
        `Deleting original file audio`,
        `[VideoRemuxer] Not remuxing media file - already is in target format ${selectedExt}`,
        `exited with code: 0, signal: null`,
      );
    }

    activities.push(
      createActivityItem(
        'initializing',
        'initializing',
        'Initializing',
        initializingSteps.join('\n'),
        download.DateAdded,
        initializingStatus,
      ),
    );
  }

  // Stage 6: Finished - only if download actually completed
  if (isComplete) {
    const finishedItem = download as FinishedDownloads;
    activities.push(
      createActivityItem(
        'finished',
        'finished',
        'Finished',
        `Destination: ${finishedItem.location}\\${finishedItem.downloadName}\n` +
          `${formatFileSize(finishedItem.size)}, finished, ${formatElapsedTime(
            finishedItem.elapsed,
          )}`,
        download.DateAdded,
        'completed',
      ),
    );
  }

  // Stage 7: Failed - only if download actually failed
  if (hasError) {
    const failedDownload = download as Downloading;
    let errorMessage = 'Download failed - check logs for details';
    let errorCode: number | string | undefined;
    let errorInfo: ErrorCodeInfo | undefined;
    let canRetry = true;

    // Try to extract error code from logs
    if (failedDownload.log) {
      const parsedErrorCode = parseErrorCodeFromLog(failedDownload.log);
      if (parsedErrorCode !== null) {
        errorCode = parsedErrorCode;
        errorInfo = getErrorCodeInfo(errorCode);
        canRetry = isRetryableError(errorCode);
        errorMessage = generateErrorMessage(errorCode, failedDownload.log);
      } else {
        // Try to extract more specific error from logs even without error code
        const logLines = failedDownload.log.split('\n');
        const errorLine = logLines.find(
          (line) =>
            line.includes('ERROR') ||
            line.includes('Failed') ||
            line.includes('Error') ||
            line.includes('[youtube]') ||
            line.includes('HTTP Error') ||
            line.includes('URLError') ||
            line.includes('ConnectionError') ||
            line.includes('HTTPSConnectionPool') ||
            line.includes('SSL') ||
            line.includes('TLS'),
        );

        if (errorLine) {
          errorMessage = errorLine.trim();

          // Check for YouTube format errors first (most specific)
          if (
            errorLine.includes('[youtube]') &&
            errorLine.includes('Requested format is not available')
          ) {
            errorCode = 'youtube_format_unavailable';
            errorInfo = getErrorCodeInfo(errorCode);
            canRetry = isRetryableError(errorCode);
            errorMessage = generateErrorMessage(errorCode, errorLine);
          } else if (errorLine.includes('HTTPSConnectionPool')) {
            if (
              errorLine.includes('Read timed out') ||
              errorLine.includes('timeout')
            ) {
              errorCode = 'https_pool_timeout';
              errorInfo = getErrorCodeInfo(errorCode);
              canRetry = isRetryableError(errorCode);
              errorMessage = generateErrorMessage(errorCode, errorLine);
            } else {
              errorCode = 'https_pool_error';
              errorInfo = getErrorCodeInfo(errorCode);
              canRetry = isRetryableError(errorCode);
              errorMessage = generateErrorMessage(errorCode, errorLine);
            }
          } else if (errorLine.includes('SSL') || errorLine.includes('TLS')) {
            // Handle SSL/TLS errors
            if (
              errorLine.includes('handshake') ||
              errorLine.includes('HANDSHAKE')
            ) {
              errorCode = 'ssl_handshake_error';
              errorInfo = getErrorCodeInfo(errorCode);
              canRetry = isRetryableError(errorCode);
              errorMessage = generateErrorMessage(errorCode, errorLine);
            } else if (
              errorLine.includes('certificate') ||
              errorLine.includes('CERTIFICATE')
            ) {
              errorCode = 'ssl_certificate_error';
              errorInfo = getErrorCodeInfo(errorCode);
              canRetry = isRetryableError(errorCode);
              errorMessage = generateErrorMessage(errorCode, errorLine);
            }
          } else if (errorLine.includes('HTTP Error')) {
            const httpMatch = errorLine.match(/HTTP Error (\d{3})/);
            if (httpMatch) {
              errorCode = parseInt(httpMatch[1], 10);
              errorInfo = getErrorCodeInfo(errorCode);
              canRetry = isRetryableError(errorCode);
              errorMessage = generateErrorMessage(errorCode, errorLine);
            }
          } else if (errorLine.includes('URLError')) {
            // Handle URLError patterns
            if (errorLine.includes('Name or service not known')) {
              errorCode = -2;
              errorInfo = getErrorCodeInfo(errorCode);
              canRetry = isRetryableError(errorCode);
              errorMessage = generateErrorMessage(errorCode, errorLine);
            } else if (
              errorLine.includes('Temporary failure in name resolution')
            ) {
              errorCode = -3;
              errorInfo = getErrorCodeInfo(errorCode);
              canRetry = isRetryableError(errorCode);
              errorMessage = generateErrorMessage(errorCode, errorLine);
            }
          } else if (errorLine.includes('Connection')) {
            // Handle connection errors
            if (errorLine.includes('Connection refused')) {
              errorCode = 61;
              errorInfo = getErrorCodeInfo(errorCode);
              canRetry = isRetryableError(errorCode);
              errorMessage = generateErrorMessage(errorCode, errorLine);
            } else if (errorLine.includes('Connection reset')) {
              errorCode = 54;
              errorInfo = getErrorCodeInfo(errorCode);
              canRetry = isRetryableError(errorCode);
              errorMessage = generateErrorMessage(errorCode, errorLine);
            } else if (errorLine.includes('Connection timed out')) {
              errorCode = 110;
              errorInfo = getErrorCodeInfo(errorCode);
              canRetry = isRetryableError(errorCode);
              errorMessage = generateErrorMessage(errorCode, errorLine);
            }
          }
        }
      }
    }

    // Create enhanced error activity
    activities.push(
      createActivityItem(
        'error',
        'failed',
        errorInfo ? `${errorInfo.title}` : 'Failed',
        errorMessage,
        download.DateAdded,
        'failed',
        undefined,
        {
          error: errorMessage,
          errorCode: errorCode,
          errorInfo: errorInfo,
          canRetry: canRetry,
        },
      ),
    );
  }

  return {
    downloadId,
    downloadName: download.name,
    videoUrl: download.videoUrl,
    currentStage,
    activities,
    overallProgress,
    isComplete,
    hasError,
    startTime: download.DateAdded,
    endTime: isComplete || hasError ? new Date().toISOString() : undefined,
    // Enhanced error information
    errorCode: hasError
      ? activities.find((a) => a.stage === 'failed')?.details?.errorCode
      : undefined,
    errorInfo: hasError
      ? activities.find((a) => a.stage === 'failed')?.details?.errorInfo
      : undefined,
    canRetry: hasError
      ? activities.find((a) => a.stage === 'failed')?.details?.canRetry
      : undefined,
  };
}

/**
 * Get activity logs for all downloads
 * @returns Array of ActivityLog objects for all downloads
 */
export function getAllDownloadActivityLogs(): ActivityLog[] {
  const store = useDownloadStore.getState();

  const allDownloadIds = [
    ...store.forDownloads.map((d) => d.id),
    ...store.downloading.map((d) => d.id),
    ...store.finishedDownloads.map((d) => d.id),
    ...store.failedDownloads.map((d) => d.id),
    ...store.queuedDownloads.map((d) => d.id),
  ];

  return allDownloadIds
    .map((id) => getDownloadActivityLog(id))
    .filter((log): log is ActivityLog => log !== null)
    .sort(
      (a, b) =>
        new Date(b.startTime || '').getTime() -
        new Date(a.startTime || '').getTime(),
    );
}

/**
 * Get current active downloads with their activity status
 * @returns Array of ActivityLog objects for active downloads
 */
export function getActiveDownloadActivities(): ActivityLog[] {
  const store = useDownloadStore.getState();

  const activeDownloadIds = [
    ...store.forDownloads.map((d) => d.id),
    ...store.downloading.map((d) => d.id),
    ...store.queuedDownloads.map((d) => d.id),
  ];

  return activeDownloadIds
    .map((id) => getDownloadActivityLog(id))
    .filter(
      (log): log is ActivityLog =>
        log !== null && !log.isComplete && !log.hasError,
    );
}

// Helper function to create activity items
function createActivityItem(
  id: string,
  stage: ActivityStage,
  title: string,
  description: string,
  timestamp: string,
  status: 'active' | 'completed' | 'failed' | 'pending',
  progress?: number,
  details?: {
    speed?: string;
    timeLeft?: string;
    size?: number;
    elapsed?: number;
    error?: string;
    progress?: string;
    // Enhanced error details
    errorCode?: number | string;
    errorInfo?: ErrorCodeInfo;
    canRetry?: boolean;
  },
): ActivityItem {
  return {
    id,
    stage,
    title,
    description,
    timestamp,
    status,
    progress,
    details,
  };
}

// Helper function to extract and format video URL
function extractVideoUrl(fullUrl: string): string {
  try {
    const url = new URL(fullUrl);
    if (
      url.hostname.includes('youtube.com') ||
      url.hostname.includes('youtu.be')
    ) {
      return fullUrl;
    }
    return url.hostname + url.pathname;
  } catch {
    return fullUrl.length > 50 ? fullUrl.substring(0, 50) + '...' : fullUrl;
  }
}

// Helper function to build progress details
function buildProgressDetails(download: Downloading): string {
  const parts: string[] = [];

  // Always show the youtube extraction line with the video name
  if (download.name) {
    parts.push(`[youtube] ${download.name}`);
  }

  // Always show these download steps
  parts.push(`Downloading webpage`);
  parts.push(`Downloading Youtube player API JSON`);
  parts.push(`Downloading ios player API JSON`);
  parts.push(`Downloading m3u8 information`);

  // Format the download formats (video+audio)
  const videoFormat = download.formatId || 'unknown';
  const audioFormat = download.audioFormatId || '';
  const formatString = audioFormat
    ? `${videoFormat}+${audioFormat}`
    : videoFormat;
  parts.push(`Downloading 1 format(s): ${formatString}`);

  return parts.join('\n');
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// Helper function to format elapsed time
function formatElapsedTime(seconds: number | undefined): string {
  if (!seconds) return '00:00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Subscribe to download activity updates
 * @param downloadId - The download ID to subscribe to
 * @param callback - Callback function to receive updates
 * @returns Unsubscribe function
 */
export function subscribeToDownloadActivity(
  downloadId: string,
  callback: (activityLog: ActivityLog | null) => void,
): () => void {
  // Set up a subscription to the download store
  const unsubscribe = useDownloadStore.subscribe((state) => {
    const activityLog = getDownloadActivityLog(downloadId);
    callback(activityLog);
  });

  // Return unsubscribe function
  return unsubscribe;
}

/**
 * Get activity summary for dashboard/statistics
 * @returns Summary of all download activities
 */
export interface ActivitySummary {
  totalDownloads: number;
  activeDownloads: number;
  completedDownloads: number;
  failedDownloads: number;
  queuedDownloads: number;
  totalDataDownloaded: number;
  averageDownloadTime: number;
}

export function getActivitySummary(): ActivitySummary {
  const store = useDownloadStore.getState();

  const totalDownloads = store.historyDownloads.length;
  const activeDownloads = store.downloading.length;
  const completedDownloads = store.finishedDownloads.length;
  const failedDownloads = store.failedDownloads.length;
  const queuedDownloads = store.queuedDownloads.length;

  const totalDataDownloaded = store.finishedDownloads.reduce(
    (total, download) => {
      return total + (download.size || 0);
    },
    0,
  );

  const averageDownloadTime =
    store.finishedDownloads.length > 0
      ? store.finishedDownloads.reduce((total, download) => {
          return total + (download.elapsed || 0);
        }, 0) / store.finishedDownloads.length
      : 0;

  return {
    totalDownloads,
    activeDownloads,
    completedDownloads,
    failedDownloads,
    queuedDownloads,
    totalDataDownloaded,
    averageDownloadTime,
  };
}
