/* eslint-disable prettier/prettier */
/**
 * Misc actions: updateDownloadTranscript, testLocalStorage.
 * Receives Zustand set/get from the store.
 */
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { checkIndexedDBUsage, checkLocalStorageUsage } from '../storage';
import type { DownloadStoreState } from '../types';

/** Zustand setter: accepts partial state or updater function */
type SetState = (
  partial:
    | Partial<DownloadStoreState>
    | ((state: DownloadStoreState) => Partial<DownloadStoreState>),
) => void;

/** Store getter */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GetState = () => any;

export function createMiscActions(set: SetState, _get: GetState) {
  return {
    updateDownloadTranscript: (id: string, transcriptLocation: string) => {
        console.log(
          'Updating transcript location for download:',
          id,
          transcriptLocation,
        );
        set((state) => ({
          downloading: state.downloading.map((download) =>
            download.id === id
              ? { ...download, transcriptLocation, getTranscript: true }
              : download,
          ),
          finishedDownloads: state.finishedDownloads.map((download) =>
            download.id === id
              ? { ...download, transcriptLocation, getTranscript: true }
              : download,
          ),
          historyDownloads: state.historyDownloads.map((download) =>
            download.id === id
              ? { ...download, transcriptLocation, getTranscript: true }
              : download,
          ),
        }));
      },

    testLocalStorage: async () => {
      try {
        const indexedDBStats = await checkIndexedDBUsage();
        const localStorageStats = checkLocalStorageUsage();
        toast({
          title: 'Storage Test Results',
          description: `IndexedDB: ${(indexedDBStats.total / 1024).toFixed(2)} KB (${indexedDBStats.itemCount} items) | localStorage: ${(localStorageStats.total / 1024).toFixed(2)} KB`,
          duration: 8000,
        });
        console.log('Complete storage analysis:', { indexedDB: indexedDBStats, localStorage: localStorageStats });
      } catch (error) {
        console.error('Error testing storage:', error);
        const { total, downlodrSize } = checkLocalStorageUsage();
        toast({
          title: 'Storage Test (localStorage fallback)',
          description: `Total: ${(total / 1024).toFixed(2)} KB, downlodr: ${(downlodrSize / 1024).toFixed(2)} KB`,
          duration: 5000,
        });
      }
    },
  };
}
