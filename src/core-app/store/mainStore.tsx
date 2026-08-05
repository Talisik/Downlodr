/**
 *
 * This file defines a Zustand store for managing application-wide settings
 * and selected downloads. It provides functionalities to update settings
 * such as default download location, speed, and connection limits.
 *
 * Dependencies:
 * - Zustand: A small, fast state-management solution.
 * - Zustand middleware for persistence.
 */

// Interface for download settings
import { createIndexedDBStorageWithMigration } from '@/core-app/utils/indexedDBStorage';
import { TaskBarButtonsVisibility } from '@/plugins/schema/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Main interface for the main store
interface MainStore {
  visibleColumns: string[];
  setVisibleColumns: (columns: string[]) => void;
  taskBarButtonsVisibility: TaskBarButtonsVisibility; // State for task bar buttons visibility
  setTaskBarButtonsVisibility: (
    visibility: Partial<TaskBarButtonsVisibility>,
  ) => void; // Set the visibility of the task bar buttons
  isNavCollapsed: boolean; // State for sidebar navigation collapse
  setIsNavCollapsed: (value: boolean) => void; // Set the collapse state of the sidebar navigation
  isDownloadDetailExpanded: boolean; // State for download detail expansion
  setIsDownloadDetailExpanded: (value: boolean) => void; // Set the expansion state of the download detail
}

// version constant for migration tracking
const MAIN_STORE_VERSION = 1; // Incremented for update notification preferences

// Interface for legacy persisted state structure
interface LegacyPersistedState {
  visibleColumns?: string[];
  taskBarButtonsVisibility?: Partial<TaskBarButtonsVisibility>;
  isNavCollapsed?: boolean;
  isDownloadDetailExpanded?: boolean;
  [key: string]: unknown; // Allow for other potential fields
}

// migration function
const migrateMainStore = (persistedState: unknown, version: number) => {
  console.log(
    `Migrating mainStore from version ${version} to ${MAIN_STORE_VERSION}`,
  );

  // If no version exists, this is a legacy state - migrate to current structure
  if (version === undefined || version === 0) {
    // Define default serializable state only (excluding temporary session state)
    const defaultState = {
      visibleColumns: [
        'name',
        'size',
        'format',
        'status',
        'speed',
        'dateAdded',
        'source',
        'transcript',
        'thumbnail',
        'action',
      ],
      taskBarButtonsVisibility: {
        start: true,
        stop: true,
        stopAll: true,
      },
      isNavCollapsed: true,
      isDownloadDetailExpanded: false,
    };

    // Merge existing settings with defaults if they exist
    if (persistedState && typeof persistedState === 'object') {
      const legacy = persistedState as LegacyPersistedState;
      const migratedState = {
        ...defaultState,
        // Preserve other persisted data if it exists and is valid
        visibleColumns: Array.isArray(legacy.visibleColumns)
          ? legacy.visibleColumns
          : defaultState.visibleColumns,
        taskBarButtonsVisibility: {
          ...defaultState.taskBarButtonsVisibility,
          ...legacy.taskBarButtonsVisibility,
        },
        isNavCollapsed:
          typeof legacy.isNavCollapsed === 'boolean'
            ? legacy.isNavCollapsed
            : defaultState.isNavCollapsed,
        isDownloadDetailExpanded:
          typeof legacy.isDownloadDetailExpanded === 'boolean'
            ? legacy.isDownloadDetailExpanded
            : defaultState.isDownloadDetailExpanded,
      };

      console.log('Successfully migrated mainStore to version 1');
      return migratedState;
    }

    console.log('No valid persisted state found, using default state');
    return defaultState;
  }

  // If version is already current or newer, return as-is
  if (version >= MAIN_STORE_VERSION) {
    return persistedState;
  }

  // If version is current or higher, return as-is
  return persistedState;
};

// Create the main store with persistence
export const useMainStore = create<MainStore>()(
  persist(
    (set, get) => ({
      // Default visible columns
      visibleColumns: [
        'name',
        'size',
        'format',
        'status',
        'speed',
        'dateAdded',
        'source',
        'transcript',
        'thumbnail',
        'action',
      ],
      // Set visible columns
      setVisibleColumns: (columns) => set({ visibleColumns: columns }),

      // Default task bar buttons visibility
      taskBarButtonsVisibility: {
        start: true,
        stop: true,
        stopAll: true,
      },
      setTaskBarButtonsVisibility: (visibility) =>
        set((state) => ({
          taskBarButtonsVisibility: {
            ...state.taskBarButtonsVisibility,
            ...visibility,
          },
        })),

      isNavCollapsed: true,
      setIsNavCollapsed: (value) => set({ isNavCollapsed: value }),

      isDownloadDetailExpanded: false,
      setIsDownloadDetailExpanded: (value) =>
        set({ isDownloadDetailExpanded: value }),
    }),
    {
      name: 'download-main-storage', // Name of the storage
      version: MAIN_STORE_VERSION, // version tracking
      storage: createJSONStorage(() =>
        createIndexedDBStorageWithMigration({
          dbName: 'downlodr-main-database',
          storeName: 'main-storage',
          version: 1,
          localStorageKey: 'download-main-storage', // Migrate existing localStorage data
        }),
      ), // Use IndexedDB with automatic localStorage migration
      migrate: migrateMainStore, // migration function
      // Exclude temporary session state from persistence
      partialize: (state) => ({
        visibleColumns: state.visibleColumns,
        taskBarButtonsVisibility: state.taskBarButtonsVisibility,
        isNavCollapsed: state.isNavCollapsed,
        isDownloadDetailExpanded: state.isDownloadDetailExpanded,
        // Explicitly exclude temporary session state:
        // - selectedDownloads
        // - selectedRows
        // - selectedRowIds
        // - isDownloadModalOpen
        // - isExitModalOpen
      }),
    },
  ),
);
