/**
 * Store Rehydration Hook
 *
 * Tracks the rehydration status of Zustand stores to prevent race conditions
 * during app initialization. Ensures that user actions are only processed
 * after all critical stores have finished loading their persisted data.
 *
 * This solves the issue where the first URL entered during app install
 * is not registered because the downloadStore hasn't finished rehydrating.
 */

import { useEffect, useState } from 'react';
import useDownloadStore from '@/Store/downloadStore';
import { useMainStore } from '@/Store/mainStore';
import { useTelemetryStore } from '@/Store/telemetryStore';

interface StoreRehydrationStatus {
  downloadStore: boolean;
  mainStore: boolean;
  telemetryStore: boolean;
}

interface UseStoreRehydrationReturn {
  isRehydrated: boolean;
  isRehydrating: boolean;
  rehydrationStatus: StoreRehydrationStatus;
  waitForRehydration: () => Promise<void>;
}

// Global rehydration status tracking
const globalRehydrationStatus: StoreRehydrationStatus = {
  downloadStore: false,
  mainStore: false,
  telemetryStore: false,
};

// Promise resolvers for waiting
let rehydrationResolvers: Array<() => void> = [];

// Check if all critical stores are rehydrated
const areAllStoresRehydrated = (): boolean => {
  return Object.values(globalRehydrationStatus).every((status) => status);
};

// Notify all waiting promises when rehydration is complete
const notifyRehydrationComplete = () => {
  if (areAllStoresRehydrated()) {
    rehydrationResolvers.forEach((resolve) => resolve());
    rehydrationResolvers = [];
  }
};

// Store rehydration event handlers
const handleDownloadStoreRehydrated = () => {
  console.log('✅ Download store rehydrated');
  globalRehydrationStatus.downloadStore = true;
  notifyRehydrationComplete();
};

const handleMainStoreRehydrated = () => {
  console.log('✅ Main store rehydrated');
  globalRehydrationStatus.mainStore = true;
  notifyRehydrationComplete();
};

const handleTelemetryStoreRehydrated = () => {
  console.log('✅ Telemetry store rehydrated');
  globalRehydrationStatus.telemetryStore = true;
  notifyRehydrationComplete();
};

/**
 * Hook to track and wait for store rehydration
 *
 * @returns Object with rehydration status and utilities
 */
export const useStoreRehydration = (): UseStoreRehydrationReturn => {
  const [rehydrationStatus, setRehydrationStatus] =
    useState<StoreRehydrationStatus>(globalRehydrationStatus);

  // Subscribe to store changes to detect rehydration
  useEffect(() => {
    // Set up store subscriptions to detect when they have data
    // This is a more reliable way than trying to hook into onRehydrateStorage

    const unsubscribeDownload = useDownloadStore.subscribe((state) => {
      if (
        state.historyDownloads !== undefined &&
        !globalRehydrationStatus.downloadStore
      ) {
        handleDownloadStoreRehydrated();
      }
    });

    const unsubscribeMain = useMainStore.subscribe((state) => {
      if (state.settings && !globalRehydrationStatus.mainStore) {
        handleMainStoreRehydrated();
      }
    });

    const unsubscribeTelemetry = useTelemetryStore.subscribe((state) => {
      if (
        state.telemetryId !== undefined &&
        !globalRehydrationStatus.telemetryStore
      ) {
        handleTelemetryStoreRehydrated();
      }
    });

    // Initial check in case stores are already rehydrated
    setTimeout(() => {
      if (!globalRehydrationStatus.downloadStore) {
        const downloadState = useDownloadStore.getState();
        if (downloadState.historyDownloads !== undefined) {
          handleDownloadStoreRehydrated();
        }
      }

      if (!globalRehydrationStatus.mainStore) {
        const mainState = useMainStore.getState();
        if (mainState.settings.defaultLocation !== undefined) {
          handleMainStoreRehydrated();
        }
      }

      if (!globalRehydrationStatus.telemetryStore) {
        const telemetryState = useTelemetryStore.getState();
        if (telemetryState.telemetryId !== undefined) {
          handleTelemetryStoreRehydrated();
        }
      }
    }, 100);

    // Update local state when global status changes
    const updateLocalStatus = () => {
      setRehydrationStatus({ ...globalRehydrationStatus });
    };

    // Listen for status changes
    const interval = setInterval(updateLocalStatus, 50);

    return () => {
      unsubscribeDownload();
      unsubscribeMain();
      unsubscribeTelemetry();
      clearInterval(interval);
    };
  }, []);

  const waitForRehydration = (): Promise<void> => {
    return new Promise((resolve) => {
      if (areAllStoresRehydrated()) {
        resolve();
      } else {
        rehydrationResolvers.push(resolve);
      }
    });
  };

  return {
    isRehydrated: areAllStoresRehydrated(),
    isRehydrating: !areAllStoresRehydrated(),
    rehydrationStatus,
    waitForRehydration,
  };
};

/**
 * Utility function to wait for store rehydration from anywhere in the app
 */
export const waitForStoreRehydration = (): Promise<void> => {
  return new Promise((resolve) => {
    if (areAllStoresRehydrated()) {
      resolve();
    } else {
      rehydrationResolvers.push(resolve);
    }
  });
};

/**
 * Get current rehydration status without subscribing to changes
 */
export const getRehydrationStatus = () => ({
  isRehydrated: areAllStoresRehydrated(),
  status: { ...globalRehydrationStatus },
});
