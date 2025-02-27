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
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface DownloadSettings {
  defaultLocation: string; // Default location for downloads
  defaultDownloadSpeed: number; // Default download speed
  defaultDownloadSpeedBit: string; // Unit for download speed (e.g., kb, mb)
  permitConnectionLimit: boolean; // Whether to permit connection limits
  maxUploadNum: number; // Maximum number of uploads allowed
  maxDownloadNum: number; // Maximum number of downloads allowed
}

// Interface for selected downloads
interface SelectedDownload {
  id: string; // Unique identifier for the selected download
  controllerId?: string; // ID of the controller managing the download
  location?: string; // Location of the download
}

// Main interface for the main store
interface MainStore {
  settings: DownloadSettings; // Current download settings
  selectedDownloads: SelectedDownload[]; // List of currently selected downloads
  setSelectedDownloads: (downloads: SelectedDownload[]) => void; // Set selected downloads
  clearSelectedDownloads: () => void; // Clear selected downloads
  updateDefaultLocation: (location: string) => void; // Update default download location
  updateDefaultDownloadSpeed: (speed: number) => void; // Update default download speed
  updateDefaultDownloadSpeedBit: (speedBit: string) => void; // Update unit for download speed
  updatePermitConnectionLimit: (isPermit: boolean) => void; // Update connection limit permission
  updateMaxUploadNum: (speed: number) => void; // Update maximum upload number
  updateMaxDownloadNum: (count: number) => void; // Update maximum download number
  selectedRows: string[]; // List of selected row IDs
  setSelectedRows: (rows: string[]) => void; // Set selected rows
  clearSelectedRows: () => void; // Clear selected rows
  selectedRowIds: string[]; // List of selected row IDs
  setSelectedRowIds: (rows: string[]) => void; // Set selected row IDs
  clearAllSelections: () => void; // Clear all selections
}

// Create the main store with persistence
export const useMainStore = create<MainStore>()(
  persist(
    (set) => ({
      settings: {
        defaultLocation: '', // Start with empty string
        defaultDownloadSpeed: 0,
        defaultDownloadSpeedBit: 'kb',
        permitConnectionLimit: false,
        maxUploadNum: 5,
        maxDownloadNum: 5,
      },
      selectedDownloads: [] as SelectedDownload[],
      setSelectedDownloads: (downloads) =>
        set({ selectedDownloads: downloads }),
      clearSelectedDownloads: () => set({ selectedDownloads: [] }),

      updateDefaultLocation: (location: string) =>
        set((state) => ({
          settings: { ...state.settings, defaultLocation: location },
        })),

      updateDefaultDownloadSpeed: (speed: number) =>
        set((state) => ({
          settings: { ...state.settings, defaultDownloadSpeed: speed },
        })),

      updateDefaultDownloadSpeedBit: (speedBit: string) =>
        set((state) => ({
          settings: { ...state.settings, defaultDownloadSpeedBit: speedBit },
        })),

      updatePermitConnectionLimit: (isPermit: boolean) =>
        set((state) => ({
          settings: { ...state.settings, permitConnectionLimit: isPermit },
        })),

      updateMaxUploadNum: (speed: number) =>
        set((state) => ({
          settings: { ...state.settings, maxUploadNum: speed },
        })),

      updateMaxDownloadNum: (count: number) =>
        set((state) => ({
          settings: { ...state.settings, maxDownloadNum: count },
        })),

      selectedRows: [] as string[],
      setSelectedRows: (rows) => set({ selectedRows: rows }),
      clearSelectedRows: () => set({ selectedRows: [] }),

      selectedRowIds: [] as string[],
      setSelectedRowIds: (rows) =>
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        set((state) => {
          // Update both selectedRowIds and selectedDownloads
          const selectedDownloadsData: SelectedDownload[] = rows.map((id) => ({
            id,
            controllerId: undefined as string | undefined,
            location: undefined as string | undefined,
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
    }),
    {
      name: 'download-settings-storage', // Name of the storage
      storage: createJSONStorage(() => localStorage), // Use local storage for persistence
      // Add onRehydrateStorage to handle initialization
      onRehydrateStorage: () => (state) => {
        if (!state?.settings.defaultLocation) {
          window.downlodrFunctions.getDownloadFolder().then((path) => {
            useMainStore.getState().updateDefaultLocation(path);
          });
        }
      },
    },
  ),
);
