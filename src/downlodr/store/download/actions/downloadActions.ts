/* eslint-disable prettier/prettier */
/**
 * Download actions: addDownload, retryDownload, setDownload.
 * Receives Zustand set/get from the store. Uses payload schemas from downloadPayloads.
 */
import { ToastAction, ToastActionElement } from '@/core-app/components/shadcn/components/ui/toast';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { uuidv4 } from '@/core-app/utils/uuid';
import { type VideoInfo } from '@/downlodr/schema/metadataSchema';
import { usePlaylistSelectionStore } from '@/downlodr/store/playlistSelectionStore';
import {
  acquireInfoFetchSlot,
  releaseInfoFetchSlot,
} from '@/downlodr/utils/download/infoFetchQueue';
import { FormatService } from '@/downlodr/utils/metadata/formatService';
import { RefreshCw } from 'lucide-react';
import React from 'react';
import {
  selectOptimalCaption,
  type AutomaticCaptionsData,
  type CaptionInfo,
  type SubtitlesData,
} from '../../../utils/metadata/languageHelper';
import type {
  AddDownloadPayload,
  AddQueuePayload,
  RetryDownloadPayload,
} from '../downloadPayloads';
import type { ChapterInfo, DownloadStoreState, ForDownload, SpeedDataPoint } from '../types';
import { handleCheckForUpdates, parseYtdlpUploadDate, truncateTitle } from '../utils';
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


