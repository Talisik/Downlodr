import { create } from 'zustand';

/**
 * Mirrors the open state of the page-local side panels (activity tracker and
 * download logs) so components outside the page tree can see them.
 *
 * useSidePanels owns the real state; this store is a read-only projection for
 * consumers like the AI chat floating button, which hides whenever any side
 * panel is open. The plugin sidebar is already global (usePluginStore) and so
 * is not duplicated here.
 */
interface SidePanelStore {
  activityOpen: boolean;
  logsOpen: boolean;
  setActivityOpen: (open: boolean) => void;
  setLogsOpen: (open: boolean) => void;
}

export const useSidePanelStore = create<SidePanelStore>()((set) => ({
  activityOpen: false,
  logsOpen: false,
  setActivityOpen: (open) => set({ activityOpen: open }),
  setLogsOpen: (open) => set({ logsOpen: open }),
}));
