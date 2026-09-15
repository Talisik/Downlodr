/**
 * IndexedDB Storage Adapter for Zustand
 *
 * This adapter provides IndexedDB persistence for Zustand stores with:
 * - Automatic migration from localStorage
 * - Error handling with localStorage fallback
 * - Better performance for large datasets
 * - Transaction-based operations
 * - Zustand compatibility with proper JSON handling
 */

// Zustand-compatible storage interface
export interface ZustandStorage {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
}

/** IndexedDB schema version is always 1 to avoid VersionError across stores. */
const INDEXED_DB_SCHEMA_VERSION = 1;

interface IndexedDBConfig {
  dbName: string;
  storeName: string;
  version: number;
  keyPath?: string;
}

class IndexedDBStorageAdapter implements ZustandStorage {
  private dbName: string;
  private storeName: string;
  private version: number;
  private keyPath: string;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  // Transaction queue for handling concurrent writes
  private writeQueue: Array<{
    name: string;
    value: string;
    resolve: () => void;
    reject: (error: any) => void;
  }> = [];
  private isProcessingQueue = false;

  constructor(config: IndexedDBConfig) {
    this.dbName = config.dbName;
    this.storeName = config.storeName;
    this.version = config.version;
    this.keyPath = config.keyPath || 'id';
  }

