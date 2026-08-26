/**
 * Status page table: header + body of download rows.
 * Subscription downloads are grouped into SkedulosaTableGroup accordions;
 * non-subscription downloads render as StatusPageTableRow (unchanged).
 */
import ArticleSidePanelManager from '@/afda/components/ArticleSidePanelManager';
import { ArticleDownloadTableRow } from '@/afda/components/ArticleDownloadTableRow';
import AfdaTableGroup from '@/afda/components/AfdaTableGroup';
import { useAfdaStore } from '@/afda/store/afdaStore';
import type {
  ArticleSearchableDownload,
  SearchableDownload,
} from '@/downlodr/store/taskbarDownloadStore';
import EmptySearch from '@/assets/icon/EmptySearch';

import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import { setInfoFetchPriority } from '@/downlodr/utils/download/infoFetchQueue';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { StatusPageTableHeader } from './StatusPageTableHeader';
import { getMetadataFetchProgress } from './statusPageUtils';
import type { DisplayColumn, SelectableRow } from './statusPageTypes';

import Toolbar from '@/downlodr/components/base/Toolbar';
import SkedulosaTableGroup from '@/skedulosa/components/SkedulosaTableGroup';
import { StatusPageTableRow } from './StatusPageTableRow';
import { useWindowSize } from './statusPageHooks';

/** Selection keys for collapsed group rows, which have no download id of their own. */
const subscriptionRowKey = (subscriptionId: string) =>
  `group:${subscriptionId}`;
const afdaRowKey = (websiteId: string) => `afda-group:${websiteId}`;

