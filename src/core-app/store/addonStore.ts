import { create } from 'zustand';

export type PackName = 'afda-backend' | 'video-nemesis-toolkit';

/** Maps each PackName to the corresponding key on AddonStore's per-pack state. */
export const PACK_STORE_KEY: Record<PackName, 'afda' | 'skedulosa'> = {
  'afda-backend': 'afda',
  'video-nemesis-toolkit': 'skedulosa',
};

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

/** Why the Add-ons manager was opened; drives contextual copy in the modal. */
export type AddonManagerReason = 'afda-required' | null;

interface AddonStore {
  afda: AddonPackState;
  skedulosa: AddonPackState;
  needsRestart: boolean;
  isAddonManagerOpen: boolean;
  addonManagerReason: AddonManagerReason;
  setPackState: (pack: PackName, state: Partial<AddonPackState>) => void;
  setAddonManagerOpen: (open: boolean, reason?: AddonManagerReason) => void;
  cancelDownload: (pack: PackName) => void;
  initFromMain: () => Promise<void>;
}

const DEFAULT_STATE: AddonPackState = { status: 'not-installed' };

export const useAddonStore = create<AddonStore>((set) => ({
  afda: DEFAULT_STATE,
  skedulosa: DEFAULT_STATE,
  needsRestart: false,
  isAddonManagerOpen: false,
  addonManagerReason: null,

  setPackState: (pack, state) =>
    set((s) => {
      const key = PACK_STORE_KEY[pack];
      return { [key]: { ...s[key], ...state } };
    }),

  setAddonManagerOpen: (open, reason = null) =>
    // Reason is only updated on open — left untouched on close so the copy
    // doesn't flip to default mid-way through the modal's close animation.
    set(
      open
        ? { isAddonManagerOpen: true, addonManagerReason: reason }
        : { isAddonManagerOpen: false },
    ),

  cancelDownload: (pack) => {
    window.addonBridge?.cancel(pack)?.catch((err) => {
      console.error('[addonStore] cancelDownload IPC failed:', err);
    });
    const key = PACK_STORE_KEY[pack];
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
      const key = PACK_STORE_KEY[pack];
      set((s) => ({
        [key]: { ...s[key], status: 'downloading', progress: percent },
      }));
    });

    bridge.on.complete(({ pack, success, error }) => {
      const key = PACK_STORE_KEY[pack];
      if (!success)
        console.error(`[addonStore] download failed for ${pack}:`, error);
      set((s) => ({
        needsRestart: success ? true : s.needsRestart,
        [key]: success
          ? { status: 'ready', progress: undefined }
          : { ...s[key], status: 'not-installed', progress: undefined },
      }));
    });
  },
}));
