/* eslint-disable prettier/prettier */
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
    DownloadStoreState,
    FailedDownloads,
    FinishedDownloads,
    ForDownload,
    HistoryDownloads,
    ProgressPhaseInfo,
    QueuedDownload,
    SpeedDataPoint
} from './types';

// Export utilities
export {
    getProgressPhaseInfo,
    truncateTitle,
    updateDownloadCategories,
    updateDownloadsInAllArrays,
    updateDownloadTags,
    uuidv4
} from './utils';

// Export storage utilities
export {
    checkIndexedDBUsage,
    checkLocalStorageUsage,
    createDebouncedStorage,
    DOWNLOAD_STORE_VERSION
} from './storage';

// Export migration
export { migrateDownloadStore } from './migration';

// Export controller
export { DownloadController } from './controller';
export type { DownloadStoreInterface } from './controller';

// Export selectors
export { createDownloadSelectors, PerformanceMonitor } from './selectors';

// Export actions (for testing or external use)
export {
    createCrudActions,
    createDownloadActions,
    createLifecycleActions,
    createMiscActions,
    createQueueActions,
    createTagsCategoriesActions
} from './actions';

// Export the main store
export {
    useDownloadingSelectors,
    default as useDownloadStore
} from './downloadStore';
export type { default as DownloadStore } from './downloadStore';

