/* eslint-disable prettier/prettier */
import type {
    BaseDownload,
    Downloading,
    DownloadStoreState,
    FailedDownloads,
    FinishedDownloads,
    HistoryDownloads,
    QueuedDownload
} from '../types';
import {
    updateDownloadCategories,
    updateDownloadTags
} from '../utils';
  

/** Zustand setter: accepts partial state or updater function */
type SetState = (
  partial:
    | Partial<DownloadStoreState>
    | ((state: DownloadStoreState) => Partial<DownloadStoreState>),
) => void;

/** Store getter */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GetState = () => any;

/** Shape of payloads passed to updateDownload from the download engine */
interface UpdateDownloadResult {
  type?: 'controller' | 'completion';
  controllerId?: string;
  data?: {
    log?: string;
    completeLog?: string;
    exitCode?: number;
    value?: {
      _speed_str?: string;
      _eta_str?: string;
      elapsed?: number;
      downloaded_bytes?: string | number;
      total_bytes?: string | number;
      _percent_str?: string;
      status?: string;
    };
  };
  completeLog?: string;
}

export function createTagsCategoriesActions(set: SetState, get: GetState) {
  return {

    
    addTag: (downloadId: string, tag: string) => {
        set((state) => {
          return {
            ...state,
            availableTags: state.availableTags.includes(tag)
              ? state.availableTags
              : [...state.availableTags, tag],
            downloading: updateDownloadTags(
              state.downloading,
              downloadId,
              (tags) => [...tags, tag],
            ),
            finishedDownloads: updateDownloadTags(
              state.finishedDownloads,
              downloadId,
              (tags) => [...tags, tag],
            ),
            historyDownloads: updateDownloadTags(
              state.historyDownloads,
              downloadId,
              (tags) => [...tags, tag],
            ),
            forDownloads: updateDownloadTags(
              state.forDownloads,
              downloadId,
              (tags) => [...tags, tag],
            ),
          };
        });
      },

      removeTag: (downloadId: string, tag: string) => {
        set((state) => {
          return {
            ...state,
            downloading: updateDownloadTags(
              state.downloading,
              downloadId,
              (tags) => tags.filter((t) => t !== tag),
            ),
            finishedDownloads: updateDownloadTags(
              state.finishedDownloads,
              downloadId,
              (tags) => tags.filter((t) => t !== tag),
            ),
            historyDownloads: updateDownloadTags(
              state.historyDownloads,
              downloadId,
              (tags) => tags.filter((t) => t !== tag),
            ),
            forDownloads: updateDownloadTags(
              state.forDownloads,
              downloadId,
              (tags) => tags.filter((t) => t !== tag),
            ),
          };
        });
      },

      addCategory: (downloadId: string, category: string) => {
        set((state) => {
          return {
            ...state,
            availableCategories: state.availableCategories.includes(category)
              ? state.availableCategories
              : [...state.availableCategories, category],
            downloading: updateDownloadCategories(
              state.downloading,
              downloadId,
              (categories) => [...categories, category],
            ),
            finishedDownloads: updateDownloadCategories(
              state.finishedDownloads,
              downloadId,
              (categories) => [...categories, category],
            ),
            historyDownloads: updateDownloadCategories(
              state.historyDownloads,
              downloadId,
              (categories) => [...categories, category],
            ),
            forDownloads: updateDownloadCategories(
              state.forDownloads,
              downloadId,
              (categories) => [...categories, category],
            ),
          };
        });
      },

      removeCategory: (downloadId: string, category: string) => {
        set((state) => {
          return {
            ...state,
            downloading: updateDownloadCategories(
              state.downloading,
              downloadId,
              (categories) => categories.filter((c) => c !== category),
            ),
            finishedDownloads: updateDownloadCategories(
              state.finishedDownloads,
              downloadId,
              (categories) => categories.filter((c) => c !== category),
            ),
            historyDownloads: updateDownloadCategories(
              state.historyDownloads,
              downloadId,
              (categories) => categories.filter((c) => c !== category),
            ),
            forDownloads: updateDownloadCategories(
              state.forDownloads,
              downloadId,
              (categories) => categories.filter((c) => c !== category),
            ),
          };
        });
      },

      renameCategory: (oldName: string, newName: string) =>
        set((state) => {
          const updateDownloads = <T extends BaseDownload>(
            downloads: T[],
          ): T[] =>
            downloads.map((download) => ({
              ...download,
              category: download.category?.map((cat) =>
                cat === oldName ? newName : cat,
              ),
            }));

          return {
            ...state,
            availableCategories: state.availableCategories.map((cat) =>
              cat === oldName ? newName : cat,
            ),
            downloading: updateDownloads(state.downloading),
            finishedDownloads: updateDownloads(state.finishedDownloads),
            historyDownloads: updateDownloads(state.historyDownloads),
            forDownloads: updateDownloads(state.forDownloads),
          };
        }),

      deleteCategory: (category: string) =>
        set((state) => {
          const updateDownloads = <T extends BaseDownload>(
            downloads: T[],
          ): T[] =>
            downloads.map((download) => ({
              ...download,
              category: download.category?.filter((cat) => cat !== category),
            }));

          return {
            ...state,
            availableCategories: state.availableCategories.filter(
              (cat) => cat !== category,
            ),
            downloading: updateDownloads(state.downloading),
            finishedDownloads: updateDownloads(state.finishedDownloads),
            historyDownloads: updateDownloads(state.historyDownloads),
            forDownloads: updateDownloads(state.forDownloads),
          };
        }),

      renameTag: (oldName: string, newName: string) =>
        set((state) => {
          const updateDownloads = <T extends BaseDownload>(
            downloads: T[],
          ): T[] =>
            downloads.map((download) => ({
              ...download,
              tags: download.tags?.map((tag) =>
                tag === oldName ? newName : tag,
              ),
            }));

          return {
            ...state,
            availableTags: state.availableTags.map((tag) =>
              tag === oldName ? newName : tag,
            ),
            downloading: updateDownloads(state.downloading),
            finishedDownloads: updateDownloads(state.finishedDownloads),
            historyDownloads: updateDownloads(state.historyDownloads),
            forDownloads: updateDownloads(state.forDownloads),
          };
        }),

      deleteTag: (tag: string) =>
        set((state) => {
          const updateDownloads = <T extends BaseDownload>(
            downloads: T[],
          ): T[] =>
            downloads.map((download) => ({
              ...download,
              tags: download.tags?.filter((t) => t !== tag),
            }));

          return {
            ...state,
            availableTags: state.availableTags.filter((t) => t !== tag),
            downloading: updateDownloads(state.downloading),
            finishedDownloads: updateDownloads(state.finishedDownloads),
            historyDownloads: updateDownloads(state.historyDownloads),
            forDownloads: updateDownloads(state.forDownloads),
          };
        }),
  }
}