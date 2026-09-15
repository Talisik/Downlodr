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

// Main interface for the main store
interface ModalStateStore {
  isDownloadModalOpen: boolean; // Add new state for download modal
  isExitModalOpen: boolean; // State for exit modal visibility
  setIsDownloadModalOpen: (isOpen: boolean) => void; // Set the download modal state
  setIsExitModalOpen: (isOpen: boolean) => void; // Set the exit modal state
  updateExitModal: (willOpen: boolean) => void; // Update exit modal setting
}

// version constant for migration tracking
const MODAL_STATE_STORE_VERSION = 1; // Incremented for update notification preferences

// Create the main store with persistence
export const useModalStateStore = create<ModalStateStore>()(
  persist(
    (set, get) => ({
      isDownloadModalOpen: false,
      setIsDownloadModalOpen: (isOpen: boolean) =>
        set({ isDownloadModalOpen: isOpen }),
      isExitModalOpen: false,
      setIsExitModalOpen: (isOpen: boolean) => set({ isExitModalOpen: isOpen }),
      updateExitModal: (willOpen: boolean) =>
        set({ isExitModalOpen: willOpen }),
    }),
    {
      name: 'download-modal-state-storage', // Name of the storage
      version: MODAL_STATE_STORE_VERSION, // version tracking
      storage: createJSONStorage(() =>
        createIndexedDBStorageWithMigration({
          dbName: 'downlodr-modal-state-database',
          storeName: 'modal-state-storage',
          version: 1,
          localStorageKey: 'download-download-modal-storage', // Migrate existing localStorage data
        }),
      ), // Use IndexedDB with automatic localStorage migration
      // Exclude temporary session state from persistence
    },
  ),
);
