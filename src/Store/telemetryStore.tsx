/**
 * Telemetry Store for Downlodr Application
 *
 * Manages a persistent telemetry ID that combines host information with
 * creation timestamp. The ID is generated once on first app installation
 * and persists across sessions using IndexedDB for better storage capacity.
 *
 * Features:
 * - Unique telemetry ID combining host_id and creation date
 * - IndexedDB persistence for reliability and larger storage capacity
 * - One-time ID generation that cannot be changed after creation
 * - Secure retrieval methods for accessing the telemetry ID
 *
 * Dependencies:
 * - Zustand: State management with persistence
 * - IndexedDB Storage: Custom adapter for better performance
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createIndexedDBStorageWithMigration } from '../Utils/indexedDBStorage';

// Interface for telemetry store state
interface TelemetryStore {
  // State
  telemetryId: string | null; // The persistent telemetry ID
  createdAt: Date | null; // When the ID was created
  isInitialized: boolean; // Whether the store has been initialized

  // Actions
  initialize: () => Promise<void>; // Initialize and generate ID if needed
  getTelemetryId: () => string | null; // Get the current telemetry ID
  reset: () => void; // Reset store (for development/testing only)
}

// Version for store migration tracking
const TELEMETRY_STORE_VERSION = 1;

/**
 * Generates a unique telemetry ID combining host_id and creation date
 * Format: {host_id}_{YYYY-MM-DD}_{timestamp}
 */
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

/**
 * Migration function for telemetry store
 * Handles backward compatibility and data structure changes
 */
const migrateTelemetryStore = (persistedState: unknown, version: number) => {
  console.log(
    `Migrating telemetry store from version ${version} to ${TELEMETRY_STORE_VERSION}`,
  );

  // If no version exists, this is a fresh install
  if (version === undefined || version === 0) {
    return {
      telemetryId: null as string | null,
      createdAt: null as Date | null,
      isInitialized: false,
    };
  }

  // For future migrations, handle version-specific changes here
  return persistedState as Partial<TelemetryStore>;
};

/**
 * Telemetry Store with IndexedDB persistence
 *
 * This store manages a unique telemetry identifier that:
 * - Is generated once on first app installation
 * - Combines host information with creation timestamp
 * - Persists across app sessions and updates
 * - Cannot be changed once created
 */
export const useTelemetryStore = create<TelemetryStore>()(
  persist(
    (set, get) => ({
      // Initial state
      telemetryId: null as string | null,
      createdAt: null as Date | null,
      isInitialized: false,

      // Initialize the telemetry system
      initialize: async () => {
        const current = get();

        // If already initialized and has ID, do nothing
        if (current.isInitialized && current.telemetryId) {
          return;
        }

        // If we have a persisted ID but not marked as initialized, just mark it
        if (current.telemetryId && current.createdAt) {
          set({ isInitialized: true });
          return;
        }

        try {
          // Generate new telemetry ID
          const { id, createdAt } = await generateTelemetryId();

          set({
            telemetryId: id,
            createdAt,
            isInitialized: true,
          });

          console.log('Telemetry ID generated:', id);
        } catch (error) {
          console.error('Failed to initialize telemetry store:', error);
          throw error;
        }
      },

      // Get the current telemetry ID
      getTelemetryId: () => {
        const current = get();
        return current.telemetryId;
      },

      // Reset the store (for development/testing purposes only)
      reset: () => {
        set({
          telemetryId: null as string | null,
          createdAt: null as Date | null,
          isInitialized: false,
        });
      },
    }),
    {
      name: 'telemetry-storage',
      version: TELEMETRY_STORE_VERSION,
      storage: createJSONStorage(() =>
        createIndexedDBStorageWithMigration({
          dbName: 'downlodr-telemetry-database',
          storeName: 'telemetry-storage',
          version: TELEMETRY_STORE_VERSION,
          localStorageKey: 'telemetry-storage', // Fallback key for migration
        }),
      ),
      // Only persist the essential data
      partialize: (state) => ({
        telemetryId: state.telemetryId,
        createdAt: state.createdAt,
        // Explicitly exclude isInitialized - it should be set fresh each session
      }),
      migrate: migrateTelemetryStore,
      onRehydrateStorage: () => {
        console.log('Rehydrating telemetry store from IndexedDB');
        return (state, error) => {
          if (error) {
            console.error('Error rehydrating telemetry store:', error);
          } else {
            console.log('Successfully rehydrated telemetry store');
            // If we have persisted data, mark as initialized
            if (state?.telemetryId) {
              console.log('Found existing telemetry ID:', state.telemetryId);
            }
          }
        };
      },
    },
  ),
);

/**
 * Convenience function to initialize telemetry on app startup
 * Call this once during application initialization
 */
export const initializeTelemetry = async (): Promise<string | null> => {
  try {
    await useTelemetryStore.getState().initialize();
    return useTelemetryStore.getState().getTelemetryId();
  } catch (error) {
    console.error('Failed to initialize telemetry:', error);
    return null;
  }
};

/**
 * Convenience function to get the telemetry ID
 * Returns null if not initialized
 */
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
  const { telemetryId, isInitialized, createdAt } = useTelemetryStore();

  return {
    telemetryId,
    isInitialized,
    createdAt,
  };
};

/**
 * Utility function to safely log events with telemetry ID
 * Use this in any component without worrying about initialization
 */
export const logWithTelemetry = (
  eventType: 'info' | 'warn' | 'error',
  message: string,
  data?: any,
) => {
  const telemetryId = getTelemetryId();

  const logData = {
    message,
    telemetryId,
    timestamp: new Date().toISOString(),
    ...data,
  };

  switch (eventType) {
    case 'error':
      console.error('🔴', logData);
      break;
    case 'warn':
      console.warn('🟡', logData);
      break;
    case 'info':
    default:
      console.log('🟢', logData);
      break;
  }

  return logData;
};

/**
 * Utility function to track user actions with telemetry
 * Use this for analytics events
 */
export const trackAction = (action: string, data?: any) => {
  return logWithTelemetry('info', `Action: ${action}`, {
    action,
    event_type: 'user_action',
    ...data,
  });
};

/**
 * Utility function to track errors with telemetry
 * Use this for error reporting
 */
export const trackError = (error: Error | string, context?: any) => {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error === 'string' ? null : error.stack;

  return logWithTelemetry('error', `Error: ${errorMessage}`, {
    error_message: errorMessage,
    error_stack: errorStack,
    context,
    event_type: 'error',
  });
};
