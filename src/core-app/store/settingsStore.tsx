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

interface DownloadSettings {
  defaultLocation: string; // Default location for downloads
  defaultDownloadSpeed: number; // Default download speed
  defaultDownloadSpeedBit: string; // Unit for download speed (e.g., kb, mb)
  permitConnectionLimit: boolean; // Whether to permit connection limits
  maxUploadNum: number; // Maximum number of uploads allowed
  maxDownloadNum: number; // Maximum number of downloads allowed
  runInBackground: boolean;
  enableClipboardMonitoring: boolean; // Whether to monitor clipboard for links
  dontShowAppUpdates: boolean; // Whether to suppress app update notifications
  dontShowPluginUpdates: boolean; // Whether to suppress plugin update notifications
  language: string; // UI language code, e.g. 'en', 'es'
}

// Main interface for the main store
interface SettingsStore {
  settings: DownloadSettings; // Current download settings
  isDownloadModalOpen: boolean; // Add new state for download modal
  isExitModalOpen: boolean; // State for exit modal visibility
  setIsDownloadModalOpen: (isOpen: boolean) => void; // Set the download modal state
  setIsExitModalOpen: (isOpen: boolean) => void; // Set the exit modal state
  updateDefaultLocation: (location: string) => void; // Update default download location
  updateDefaultDownloadSpeed: (speed: number) => void; // Update default download speed
  updateDefaultDownloadSpeedBit: (speedBit: string) => void; // Update unit for download speed
  updatePermitConnectionLimit: (isPermit: boolean) => void; // Update connection limit permission
  updateMaxUploadNum: (speed: number) => void; // Update maximum upload number
  updateMaxDownloadNum: (count: number) => void; // Update maximum download number
  updateExitModal: (willOpen: boolean) => void; // Update exit modal setting
  updateRunInBackground: (value: boolean) => void;
  updateEnableClipboardMonitoring: (value: boolean) => void;
  updateDontShowAppUpdates: (dontShow: boolean) => void; // Update app update notification preference
  updateDontShowPluginUpdates: (dontShow: boolean) => void; // Update plugin update notification preference
  updateLanguage: (lang: string) => void;
}

// version constant for migration tracking
const MAIN_SETTINGS_VERSION = 1; // Incremented for update notification preferences

// Interface for legacy persisted state structure
interface LegacyPersistedState {
  settings?: Partial<DownloadSettings>;
  [key: string]: unknown; // Allow for other potential fields
}

// migration function
const migrateMainStore = (persistedState: unknown, version: number) => {
  console.log(
    `Migrating mainStore from version ${version} to ${MAIN_SETTINGS_VERSION}`,
  );

  // If no version exists, this is a legacy state - migrate to current structure
  if (version === undefined || version === 0) {
    // Define default serializable state only (excluding temporary session state)
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
        dontShowAppUpdates: false, // Default to false
        dontShowPluginUpdates: false, // Default to false
        language: 'en',
      },
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
      };

      console.log('Successfully migrated mainStore to version 1');
      return migratedState;
    }

    console.log('No valid persisted state found, using default state');
    return defaultState;
  }

  // Handle future migrations here
  // Migration from version 1 to 2: Add telemetry settings
  if (version === 1) {
    return {
      ...(persistedState as any),
      settings: {
        ...(persistedState as any).settings,
      },
    };
  }

  // Migration from version 2 to 3: Add update notification preferences
  if (version === 2) {
    return {
      ...(persistedState as any),
      settings: {
        ...(persistedState as any).settings,
        dontShowAppUpdates: false, // Default to show app updates for existing users
        dontShowPluginUpdates: false, // Default to show plugin updates for existing users
      },
    };
  }

  // If version is already current or newer, return as-is
  if (version >= MAIN_SETTINGS_VERSION) {
    return persistedState;
  }

  // If version is current or higher, return as-is
  return persistedState;
};

// Create the main store with persistence
export const useSettingStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
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
        dontShowAppUpdates: false, // Default to false
        dontShowPluginUpdates: false, // Default to false
        language: 'en',
      },
      isDownloadModalOpen: false,
      setIsDownloadModalOpen: (isOpen: boolean) =>
        set({ isDownloadModalOpen: isOpen }),
      isExitModalOpen: false,
      setIsExitModalOpen: (isOpen: boolean) => set({ isExitModalOpen: isOpen }),
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

      updateDontShowAppUpdates: (dontShow: boolean) =>
        set({ settings: { ...get().settings, dontShowAppUpdates: dontShow } }),

      updateDontShowPluginUpdates: (dontShow: boolean) =>
        set({
          settings: { ...get().settings, dontShowPluginUpdates: dontShow },
        }),

      updateLanguage: (lang: string) =>
        set((state) => ({
          settings: { ...state.settings, language: lang },
        })),
    }),
    {
      name: 'download-settings-storage', // Name of the storage
      version: MAIN_SETTINGS_VERSION, // version tracking
      storage: createJSONStorage(() =>
        createIndexedDBStorageWithMigration({
          dbName: 'downlodr-settings-database',
          storeName: 'settings-storage',
          version: MAIN_SETTINGS_VERSION,
          localStorageKey: 'download-settings-storage', // Migrate existing localStorage data
        }),
      ), // Use IndexedDB with automatic localStorage migration
      migrate: migrateMainStore, // migration function
      // Exclude temporary session state from persistence
      partialize: (state) => ({
        settings: state.settings,
        // Explicitly exclude temporary session state:
        // - selectedDownloads
        // - selectedRows
        // - selectedRowIds
        // - isDownloadModalOpen
        // - isExitModalOpen
      }),
      // onRehydrateStorage to handle initialization
      onRehydrateStorage: () => (state) => {
        if (
          !state?.settings.defaultLocation &&
          window.downlodrFunctions?.getDownloadFolder
        ) {
          window.downlodrFunctions.getDownloadFolder().then((path) => {
            useSettingStore.getState().updateDefaultLocation(path);
          });
        }
      },
    },
  ),
);
