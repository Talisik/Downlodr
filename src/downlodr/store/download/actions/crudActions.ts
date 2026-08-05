/* eslint-disable prettier/prettier */
/**
 * Lifecycle actions for the download store: updateDownload, checkFinishedDownloads,
 * checkStalledDownloads, etc. Receives Zustand set/get from the store.
 */
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import type {
    Downloading,
    DownloadStoreState,
    FailedDownloads,
    FinishedDownloads,
    HistoryDownloads,
    QueuedDownload,
} from '../types';

/** Zustand setter: accepts partial state or updater function */
type SetState = (
  partial:
    | Partial<DownloadStoreState>
    | ((state: DownloadStoreState) => Partial<DownloadStoreState>),
) => void;

/** Store getter */
type GetState = () => {
  failedDownloads: FailedDownloads[];
};

export function createCrudActions(set: SetState, get: GetState) {
  return {
    deleteDownload: (id: string) => {
        set((state) => ({
          downloading: state.downloading.filter((d) => d.id !== id),
          finishedDownloads: state.finishedDownloads.filter(
            (d) => d.id !== id,
          ),
          failedDownloads: state.failedDownloads.filter((d) => d.id !== id),
          historyDownloads: state.historyDownloads.filter((d) => d.id !== id),
          forDownloads: state.forDownloads.filter((d) => d.id !== id),
          queuedDownloads: state.queuedDownloads.filter((d) => d.id !== id),
        }));
      },

      deleteDownloading: (id: string) => {
        set((state) => ({
          downloading: state.downloading.filter(
            (downloading) => downloading.id !== id,
          ),
        }));
      },
      removeFromForDownloads: (id: string) => {
        set((state) => ({
          forDownloads: state.forDownloads.filter(
            (download) => download.id !== id,
          ),
        }));
      },

      removeFailedDownload: (id: string) => {
        set((state) => ({
          failedDownloads: state.failedDownloads.filter((fd) => fd.id !== id),
        }));

        toast({
          title: 'Failed Download Removed',
          description: 'The failed download has been removed from the list.',
          duration: 5000,
        });
      },
      clearFailedDownloads: () => {
        const count = get().failedDownloads.length;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        set((state) => ({
          failedDownloads: [],
        }));

        toast({
          title: 'Failed Downloads Cleared',
          description: `${count} failed downloads have been removed.`,
          duration: 5000,
        });
      },
      setFileMissingFlags: (updates: { id: string; missing: boolean }[]) => {
        if (updates.length === 0) return;

        const updateMap = new Map(updates.map((u) => [u.id, u.missing]));

        set((state) => {
          let changed = false;
          const finishedDownloads = state.finishedDownloads.map((d) => {
            const missing = updateMap.get(d.id);
            if (missing === undefined || d.fileMissing === missing) return d;
            changed = true;
            return { ...d, fileMissing: missing };
          });

          return changed ? { finishedDownloads } : {};
        });
      },
  }
}