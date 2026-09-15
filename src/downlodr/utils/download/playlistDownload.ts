import { Video } from '@/downlodr/store/taskbarDownloadStore';

interface StartPlaylistDownloadArgs {
  playlistVideos: Video[];
  selectedVideoIds: Set<string>;
  downloadFolder: string;
  maxDownload: string;
  getTranscript: boolean;
  getThumbnail: boolean;
  setDownload: (
    videoUrl: string,
    location: string,
    limitRate: string,
    options?: {
      getTranscript: boolean;
      getThumbnail: boolean;
      isFromPlaylist?: boolean;
      playlistBatchId?: string;
    },
  ) => Promise<string | undefined>;
}

/**
 * Queues every selected playlist video under a single shared batch id.
 * Returns the number of videos queued (0 means nothing was selected).
 */
export const startPlaylistDownload = ({
  playlistVideos,
  selectedVideoIds,
  downloadFolder,
  maxDownload,
  getTranscript,
  getThumbnail,
  setDownload,
}: StartPlaylistDownloadArgs): number => {
  const selectedVideos = playlistVideos.filter((video) =>
    selectedVideoIds.has(video.id),
  );

  if (selectedVideos.length === 0) {
    return 0;
  }

  const playlistBatchId = `playlist_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  for (const video of selectedVideos) {
    setDownload(video.url, downloadFolder, maxDownload, {
      getTranscript,
      getThumbnail,
      isFromPlaylist: true,
      playlistBatchId,
    });
  }

  return selectedVideos.length;
};
