import { create } from 'zustand';
import { Video } from './taskbarDownloadStore';

interface PlaylistSelectionStore {
  playlistUrl: string | null;
  videoTitle: string | null;
  playlistVideos: Video[];
  selectedVideoIds: Set<string>;
  isLoading: boolean;
  setPlaylistData: (data: {
    playlistUrl: string;
    videoTitle: string | null;
    playlistVideos: Video[];
  }) => void;
  setIsLoading: (value: boolean) => void;
  toggleVideo: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  reset: () => void;
}

export const usePlaylistSelectionStore = create<PlaylistSelectionStore>(
  (set, get) => ({
    playlistUrl: null,
    videoTitle: null,
    playlistVideos: [],
    selectedVideoIds: new Set<string>(),
    isLoading: false,

    // Everything starts checked — the common case is "download the whole
    // playlist", so users deselect the few they don't want rather than
    // clicking through every row they do. This is also what makes the
    // select-all header checkbox render checked on arrival.
    setPlaylistData: ({ playlistUrl, videoTitle, playlistVideos }) =>
      set({
        playlistUrl,
        videoTitle,
        playlistVideos,
        selectedVideoIds: new Set(playlistVideos.map((video) => video.id)),
      }),

    setIsLoading: (value) => set({ isLoading: value }),

    toggleVideo: (id) =>
      set((state) => {
        const next = new Set(state.selectedVideoIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return { selectedVideoIds: next };
      }),

    selectAll: () =>
      set((state) => {
        const allSelected =
          state.selectedVideoIds.size === state.playlistVideos.length &&
          state.playlistVideos.length > 0;
        return {
          selectedVideoIds: allSelected
            ? new Set<string>()
            : new Set(state.playlistVideos.map((video) => video.id)),
        };
      }),

    clearSelection: () => set({ selectedVideoIds: new Set<string>() }),

    reset: () =>
      set({
        playlistUrl: null,
        videoTitle: null,
        playlistVideos: [],
        selectedVideoIds: new Set<string>(),
        isLoading: false,
      }),
  }),
);
