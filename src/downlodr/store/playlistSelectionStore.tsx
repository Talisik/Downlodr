import { create } from 'zustand';
import type { PlaylistInfoEntry } from '@/global';
import { Video } from './taskbarDownloadStore';

interface PlaylistSelectionStore {
  playlistUrl: string | null;
  videoTitle: string | null;
  playlistVideos: Video[];
  selectedVideoIds: Set<string>;
  isLoading: boolean;
  /**
   * A URL that turned out to be a playlist/series and needs the selection page.
   *
   * Set from non-navigating contexts — currently downloadActions, which only
   * learns the URL is a container once getInfo comes back. Consumed by
   * GlobalPlaylistRedirectListener, which owns the navigation and clears it.
   */
  pendingPlaylistUrl: string | null;
  setPendingPlaylistUrl: (url: string | null) => void;
  setPlaylistData: (data: {
    playlistUrl: string;
    videoTitle: string | null;
    playlistVideos: Video[];
  }) => void;
  setIsLoading: (value: boolean) => void;
  /**
   * Fetch a playlist's entries and load them into this store.
   *
   * Owns the fetch/dedupe/shape work so every entry point (taskbar paste,
   * the container-detected redirect) fills the selection page identically.
   * Returns whether it succeeded; callers own their own error toast, since
   * the wording differs by entry point.
   */
  loadPlaylist: (url: string) => Promise<boolean>;
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
    pendingPlaylistUrl: null,

    setPendingPlaylistUrl: (url) => set({ pendingPlaylistUrl: url }),

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

    loadPlaylist: async (url) => {
      // Clear any previous playlist immediately so a failed fetch doesn't
      // leave the selection page showing stale data.
      get().setPlaylistData({
        playlistUrl: url,
        videoTitle: null,
        playlistVideos: [],
      });
      set({ isLoading: true });
      try {
        const info = await window.ytdlp.getPlaylistInfo(url);

        // Entries can repeat within a playlist; keep the first of each id.
        const uniqueVideos = new Map<string, Video>();
        info.data.entries.forEach((video: PlaylistInfoEntry) => {
          if (!uniqueVideos.has(video.id)) {
            uniqueVideos.set(video.id, {
              url: video.url,
              id: video.id,
              title: video.title,
              thumbnail: video.thumbnails?.[0]?.url || '',
              channel: video.channel,
            });
          }
        });

        get().setPlaylistData({
          playlistUrl: url,
          videoTitle: info.data.title,
          playlistVideos: Array.from(uniqueVideos.values()),
        });
        return true;
      } catch {
        return false;
      } finally {
        set({ isLoading: false });
      }
    },

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
        pendingPlaylistUrl: null,
      }),
  }),
);
