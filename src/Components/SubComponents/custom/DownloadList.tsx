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
import useDownloadStore, { BaseDownload } from '../../../Store/downloadStore';
import DownloadContextMenu from './DownloadContextMenu';
import { toast } from '../shadcn/hooks/use-toast';
import ResizableHeader from './ResizableColumns/ResizableHeader';
import { useResizableColumns } from './ResizableColumns/useResizableColumns';

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

  // Effect to handle clicks outside the list to close the context menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(event.target as Node)) {
        setContextMenu(null);
        setSelectedDownloadId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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
    setContextMenu({ downloadId: null, x: 0, y: 0 });
  };
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

  return (
    <div ref={listRef} className="overflow-x-auto">
      <table className="min-w-full table-auto">
        <thead>
          <tr className="bg-gray-100 dark:bg-darkModeCompliment">
            {/* Regular checkbox cell - not resizable */}
            <th className="p-2 w-8">
              <input type="checkbox" className="rounded" />
            </th>

            {/* Render headers based on column order in state */}
            {columns.map((column, index) => (
              <ResizableHeader
                key={column.id}
                width={column.width}
                onResizeStart={(e) => startResizing(column.id, e.clientX)}
                columnId={column.id}
                index={index}
                onDragStart={enhancedStartDragging}
                onDragOver={enhancedHandleDragOver}
                onDrop={enhancedHandleDrop}
                isDragging={dragging?.columnId === column.id}
                isDragOver={dragOverIndex === index}
                isLastColumn={index === columns.length - 1}
                className={
                  dragging?.columnId === column.id
                    ? 'bg-blue-100 dark:bg-blue-800 opacity-70'
                    : ''
                }
              >
                <div
                  className="flex items-center cursor-pointer"
                  onClick={() => requestSort(column.id)}
                >
                  <span>
                    {column.id.charAt(0).toUpperCase() + column.id.slice(1)}
                  </span>
                  <span className="ml-1">
                    <HiChevronUpDown className="inline h-4 w-4 text-gray-400" />
                  </span>
                </div>
              </ResizableHeader>
            ))}
          </tr>
        </thead>

        <tbody>
          {sortedDownloads.map((download) => (
            <tr
              key={download.id}
              className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                selectedDownloadId === download.id
                  ? 'bg-blue-50 dark:bg-gray-600'
                  : 'dark:bg-darkMode'
              }`}
              onContextMenu={(e) => handleContextMenu(e, download)}
              onClick={() =>
                handleViewDownload(`${download.location}${download.name}`)
              }
            >
              {/* Regular checkbox cell - not resizable */}
              <td className="p-2 w-8">
                <input type="checkbox" className="rounded" />
              </td>

              {/* Render cells based on column order in state */}
              {columns.map((column) => {
                const cellContent = (() => {
                  switch (column.id) {
                    case 'title':
                      return (
                        <div className="flex items-center gap-2 dark:text-gray-200">
                          <div className="line-clamp-2 overflow-hidden text-ellipsis">
                            {download.name}
                          </div>
                        </div>
                      );
                    case 'size':
                      return (
                        <span className="dark:text-gray-200">
                          {Math.round(download.size / 1048576)} MB
                        </span>
                      );
                    case 'format':
                      return (
                        <span className="dark:text-gray-200">
                          {download.ext}
                        </span>
                      );
                    case 'status':
                      return download.status === 'completed' ||
                        download.status === 'Finished' ? (
                        <span className="flex items-center text-green-500">
                          <span className="mr-1">►</span> Finished
                        </span>
                      ) : download.status === 'failed' ||
                        download.status === 'Failed' ? (
                        <span className="text-red-500">Failed</span>
                      ) : download.status === 'cancelled' ||
                        download.status === 'Cancelled' ||
                        download.status === 'canceled' ? (
                        <span className="text-red-500">Cancelled</span>
                      ) : (
                        <span
                          className="capitalize
"
                        >
                          {download.status}
                        </span>
                      );
                    case 'tags':
                      return (
                        <div className="flex flex-wrap gap-1">
                          {download.tags?.map((tag, index) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                          {download.tags && download.tags.length > 0 && (
                            <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full">
                              +{Math.max(0, download.tags.length - 1)}
                            </span>
                          )}
                        </div>
                      );
                    case 'categories':
                      return (
                        <div className="flex flex-wrap gap-1">
                          {download.category?.map((category) => (
                            <span
                              key={category}
                              className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-full"
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      );
                    case 'source':
                      return (
                        <span className="dark:text-gray-200">
                          {download.extractorKey || 'YouTube'}
                        </span>
                      );
                    default:
                      return null;
                  }
                })();

                return (
                  <td
                    key={column.id}
                    className="p-2"
                    style={{ width: `${column.width}px` }}
                  >
                    {cellContent}
                  </td>
                );
              })}
              <th className="w-20 p-2 font-semibold text-white">
                <div className="flex items-center dark:text-gray-200">
                  Source
                  <HiChevronUpDown
                    size={14}
                    className="flex-shrink-0 dark:text-gray-400"
                  />
                </div>
              </th>
            </tr>
          ))}
        </tbody>
      </table>

      {contextMenu && (
        <DownloadContextMenu
          downloadId={contextMenu.downloadId}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onPause={() => void 0}
          onStop={() => void 0}
          onForceStart={() => void 0}
          onRemove={() =>
            handleRemove(contextMenu.downloadLocation, contextMenu.downloadId)
          }
          onViewDownload={() =>
            handleViewDownload(contextMenu.downloadLocation)
          }
          onViewFolder={() => handleViewFolder(contextMenu.downloadLocation)}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          currentTags={
            downloads.find((d) => d.id === contextMenu.downloadId)?.tags || []
          }
          availableTags={availableTags}
          onAddCategory={addCategory}
          onRemoveCategory={removeCategory}
          currentCategories={
            downloads.find((d) => d.id === contextMenu.downloadId)?.category ||
            []
          }
          availableCategories={availableCategories}
        />
      )}
    </div>
  );
};

export default DownloadList;