export interface StatusPageTableProps {
  allDownloads: SearchableDownload[];
  searchQuery?: string;
  isSearchActive?: boolean;
  displayColumns: DisplayColumn[];
  columns: DisplayColumn[];
  thumbnailDataUrls: Record<string, string>;
  selectedRowIds: string[];
  selectedDownloadId: string | null;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  dragging: { columnId: string; index: number } | null;
  dragOverIndex: number | null;
  onClearSelection: () => void;
  onSelectPage: (pageIds: string[], allPageSelected: boolean) => void;
  onColumnHeaderContextMenu: (e: React.MouseEvent) => void;
  onSortClick: (columnId: string) => void;
  onResizeStart: (columnId: string, clientX: number) => void;
  startDragging: (columnId: string, index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
  cancelDrag: () => void;
  onContextMenu: (e: React.MouseEvent, download: SearchableDownload) => void;
  onRowClick: (downloadId: string) => void;
  /** `orderedRows` is passed on shift-click so the page can select a range. */
  onCheckboxChange: (row: SelectableRow, orderedRows?: SelectableRow[]) => void;
  onViewFile: (downloadLocation?: string, downloadId?: string) => void;
  onViewDownload: (downloadLocation?: string, downloadId?: string) => void;
  onViewFolder: (downloadLocation?: string, filePath?: string) => void;
  onRetry: (downloadId: string) => void;
  onPause: (downloadId: string) => void;
  onStop: (downloadId: string) => void;
  onFinishRecording: (downloadId: string) => void;
  onRedownloadTranscript: (downloadId: string) => void;
  onFormatSelect: (formatData: {
    ext: string;
    formatId: string;
    audioExt?: string;
    audioFormatId?: string;
  }) => void;
  onClosePluginSidebar: () => void;
  onViewEmbed: (download: SearchableDownload) => void;
  isPanelOpen?: boolean;
}

export const StatusPageTable: React.FC<StatusPageTableProps> = ({
  allDownloads,
  searchQuery,
  isSearchActive,
  displayColumns,
  columns,
  thumbnailDataUrls,
  selectedRowIds,
  selectedDownloadId,
  sortColumn,
  sortDirection,
  dragging,
  dragOverIndex,
  onClearSelection,
  onSelectPage,
  onColumnHeaderContextMenu,
  onSortClick,
  onResizeStart,
  startDragging,
  onDragOver,
  onDrop,
  cancelDrag,
  onContextMenu,
  onRowClick,
  onCheckboxChange,
  onViewFile,
  onViewDownload,
  onViewFolder,
  onRetry,
  onPause,
  onStop,
  onFinishRecording,
  onRedownloadTranscript,
  onFormatSelect,
  onClosePluginSidebar,
  onViewEmbed,
  isPanelOpen,
}) => {
  const clearSearch = useTaskbarDownloadStore((s) => s.clearSearch);
  const isArticlePanelOpen = useAfdaStore((s) => s.isOpen);
  const subscriptions = useSkedulosaStore((s) => s.subscriptions);
  const scrapingChannels = useSkedulosaStore((s) => s.scrapingChannels);
  const [pendingCountBySubId, setPendingCountBySubId] = useState<
    Record<string, number>
  >({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { windowHeight } = useWindowSize();
  const PAGE_SIZE = windowHeight >= 1000 ? 20 : windowHeight >= 800 ? 15 : 10;
  const [currentPage, setCurrentPage] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reset to first page when the downloads list changes (e.g. navigating status pages)
  useEffect(() => {
    setCurrentPage(0);
  }, [allDownloads.length, PAGE_SIZE]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleScroll = useCallback(() => {
    setIsScrolling(true);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => setIsScrolling(false), 800);
  }, []);

  useEffect(() => {
    const bridge = window.skedulosaBridge;
    if (!bridge) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      bridge
        .listDownloadTasks('pending')
        .then((tasks) => {
          const typed = tasks as { channel_id: number }[];
          const counts: Record<string, number> = {};
          for (const task of typed) {
            const sub = subscriptions.find(
              (s) => s.toolkit_channel_id === task.channel_id,
            );
            if (sub) counts[sub.id] = (counts[sub.id] ?? 0) + 1;
          }
          setPendingCountBySubId(counts);
        })
        .catch(() => {
          /* silently ignore */
        });
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [allDownloads.length, subscriptions]);

  // Each group (Skedulosa or AFDA) counts as 1 pagination item, not N downloads.
  const allVirtualItems = useMemo(() => {
    type VirtualItem =
      | { type: 'ungrouped'; download: SearchableDownload }
      | {
          type: 'group';
          subscriptionId: string;
          downloads: SearchableDownload[];
        }
      | {
          type: 'afda-group';
          websiteId: string;
          downloads: ArticleSearchableDownload[];
        };

    const subscriptionIds = new Set(subscriptions.map((s) => s.id));
    const skedulosaGroups: Record<string, SearchableDownload[]> = {};
    const afdaGroups: Record<string, ArticleSearchableDownload[]> = {};

    for (const download of allDownloads) {
      const subId = download.subscriptionId;
      if (download.type === 'article' && subId && subId !== 'manual') {
        if (!afdaGroups[subId]) afdaGroups[subId] = [];
        afdaGroups[subId].push(download as ArticleSearchableDownload);
      } else if (subId && subscriptionIds.has(subId)) {
        if (!skedulosaGroups[subId]) skedulosaGroups[subId] = [];
        skedulosaGroups[subId].push(download);
      }
    }

    const items: VirtualItem[] = [];
    const seenGroups = new Set<string>();
    const seenAfdaGroups = new Set<string>();

    for (const download of allDownloads) {
      const subId = download.subscriptionId;
      if (download.type === 'article' && subId && subId !== 'manual') {
        if (!seenAfdaGroups.has(subId)) {
          seenAfdaGroups.add(subId);
          items.push({
            type: 'afda-group',
            websiteId: subId,
            downloads: afdaGroups[subId],
          });
        }
      } else if (!subId || !subscriptionIds.has(subId)) {
        items.push({ type: 'ungrouped', download });
      } else if (!seenGroups.has(subId)) {
        seenGroups.add(subId);
        items.push({
          type: 'group',
          subscriptionId: subId,
          downloads: skedulosaGroups[subId],
        });
      }
    }

    return items;
  }, [allDownloads, subscriptions]);

  const totalPages = Math.ceil(allVirtualItems.length / PAGE_SIZE);
  const pageStart = currentPage * PAGE_SIZE + 1;
  const pageEnd = Math.min(
    (currentPage + 1) * PAGE_SIZE,
    allVirtualItems.length,
  );

  const renderItems = useMemo(() => {
    let ungroupedIndex = currentPage * PAGE_SIZE;
    return allVirtualItems
      .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
      .map((item) => {
        if (item.type === 'ungrouped')
          return { ...item, index: ungroupedIndex++ };
        return item;
      });
  }, [allVirtualItems, currentPage]);

  // The checkable rows on this page, in display order. A collapsed group is
  // one row here — not one row per download inside it — so a shift-click
  // range covers what the user actually sees.
  const pageRows: SelectableRow[] = useMemo(
    () =>
      renderItems.map((item) => {
        if (item.type === 'ungrouped')
          return { key: item.download.id, ids: [item.download.id] };
        const key =
          item.type === 'group'
            ? subscriptionRowKey(item.subscriptionId)
            : afdaRowKey(item.websiteId);
        return { key, ids: item.downloads.map((d) => d.id) };
      }),
    [renderItems],
  );

  const pageRowIds = useMemo(
    () => pageRows.flatMap((row) => row.ids),
    [pageRows],
  );

  // Shift-click needs the on-screen row order, which only this component
  // knows — hand it to the page so it can fill in the range.
  const handleRowCheckboxChange = useCallback(
    (row: SelectableRow, shiftKey?: boolean) => {
      onCheckboxChange(row, shiftKey ? pageRows : undefined);
    },
    [onCheckboxChange, pageRows],
  );

  // Tell the metadata-fetch queue which rows are on screen, so a large playlist
  // resolves the visible page before the pages behind it. Re-runs on every page
  // / sort / filter change, which is what re-aims the queue mid-fetch.
  useEffect(() => {
    setInfoFetchPriority(pageRowIds);
    return () => setInfoFetchPriority([]);
  }, [pageRowIds]);

  const forDownloads = useDownloadStore((s) => s.forDownloads);
  const metadataProgress = useMemo(
    () => getMetadataFetchProgress(forDownloads),
    [forDownloads],
  );

  const handleSelectAll = useCallback(() => {
    const allPageSelected = pageRowIds.every((id) =>
      selectedRowIds.includes(id),
    );
    onSelectPage(pageRowIds, allPageSelected);
  }, [pageRowIds, selectedRowIds, onSelectPage]);

  const PANEL_COLUMNS = ['name', 'size', 'format', 'status'];
  // The article panel is the widest side panel (600px), so it leaves room for
  // the name column only; everything else moves behind the eye tooltip.
  const ARTICLE_PANEL_COLUMNS = ['name'];
  const EYE_COLUMN: DisplayColumn = { id: 'eye', width: 40 };

  // Every side panel — logs, activity, plugin, article — narrows the
  // table the same way: keep a few columns, expose the rest via the eye column.
  const isAnySidePanelOpen =
    isPanelOpen || isArticlePanelOpen;

  const keptColumnIds = isArticlePanelOpen
    ? ARTICLE_PANEL_COLUMNS
    : PANEL_COLUMNS;

  const panelFilteredColumns = isAnySidePanelOpen
    ? displayColumns.filter((c) => keptColumnIds.includes(c.id))
    : displayColumns;

  const hiddenColumnIds = isAnySidePanelOpen
    ? displayColumns
        .filter((c) => !keptColumnIds.includes(c.id))
        .map((c) => c.id)
    : [];

  const effectiveDisplayColumns = isAnySidePanelOpen
    ? [...panelFilteredColumns, EYE_COLUMN]
    : panelFilteredColumns;

  return (
    <div className="flex-grow flex flex-col overflow-hidden bg-white dark:bg-darkModeTable rounded-md group/scrollarea gap-2">
      <Toolbar className="pt-2 pb-1 pr-4 flex-shrink-0" />
      <div className="flex-1 flex flex-row overflow-hidden min-w-0">
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div
            ref={scrollContainerRef}
            className={`${
              isSearchActive && allDownloads.length === 0 && searchQuery
                ? ''
                : 'flex-1'
            } overflow-auto min-w-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:transition-colors [&::-webkit-scrollbar-thumb]:duration-200 group-hover/scrollarea:[&::-webkit-scrollbar-thumb]:bg-gray-300 dark:group-hover/scrollarea:[&::-webkit-scrollbar-thumb]:bg-gray-600 ${
              isScrolling
                ? '[&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600'
                : '[&::-webkit-scrollbar-thumb]:bg-transparent'
            }`}
            onScroll={handleScroll}
          >
            <table className="w-full">
              <StatusPageTableHeader
                displayColumns={effectiveDisplayColumns}
                columns={columns}
                selectedRowIds={selectedRowIds}
                pageRowIds={pageRowIds}
                onClearSelection={onClearSelection}
                pageStart={pageStart}
                pageEnd={pageEnd}
                totalDownloads={allVirtualItems.length}
                totalPages={totalPages}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                dragging={dragging}
                dragOverIndex={dragOverIndex}
                onColumnHeaderContextMenu={onColumnHeaderContextMenu}
                onSelectAll={handleSelectAll}
                onSortClick={onSortClick}
                onResizeStart={onResizeStart}
                startDragging={startDragging}
                onDragOver={onDragOver}
                onDrop={onDrop}
                cancelDrag={cancelDrag}
              />
              <tbody>
                {/* Metadata resolution is still running — show it on every
                    page so a skeleton row reads as "loading", not "stalled". */}
                {/* 
                {metadataProgress && (
                  <tr className="pl-4 border-b-2 dark:border-[#27272ACC] cursor-default bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/10">
                    <td className="w-8 p-2" />
                    <td className="p-2 dark:text-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="animate-spin text-amber-500">⟳</span>
                        <div>
                          <div className="line-clamp-1 font-semibold py-1">
                            Fetching metadata
                          </div>
                          <div className="text-xs text-amber-600 dark:text-amber-400 -mt-1">
                            {metadataProgress.done} of {metadataProgress.total}{' '}
                            ready — items on this page resolve first
                          </div>
                        </div>
                      </div>
                    </td>
                    {effectiveDisplayColumns.map((col) => (
                      <td key={col.id} style={{ width: col.width }} className="p-2" />
                    ))}
                  </tr>
                )}
                  */}
                {/* Render scraping channels at the top */}
                {Array.from(scrapingChannels.entries()).map(
                  ([channelId, scrapeData]) => (
                    <tr
                      key={`scraping-${channelId}`}
                      className="pl-4 border-b-2 dark:border-[#27272ACC] cursor-default bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/10"
                    >
                      <td className="w-8 p-2" />
                      <td className="p-2 dark:text-gray-200">
                        <div className="flex items-center gap-2">
                          <span className="animate-spin text-blue-500">⟳</span>
                          <div>
                            <div className="line-clamp-1 font-semibold py-1">
                              {scrapeData.name}
                            </div>
                            <div className="text-xs text-blue-600 dark:text-blue-400 -mt-1">
                              {scrapeData.status}
                            </div>
                          </div>
                        </div>
                      </td>
                      {effectiveDisplayColumns.map((col) => (
                        <td
                          key={col.id}
                          style={{ width: col.width }}
                          className="p-2"
                        />
                      ))}
                    </tr>
                  ),
                )}
                {renderItems.map((item, rowIndex) => {
                  const row = pageRows[rowIndex];

                  if (item.type === 'afda-group') {
                    return (
                      <AfdaTableGroup
                        key={`afda-group-${item.websiteId}`}
                        websiteId={item.websiteId}
                        downloads={item.downloads}
                        displayColumns={effectiveDisplayColumns}
                        selectedRowIds={selectedRowIds}
                        selectedDownloadId={selectedDownloadId}
                        onRowClick={onRowClick}
                        onGroupCheckboxChange={(shiftKey) =>
                          handleRowCheckboxChange(row, shiftKey)
                        }
                        onClosePluginSidebar={onClosePluginSidebar}
                      />
                    );
                  }

                  if (item.type === 'ungrouped') {
                    if (item.download.type === 'article') {
                      const articleDownload =
                        item.download as ArticleSearchableDownload;
                      return (
                        <ArticleDownloadTableRow
                          key={articleDownload.id}
                          download={articleDownload}
                          displayColumns={effectiveDisplayColumns}
                          isChecked={selectedRowIds.includes(
                            articleDownload.id,
                          )}
                          isSelectedDownload={
                            selectedDownloadId === articleDownload.id
                          }
                          index={item.index}
                          hiddenColumnIds={hiddenColumnIds}
                          onCheckboxChange={(shiftKey) =>
                            handleRowCheckboxChange(row, shiftKey)
                          }
                          onRowClick={() => {
                            onClosePluginSidebar();
                            onRowClick(articleDownload.id);
                          }}
                          onContextMenu={(e) =>
                            onContextMenu(e, articleDownload)
                          }
                        />
                      );
                    }

                    return (
                      <StatusPageTableRow
                        key={item.download.id}
                        download={item.download}
                        displayColumns={effectiveDisplayColumns}
                        thumbnailDataUrls={thumbnailDataUrls}
                        isChecked={selectedRowIds.includes(item.download.id)}
                        isSelectedDownload={
                          selectedDownloadId === item.download.id
                        }
                        index={item.index}
                        hiddenColumnIds={hiddenColumnIds}
                        handlers={{
                          onContextMenu,
                          onRowClick: () => {
                            onClosePluginSidebar();
                            onRowClick(item.download.id);
                          },
                          onCheckboxChange: (shiftKey) =>
                            handleRowCheckboxChange(row, shiftKey),
                          onViewFile: (loc?, id?) => onViewFile(loc, id),
                          onViewDownload: (loc?, id?) =>
                            onViewDownload(loc, id),
                          onViewFolder: (loc?, path?) =>
                            onViewFolder(loc, path),
                          onRetry,
                          onPause,
                          onStop,
                          onFinishRecording,
                          onRedownloadTranscript,
                          onFormatSelect,
                          onViewEmbed,
                        }}
                      />
                    );
                  }

                  return (
                    <SkedulosaTableGroup
                      key={`group-${item.subscriptionId}`}
                      subscriptionId={item.subscriptionId}
                      pendingCount={
                        pendingCountBySubId[item.subscriptionId] ?? 0
                      }
                      downloads={item.downloads}
                      displayColumns={effectiveDisplayColumns}
                      thumbnailDataUrls={thumbnailDataUrls}
                      selectedRowIds={selectedRowIds}
                      selectedDownloadId={selectedDownloadId}
                      onContextMenu={onContextMenu}
                      onRowClick={onRowClick}
                      onViewFile={onViewFile}
                      onViewDownload={onViewDownload}
                      onViewFolder={onViewFolder}
                      onRetry={onRetry}
                      onPause={onPause}
                      onRedownloadTranscript={onRedownloadTranscript}
                      onFormatSelect={onFormatSelect}
                      onClosePluginSidebar={onClosePluginSidebar}
                      onGroupCheckboxChange={(shiftKey) =>
                        handleRowCheckboxChange(row, shiftKey)
                      }
                      onViewEmbed={onViewEmbed}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex-shrink-0 flex items-center justify-center gap-1 px-4 py-1.5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-darkModeTable">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0}
                className="p-1 rounded-md text-gray-500 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-darkModeTableBorder transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <LuChevronLeft size={14} />
              </button>
              <span className="text-xs text-gray-400 dark:text-gray-500 min-w-[80px] text-center">
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
                className="p-1 rounded-md text-gray-500 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-darkModeTableBorder transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <LuChevronRight size={14} />
              </button>
            </div>
          )}
          {isSearchActive && allDownloads.length === 0 && searchQuery && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <EmptySearch className="text-gray-300 dark:text-gray-600" />
              <p className="text-base font-bold text-gray-700 dark:text-gray-200">
                No downloads found
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Nothing matched{' '}
                <span className="font-semibold text-gray-600 dark:text-gray-300">
                  &ldquo;{searchQuery}&rdquo;
                </span>
                .
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 -mt-2">
                Try a different title
              </p>
              <button
                onClick={clearSearch}
                className="mt-1 px-5 py-2 rounded-md bg-[#E8622A] hover:bg-[#d0541e] text-white text-sm font-medium transition-colors"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
        <ArticleSidePanelManager />
      </div>
    </div>
  );
};
