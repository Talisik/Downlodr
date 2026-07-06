import { create } from 'zustand';

export type PackName = 'afda-backend' | 'video-nemesis-toolkit';

export type AddonPackStatus =
  | 'not-installed'
  | 'ready'
  | 'outdated'
  | 'downloading';

export interface AddonPackState {
  status: AddonPackStatus;
  installedVersion?: string;
  progress?: number;
}

interface AddonStore {
  afda: AddonPackState;
  skedulosa: AddonPackState;
  needsRestart: boolean;
  isAddonManagerOpen: boolean;
  setPackState: (pack: PackName, state: Partial<AddonPackState>) => void;
  setAddonManagerOpen: (open: boolean) => void;
  cancelDownload: (pack: PackName) => void;
  initFromMain: () => Promise<void>;
}

const DEFAULT_STATE: AddonPackState = { status: 'not-installed' };

export const useAddonStore = create<AddonStore>((set) => ({
  afda: DEFAULT_STATE,
  skedulosa: DEFAULT_STATE,
  needsRestart: false,
  isAddonManagerOpen: false,

  setPackState: (pack, state) =>
    set((s) => {
      const key = pack === 'afda-backend' ? 'afda' : 'skedulosa';
      return { [key]: { ...s[key], ...state } };
    }),

  setAddonManagerOpen: (open) => set({ isAddonManagerOpen: open }),

  cancelDownload: (pack) => {
    window.addonBridge?.cancel(pack)?.catch((err) => {
      console.error('[addonStore] cancelDownload IPC failed:', err);
    });
    const key = pack === 'afda-backend' ? 'afda' : 'skedulosa';
    set((s) => ({
      [key]: { ...s[key], status: 'not-installed', progress: undefined },
    }));
  },

  initFromMain: async () => {
    const bridge = window.addonBridge;
    if (!bridge) return;

    const result = await bridge.getStatus();

    const toPackState = (raw: {
      status: string;
      installedVersion?: string;
    }): AddonPackState => ({
      status: raw.status as AddonPackStatus,
      installedVersion: raw.installedVersion,
    });

    set({
      afda: toPackState(result.afda),
      skedulosa: toPackState(result.skedulosa),
    });

    bridge.on.progress(({ pack, percent }) => {
      const key = pack === 'afda-backend' ? 'afda' : 'skedulosa';
      set((s) => ({ [key]: { ...s[key], status: 'downloading', progress: percent } }));
    });

    bridge.on.complete(({ pack, success, error }) => {
      const key = pack === 'afda-backend' ? 'afda' : 'skedulosa';
      if (!success) console.error(`[addonStore] download failed for ${pack}:`, error);
      set((s) => ({
        needsRestart: success ? true : s.needsRestart,
        [key]: success
          ? { status: 'ready', progress: undefined }
          : { ...s[key], status: 'not-installed', progress: undefined },
      }));
    });
  },
}));
