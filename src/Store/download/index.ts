/**
 * Download store module - centralized exports
 * 
 * This module provides a refactored, modular download store implementation.
 * The store has been split into smaller, focused modules for better maintainability.
 */

// Export types
export type {
  BaseDownload,
  Downloading,
  DownloadStatus,
  FailedDownloads,
  FinishedDownloads,
  ForDownload,
  HistoryDownloads,
  QueuedDownload,
  DownloadStoreState,
  ProgressPhaseInfo,
  SpeedDataPoint,
} from './types';

// Export utilities
export {
  truncateTitle,
  uuidv4,
  getProgressPhaseInfo,
  updateDownloadTags,
  updateDownloadCategories,
  updateDownloadsInAllArrays,
} from './utils';

// Export storage utilities
export {
  createDebouncedStorage,
  checkIndexedDBUsage,
  checkLocalStorageUsage,
  DOWNLOAD_STORE_VERSION,
} from './storage';

// Export migration
export { migrateDownloadStore } from './migration';

// Export controller
export { DownloadController } from './controller';
export type { DownloadStoreInterface } from './controller';

// Export selectors
export { createDownloadSelectors, PerformanceMonitor } from './selectors';

// Export the main store
export { default as useDownloadStore, useDownloadingSelectors } from './downloadStore';
export type { default as DownloadStore } from './downloadStore';

