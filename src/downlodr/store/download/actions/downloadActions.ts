/* eslint-disable prettier/prettier */
/**
 * Download actions: addDownload, retryDownload, setDownload.
 * Receives Zustand set/get from the store. Uses payload schemas from downloadPayloads.
 */
import { ToastAction, ToastActionElement } from '@/core-app/components/shadcn/components/ui/toast';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { uuidv4 } from '@/core-app/utils/uuid';
import { type VideoInfo } from '@/downlodr/schema/metadataSchema';
import { FormatService } from '@/downlodr/utils/metadata/formatService';
import { RefreshCw } from 'lucide-react';
import React from 'react';
import {
  selectOptimalCaption,
  type AutomaticCaptionsData,
  type SubtitlesData,
} from '../../../utils/metadata/languageHelper';
import type {
  AddDownloadPayload,
  AddQueuePayload,
  RetryDownloadPayload,
} from '../downloadPayloads';
import type { DownloadStoreState, ForDownload, SpeedDataPoint } from '../types';
import { handleCheckForUpdates, truncateTitle } from '../utils';
/** Zustand setter */
type SetState = (
  partial:
    | Partial<DownloadStoreState>
    | ((state: DownloadStoreState) => Partial<DownloadStoreState>),
) => void;

/** Store getter */
type GetState = () => {
  updateDownload: (id: string, result: unknown) => void;
  forDownloads: ForDownload[];
  removeFromForDownloads: (id: string) => void;
  addQueue: (payload: AddQueuePayload) => void;
};

// Semaphore to throttle concurrent yt-dlp metadata fetches (Fix 2)
let activeInfoFetches = 0;
const MAX_CONCURRENT_INFO_FETCHES = 3;
const infoFetchQueue: Array<() => void> = [];

