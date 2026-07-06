// eslint-disable-next-line prettier/prettier
import ResizableHeader from '@/downlodr/components/download/resizableColumns/ResizableHeader';
import { useResizableColumns } from '@/downlodr/components/download/resizableColumns/useResizableColumns';
import {
  ScheduleEntry,
  ScheduledChannel,
  filterChannelsByStatusAndCategory,
  useSkedulosaStore,
  SortField,
} from '@/skedulosa/store/skedulosaStore';
import NoScheduleDark from '@/assets/skedulosa/images/NoScheduleDark.svg';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BiSolidCircle } from 'react-icons/bi';
import { FaCircle } from 'react-icons/fa';
import { HiChevronUpDown } from 'react-icons/hi2';
import SkedulosaContextMenu, {
  type ContextMenuPosition,
} from '@/skedulosa/components/SkedulosaContextMenu';
import SkedulosaEditModal from '@/skedulosa/components/SkedulosaEditModal';
import SkedulosaSubscribeModal from '@/skedulosa/components/SkedulosaSubscribeModal';
import {
  formatNextRun,
  formatProgress,
  formatSchedule,
  formatStatus,
  getNextRunDate,
} from '../utils/scheduleManagerUtils';
import { RiLoopRightLine } from 'react-icons/ri';
import { LuNewspaper } from 'react-icons/lu';
import { getExtractorIcon } from '@/downlodr/utils/icons/iconMapper';
import NoSchedulePage from './NoSchedulePage';
import NoSchedule from '@/assets/skedulosa/images/NoSchedule.svg';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { enUS, es, ko, pt } from 'date-fns/locale';
import { useNavigate } from 'react-router';
import ConfirmModal from '@/core-app/components/modal/custom/ConfirmModal';
import { useTheme } from '@/core-app/components/ThemeProvider';
import {
  useAfdaSubscriptionsStore,
  afdaSubscriptionToScheduledChannel,
} from '@/afda/store/afdaSubscriptionsStore';
import {
  useAfdaWebsitesStore,
  websiteToScheduledChannel,
} from '@/afda/store/afdaWebsitesStore';
import { getFaviconUrl } from '@/afda/utils/faviconUrl';
import { deleteAfdaWebsite } from '@/afda/utils/deleteAfdaWebsite';

const INITIAL_COLUMNS = [
  { id: 'channel', width: 220, minWidth: 120 },
  { id: 'type', width: 100, minWidth: 70 },
  { id: 'schedule', width: 120, minWidth: 80 },
  { id: 'lastrun', width: 120, minWidth: 80 },
  { id: 'nextrun', width: 120, minWidth: 80 },
  { id: 'source', width: 110, minWidth: 70 },
  { id: 'progress', width: 110, minWidth: 70 },
  { id: 'status', width: 100, minWidth: 70 },
];

type ScheduleRow = {
  channel: ScheduledChannel;
  entry: ScheduleEntry;
};

const statusVariant = (
  status: ScheduledChannel['status'],
): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' => {
  switch (status) {
    case 'Active':
      return 'success';
    case 'Paused':
      return 'secondary';
    case 'Error':
      return 'destructive';
    default:
      return 'outline';
  }
};

type DerivedStatus = 'Downloading' | 'Failed' | ReturnType<typeof formatStatus>;

function deriveChannelStatus(channel: {
  downloads: { status: string }[];
  status: string;
}): DerivedStatus {
  if (channel.downloads.some((d) => d.status === 'downloading'))
    return 'Downloading';
  if (channel.downloads.some((d) => d.status === 'failed')) return 'Failed';
  return formatStatus(channel.status);
}

const STATUS_DOT_CLASS: Record<string, string> = {
  Downloading: 'text-green-500',
  Running: 'text-green-500',
  Failed: 'text-red-500',
  Missed: 'text-red-500',
  Pending: 'text-gray-300',
};

