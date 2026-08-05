import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import PlaylistSkeleton from '@/core-app/components/shadcn/components/ui/playlistSkeleton';
import { useSettingStore } from '@/core-app/store/settingsStore';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { usePlaylistSelectionStore } from '@/downlodr/store/playlistSelectionStore';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import { startPlaylistDownload } from '@/downlodr/utils/download/playlistDownload';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LuArrowLeft } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import PlaylistVideoRow from './PlaylistVideoRow';

const PlaylistSelectionPage = () => {
  const { t } = useTranslation('playlistSelection');
  const navigate = useNavigate();

  const playlistVideos = usePlaylistSelectionStore((s) => s.playlistVideos);
  const selectedVideoIds = usePlaylistSelectionStore(
    (s) => s.selectedVideoIds,
  );
  const videoTitle = usePlaylistSelectionStore((s) => s.videoTitle);
  const isLoading = usePlaylistSelectionStore((s) => s.isLoading);
  const toggleVideo = usePlaylistSelectionStore((s) => s.toggleVideo);
  const selectAllAction = usePlaylistSelectionStore((s) => s.selectAll);
  const reset = usePlaylistSelectionStore((s) => s.reset);

  const getTranscript = useTaskbarDownloadStore((s) => s.getTranscript);
  const setGetTranscript = useTaskbarDownloadStore((s) => s.setGetTranscript);
  const getThumbnail = useTaskbarDownloadStore((s) => s.getThumbnail);
  const setGetThumbnail = useTaskbarDownloadStore((s) => s.setGetThumbnail);
  const downloadFolder = useTaskbarDownloadStore((s) => s.downloadFolder);

  const settings = useSettingStore((s) => s.settings);
  const setDownload = useDownloadStore((s) => s.setDownload);

  const maxDownload =
    settings.defaultDownloadSpeed === 0
      ? ''
      : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`;

  // Playlist state is in-memory only, so a direct nav / reload with nothing
  // loaded (and no fetch in flight) has nothing to show — bounce back home.
  useEffect(() => {
    if (!isLoading && playlistVideos.length === 0) {
      navigate('/status/all', { replace: true });
    }
  }, [isLoading, playlistVideos.length, navigate]);

  const allSelected =
    selectedVideoIds.size === playlistVideos.length &&
    playlistVideos.length > 0;
  const someSelected = !allSelected && selectedVideoIds.size > 0;

  const handleCancel = () => {
    reset();
    navigate('/status/all');
  };

  const handleDownloadSelected = () => {
    const queuedCount = startPlaylistDownload({
      playlistVideos,
      selectedVideoIds,
      downloadFolder,
      maxDownload,
      getTranscript,
      getThumbnail,
      setDownload,
    });

    if (queuedCount === 0) {
      toast({
        variant: 'destructive',
        title: t('toast.selectionErrorTitle'),
        description: t('toast.selectionErrorDesc'),
        duration: 5000,
      });
      return;
    }

    toast({
      title: t('toast.downloadQueuedTitle'),
      description: t('toast.downloadQueuedDesc'),
      duration: 5000,
    });

    reset();
    navigate('/status/all');
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-darkMode">
      <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0 border-b border-divider dark:border-darkModeCompliment">
        <button
          onClick={handleCancel}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-darkModeHover transition-colors flex-shrink-0"
          title={t('cancel')}
        >
          <LuArrowLeft size={18} className="dark:text-darkModeLight" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm dark:text-darkModeLight truncate">
            {videoTitle ?? t('title')}
          </p>
          <p className="text-xxs text-darkModeDarkGray dark:text-darkModeLight">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              id="playlist-get-transcript"
              checked={getTranscript}
              onChange={(e) => setGetTranscript(e.target.checked)}
              className="cursor-pointer rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
            />
            <label
              htmlFor="playlist-get-transcript"
              className="text-xs font-medium dark:text-darkModeLight cursor-pointer"
            >
              {t('getClosedCaptions')}
            </label>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              id="playlist-get-thumbnail"
              checked={getThumbnail}
              onChange={(e) => setGetThumbnail(e.target.checked)}
              className="cursor-pointer rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
            />
            <label
              htmlFor="playlist-get-thumbnail"
              className="text-xs font-medium dark:text-darkModeLight cursor-pointer"
            >
              {t('getThumbnail')}
            </label>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-4">
        {isLoading ? (
          <div className="pt-4 h-full overflow-hidden">
            <PlaylistSkeleton />
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 z-20 bg-white dark:bg-darkMode">
              <tr className="text-left">
                <th className="w-10 p-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={selectAllAction}
                    className="cursor-pointer rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
                  />
                </th>
                <th className="p-2 text-xs font-semibold dark:text-darkModeLight">
                  {t('videos', { count: playlistVideos.length })}
                </th>
              </tr>
              <tr className="pointer-events-none">
                <th
                  colSpan={2}
                  className="p-0 h-[1px] bg-gray-200 dark:bg-darkModeCompliment"
                />
              </tr>
            </thead>
            <tbody>
              {playlistVideos.map((video) => (
                <PlaylistVideoRow
                  key={video.id}
                  video={video}
                  checked={selectedVideoIds.has(video.id)}
                  onToggle={() => toggleVideo(video.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-divider dark:border-darkModeCompliment bg-white dark:bg-darkMode">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {t('selected', {
            count: selectedVideoIds.size,
            total: playlistVideos.length,
          })}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-md text-xs font-medium border border-divider dark:border-darkModeCompliment dark:text-darkModeLight hover:bg-gray-50 dark:hover:bg-darkModeHover transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleDownloadSelected}
            disabled={selectedVideoIds.size === 0}
            className="px-4 py-2 rounded-md text-xs font-medium bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('downloadSelected', { count: selectedVideoIds.size })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlaylistSelectionPage;
