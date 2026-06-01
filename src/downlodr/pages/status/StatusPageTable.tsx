/**
 * Status page table: header + body of download rows.
 * Subscription downloads are grouped into SkedulosaTableGroup accordions;
 * non-subscription downloads render as StatusPageTableRow (unchanged).
 */
import ArticleSidePanelManager from '@/afda/components/ArticleSidePanelManager';
import EmptySearch from '@/assets/icon/EmptySearch';
import type { SearchableDownload } from '@/downlodr/store/taskbarDownloadStore';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StatusPageTableHeader } from './StatusPageTableHeader';
import type { DisplayColumn } from './statusPageTypes';

import Toolbar from '@/downlodr/components/base/Toolbar';
import SkedulosaTableGroup from '@/skedulosa/components/SkedulosaTableGroup';
import { splitBySubscription } from '@/skedulosa/utils/skedulosaGroupUtils';
import { StatusPageTableRow } from './StatusPageTableRow';

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
  getSelectedWithStatusCount: () => number;
  onColumnHeaderContextMenu: (e: React.MouseEvent) => void;
  onSelectAll: () => void;
  onSortClick: (columnId: string) => void;
  onResizeStart: (columnId: string, clientX: number) => void;
  startDragging: (columnId: string, index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
  cancelDrag: () => void;
  onContextMenu: (e: React.MouseEvent, download: SearchableDownload) => void;
  onRowClick: (downloadId: string) => void;
  onCheckboxChange: (downloadId: string) => void;
  onViewFile: (downloadLocation?: string, downloadId?: string) => void;
  onViewDownload: (downloadLocation?: string, downloadId?: string) => void;
  onViewFolder: (downloadLocation?: string, filePath?: string) => void;
  onRetry: (downloadId: string) => void;
  onPause: (downloadId: string) => void;
  onRedownloadTranscript: (downloadId: string) => void;
  onFormatSelect: (formatData: {
    ext: string;
    formatId: string;
    audioExt?: string;
    audioFormatId?: string;
  }) => void;
  onClosePluginSidebar: () => void;
  onGroupCheckboxChange: (downloadIds: string[]) => void;
  onViewEmbed: (download: SearchableDownload) => void;
  videoPlayerPanel?: React.ReactNode;
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
  getSelectedWithStatusCount,
  onColumnHeaderContextMenu,
  onSelectAll,
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
  onRedownloadTranscript,
  onFormatSelect,
  onClosePluginSidebar,
  onGroupCheckboxChange,
  onViewEmbed,
  videoPlayerPanel,
}) => {
  const clearSearch = useTaskbarDownloadStore((s) => s.clearSearch);
  const subscriptions = useSkedulosaStore((s) => s.subscriptions);
  const scrapingChannels = useSkedulosaStore((s) => s.scrapingChannels);
  const [pendingCountBySubId, setPendingCountBySubId] = useState<
    Record<string, number>
  >({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Split once per allDownloads change; groups preserve insertion order of first download.
  const { grouped } = useMemo(
    () => splitBySubscription(allDownloads),
    [allDownloads],
  );

  // Build render list that interleaves groups and ungrouped rows in their
  // original list positions (group appears where its first download was).
  const renderItems = useMemo(() => {
    type RenderItem =
      | { type: 'ungrouped'; download: SearchableDownload; index: number }
      | { type: 'group'; subscriptionId: string };

    const subscriptionIds = new Set(subscriptions.map((s) => s.id));
    const items: RenderItem[] = [];
    const seenGroups = new Set<string>();
    let ungroupedIndex = 0;

    for (const download of allDownloads) {
      const subId = download.subscriptionId;
      if (!subId || !subscriptionIds.has(subId)) {
        items.push({ type: 'ungrouped', download, index: ungroupedIndex++ });
      } else if (!seenGroups.has(subId)) {
        seenGroups.add(subId);
        items.push({ type: 'group', subscriptionId: subId });
      }
    }

    return items;
  }, [allDownloads, subscriptions]);

  return (
    <div className="flex-grow flex flex-col overflow-hidden bg-white dark:bg-darkMode rounded-b-md group/scrollarea">
      <Toolbar className="pt-2 pb-1 pr-4 flex-shrink-0" />
      <div className="flex-1 flex flex-row overflow-hidden min-w-0">
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div
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
                displayColumns={displayColumns}
                columns={columns}
                selectedRowIdsLength={selectedRowIds.length}
                allDownloadsLength={allDownloads.length}
                getSelectedWithStatusCount={getSelectedWithStatusCount}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                dragging={dragging}
                dragOverIndex={dragOverIndex}
                onColumnHeaderContextMenu={onColumnHeaderContextMenu}
                onSelectAll={onSelectAll}
                onSortClick={onSortClick}
                onResizeStart={onResizeStart}
                startDragging={startDragging}
                onDragOver={onDragOver}
                onDrop={onDrop}
                cancelDrag={cancelDrag}
              />
              <tbody>
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
                      {displayColumns.map((col) => (
                        <td
                          key={col.id}
                          style={{ width: col.width }}
                          className="p-2"
                        />
                      ))}
                    </tr>
                  ),
                )}
                {renderItems.map((item) => {
                  if (item.type === 'ungrouped') {
                    return (
                      <StatusPageTableRow
                        key={item.download.id}
                        download={item.download}
                        displayColumns={displayColumns}
                        thumbnailDataUrls={thumbnailDataUrls}
                        isChecked={selectedRowIds.includes(item.download.id)}
                        isSelectedDownload={
                          selectedDownloadId === item.download.id
                        }
                        index={item.index}
                        handlers={{
                          onContextMenu,
                          onRowClick: () => {
                            onClosePluginSidebar();
                            onRowClick(item.download.id);
                          },
                          onCheckboxChange: () =>
                            onCheckboxChange(item.download.id),
                          onViewFile: (loc?, id?) => onViewFile(loc, id),
                          onViewDownload: (loc?, id?) =>
                            onViewDownload(loc, id),
                          onViewFolder: (loc?, path?) =>
                            onViewFolder(loc, path),
                          onRetry,
                          onPause,
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
                      downloads={grouped[item.subscriptionId] ?? []}
                      displayColumns={displayColumns}
                      thumbnailDataUrls={thumbnailDataUrls}
                      selectedRowIds={selectedRowIds}
                      selectedDownloadId={selectedDownloadId}
                      onContextMenu={onContextMenu}
                      onRowClick={onRowClick}
                      onCheckboxChange={onCheckboxChange}
                      onViewFile={onViewFile}
                      onViewDownload={onViewDownload}
                      onViewFolder={onViewFolder}
                      onRetry={onRetry}
                      onPause={onPause}
                      onRedownloadTranscript={onRedownloadTranscript}
                      onFormatSelect={onFormatSelect}
                      onClosePluginSidebar={onClosePluginSidebar}
                      onGroupCheckboxChange={onGroupCheckboxChange}
                      onViewEmbed={onViewEmbed}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
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
        {videoPlayerPanel}
      </div>
    </div>
  );
};
