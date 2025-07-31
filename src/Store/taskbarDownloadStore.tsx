import { create } from 'zustand';
import {
  Downloading,
  FinishedDownloads,
  ForDownload,
  HistoryDownloads,
  QueuedDownload,
} from './downloadStore';
import { useMainStore } from './mainStore';

export interface Video {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  url: string;
}

export type SearchableDownload =
  | ForDownload
  | Downloading
  | FinishedDownloads
  | HistoryDownloads
  | QueuedDownload;

interface SearchState {
  isSearchActive: boolean;
  searchQuery: string;
  searchResults: SearchableDownload[];
}

interface TaskbarDownloadStore {
  getTranscript: boolean;
  setGetTranscript: (value: boolean) => void;
  getThumbnail: boolean;
  setGetThumbnail: (value: boolean) => void;
  downloadFolder: string;
  setDownloadFolder: (value: string) => void;
  isSelectingDirectory: boolean;
  setIsSelectingDirectory: (value: boolean) => void;
  searchState: SearchState;
  setSearchState: (state: Partial<SearchState>) => void;
  clearSearch: () => void;
  activeButton: string | null;
  setActiveButton: (button: string | null) => void;
}

export const useTaskbarDownloadStore = create<TaskbarDownloadStore>((set) => ({
  getTranscript: false,
  setGetTranscript: (value) => set({ getTranscript: value }),
  getThumbnail: false,
  setGetThumbnail: (value) => set({ getThumbnail: value }),
  downloadFolder: useMainStore.getState().settings.defaultLocation,
  setDownloadFolder: (value) => set({ downloadFolder: value }),
  isSelectingDirectory: false,
  setIsSelectingDirectory: (value) => set({ isSelectingDirectory: value }),

  searchState: {
    isSearchActive: false,
    searchQuery: '',
    searchResults: [] as SearchableDownload[],
  },

  setSearchState: (state: Partial<SearchState>) =>
    set((current) => ({
      searchState: { ...current.searchState, ...state },
    })),

  clearSearch: () =>
    set({
      searchState: {
        isSearchActive: false,
        searchQuery: '',
        searchResults: [] as SearchableDownload[],
      },
    }),

  activeButton: null,
  setActiveButton: (button) => set({ activeButton: button }),
}));
