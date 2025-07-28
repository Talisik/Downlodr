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
import { PluginInfo } from '@/plugins/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface PluginSettings {
  isShowPlugin: boolean;
  isOpenPluginSidebar: boolean;
}

// Main interface for the main store
interface PluginStore {
  settingsPlugin: PluginSettings; // Current download settings
  updateIsShowPlugin: (value: boolean) => void;
  updateIsOpenPluginSidebar: (value: boolean) => void;
  plugins: PluginInfo[];
  setPlugins: (plugins: PluginInfo[]) => void;
  loadPlugins: () => Promise<void>;
}

// Create the main store with persistence
export const usePluginStore = create<PluginStore>()(
  persist(
    (set, get) => ({
      settingsPlugin: {
        isShowPlugin: false,
        isOpenPluginSidebar: false,
      },

      updateIsShowPlugin: (value) =>
        set({
          settingsPlugin: { ...get().settingsPlugin, isShowPlugin: value },
        }),
      updateIsOpenPluginSidebar: (value) =>
        set({
          settingsPlugin: {
            ...get().settingsPlugin,
            isOpenPluginSidebar: value,
          },
        }),
      plugins: [] as PluginInfo[],
      setPlugins: (plugins) => set({ plugins }),
      loadPlugins: async () => {
        try {
          const installedPlugins = await window.plugins.list();
          console.log('Loaded plugins:', installedPlugins);
          set({ plugins: installedPlugins });
        } catch (error) {
          console.error('Failed to load plugins:', error);
        }
      },
    }),
    {
      name: 'download-plugin-storage', // Name of the storage
      storage: createJSONStorage(() => localStorage), // Use local storage for persistence
    },
  ),
);
