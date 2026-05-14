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
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Interface for selected downloads
interface SelectedDownload {
  id: string; // Unique identifier for the selected download
  controllerId?: string; // ID of the controller managing the download
  location?: string; // Location of the download
  videoUrl?: string;
  downloadName?: string;
  status?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  download?: any;
}

// Main interface for the main store
interface SelectedDownloadStore {
  getSelectedWithStatusCount: () => number;
  selectedDownloads: SelectedDownload[]; // List of currently selected downloads
  setSelectedDownloads: (downloads: SelectedDownload[]) => void; // Set selected downloads
  clearSelectedDownloads: () => void; // Clear selected downloads
  selectedRows: string[]; // List of selected row IDs
  setSelectedRows: (rows: string[]) => void; // Set selected rows
  clearSelectedRows: () => void; // Clear selected rows
  selectedRowIds: string[]; // List of selected row IDs
  setSelectedRowIds: (rows: string[]) => void; // Set selected row IDs
  clearAllSelections: () => void; // Clear all selections
}

// version constant for migration tracking
const SELECTED_DOWNLOAD_STORE_VERSION = 1; // Incremented for update notification preferences

// Create the main store with persistence
export const useSelectedDownloadStore = create<SelectedDownloadStore>()(
  persist(
    (set, get) => ({
      selectedDownloads: [] as SelectedDownload[],

      setSelectedDownloads: (downloads) =>
        set({ selectedDownloads: downloads }),
      clearSelectedDownloads: () => set({ selectedDownloads: [] }),

      selectedRows: [] as string[],
      setSelectedRows: (rows) => set({ selectedRows: rows }),
      clearSelectedRows: () => set({ selectedRows: [] }),
      getSelectedWithStatusCount: () =>
        get().selectedRowIds.filter((id) =>
          get().selectedDownloads.some((d) => d.id === id && d.status),
        ).length,
      selectedRowIds: [] as string[],
      setSelectedRowIds: (rows) =>
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        set((state) => {
          // Update both selectedRowIds and selectedDownloads
          const selectedDownloadsData: SelectedDownload[] = rows.map((id) => ({
            id,
            controllerId: undefined as string | undefined,
            location: undefined as string | undefined,
            videoUrl: undefined as string | undefined,
            downloadName: undefined as string | undefined,
            status: undefined as string | undefined,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            download: undefined as any | undefined,
          }));
          return {
            selectedRowIds: rows,
            selectedDownloads: selectedDownloadsData,
          };
        }),
      clearAllSelections: () =>
        set({
          selectedDownloads: [],
          selectedRowIds: [],
        }),
      // Default visible columns
    }),
    {
      name: 'download-selected-download-storage', // Name of the storage
      version: SELECTED_DOWNLOAD_STORE_VERSION, // version tracking
      storage: createJSONStorage(() =>
        createIndexedDBStorageWithMigration({
          dbName: 'downlodr-selected-download-database',
          storeName: 'selected-download-storage',
          version: 1,
          localStorageKey: 'selected-download-storage', // Migrate existing localStorage data
        }),
      ), // Use IndexedDB with automatic localStorage migration
    },
  ),
);
