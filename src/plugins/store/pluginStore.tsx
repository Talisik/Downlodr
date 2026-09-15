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
import { lookupPluginIconByName } from '@/plugins/hook/githubPluginHook';
import { PluginInfo } from '@/plugins/schema/types';
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
          // console.log('Loaded plugins:', installedPlugins);
          // Match browse-tab icons by name, not id: browse ids are slugified
          // from GitHub release headings while installed ids come from each
          // plugin's own manifest.json - unrelated namespaces that don't
          // reliably line up. Name is the field both sides render identically.
          const plugins = installedPlugins.map((plugin) => ({
            ...plugin,
            icon: lookupPluginIconByName(plugin.name) ?? plugin.icon,
          }));
          set({ plugins });
        } catch (error) {
          console.error('Failed to load plugins:', error);
        }
      },
    }),
    {
      name: 'download-plugin-storage', // Name of the storage
      storage: createJSONStorage(() => localStorage), // Use local storage for persistence
      // isOpenPluginSidebar is session state, not a setting. The panel's content
      // lives in PluginSidePanelManager's local `currentRequest`, which is always
      // null on a fresh mount - so restoring the flag as `true` leaves an open
      // panel with nothing to render: an empty panel area beside a StatusPage
      // table stuck in its collapsed eye-column layout, with no way back (the
      // manager only self-closes when `currentRequest` exists). A force-quit or
      // reload while a plugin panel was open is enough to write that `true`.
      //
      // merge is the load-bearing half - it forces the flag off on the read path,
      // which also heals installs that already have `true` on disk. partialize
      // keeps it from being written again. Everything else still persists.
      partialize: (state) => ({
        ...state,
        settingsPlugin: { ...state.settingsPlugin, isOpenPluginSidebar: false },
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<PluginStore>;
        return {
          ...currentState,
          ...persisted,
          settingsPlugin: {
            ...currentState.settingsPlugin,
            ...persisted.settingsPlugin,
            isOpenPluginSidebar: false,
          },
        };
      },
    },
  ),
);
