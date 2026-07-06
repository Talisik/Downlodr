/**
 * Table header row for the Status page: checkbox, resizable column headers with sort.
 */
import ResizableHeader from '@/downlodr/components/download/resizableColumns/ResizableHeader';
import { getColumnDisplayName } from '@/downlodr/pages/status/statusPageUtils';
import React from 'react';
import { HiChevronUpDown } from 'react-icons/hi2';
import type { DisplayColumn } from './statusPageTypes';

interface StatusPageTableHeaderProps {
  displayColumns: DisplayColumn[];
  columns: DisplayColumn[];
  selectedRowIds: string[];
  pageRowIds: string[];
  onClearSelection: () => void;
  pageStart?: number;
  pageEnd?: number;
  totalDownloads?: number;
  totalPages?: number;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  dragging: { columnId: string; index: number } | null;
  dragOverIndex: number | null;
  onColumnHeaderContextMenu: (e: React.MouseEvent) => void;
  onSelectAll: () => void;
  onSortClick: (columnId: string) => void;
  onResizeStart: (columnId: string, clientX: number) => void;
  startDragging: (columnId: string, index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
  cancelDrag: () => void;
}

const renderSortIndicator = (
  sortColumn: string,
  sortDirection: 'asc' | 'desc',
  columnId: string,
) => {
  if (sortColumn !== columnId) {
    return (
      <HiChevronUpDown size={14} className="flex-shrink-0 dark:text-gray-400" />
    );
  }
  if (sortDirection === 'asc') {
    return <HiChevronUpDown size={14} className="flex-shrink-0 rotate-180" />;
  }
  return <HiChevronUpDown size={14} className="flex-shrink-0" />;
};

export const StatusPageTableHeader: React.FC<StatusPageTableHeaderProps> = ({
  displayColumns,
  columns,
  selectedRowIds,
  pageRowIds,
  onClearSelection,
  pageStart,
  pageEnd,
  totalDownloads,
  totalPages,
  sortColumn,
  sortDirection,
  dragging,
  dragOverIndex,
  onColumnHeaderContextMenu,
  onSelectAll,
  onSortClick,
  onResizeStart,
  startDragging,
  onDragOver,
  onDrop,
  cancelDrag,
}) => (
  <thead className="sticky top-0 z-20 bg-white dark:bg-darkModeTable border-b hover:bg-gray-50 dark:border-darkModeTableBorder">
    <tr className="text-left" onContextMenu={onColumnHeaderContextMenu}>
      <th className="w-6 px-2 py-1">
        <input
          type="checkbox"
          className="mt-2 ml-2 rounded custom-white-checkmark"
          style={{
            ...(document.documentElement.classList.contains('dark') && {
              backgroundColor: '#272727',
              borderColor: '#6b7280',
            }),
          }}
          checked={
            pageRowIds.length > 0 &&
            pageRowIds.every((id) => selectedRowIds.includes(id))
          }
          ref={(el) => {
            if (el) {
              el.indeterminate =
                pageRowIds.some((id) => selectedRowIds.includes(id)) &&
                !pageRowIds.every((id) => selectedRowIds.includes(id));
            }
          }}
          onChange={onSelectAll}
        />
      </th>
      {displayColumns.map((column, displayIndex) => {
        if (column.id === 'end') {
          return <th key={column.id} className="w-18 p-2"></th>;
        }
        if (column.id === 'eye') {
          return <th key={column.id} className="w-10 p-2" />;
        }
        const originalIndex = columns.findIndex((col) => col.id === column.id);
        return (
          <ResizableHeader
            key={column.id}
            width={column.width}
            onResizeStart={(e) => onResizeStart(column.id, e.clientX)}
            index={originalIndex}
            onDragStart={startDragging}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={cancelDrag}
            isDragging={dragging?.columnId === column.id}
            isDragOver={dragOverIndex === originalIndex}
            columnId={column.id}
            isLastColumn={displayIndex === displayColumns.length - 1}
          >
            <div
              className="flex items-center justify-between w-full cursor-pointer whitespace-nowrap px-2"
              onClick={() => onSortClick(column.id)}
            >
              <span className="flex items-center gap-[0.5px]">
                {getColumnDisplayName(column.id)}
                {renderSortIndicator(sortColumn, sortDirection, column.id)}
                {column.id === 'name' && selectedRowIds.length > 0 && (
                  <span className="text-xs">
                    ({selectedRowIds.length}{' '}
                    {selectedRowIds.length === 1 ? 'item' : 'items'} selected)
                  </span>
                )}
              </span>
              {column.id === 'name' &&
                totalPages !== undefined &&
                totalPages > 1 && (
                  <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                    Viewing {pageStart}–{pageEnd} of {totalDownloads}
                  </span>
                )}
            </div>
          </ResizableHeader>
        );
      })}
    </tr>
    <tr className="pointer-events-none">
      <th
        colSpan={999}
        className="p-0 h-[1px] bg-gray-200 dark:bg-darkModeCompliment"
      />
    </tr>
  </thead>
);
