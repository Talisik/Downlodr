/**
 * Storage utilities for the download store
 * Handles IndexedDB and localStorage operations
 */

import { IndexedDBStorageAdapter } from '@/core-app/utils/indexedDBStorage';

export const DOWNLOAD_STORE_VERSION = 1;

/**
 * Debounced storage adapter to reduce write frequency during rapid updates
 */
export function createDebouncedStorage(
  baseStorage: any,
  debounceMs = 500,
): any {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingState: any = null;

  return {
    getItem: baseStorage.getItem,
    removeItem: baseStorage.removeItem,
    setItem: (name: string, value: string) => {
      // Store the latest state
      pendingState = { name, value };

      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Debounce the write
      timeoutId = setTimeout(() => {
        if (pendingState) {
          baseStorage.setItem(pendingState.name, pendingState.value);
          pendingState = null;
          timeoutId = null;
        }
      }, debounceMs);
    },
  };
}

/**
 * Check IndexedDB usage instead of localStorage
 */
export async function checkIndexedDBUsage(): Promise<{
  total: number;
  downlodrSize: number;
  itemCount: number;
  items: Array<{ key: string; size: number; timestamp: number }>;
}> {
  try {
    // Create a temporary adapter to check storage usage
    const adapter = new IndexedDBStorageAdapter({
      dbName: 'downlodr-database',
      storeName: 'zustand-storage',
      version: 2,
    });

    const stats = await adapter.getStorageStats();

    // Also check localStorage for comparison
    const localStorageTotal = JSON.stringify(localStorage).length;

    console.log('Storage usage comparison:', {
      indexedDB: {
        totalSize: `${(stats.totalSize / 1024).toFixed(2)} KB`,
        itemCount: stats.itemCount,
        items: stats.items,
      },
      localStorage: `${(localStorageTotal / 1024).toFixed(2)} KB`,
    });

    return {
      total: stats.totalSize,
      downlodrSize: stats.totalSize,
      itemCount: stats.itemCount,
      items: stats.items,
    };
  } catch (error) {
    console.error('Error checking IndexedDB usage:', error);

    // Fallback to localStorage check
    const total = JSON.stringify(localStorage).length;
    const downlodrStorage = localStorage.getItem('downlodr-storage');
    const downlodrSize = downlodrStorage ? downlodrStorage.length : 0;

    return {
      total,
      downlodrSize,
      itemCount: Object.keys(localStorage).length,
      items: [],
    };
  }
}

/**
 * Legacy function for backward compatibility
 */
export function checkLocalStorageUsage(): {
  total: number;
  downlodrSize: number;
} {
  try {
    const total = JSON.stringify(localStorage).length;
    const downlodrStorage = localStorage.getItem('downlodr-storage');
    const downlodrSize = downlodrStorage ? downlodrStorage.length : 0;

    console.log('LocalStorage usage:', {
      total: `${(total / 1024).toFixed(2)} KB`,
      downlodrStorage: `${(downlodrSize / 1024).toFixed(2)} KB`,
      items: Object.keys(localStorage).length,
    });

    return { total, downlodrSize };
  } catch (error) {
    console.error('Error checking localStorage usage:', error);
    return { total: 0, downlodrSize: 0 };
  }
}
