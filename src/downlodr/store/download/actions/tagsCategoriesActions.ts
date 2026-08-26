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
import { mergeTierResult } from '@/auto-tag/merge';
import type { TagResult } from '@/auto-tag/types';


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

  /**
   * Apply auto-tag results (from the auto-tag IPC) across all download lists.
   * For each result, merges the tier's tags into the download's existing tags
   * using the accumulate rules (manual + other tier preserved; this tier's
   * tags refreshed), tracking per-tag source in `tagSource`.
   */
  applyAutoTags: (results: TagResult[]) => {
   const byId = new Map(results.map((r) => [r.id, r] as const));

   const applyToList = <T extends BaseDownload>(list: T[]): T[] =>
    list.map((d) => {
     const result = byId.get(d.id);
     if (!result) return d;
     const merged = mergeTierResult(
      { tags: d.tags ?? [], tagSource: d.tagSource },
      result,
     );
     return { ...d, tags: merged.tags, tagSource: merged.tagSource };
    });

   set((state) => {
    const available = new Set(state.availableTags);
    for (const r of results) for (const t of r.tags) available.add(t);

    return {
     ...state,
     availableTags: [...available],
     downloading: applyToList(state.downloading),
     finishedDownloads: applyToList(state.finishedDownloads),
     historyDownloads: applyToList(state.historyDownloads),
     forDownloads: applyToList(state.forDownloads),
    };
   });
  },


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
     queuedDownloads: updateDownloadTags(
      state.queuedDownloads,
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
     queuedDownloads: updateDownloadTags(
      state.queuedDownloads,
      downloadId,
      (tags) => tags.filter((t) => t !== tag),
     ),
    };
   });
  },

  toggleFavorite: (downloadId: string) => {
   set((state) => {
    const lists = [
     state.downloading,
     state.finishedDownloads,
     state.historyDownloads,
     state.forDownloads,
     state.queuedDownloads,
    ];
    const existing = lists
     .flat()
     .find((d) => d.id === downloadId) as BaseDownload | undefined;
    const nextFavorited = !existing?.favorited;

    const applyToList = <T extends BaseDownload>(list: T[]): T[] =>
     list.map((d) =>
      d.id === downloadId ? { ...d, favorited: nextFavorited } : d,
     );

    return {
     ...state,
     downloading: applyToList(state.downloading),
     finishedDownloads: applyToList(state.finishedDownloads),
     historyDownloads: applyToList(state.historyDownloads),
     forDownloads: applyToList(state.forDownloads),
     queuedDownloads: applyToList(state.queuedDownloads),
    };
   });
  },

  setFavorited: (downloadId: string, favorited: boolean) => {
   set((state) => {
    const applyToList = <T extends BaseDownload>(list: T[]): T[] =>
     list.map((d) => (d.id === downloadId ? { ...d, favorited } : d));

    return {
     ...state,
     downloading: applyToList(state.downloading),
     finishedDownloads: applyToList(state.finishedDownloads),
     historyDownloads: applyToList(state.historyDownloads),
     forDownloads: applyToList(state.forDownloads),
     queuedDownloads: applyToList(state.queuedDownloads),
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
     queuedDownloads: updateDownloadCategories(
      state.queuedDownloads,
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
     queuedDownloads: updateDownloadCategories(
      state.queuedDownloads,
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
     queuedDownloads: updateDownloads(state.queuedDownloads),
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
     queuedDownloads: updateDownloads(state.queuedDownloads),
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
     queuedDownloads: updateDownloads(state.queuedDownloads),
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
     queuedDownloads: updateDownloads(state.queuedDownloads),
    };
   }),
 }
}