// eslint-disable-next-line prettier/prettier
import ResizableHeader from '@/downlodr/components/download/resizableColumns/ResizableHeader';
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
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import { useResizableColumns } from '@/downlodr/components/download/resizableColumns/useResizableColumns';
import { getExtractorIcon } from '@/downlodr/utils/icons/iconMapper';
import {
  ScheduleEntry,
  ScheduledChannel,
  filterChannelsByStatusAndCategory,
  useSkedulosaStore,
  SortField,
} from '@/skedulosa/store/skedulosaStore';

// eslint-disable-next-line import/named
import { formatDistanceToNow, Locale } from 'date-fns';
import { de, enUS, es, ja, ko, pt, zhCN, zhTW } from 'date-fns/locale';
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BiSolidCircle } from 'react-icons/bi';
import { FaCircle } from 'react-icons/fa';
import { HiChevronUpDown } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { LuNewspaper } from 'react-icons/lu';
import {
  formatBytesToHuman,
  getTotalStoragePerSubscription,
} from '../utils/subscriptionDownloadUtils';
import NoSchedulePage from './NoSchedulePage';
import empty from '@/assets/skedulosa/images/empty.svg';
import NoSubscriptionDark from '@/assets/skedulosa/images/NoSubscriptionDark.svg';
import { useTheme } from '@/core-app/components/ThemeProvider';
import SkedulosaContextMenu, {
  type ContextMenuPosition,
} from '@/skedulosa/components/SkedulosaContextMenu';
import SkedulosaEditModal from '@/skedulosa/components/SkedulosaEditModal';
import SkedulosaSubscribeModal from '@/skedulosa/components/SkedulosaSubscribeModal';
import ConfirmModal from '@/core-app/components/modal/custom/ConfirmModal';

