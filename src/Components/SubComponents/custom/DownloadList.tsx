/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A custom React component
 * A React component that displays a list of downloads in a table format.
 * It allows users to view download details and manage downloads through a context menu.
 *
 * @param DownloadListProps
 *   @param downloads - An array of download objects to display in the list.
 *
 * @returns JSX.Element - The rendered download list component.
 */

import React, { useEffect, useRef, useState } from 'react';
import { LuDownload, LuArrowDown, LuArrowUp } from 'react-icons/lu';
import { HiChevronUpDown } from 'react-icons/hi2';
import { FaPlay } from 'react-icons/fa';
import useDownloadStore, { BaseDownload } from '../../../Store/downloadStore';
import DownloadContextMenu from './DownloadContextMenu';
import { toast } from '../shadcn/hooks/use-toast';
import ResizableHeader from './ResizableColumns/ResizableHeader';
import { useResizableColumns } from './ResizableColumns/useResizableColumns';
import { Skeleton } from '../shadcn/components/ui/skeleton';
import { useMainStore } from '../../../Store/mainStore';
import ColumnHeaderContextMenu from './ColumnHeaderContextMenu';

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMilliseconds = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInWeeks = Math.floor(diffInDays / 7);
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInDays / 365);

  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  } else if (diffInWeeks < 4) {
    return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
  } else if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
  } else {
    return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'} ago`;
  }
};

// Interface representing the props for the DownloadList component
interface DownloadListProps {
  downloads: BaseDownload[];
}

