/**
 *
 * This file defines a Zustand store for managing the state of the playlist modal.
 * It provides functionalities to open and close the playlist modal and manage
 * the URL of the playlist.
 *
 * Dependencies:
 * - Zustand: A small, fast state-management solution.
 */
import { create } from 'zustand';

// Interface for the playlist store
interface PlaylistStore {
  isPlaylistModalOpen: boolean; // Indicates if the playlist modal is open
  playlistUrl: string; // URL of the playlist
  shouldFetchPlaylist: boolean; // Indicates if the playlist should be fetched
  openPlaylistModal: (url: string) => void; // Open the playlist modal with a URL
  closePlaylistModal: () => void; // Close the playlist modal
}

// Create the playlist store
export const usePlaylistStore = create<PlaylistStore>((set) => ({
  isPlaylistModalOpen: false, // Initial state of the modal
  playlistUrl: '', // Initial URL
  shouldFetchPlaylist: false, // Initial fetch state
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