const INITIAL_COLUMNS = [
  { id: 'subscription', width: 220, minWidth: 120 },
  { id: 'status', width: 100, minWidth: 70 },
  { id: 'checked', width: 120, minWidth: 80 },
  { id: 'downloads', width: 110, minWidth: 70 },
  { id: 'source', width: 110, minWidth: 70 },
  { id: 'storage', width: 110, minWidth: 70 },
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

const SkedulosaSubscriptionPage = () => {
  const { t, i18n } = useTranslation('skedulosa');
  const dateLocaleMap: Record<string, Locale> = {
    en: enUS,
    es,
    pt,
    ko,
    ja,
    de,
    'zh-CN': zhCN,
    'zh-TW': zhTW,
  };
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

  const removeSubscription = useSkedulosaStore((s) => s.removeSubscription);
  const getSubscription = useSkedulosaStore((s) => s.getSubscription);
  const bulkDeleteSubscriptions = useSkedulosaStore(
    (s) => s.bulkDeleteSubscriptions,
  );
  const scheduledChannels = useSkedulosaStore((s) => s.scheduledChannels);
  const afdaSubscriptions = useAfdaSubscriptionsStore(
    (s) => s.afdaSubscriptions,
  );
  const afdaWebsites = useAfdaWebsitesStore((s) => s.websites);
  const removeWebsite = useAfdaWebsitesStore((s) => s.removeWebsite);
  const selectedChannelIds = useSkedulosaStore((s) => s.selectedChannelIds);
  const toggleChannelSelection = useSkedulosaStore(
    (s) => s.toggleChannelSelection,
  );
  const selectAllChannels = useSkedulosaStore((s) => s.selectAllChannels);
  const clearSelection = useSkedulosaStore((s) => s.clearSelection);

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
    (channelId: string, category: string) => {
      // Disambiguate by category first — scheduledChannels and afdaWebsites
      // use small SQLite integer IDs from separate databases that can collide,
      // so a bare id lookup across both risks resolving the wrong entry.
      const channel =
        category === 'afda-website'
          ? afdaWebsites
              .map(websiteToScheduledChannel)
              .find((c) => c.id === channelId)
          : scheduledChannels.find((c) => c.id === channelId);
      setDeleteConfirm({
        channelId,
        channelName: channel?.channelName ?? channelId,
        category: channel?.category ?? category,
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

  const { theme } = useTheme();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const subscriptions = useSkedulosaStore((s) => s.subscriptions);
  const navigate = useNavigate();

  const statusFilter = useSkedulosaStore((s) => s.statusFilter);
  const categoryFilter = useSkedulosaStore((s) => s.categoryFilter);
  const searchQuery = useSkedulosaStore((s) => s.searchQuery);
  const sortField = useSkedulosaStore((s) => s.sortField);
  const sortDirection = useSkedulosaStore((s) => s.sortDirection);

  const COLUMN_SORT_MAP: Partial<Record<string, SortField>> = {
    subscription: 'name',
    status: 'status',
    checked: 'date',
    downloads: 'downloads',
    source: 'source',
    storage: 'storage',
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

  const storageMap = useMemo(
    () => getTotalStoragePerSubscription(subscriptions),
    [subscriptions],
  );

  const articleDownloads = useArticleDownloadStore((s) => s.articleDownloads);
  const afdaWebsiteDownloadCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const dl of articleDownloads) {
      if (dl.subscriptionId) {
        map[dl.subscriptionId] = (map[dl.subscriptionId] ?? 0) + 1;
      }
    }
    return map;
  }, [articleDownloads]);

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
      channels = channels.filter(
        (ch) =>
          ch.channelName.toLowerCase().includes(q) ||
          ch.source?.toLowerCase().includes(q),
      );
    }
    channels = [...channels].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.channelName.localeCompare(b.channelName);
      } else if (sortField === 'date') {
        cmp =
          new Date(a.last_checked_time || a.date_created || 0).getTime() -
          new Date(b.last_checked_time || b.date_created || 0).getTime();
      } else if (sortField === 'downloads') {
        const countA = a.category === 'afda-website' ? (afdaWebsiteDownloadCountMap[a.id] ?? 0) : a.downloads.length;
        const countB = b.category === 'afda-website' ? (afdaWebsiteDownloadCountMap[b.id] ?? 0) : b.downloads.length;
        cmp = countA - countB;
      } else if (sortField === 'status') {
        cmp = (a.status || '').localeCompare(b.status || '');
      } else if (sortField === 'source') {
        cmp = (a.source || '').localeCompare(b.source || '');
      } else if (sortField === 'storage') {
        cmp = (storageMap[a.id] ?? 0) - (storageMap[b.id] ?? 0);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return channels;
  }, [
    allChannels,
    statusFilter,
    categoryFilter,
    searchQuery,
    sortField,
    sortDirection,
    storageMap,
    afdaWebsiteDownloadCountMap,
  ]);

  const rows: ScheduleRow[] = filteredChannels.map((channel) => ({
    channel,
    entry: channel.schedule[0],
  }));

  const selectedSet = useMemo(
    () => new Set(selectedChannelIds),
    [selectedChannelIds],
  );
  const visibleIds = useMemo(
    () => [...new Set(rows.map((r) => r.channel.id))],
    [rows],
  );
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const someSelected =
    !allSelected && visibleIds.some((id) => selectedSet.has(id));

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const statusMapping = (status: ScheduledChannel['status']) => {
    switch (status) {
      case 'Active':
        return 'text-green-500';
      case 'Paused':
        return 'text-yellow-500';
      case 'Error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  if (filteredChannels.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full">
          <img
            src={isDark ? NoSubscriptionDark : empty}
            alt={t('subscriptionPage.emptyState.altText')}
            className="w-2/6"
          />
          <div className="text-center w-2/6 mt-4">
            <h1 className="text-sm font-bold">
              {statusFilter === 'all'
                ? t('subscriptionPage.emptyState.titleAll')
                : t('subscriptionPage.emptyState.title', { filter: statusFilter })}
            </h1>
            <p className="text-gray-500 text-[12.5px] mt-2">
              {t('subscriptionPage.emptyState.description')}
            </p>
            {statusFilter === 'all' && (
              <button
                onClick={() => setIsSubscribeModalOpen(true)}
                className="mt-4 px-4 py-2 bg-primary text-white text-sm rounded-md hover:opacity-90 transition-opacity"
              >
                {t('subscriptionPage.emptyState.addFirstButton')}
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
                          <path d="M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z" />
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
                    <span>{t(`subscriptionPage.columns.${col.id}`)}</span>
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
                              <path d="M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z" />
                            </svg>
                          )}
                        </div>
                      </label>
                    </div>
                  </td>
                  {columns.map((col) => {
                    switch (col.id) {
                      case 'subscription': {
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
                      case 'status':
                        return (
                          <td
                            key={col.id}
                            className={`px-4 py-3 font-medium ${statusMapping(
                              channel.status,
                            )}`}
                          >
                            <div className="flex flex-row gap-2 items-center justify-start">
                              <FaCircle
                                className={statusMapping(channel.status)}
                                size={10}
                              />
                              {t(
                                `subscriptionPage.status.${channel.status.toLowerCase()}`,
                              )}
                            </div>
                          </td>
                        );
                      case 'checked':
                        return (
                          <td key={col.id} className="px-4 py-3 font-medium">
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
                      case 'downloads':
                        return (
                          <td key={col.id} className="px-4 py-3 font-medium">
                            {channel.category === 'afda-website'
                              ? (afdaWebsiteDownloadCountMap[channel.id] ?? 0)
                              : channel.downloads.length}
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
                                <>
                                  <span className="text-[10px]">
                                    {getExtractorIcon('youtube')}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                        );
                      }
                      case 'storage':
                        return (
                          <td key={col.id} className="px-4 py-3 font-medium">
                            {formatBytesToHuman(
                              getTotalStoragePerSubscription(subscriptions)[
                                channel.id
                              ] ?? 0,
                            )}
                          </td>
                        );
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
          onDelete={() => handleDelete(contextMenu.channelId, contextMenu.category)}
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
        title={t('subscriptionPage.confirmDelete.title', {
          name: deleteConfirm?.channelName,
        })}
        confirmLabel={t('subscriptionPage.confirmDelete.confirmLabel')}
        message={t('subscriptionPage.confirmDelete.message')}
      />
    </>
  );
};

export default SkedulosaSubscriptionPage;
