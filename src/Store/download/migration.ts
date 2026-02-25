/**
 * Migration logic for the download store
 * Handles version upgrades and data transformations
 */

import {
  Downloading,
  FailedDownloads,
  FinishedDownloads,
  ForDownload,
  HistoryDownloads,
  QueuedDownload,
} from './types';
import { DOWNLOAD_STORE_VERSION } from './storage';

/**
 * Create safe default state
 */
function createDefaultState() {
  return {
    forDownloads: [] as ForDownload[],
    downloading: [] as Downloading[],
    finishedDownloads: [] as FinishedDownloads[],
    failedDownloads: [] as FailedDownloads[],
    historyDownloads: [] as HistoryDownloads[],
    queuedDownloads: [] as QueuedDownload[],
    availableTags: [] as string[],
    availableCategories: [] as string[],
  };
}

/**
 * Migrate download store from one version to another
 */
export function migrateDownloadStore(
  persistedState: any,
  version: number,
): any {
  console.log(
    `Migrating downloadStore from version ${version} to ${DOWNLOAD_STORE_VERSION}`,
  );

  const defaultState = createDefaultState();

  // If no version exists, this is a legacy state - migrate to current structure
  if (version === undefined || version === 0) {
    if (!persistedState || typeof persistedState !== 'object') {
      console.log('No valid persisted state found, using default state');
      return defaultState;
    }

    try {
      // Simple migration with essential field updates
      const migratedState = {
        ...defaultState,
        forDownloads: Array.isArray((persistedState as any).forDownloads)
          ? (persistedState as any).forDownloads.map((download: any) => ({
              ...download,
              downloadPhase: download.downloadPhase || 'video',
              completionCount: download.completionCount || 0,
              rawProgress: download.rawProgress || download.progress || 0,
              speedHistory: download.speedHistory || [],
              tags: download.tags || [],
              category: download.category || [],
            }))
          : defaultState.forDownloads,

        downloading: Array.isArray((persistedState as any).downloading)
          ? (persistedState as any).downloading.map((download: any) => ({
              ...download,
              downloadPhase: download.downloadPhase || 'video',
              completionCount: download.completionCount || 0,
              rawProgress: download.rawProgress || download.progress || 0,
              speedHistory: download.speedHistory || [],
              tags: download.tags || [],
              category: download.category || [],
            }))
          : defaultState.downloading,

        finishedDownloads: Array.isArray(
          (persistedState as any).finishedDownloads,
        )
          ? (persistedState as any).finishedDownloads.map((download: any) => ({
              ...download,
              downloadPhase: download.downloadPhase || 'video',
              completionCount: download.completionCount || 2,
              rawProgress: download.rawProgress || 100,
              speedHistory: download.speedHistory || [],
              tags: download.tags || [],
              category: download.category || [],
              transcriptLocation:
                download.transcriptLocation ||
                download.autoCaptionLocation ||
                '',
            }))
          : defaultState.finishedDownloads,

        failedDownloads: Array.isArray((persistedState as any).failedDownloads)
          ? (persistedState as any).failedDownloads.map((download: any) => ({
              ...download,
              downloadPhase: download.downloadPhase || 'video',
              completionCount: download.completionCount || 0,
              rawProgress: download.rawProgress || download.progress || 0,
              speedHistory: download.speedHistory || [],
              tags: download.tags || [],
              category: download.category || [],
              transcriptLocation:
                download.transcriptLocation ||
                download.autoCaptionLocation ||
                '',
              failureReason:
                download.failureReason || 'Download process failed',
              canRetry: download.canRetry !== false,
            }))
          : defaultState.failedDownloads,

        historyDownloads: Array.isArray(
          (persistedState as any).historyDownloads,
        )
          ? (persistedState as any).historyDownloads.map((download: any) => ({
              ...download,
              downloadPhase: download.downloadPhase || 'video',
              completionCount:
                download.completionCount ||
                (download.status === 'finished' ? 2 : 0),
              rawProgress: download.rawProgress || download.progress || 0,
              speedHistory: download.speedHistory || [],
              tags: download.tags || [],
              category: download.category || [],
              transcriptLocation:
                download.transcriptLocation ||
                download.autoCaptionLocation ||
                '',
            }))
          : defaultState.historyDownloads,

        queuedDownloads: Array.isArray((persistedState as any).queuedDownloads)
          ? (persistedState as any).queuedDownloads.map((download: any) => ({
              ...download,
              downloadPhase: download.downloadPhase || 'video',
              completionCount: download.completionCount || 0,
              rawProgress: download.rawProgress || 0,
              speedHistory: download.speedHistory || [],
              tags: download.tags || [],
              category: download.category || [],
              queuedAt: download.queuedAt || new Date().toISOString(),
            }))
          : defaultState.queuedDownloads,

        availableTags: Array.isArray((persistedState as any).availableTags)
          ? (persistedState as any).availableTags
          : defaultState.availableTags,

        availableCategories: Array.isArray(
          (persistedState as any).availableCategories,
        )
          ? (persistedState as any).availableCategories
          : defaultState.availableCategories,
      };

      console.log('Successfully migrated downloadStore to version 1');
      return migratedState;
    } catch (error) {
      console.error('Migration error, using default state:', error);
      return defaultState;
    }
  }

  // Handle migration from version 1 to version 2 (add displayName field)
  if (version === 1) {
    console.log('Migrating downloadStore from version 1 to version 2');

    const addDisplayName = (download: any) => ({
      ...download,
      displayName: download.displayName || download.name || '',
    });

    const migratedState = {
      ...persistedState,
      forDownloads: Array.isArray(persistedState.forDownloads)
        ? persistedState.forDownloads.map(addDisplayName)
        : [],
      downloading: Array.isArray(persistedState.downloading)
        ? persistedState.downloading.map(addDisplayName)
        : [],
      finishedDownloads: Array.isArray(persistedState.finishedDownloads)
        ? persistedState.finishedDownloads.map(addDisplayName)
        : [],
      failedDownloads: Array.isArray(persistedState.failedDownloads)
        ? persistedState.failedDownloads.map(addDisplayName)
        : [],
      historyDownloads: Array.isArray(persistedState.historyDownloads)
        ? persistedState.historyDownloads.map(addDisplayName)
        : [],
      queuedDownloads: Array.isArray(persistedState.queuedDownloads)
        ? persistedState.queuedDownloads.map(addDisplayName)
        : [],
    };

    console.log('Successfully migrated downloadStore to version 2');
    return migratedState;
  }

  // Handle future migrations here
  if (version >= DOWNLOAD_STORE_VERSION) {
    return persistedState;
  }

  return persistedState;
}

