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

export interface TelemetrySettings {
  telemetryEnabled: boolean; // Whether telemetry data collection is enabled
  telemetryConsentShown: boolean; // Whether the telemetry consent dialog has been shown
}

/** State slice for telemetry (no methods). */
interface TelemetryDataState {
  telemetryId: string | null;
  createdAt: Date | null;
  isInitialized: boolean;
}

interface TelemetryData extends TelemetryDataState {
  initialize: () => Promise<void>;
  getTelemetryId: () => string | null;
  reset: () => void;
}

// Main interface for the main store
interface TelemetryStore {
  /** Set by persist middleware when rehydration from storage has finished. Do not persist. */
  _hasRehydrated: boolean;
  settings: TelemetrySettings;
  updateTelemetryEnabled: (enabled: boolean) => void; // Update telemetry enabled setting
  updateTelemetryConsentShown: (shown: boolean) => void; // Update telemetry consent shown status
  telemetryData: TelemetryData;
  initialize: () => Promise<void>; // Initialize and generate ID if needed
  getTelemetryId: () => string | null; // Get the current telemetry ID
  reset: () => void; // Reset store (for development/testing only)
}

// version constant for migration tracking
const TELEMETRY_STORE_VERSION = 1; // Incremented for update notification preferences

async function generateTelemetryId(): Promise<{ id: string; createdAt: Date }> {
  try {
    // Get host information from the main process
    const hostInfo = await window.downlodrFunctions.getHostInfo();
    const createdAt = new Date();

    // Format: hostname_YYYY-MM-DD_timestamp
    const dateStr = createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
    const timestamp = createdAt.getTime();
    const telemetryId = `${hostInfo.host_id}_${dateStr}_${timestamp}`;

    return {
      id: telemetryId,
      createdAt,
    };
  } catch (error) {
    console.error('Failed to generate telemetry ID:', error);
    throw error;
  }
}

export const getTelemetryId = (): string | null => {
  return useTelemetryStore.getState().getTelemetryId();
};

/**
 * React hook for accessing telemetry ID in components
 * After app-level initialization, this will always have the ID
 */
export const useTelemetryId = (): {
  telemetryId: string | null;
  isInitialized: boolean;
  createdAt: Date | null;
} => {
  const { telemetryData } = useTelemetryStore.getState();
  const telemetryId = telemetryData.telemetryId;
  const isInitialized = telemetryData.isInitialized;
  const createdAt = telemetryData.createdAt;

  return {
    telemetryId,
    isInitialized,
    createdAt,
  };
};

// Interface for legacy persisted state structure
interface LegacyPersistedState {
  settings?: Partial<TelemetrySettings>;
  telemetryData?: Partial<TelemetryDataState>;
  [key: string]: unknown; // Allow for other potential fields
}

