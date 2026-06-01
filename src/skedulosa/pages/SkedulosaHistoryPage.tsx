// eslint-disable-next-line prettier/prettier
import ResizableHeader from '@/downlodr/components/download/resizableColumns/ResizableHeader';
import { useResizableColumns } from '@/downlodr/components/download/resizableColumns/useResizableColumns';
import SpeedGraph from '@/downlodr/components/download/SpeedGraph';
import {
  Download,
  Subscription,
  useSkedulosaStore,
  SortField,
} from '@/skedulosa/store/skedulosaStore';

import { formatDistanceToNow } from 'date-fns';
import type { Locale } from 'date-fns';
import { enUS, es, ko, pt } from 'date-fns/locale';
import { formatBytesToHuman } from '@/skedulosa/utils/subscriptionDownloadUtils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { FaCircle } from 'react-icons/fa';
import { HiChevronUpDown } from 'react-icons/hi2';
import { HiDotsVertical } from 'react-icons/hi';
import { LuEye, LuTrash } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import NoHistory from '@/assets/skedulosa/images/NoHistory.svg';
import ConfirmModal from '@/core-app/components/modal/custom/ConfirmModal';
import { useTheme } from '@/core-app/components/ThemeProvider';
import NoHistoryDark from '@/assets/skedulosa/images/NoHistoryDark.svg';
import { FiPlayCircle } from 'react-icons/fi';

const NoHistoryPage = () => {
  const { t } = useTranslation('skedulosa');
  const { theme } = useTheme();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <img
        src={isDark ? NoHistoryDark : NoHistory}
        alt={t('historyPage.emptyState.altText')}
        className="w-2/6 h-2/6"
      />
      <div className="text-center w-2/6 mt-4">
        <h1 className="text-sm font-bold">
          {t('historyPage.emptyState.title')}
        </h1>
        <p className="text-gray-500 text-[12.5px] mt-2">
          {t('historyPage.emptyState.description')}
        </p>
      </div>
    </div>
  );
};

const INITIAL_COLUMNS = [
  { id: 'title', width: 220, minWidth: 120 },
  { id: 'subscription', width: 120, minWidth: 80 },
  { id: 'size', width: 100, minWidth: 70 },
  { id: 'speed', width: 110, minWidth: 70 },
  { id: 'status', width: 100, minWidth: 70 },
  { id: 'date', width: 110, minWidth: 70 },
  { id: 'actions', width: 90, minWidth: 70 },
];

type DownloadRow = {
  subscription: Subscription;
  download: Download;
};

