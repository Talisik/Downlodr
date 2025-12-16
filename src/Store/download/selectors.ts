/**
 * Selectors for the download store
 * Optimized selectors to prevent unnecessary re-renders
 */

import type { UseBoundStore, StoreApi } from 'zustand';
import type { DownloadStoreState } from './types';

/**
 * Type for the store hook
 */
type DownloadStoreHook = UseBoundStore<StoreApi<DownloadStoreState>>;

/**
 * Download selectors - memoized to prevent unnecessary re-renders
 * These are Zustand selectors that can be used with useDownloadStore()
 */
export function createDownloadSelectors(useDownloadStore: DownloadStoreHook) {
  return {
    // Get only downloading items
    downloading: () => useDownloadStore((state) => state.downloading),

    // Get downloading count without full array
    downloadingCount: () =>
      useDownloadStore((state) => state.downloading.length),

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
      useDownloadStore((state) =>
        state.failedDownloads.find((d) => d.id === id),
      ),

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
}

/**
 * Performance monitoring utility
 */
export const PerformanceMonitor = {
  updateCount: 0,
  lastUpdateTime: 0,

  trackUpdate(): void {
    this.updateCount++;
    this.lastUpdateTime = Date.now();
  },

  getStats() {
    return {
      totalUpdates: this.updateCount,
      lastUpdate: this.lastUpdateTime,
      updatesPerSecond:
        this.updateCount / ((Date.now() - this.lastUpdateTime) / 1000),
    };
  },

  reset(): void {
    this.updateCount = 0;
    this.lastUpdateTime = Date.now();
  },
};
