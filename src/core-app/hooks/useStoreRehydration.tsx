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

import { useSettingStore } from '@/core-app/store/settingsStore';
import { useTelemetryStore } from '@/core-app/store/telemetryStore';
import useDownloadStore from '@/downlodr/store/downloadStore';
import { useEffect, useState } from 'react';

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
  globalRehydrationStatus.downloadStore = true;
  notifyRehydrationComplete();
};

const handleMainStoreRehydrated = () => {
  globalRehydrationStatus.mainStore = true;
  notifyRehydrationComplete();
};

const handleTelemetryStoreRehydrated = () => {
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

    const unsubscribeMain = useSettingStore.subscribe((state) => {
      if (state.settings && !globalRehydrationStatus.mainStore) {
        handleMainStoreRehydrated();
      }
    });

    const unsubscribeTelemetry = useTelemetryStore.subscribe((state) => {
      // Telemetry is rehydrated only after persist has loaded from IndexedDB.
      // _hasRehydrated is set in onRehydrateStorage; do not use telemetryData !== undefined
      // (that is always true from initial state and would mark ready before persist runs).
      if (
        state._hasRehydrated === true &&
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
        const mainState = useSettingStore.getState();
        if (mainState.settings.defaultLocation !== undefined) {
          handleMainStoreRehydrated();
        }
      }

      if (!globalRehydrationStatus.telemetryStore) {
        const telemetryState = useTelemetryStore.getState();
        if (telemetryState._hasRehydrated === true) {
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
