/**
 *
 * This file defines a Zustand store for managing the state of the plugins
 * It provides functionalities to interact with the plugin features through the frontend site
 *
 * Dependencies:
 * - Zustand: A small, fast state-management solution.
 */
import { create } from 'zustand';

// Interface for the playlist store
interface PluginStore {
  isShowPlugin: boolean; // Indicates if the playlist modal is open
}

// Create the playlist store
export const usePluginStore = create<PluginStore>((set) => ({
  isShowPlugin: false, // Initial state of the plugin
  setShowPlugin: (showPlugin: boolean) =>
    set({
      isShowPlugin: showPlugin,
    }),
}));
