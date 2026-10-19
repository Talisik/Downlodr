/**
 * Favorited subscription groups (Skedulosa channels and AFDA websites).
 *
 * Only the subscription itself is favorited — never the downloads inside it.
 * Subscriptions are hydrated from the backends, so the flag can't live on the
 * subscription objects (it would be wiped on every refresh); it's kept here as
 * a set of keys instead. Keys are namespaced by kind because Skedulosa and
 * AFDA ids can collide.
 */
import { createIndexedDBStorageWithMigration } from '@/core-app/utils/indexedDBStorage';
import { createDebouncedStorage } from '@/downlodr/store/download/storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type FavoriteSubscriptionKind = 'skedulosa' | 'afda';

export const favoriteSubscriptionKey = (
  kind: FavoriteSubscriptionKind,
  id: string,
) => `${kind}:${id}`;

interface FavoriteSubscriptionsStore {
  /** Keys built with `favoriteSubscriptionKey`, in the order they were favorited. */
  favorites: string[];
  toggleFavoriteSubscription: (
    kind: FavoriteSubscriptionKind,
    id: string,
  ) => void;
}

export const useFavoriteSubscriptionsStore =
  create<FavoriteSubscriptionsStore>()(
    persist(
      (set) => ({
        favorites: [],

        toggleFavoriteSubscription: (kind, id) =>
          set((state) => {
            const key = favoriteSubscriptionKey(kind, id);
            return {
              favorites: state.favorites.includes(key)
                ? state.favorites.filter((k) => k !== key)
                : [...state.favorites, key],
            };
          }),
      }),
      {
        name: 'favorite-subscriptions-storage',
        storage: createJSONStorage(() =>
          createDebouncedStorage(
            createIndexedDBStorageWithMigration({
              dbName: 'downlodr-database',
              storeName: 'zustand-storage',
              version: 1,
            }),
            250,
          ),
        ),
      },
    ),
  );
