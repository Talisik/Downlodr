import { create } from 'zustand';

interface PlaylistStore {
  isPlaylistModalOpen: boolean;
  playlistUrl: string;
  shouldFetchPlaylist: boolean;
  openPlaylistModal: (url: string) => void;
  closePlaylistModal: () => void;
}

export const usePlaylistStore = create<PlaylistStore>((set) => ({
  isPlaylistModalOpen: false,
  playlistUrl: '',
  shouldFetchPlaylist: false,
  openPlaylistModal: (url: string) =>
    set({
      isPlaylistModalOpen: true,
      playlistUrl: url,
      shouldFetchPlaylist: true,
    }),
  closePlaylistModal: () =>
    set({
      isPlaylistModalOpen: false,
      playlistUrl: '',
      shouldFetchPlaylist: false,
    }),
}));