// migration function
const migrateMainStore = (persistedState: unknown, version: number) => {
  console.log(
    `Migrating mainStore from version ${version} to ${TELEMETRY_STORE_VERSION}`,
  );

  // If no version exists, this is a legacy state - migrate to current structure
  if (version === undefined || version === 0) {
    // Define default serializable state only (excluding temporary session state)
    const defaultState = {
      settings: {
        telemetryEnabled: false, // Default to disabled
        telemetryConsentShown: false, // Haven't shown consent dialog yet
      },
      telemetryId: null as string | null,
      createdAt: null as Date | null,
      isInitialized: false,
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
        telemetryData: {
          telemetryId:
            legacy.telemetryData?.telemetryId ?? legacy.telemetryId ?? null,
          createdAt:
            legacy.telemetryData?.createdAt ?? legacy.createdAt ?? null,
          isInitialized:
            legacy.telemetryData?.isInitialized ??
            legacy.isInitialized ??
            false,
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
  // Version 1: preserve existing settings (do not reset consent)
  if (version === 1) {
    const prev = persistedState as Record<string, unknown> & {
      settings?: Partial<TelemetrySettings>;
      telemetryId?: string | null;
      createdAt?: Date | null;
      isInitialized?: boolean;
    };
    return {
      ...prev,
      settings: {
        telemetryEnabled: prev.settings?.telemetryEnabled ?? false,
        telemetryConsentShown: prev.settings?.telemetryConsentShown ?? false,
      },
      telemetryData: {
        telemetryId: prev.telemetryId ?? null,
        createdAt: prev.createdAt ?? null,
        isInitialized: prev.isInitialized ?? false,
      },
    };
  }

  // If version is already current or newer, return as-is
  if (version >= TELEMETRY_STORE_VERSION) {
    return persistedState;
  }

  // If version is current or higher, return as-is
  return persistedState;
};

export const initializeTelemetry = async (): Promise<string | null> => {
  try {
    await useTelemetryStore.getState().initialize();
    return useTelemetryStore.getState().getTelemetryId();
  } catch (error) {
    console.error('Failed to initialize telemetry:', error);
    return null;
  }
};

// Create the main store with persistence
export const useTelemetryStore = create<TelemetryStore>()(
  persist(
    (set, get) => {
      const mergeTelemetryData = (
        patch: Partial<TelemetryDataState>,
      ): TelemetryData => ({
        ...get().telemetryData,
        ...patch,
        initialize: api.initialize,
        getTelemetryId: api.getTelemetryId,
        reset: api.reset,
      });

      const api = {
        initialize: async () => {
          const current = get();

          if (
            current.telemetryData.isInitialized &&
            current.telemetryData.telemetryId
          ) {
            return;
          }

          if (
            current.telemetryData.telemetryId &&
            current.telemetryData.createdAt
          ) {
            set({
              telemetryData: mergeTelemetryData({ isInitialized: true }),
            });
            return;
          }

          try {
            const { id, createdAt } = await generateTelemetryId();
            set({
              telemetryData: mergeTelemetryData({
                telemetryId: id,
                createdAt,
                isInitialized: true,
              }),
            });
            console.log('Telemetry ID generated:', id);
          } catch (error) {
            console.error('Failed to initialize telemetry store:', error);
            throw error;
          }
        },

        getTelemetryId: () => get().telemetryData.telemetryId,

        reset: () => {
          set({
            telemetryData: mergeTelemetryData({
              telemetryId: null,
              createdAt: null,
              isInitialized: false,
            }),
          });
        },
      };

      const initialData: TelemetryDataState = {
        telemetryId: null,
        createdAt: null,
        isInitialized: false,
      };

      return {
        _hasRehydrated: false,

        settings: {
          telemetryEnabled: false,
          telemetryConsentShown: false,
        },

        telemetryData: {
          ...initialData,
          initialize: api.initialize,
          getTelemetryId: api.getTelemetryId,
          reset: api.reset,
        } as TelemetryData,

        updateTelemetryEnabled: (enabled: boolean) =>
          set({ settings: { ...get().settings, telemetryEnabled: enabled } }),

        updateTelemetryConsentShown: (shown: boolean) =>
          set({
            settings: { ...get().settings, telemetryConsentShown: shown },
          }),

        initialize: api.initialize,
        getTelemetryId: api.getTelemetryId,
        reset: api.reset,
      };
    },
    {
      name: 'download-telemetry-storage', // Name of the storage
      version: TELEMETRY_STORE_VERSION, // version tracking
      storage: createJSONStorage(() =>
        createIndexedDBStorageWithMigration({
          dbName: 'downlodr-telemetry-database',
          storeName: 'telemetry-storage',
          version: 1,
          localStorageKey: 'download-telemetry-storage', // Migrate existing localStorage data
        }),
      ), // Use IndexedDB with automatic localStorage migration
      migrate: migrateMainStore, // migration function
      // Include settings and telemetryData for persistence (exclude _hasRehydrated)
      // CRITICAL: settings must be persisted to remember telemetryConsentShown
      partialize: (state) => ({
        settings: state.settings, // Includes telemetryConsentShown and telemetryEnabled
        telemetryData: {
          telemetryId: state.telemetryData.telemetryId,
          createdAt: state.telemetryData.createdAt,
          isInitialized: state.telemetryData.isInitialized,
        },
      }),
      // Only consider store "ready" after persist has loaded from IndexedDB
      onRehydrateStorage: () => (_state, err) => {
        if (err) {
          console.warn('Telemetry store rehydration error:', err);
        }
        useTelemetryStore.setState({ _hasRehydrated: true });
      },
    },
  ),
);
