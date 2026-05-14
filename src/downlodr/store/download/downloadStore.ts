/**
 * Zustand store for managing downloads in the application.
 *
 * REFACTORED VERSION - Uses modular structure for better maintainability
 *
 * This store has been split into focused modules:
 * - types.ts: All TypeScript interfaces
 * - utils.ts: Utility functions
 * - storage.ts: Storage utilities
 * - migration.ts: Data migration logic
 * - controller.ts: DownloadController for queue management
 * - selectors.ts: Optimized selectors
 *
 * CLEANED UP TWO-PHASE DOWNLOAD SYSTEM:
 *
 * The download process now follows a clear, reliable flow:
 *
 * 1. QUEUE MANAGEMENT:
 *    - Downloads are queued and processed by the DownloadController
 *    - Respects maxDownloadNum setting for concurrent downloads
 *    - Uses Token Bucket algorithm for rate limiting
 *
 * 2. PHASE 1 - VIDEO DOWNLOAD (0-50%):
 *    - downloadPhase: 'video'
 *    - rawProgress: 0-100% (actual engine progress)
 *    - progress: 0-50% (display progress)
 *    - When rawProgress reaches 100%, completionCount increases to 1
 *    - Switches to audio phase
 *
 * 3. PHASE 2 - AUDIO DOWNLOAD (51-100%):
 *    - downloadPhase: 'audio'
 *    - rawProgress: 0-100% (actual engine progress for audio)
 *    - progress: 51-100% (display progress)
 *    - When rawProgress reaches 100%, completionCount increases to 2
 *    - Status changes to 'initializing' (waiting for merger)
 *
 * 4. PHASE 3 - MERGING & PROCESSING:
 *    - status: 'initializing'
 *    - progress: 100%
 *    - Detected via log messages: "[Merger]" or "Merging formats"
 *    - Followed by "[VideoRemuxer]" messages
 *    - No progress updates during this phase
 *
 * 5. COMPLETION:
 *    - Detected via log message: "Process 'id' exited with code: X"
 *    - Exit code 0 = success (status: 'finished')
 *    - Exit code != 0 = failure (status: 'failed')
 *    - Moved to finishedDownloads and historyDownloads
 *    - Queue processing continues
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createIndexedDBStorageWithMigration } from '@/core-app/utils/indexedDBStorage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Import from extracted modules
import { transcriptActions } from '@/transcript/store/transcriptStore';
import {
  createCrudActions,
  createDownloadActions,
  createLifecycleActions,
  createMiscActions,
  createQueueActions,
  createTagsCategoriesActions,
} from './actions';
import { DownloadController } from './controller';
import type {
  AddDownloadPayload,
  AddQueuePayload,
  RetryDownloadPayload,
  SetDownloadOptions,
} from './downloadPayloads';
import { migrateDownloadStore } from './migration';
import { createDebouncedStorage, DOWNLOAD_STORE_VERSION } from './storage';
import {
  type Downloading,
  type DownloadStoreState,
  type FailedDownloads,
  type FinishedDownloads,
  type ForDownload,
  type HistoryDownloads,
  type QueuedDownload,
} from './types';

// Get the singleton controller instance
const downloadController = DownloadController.getInstance();

// Main interface for the download store (extends state with methods from actions)
interface DownloadStore extends DownloadStoreState {
  clearStuckTranscriptionStatus: () => void;
  updateDownloadTranscript: (id: string, transcriptLocation: string) => void;
  checkFinishedDownloads: () => void;
  updateDownload: (id: string, result: unknown) => void;
  addDownload: (payload: AddDownloadPayload) => Promise<void>;
  retryDownload: (payload: RetryDownloadPayload) => Promise<void>;
  setDownload: (
    videoUrl: string,
    location: string,
    limitRate: string,
    options?: SetDownloadOptions,
    subscriptionId?: string | undefined,
  ) => Promise<string | undefined>;
  deleteDownload: (id: string) => void;
  deleteDownloading: (id: string) => void;
  removeFromForDownloads: (id: string) => void;
  addTag: (downloadId: string, tag: string) => void;
  removeTag: (downloadId: string, tag: string) => void;
  addCategory: (downloadId: string, category: string) => void;
  removeCategory: (downloadId: string, category: string) => void;
  renameCategory: (oldName: string, newName: string) => void;
  deleteCategory: (category: string) => void;
  renameTag: (oldName: string, newName: string) => void;
  deleteTag: (tag: string) => void;
  updateDownloadStatus: (
    id: string,
    status:
      | 'downloading'
      | 'finished'
      | 'failed'
      | 'cancelled'
      | 'initializing'
      | 'fetching metadata'
      | 'paused',
  ) => void;
  renameDownload: (downloadId: string, newName: string) => void;
  addQueue: (payload: AddQueuePayload) => void;
  processQueue: () => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  moveQueueItem: (id: string, direction: 'up' | 'down') => void;
  getQueuePosition: (id: string) => number;
  cleanup: () => void;
  checkStalledDownloads: () => void;
  manualCheckStalledDownloads: () => void;
  removeFailedDownload: (id: string) => void;
  clearFailedDownloads: () => void;
  testLocalStorage: () => void;
}

const useDownloadStore = create<DownloadStore>()(
  persist(
    (set, get) => {
      const { clearStuckTranscriptionStatus } = transcriptActions(set, get);
      return {
        clearStuckTranscriptionStatus,
        // Initial state
        forDownloads: [] as ForDownload[],
        downloading: [] as Downloading[],
        finishedDownloads: [] as FinishedDownloads[],
        failedDownloads: [] as FailedDownloads[],
        historyDownloads: [] as HistoryDownloads[],
        queuedDownloads: [] as QueuedDownload[],
        availableTags: [] as string[],
        availableCategories: [] as string[],

        ...createMiscActions(set, get),
        ...createLifecycleActions(set, get),
        ...createCrudActions(set, get),
        ...createDownloadActions(set, get),
        ...createQueueActions(set, get),
        ...createTagsCategoriesActions(set, get),
      };
    },
    {
      name: 'downlodr-storage',
      version: DOWNLOAD_STORE_VERSION,
      storage: createJSONStorage(() =>
        createDebouncedStorage(
          createIndexedDBStorageWithMigration({
            dbName: 'downlodr-database',
            storeName: 'zustand-storage',
            version: 1,
            localStorageKey: 'downlodr-storage',
          }),
          250, // Debounce IndexedDB writes by 250ms (faster than default 500ms for better responsiveness)
        ),
      ),
      partialize: (state) => ({
        historyDownloads: state.historyDownloads,
        availableTags: state.availableTags,
        availableCategories: state.availableCategories,
        finishedDownloads: state.finishedDownloads,
        failedDownloads: state.failedDownloads,
        forDownloads: state.forDownloads.map((download) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { formats, ...downloadWithoutFormats } = download;
          return downloadWithoutFormats;
        }),
        // Persist active downloads so we can rescue them as failed on next startup.
        // speedHistory is stripped to keep the payload small.
        downloading: state.downloading.map(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ({ speedHistory, ...rest }) => rest,
        ),
      }),
      migrate: migrateDownloadStore,
      onRehydrateStorage: () => {
        console.log(
          'Rehydrating download store from IndexedDB with concurrent write protection',
        );
        return (_state, error) => {
          if (error) {
            console.error('Error rehydrating download store:', error);
          } else {
            console.log('Successfully rehydrated download store');
            useDownloadStore.getState().clearStuckTranscriptionStatus();
            useDownloadStore.setState((state) => {
              const cleanedForDownloads = state.forDownloads.filter(
                (d) => d.status !== 'fetching metadata',
              );

              const existingIds = new Set([
                ...state.failedDownloads.map((f) => f.id),
                ...state.finishedDownloads.map((f) => f.id),
              ]);
              const rescued: FailedDownloads[] = state.downloading
                .filter(
                  (d) =>
                    !existingIds.has(d.id) &&
                    ['downloading', 'initializing', 'paused'].includes(
                      d.status,
                    ),
                )
                .map((d) => ({
                  ...d,
                  status: 'failed' as const,
                  transcriptLocation: d.transcriptLocation ?? '',
                  failureReason: 'App was closed during download',
                  canRetry: true,
                }));

              const newHistoryIds = new Set(
                state.historyDownloads.map((h) => h.id),
              );
              const rescuedForHistory = rescued.filter(
                (d) => !newHistoryIds.has(d.id),
              );

              return {
                downloading: [],
                forDownloads: cleanedForDownloads,
                failedDownloads: [...state.failedDownloads, ...rescued],
                historyDownloads: [
                  ...state.historyDownloads,
                  ...rescuedForHistory,
                ],
              };
            });
          }
        };
      },
    },
  ),
);

// Initialize controller with store interface after store is created
const storeInterface = {
  getState: () => ({
    queuedDownloads: useDownloadStore.getState().queuedDownloads,
    downloading: useDownloadStore.getState().downloading,
  }),
  setState: (updater: (state: any) => any) => {
    useDownloadStore.setState(updater);
  },
  updateDownload: (id: string, result: any) => {
    useDownloadStore.getState().updateDownload(id, result);
  },
  checkStalledDownloads: () => {
    useDownloadStore.getState().checkStalledDownloads();
  },
};
downloadController.setStore(storeInterface);

// Create selectors - these are Zustand hooks that can be used in components
export const useDownloadingSelectors = {
  // Get only downloading items
  downloading: () => useDownloadStore((state) => state.downloading),

  // Get downloading count without full array
  downloadingCount: () => useDownloadStore((state) => state.downloading.length),

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
    useDownloadStore((state) => state.failedDownloads.find((d) => d.id === id)),

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

// Export the store
export default useDownloadStore;

// Re-export types and utilities for convenience
export type {
  BaseDownload,
  Downloading,
  FailedDownloads,
  FinishedDownloads,
  ForDownload,
  HistoryDownloads,
  QueuedDownload,
  // eslint-disable-next-line prettier/prettier
  SpeedDataPoint
} from './types';

export { PerformanceMonitor } from './selectors';
export { checkIndexedDBUsage, checkLocalStorageUsage } from './storage';
export { getProgressPhaseInfo } from './utils';
// eslint-disable-next-line prettier/prettier

