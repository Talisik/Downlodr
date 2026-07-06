# SkedulosaTableGroup Accordion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat subscription-download rows in the status table with a collapsible accordion group row per subscription — one row when collapsed (showing aggregate data), full individual rows when expanded — while leaving non-subscription downloads completely unchanged.

**Architecture:** `StatusPageTable` splits `allDownloads` into ungrouped and grouped-by-subscriptionId buckets using a memoized utility. Ungrouped downloads render as `StatusPageTableRow` (zero changes). Each group renders as `SkedulosaTableGroup`, a self-contained accordion component that reads its `Subscription` from `useSkedulosaStore`, shows a collapsed summary row, and expands to render `StatusPageTableRow` per download. Aggregation helpers live in `src/skedulosa/utils/skedulosaGroupUtils.ts`.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS, react-icons

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `src/skedulosa/utils/skedulosaGroupUtils.ts` | Pure helpers: split, aggregate size, video count, last-updated label |
| **Rewrite** | `src/skedulosa/components/SkedulosaTableGroup.tsx` | Self-contained accordion: collapsed summary row + expanded StatusPageTableRows |
| **Modify** | `src/downlodr/pages/status/StatusPageTable.tsx` | Use memoized split; render groups via SkedulosaTableGroup, ungrouped unchanged |

---

## Task 1: Create `skedulosaGroupUtils.ts`

**Files:**
- Create: `src/skedulosa/utils/skedulosaGroupUtils.ts`

- [ ] **Step 1: Write the file**

```typescript
import { formatRelativeTime } from '@/downlodr/pages/status/statusPageUtils';
import type { SearchableDownload } from '@/downlodr/store/taskbarDownloadStore';

/**
 * Splits a flat downloads array into:
 * - grouped: Record<subscriptionId, downloads[]> for downloads that have a subscriptionId
 * - groupOrder: subscriptionIds in first-seen order (preserves original list position)
 * - ungrouped: downloads with no subscriptionId
 */
export function splitBySubscription(downloads: SearchableDownload[]): {
  grouped: Record<string, SearchableDownload[]>;
  groupOrder: string[];
  ungrouped: SearchableDownload[];
} {
  const grouped: Record<string, SearchableDownload[]> = {};
  const groupOrder: string[] = [];
  const ungrouped: SearchableDownload[] = [];

  for (const download of downloads) {
    const subId = (download as { subscriptionId?: string }).subscriptionId;
    if (subId) {
      if (!grouped[subId]) {
        grouped[subId] = [];
        groupOrder.push(subId);
      }
      grouped[subId].push(download);
    } else {
      ungrouped.push(download);
    }
  }

  return { grouped, groupOrder, ungrouped };
}

/** Sum of all download sizes in bytes. */
export function aggregateGroupSize(downloads: SearchableDownload[]): number {
  return downloads.reduce(
    (sum, d) => sum + ((d as { size?: number }).size ?? 0),
    0,
  );
}

/** Number of downloads in the group. */
export function getGroupVideoCount(downloads: SearchableDownload[]): number {
  return downloads.length;
}

/**
 * Human-readable "last updated" label from a subscription's last_checked_time.
 * Returns "never checked" if the field is empty.
 */
export function getGroupLastUpdated(lastCheckedTime: string): string {
  if (!lastCheckedTime) return 'never checked';
  return formatRelativeTime(lastCheckedTime);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/skedulosa/utils/skedulosaGroupUtils.ts
git commit -m "feat(skedulosa): add skedulosaGroupUtils with split/aggregate helpers"
```

---

## Task 2: Rewrite `SkedulosaTableGroup.tsx` as accordion

**Files:**
- Rewrite: `src/skedulosa/components/SkedulosaTableGroup.tsx`

This component:
- Reads its `Subscription` from `useSkedulosaStore` by `subscriptionId`
- Manages a single `isExpanded` boolean via `useState`
- When **collapsed**: renders one `<tr>` mapping over `displayColumns` with aggregate/subscription data
- When **expanded**: renders the same collapsed `<tr>` + one `StatusPageTableRow` per download

The collapsed `<tr>` checkbox cell shows the expand/collapse chevron (aligned with the checkbox column in `StatusPageTableRow`).

- [ ] **Step 1: Write the file**