export function createDownloadActions(set: SetState, get: GetState) {
  return {
    addDownload: async (payload: AddDownloadPayload) => {
      if (!payload.location || !payload.downloadName) return;
      const {
        subscriptionId, videoUrl, name, downloadName, displayName, size, speed,
        channelName, timeLeft, DateAdded, progress, location, status, ext,
        formatId, audioExt, audioFormatId, extractorKey, limitRate,
        automaticCaption, thumbnails, getTranscript, getThumbnail, duration,
        isCreateFolder,
      } = payload;
      get().addQueue({
        subscriptionId, videoUrl, name, downloadName, displayName, size, speed,
        channelName, timeLeft, DateAdded, progress, location, status, ext,
        formatId, audioExt, audioFormatId, extractorKey, limitRate,
        automaticCaption, thumbnails, getTranscript, getThumbnail, duration,
        isCreateFolder,
      });
    },

    retryDownload: async (payload: RetryDownloadPayload) => {
      if (!payload.location || !payload.downloadName) return;
      const {
        videoUrl, name, downloadName, displayName, size, speed, channelName,
        timeLeft, DateAdded, progress, location, status, ext, formatId,
        audioExt, audioFormatId, extractorKey, limitRate, automaticCaption,
        thumbnails, getTranscript, getThumbnail, duration, isCreateFolder,
      } = payload;

      // Delete the old subfolder before queueing so the controller starts fresh
      // instead of appending a counter (e.g. "Video (1)/") on every retry.
      if (isCreateFolder) {
        const sanitizedTitle = name.replace(/[\\/:'*ñ?"<>.|]/g, '_');
        const subfolderPath = await window.downlodrFunctions.joinDownloadPath(location, sanitizedTitle);
        if (await window.downlodrFunctions.fileExists(subfolderPath)) {
          await window.downlodrFunctions.deleteFolder(subfolderPath);
        }
      }

      get().addQueue({
        videoUrl, name, downloadName, displayName, size, speed, channelName,
        timeLeft, DateAdded, progress, location, status, ext, formatId,
        audioExt, audioFormatId, extractorKey, limitRate, automaticCaption,
        thumbnails, getTranscript, getThumbnail, duration, isCreateFolder,
      });
    },

    setDownload: async (
        videoUrl: string,
        location: string,
        limitRate: string,
        options = {
          getTranscript: false,
          getThumbnail: false,
          isFromPlaylist: false,
          playlistBatchId: undefined as string | undefined,
        },
        subscriptionId?: string,
      ) => {
        if (!location) {
          console.error('Invalid path parameters:', { location });
          return;
        }
        const downloadId = uuidv4();

        set((state) => ({
          ...state,
          forDownloads: [
            ...state.forDownloads,
            {
              id: downloadId,
              subscriptionId,
              videoUrl,
              channelName: '',
              name: 'Fetching metadata...',
              downloadName: '',
              displayName: 'Fetching metadata...',
              size: 0,
              speed: '',
              timeLeft: '',
              DateAdded: new Date().toISOString(),
              progress: 0,
              location,
              status: 'fetching metadata',
              ext: '',
              controllerId: undefined,
              tags: [],
              category: [],
              extractorKey: '',
              isLive: false,
              downloadStart: false,
              formatId: '',
              audioExt: '',
              audioFormatId: '',
              elapsed: null,
              automaticCaption: null,
              thumbnails: null,
              autoCaptionLocation: null,
              thumnailsLocation: null,
              getTranscript: options.getTranscript,
              getThumbnail: options.getThumbnail,
              duration: 0,
              isCreateFolder: false,
              log: '',
              downloadPhase: 'video',
              completionCount: 0,
              rawProgress: 0,
              speedHistory: [] as SpeedDataPoint[],
              isFromPlaylist: options.isFromPlaylist,
              playlistBatchId: options.playlistBatchId,
            },
          ],
        }));

        // Throttle concurrent yt-dlp info fetches to avoid spawn storms on playlists
        if (activeInfoFetches >= MAX_CONCURRENT_INFO_FETCHES) {
          await new Promise<void>((resolve) => infoFetchQueue.push(resolve));
        }
        activeInfoFetches++;

        try {
          // Fetch metadata in background (ytdlp returns Record<string, unknown>)
          const info = (await window.ytdlp.getInfo(
            videoUrl,
          )) as unknown as VideoInfo;

          // Get channel name from info
          const channelName = info.data?.channel || info.data?.uploader || '';
          const description = info.data?.description ?? '';
          const subtitles = info.data?.subtitles;
          const automaticCaptions = info.data?.automatic_captions;
          // Only set caption if transcript is requested
          let caption = '—';
          const caption2 = selectOptimalCaption(
            subtitles as SubtitlesData,
            automaticCaptions as AutomaticCaptionsData,
          );
          if (options.getTranscript && caption2) {
            if (!caption2 == null && automaticCaptions) {
              console.log(
                `Selected: ${caption2.languageName} (${caption2.source})`,
              );
              console.log(`Original language: ${caption2.isOriginal}`);
              // Use selectedCaption.caption.url for download
            }
            // Get caption from the optimal selection result
            if (caption2.source === 'subtitle' && subtitles) {
              caption = caption2.caption?.url ?? caption;
            }

            // If no manual subtitles, try automatic captions
            if (caption2.source === 'automatic' && automaticCaptions) {
              caption = caption2.caption?.url ?? caption;
            }
          }

          // Only set thumbnail if thumbnail is requested
          let thumbnail = '—';
          if (
            options.getThumbnail &&
            info.data?.thumbnails &&
            info.data.thumbnails.length > 0
          ) {
            thumbnail = info.data.thumbnail;
            console.log('thumbnail', thumbnail);
          }
          // Process formats using the service
          const { formatOptions, defaultFormatId, defaultExt } =
            await FormatService.processVideoFormats(info);

          // Get default audio format if available
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const defaultAudioFormat = formatOptions.find((f) =>
            f.label.includes('Audio Only'),
          );

          // Update the forDownloads entry with metadata AND the new folder path
          set((state) => ({
            ...state,
            forDownloads: state.forDownloads.map((download) =>
              download.id === downloadId
                ? {
                    ...download,
                    name: truncateTitle(info.data?.title || 'Untitled'),
                    downloadName: truncateTitle(
                      info.data?.title || 'Untitled',
                    ),
                    displayName: info.data?.title || 'Untitled',
                    description,
                    status: 'to download',
                    ext: defaultExt,
                    formatId: defaultFormatId,
                    extractorKey: info.data?.extractor_key || '',
                    audioExt: '',
                    audioFormatId: '',
                    channelName: channelName,
                    downloadStart: false,
                    formats: formatOptions,
                    isLive: info.data?.is_live || false,
                    elapsed: info.data?.elapsed || null,
                    location: location,
                    automaticCaption: caption,
                    thumbnails: thumbnail,
                    getTranscript: options.getTranscript,
                    getThumbnail: options.getThumbnail,
                    duration: info.data?.duration,
                    downloadPhase: 'video',
                    completionCount: 0,
                    rawProgress: 0,
                    speedHistory: [] as SpeedDataPoint[],
                    isFromPlaylist: download.isFromPlaylist,
                    playlistBatchId: download.playlistBatchId,
                  }
                : download,
            ),
          }));
          const currentDownload = get().forDownloads.find(
            (d) => d.id === downloadId,
          );

          if (currentDownload?.isLive) {
            toast({
              variant: 'destructive',
              title: 'Live Video Links Not Allowed',
              description:
                'Live video links are not supported. Please enter a valid URL.',
              duration: 3000,
            });

            get().removeFromForDownloads(downloadId); // Call the method
            return;
          }
        } catch (error) {
          const hasInternetConnection =
            await window.downlodrFunctions.checkInternetConnection();
          console.log(hasInternetConnection);
          if (!hasInternetConnection) {
            toast({
              variant: 'destructive',
              title: 'No Internet Connection',
              description:
                'Please check your internet connection and try again',
              expandable: true, // Add this to make it expandable
              duration: 3000,
              action: React.createElement(
                ToastAction,
                {
                  altText: 'Retry connection check',
                  onClick: handleCheckForUpdates,
                },
                React.createElement(RefreshCw, { size: 12 }),
              ) as unknown as ToastActionElement,
            });
          } else {
            toast({
              variant: 'destructive',
              title: `Could not find video metadata`,
              description: 'Please enter a valid video URL',
              duration: 3000,
            });
          }
          // Access the method correctly
          const { removeFromForDownloads } = get(); // Get the current state methods
          removeFromForDownloads(downloadId); // Call the method

          // Update status to error
          set((state) => ({
            ...state,
            forDownloads: state.forDownloads.map((download) =>
              download.id === downloadId
                ? {
                    ...download,
                    status: 'metadata_error',
                    error: 'Failed to fetch video information',
                  }
                : download,
            ),
          }));
        } finally {
          activeInfoFetches--;
          if (infoFetchQueue.length > 0) {
            infoFetchQueue.shift()!();
          }
        }

        return downloadId;
      },
      updateDownloadStatus: (
        id: string,
        status:
          | 'downloading'
          | 'finished'
          | 'failed'
          | 'cancelled'
          | 'initializing'
          | 'fetching metadata'
          | 'paused',
      ) => {
        set((state) => {
          const newState = {
            ...state,
            downloading: state.downloading.map((download) => {
              if (download.id === id) {
                return { ...download, status };
              }
              return download;
            }),
          };
          return newState;
        });
      },
      renameDownload: (downloadId: string, newName: string) => {
        set((state) => {
          // Update name in all relevant arrays
          const updateDownloadsArray = (downloads: ForDownload[]) =>
            downloads.map((download) =>
              download.id === downloadId
                ? { ...download, displayName: newName, name: newName }
                : download,
            );

          return {
            forDownloads: updateDownloadsArray(state.forDownloads),
          };
        });
      },
  };
}
