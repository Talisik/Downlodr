import type { ArticleDownload } from '@/afda/store/articleDownloadStore';
import { useSettingStore } from '@/core-app/store/settingsStore';
import { create } from 'zustand';
import {
  BaseDownload,
  Downloading,
  FinishedDownloads,
  ForDownload,
  HistoryDownloads,
  QueuedDownload,
} from './downloadStore';

export interface Video {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  url: string;
}

export interface ArticleSearchableDownload extends BaseDownload {
  type: 'article';
  errorMessage?: string;
  thumbnailDataUrl?: string | null;
  format?: 'docx' | 'pdf';
}

export type SearchableDownload =
  | ForDownload
  | Downloading
  | FinishedDownloads
  | HistoryDownloads
  | QueuedDownload
  | ArticleSearchableDownload;

// Shared mapping so article search results (TaskbarInputField) and the
// article browse view (StatusPage) render the same shape.
export const mapArticleToSearchable = (
  a: ArticleDownload,
): ArticleSearchableDownload => ({
  type: 'article',
  id: a.id,
  name: a.title || a.url,
  displayName: a.title || undefined,
  status: a.status === 'loading' ? 'downloading' : a.status,
  size: a.fileSize ?? 0,
  DateAdded: a.dateAdded,
  uploadDate: a.published_at ?? undefined,
  location: a.filePath ?? '',
  videoUrl: a.url,
  downloadName: a.title || a.url,
  channelName: '',
  extractorKey: 'Article',
  formatId: '',
  audioExt: '',
  audioFormatId: '',
  ext: a.format ?? 'docx',
  format: a.format ?? 'docx',
  speed: '',
  timeLeft: '',
  progress: a.status === 'finished' ? 100 : a.status === 'failed' ? 0 : 50,
  isLive: false,
  favorited: a.favorited ?? false,
  duration: 0,
  getTranscript: false,
  getThumbnail: false,
  tags: a.tags ?? [],
  category: a.category ?? [],
  automaticCaption: null,
  thumbnails: null,
  errorMessage: a.errorMessage,
  thumbnailDataUrl: a.thumbnailDataUrl,
  subscriptionId: a.subscriptionId,
});

interface SearchState {
  isSearchActive: boolean;
  searchQuery: string;
  searchResults: SearchableDownload[];
}

export type TypeFilter = 'videos' | 'subscriptions' | 'articles';

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
  pendingInputUrl: string | null;
  setPendingInputUrl: (url: string | null) => void;
  activeTypeFilters: Set<TypeFilter>;
  toggleTypeFilter: (filter: TypeFilter) => void;
  clearTypeFilters: () => void;
  pendingExtensionDownload: { url: string; format_id?: string } | null;
  setPendingExtensionDownload: (
    data: { url: string; format_id?: string } | null,
  ) => void;
}

export const useTaskbarDownloadStore = create<TaskbarDownloadStore>((set) => ({
  getTranscript: true,
  setGetTranscript: (value) => set({ getTranscript: value }),
  getThumbnail: true,
  setGetThumbnail: (value) => set({ getThumbnail: value }),
  downloadFolder: useSettingStore.getState().settings.defaultLocation,
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
  pendingInputUrl: null,
  setPendingInputUrl: (url) => set({ pendingInputUrl: url }),
  activeTypeFilters: new Set<TypeFilter>(),
  toggleTypeFilter: (filter) =>
    set((s) => {
      const next = new Set(s.activeTypeFilters);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return { activeTypeFilters: next };
    }),
  clearTypeFilters: () => set({ activeTypeFilters: new Set<TypeFilter>() }),
  pendingExtensionDownload: null,
  setPendingExtensionDownload: (data) => set({ pendingExtensionDownload: data }),
}));
