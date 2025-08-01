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
import { TaskBarButtonsVisibility } from '@/plugins/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface DownloadSettings {
  defaultLocation: string; // Default location for downloads
  defaultDownloadSpeed: number; // Default download speed
  defaultDownloadSpeedBit: string; // Unit for download speed (e.g., kb, mb)
  permitConnectionLimit: boolean; // Whether to permit connection limits
  maxUploadNum: number; // Maximum number of uploads allowed
  maxDownloadNum: number; // Maximum number of downloads allowed
  runInBackground: boolean;
  enableClipboardMonitoring: boolean; // Whether to monitor clipboard for links
  exitModal: boolean; // Whether to show exit modal when closing
}

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
interface MainStore {
  settings: DownloadSettings; // Current download settings
  selectedDownloads: SelectedDownload[]; // List of currently selected downloads
  isDownloadModalOpen: boolean; // Add new state for download modal
  isExitModalOpen: boolean; // State for exit modal visibility
  setIsDownloadModalOpen: (isOpen: boolean) => void; // Set the download modal state
  setIsExitModalOpen: (isOpen: boolean) => void; // Set the exit modal state
  setSelectedDownloads: (downloads: SelectedDownload[]) => void; // Set selected downloads
  clearSelectedDownloads: () => void; // Clear selected downloads
  updateDefaultLocation: (location: string) => void; // Update default download location
  updateDefaultDownloadSpeed: (speed: number) => void; // Update default download speed
  updateDefaultDownloadSpeedBit: (speedBit: string) => void; // Update unit for download speed
  updatePermitConnectionLimit: (isPermit: boolean) => void; // Update connection limit permission
  updateMaxUploadNum: (speed: number) => void; // Update maximum upload number
  updateMaxDownloadNum: (count: number) => void; // Update maximum download number
  updateExitModal: (willOpen: boolean) => void; // Update exit modal setting
  selectedRows: string[]; // List of selected row IDs
  setSelectedRows: (rows: string[]) => void; // Set selected rows
  clearSelectedRows: () => void; // Clear selected rows
  selectedRowIds: string[]; // List of selected row IDs
  setSelectedRowIds: (rows: string[]) => void; // Set selected row IDs
  clearAllSelections: () => void; // Clear all selections
  visibleColumns: string[];
  setVisibleColumns: (columns: string[]) => void;
  updateRunInBackground: (value: boolean) => void;
  updateEnableClipboardMonitoring: (value: boolean) => void;
  taskBarButtonsVisibility: TaskBarButtonsVisibility; // State for task bar buttons visibility
  setTaskBarButtonsVisibility: (
    visibility: Partial<TaskBarButtonsVisibility>,
  ) => void; // Set the visibility of the task bar buttons
  isNavCollapsed: boolean; // State for sidebar navigation collapse
  setIsNavCollapsed: (value: boolean) => void; // Set the collapse state of the sidebar navigation
  isDownloadDetailExpanded: boolean; // State for download detail expansion
  setIsDownloadDetailExpanded: (value: boolean) => void; // Set the expansion state of the download detail
}

// Add version constant for migration tracking
const MAIN_STORE_VERSION = 1;

// Interface for legacy persisted state structure
interface LegacyPersistedState {
  settings?: Partial<DownloadSettings>;
  selectedDownloads?: SelectedDownload[];
  selectedRows?: string[];
  selectedRowIds?: string[];
  visibleColumns?: string[];
  taskBarButtonsVisibility?: Partial<TaskBarButtonsVisibility>;
  isNavCollapsed?: boolean;
  isDownloadDetailExpanded?: boolean;
  [key: string]: unknown; // Allow for other potential fields
}

// Add migration function
const migrateMainStore = (persistedState: unknown, version: number) => {
  console.log(
    `Migrating mainStore from version ${version} to ${MAIN_STORE_VERSION}`,
  );

  // If no version exists, this is a legacy state - migrate to current structure
  if (version === undefined || version === 0) {
    // Define default serializable state only
    const defaultState = {
      settings: {
        defaultLocation: '',
        exitModal: true,
        defaultDownloadSpeed: 0,
        defaultDownloadSpeedBit: 'kb',
        permitConnectionLimit: false,
        maxUploadNum: 5,
        maxDownloadNum: 5,
        runInBackground: false,
        enableClipboardMonitoring: false,
      },
      selectedDownloads: [] as SelectedDownload[],
      isDownloadModalOpen: false,
      isExitModalOpen: false,
      selectedRows: [] as string[],
      selectedRowIds: [] as string[],
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
        settings: {
          ...defaultState.settings,
          ...legacy.settings,
        },
        // Preserve other persisted data if it exists and is valid
        selectedDownloads: Array.isArray(legacy.selectedDownloads)
          ? legacy.selectedDownloads
          : defaultState.selectedDownloads,
        selectedRows: Array.isArray(legacy.selectedRows)
          ? legacy.selectedRows
          : defaultState.selectedRows,
        selectedRowIds: Array.isArray(legacy.selectedRowIds)
          ? legacy.selectedRowIds
          : defaultState.selectedRowIds,
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

  // Handle future migrations here
  // Example for version 1 to 2:
  // if (version === 1) {
  //   return {
  //     ...persistedState,
  //     // Add new fields or transform existing ones
  //     newField: 'defaultValue',
  //   };
  // }

  // If version is current or higher, return as-is
  return persistedState;
};

// Create the main store with persistence
export const useMainStore = create<MainStore>()(
  persist(
    (set, get) => ({
      settings: {
        defaultLocation: '', // Start with empty string
        exitModal: true, // Show exit modal by default to inform users
        defaultDownloadSpeed: 0,
        defaultDownloadSpeedBit: 'kb',
        permitConnectionLimit: false,
        maxUploadNum: 5,
        maxDownloadNum: 5,
        runInBackground: false,
        enableClipboardMonitoring: false,
      },
      selectedDownloads: [] as SelectedDownload[],
      isDownloadModalOpen: false,
      isExitModalOpen: false,
      setIsDownloadModalOpen: (isOpen: boolean) =>
        set({ isDownloadModalOpen: isOpen }),
      setIsExitModalOpen: (isOpen: boolean) => set({ isExitModalOpen: isOpen }),
      setSelectedDownloads: (downloads) =>
        set({ selectedDownloads: downloads }),
      clearSelectedDownloads: () => set({ selectedDownloads: [] }),

      updateDefaultLocation: (location: string) =>
        set((state) => ({
          settings: { ...state.settings, defaultLocation: location },
        })),

      updateExitModal: (willOpen: boolean) =>
        set((state) => ({
          settings: { ...state.settings, exitModal: willOpen },
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

      updateRunInBackground: (value) =>
        set({ settings: { ...get().settings, runInBackground: value } }),

      updateEnableClipboardMonitoring: (value) =>
        set({
          settings: { ...get().settings, enableClipboardMonitoring: value },
        }),

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
      name: 'download-settings-storage', // Name of the storage
      version: MAIN_STORE_VERSION, // Add version tracking
      storage: createJSONStorage(() => localStorage), // Use local storage for persistence
      migrate: migrateMainStore, // Add migration function
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
