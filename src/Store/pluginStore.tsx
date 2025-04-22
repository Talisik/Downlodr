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
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PluginSettings {
  isShowPlugin: boolean;
}

// Main interface for the main store
interface PluginStore {
  settingsPlugin: PluginSettings; // Current download settings
  updateIsShowPlugin: (value: boolean) => void;
}

// Create the main store with persistence
export const usePluginStore = create<PluginStore>()(
  persist(
    (set, get) => ({
      settingsPlugin: {
        isShowPlugin: false,
      },

      updateIsShowPlugin: (value) =>
        set({
          settingsPlugin: { ...get().settingsPlugin, isShowPlugin: value },
        }),
    }),
    {
      name: 'download-plugin-storage', // Name of the storage
      storage: createJSONStorage(() => localStorage), // Use local storage for persistence
    },
  ),
);
