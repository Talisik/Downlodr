import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface DownloadSettings {
  defaultLocation: string;
  defaultDownloadSpeed: number;
  defaultDownloadSpeedBit: string;
  permitConnectionLimit: boolean;
  maxUploadNum: number;
  maxDownloadNum: number;
}

interface SelectedDownload {
  id: string;
  controllerId?: string;
  location?: string;
}

interface MainStore {
  settings: DownloadSettings;
  selectedDownloads: SelectedDownload[];
  setSelectedDownloads: (downloads: SelectedDownload[]) => void;
  clearSelectedDownloads: () => void;
  updateDefaultLocation: (location: string) => void;
  updateDefaultDownloadSpeed: (speed: number) => void;
  updateDefaultDownloadSpeedBit: (speedBit: string) => void;
  updatePermitConnectionLimit: (isPermit: boolean) => void;
  updateMaxUploadNum: (speed: number) => void;
  updateMaxDownloadNum: (count: number) => void;
  selectedRows: string[];
  setSelectedRows: (rows: string[]) => void;
  clearSelectedRows: () => void;
}

export const useMainStore = create<MainStore>()(
  persist(
    (set) => ({
      settings: {
        defaultLocation: '', // Start with empty string
        defaultDownloadSpeed: 0,
        defaultDownloadSpeedBit: 'kb',
        permitConnectionLimit: false,
        maxUploadNum: 5,
        maxDownloadNum: 5,
      },
      selectedDownloads: [] as SelectedDownload[],
      setSelectedDownloads: (downloads) =>
        set({ selectedDownloads: downloads }),
      clearSelectedDownloads: () => set({ selectedDownloads: [] }),

      updateDefaultLocation: (location: string) =>
        set((state) => ({
          settings: { ...state.settings, defaultLocation: location },
        })),

      updateDefaultDownloadSpeed: (speed: number) =>
        set((state) => ({
          settings: { ...state.settings, defaultDownloadSpeed: speed },
        })),

      updateDefaultDownloadSpeedBit: (speedBit: string) =>
        set((state) => ({
          settings: { ...state.settings, defaultDownloadSpeedBit: speedBit },
        })),

      updatePermitConnectionLimit: (isPermit: boolean) =>
        set((state) => ({
          settings: { ...state.settings, permitConnectionLimit: isPermit },
        })),

      updateMaxUploadNum: (speed: number) =>
        set((state) => ({
          settings: { ...state.settings, maxUploadNum: speed },
        })),

      updateMaxDownloadNum: (count: number) =>
        set((state) => ({
          settings: { ...state.settings, maxDownloadNum: count },
        })),

      selectedRows: [] as string[],
      setSelectedRows: (rows) => set({ selectedRows: rows }),
      clearSelectedRows: () => set({ selectedRows: [] }),
    }),
    {
      name: 'download-settings-storage',
      storage: createJSONStorage(() => localStorage),
      // Add onRehydrateStorage to handle initialization
      onRehydrateStorage: () => (state) => {
        if (!state?.settings.defaultLocation) {
          window.downlodrFunctions.getDownloadFolder().then((path) => {
            useMainStore.getState().updateDefaultLocation(path);
          });
        }
      },
    },
  ),
);
