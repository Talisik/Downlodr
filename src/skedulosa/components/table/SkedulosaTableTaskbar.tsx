import type {
  SortDirection,
  SortField,
} from '@/skedulosa/store/skedulosaStore';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import {
  getScheduledDownloadsCountToday,
  getSoonestNextRunLabel,
} from '@/skedulosa/utils/scheduleManagerUtils';
import {
  formatBytesToHuman,
  getTotalStorageUsedBytes,
} from '@/skedulosa/utils/subscriptionDownloadUtils';
import { useDropdownAnimation } from '@/core-app/hooks/animation/useDropdownAnimation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  FiSearch,
  FiX,
  FiTrash2,
  FiPause,
  FiPlay,
  FiEdit2,
  FiEdit,
} from 'react-icons/fi';
import { LuClock4, LuDownload, LuHardDrive } from 'react-icons/lu';
import {
  TbSortAscendingLetters,
  TbSortDescendingLetters,
} from 'react-icons/tb';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import SkedulosaEditModal from '../SkedulosaEditModal';
import ConfirmModal from '@/core-app/components/modal/custom/ConfirmModal';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';
import { deleteAfdaWebsite } from '@/afda/utils/deleteAfdaWebsite';
import { FaPlus } from 'react-icons/fa6';

type SkedulosaTableTaskbarProps = {
  onOpenSubscribe: (url?: string) => void;
};

type SortOption = {
  key: string;
  field: SortField;
  direction: SortDirection;
};

const SORT_OPTIONS: SortOption[] = [
  { key: 'taskbar.sort.nameAZ', field: 'name', direction: 'asc' },
  { key: 'taskbar.sort.nameZA', field: 'name', direction: 'desc' },
  { key: 'taskbar.sort.newestFirst', field: 'date', direction: 'desc' },
  { key: 'taskbar.sort.oldestFirst', field: 'date', direction: 'asc' },
  { key: 'taskbar.sort.mostDownloads', field: 'downloads', direction: 'desc' },
  { key: 'taskbar.sort.fewestDownloads', field: 'downloads', direction: 'asc' },
];

