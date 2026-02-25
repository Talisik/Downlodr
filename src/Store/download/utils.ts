/**
 * Utility functions for the download store
 */

import { BaseDownload, ProgressPhaseInfo } from './types';

/**
 * Truncate title to 30 characters at word boundary
 */
export function truncateTitle(title: string): string {
  if (title.length <= 30) return title;

  // Find the last space within the 30-character limit
  const truncated = title.slice(0, 30);
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  // If there's a space, truncate at the last complete word
  // If no space found (single long word), truncate at character limit
  if (lastSpaceIndex > 0) {
    return truncated.slice(0, lastSpaceIndex);
  } else {
    return truncated.trim();
  }
}

/**
 * Generate a UUID v4
 */
export function uuidv4(): string {
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (
      +c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
    ).toString(16),
  );
}

/**
 * Get progress phase information
 */
export function getProgressPhaseInfo(download: {
  downloadPhase: 'video' | 'audio';
  completionCount: number;
  progress: number;
  status: string;
}): ProgressPhaseInfo {
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

/**
 * Helper function to update download tags across all download arrays
 */
export function updateDownloadTags<T extends BaseDownload>(
  downloads: T[],
  downloadId: string,
  updater: (tags: string[]) => string[],
): T[] {
  return downloads.map((download) =>
    download.id === downloadId
      ? { ...download, tags: updater(download.tags || []) }
      : download,
  );
}

/**
 * Helper function to update download categories across all download arrays
 */
export function updateDownloadCategories<T extends BaseDownload>(
  downloads: T[],
  downloadId: string,
  updater: (categories: string[]) => string[],
): T[] {
  return downloads.map((download) =>
    download.id === downloadId
      ? { ...download, category: updater(download.category || []) }
      : download,
  );
}

/**
 * Helper function to update categories/tags across all download arrays
 */
export function updateDownloadsInAllArrays<T extends BaseDownload>(
  downloads: T[],
  updater: (download: T) => T,
): T[] {
  return downloads.map(updater);
}

