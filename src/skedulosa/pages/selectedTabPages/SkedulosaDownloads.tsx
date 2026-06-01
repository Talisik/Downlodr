import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuTrash2, LuPlay } from 'react-icons/lu';
import { HiChevronUpDown } from 'react-icons/hi2';
import {
  Download,
  useSkedulosaStore,
  Subscription,
} from '@/skedulosa/store/skedulosaStore';
import { formatRelativeTime } from '@/downlodr/pages/status/statusPageUtils';
import { formatBytesToHuman } from '@/skedulosa/utils/subscriptionDownloadUtils';
import SpeedGraph from '@/downlodr/components/download/SpeedGraph';

interface DownloadTabProps {
  channelId: string | undefined;
}

type DownloadRow = {
  subscription: Subscription;
  download: Download;
};

type LocalSortField = 'name' | 'size' | 'speed' | 'status' | 'date';

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  let cls = 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  if (lower === 'completed')
    cls =
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300';
  else if (lower === 'queued' || lower === 'pending')
    cls =
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
  else if (lower === 'error')
    cls = 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}

const DOWNLOAD_SORT_MAP: Partial<Record<string, LocalSortField>> = {
  title: 'name',
  size: 'size',
  speed: 'speed',
  status: 'status',
  date: 'date',
};

const DownloadTab = ({ channelId }: DownloadTabProps) => {
  const subscription = useSkedulosaStore((s) =>
    s.subscriptions.find((sub) => sub.id === channelId),
  );
  const removeSubscriptionDownload = useSkedulosaStore(
    (s) => s.removeSubscriptionDownload,
  );

  const [localSortField, setLocalSortField] = useState<LocalSortField>('date');
  const [localSortDirection, setLocalSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleLocalSortClick = (colId: string) => {
    const field = DOWNLOAD_SORT_MAP[colId];
    if (!field) return;
    if (localSortField === field) {
      setLocalSortDirection(localSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setLocalSortField(field);
      setLocalSortDirection('asc');
    }
  };

  const downloads = useMemo(() => {
    if (!subscription) return [];
    return [...subscription.downloads].sort((a, b) => {
      let cmp = 0;
      if (localSortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (localSortField === 'size') {
        cmp = parseFloat(a.size || '0') - parseFloat(b.size || '0');
      } else if (localSortField === 'speed') {
        cmp = parseFloat(a.speed || '0') - parseFloat(b.speed || '0');
      } else if (localSortField === 'status') {
        cmp = a.status.localeCompare(b.status);
      } else {
        cmp = new Date(a.date_added).getTime() - new Date(b.date_added).getTime();
      }
      return localSortDirection === 'asc' ? cmp : -cmp;
    });
  }, [subscription, localSortField, localSortDirection]);

  const [thumbnailDataUrls, setThumbnailDataUrls] = useState<
    Record<string, string>
  >({});

  // Load local thumbnail file paths as data URLs, batched to avoid IPC flooding
  const loadThumbnails = useCallback(
    async (downloadRows: DownloadRow[]) => {
      const BATCH_SIZE = 5;
      const pending = downloadRows.filter(
        ({ download }) =>
          download.thumbnail_location &&
          typeof download.thumbnail_location === 'string' &&
          !thumbnailDataUrls[download.id],
      );
      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map(async ({ download }) => {
            try {
              const dataUrl =
                await window.downlodrFunctions.getThumbnailDataUrl(
                  download.thumbnail_location,
                );
              if (dataUrl) {
                setThumbnailDataUrls((prev) => ({
                  ...prev,
                  [download.id]: dataUrl,
                }));
              }
            } catch {
              // silently skip — placeholder will be shown
            }
          }),
        );
      }
    },
    [thumbnailDataUrls],
  );

  useEffect(() => {
    if (!subscription || downloads.length === 0) return;
    loadThumbnails(downloads.map((d) => ({ subscription, download: d })));
  }, [downloads]);

  if (!subscription || downloads.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400 text-sm">
        No downloads yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto px-4">
      <table className="w-full text-sm text-left mt-2">
        <thead>
          <tr className="ml-2 text-xs text-gray-500 dark:text-gray-400 tracking-wide">
            {(['title', 'size', 'speed', 'status', 'date', 'actions'] as const).map((colId) => {
              const label =
                colId === 'title' ? 'Title' :
                colId === 'size' ? 'Size' :
                colId === 'speed' ? 'Speed' :
                colId === 'status' ? 'Status' :
                colId === 'date' ? 'Date Added' : 'Actions';
              const sortable = !!DOWNLOAD_SORT_MAP[colId];
              const field = DOWNLOAD_SORT_MAP[colId];
              return (
                <th
                  key={colId}
                  className={`py-1 pr-4 font-semibold text-xs ${sortable ? 'cursor-pointer select-none' : ''}`}
                  onClick={() => sortable && handleLocalSortClick(colId)}
                >
                  <div className="flex items-center gap-1">
                    <span>{label}</span>
                    {sortable && (
                      <HiChevronUpDown
                        size={12}
                        className={`flex-shrink-0 ${
                          localSortField === field
                            ? localSortDirection === 'asc'
                              ? 'rotate-180'
                              : ''
                            : 'text-gray-400'
                        }`}
                      />
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {downloads.map((download) => (
            <tr
              key={download.id}
              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-darkModeCompliment/30"
            >
              {/* Title + Thumbnail */}
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <div className="h-12 w-20 bg-black flex rounded cursor-pointer overflow-hidden justify-center items-center flex-shrink-0">
                    {thumbnailDataUrls[download.id] ? (
                      <img
                        src={
                          thumbnailDataUrls[download.id] ??
                          '/placeholder_thumbnail.png'
                        }
                        alt="Thumbnail"
                        className="max-h-full max-w-full object-contain hover:opacity-70 transition-opacity"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder_thumbnail.png';
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full w-full bg-black dark:bg-darkModeCompliment" />
                    )}
                  </div>
                  <span className="text-xs truncate max-w-[200px] text-gray-900 dark:text-gray-100">
                    {download.name}
                  </span>
                </div>
              </td>
              {/* Size */}
              <td className="text-xs py-2 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {download.size
                  ? formatBytesToHuman(parseFloat(download.size))
                  : '—'}
              </td>
              {/* Speed */}
              <td className="text-xs py-2 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                <SpeedGraph
                  key={`speed-graph-${download.id}`}
                  currentSpeed={download.speed}
                  downloadStatus={download.status}
                  downloadId={download.id}
                  showHeader={false}
                  width={65}
                  height={25}
                />{' '}
              </td>
              {/* Status */}
              <td className="text-xs py-2 pr-4">
                <StatusBadge status={download.status} />
              </td>
              {/* Date Added */}
              <td className="text-xs py-2 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {download.date_added
                  ? formatRelativeTime(download.date_added)
                  : '—'}
              </td>
              {/* Actions */}
              <td className="text-xs py-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Delete"
                    onClick={() =>
                      removeSubscriptionDownload(subscription.id, download.id)
                    }
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <LuTrash2 size={14} />
                  </button>
                  {download.video_location && (
                    <button
                      type="button"
                      title="View file"
                      onClick={() => {
                        if (download.video_location) {
                          window.downlodrFunctions?.openVideo(
                            download.video_location,
                          );
                        }
                      }}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                    >
                      <LuPlay size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DownloadTab;