const SkedulosaSchedulePage = () => {
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

  const [contextMenu, setContextMenu] = useState<{
    position: ContextMenuPosition;
    channelId: string;
    category: string;
  } | null>(null);
  const [editModalId, setEditModalId] = useState<string | null>(null);
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    channelId: string;
    channelName: string;
    category: string;
  } | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const bulkDeleteSubscriptions = useSkedulosaStore(
    (s) => s.bulkDeleteSubscriptions,
  );
  const scheduledChannels = useSkedulosaStore((s) => s.scheduledChannels);
  const afdaSubscriptions = useAfdaSubscriptionsStore(
    (s) => s.afdaSubscriptions,
  );
  const afdaWebsites = useAfdaWebsitesStore((s) => s.websites);
  const removeWebsite = useAfdaWebsitesStore((s) => s.removeWebsite);
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, channel: ScheduledChannel) => {
      e.preventDefault();
      setContextMenu({
        position: { x: e.clientX, y: e.clientY },
        channelId: channel.id,
        category: channel.category ?? '',
      });
    },
    [],
  );

  const handleDelete = useCallback(
    (channelId: string) => {
      const allCh = [
        ...scheduledChannels,
        ...afdaWebsites.map(websiteToScheduledChannel),
      ];
      const channel = allCh.find((c) => c.id === channelId);
      setDeleteConfirm({
        channelId,
        channelName: channel?.channelName ?? channelId,
        category: channel?.category ?? '',
      });
      setContextMenu(null);
    },
    [scheduledChannels, afdaWebsites],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    const { channelId, category } = deleteConfirm;
    if (category === 'afda-website') {
      await deleteAfdaWebsite(channelId, removeWebsite);
    } else {
      await bulkDeleteSubscriptions([channelId]);
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, bulkDeleteSubscriptions, removeWebsite]);

  const { t, i18n } = useTranslation('skedulosa');
  const dateLocaleMap: Record<string, Locale> = { en: enUS, es, pt, ko };
  const dateLocale = dateLocaleMap[i18n.language] ?? enUS;
  const { theme } = useTheme();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const navigate = useNavigate();

  const subscriptions = useSkedulosaStore((s) => s.subscriptions);
  const statusFilter = useSkedulosaStore((s) => s.statusFilter);
  const categoryFilter = useSkedulosaStore((s) => s.categoryFilter);
  const searchQuery = useSkedulosaStore((s) => s.searchQuery);
  const sortField = useSkedulosaStore((s) => s.sortField);
  const sortDirection = useSkedulosaStore((s) => s.sortDirection);
  const selectedChannelIds = useSkedulosaStore((s) => s.selectedChannelIds);
  const toggleChannelSelection = useSkedulosaStore(
    (s) => s.toggleChannelSelection,
  );
  const selectAllChannels = useSkedulosaStore((s) => s.selectAllChannels);
  const clearSelection = useSkedulosaStore((s) => s.clearSelection);

  const selectedSet = useMemo(
    () => new Set(selectedChannelIds),
    [selectedChannelIds],
  );

  const COLUMN_SORT_MAP: Partial<Record<string, SortField>> = {
    channel: 'name',
    type: 'type',
    schedule: 'schedule',
    lastrun: 'date',
    nextrun: 'nextrun',
    source: 'source',
    progress: 'downloads',
    status: 'status',
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

  const allChannels = useMemo(() => {
    const getDomain = (url: string) => {
      try {
        return new URL(url).hostname.replace(/^www\./, '');
      } catch {
        return '';
      }
    };

    // afdaWebsites is the authoritative backend source. Any legacy entry in
    // scheduledChannels or afdaSubscriptions whose domain is already covered by
    // a website entry is excluded to prevent the same site appearing twice.
    const websiteDomains = new Set(
      afdaWebsites.map((w) => getDomain(w.url)).filter(Boolean),
    );

    const merged = [
      ...scheduledChannels.filter((ch) => {
        const domain = getDomain(ch.channelUrl ?? '');
        return !domain || !websiteDomains.has(domain);
      }),
      ...afdaSubscriptions
        .filter((sub) => {
          const domain = getDomain(sub.sourceUrl ?? '');
          return !domain || !websiteDomains.has(domain);
        })
        .map(afdaSubscriptionToScheduledChannel),
      ...afdaWebsites.map(websiteToScheduledChannel),
    ];

    // Safety-net dedup by normalized channelUrl to catch within-source duplicates
    // (e.g. same channel subscribed twice, or http vs https / www vs no-www variants).
    // NOTE: do NOT dedup by id — scheduledChannels and afdaWebsites both use
    // small SQLite integer IDs from separate databases that can collide.
    const normalizeUrl = (url: string) =>
      url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    const seenUrls = new Set<string>();
    return merged.filter((ch) => {
      const raw = ch.channelUrl?.trim();
      if (!raw) return true;
      const key = normalizeUrl(raw);
      if (seenUrls.has(key)) return false;
      seenUrls.add(key);
      return true;
    });
  }, [scheduledChannels, afdaSubscriptions, afdaWebsites]);

  const filteredChannels = useMemo(() => {
    let channels = filterChannelsByStatusAndCategory(
      allChannels,
      statusFilter,
      categoryFilter,
    );
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      channels = channels.filter((ch) =>
        ch.channelName.toLowerCase().includes(q),
      );
    }
    return channels;
  }, [allChannels, statusFilter, categoryFilter, searchQuery]);

  const rows: ScheduleRow[] = useMemo(() => {
    const unsorted = filteredChannels.map((channel) => ({
      channel,
      entry: channel.schedule[0],
    }));
    return [...unsorted].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.channel.channelName.localeCompare(b.channel.channelName);
      } else if (sortField === 'date') {
        cmp =
          new Date(
            a.channel.last_checked_time || a.channel.date_created || 0,
          ).getTime() -
          new Date(
            b.channel.last_checked_time || b.channel.date_created || 0,
          ).getTime();
      } else if (sortField === 'downloads') {
        cmp = a.channel.downloads.length - b.channel.downloads.length;
      } else if (sortField === 'type') {
        cmp = (a.channel.recurring ? 1 : 0) - (b.channel.recurring ? 1 : 0);
      } else if (sortField === 'schedule') {
        cmp =
          parseInt(a.entry.timeToCheck || '0', 10) -
          parseInt(b.entry.timeToCheck || '0', 10);
      } else if (sortField === 'nextrun') {
        cmp =
          getNextRunDate(a.entry, new Date()).getTime() -
          getNextRunDate(b.entry, new Date()).getTime();
      } else if (sortField === 'source') {
        cmp = (a.channel.source || '').localeCompare(b.channel.source || '');
      } else if (sortField === 'status') {
        cmp = deriveChannelStatus(a.channel).localeCompare(
          deriveChannelStatus(b.channel),
        );
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredChannels, sortField, sortDirection]);

  const visibleIds = useMemo(
    () => [...new Set(rows.map((r) => r.channel.id))],
    [rows],
  );
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const someSelected =
    !allSelected && visibleIds.some((id) => selectedSet.has(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  if (filteredChannels.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full">
          <img
            src={isDark ? NoScheduleDark : NoSchedule}
            alt={t('scheduledPage.emptyState.altText')}
            className="w-2/6 h-2/6"
          />
          <div className="text-center w-2/6 mt-4">
            <h1 className="text-sm font-bold">
              {statusFilter === 'all'
                ? t('scheduledPage.emptyState.titleAll')
                : t('scheduledPage.emptyState.title', { filter: statusFilter })}
            </h1>
            <p className="text-gray-500 text-[12.5px] mt-2">
              {t('scheduledPage.emptyState.description')}
            </p>
            {statusFilter === 'all' && (
              <button
                onClick={() => setIsSubscribeModalOpen(true)}
                className="mt-4 px-4 py-2 bg-primary text-white text-sm rounded-md hover:opacity-90 transition-opacity"
              >
                {t('scheduledPage.emptyState.addFirstButton')}
              </button>
            )}
          </div>
        </div>
        <SkedulosaSubscribeModal
          isOpen={isSubscribeModalOpen}
          onClose={() => setIsSubscribeModalOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className="overflow-auto hover-scrollbar">
        <table className="w-full min-w-max table-fixed text-sm text-left text-gray-700 dark:text-gray-300 [&>tbody>tr:last-child>td:first-child]:rounded-bl-lg [&>tbody>tr:last-child>td:last-child]:rounded-br-lg">
          <thead className="">
            <tr className="sticky top-0 z-10 bg-toggleGroupBaseColor dark:bg-darkModeCompliment">
              <th
                className="bg-toggleGroupBaseColor dark:bg-darkModeCompliment rounded-tl-lg"
                style={{ width: 44, minWidth: 44 }}
              >
                <div className="flex items-center justify-end pr-2">
                  <label className="relative overflow-hidden w-[18px] h-[18px] cursor-pointer flex items-center justify-center">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => {
                        if (allSelected) {
                          clearSelection();
                        } else {
                          selectAllChannels(visibleIds);
                        }
                      }}
                      className="sr-only"
                    />
                    <div
                      className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-colors ${
                        allSelected || someSelected
                          ? 'bg-primary border-primary'
                          : 'bg-white border-gray-300 dark:bg-transparent dark:border-gray-500'
                      }`}
                    >
                      {allSelected && (
                        <svg
                          className="w-4 h-4 text-white"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
                        </svg>
                      )}
                      {someSelected && !allSelected && (
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
                  className={i === columns.length - 1 ? 'rounded-tr-lg' : ''}
                >
                  <div
                    className={`flex flex-row gap-1 items-center justify-start font-semibold text-[13.5px] py-2 ${
                      COLUMN_SORT_MAP[col.id]
                        ? 'cursor-pointer select-none'
                        : ''
                    }`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => handleSortClick(col.id)}
                  >
                    <span>{t(`scheduledPage.columns.${col.id}`)}</span>
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
          <tbody className="text-[12.5px]">
            {rows.map(({ channel, entry }) => {
              const sub = subscriptions.find((s) => s.id === channel.id);
              const details = sub?.channel_details;
              return (
                <tr
                  key={`${channel.category ?? 'youtube'}-${channel.channelId}-${entry.scheduleId}`}
                  className="bg-gray-50 dark:bg-darkMode hover:bg-gray-100 dark:hover:bg-darkModeCompliment/50"
                  onContextMenu={(e) => handleContextMenu(e, channel)}
                  onClick={(e) => {
                    if (
                      channel.category === 'afda' ||
                      channel.category === 'afda-website'
                    ) {
                      navigate(`/skedulosa/selected-article/${channel.id}`);
                      return;
                    }
                    if (!sub) return;
                    navigate(`/skedulosa/selected-subscription/${sub.id}?`);
                  }}
                >
                  <td
                    style={{ width: 44, minWidth: 44 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleChannelSelection(channel.id);
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
                          checked={selectedSet.has(channel.id)}
                          onChange={() => toggleChannelSelection(channel.id)}
                          className="sr-only"
                        />
                        <div
                          className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-colors ${
                            selectedSet.has(channel.id)
                              ? 'bg-primary border-primary'
                              : 'bg-white border-gray-300 dark:bg-transparent dark:border-gray-500'
                          }`}
                        >
                          {selectedSet.has(channel.id) && (
                            <svg
                              className="w-4 h-4 text-white"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                            >
                              <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
                            </svg>
                          )}
                        </div>
                      </label>
                    </div>
                  </td>
                  {columns.map((col) => {
                    switch (col.id) {
                      case 'channel': {
                        const faviconUrl =
                          channel.category === 'afda-website'
                            ? getFaviconUrl(channel.sourceUrl ?? '')
                            : null;
                        return (
                          <td key={col.id} className="px-4 py-3">
                            <div className="flex flex-row gap-2 items-center justify-start">
                              {channel.category === 'afda-website' ? (
                                faviconUrl ? (
                                  <img
                                    src={faviconUrl}
                                    className="w-8 h-8 rounded-full object-contain"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                    <LuNewspaper
                                      size={13}
                                      className="text-blue-500 dark:text-blue-400"
                                    />
                                  </div>
                                )
                              ) : channel.category === 'afda' ? (
                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                  <LuNewspaper
                                    size={13}
                                    className="text-blue-500 dark:text-blue-400"
                                  />
                                </div>
                              ) : details?.avatarUrl ? (
                                <img
                                  src={details.avatarUrl}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-200" />
                              )}
                              <div className="min-w-0 flex flex-col -gap-0.5">
                                <div className="flex items-center gap-1">
                                  <h1 className="font-semibold text-gray-900 dark:text-gray-100">
                                    {channel.channelName}
                                  </h1>
                                </div>
                                <h2 className="text-[11px] truncate">
                                  {channel.sourceUrl}
                                </h2>
                              </div>
                            </div>
                          </td>
                        );
                      }
                      case 'type':
                        return (
                          <td key={col.id} className="px-4 py-3">
                            <div className="flex flex-row gap-2 items-center justify-center">
                              <div className="py-2 px-4 bg-recurringTag dark:bg-darkModeCompliment rounded-xl text-xs font-medium flex items-center gap-1">
                                {channel.recurring ? <RiLoopRightLine /> : null}
                                {channel.recurring
                                  ? t('scheduledPage.type.recurring')
                                  : t('scheduledPage.type.oneTime')}
                              </div>
                            </div>
                          </td>
                        );
                      case 'schedule':
                        return (
                          <td key={col.id} className="px-4 py-3 font-semibold">
                            {formatSchedule(entry)}
                          </td>
                        );
                      case 'lastrun':
                        return (
                          <td key={col.id} className="px-4 py-3">
                            {channel.last_checked_time &&
                            new Date(channel.last_checked_time) >=
                              new Date(channel.date_created)
                              ? formatDistanceToNow(channel.last_checked_time, {
                                  locale: dateLocale,
                                  addSuffix: true,
                                })
                              : formatDistanceToNow(channel.date_created, {
                                  locale: dateLocale,
                                  addSuffix: true,
                                })}
                          </td>
                        );
                      case 'nextrun':
                        return (
                          <td key={col.id} className="px-4 py-3">
                            {formatNextRun(entry)}
                          </td>
                        );
                      case 'source': {
                        const faviconUrl =
                          channel.category === 'afda' ||
                          channel.category === 'afda-website'
                            ? getFaviconUrl(channel.sourceUrl ?? '')
                            : null;
                        return (
                          <td key={col.id} className="px-4 py-3 font-medium">
                            <div className="flex gap-1 items-center">
                              {channel.category === 'afda' ||
                              channel.category === 'afda-website' ? (
                                faviconUrl ? (
                                  <img
                                    src={faviconUrl}
                                    className="w-6 h-6 rounded object-contain"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                    <LuNewspaper
                                      size={13}
                                      className="text-blue-500 dark:text-blue-400"
                                    />
                                  </div>
                                )
                              ) : (
                                <span className="text-[10px]">
                                  {getExtractorIcon('youtube')}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      }
                      case 'progress':
                        return (
                          <td key={col.id} className="px-4 py-3">
                            {formatProgress(channel.downloads).text}
                          </td>
                        );
                      case 'status': {
                        const displayStatus = deriveChannelStatus(channel);
                        return (
                          <td key={col.id} className="px-4 py-3">
                            <div className="flex flex-row gap-2 items-center justify-start">
                              <FaCircle
                                className={
                                  STATUS_DOT_CLASS[displayStatus] ??
                                  'text-gray-300'
                                }
                                size={12}
                              />
                              {t(
                                `scheduledPage.status.${displayStatus.toLowerCase()}`,
                                { defaultValue: displayStatus },
                              )}
                            </div>
                          </td>
                        );
                      }
                      default:
                        return null;
                    }
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {contextMenu && (
        <SkedulosaContextMenu
          position={contextMenu.position}
          subscriptionId={contextMenu.channelId}
          category={contextMenu.category}
          onEdit={() => setEditModalId(contextMenu.channelId)}
          onDelete={() => handleDelete(contextMenu.channelId)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {editModalId && (
        <SkedulosaEditModal
          isOpen={true}
          onClose={() => setEditModalId(null)}
          subscriptionId={editModalId}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title={t('scheduledPage.confirmDelete.title', {
          name: deleteConfirm?.channelName,
        })}
        confirmLabel={t('scheduledPage.confirmDelete.confirmLabel')}
        message={t('scheduledPage.confirmDelete.message')}
      />
    </>
  );
};

export default SkedulosaSchedulePage;