  private async initDB(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const tryOpen = (requestVersionOne: boolean) => {
        const request = requestVersionOne
          ? indexedDB.open(this.dbName, INDEXED_DB_SCHEMA_VERSION)
          : indexedDB.open(this.dbName);

        request.onerror = () => {
          const err = request.error;
          if (err?.name === 'VersionError' && requestVersionOne) {
            tryOpen(false);
            return;
          }
          console.error('IndexedDB initialization failed:', err);
          reject(err);
        };

        request.onsuccess = () => {
          this.db = request.result;
          console.log('IndexedDB initialized successfully');
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: this.keyPath });
            console.log(`Created IndexedDB object store: ${this.storeName}`);
          }
        };
      };

      tryOpen(true);
    });

    return this.initPromise;
  }

  async getItem(name: string): Promise<string | null> {
    try {
      await this.initDB();

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      return await new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(name);

        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.data : null);
        };

        request.onerror = () => {
          console.error('IndexedDB getItem failed:', request.error);
          reject(request.error);
        };

        transaction.onerror = () => {
          console.error('IndexedDB transaction failed:', transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error('IndexedDB getItem error:', error);
      // Fallback to localStorage
      return localStorage.getItem(name);
    }
  }

  async setItem(name: string, value: string): Promise<void> {
    // Queue the write operation to prevent concurrent transaction conflicts
    return new Promise((resolve, reject) => {
      this.writeQueue.push({ name, value, resolve, reject });
      this.processWriteQueue();
    });
  }

  private async processWriteQueue(): Promise<void> {
    // Prevent concurrent queue processing
    if (this.isProcessingQueue || this.writeQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      await this.initDB();

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      // Process writes in batches to improve performance
      while (this.writeQueue.length > 0) {
        // Take up to 10 items from queue for batch processing
        const batch = this.writeQueue.splice(0, 10);

        try {
          // Use a single transaction for the batch
          await new Promise<void>((resolve, reject) => {
            const transaction = this.db!.transaction(
              [this.storeName],
              'readwrite',
            );
            const store = transaction.objectStore(this.storeName);
            let completedCount = 0;
            let hasError = false;

            const checkComplete = () => {
              completedCount++;
              if (completedCount === batch.length && !hasError) {
                resolve();
              }
            };

            // Process each item in the batch
            batch.forEach(
              ({ name, value, resolve: itemResolve, reject: itemReject }) => {
                const request = store.put({
                  [this.keyPath]: name,
                  data: value,
                  timestamp: Date.now(),
                });

                request.onsuccess = () => {
                  itemResolve();
                  checkComplete();
                };

                request.onerror = () => {
                  hasError = true;
                  console.error(
                    'IndexedDB batch write item failed:',
                    request.error,
                  );
                  itemReject(request.error);
                };
              },
            );

            transaction.onerror = () => {
              hasError = true;
              console.error(
                'IndexedDB batch transaction failed:',
                transaction.error,
              );
              // Reject all remaining items in batch
              batch.forEach(({ reject: itemReject }) => {
                itemReject(transaction.error);
              });
              reject(transaction.error);
            };

            transaction.oncomplete = () => {
              if (!hasError) {
                resolve();
              }
            };
          });

          console.log(
            `✅ Successfully processed ${batch.length} writes in batch`,
          );
        } catch (batchError) {
          console.error('Batch write failed:', batchError);

          // Fallback: try individual writes for failed batch
          for (const {
            name,
            value,
            resolve: itemResolve,
            reject: itemReject,
          } of batch) {
            try {
              await this.fallbackSingleWrite(name, value);
              itemResolve();
            } catch (itemError) {
              console.error(`Fallback write failed for ${name}:`, itemError);
              // Final fallback to localStorage
              try {
                localStorage.setItem(name, value);
                itemResolve();
              } catch (localStorageError) {
                itemReject(localStorageError);
              }
            }
          }
        }

        // Small delay between batches to prevent overwhelming IndexedDB
        if (this.writeQueue.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
    } catch (error) {
      console.error('Queue processing failed:', error);

      // Fallback: resolve all queued items with localStorage
      const remainingItems = this.writeQueue.splice(0);
      remainingItems.forEach(({ name, value, resolve, reject }) => {
        try {
          localStorage.setItem(name, value);
          resolve();
        } catch (localStorageError) {
          reject(localStorageError);
        }
      });
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async fallbackSingleWrite(
    name: string,
    value: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put({
        [this.keyPath]: name,
        data: value,
        timestamp: Date.now(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async removeItem(name: string): Promise<void> {
    try {
      await this.initDB();

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(name);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error('IndexedDB removeItem failed:', request.error);
          reject(request.error);
        };

        transaction.onerror = () => {
          console.error('IndexedDB transaction failed:', transaction.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('IndexedDB removeItem error:', error);
      // Fallback to localStorage
      localStorage.removeItem(name);
    }
  }

  // Utility method to check if IndexedDB is available
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  // Method to get storage usage statistics
  async getStorageStats(): Promise<{
    totalSize: number;
    itemCount: number;
    items: Array<{ key: string; size: number; timestamp: number }>;
  }> {
    try {
      await this.initDB();

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const items = request.result.map((item: any) => ({
            key: item[this.keyPath],
            size: new Blob([item.data]).size,
            timestamp: item.timestamp || 0,
          }));

          const totalSize = items.reduce((sum, item) => sum + item.size, 0);

          resolve({
            totalSize,
            itemCount: items.length,
            items,
          });
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return { totalSize: 0, itemCount: 0, items: [] };
    }
  }

  // Method to clear all data
  async clear(): Promise<void> {
    try {
      await this.initDB();

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onsuccess = () => {
          console.log('IndexedDB store cleared');
          resolve();
        };

        request.onerror = () => {
          console.error('IndexedDB clear failed:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('IndexedDB clear error:', error);
    }
  }
}

// Factory function to create IndexedDB storage
export function createIndexedDBStorage(
  config: IndexedDBConfig,
): ZustandStorage {
  const adapter = new IndexedDBStorageAdapter(config);

  return {
    getItem: (name: string) => adapter.getItem(name),
    setItem: (name: string, value: string) => adapter.setItem(name, value),
    removeItem: (name: string) => adapter.removeItem(name),
  };
}

// Migration utility to move data from localStorage to IndexedDB (simplified for Electron)
export async function migrateFromLocalStorage(
  localStorageKey: string,
  indexedDBAdapter: IndexedDBStorageAdapter,
): Promise<boolean> {
  try {
    // console.log(`Starting migration from localStorage key: ${localStorageKey}`);

    // Check if data exists in localStorage
    const localStorageData = localStorage.getItem(localStorageKey);

    if (!localStorageData) {
      console.log('No localStorage data found to migrate');
      return true;
    }

    // Check if data already exists in IndexedDB
    const existingData = await indexedDBAdapter.getItem(localStorageKey);

    if (existingData) {
      console.log('Data already exists in IndexedDB, skipping migration');
      return true;
    }

    // Migrate data from localStorage to IndexedDB
    await indexedDBAdapter.setItem(localStorageKey, localStorageData);

    console.log('Successfully migrated data from localStorage to IndexedDB');

    // Keep localStorage data as backup (no cleanup needed for Electron)
    return true;
  } catch (error) {
    console.error('Migration from localStorage to IndexedDB failed:', error);
    return false;
  }
}

// Enhanced storage adapter with automatic migration (simplified for Electron)
export function createIndexedDBStorageWithMigration(
  config: IndexedDBConfig & { localStorageKey?: string },
): ZustandStorage {
  const adapter = new IndexedDBStorageAdapter(config);
  let migrationCompleted = false;

  return {
    getItem: async (name: string) => {
      // Simple one-time migration for Electron (no race conditions possible)
      if (!migrationCompleted && config.localStorageKey) {
        try {
          await migrateFromLocalStorage(config.localStorageKey, adapter);
          migrationCompleted = true;
        } catch (error) {
          console.error(
            'Migration failed, continuing without migration:',
            error,
          );
          migrationCompleted = true; // Don't retry migration
        }
      }

      return adapter.getItem(name);
    },
    setItem: (name: string, value: string) => adapter.setItem(name, value),
    removeItem: (name: string) => adapter.removeItem(name),
  };
}

export { IndexedDBStorageAdapter };
// eslint-disable-next-line prettier/prettier
  
  