const DownloadList: React.FC<DownloadListProps> = ({ downloads }) => {
  const [contextMenu, setContextMenu] = useState<{
    downloadId: string; // Unique identifier for the download
    x: number; // X coordinate for context menu position
    y: number; // Y coordinate for context menu position
    downloadLocation?: string; // Location of the download file
    controllerId?: string; // ID of the controller managing the download
  } | null>(null);
  const [selectedDownloadId, setSelectedDownloadId] = useState<string | null>(
    null,
  );
  const listRef = useRef<HTMLDivElement>(null);
  // Access download store functions
  const addTag = useDownloadStore((state) => state.addTag);
  const removeTag = useDownloadStore((state) => state.removeTag);
  const addCategory = useDownloadStore((state) => state.addCategory);
  const removeCategory = useDownloadStore((state) => state.removeCategory);
  const deleteDownload = useDownloadStore((state) => state.deleteDownload);
  const availableTags = useDownloadStore((state) => state.availableTags);
  const availableCategories = useDownloadStore(
    (state) => state.availableCategories,
  );

  // Initialize resizable columns - excluding checkbox
  const initialColumns = [
    { id: 'title', width: 250, minWidth: 100 },
    { id: 'size', width: 100, minWidth: 80 },
    { id: 'format', width: 100, minWidth: 80 },
    { id: 'status', width: 120, minWidth: 90 },
    { id: 'tags', width: 150, minWidth: 100 },
    { id: 'categories', width: 150, minWidth: 100 },
    { id: 'source', width: 150, minWidth: 80 },
  ];

  const {
    columns,
    startResizing,
    startDragging,
    handleDragOver,
    handleDrop,
    dragging,
    dragOverIndex,
  } = useResizableColumns(initialColumns);
  // Remove duplicate downloads based on ID
  const uniqueDownloads = [
    ...new Map(downloads.map((item) => [item.id, item])).values(),
  ];
  // Add a debug state to track dragging status more visibly
  const [debugDrag, setDebugDrag] = useState<string>('');

  // Add sort state
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'ascending' | 'descending';
  }>({
    key: null,
    direction: 'ascending',
  });

  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [columnHeaderContextMenu, setColumnHeaderContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
  });

  // Get visible columns from the store
  const visibleColumns = useMainStore((state) => state.visibleColumns);

  // Column options with display names (matching AllDownloads)
  const columnOptions = [
    { id: 'title', displayName: 'Title' },
    { id: 'size', displayName: 'Size' },
    { id: 'format', displayName: 'Format' },
    { id: 'status', displayName: 'Status' },
    { id: 'tags', displayName: 'Tags' },
    { id: 'categories', displayName: 'Categories' },
    { id: 'source', displayName: 'Source' },
  ];

  // Filter columns based on visibility settings, ensuring essential columns are always included
  const displayColumns = React.useMemo(() => {
    return columns.filter(
      (column) =>
        visibleColumns.includes(column.id) ||
        ['title', 'status', 'format'].includes(column.id),
    );
  }, [columns, visibleColumns]);

  // Function to get formatted file size
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Function to get status color
  // color themes
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'downloading':
        return '#2196F3'; // Blue
      case 'finished':
        return '#34C759'; // Green
      case 'failed':
        return '#E74C3C'; // Red
      case 'cancelled':
        return '#E74C3C'; // Red
      case 'initializing':
        return '#3498DB'; // Blue
      case 'paused':
        return '#FFEB3B'; // Yellow
      case 'to download':
        return '#FF9800'; // Orange (same as initializing)
      case 'fetching metadata':
        return 'currentColor'; // Use default text color
      default:
        return 'currentColor'; // Default color
    }
  };

  // Sort the downloads
  const sortedDownloads = React.useMemo(() => {
    // Create a copy of the uniqueDownloads array to avoid mutating the original
    const sortableItems = [...uniqueDownloads];

    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        // Helper function to get the value for sorting
        const getSortValue = (item: BaseDownload, key: string) => {
          switch (key) {
            case 'title':
              return item.name.toLowerCase();
            case 'size':
              return item.size;
            case 'format':
              return item.ext?.toLowerCase() || '';
            case 'status':
              return item.status?.toLowerCase() || '';
            case 'tags':
              return (item.tags && item.tags.length) || 0;
            case 'categories':
              return (item.category && item.category.length) || 0;
            case 'source':
              return (item.extractorKey || 'YouTube').toLowerCase();
            default:
              return '';
          }
        };

        const valueA = getSortValue(a, sortConfig.key);
        const valueB = getSortValue(b, sortConfig.key);

        if (valueA < valueB) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valueA > valueB) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return sortableItems;
  }, [uniqueDownloads, sortConfig]);

  // All downloads for display, filtered by uniqueness
  const allDownloads = React.useMemo(() => {
    return sortedDownloads;
  }, [sortedDownloads]);

  // Handlers for row interactions
  const handleRowClick = (downloadId: string) => {
    setSelectedDownloadId(
      downloadId === selectedDownloadId ? null : downloadId,
    );
    setExpandedRowId(downloadId === expandedRowId ? null : downloadId);
  };

  const handleCheckboxChange = (downloadId: string) => {
    setSelectedRowIds((prev) =>
      prev.includes(downloadId)
        ? prev.filter((id) => id !== downloadId)
        : [...prev, downloadId],
    );
  };

  const handleSelectAll = () => {
    if (selectedRowIds.length === allDownloads.length) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(allDownloads.map((d) => d.id));
    }
  };

  // Handlers for column operations
  const handleColumnHeaderContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setColumnHeaderContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleCloseColumnHeaderContextMenu = () => {
    setColumnHeaderContextMenu({
      ...columnHeaderContextMenu,
      visible: false,
    });
  };

  // Handle toggling column visibility
  const handleToggleColumn = (columnId: string) => {
    const newVisibleColumns = visibleColumns.includes(columnId)
      ? visibleColumns.filter((id) => id !== columnId)
      : [...visibleColumns, columnId];

    useMainStore.getState().setVisibleColumns(newVisibleColumns);
  };

  // Handle sorting indicators
  const renderSortIndicator = (columnId: string) => {
    if (sortConfig.key !== columnId) {
      return <HiChevronUpDown className="ml-1" />;
    }

    return sortConfig.direction === 'ascending' ? (
      <LuArrowUp className="ml-1" />
    ) : (
      <LuArrowDown className="ml-1" />
    );
  };

  // Handle column sort clicks
  const handleSortClick = (columnId: string) => {
    requestSort(columnId);
  };

  // Function to get column display name
  const getColumnDisplayName = (columnId: string): string => {
    const column = columnOptions.find((col) => col.id === columnId);
    return (
      column?.displayName ||
      columnId.charAt(0).toUpperCase() + columnId.slice(1)
    );
  };

  // Format selector component
  const FormatSelector = ({
    download,
    onFormatSelect,
  }: {
    download: BaseDownload;
    onFormatSelect: (formatData: any) => void;
  }) => {
    // Simple format display for now
    return <div className="text-sm py-1 px-2">{download.ext || 'mp4'}</div>;
  };

  // Expanded row component
  const ExpandedDownloadDetails = ({
    download,
  }: {
    download: BaseDownload;
  }) => {
    return (
      <tr className="bg-gray-50 dark:bg-gray-800">
        <td colSpan={visibleColumns.length + 1} className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Download Details</h3>
              <p>
                <span className="font-medium">URL:</span> {download.videoUrl}
              </p>
              <p>
                <span className="font-medium">Location:</span>{' '}
                {download.location}
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Tags & Categories</h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {download.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-blue-100 dark:bg-blue-800 rounded-full text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {download.category?.map((category) => (
                  <span
                    key={category}
                    className="px-2 py-1 bg-green-100 dark:bg-green-800 rounded-full text-xs"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  // Transform your column options to match the expected interface
  const columnMenuOptions = columnOptions.map((option) => ({
    id: option.id,
    label: option.displayName, // Note: change displayName to label to match the interface
    required: ['title', 'status', 'format'].includes(option.id), // Required columns
  }));

  // Effect to handle clicks outside the list to close context menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close download context menu when clicking outside
      if (listRef.current && !listRef.current.contains(event.target as Node)) {
        setContextMenu(null);
        setSelectedDownloadId(null);
      }

      // Close column header context menu when clicking outside
      if (columnHeaderContextMenu.visible) {
        // Check if the click was not on the column header context menu
        const menuElement = document.querySelector(
          '.column-header-context-menu',
        );
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setColumnHeaderContextMenu({
            ...columnHeaderContextMenu,
            visible: false,
          });
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [columnHeaderContextMenu.visible]);

  /**
   * Handles the context menu event for a download.
   *
   * @param event - The mouse event triggered by right-clicking on a download.
   * @param download - The download object associated with the context menu.
   */
  const handleContextMenu = (
    event: React.MouseEvent,
    download: BaseDownload,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      downloadId: download.id,
      x: event.clientX,
      y: event.clientY,
      downloadLocation: `${download.location}${download.name}`,
      controllerId: download.controllerId,
    });
    setSelectedDownloadId(download.id);
  };

  // Handles the removal of a download.
  //downloadLocation - The location of the download file.
  //downloadId - The ID of the download to remove.
  const handleRemove = async (
    downloadLocation?: string,
    downloadId?: string,
  ) => {
    if (!downloadLocation || !downloadId) return;
    try {
      const success = await window.downlodrFunctions.deleteFile(
        downloadLocation,
      );
      if (success) {
        deleteDownload(downloadId);
        setContextMenu(null);
        toast({
          variant: 'success',
          title: 'File Deleted',
          description: 'File has been deleted successfully',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: 'Failed to delete file',
        duration: 3000,
      });
    }
  };
  // Handles viewing a download.
  // downloadLocation - The location of the download file.
  const handleViewDownload = (downloadLocation?: string) => {
    if (downloadLocation) {
      window.downlodrFunctions.openVideo(downloadLocation);
    }
    setContextMenu(null);
  };
  // Handles viewing the folder containing the download.
  // downloadLocation - The location of the download file.
  const handleViewFolder = (downloadLocation?: string, filePath?: string) => {
    if (downloadLocation) {
      window.downlodrFunctions.openFolder(downloadLocation, filePath);
    }
    // Always close the context menu after clicking
    setContextMenu(null);
  };

  // Enhance drag handlers with better visual cues
  const enhancedStartDragging = (columnId: string, index: number) => {
    startDragging(columnId, index);
    setDebugDrag(`Dragging: ${columnId}`);
    // Add a class to the body for global drag state
    document.body.classList.add('column-dragging');
  };

  const enhancedHandleDrop = () => {
    handleDrop();
    setDebugDrag('');
    document.body.classList.remove('column-dragging');
  };

  const enhancedHandleDragOver = (index: number) => {
    handleDragOver(index);
    setDebugDrag(`Dragging over: ${index}`);
  };

  // Add effect to cleanup drag state if dragging is interrupted
  useEffect(() => {
    const handleDragEnd = () => {
      setDebugDrag('');
      document.body.classList.remove('column-dragging');
    };

    document.addEventListener('dragend', handleDragEnd);
    return () => {
      document.removeEventListener('dragend', handleDragEnd);
      document.body.classList.remove('column-dragging');
    };
  }, []);

  // Function to handle sort request
  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';

    // If already sorting by this key, toggle direction
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }

    setSortConfig({ key, direction });
  };

  return (
    <div className="w-full">
      <table className="w-full">
        <thead>
          <tr
            className="border-b text-left dark:border-white"
            onContextMenu={handleColumnHeaderContextMenu}
          >
            <th className="w-8 p-2">
              <input
                type="checkbox"
                className="ml-2 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
                checked={selectedRowIds.length === allDownloads.length}
                onChange={handleSelectAll}
              />
            </th>
            {displayColumns.map((column, displayIndex) => (
              <ResizableHeader
                key={column.id}
                width={column.width}
                onResizeStart={(e) => startResizing(column.id, e.clientX)}
                index={columns.findIndex((col) => col.id === column.id)}
                onDragStart={(columnId, index) =>
                  enhancedStartDragging(columnId, index)
                }
                onDragOver={enhancedHandleDragOver}
                onDrop={enhancedHandleDrop}
                isDragging={dragging?.columnId === column.id}
                isDragOver={
                  dragOverIndex ===
                  columns.findIndex((col) => col.id === column.id)
                }
                columnId={column.id}
                isLastColumn={displayIndex === displayColumns.length - 1}
              >
                <div
                  className="flex items-center cursor-pointer"
                  onClick={() => handleSortClick(column.id)}
                >
                  {getColumnDisplayName(column.id)}
                  {renderSortIndicator(column.id)}
                </div>
              </ResizableHeader>
            ))}
          </tr>
        </thead>
        <tbody>
          {allDownloads.map((download) => (
            <React.Fragment key={download.id}>
              <tr
                className={`border-b hover:bg-gray-50 dark:border-white dark:hover:bg-gray-700 cursor-pointer ${
                  selectedDownloadId === download.id
                    ? 'bg-blue-50 dark:bg-gray-600'
                    : 'dark:bg-darkMode'
                }`}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('downloadId', download.id);
                  const dragIcon = document.createElement('div');
                  dragIcon.className = 'bg-white p-2 rounded shadow';
                  dragIcon.textContent = download.name;
                  document.body.appendChild(dragIcon);
                  e.dataTransfer.setDragImage(dragIcon, 0, 0);
                  setTimeout(() => document.body.removeChild(dragIcon), 0);
                }}
              >
                <td className="w-8 p-2">
                  <input
                    type="checkbox"
                    className="ml-2 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
                    checked={selectedRowIds.includes(download.id)}
                    onChange={() => handleCheckboxChange(download.id)}
                  />
                </td>
                {displayColumns.map((column) => {
                  switch (column.id) {
                    case 'title':
                      return (
                        <td
                          key={column.id}
                          style={{ width: column.width }}
                          className="p-2 dark:text-gray-200"
                        >
                          {download.status === 'fetching metadata' ? (
                            <div className="space-y-1">
                              <Skeleton className="h-4 w-[100px] rounded-[3px]" />
                              <Skeleton className="h-4 w-[120px] rounded-[3px]" />
                            </div>
                          ) : (
                            <div
                              className="line-clamp-2 break-words"
                              title={download.name}
                            >
                              {download.name}
                            </div>
                          )}
                        </td>
                      );
                    case 'size':
                      return (
                        <td
                          key={column.id}
                          style={{ width: column.width }}
                          className="p-2 dark:text-gray-200 ml-2"
                        >
                          {download.status === 'fetching metadata' ? (
                            <div className="space-y-1">
                              <Skeleton className="h-4 w-[50px] rounded-[3px]" />
                              <Skeleton className="h-4 w-[70px] rounded-[3px]" />
                            </div>
                          ) : (
                            <div className="line-clamp-2 break-words ml-1">
                              {formatFileSize(download.size)}
                            </div>
                          )}
                        </td>
                      );
                    case 'format':
                      return (
                        <td
                          key={column.id}
                          style={{ width: column.width }}
                          className="p-2 ml-2"
                        >
                          <div className="flex items-center ml-1">
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              {download.status === 'fetching metadata' ? (
                                <div className="space-y-1">
                                  <Skeleton className="h-8 w-[50px] rounded-[3px]" />
                                </div>
                              ) : (
                                <FormatSelector
                                  download={download}
                                  onFormatSelect={(formatData) => {
                                    useDownloadStore.setState((state) => ({
                                      forDownloads: state.forDownloads.map(
                                        (d) =>
                                          d.id === download.id
                                            ? {
                                                ...d,
                                                ext: formatData.ext,
                                                formatId: formatData.formatId,
                                                audioExt: formatData.audioExt,
                                                audioFormatId:
                                                  formatData.audioFormatId,
                                              }
                                            : d,
                                      ),
                                    }));
                                  }}
                                />
                              )}
                            </span>
                          </div>
                        </td>
                      );
                    case 'status':
                      return (
                        <td
                          key={column.id}
                          style={{ width: column.width }}
                          className="p-2"
                        >
                          <div className="flex justify-start">
                            <span className="text-sm text-gray-600 dark:text-gray-300 ml-1">
                              {download.status === 'cancelled' ||
                              download.status === 'initializing' ||
                              download.status === 'fetching metadata' ? (
                                <span
                                  style={{
                                    color: getStatusColor(download.status),
                                    fontWeight: '500',
                                    textTransform: 'capitalize',
                                  }}
                                >
                                  {download.status}
                                </span>
                              ) : download.status === 'finished' ? (
                                <button
                                  className="relative flex items-center text-sm underline"
                                  style={{
                                    color: getStatusColor(download.status),
                                  }}
                                >
                                  <FaPlay
                                    className="mr-3 text-green-600 hover:text-green-400 transition-colors duration-200"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewDownload(
                                        `${download.location}${download.name}`,
                                      );
                                    }}
                                  />
                                  <span
                                    className="hover:text-green-400 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewFolder(
                                        download.location,
                                        `${download.location}${download.name}`,
                                      );
                                    }}
                                  >
                                    Finished
                                  </span>
                                </button>
                              ) : (
                                <span
                                  style={{
                                    color: getStatusColor(download.status),
                                    fontWeight: '500',
                                    textTransform: 'capitalize',
                                  }}
                                >
                                  {download.status || 'Unknown'}
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                      );
                    case 'tags':
                      return (
                        <td
                          key={column.id}
                          style={{ width: column.width }}
                          className="p-2"
                        >
                          <div
                            className="flex flex-wrap gap-1"
                            title={
                              download.tags && download.tags.length > 0
                                ? download.tags.join(', ')
                                : 'No tags'
                            }
                          >
                            {download.tags && download.tags.length > 0 ? (
                              download.tags.slice(0, 5).map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-blue-100 dark:bg-blue-800 rounded-full text-xs"
                                >
                                  {tag}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-xs">
                                No tags
                              </span>
                            )}
                            {download.tags && download.tags.length > 5 && (
                              <span className="text-xs text-gray-500">
                                +{download.tags.length - 5}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    case 'categories':
                      return (
                        <td
                          key={column.id}
                          style={{ width: column.width }}
                          className="p-2"
                        >
                          <div
                            className="flex flex-wrap gap-1"
                            title={
                              download.category && download.category.length > 0
                                ? download.category.join(', ')
                                : 'No categories'
                            }
                          >
                            {download.category &&
                            download.category.length > 0 ? (
                              download.category
                                .slice(0, 5)
                                .map((category, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-green-100 dark:bg-green-800 rounded-full text-xs"
                                  >
                                    {category}
                                  </span>
                                ))
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-xs">
                                No categories
                              </span>
                            )}
                            {download.category &&
                              download.category.length > 5 && (
                                <span className="text-xs text-gray-500">
                                  +{download.category.length - 5}
                                </span>
                              )}
                          </div>
                        </td>
                      );
                    case 'speed':
                      return (
                        <td
                          key={column.id}
                          style={{ width: column.width }}
                          className="p-2 dark:text-gray-200 ml-2"
                        >
                          {download.status === 'downloading' ? (
                            <span className="m-1">{download.speed}</span>
                          ) : (
                            <span className="m-1">—</span>
                          )}{' '}
                        </td>
                      );
                    case 'dateAdded':
                      return (
                        <td
                          key={column.id}
                          style={{ width: column.width }}
                          className="p-2 dark:text-gray-200 ml-2"
                        >
                          {formatRelativeTime(download.DateAdded)}
                        </td>
                      );
                    case 'source':
                      return (
                        <td
                          key={column.id}
                          style={{ width: column.width }}
                          className="p-2 dark:text-gray-200 ml-2"
                        >
                          {download.status === 'fetching metadata' ? (
                            <div className="space-y-1">
                              <Skeleton className="h-4 w-[100px] rounded-[3px]" />
                            </div>
                          ) : (
                            <div
                              className="line-clamp-2 break-words ml-1"
                              title={download.extractorKey}
                            >
                              <a
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.downlodrFunctions.openExternalLink(
                                    download.videoUrl,
                                  );
                                }}
                                className="hover:underline cursor-pointer"
                              >
                                {download.extractorKey || 'YouTube'}
                              </a>
                            </div>
                          )}
                        </td>
                      );
                    default:
                      return null;
                  }
                })}
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* Column header context menu */}
      <ColumnHeaderContextMenu
        position={{
          x: columnHeaderContextMenu.x,
          y: columnHeaderContextMenu.y,
        }}
        visible={columnHeaderContextMenu.visible}
        visibleColumns={visibleColumns}
        onToggleColumn={handleToggleColumn}
        onClose={handleCloseColumnHeaderContextMenu}
        columnOptions={columnMenuOptions}
      />

      {/* Context menu for download options */}
      {contextMenu && (
        <DownloadContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          downloadId={contextMenu.downloadId}
          onClose={() => setContextMenu(null)}
          onRemove={() =>
            handleRemove(contextMenu.downloadLocation, contextMenu.downloadId)
          }
          onViewDownload={() =>
            handleViewDownload(contextMenu.downloadLocation)
          }
          onViewFolder={() =>
            handleViewFolder(
              contextMenu.downloadLocation?.split(',')[0],
              contextMenu.downloadLocation,
            )
          }
          onAddTag={addTag}
          onRemoveTag={removeTag}
          onAddCategory={addCategory}
          onRemoveCategory={removeCategory}
          availableTags={availableTags}
          availableCategories={availableCategories}
          controllerId={contextMenu.controllerId}
          // Empty functions for required props
          onPause={() => {
            /* hello */
          }}
          onStop={() => {
            /* hello */
          }}
          onForceStart={() => {
            /* hello */
          }}
          currentTags={[]}
          currentCategories={[]}
        />
      )}
    </div>
  );
};

export default DownloadList;
