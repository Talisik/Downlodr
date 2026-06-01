/**
 * Zustand store for Favorites.
 *
 * Stores self-contained snapshots of favorited downloads so favorites
 * survive original download deletion. Persisted to IndexedDB via the
 * shared `downlodr-database`, object store `favorites-storage`.
 */
import { createIndexedDBStorageWithMigration } from '@/core-app/utils/indexedDBStorage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface FavoriteItem {
  id: string;
  downloadId: string;
  videoUrl: string;
  title: string;
  displayName?: string;
  downloadName: string;
  location: string;
  channelName: string;
  thumbnail?: string;
  ext: string;
  duration: number;
  size: number;
  extractorKey: string;
  tags: string[];
  category: string[];
  description?: string;
  status: string;
  autoCaptionLocation?: string;
  transcriptLocation?: string;
  dateAdded: string;
  favoritedAt: string;
}

interface FavoritesState {
  favorites: FavoriteItem[];
  addFavorite: (snapshot: Omit<FavoriteItem, 'id' | 'favoritedAt'>) => void;
  removeFavorite: (downloadId: string) => void;
  isFavorited: (downloadId: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],

      addFavorite: (snapshot) => {
        if (get().isFavorited(snapshot.downloadId)) return;
        set((state) => ({
          favorites: [
            ...state.favorites,
            {
              ...snapshot,
              id: crypto.randomUUID(),
              favoritedAt: new Date().toISOString(),
            },
          ],
        }));
      },

      removeFavorite: (downloadId) => {
        set((state) => ({
          favorites: state.favorites.filter((f) => f.downloadId !== downloadId),
        }));
      },

      isFavorited: (downloadId) => {
        return get().favorites.some((f) => f.downloadId === downloadId);
      },
    }),
    {
      name: 'favorites-store',
      storage: createJSONStorage(() =>
        createIndexedDBStorageWithMigration({
          dbName: 'downlodr-favorites-database',
          storeName: 'favorites-storage',
          version: 1,
        }),
      ),
    },
  ),
);