const SkedulosaTableTaskbar = ({
  onOpenSubscribe,
}: SkedulosaTableTaskbarProps) => {
  const { t } = useTranslation('skedulosa');
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortMenuPosition, setSortMenuPosition] = useState({ x: 0, y: 0 });
  const [bulkSubDeleteConfirm, setBulkSubDeleteConfirm] = useState(false);
  const [bulkHistoryDeleteConfirm, setBulkHistoryDeleteConfirm] =
    useState(false);
  const [editModalId, setEditModalId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { ref: sortMenuRef, mounted: sortMenuMounted } = useDropdownAnimation(showSortMenu);

  const subscriptions = useSkedulosaStore((s) => s.subscriptions);
  const scheduledChannels = useSkedulosaStore((s) => s.scheduledChannels);
  const searchQuery = useSkedulosaStore((s) => s.searchQuery);
  const sortField = useSkedulosaStore((s) => s.sortField);
  const sortDirection = useSkedulosaStore((s) => s.sortDirection);
  const setSearchQuery = useSkedulosaStore((s) => s.setSearchQuery);
  const setSortField = useSkedulosaStore((s) => s.setSortField);
  const setSortDirection = useSkedulosaStore((s) => s.setSortDirection);
  const selectedChannelIds = useSkedulosaStore((s) => s.selectedChannelIds);
  const clearSelection = useSkedulosaStore((s) => s.clearSelection);
  const bulkDeleteSubscriptions = useSkedulosaStore(
    (s) => s.bulkDeleteSubscriptions,
  );
  const bulkPauseSubscriptions = useSkedulosaStore(
    (s) => s.bulkPauseSubscriptions,
  );
  const bulkResumeSubscriptions = useSkedulosaStore(
    (s) => s.bulkResumeSubscriptions,
  );
  const selectedHistoryIds = useSkedulosaStore((s) => s.selectedHistoryIds);
  const clearHistorySelection = useSkedulosaStore(
    (s) => s.clearHistorySelection,
  );
  const bulkDeleteHistoryDownloads = useSkedulosaStore(
    (s) => s.bulkDeleteHistoryDownloads,
  );
  const afdaWebsites = useAfdaWebsitesStore((s) => s.websites);
  const removeWebsite = useAfdaWebsitesStore((s) => s.removeWebsite);

  // Tick every 60s so "Next check in" stays current without live polling
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Only recompute when schedule config or the minute tick changes
  const soonestNextRun = useMemo(
    () => getSoonestNextRunLabel(scheduledChannels, now),
    [scheduledChannels, now],
  );

  // Focus input when search opens
  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  // Close search after two outside clicks
  const outsideClickCountRef = useRef(0);
  useEffect(() => {
    if (!isSearchOpen) {
      outsideClickCountRef.current = 0;
      return;
    }
    const handler = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        outsideClickCountRef.current += 1;
        if (outsideClickCountRef.current >= 2) {
          setIsSearchOpen(false);
          setSearchQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isSearchOpen]);

  // Close sort menu on outside click
  useEffect(() => {
    if (!showSortMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(e.target as Node)
      ) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSortMenu]);

  // Clear the opposing selection type when switching between tabs so bulk
  // actions from one tab don't bleed into another.
  useEffect(() => {
    if (location.pathname.includes('/skedulosa/history')) {
      clearSelection();
    } else {
      clearHistorySelection();
    }
  }, [location.pathname]);

  const handleSearchToggle = () => {
    if (isSearchOpen) {
      setSearchQuery('');
    }
    setIsSearchOpen((prev) => !prev);
  };

  const handleSortClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSortMenuPosition({ x: rect.left, y: rect.bottom + 4 });
    setShowSortMenu((prev) => !prev);
  };

  const handleSortSelect = (option: SortOption) => {
    setSortField(option.field);
    setSortDirection(option.direction);
    setShowSortMenu(false);
  };

  const activeSortKey =
    SORT_OPTIONS.find(
      (o) => o.field === sortField && o.direction === sortDirection,
    )?.key ?? 'taskbar.sort.label';
  const activeSortLabel = t(activeSortKey);

  const isSortActive = !(sortField === 'name' && sortDirection === 'asc');

  return (
    <>
      <div className="flex items-center justify-between w-full px-2 py-2 pl-[8px] bg-nav-main dark:bg-darkMode">
        {/* Left: stats or bulk actions */}
        {selectedHistoryIds.length > 0 ? (
          <div className="flex flex-row gap-1 items-center text-[12px]">
            <span className="text-gray-500 font-medium px-2">
              {t('taskbar.bulk.downloadsSelected', {
                count: selectedHistoryIds.length,
              })}
            </span>
            <TooltipWrapper
              content={t('taskbar.bulk.deleteSelectedDownloads')}
              side="bottom"
            >
              <button
                onClick={() => setBulkHistoryDeleteConfirm(true)}
                className="flex items-center gap-1 px-3 py-1 rounded-md dark:text-red-400 transition-colors"
              >
                <FiTrash2 size={13} />
                {t('taskbar.bulk.delete')}
              </button>
            </TooltipWrapper>
            <button
              onClick={clearHistorySelection}
              className="flex items-center gap-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors ml-1"
              title={t('taskbar.bulk.clearSelection')}
            >
              <FiX size={14} />
            </button>
          </div>
        ) : selectedChannelIds.length > 0 ? (
          <div className="flex flex-row gap-1 items-center -gap-1 text-[12px]">
            <TooltipWrapper
              content={t('taskbar.bulk.pauseSelectedSubscriptions')}
              side="bottom"
            >
              <button
                onClick={() =>
                  bulkPauseSubscriptions(selectedChannelIds).catch(
                    console.error,
                  )
                }
                disabled={selectedChannelIds.every(
                  (id) =>
                    subscriptions.find((s) => s.id === id)?.status === 'Paused',
                )}
                className="flex items-center gap-1 px-3 py-1 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiPause size={13} />
                {t('taskbar.bulk.pause')}
              </button>
            </TooltipWrapper>
            <TooltipWrapper
              content={t('taskbar.bulk.resumeSelectedSubscriptions')}
              side="bottom"
            >
              <button
                onClick={() =>
                  bulkResumeSubscriptions(selectedChannelIds).catch(
                    console.error,
                  )
                }
                disabled={selectedChannelIds.every(
                  (id) =>
                    subscriptions.find((s) => s.id === id)?.status === 'Active',
                )}
                className="flex items-center gap-1 px-3 py-1 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiPlay size={13} />
                {t('taskbar.bulk.resume')}
              </button>
            </TooltipWrapper>
            {selectedChannelIds.length === 1 && (
              <TooltipWrapper
                content={t('taskbar.bulk.editSubscription')}
                side="bottom"
              >
                <button
                  onClick={() => setEditModalId(selectedChannelIds[0])}
                  className="flex items-center gap-1 px-3 py-1 rounded-md transition-colors"
                >
                  <FiEdit size={13} />
                  {t('taskbar.bulk.edit')}
                </button>
              </TooltipWrapper>
            )}
            <TooltipWrapper
              content={t('taskbar.bulk.deleteSelectedSubscriptions')}
              side="bottom"
            >
              <button
                onClick={() => setBulkSubDeleteConfirm(true)}
                className="flex items-center gap-1 px-3 py-1 rounded-md dark:text-red-400 transition-colors"
              >
                <FiTrash2 size={13} />
                {t('taskbar.bulk.delete')}
              </button>
            </TooltipWrapper>
          </div>
        ) : (
          <div className="flex flex-row gap-4 text-[12px] px-2">
            <div className="flex flex-row gap-1 items-center justify-center">
              <span className="text-gray-500">
                <LuDownload className="text-gray-500" />
              </span>
              <span className="font-bold">
                {getScheduledDownloadsCountToday(subscriptions)}
              </span>{' '}
              <span className="text-gray-500">{t('taskbar.stats.today')}</span>/{' '}
              <span className="font-bold">{subscriptions.length}</span>{' '}
              <span className="text-gray-500">
                {t('taskbar.stats.thisWeek')}
              </span>
            </div>

            <div className="flex flex-row gap-1 items-center justify-center">
              <span className="text-gray-500">
                <LuHardDrive className="text-gray-500" />
              </span>
              <span className="font-bold">
                {formatBytesToHuman(getTotalStorageUsedBytes(subscriptions))}
              </span>{' '}
              <span className="text-gray-500">{t('taskbar.stats.used')}</span>
            </div>

            <div className="flex flex-row gap-1 items-center justify-center">
              <span className="text-gray-500">
                <LuClock4 className="text-gray-500" />
              </span>
              <span className="text-gray-500">
                {t('taskbar.stats.nextCheckIn')}
              </span>
              <span className="font-bold">{soonestNextRun}</span>
            </div>
          </div>
        )}

        {/* Right: search, sort, subscribe */}
        <div className="flex flex-row gap-2 items-center justify-center">
          {/* Inline search */}
          <div
            ref={searchContainerRef}
            className="flex flex-row items-center gap-1"
          >
            <div
              className={`overflow-hidden transition-all duration-200 ease-in-out ${
                isSearchOpen ? 'max-w-[160px] opacity-100' : 'max-w-0 opacity-0'
              }`}
            >
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('taskbar.search.placeholder')}
                tabIndex={isSearchOpen ? 0 : -1}
                className="text-[12px] border border-gray-300 dark:border-gray-600 rounded-md px-2 py-[3px] w-40 bg-white dark:bg-darkModeCompliment outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={handleSearchToggle}
              title={
                isSearchOpen
                  ? t('taskbar.search.close')
                  : t('taskbar.search.open')
              }
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-darkModeCompliment transition-colors ${
                isSearchOpen || searchQuery
                  ? 'text-primary'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {isSearchOpen ? <FiX size={15} /> : <FiSearch size={15} />}
            </button>
          </div>

          {/* Sort */}
          <button
            onClick={handleSortClick}
            title={activeSortLabel}
            className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-darkModeCompliment transition-colors ${
              isSortActive ? 'text-primary' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {sortDirection === 'desc' ? (
              <TbSortDescendingLetters size={15} />
            ) : (
              <TbSortAscendingLetters size={15} />
            )}
          </button>

          {/* Subscribe */}
          <button
            className="flex items-center justify-center gap-1 bg-primary text-white px-4 py-1 rounded-md text-[12px] hover:opacity-90 dark:hover:opacity-75"
            onClick={() => onOpenSubscribe()}
          >
            <FaPlus />

            <span>{t('taskbar.subscribe')}</span>
          </button>
        </div>
      </div>

      {/* Sort dropdown portal */}
      {sortMenuMounted &&
        createPortal(
          <div
            ref={sortMenuRef}
            style={{
              position: 'fixed',
              top: sortMenuPosition.y,
              left: sortMenuPosition.x,
            }}
            className="bg-white dark:bg-darkModeCompliment rounded-lg shadow-lg py-1 w-[150px] border border-gray-200 dark:border-gray-600 z-50"
          >
            {SORT_OPTIONS.map((option) => {
              const isActive =
                option.field === sortField &&
                option.direction === sortDirection;
              return (
                <button
                  key={`${option.field}-${option.direction}`}
                  onClick={() => handleSortSelect(option)}
                  className={`w-full text-left px-3 py-2 text-[12px] hover:bg-gray-100 dark:hover:bg-darkModeHover ${
                    isActive
                      ? 'bg-gray-100 dark:bg-gray-700 text-primary dark:text-orange-400 font-medium'
                      : 'dark:text-white '
                  }`}
                >
                  {t(option.key)}
                </button>
              );
            })}
          </div>,
          document.body,
        )}

      <ConfirmModal
        isOpen={bulkHistoryDeleteConfirm}
        onClose={() => setBulkHistoryDeleteConfirm(false)}
        onConfirm={() => {
          bulkDeleteHistoryDownloads(selectedHistoryIds);
          setBulkHistoryDeleteConfirm(false);
        }}
        title={(() => {
          if (selectedHistoryIds.length === 1) {
            const [subId, dlId] = selectedHistoryIds[0].split(':');
            const name = subscriptions
              .find((s) => s.id === subId)
              ?.downloads.find((d) => d.id === dlId)?.name;
            return t('taskbar.confirmDelete.singleDownloadTitle', {
              name: name ?? t('nav.history'),
            });
          }
          return t('taskbar.confirmDelete.multiDownloadTitle', {
            count: selectedHistoryIds.length,
          });
        })()}
        confirmLabel={t('taskbar.confirmDelete.confirmLabel')}
        message={t('taskbar.confirmDelete.downloadMessage')}
      />

      <ConfirmModal
        isOpen={bulkSubDeleteConfirm}
        onClose={() => setBulkSubDeleteConfirm(false)}
        onConfirm={async () => {
          const afdaWebsiteIds = new Set(afdaWebsites.map((w) => w.id));
          const regularIds = selectedChannelIds.filter(
            (id) => !afdaWebsiteIds.has(id),
          );
          const afdaIds = selectedChannelIds.filter((id) =>
            afdaWebsiteIds.has(id),
          );
          await Promise.all([
            regularIds.length > 0
              ? bulkDeleteSubscriptions(regularIds).catch(console.error)
              : Promise.resolve(),
            ...afdaIds.map((id) => deleteAfdaWebsite(id, removeWebsite)),
          ]);
          setBulkSubDeleteConfirm(false);
        }}
        title={(() => {
          if (selectedChannelIds.length === 1) {
            const name = scheduledChannels.find(
              (c) => c.channelId === selectedChannelIds[0],
            )?.channelName;
            return t('taskbar.confirmDelete.singleSubscriptionTitle', {
              name: name ?? t('nav.subscription'),
            });
          }
          return t('taskbar.confirmDelete.multiSubscriptionTitle', {
            count: selectedChannelIds.length,
          });
        })()}
        confirmLabel={t('taskbar.confirmDelete.confirmLabel')}
        message={t('taskbar.confirmDelete.subscriptionMessage')}
      />

      {editModalId && (
        <SkedulosaEditModal
          isOpen={true}
          onClose={() => setEditModalId(null)}
          subscriptionId={editModalId}
        />
      )}
    </>
  );
};

export default SkedulosaTableTaskbar;
