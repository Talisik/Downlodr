/**
 * Minimal in-memory stand-in for Zustand's set/get, matching the shape every
 * create*Actions(set, get) factory in this folder expects. Lets action tests
 * exercise real production logic without booting the persisted store (which
 * needs IndexedDB + Electron preload globals).
 */
import type { DownloadStoreState } from '../../types';

export function createStoreHarness(initial: Partial<DownloadStoreState> = {}) {
  let state: DownloadStoreState = {
    forDownloads: [],
    downloading: [],
    finishedDownloads: [],
    failedDownloads: [],
    historyDownloads: [],
    queuedDownloads: [],
    availableTags: [],
    availableCategories: [],
    ...initial,
  };

  const set = (
    partial:
      | Partial<DownloadStoreState>
      | ((state: DownloadStoreState) => Partial<DownloadStoreState>),
  ): void => {
    const patch = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...patch };
  };

  const get = (): DownloadStoreState => state;

  return { set, get, getState: () => state };
}
