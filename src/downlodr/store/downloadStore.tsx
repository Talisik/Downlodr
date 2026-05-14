/**
 * Backward compatibility wrapper for downloadStore
 *
 * This file re-exports the refactored download store to maintain
 * backward compatibility with existing imports.
 *
 * NEW LOCATION: src/Store/download/downloadStore.ts
 *
 * Migration: Update imports to use the new location:
 * - OLD: import useDownloadStore from '@/Store/downloadStore'
 * - NEW: import useDownloadStore from '@/Store/download'
 */

// Re-export everything from the refactored store
export {
  default as useDownloadStore,
  useDownloadingSelectors,
  PerformanceMonitor,
  checkIndexedDBUsage,
  checkLocalStorageUsage,
  getProgressPhaseInfo,
} from './download/downloadStore';

// Re-export types for backward compatibility
export type {
  Downloading,
  FinishedDownloads,
  FailedDownloads,
  HistoryDownloads,
  ForDownload,
  QueuedDownload,
  BaseDownload,
  SpeedDataPoint,
} from './download/types';

// Default export for backward compatibility
import useDownloadStoreDefault from './download/downloadStore';
export default useDownloadStoreDefault;
