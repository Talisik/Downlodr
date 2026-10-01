import type { ArticleModel } from '@/afda/backend/schema/articleSchema';
import { mapArticleError } from '@/afda/utils/articleErrorMap';
import { createIndexedDBStorageWithMigration } from '@/core-app/utils/indexedDBStorage';
import { createDebouncedStorage } from '@/downlodr/store/download/storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ArticleLogLevel = 'info' | 'success' | 'warn' | 'error';

export interface ArticleLogEntry {
  /** ISO timestamp. */
  at: string;
  level: ArticleLogLevel;
  message: string;
}

// Retries append to the same log, so cap it to keep the persisted row small.
export const MAX_ARTICLE_LOG_ENTRIES = 200;

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
  favorited?: boolean;
  /** Timeline shown in the article log panel; absent until a download runs. */
  log?: ArticleLogEntry[];
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
  appendArticleLog: (
    id: string,
    level: ArticleLogLevel,
    message: string,
  ) => void;
  removeArticleDownload: (id: string) => void;
  addArticleTag: (id: string, tag: string) => void;
  removeArticleTag: (id: string, tag: string) => void;
  addArticleCategory: (id: string, category: string) => void;
  removeArticleCategory: (id: string, category: string) => void;
  toggleArticleFavorite: (id: string) => void;
}

const withLogEntries = (
  log: ArticleLogEntry[] | undefined,
  entries: ArticleLogEntry[],
): ArticleLogEntry[] =>
  [...(log ?? []), ...entries].slice(-MAX_ARTICLE_LOG_ENTRIES);

const describeSource = (d: ArticleDownload): string =>
  d.id.startsWith('social-post-')
    ? 'social post'
    : d.id.startsWith('afda-article-')
    ? 'AFDA subscription'
    : 'pasted URL';

const formatBytes = (bytes: number): string =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

/** Log lines for a status transition; empty when the status didn't change. */
export const describeStatusChange = (
  prev: ArticleDownload,
  next: ArticleDownload,
): ArticleLogEntry[] => {
  if (prev.status === next.status) return [];
  const at = new Date().toISOString();

  switch (next.status) {
    case 'loading': {
      const attempt =
        (prev.log ?? []).filter((e) => e.message.startsWith('Download started'))
          .length + 1;
      return [
        {
          at,
          level: 'info',
          message: `Download started${
            attempt > 1 ? ` (attempt ${attempt})` : ''
          } — ${next.format.toUpperCase()} from ${describeSource(next)}: ${
            next.url
          }`,
        },
      ];
    }
    case 'finished': {
      const started = [...(prev.log ?? [])]
        .reverse()
        .find((e) => e.message.startsWith('Download started'));
      const seconds = started
        ? ((Date.parse(at) - Date.parse(started.at)) / 1000).toFixed(1)
        : null;
      return [
        {
          at,
          level: 'success',
          message: `Saved to ${next.filePath ?? '(unknown path)'}${
            next.fileSize != null ? ` (${formatBytes(next.fileSize)})` : ''
          }`,
        },
        {
          at,
          level: 'success',
          message: `Download finished${seconds ? ` in ${seconds}s` : ''}`,
        },
      ];
    }
    case 'failed': {
      const info = mapArticleError(next.errorMessage);
      const entries: ArticleLogEntry[] = [
        {
          at,
          level: 'error',
          message: `ERROR [${info.code}]: ${info.title} — ${info.hint}`,
        },
      ];
      if (next.errorMessage)
        entries.push({
          at,
          level: 'error',
          message: `Details: ${next.errorMessage}`,
        });
      return entries;
    }
    case 'for_download':
      return prev.status === 'failed'
        ? [{ at, level: 'info', message: 'Reset for retry' }]
        : [];
  }
};

export const useArticleDownloadStore = create<ArticleDownloadStore>()(
  persist(
    (set) => ({
      articleDownloads: [],

      // No URL dedupe on purpose: pasting the same article again adds another
      // row. The old "already pending" guard dropped the paste silently while
      // the taskbar input cleared, so it looked like nothing happened.
      addArticleDownload: (id, url) =>
        set((state) => {
          return {
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
          };
        }),

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

      // Status changes are logged here rather than in each download path:
      // there are several copies of the download pipeline (row button, context
      // menu, bulk download), and all of them report through this action.
      updateArticleDownload: (id, patch) =>
        set((state) => ({
          articleDownloads: state.articleDownloads.map((d) => {
            if (d.id !== id) return d;
            const next = { ...d, ...patch };
            const entries = describeStatusChange(d, next);
            return entries.length > 0
              ? { ...next, log: withLogEntries(d.log, entries) }
              : next;
          }),
        })),

      appendArticleLog: (id, level, message) =>
        set((state) => ({
          articleDownloads: state.articleDownloads.map((d) =>
            d.id === id
              ? {
                  ...d,
                  log: withLogEntries(d.log, [
                    { at: new Date().toISOString(), level, message },
                  ]),
                }
              : d,
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

      toggleArticleFavorite: (id) =>
        set((state) => ({
          articleDownloads: state.articleDownloads.map((d) =>
            d.id === id ? { ...d, favorited: !d.favorited } : d,
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
              // JSON round-tripping through IndexedDB turns Date fields into
              // strings; revive them so consumers can call Date methods
              // (e.g. ArticleSidePanel's toLocaleDateString) without checking.
              articleData: d.articleData
                ? {
                    ...d.articleData,
                    article_publish_date: d.articleData.article_publish_date
                      ? new Date(d.articleData.article_publish_date)
                      : null,
                    date_updated: new Date(d.articleData.date_updated),
                    date_parsed: new Date(d.articleData.date_parsed),
                  }
                : d.articleData,
            }),
          ),
        };
      },
    },
  ),
);
