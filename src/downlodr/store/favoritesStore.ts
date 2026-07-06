/**
 * Zustand store for Favorites.
 *
 * Stores self-contained snapshots of favorited downloads so favorites
 * survive original download deletion. Persisted to IndexedDB via the
 * shared `downlodr-database`, object store `favorites-storage`.
 */
import { createIndexedDBStorageWithMigration } from '@/core-app/utils/indexedDBStorage';
import { ChapterInfo } from './download/types';
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
  chapters?: ChapterInfo[];
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
  updateFavoriteTags: (downloadId: string, tags: string[]) => void;
  /** Replaces categories on the matched item. Parameter `categories` writes to the `category` field on FavoriteItem. */
  updateFavoriteCategories: (downloadId: string, categories: string[]) => void;
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

      updateFavoriteTags: (downloadId, tags) => {
        if (!get().isFavorited(downloadId)) return;
        set((state) => ({
          favorites: state.favorites.map((f) =>
            f.downloadId === downloadId ? { ...f, tags } : f,
          ),
        }));
      },

      updateFavoriteCategories: (downloadId, categories) => {
        if (!get().isFavorited(downloadId)) return;
        set((state) => ({
          favorites: state.favorites.map((f) =>
            f.downloadId === downloadId ? { ...f, category: categories } : f,
          ),
        }));
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
