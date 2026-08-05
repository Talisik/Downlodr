import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuTrash2, LuPlay } from 'react-icons/lu';
import { HiChevronUpDown } from 'react-icons/hi2';
import { FaSearch, FaSortAlphaDown, FaFilter } from 'react-icons/fa';
import { FiPlayCircle, FiX } from 'react-icons/fi';
import {
  Download,
  useSkedulosaStore,
  Subscription,
} from '@/skedulosa/store/skedulosaStore';
import { formatRelativeTime } from '@/downlodr/pages/status/statusPageUtils';
import { formatBytesToHuman } from '@/skedulosa/utils/subscriptionDownloadUtils';
import SpeedGraph from '@/downlodr/components/download/SpeedGraph';
import ConfirmModal from '@/core-app/components/modal/custom/ConfirmModal';

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
  let cls = 'text-gray-500';
  if (lower === 'completed' || lower === 'done') cls = 'text-emerald-500';
  else if (lower === 'queued' || lower === 'pending') cls = 'text-yellow-500';
  else if (lower === 'error') cls = 'text-red-500';
  return (
    <span className={`text-xs font-medium ${cls}`}>
      {lower === 'completed'
        ? 'Done'
        : status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
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
  const [localSortDirection, setLocalSortDirection] = useState<'asc' | 'desc'>(
    'desc',
  );
  const [deleteConfirm, setDeleteConfirm] = useState<{
    downloadId: string;
    downloadName: string;
  } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

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
    let list = [...subscription.downloads];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d) => d.name.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      list = list.filter((d) => d.status.toLowerCase() === statusFilter);
    }
    return list.sort((a, b) => {
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
        cmp =
          new Date(a.date_added).getTime() - new Date(b.date_added).getTime();
      }
      return localSortDirection === 'asc' ? cmp : -cmp;
    });
  }, [
    subscription,
    localSortField,
    localSortDirection,
    searchQuery,
    statusFilter,
  ]);

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

  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
    else setSearchQuery('');
  }, [showSearch]);

  useEffect(() => {
    if (!showSearch) return;
    const handler = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSearch]);

  useEffect(() => {
    if (!showFilterMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(e.target as Node)
      ) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilterMenu]);

  if (!subscription || subscription.downloads.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400 text-sm">
        No downloads yet.
      </div>
    );
  }

  return (
    <div className="py-2 pl-4 pr-12 flex flex-col min-h-0 h-full">
      <div className="flex flex-row min-h-0 flex-1 gap-14">
        <div className="overflow-x-auto overflow-y-auto px-4 flex-1 min-h-0">
          <table className="w-full text-sm text-left mt-2">
            <thead>
              <tr className="ml-2 text-xs text-gray-500 dark:text-gray-400 tracking-wide">
                {(['title', 'size', 'speed', 'status', 'actions'] as const).map(
                  (colId) => {
                    const label =
                      colId === 'title'
                        ? 'Title'
                        : colId === 'size'
                        ? 'Size'
                        : colId === 'speed'
                        ? 'Speed'
                        : colId === 'status'
                        ? 'Status'
                        : 'Actions';
                    const sortable = !!DOWNLOAD_SORT_MAP[colId];
                    const field = DOWNLOAD_SORT_MAP[colId];
                    return (
                      <th
                        key={colId}
                        className={`py-1 pr-4 font-semibold text-xs ${
                          sortable ? 'cursor-pointer select-none' : ''
                        }`}
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
                  },
                )}
              </tr>
            </thead>
            <tbody>
              {downloads.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-10 text-center text-xs text-gray-400 dark:text-gray-500"
                  >
                    No downloads match your search or filter.
                  </td>
                </tr>
              )}
              {downloads.map((download) => (
                <tr
                  key={download.id}
                  className="hover:bg-gray-50 dark:hover:bg-darkModeCompliment/30"
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
                              e.currentTarget.src =
                                '/placeholder_thumbnail.png';
                            }}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full w-full bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.5)_0%,transparent_45%),radial-gradient(circle_at_45%_80%,rgba(255,255,255,0.4)_0%,transparent_35%),linear-gradient(135deg,#ffa42e,#fec77d,#ffa42e,#fec170)]">
                            <FiPlayCircle size={20} color="#F45513" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-gray-900 dark:text-gray-100 truncate sm:truncate md:whitespace-normal md:overflow-visible">
                          {download.name}
                        </span>
                        {download.date_added && (
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">
                            {formatRelativeTime(download.date_added)}
                          </span>
                        )}
                      </div>
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
                  {/* Actions */}
                  <td className="text-xs py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Delete"
                        onClick={() =>
                          setDeleteConfirm({
                            downloadId: download.id,
                            downloadName: download.name,
                          })
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

        {/* ── Side panel ── */}
        {showSearch ? (
          <div
            ref={searchContainerRef}
            className="flex flex-row flex-shrink-0 items-start -mr-6 pt-2"
          >
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search downloads…"
              className="text-[12px] border border-gray-300 dark:border-gray-600 rounded-md px-2 py-[3px] w-34 bg-white dark:bg-darkModeCompliment outline-none focus:border-primary"
            />
          </div>
        ) : (
          <div className="flex flex-row w-10 flex-shrink-0 items-start pt-4 gap-3">
            <button
              className={`transition-colors ${
                searchQuery
                  ? 'text-primary'
                  : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title="Search"
              onClick={() => setShowSearch(true)}
            >
              <FaSearch size={13} />
            </button>
            <button
              className={`transition-colors ${
                localSortDirection === 'asc'
                  ? 'text-primary'
                  : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title={`Sort ${localSortDirection === 'asc' ? 'Z–A' : 'A–Z'}`}
              onClick={() =>
                setLocalSortDirection((prev) =>
                  prev === 'asc' ? 'desc' : 'asc',
                )
              }
            >
              <FaSortAlphaDown size={13} />
            </button>
            <div className="relative" ref={filterMenuRef}>
              <button
                className={`transition-colors ${
                  statusFilter !== 'all'
                    ? 'text-primary'
                    : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
                title="Filter by status"
                onClick={() => setShowFilterMenu((prev) => !prev)}
              >
                <FaFilter size={13} />
              </button>
              {showFilterMenu && (
                <div className="absolute right-0 top-6 z-50 bg-white dark:bg-darkModeCompliment border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 min-w-[110px]">
                  {(
                    [
                      'all',
                      'completed',
                      'downloading',
                      'queued',
                      'failed',
                      'pending',
                    ] as const
                  ).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setStatusFilter(s);
                        setShowFilterMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-100 dark:hover:bg-darkModeHover capitalize ${
                        statusFilter === s
                          ? 'text-primary font-medium'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {s === 'all'
                        ? 'All'
                        : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <ConfirmModal
          isOpen={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => {
            if (deleteConfirm) {
              removeSubscriptionDownload(
                subscription.id,
                deleteConfirm.downloadId,
              );
            }
            setDeleteConfirm(null);
          }}
          title="Delete Download"
          message={`Are you sure you want to remove "${
            deleteConfirm?.downloadName ?? ''
          }" from this subscription? This cannot be undone.`}
          confirmLabel="Delete"
        />
      </div>
    </div>
  );
};

export default DownloadTab;