const SkedulosaHistoryPage = () => {
  const { t, i18n } = useTranslation('skedulosa');
  const dateLocaleMap: Record<string, Locale> = { en: enUS, es, pt, ko };
  const dateLocale = dateLocaleMap[i18n.language] ?? enUS;
  const {
    columns,
    startResizing,
    startDragging,
    handleDragOver,
    handleDrop,
    cancelDrag,
    dragging,
    dragOverIndex,
  } = useResizableColumns(INITIAL_COLUMNS);

  const subscriptions = useSkedulosaStore((s) => s.subscriptions);
  const navigate = useNavigate();
  const sortField = useSkedulosaStore((s) => s.sortField);
  const sortDirection = useSkedulosaStore((s) => s.sortDirection);

  const COLUMN_SORT_MAP: Partial<Record<string, SortField>> = {
    title: 'name',
    subscription: 'subscription',
    size: 'downloads',
    speed: 'speed',
    status: 'status',
    date: 'date',
  };

  const handleSortClick = useCallback((colId: string) => {
    const field = COLUMN_SORT_MAP[colId];
    if (!field) return;
    const {
      sortField: currentField,
      sortDirection: currentDir,
      setSortField,
      setSortDirection,
    } = useSkedulosaStore.getState();
    if (currentField === field) {
      setSortDirection(currentDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, []);

  const statusMapping = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <div className="flex flex-row gap-1 items-center">
            <FaCircle className="text-green-500" />
            <span>{t('historyPage.status.completed')}</span>
          </div>
        );
      case 'downloading':
        return (
          <div className="flex flex-row gap-1 items-center">
            <FaCircle color="blue" />
            <span>{t('historyPage.status.downloading')}</span>
          </div>
        );
      case 'queued':
        return (
          <div className="flex flex-row gap-1 items-center">
            <FaCircle color="gray" />
            <span>{t('historyPage.status.queued')}</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex flex-row gap-1 items-center">
            <FaCircle color="red" />
            <span>{t('historyPage.status.failed')}</span>
          </div>
        );
      default:
        return (
          <div className="flex flex-row gap-1 items-center">
            <span>{status}</span>
          </div>
        );
    }
  };

  const removeSubscriptionDownload = useSkedulosaStore(
    (s) => s.removeSubscriptionDownload,
  );
  const selectedHistoryIds = useSkedulosaStore((s) => s.selectedHistoryIds);
  const toggleHistorySelection = useSkedulosaStore(
    (s) => s.toggleHistorySelection,
  );
  const selectAllHistory = useSkedulosaStore((s) => s.selectAllHistory);
  const clearHistorySelection = useSkedulosaStore(
    (s) => s.clearHistorySelection,
  );
  const bulkDeleteHistoryDownloads = useSkedulosaStore(
    (s) => s.bulkDeleteHistoryDownloads,
  );

  const [thumbnailDataUrls, setThumbnailDataUrls] = useState<
    Record<string, string>
  >({});

  type MenuState = {
    subscriptionId: string;
    downloadId: string;
    downloadName: string;
    videoLocation?: string;
    x: number;
    y: number;
  };
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    subscriptionId: string;
    downloadId: string;
    downloadName: string;
  } | null>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menu]);

  const handleOpenMenu = (
    e: React.MouseEvent,
    subscriptionId: string,
    downloadId: string,
    downloadName: string,
    videoLocation?: string,
  ) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({
      subscriptionId,
      downloadId,
      downloadName,
      videoLocation,
      x: rect.right,
      y: rect.bottom + 4,
    });
  };

  const handleView = async () => {
    if (!menu?.videoLocation) return;
    setMenu(null);
    const exists = await window.downlodrFunctions.fileExists(
      menu.videoLocation,
    );
    if (exists) {
      window.downlodrFunctions.openVideo(menu.videoLocation);
    }
  };

  const handleDelete = () => {
    if (!menu) return;
    setDeleteConfirm({
      open: true,
      subscriptionId: menu.subscriptionId,
      downloadId: menu.downloadId,
      downloadName: menu.downloadName ?? '',
    });
    setMenu(null);
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    removeSubscriptionDownload(
      deleteConfirm.subscriptionId,
      deleteConfirm.downloadId,
    );
    setDeleteConfirm(null);
  };

  const searchQuery = useSkedulosaStore((s) => s.searchQuery);

  const rows: DownloadRow[] = useMemo(() => {
    const all: DownloadRow[] = [];
    for (const sub of subscriptions) {
      for (const download of sub.downloads) {
        all.push({ subscription: sub, download });
      }
    }
    // Apply search filter
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? all.filter(
          ({ subscription, download }) =>
            download.name.toLowerCase().includes(q) ||
            subscription.source.toLowerCase().includes(q),
        )
      : all;
    // Apply sort
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.download.name.localeCompare(b.download.name);
      } else if (sortField === 'downloads') {
        cmp =
          parseFloat(a.download.size || '0') -
          parseFloat(b.download.size || '0');
      } else if (sortField === 'subscription') {
        cmp = a.subscription.source.localeCompare(b.subscription.source);
      } else if (sortField === 'speed') {
        cmp =
          parseFloat(a.download.speed || '0') -
          parseFloat(b.download.speed || '0');
      } else if (sortField === 'status') {
        cmp = a.download.status.localeCompare(b.download.status);
      } else {
        // date (default)
        cmp =
          new Date(a.download.date_added).getTime() -
          new Date(b.download.date_added).getTime();
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return filtered;
  }, [subscriptions, searchQuery, sortField, sortDirection]);

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
    if (rows.length > 0) loadThumbnails(rows);
  }, [rows]);

  const selectedHistorySet = useMemo(
    () => new Set(selectedHistoryIds),
    [selectedHistoryIds],
  );
  const visibleHistoryIds = useMemo(
    () => rows.map((r) => `${r.subscription.id}:${r.download.id}`),
    [rows],
  );
  const allHistorySelected =
    visibleHistoryIds.length > 0 &&
    visibleHistoryIds.every((id) => selectedHistorySet.has(id));
  const someHistorySelected =
    !allHistorySelected &&
    visibleHistoryIds.some((id) => selectedHistorySet.has(id));

  const THUMB_PLACEHOLDER_CLASS =
    'h-9 w-16 rounded cursor-pointer overflow-hidden flex justify-center items-center bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.5)_0%,transparent_45%),radial-gradient(circle_at_45%_80%,rgba(255,255,255,0.4)_0%,transparent_35%),linear-gradient(135deg,#ffa42e,#fec77d,#ffa42e,#fec170)]';

  const selectAllHistoryRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllHistoryRef.current) {
      selectAllHistoryRef.current.indeterminate = someHistorySelected;
    }
  }, [someHistorySelected]);

  if (rows.length === 0) {
    return <NoHistoryPage />;
  }

  return (
    <>
      <div className="overflow-auto hover-scrollbar">
        <table className="w-full min-w-max table-fixed text-sm text-left text-gray-700 dark:text-gray-300">
            <thead className="border-b border-gray-200 dark:border-darkModeCompliment">
              <tr className="sticky top-0 z-10 bg-toggleGroupBaseColor dark:bg-darkModeCompliment">
                <th
                  className="bg-toggleGroupBaseColor dark:bg-darkModeCompliment rounded-tl-lg"
                  style={{ width: 44, minWidth: 44 }}
                >
                  <div className="flex items-center justify-end pr-2">
                    <label className="relative overflow-hidden w-[18px] h-[18px] cursor-pointer flex items-center justify-center">
                      <input
                        ref={selectAllHistoryRef}
                        type="checkbox"
                        checked={allHistorySelected}
                        onChange={() => {
                          if (allHistorySelected) {
                            clearHistorySelection();
                          } else {
                            selectAllHistory(visibleHistoryIds);
                          }
                        }}
                        className="sr-only"
                      />
                      <div
                        className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-colors ${
                          allHistorySelected || someHistorySelected
                            ? 'bg-primary border-primary'
                            : 'bg-white border-gray-300 dark:bg-transparent dark:border-gray-500'
                        }`}
                      >
                        {allHistorySelected && (
                          <svg
                            className="w-4 h-4 text-white"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                          >
                            <path d="M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z" />
                          </svg>
                        )}
                        {someHistorySelected && !allHistorySelected && (
                          <div className="w-2 h-0.5 bg-white rounded-full" />
                        )}
                      </div>
                    </label>
                  </div>
                </th>
                {columns.map((col, i) => (
                  <ResizableHeader
                    key={col.id}
                    width={col.width}
                    onResizeStart={(e) => startResizing(col.id, e.clientX)}
                    index={i}
                    onDragStart={startDragging}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={cancelDrag}
                    isDragging={dragging?.columnId === col.id}
                    isDragOver={dragOverIndex === i}
                    columnId={col.id}
                    isLastColumn={i === columns.length - 1}
                  >
                    <div
                      className={`flex flex-row gap-1 items-center justify-start font-semibold text-[13.5px] py-2 ${
                        COLUMN_SORT_MAP[col.id]
                          ? 'cursor-pointer select-none'
                          : ''
                      }`}
                      onClick={() => handleSortClick(col.id)}
                    >
                      <span>{t(`historyPage.columns.${col.id}`)}</span>
                      {COLUMN_SORT_MAP[col.id] && (
                        <HiChevronUpDown
                          size={14}
                          className={`flex-shrink-0 ${
                            sortField === COLUMN_SORT_MAP[col.id]
                              ? sortDirection === 'asc'
                                ? 'rotate-180'
                                : ''
                              : 'dark:text-gray-400'
                          }`}
                        />
                      )}
                    </div>
                  </ResizableHeader>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-darkModeCompliment text-[12.5px]">
              {rows.map(({ subscription, download }) => (
                <tr
                  key={`${subscription.id}-${download.id}`}
                  className="bg-gray-50 dark:bg-darkMode hover:bg-gray-100 dark:hover:bg-darkModeCompliment/50"
                >
                  <td
                    style={{ width: 44, minWidth: 44 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHistorySelection(
                        `${subscription.id}:${download.id}`,
                      );
                    }}
                    className="py-3"
                  >
                    <div className="flex items-center justify-end pr-2">
                      <label
                        className="relative overflow-hidden w-[18px] h-[18px] cursor-pointer flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedHistorySet.has(
                            `${subscription.id}:${download.id}`,
                          )}
                          onChange={() =>
                            toggleHistorySelection(
                              `${subscription.id}:${download.id}`,
                            )
                          }
                          className="sr-only"
                        />
                        <div
                          className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-colors ${
                            selectedHistorySet.has(
                              `${subscription.id}:${download.id}`,
                            )
                              ? 'bg-primary border-primary'
                              : 'bg-white border-gray-300 dark:bg-transparent dark:border-gray-500'
                          }`}
                        >
                          {selectedHistorySet.has(
                            `${subscription.id}:${download.id}`,
                          ) && (
                            <svg
                              className="w-4 h-4 text-white"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                            >
                              <path d="M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z" />
                            </svg>
                          )}
                        </div>
                      </label>
                    </div>
                  </td>
                  {columns.map((col) => {
                    switch (col.id) {
                      case 'title':
                        return (
                          <td
                            key={col.id}
                            className="px-4 py-3 truncate max-w-[300px]"
                          >
                            <div className="flex flex-row items-center gap-2">
                              <div className="h-9 w-16 bg-black flex rounded cursor-pointer overflow-hidden justify-center items-center flex-shrink-0">
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
                                  <div
                                    className={`flex items-center justify-center h-full w-full ${THUMB_PLACEHOLDER_CLASS}`}
                                  >
                                    <FiPlayCircle size={20} color="#F45513" />
                                  </div>
                                )}
                              </div>
                              <span>{download.name}</span>
                            </div>
                          </td>
                        );
                      case 'subscription':
                        return (
                          <td key={col.id} className="px-4 py-3 truncate">
                            {subscription.source}
                          </td>
                        );
                      case 'size':
                        return (
                          <td key={col.id} className="px-4 py-3">
                            {download.size
                              ? formatBytesToHuman(parseFloat(download.size))
                              : '—'}
                          </td>
                        );
                      case 'speed':
                        return (
                          <td key={col.id} className="px-4 py-3">
                            <SpeedGraph
                              key={`speed-graph-${download.id}`}
                              currentSpeed={download.speed}
                              downloadStatus={download.status}
                              downloadId={download.id}
                              showHeader={false}
                              height={25}
                            />
                          </td>
                        );
                      case 'status':
                        return (
                          <td key={col.id} className="px-4 py-3">
                            {statusMapping(download.status)}
                          </td>
                        );
                      case 'date':
                        return (
                          <td key={col.id} className="px-4 py-3">
                            {formatDistanceToNow(download.date_added, {
                                locale: dateLocale,
                                addSuffix: true,
                              })}
                          </td>
                        );
                      case 'actions':
                        return (
                          <td
                            key={col.id}
                            className="px-4 py-3 flex items-center justify-end"
                          >
                            <button
                              onClick={(e) =>
                                handleOpenMenu(
                                  e,
                                  subscription.id,
                                  download.id,
                                  download.name,
                                  download.video_location,
                                )
                              }
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-darkModeCompliment text-gray-500 dark:text-gray-400 transition-colors"
                            >
                              <HiDotsVertical size={16} />
                            </button>
                          </td>
                        );
                      default:
                        return null;
                    }
                  })}
                </tr>
              ))}
            </tbody>
        </table>
      </div>

      {/* 3-dot context menu */}
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menu.y,
              left: menu.x,
              transform: 'translateX(-100%)',
            }}
            className="bg-white dark:bg-darkModeCompliment rounded-lg shadow-lg py-1 min-w-[130px] border border-gray-200 dark:border-gray-600 z-50"
          >
            <button
              onClick={handleView}
              disabled={!menu.videoLocation}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-darkModeHover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <LuEye size={13} />
              {t('historyPage.menu.viewFile')}
            </button>
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-darkModeHover"
            >
              <LuTrash size={13} />
              {t('historyPage.menu.delete')}
            </button>
          </div>,
          document.body,
        )}

      <ConfirmModal
        isOpen={!!deleteConfirm?.open}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title={t('historyPage.confirmDelete.title', {
          name: deleteConfirm?.downloadName,
        })}
        confirmLabel={t('historyPage.confirmDelete.confirmLabel')}
        message={t('historyPage.confirmDelete.message')}
      />
    </>
  );
};

export default SkedulosaHistoryPage;