```tsx
import { StatusPageTableRow } from '@/downlodr/pages/status/StatusPageTableRow';
import type {
  DisplayColumn,
  FormatSelectData,
} from '@/downlodr/pages/status/statusPageTypes';
import {
  formatFileSize,
  formatRelativeTime,
} from '@/downlodr/pages/status/statusPageUtils';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import {
  aggregateGroupSize,
  getGroupLastUpdated,
  getGroupVideoCount,
} from '@/skedulosa/utils/skedulosaGroupUtils';
import type { SearchableDownload } from '@/downlodr/store/taskbarDownloadStore';
import { getExtractorIcon } from '@/downlodr/utils/icons/iconMapper';
import React, { memo, useMemo, useState } from 'react';
import { FiChevronRight } from 'react-icons/fi';

export interface SkedulosaTableGroupProps {
  subscriptionId: string;
  downloads: SearchableDownload[];
  displayColumns: DisplayColumn[];
  thumbnailDataUrls: Record<string, string>;
  selectedRowIds: string[];
  selectedDownloadId: string | null;
  onContextMenu: (e: React.MouseEvent, download: SearchableDownload) => void;
  onRowClick: (downloadId: string) => void;
  onCheckboxChange: (downloadId: string) => void;
  onViewFile: (location?: string, downloadId?: string) => void;
  onViewDownload: (location?: string, downloadId?: string) => void;
  onViewFolder: (location?: string, filePath?: string) => void;
  onRetry: (downloadId: string) => void;
  onPause: (downloadId: string) => void;
  onRedownloadTranscript: (downloadId: string) => void;
  onFormatSelect: (formatData: FormatSelectData) => void;
  onClosePluginSidebar: () => void;
}

const SkedulosaTableGroup = memo(function SkedulosaTableGroup({
  subscriptionId,
  downloads,
  displayColumns,
  thumbnailDataUrls,
  selectedRowIds,
  selectedDownloadId,
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
}: SkedulosaTableGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const subscription = useSkedulosaStore((state) =>
    state.getSubscription(subscriptionId),
  );

  const aggregatedSize = useMemo(
    () => aggregateGroupSize(downloads),
    [downloads],
  );

  const videoCount = getGroupVideoCount(downloads);

  // Fallback values if the subscription was deleted from the store
  const sourceName = subscription?.source ?? subscriptionId;
  const subStatus = subscription?.status ?? '—';
  const dateCreated = subscription?.date_created ?? '';
  const lastChecked = subscription?.last_checked_time ?? '';

  return (
    <>
      {/* ── Collapsed summary row ── */}
      <tr
        className="border-b-2 dark:border-[#27272ACC] bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/30 cursor-pointer select-none"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        {/* Chevron cell — aligned with the checkbox column in StatusPageTableRow */}
        <td className="w-8 p-2">
          <FiChevronRight
            size={16}
            className={`ml-2 mt-1 transition-transform duration-200 text-orange-500 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
        </td>

        {displayColumns.map((column) => {
          switch (column.id) {
            case 'name':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="p-2 dark:text-gray-200 flex justify-start items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold line-clamp-1 break-all">
                      {sourceName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {videoCount} {videoCount === 1 ? 'video' : 'videos'}
                      {lastChecked
                        ? ` · updated ${getGroupLastUpdated(lastChecked)}`
                        : ''}
                    </div>
                  </div>
                </td>
              );

            case 'size':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="px-2 py-2 dark:text-gray-200 text-left"
                >
                  <span className="whitespace-nowrap overflow-hidden">
                    {formatFileSize(aggregatedSize)}
                  </span>
                </td>
              );

            case 'format':
              return (
                <td
                  key={column.id}
                  style={{ width: Math.max(column.width), minWidth: '70px' }}
                  className="p-2 text-center align-middle"
                >
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Format
                  </span>
                </td>
              );

            case 'status':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width - 10 }}
                  className="p-1"
                >
                  <div className="flex justify-center">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {subStatus}
                    </span>
                  </div>
                </td>
              );

            case 'speed':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="pl-2 py-2 dark:text-gray-200 flex justify-center items-center"
                >
                  <span>—</span>
                </td>
              );

            case 'dateAdded':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="p-2 dark:text-gray-200 text-center"
                >
                  <div>
                    {dateCreated ? formatRelativeTime(dateCreated) : '—'}
                  </div>
                </td>
              );

            case 'transcript':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="dark:text-gray-200"
                />
              );

            case 'source':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="p-2 dark:text-gray-200"
                >
                  <div className="flex justify-center items-center text-lg">
                    {getExtractorIcon('youtube')}
                  </div>
                </td>
              );

            case 'action':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="p-2 dark:text-gray-200 text-center"
                />
              );

            default:
              return null;
          }
        })}
      </tr>

      {/* ── Expanded individual download rows ── */}
      {isExpanded &&
        downloads.map((download, index) => (
          <StatusPageTableRow
            key={download.id}
            download={download}
            displayColumns={displayColumns}
            thumbnailDataUrls={thumbnailDataUrls}
            isChecked={selectedRowIds.includes(download.id)}
            isSelectedDownload={selectedDownloadId === download.id}
            index={index}
            handlers={{
              onContextMenu,
              onRowClick: () => {
                onClosePluginSidebar();
                onRowClick(download.id);
              },
              onCheckboxChange: () => onCheckboxChange(download.id),
              onViewFile,
              onViewDownload,
              onViewFolder,
              onRetry,
              onPause,
              onRedownloadTranscript,
              onFormatSelect,
            }}
          />
        ))}
    </>
  );
});

