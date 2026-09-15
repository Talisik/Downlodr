/* eslint-disable prettier/prettier */
/**
 * Download actions: addDownload, retryDownload, setDownload.
 * Receives Zustand set/get from the store. Uses payload schemas from downloadPayloads.
 */
import { ToastAction, ToastActionElement } from '@/core-app/components/shadcn/components/ui/toast';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { config } from '@/core-app/client/config';
import { TelemetryService } from '@/core-app/telemetry/utils/telemetryService';
import { uuidv4 } from '@/core-app/utils/uuid';
import { type VideoInfo } from '@/downlodr/schema/metadataSchema';
import { usePlaylistSelectionStore } from '@/downlodr/store/playlistSelectionStore';
import { resolveAutoFormat } from '@/downlodr/utils/download/autoFormat';
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


/**
 * Move a fully-described `forDownloads` row into the run queue — the same
 * transition DownloadButton performs when the user clicks the row's download
 * arrow. `addQueue` starts the worker itself, so this genuinely begins the
 * download rather than parking it.
 *
 * Lives here, in the store, so callers with no UI (the chat bridge) can start a
 * download on any page.
 */
async function queueForDownload(
  get: GetState,
  row: ForDownload,
  limitRate = '',
): Promise<void> {
  // Imported lazily: filterName imports the download store, so a static import
  // here would close the cycle downloadStore -> downloadActions -> filterName
  // -> downloadStore and leave createDownloadActions undefined at store
  // construction. By call time the cycle is long resolved.
  const { processFileName } = await import(
    '@/downlodr/utils/download/filterName'
  );
  const ext = row.ext || row.audioExt;
  const processedName = await processFileName(row.location, row.name, ext);
  get().addQueue({
    subscriptionId: row.subscriptionId,
    videoUrl: row.videoUrl ?? '',
    name: `${processedName}.${ext}`,
    downloadName: `${processedName}.${ext}`,
    displayName: row.displayName ?? `${processedName}.${ext}`,
    size: row.size,
    speed: row.speed,
    channelName: row.channelName ?? '',
    timeLeft: row.timeLeft ?? '',
    DateAdded: new Date().toISOString(),
    uploadDate: row.uploadDate,
    progress: 0,
    location: row.location ?? '',
    status: 'queued',
    ext: row.ext,
    formatId: row.formatId,
    audioExt: row.audioExt,
    audioFormatId: row.audioFormatId,
    extractorKey: row.extractorKey,
    limitRate,
    automaticCaption: row.automaticCaption,
    thumbnails: row.thumbnails,
    getTranscript: row.getTranscript ?? false,
    getThumbnail: row.getThumbnail ?? false,
    duration: row.duration ?? 60,
    isCreateFolder: true,
    description: row.description,
    chapters: row.chapters,
    autoCaptionLocation: row.autoCaptionLocation,
    thumnailsLocation: row.thumnailsLocation,
    transcriptLocation: row.transcriptLocation,
    tags: row.tags,
    category: row.category,
    isLive: row.isLive ?? false,
  });
  get().removeFromForDownloads(row.id);
}

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

    /**
     * Start a row that is already sitting in the to-download list — the same
     * transition the row's download arrow performs. `queueForDownload` was
     * previously reachable only through setDownload's autoStart option, i.e.
     * only for a URL being added right now; this exposes it for a row that
     * already exists, which is what the chat bridge's start_queued needs.
     */
    startForDownload: async (
      downloadId: string,
      limitRate = '',
    ): Promise<{ ok: true } | { error: string }> => {
      const row = get().forDownloads.find((d) => d.id === downloadId);
      if (!row) return { error: `No to-download row with id ${downloadId}.` };
      // queueForDownload builds the filename from `ext || audioExt`. A row
      // whose format was never resolved has neither, and would land on disk
      // as "<name>.undefined".
      if (!row.ext && !row.audioExt) {
        return {
          error:
            'That row has no format selected yet, so it cannot be started. ' +
            'The user picks a format on the row in Downlodr.',
        };
      }
      await queueForDownload(get, row, limitRate);
      return { ok: true };
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
          autoStart: undefined as boolean | undefined,
          autoQuality: undefined as string | undefined,
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
          // auto-tag: native category (routing) + structured music fields
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
          const { formatOptions, audioOptions, defaultFormatId, defaultExt } =
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
          // autoStart: the chat/MCP `download_video` path. Queue it here, in
          // the store, rather than flagging it for a component to pick up —
          // TaskbarInputField (which drains pendingAutoQueue) is unmounted on
          // the Skedulosa and AFDA pages, so a flag-based start silently does
          // nothing whenever the user happens to be looking at those.
          if (options.autoStart && currentDownload) {
            // processVideoFormats does not always return audioOptions (some
            // extractors expose no audio-only stream at all).
            const audio = audioOptions ?? [];
            const resolved = resolveAutoFormat(options.autoQuality, {
              formatOptions,
              audioOptions: audio,
              defaultFormatId,
              defaultExt,
            });
            const isAudioOnly = audio.some(
              (a) =>
                a.formatId === resolved.formatId &&
                a.fileExtension === resolved.ext,
            );
            set((state) => ({
              ...state,
              forDownloads: state.forDownloads.map((d) =>
                d.id === downloadId
                  ? {
                      ...d,
                      ext: isAudioOnly ? '' : resolved.ext,
                      formatId: isAudioOnly ? '' : resolved.formatId,
                      audioExt: isAudioOnly ? resolved.ext : '',
                      audioFormatId: isAudioOnly ? resolved.formatId : '',
                    }
                  : d,
              ),
            }));
            const row = get().forDownloads.find((d) => d.id === downloadId);
            if (row) await queueForDownload(get, row, limitRate);
            return downloadId;
          }

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
          const isExtractionFailed =
            errorMessage.includes('EXTRACTION_FAILED');
          const isAgeRestrictedUnverified = errorMessage.includes(
            'AGE_RESTRICTED_UNVERIFIED',
          );
          // Must check the more specific *_UNVERIFIED tag first — its own
          // string also contains "AGE_RESTRICTED".
          const isAgeRestricted =
            !isAgeRestrictedUnverified &&
            errorMessage.includes('AGE_RESTRICTED');
          const isExtractionBlocked = errorMessage.includes(
            'EXTRACTION_BLOCKED',
          );
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
          } else if (isExtractionFailed) {
            // Not a rate limit: sites like TikTok intermittently serve a page
            // with the video data stripped out. The main process already
            // retried several times before giving up, so the useful advice is
            // simply to try again rather than to wait.
            toast({
              variant: 'destructive',
              title: 'Could Not Read Video Data',
              description:
                "The site didn't return the video data after several attempts. Please try again.",
              duration: 5000,
            });
          } else if (isAgeRestrictedUnverified) {
            toast({
              variant: 'destructive',
              title: 'Age Not Verified',
              description:
                "This video is age-restricted, and the signed-in Google account hasn't verified its age. Verify at myaccount.google.com, or try a different signed-in browser.",
              duration: 8000,
            });
          } else if (isAgeRestricted) {
            toast({
              variant: 'destructive',
              title: 'Age-Restricted Video',
              description:
                'Sign in to YouTube in Firefox or Brave, then enable it under Advanced Settings → Authentication.',
              duration: 8000,
            });
          } else if (isExtractionBlocked) {
            // A known, ongoing yt-dlp-vs-YouTube extraction limitation — not
            // an authentication problem, so no cookie setup fixes it.
            toast({
              variant: 'destructive',
              title: 'YouTube Is Blocking This Video',
              description:
                "This is a known yt-dlp limitation, not an account issue. Try again later, or check for a yt-dlp update.",
              duration: 8000,
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
                      : isExtractionFailed
                      ? 'Site did not return video data after several retries'
                      : isAgeRestrictedUnverified
                      ? "Age-restricted; signed-in account isn't age-verified"
                      : isAgeRestricted
                      ? 'Age-restricted; sign in required'
                      : isExtractionBlocked
                      ? 'YouTube is blocking extraction (known yt-dlp limitation)'
                      : 'Failed to fetch video information',
                  }
                : download,
            ),
          }));

          // 📊 TELEMETRY: Report metadata-fetch failures. Non-blocking so it
          // never delays the toast/status update above.
          const metadataErrorType = isUnsupportedSite
            ? 'unsupported_site'
            : isParseError
              ? 'parse_error'
              : isExtractionFailed
                ? 'extraction_failed'
                : isAgeRestrictedUnverified
                  ? 'age_restricted_unverified'
                  : isAgeRestricted
                    ? 'age_restricted'
                    : isExtractionBlocked
                      ? 'extraction_blocked'
                      : !hasInternetConnection
                        ? 'no_internet'
                        : 'unknown_metadata_error';

          setTimeout(async () => {
            try {
              const telemetryService = new TelemetryService({
                apiEndpoint: config.telemetry.endpoint,
              });
              await telemetryService.init();
              await telemetryService.sendDownloadError({
                error: error instanceof Error ? error : new Error(errorMessage),
                logMessage: `ERROR: metadata_fetch_failed (${metadataErrorType}): ${errorMessage}`,
                downloadContext: {
                  url: videoUrl,
                  downloadId,
                  location,
                },
              });
            } catch (telemetryError) {
              console.error(
                'Error sending metadata-fetch telemetry:',
                telemetryError,
              );
            }
          }, 0);
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
