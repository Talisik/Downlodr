/**
 *
 * This file defines a Zustand store for managing application-wide settings
 * and selected downloads. It provides functionalities to update settings
 * such as default download location, speed, and connection limits.
 *
 * Dependencies:
 * - Zustand: A small, fast state-management solution.
 */

// Interface for download settings
import { create } from 'zustand';

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

// Create the main store without persistence
export const useSelectedDownloadStore = create<SelectedDownloadStore>()(
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
      set((state) => {
        // Update both selectedRowIds and selectedDownloads. Preserve any rich
        // entry already present (set via setSelectedDownloads) so pruning the
        // id list doesn't wipe controllerId/status/location that bulk actions
        // (Stop/Pause/Remove) rely on; fall back to a placeholder for new ids.
        const existingById = new Map(
          state.selectedDownloads.map((d) => [d.id, d]),
        );
        const selectedDownloadsData: SelectedDownload[] = rows.map(
          (id) =>
            existingById.get(id) ?? {
              id,
              controllerId: undefined as string | undefined,
              location: undefined as string | undefined,
              videoUrl: undefined as string | undefined,
              downloadName: undefined as string | undefined,
              status: undefined as string | undefined,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              download: undefined as any | undefined,
            },
        );
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
);
