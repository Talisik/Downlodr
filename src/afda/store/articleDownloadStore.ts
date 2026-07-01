import type { ArticleModel } from '@/afda/backend/schema/articleSchema';
import { createIndexedDBStorageWithMigration } from '@/core-app/utils/indexedDBStorage';
import { createDebouncedStorage } from '@/downlodr/store/download/storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface ArticleDownload {
  id: string;
  title: string;
  url: string;
  subscriptionId?: string;
  sectionId?: string;
  status: 'loading' | 'for_download' | 'finished' | 'failed';
  format: 'docx' | 'pdf';
  filePath: string | null;
  fileSize: number | null;
  dateAdded: string;
  published_at?: string | null;
  errorMessage?: string;
  articleData: ArticleModel | null;
  thumbnailDataUrl: string | null;
  tags: string[];
  category: string[];
}

export interface AfdaArticleInput {
  id: string;
  title: string;
  url: string;
  subscriptionId: string;
  dateAdded: string;
  thumbnailDataUrl?: string | null;
  sectionId?: string;
  publishedAt?: string | null;
}

interface ArticleDownloadStore {
  articleDownloads: ArticleDownload[];
  addArticleDownload: (id: string, url: string) => void;
  addAfdaArticle: (
    id: string,
    title: string,
    url: string,
    subscriptionId: string,
    dateAdded: string,
    thumbnailDataUrl?: string | null,
    sectionId?: string,
    publishedAt?: string | null,
  ) => void;
  addAfdaArticlesBatch: (articles: AfdaArticleInput[]) => void;
  updateArticleDownload: (id: string, patch: Partial<ArticleDownload>) => void;
  removeArticleDownload: (id: string) => void;
  addArticleTag: (id: string, tag: string) => void;
  removeArticleTag: (id: string, tag: string) => void;
  addArticleCategory: (id: string, category: string) => void;
  removeArticleCategory: (id: string, category: string) => void;
}

export const useArticleDownloadStore = create<ArticleDownloadStore>()(
  persist(
    (set) => ({
      articleDownloads: [],

      addArticleDownload: (id, url) =>
        set((state) => ({
          articleDownloads: [
            {
              id,
              title: '',
              url,
              status: 'for_download',
              format: 'docx',
              filePath: null,
              fileSize: null,
              dateAdded: new Date().toISOString(),
              articleData: null,
              thumbnailDataUrl: null,
              tags: [],
              category: [],
            },
            ...state.articleDownloads,
          ],
        })),

      addAfdaArticle: (
        id,
        title,
        url,
        subscriptionId,
        dateAdded,
        thumbnailDataUrl = null,
        sectionId,
        publishedAt,
      ) =>
        set((state) => {
          if (state.articleDownloads.some((d) => d.id === id)) return state;
          return {
            articleDownloads: [
              {
                id,
                title,
                url,
                subscriptionId,
                sectionId,
                status: 'for_download' as const,
                format: 'docx' as const,
                filePath: null,
                fileSize: null,
                dateAdded,
                published_at: publishedAt,
                articleData: null,
                thumbnailDataUrl,
                tags: [],
                category: [],
              },
              ...state.articleDownloads,
            ],
          };
        }),

      addAfdaArticlesBatch: (articles) =>
        set((state) => {
          const existingIds = new Set(state.articleDownloads.map((d) => d.id));
          const incoming = articles.filter((a) => !existingIds.has(a.id));
          if (incoming.length === 0) return state;
          const newItems: ArticleDownload[] = incoming.map((a) => ({
            id: a.id,
            title: a.title,
            url: a.url,
            subscriptionId: a.subscriptionId,
            sectionId: a.sectionId,
            status: 'for_download' as const,
            format: 'docx' as const,
            filePath: null,
            fileSize: null,
            dateAdded: a.dateAdded,
            published_at: a.publishedAt ?? null,
            articleData: null,
            thumbnailDataUrl: a.thumbnailDataUrl ?? null,
            tags: [],
            category: [],
          }));
          return { articleDownloads: [...newItems, ...state.articleDownloads] };
        }),

      updateArticleDownload: (id, patch) =>
        set((state) => ({
          articleDownloads: state.articleDownloads.map((d) =>
            d.id === id ? { ...d, ...patch } : d,
          ),
        })),

      removeArticleDownload: (id) =>
        set((state) => ({
          articleDownloads: state.articleDownloads.filter((d) => d.id !== id),
        })),

      addArticleTag: (id, tag) =>
        set((state) => ({
          articleDownloads: state.articleDownloads.map((d) =>
            d.id === id && !(d.tags ?? []).includes(tag)
              ? { ...d, tags: [...(d.tags ?? []), tag] }
              : d,
          ),
        })),

      removeArticleTag: (id, tag) =>
        set((state) => ({
          articleDownloads: state.articleDownloads.map((d) =>
            d.id === id
              ? { ...d, tags: (d.tags ?? []).filter((t) => t !== tag) }
              : d,
          ),
        })),

      addArticleCategory: (id, category) =>
        set((state) => ({
          articleDownloads: state.articleDownloads.map((d) =>
            d.id === id && !(d.category ?? []).includes(category)
              ? { ...d, category: [...(d.category ?? []), category] }
              : d,
          ),
        })),

      removeArticleCategory: (id, category) =>
        set((state) => ({
          articleDownloads: state.articleDownloads.map((d) =>
            d.id === id
              ? {
                  ...d,
                  category: (d.category ?? []).filter((c) => c !== category),
                }
              : d,
          ),
        })),
    }),
    {
      name: 'article-downloads-storage',
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
      // Backfill tags/category for articles persisted before these fields
      // existed, so downstream code (and the mutators above) never sees
      // undefined arrays.
      merge: (persisted, current) => {
        const persistedState = (persisted ??
          {}) as Partial<ArticleDownloadStore>;
        return {
          ...current,
          ...persistedState,
          articleDownloads: (persistedState.articleDownloads ?? []).map(
            (d) => ({
              ...d,
              tags: d.tags ?? [],
              category: d.category ?? [],
            }),
          ),
        };
      },
    },
  ),
);