export default SkedulosaTableGroup;
```

- [ ] **Step 2: Commit**

```bash
git add src/skedulosa/components/SkedulosaTableGroup.tsx
git commit -m "feat(skedulosa): rewrite SkedulosaTableGroup as collapsible accordion"
```

---

## Task 3: Update `StatusPageTable.tsx`

**Files:**
- Modify: `src/downlodr/pages/status/StatusPageTable.tsx`

Replace the IIFE-based grouping with a clean `useMemo` split. Ungrouped downloads render as `StatusPageTableRow` (identical to before). Grouped downloads render as `SkedulosaTableGroup`. Render order preserves the position of the first download in each group relative to the ungrouped list — i.e. if a group's first download appeared at index 3 in the original array, the group row appears at that same position.

- [ ] **Step 1: Replace the file content**

Replace the full content of `src/downlodr/pages/status/StatusPageTable.tsx` with:

```tsx
/**
 * Status page table: header + body of download rows.
 * Subscription downloads are grouped into SkedulosaTableGroup accordions;
 * non-subscription downloads render as StatusPageTableRow (unchanged).
 */
import type { SearchableDownload } from '@/downlodr/store/taskbarDownloadStore';
import React, { useMemo } from 'react';
import { StatusPageTableHeader } from './StatusPageTableHeader';
import type { DisplayColumn } from './statusPageTypes';

import Toolbar from '@/downlodr/components/base/Toolbar';
import SkedulosaTableGroup from '@/skedulosa/components/SkedulosaTableGroup';
import { splitBySubscription } from '@/skedulosa/utils/skedulosaGroupUtils';
import { StatusPageTableRow } from './StatusPageTableRow';

export interface StatusPageTableProps {
  allDownloads: SearchableDownload[];
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
}

export const StatusPageTable: React.FC<StatusPageTableProps> = ({
  allDownloads,
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
}) => {
  // Split once per render; groups preserve insertion order of first download.
  const { grouped, groupOrder, ungrouped } = useMemo(
    () => splitBySubscription(allDownloads),
    [allDownloads],
  );

  // Build a render list that interleaves groups and ungrouped rows in their
  // original list positions (group appears where its first download was).
  const renderItems = useMemo(() => {
    type RenderItem =
      | { type: 'ungrouped'; download: SearchableDownload; index: number }
      | { type: 'group'; subscriptionId: string };

    const items: RenderItem[] = [];
    const seenGroups = new Set<string>();
    let ungroupedIndex = 0;

    for (const download of allDownloads) {
      const subId = (download as { subscriptionId?: string }).subscriptionId;
      if (!subId) {
        items.push({ type: 'ungrouped', download, index: ungroupedIndex++ });
      } else if (!seenGroups.has(subId)) {
        seenGroups.add(subId);
        items.push({ type: 'group', subscriptionId: subId });
      }
    }

    return items;
  }, [allDownloads]);

  return (
    <div className="flex-grow overflow-auto relative bg-white dark:bg-darkMode rounded-b-md">
      <Toolbar className="pt-2 pb-1 pr-4" />
      <div className="min-w-full">
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
            {renderItems.map((item) => {
              if (item.type === 'ungrouped') {
                return (
                  <StatusPageTableRow
                    key={item.download.id}
                    download={item.download}
                    displayColumns={displayColumns}
                    thumbnailDataUrls={thumbnailDataUrls}
                    isChecked={selectedRowIds.includes(item.download.id)}
                    isSelectedDownload={selectedDownloadId === item.download.id}
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
                      onViewDownload: (loc?, id?) => onViewDownload(loc, id),
                      onViewFolder: (loc?, path?) => onViewFolder(loc, path),
                      onRetry,
                      onPause,
                      onRedownloadTranscript,
                      onFormatSelect,
                    }}
                  />
                );
              }

              return (
                <SkedulosaTableGroup
                  key={`group-${item.subscriptionId}`}
                  subscriptionId={item.subscriptionId}
                  downloads={grouped[item.subscriptionId]}
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
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/downlodr/pages/status/StatusPageTable.tsx
git commit -m "feat(status): group subscription downloads into SkedulosaTableGroup accordions"
```

---

## Self-Review Checklist

- **Spec coverage:**
  - ✅ Collapsed row: subscription name, video count, last updated, combined size, dummy format/status, date_created, empty transcript, YouTube source
  - ✅ Expanded: full `StatusPageTableRow` per download with all interactions
  - ✅ Non-subscription rows: completely unchanged (same component, same props)
  - ✅ One group row per unique subscriptionId
  - ✅ Interaction handlers (retry, pause, view file, format select) passed through to expanded rows
  - ✅ Utilities in `src/skedulosa/utils/`
  - ✅ Performance: `useMemo` on splits, `React.memo` on group component, minimal store selector

- **No placeholders:** All code is complete and runnable.

- **Type consistency:** `SkedulosaTableGroupProps` uses `FormatSelectData` from statusPageTypes; `StatusPageTable` passes `onFormatSelect` with the same inline shape — these match because `FormatSelectData` is `{ ext, formatId, audioExt?, audioFormatId? }` which equals the inline type in `StatusPageTableProps`.
