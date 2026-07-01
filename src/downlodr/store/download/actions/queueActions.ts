/* eslint-disable prettier/prettier */
/**
 * Lifecycle actions for the download store: updateDownload, checkFinishedDownloads,
 * checkStalledDownloads, etc. Receives Zustand set/get from the store.
 */
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { subscriptionDownloadSync } from '@/skedulosa/services/subscriptionDownloadSync';
import { DownloadController } from '../controller';
import type { AddQueuePayload } from '../downloadPayloads';
import type {
  DownloadStoreState,
  QueuedDownload,
  SpeedDataPoint,
} from '../types';
import { uuidv4 } from '../utils';

/** Zustand setter: accepts partial state or updater function */
type SetState = (
  partial:
    | Partial<DownloadStoreState>
    | ((state: DownloadStoreState) => Partial<DownloadStoreState>),
) => void;

/** Store getter */
type GetState = () => {
  queuedDownloads: QueuedDownload[];
  processQueue: () => void;
  cleanup: () => void;
};

const downloadController = DownloadController.getInstance();

export function createQueueActions(set: SetState, get: GetState) {
  return {
    addQueue: (payload: AddQueuePayload) => {
        const {
          subscriptionId,
          videoUrl,
          name,
          downloadName,
          displayName,
          size,
          speed,
          channelName,
          timeLeft,
          DateAdded,
          progress,
          location,
          ext,
          formatId,
          audioExt,
          audioFormatId,
          extractorKey,
          limitRate,
          automaticCaption,
          thumbnails,
          getTranscript,
          getThumbnail,
          duration,
          isCreateFolder,
          description,
          chapters,
          autoCaptionLocation,
          thumnailsLocation,
          transcriptLocation,
        } = payload;
        console.log('[Queue] addQueue called with payload:', payload);
        const queueId = uuidv4();

        set((state) => ({
          queuedDownloads: [
            ...state.queuedDownloads,
            {
              subscriptionId: subscriptionId,
              id: queueId,
              videoUrl,
              name,
              downloadName,
              displayName: displayName,
              size,
              speed,
              channelName: channelName || '',
              timeLeft,
              DateAdded,
              progress,
              location,
              status: 'queued',
              ext,
              formatId,
              audioExt,
              audioFormatId,
              extractorKey,
              limitRate,
              automaticCaption,
              thumbnails,
              getTranscript,
              getThumbnail,
              duration,
              isCreateFolder,
              description,
              chapters,
              autoCaptionLocation,
              thumnailsLocation,
              transcriptLocation,
              queuedAt: new Date().toISOString(),
              tags: [],
              category: [],
              isLive: false,
              elapsed: 0,
              controllerId: undefined,
              log: '',
              downloadPhase: 'video' as const,
              completionCount: 0,
              rawProgress: 0,
              speedHistory: [] as SpeedDataPoint[],
            },
          ],
        }));

        // If this is a subscription download, register it with the sync service
        console.log('[Queue] addQueue called — subscriptionId:', subscriptionId ?? 'NONE', '| queueId:', queueId);
        if (subscriptionId) {
          subscriptionDownloadSync.registerQueuedSubscriptionDownload(
            queueId,
            subscriptionId,
            {
              name,
              displayName,
              thumbnails,
              size,
              speed,
            }
          );
        }

        toast({
          title: 'Download Added to Queue',
          description: `"${name}" has been added to the download queue. Position: ${
            get().queuedDownloads.length
          }`,
          duration: 3000,
        });
        // Start the worker to process the queue
        downloadController.startWorker();
      },

      processQueue: () => {
        // Start the download worker - it will automatically stop when queue is empty
        downloadController.startWorker();
      },

      removeFromQueue: (id: string) => {
        set((state) => ({
          queuedDownloads: state.queuedDownloads.filter((q) => q.id !== id),
        }));
      },

      clearQueue: () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        set((state) => ({
          queuedDownloads: [],
        }));

        toast({
          title: 'Queue Cleared',
          description: 'All queued downloads have been removed.',
          duration: 2000,
        });
      },

      moveQueueItem: (id: string, direction: 'up' | 'down') => {
        set((state) => {
          const queuedDownloads = [...state.queuedDownloads];
          const currentIndex = queuedDownloads.findIndex((q) => q.id === id);

          if (currentIndex === -1) return state;

          const newIndex =
            direction === 'up'
              ? Math.max(0, currentIndex - 1)
              : Math.min(queuedDownloads.length - 1, currentIndex + 1);

          if (newIndex === currentIndex) return state;

          // Swap items
          [queuedDownloads[currentIndex], queuedDownloads[newIndex]] = [
            queuedDownloads[newIndex],
            queuedDownloads[currentIndex],
          ];

          return { queuedDownloads };
        });
      },

      getQueuePosition: (id: string) => {
        const queuedDownloads = get().queuedDownloads;
        return queuedDownloads.findIndex((q) => q.id === id) + 1;
      },

      // cleanup method to prevent memory leaks
      cleanup: () => {
        downloadController.cleanup();
      },

  }
}