export function createDownloadActions(set: SetState, get: GetState) {
  return {
    addDownload: async (payload: AddDownloadPayload) => {
      if (!payload.location || !payload.downloadName) return;
      const {
        subscriptionId, videoUrl, name, downloadName, displayName, size, speed,
        channelName, timeLeft, DateAdded, uploadDate, progress, location, status, ext,
        formatId, audioExt, audioFormatId, extractorKey, limitRate,
        automaticCaption, thumbnails, getTranscript, getThumbnail, duration,
        isCreateFolder, tags, category,
      } = payload;
      get().addQueue({
        subscriptionId, videoUrl, name, downloadName, displayName, size, speed,
        channelName, timeLeft, DateAdded, uploadDate, progress, location, status, ext,
        formatId, audioExt, audioFormatId, extractorKey, limitRate,
        automaticCaption, thumbnails, getTranscript, getThumbnail, duration,
        isCreateFolder, tags, category,
      });
    },

    retryDownload: async (payload: RetryDownloadPayload) => {
      if (!payload.location || !payload.downloadName) return;
      const {
        videoUrl, name, downloadName, displayName, size, speed, channelName,
        timeLeft, DateAdded, uploadDate, progress, location, status, ext, formatId,
        audioExt, audioFormatId, extractorKey, limitRate, automaticCaption,
        thumbnails, getTranscript, getThumbnail, duration, isCreateFolder,
        tags, category,
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
        timeLeft, DateAdded, uploadDate, progress, location, status, ext, formatId,
        audioExt, audioFormatId, extractorKey, limitRate, automaticCaption,
        thumbnails, getTranscript, getThumbnail, duration, isCreateFolder,
        tags, category,
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
          autoQueueFormatId: undefined as string | undefined,
          autoDownload: undefined as boolean | undefined,
        },
        subscriptionId?: string,
      ) => {
        console.log("download actions")
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

        // Throttle concurrent yt-dlp info fetches to avoid spawn storms on
        // playlists. The gate prefers rows the user can currently see, so a
        // 100-entry playlist fills page 1 before the off-screen pages.
        await acquireInfoFetchSlot(downloadId);

        try {
          // Fetch metadata in background (ytdlp returns Record<string, unknown>)
          const info = (await window.ytdlp.getInfo(
            videoUrl,
          )) as unknown as VideoInfo;

          // Get channel name from info
          const channelName = info.data?.channel || info.data?.uploader || '';
          const description = info.data?.description ?? '';
          const uploadDate = parseYtdlpUploadDate(info.data?.upload_date);
          // Native category + structured music fields from yt-dlp metadata
          const nativeCategory = info.data?.categories?.[0];
          const musicArtist =
            info.data?.artist ||
            info.data?.artists?.join(', ') ||
            info.data?.creator ||
            undefined;
          const musicTrack = info.data?.track ?? undefined;
          const musicAlbum = info.data?.album ?? undefined;
          const chapters = (info.data?.chapters as ChapterInfo[] | undefined) ?? [];
          const subtitles = info.data?.subtitles;
          const automaticCaptions = info.data?.automatic_captions;
          // Only set caption if transcript is requested
          let caption: CaptionInfo | null = null;
          const caption2 = selectOptimalCaption(
            subtitles as SubtitlesData,
            automaticCaptions as AutomaticCaptionsData,
          );
          if (options.getTranscript && caption2?.caption) {
            console.log(
              `Selected: ${caption2.languageName} (${caption2.source})`,
            );
            console.log(`Original language: ${caption2.isOriginal}`);
            caption = caption2.caption;
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
                    chapters,
                    status: 'to download',
                    ext: defaultExt,
                    formatId: defaultFormatId,
                    extractorKey: info.data?.extractor_key || '',
                    audioExt: '',
                    audioFormatId: '',
                    channelName: channelName,
                    nativeCategory,
                    musicArtist,
                    musicTrack,
                    musicAlbum,
                    downloadStart: false,
                    formats: formatOptions,
                    isLive: info.data?.is_live || false,
                    elapsed: info.data?.elapsed ?? undefined,
                    uploadDate,
                    location: location,
                    automaticCaption: caption,
                    thumbnails: thumbnail,
                    getTranscript: options.getTranscript,
                    getThumbnail: options.getThumbnail,
                    duration: info.data?.duration ?? 0,
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
          /*
          if (currentDownload?.isLive) { 
            toast({
              variant: 'destructive',
              title: 'Live Video Links Not Allowed',
              description:
                'Live video links are not supported. Please enter a valid URL.',
              duration: 5000,
            });

            get().removeFromForDownloads(downloadId); // Call the method
            return;
          }
          */
          if (options.autoDownload && options.autoQueueFormatId && currentDownload) {
            const match = formatOptions.find(
              (f) =>
                f.formatId === options.autoQueueFormatId ||
                f.formatId.endsWith(`+${options.autoQueueFormatId}`),
            );
            const chosenFormatId = match?.formatId ?? defaultFormatId;
            const chosenExt = match?.fileExtension ?? defaultExt;

            set((state) => ({
              ...state,
              forDownloads: state.forDownloads.map((d) =>
                d.id === downloadId
                  ? { ...d, ext: chosenExt, formatId: chosenFormatId, audioExt: '', audioFormatId: '', pendingAutoQueue: true }
                  : d,
              ),
            }));
            return downloadId;
          }
        } catch (error) {
          const hasInternetConnection =
            await window.downlodrFunctions.checkInternetConnection();
          console.log(hasInternetConnection);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const isUnsupportedSite = errorMessage.includes('UNSUPPORTED_SITE');
          const isParseError = errorMessage.includes('PARSE_ERROR');
          const parseErrorSite = errorMessage.match(/PARSE_ERROR:(\w+)?:/)?.[1];
          const isPlaylistUrl = errorMessage.includes('PLAYLIST_URL');
          const playlistEntryCount = errorMessage.match(
            /PLAYLIST_URL:(\d+)?:/,
          )?.[1];

          // Not an error: the URL is a playlist/series that the paste-time
          // classifier (YouTube-syntax only) could not recognise as one, so it
          // arrived here as a single download. Hand it to the selection page
          // rather than failing — GlobalPlaylistRedirectListener navigates.
          if (isPlaylistUrl) {
            usePlaylistSelectionStore.getState().setPendingPlaylistUrl(videoUrl);
            toast({
              title: 'Playlist Detected',
              description: playlistEntryCount
                ? `This link is a playlist or series with ${playlistEntryCount} items. Opening the selection page.`
                : 'This link is a playlist or series. Opening the selection page.',
              duration: 5000,
            });
            get().removeFromForDownloads(downloadId);
            return downloadId;
          }

          if (!hasInternetConnection) {
            toast({
              variant: 'destructive',
              title: 'No Internet Connection',
              description:
                'Please check your internet connection and try again',
              expandable: true, // Add this to make it expandable
              duration: 5000,
              action: React.createElement(
                ToastAction,
                {
                  altText: 'Retry connection check',
                  onClick: handleCheckForUpdates,
                },
                React.createElement(RefreshCw, { size: 12 }),
              ) as unknown as ToastActionElement,
            });
          } else if (isUnsupportedSite) {
            toast({
              variant: 'destructive',
              title: 'Site Not Supported',
              description:
                "This website is not currently supported for downloads. Please try a different website.",
              duration: 5000,
            });
          } else if (isParseError) {
            const siteName = parseErrorSite
              ? parseErrorSite[0].toUpperCase() + parseErrorSite.slice(1)
              : 'this site';
            toast({
              variant: 'destructive',
              title: 'Could Not Read Video Data',
              description: `${siteName} didn't return readable video data. The video may be private, restricted, or age-gated.`,
              duration: 5000,
            });
          } else {
            toast({
              variant: 'destructive',
              title: `Could not find video metadata`,
              description: 'Please enter a valid video URL',
              duration: 5000,
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
                    error: isUnsupportedSite
                      ? 'This site is not supported by yt-dlp'
                      : isParseError
                      ? "yt-dlp failed to parse this site's response"
                      : 'Failed to fetch video information',
                  }
                : download,
            ),
          }));
        } finally {
          releaseInfoFetchSlot();
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
