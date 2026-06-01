/**
 * A custom React component
 * A React component that displays a list of downloads in a table format.
 * It allows users to view download details and manage downloads through a context menu.
 *
 * @param CategoryTagPageProps
 *   @param downloads - An array of download objects to display in the list.
 *
 * @returns JSX.Element - The rendered download list component.
 */

import { Skeleton } from '@/core-app/components/shadcn/components/ui/skeleton';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { useMainStore } from '@/core-app/store/mainStore';
import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
import ColumnHeaderContextMenu from '@/downlodr/components/contextMenu/ColumnHeaderContextMenu';
import DownloadButton from '@/downlodr/components/download/DownloadButton';
import { AnimatedLinearProgressBar } from '@/downlodr/components/download/LinearProgress';
import ResizableHeader from '@/downlodr/components/download/resizableColumns/ResizableHeader';
import { useResizableColumns } from '@/downlodr/components/download/resizableColumns/useResizableColumns';
import ShareButton from '@/downlodr/components/download/ShareButton';
import FileNotExistModal from '@/downlodr/components/modal/custom/FileNotExistModal';
import { DownloadItem, FormatData } from '@/downlodr/schema/componentSchema';
import { BaseDownload, useDownloadStore } from '@/downlodr/store/downloadStore';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import CategorySearchBar, {
  SearchField,
} from '@/downlodr/components/base/InputField/CategorySearchBar';
import {
  getExtractorIcon,
  getStatusIcon,
} from '@/downlodr/utils/icons/iconMapper';
import {
  formatFileSize,
  formatRelativeTime,
  getColumnDisplayName,
  getStatusColor,
} from '@/downlodr/pages/status/statusPageUtils';
import EmptySearch from '@/assets/icon/EmptySearch';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlay } from 'react-icons/fa';
import { HiOutlineFolderOpen } from 'react-icons/hi';
import { HiChevronUpDown } from 'react-icons/hi2';

// Interface representing the props for the CategoryTagPage component
interface CategoryTagPageProps {
  downloads: BaseDownload[];
  categoryId?: string;
}

const CategoryTagPage: React.FC<CategoryTagPageProps> = ({
  downloads,
  categoryId,
}) => {
  const { t } = useTranslation('downlodr');
  const [windowWidth] = useState(window.innerWidth);
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
  const [thumbnailDataUrls, setThumbnailDataUrls] = useState<
    Record<string, string>
  >({});
  const initialColumns = [
    { id: 'title', width: Math.floor(windowWidth * 0.28), minWidth: 170 },
    { id: 'size', width: 90, minWidth: 80 },
    { id: 'status', width: 100, minWidth: 80 },
    { id: 'dateAdded', width: 90, minWidth: 90 },
    { id: 'tags', width: 150, minWidth: 120 },
    { id: 'categories', width: 150, minWidth: 120 },
    { id: 'source', width: 50, minWidth: 50 },
    { id: 'action', width: 60, minWidth: 60 },
  ];

  const {
    columns,
    startResizing,
    startDragging,
    handleDragOver,
    handleDrop,
    cancelDrag,
    dragging,
    dragOverIndex,
  } = useResizableColumns(initialColumns);

  const {
    isSearchActive,
    searchResults,
    searchQuery: taskbarQuery,
  } = useTaskbarDownloadStore((state) => state.searchState);

  const highlightText = (text: string) => {
    const query = searchQuery || taskbarQuery;
    if (!query) return text;
    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'gi',
    );
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          className="bg-yellow-200 dark:bg-yellow-600 text-inherit rounded-sm px-0"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  // Remove duplicate downloads based on ID, intersected with taskbar search results when active
  const uniqueDownloads = React.useMemo(() => {
    const deduped = [
      ...new Map(downloads.map((item) => [item.id, item])).values(),
    ];
    if (!isSearchActive) return deduped;
    const resultIds = new Set(searchResults.map((r) => r.id));
    return deduped.filter((d) => resultIds.has(d.id));
  }, [downloads, isSearchActive, searchResults]);
  // sort state
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'ascending' | 'descending';
  }>({
    key: null,
    direction: 'ascending',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFields, setSearchFields] = useState<SearchField[]>(['title']);
  const [searchBarKey, setSearchBarKey] = useState(0);

  const handleSearch = useCallback((query: string, fields: SearchField[]) => {
    setSearchQuery(query);
    setSearchFields(fields);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchBarKey((k) => k + 1);
  }, []);

  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const globalSelectedRowIds = useSelectedDownloadStore(
    (state) => state.selectedRowIds,
  );
  const setSelectedDownloads = useSelectedDownloadStore(
    (state) => state.setSelectedDownloads,
  );

  // Sync local state with global state when global state changes (e.g., from TaskBar operations)
  useEffect(() => {
    setSelectedRowIds(globalSelectedRowIds);
  }, [globalSelectedRowIds]);
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
    'title',
    'size',
    'status',
    'tags',
    'categories',
    'source',
    'action',
    'dateAdded',
  ];

  // Filter columns based on visibility settings, ensuring essential columns are always included
  const displayColumns = React.useMemo(() => {
    return columns.filter(
      (column) =>
        visibleColumns.includes(column.id) ||
        ['title', 'status', 'format', 'action', 'tags', 'categories'].includes(
          column.id,
        ),
    );
  }, [columns, visibleColumns]);

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
            case 'dateAdded':
              return item.DateAdded;
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

  const allDownloads = React.useMemo(() => {
    if (!searchQuery.trim()) return sortedDownloads;
    const q = searchQuery.toLowerCase();
    return sortedDownloads.filter((d) =>
      searchFields.some((field) => {
        switch (field) {
          case 'title':
            return (d.displayName || d.name).toLowerCase().includes(q);
          case 'tags':
            return d.tags?.some((t) => t.toLowerCase().includes(q));
          case 'categories':
            return d.category?.some((c) => c.toLowerCase().includes(q));
          case 'status':
            return d.status?.toLowerCase().includes(q);
          case 'source':
            return d.extractorKey?.toLowerCase().includes(q);
          default:
            return false;
        }
      }),
    );
  }, [sortedDownloads, searchQuery, searchFields]);

  // Handlers for row interactions
  const handleRowClick = (downloadId: string) => {
    setSelectedDownloadId(
      downloadId === selectedDownloadId ? null : downloadId,
    );
    setExpandedRowId(downloadId === expandedRowId ? null : downloadId);
  };

  const handleCheckboxChange = (downloadId: string) => {
    const newSelected = globalSelectedRowIds.includes(downloadId)
      ? globalSelectedRowIds.filter((id) => id !== downloadId)
      : [...globalSelectedRowIds, downloadId];

    setSelectedRowIds(newSelected);
    // Also update the global state
    useSelectedDownloadStore.getState().setSelectedRowIds(newSelected);

    // Create promises for each download
    const promises = newSelected.map(async (id) => {
      const download = allDownloads.find((d) => d.id === id);
      return {
        id,
        controllerId: download?.controllerId,
        videoUrl: download?.videoUrl,
        downloadName: download?.downloadName,
        status: download?.status,
        download: download,
        location: download?.location
          ? await window.downlodrFunctions.joinDownloadPath(
              download.location,
              download.name,
            )
          : undefined,
      };
    });

    // Resolve all promises before updating state
    Promise.all(promises).then((resolvedData) => {
      useSelectedDownloadStore.getState().setSelectedDownloads(resolvedData);
    });
  };

  const handleSelectAll = () => {
    const newSelected =
      globalSelectedRowIds.length === allDownloads.length
        ? []
        : allDownloads.map((download) => download.id);

    setSelectedRowIds(newSelected);
    // Also update the global state
    useSelectedDownloadStore.getState().setSelectedRowIds(newSelected);

    // Create promises for each download
    const promises = newSelected.map(async (id) => {
      const download = allDownloads.find((d) => d.id === id);
      return {
        id,
        controllerId: download?.controllerId,
        videoUrl: download?.videoUrl,
        downloadName: download?.downloadName,
        status: download?.status,
        download: download,
        location: download?.location
          ? await window.downlodrFunctions.joinDownloadPath(
              download.location,
              download.name,
            )
          : undefined,
      };
    });

    // Resolve all promises before updating state
    Promise.all(promises).then((resolvedData) => {
      useSelectedDownloadStore.getState().setSelectedDownloads(resolvedData);
    });
  };

  // Handlers for column operations
  const handleColumnHeaderContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Close any active download context menu first
    setContextMenu(null);

    // Get the table's position
    const tableRect = e.currentTarget.getBoundingClientRect();

    // Calculate position relative to the table/header
    const x = e.clientX - tableRect.left + 2; // Small offset for better appearance
    const y = e.clientY - tableRect.top + window.scrollY + 2;

    setColumnHeaderContextMenu({
      visible: true,
      x: x,
      y: y,
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
      <HiChevronUpDown size={14} className="flex-shrink-0 rotate-180 ml-1" />
    ) : (
      <HiChevronUpDown size={14} className="flex-shrink-0 ml-1" />
    );
  };

  // Handle column sort clicks
  const handleSortClick = (columnId: string) => {
    requestSort(columnId);
  };

  // Format selector component
  const FormatSelector = ({
    download,
  }: {
    download: BaseDownload;
    onFormatSelect: (formatData: FormatData) => void;
  }) => {
    // Simple format display for now
    return <div className="text-sm py-1 px-2">{download.ext || 'mp4'}</div>;
  };

  // Transform column options to match the expected interface
  const columnMenuOptions = columnOptions.map((id) => ({
    id,
    label: getColumnDisplayName(id),
    required: [
      'title',
      'status',
      'format',
      'action',
      'tags',
      'categories',
    ].includes(id),
  }));

  // close menu and clear selected download when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // don't clear selection if clicking inside a context menu
      const target = event.target as HTMLElement;
      const isClickInsideContextMenu = target.closest('[data-context-menu]');

      // check if we're clicking on a different row
      const clickedRow = target.closest('tr');
      const isClickOnDifferentRow =
        clickedRow &&
        contextMenu?.downloadId &&
        !clickedRow.querySelector(
          `[data-download-id="${contextMenu.downloadId}"]`,
        );

      // Close the context menu if:
      // 1. Clicking outside the context menu, OR
      // 2. Clicking on a different row than the one with the context menu
      if (!isClickInsideContextMenu || isClickOnDifferentRow) {
        setContextMenu(null);
        setSelectedDownloadId(null);
        setColumnHeaderContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu?.downloadId]);

  const handlePause = async (downloadId: string, downloadLocation?: string) => {
    // Get fresh state each time
    const { downloading, deleteDownloading } = useDownloadStore.getState();
    const currentDownload = downloading.find((d) => d.id === downloadId);
    const { updateDownloadStatus } = useDownloadStore.getState();

    if (currentDownload?.status === 'paused') {
      // Check if this is an m4a download and handle existing partial file
      const isM4aDownload =
        currentDownload.ext === 'm4a' || currentDownload.audioExt === 'm4a';

      if (
        isM4aDownload &&
        currentDownload.location &&
        currentDownload.downloadName
      ) {
        try {
          // Construct the full file path the same way as in the download store
          const fullFilePath = await window.downlodrFunctions.joinDownloadPath(
            currentDownload.location,
            currentDownload.downloadName,
          );

          // Check if the partial file exists
          const fileExists = await window.downlodrFunctions.fileExists(
            fullFilePath,
          );

          if (fileExists) {
            // Delete the existing partial m4a file to prevent corruption
            const deleteSuccess = await window.downlodrFunctions.deleteFile(
              fullFilePath,
            );
          }
        } catch (error) {
          console.error('Error handling existing m4a file:', error);
          // Continue with resume even if file deletion fails
        }
      }

      const { addDownload } = useDownloadStore.getState();
      addDownload({
        videoUrl: currentDownload.videoUrl,
        name: `${currentDownload}.${currentDownload.ext}`,
        downloadName: `${currentDownload.downloadName}.${currentDownload.ext}`,
        displayName: currentDownload.displayName,
        size: currentDownload.size,
        speed: currentDownload.speed,
        channelName: currentDownload.channelName,
        timeLeft: currentDownload.timeLeft,
        DateAdded: new Date().toISOString(),
        progress: 0,
        location: currentDownload.location,
        status: 'downloading',
        ext: currentDownload.ext,
        formatId: currentDownload.formatId,
        audioExt: currentDownload.audioExt,
        audioFormatId: currentDownload.audioFormatId,
        extractorKey: currentDownload.extractorKey,
        limitRate: '0',
        automaticCaption: currentDownload.automaticCaption,
        thumbnails: currentDownload.thumbnails[0],
        getTranscript: currentDownload.getTranscript || false,
        getThumbnail: currentDownload.getThumbnail || false,
        duration: currentDownload.duration || 60,
        isCreateFolder: false,
      });
      deleteDownloading(downloadId);
      // Clear selected downloads after starting/resuming download
      setSelectedRowIds([]);
      setSelectedDownloads([]);
      useSelectedDownloadStore.getState().clearAllSelections();
      toast({
        variant: 'success',
        title: 'Download Resumed',
        description: 'Download has been resumed successfully',
        duration: 3000,
      });
    } else if (currentDownload && currentDownload.controllerId != '---') {
      try {
        updateDownloadStatus(downloadId, 'paused');
        window.ytdlp
          .killController(currentDownload.controllerId)
          .then((response: { success: boolean; error?: string }) => {
            if (response.success) {
              setTimeout(() => {
                updateDownloadStatus(downloadId, 'paused');
              }, 1200);
            }
          });
        // When successfully paused
        toast({
          variant: 'success',
          title: 'Download Paused',
          description: 'Download has been paused successfully',
          duration: 3000,
        });
        updateDownloadStatus(downloadId, 'paused');
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to pause/resume download',
          duration: 3000,
        });
        console.error('Error in pause:', error);
      }
    }

    setContextMenu({ downloadId: null, x: 0, y: 0 });
  };

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

  // state for file not exist modal
  const [showFileNotExistModal, setShowFileNotExistModal] = useState(false);
  const [missingFiles, setMissingFiles] = useState<DownloadItem[]>([]);

  // handleFileNotExistModal function
  const handleFileNotExistModal = async (downloadItem: DownloadItem) => {
    setMissingFiles([downloadItem]);
    setShowFileNotExistModal(true);
  };

  // update handleViewDownload to check if the file exists
  const handleViewDownload = async (
    downloadLocation?: string,
    downloadId?: string,
  ) => {
    if (downloadLocation) {
      try {
        const download = allDownloads.find((d) => d.id === downloadId);
        if (!download) return;
        const fullDownloadLocation =
          await window.downlodrFunctions.joinDownloadPath(
            download.location,
            download.downloadName,
          );
        const exists = await window.downlodrFunctions.fileExists(
          fullDownloadLocation,
        );
        if (exists) {
          window.downlodrFunctions.openVideo(fullDownloadLocation);
        } else {
          // If the file doesn't exist, find the download and show the modal
          if (downloadId) {
            const download = downloads.find((d) => d.id === downloadId);
            if (download) {
              // Pass the specific download to the modal function
              const downloadItem: DownloadItem = {
                id: download.id,
                videoUrl: download.videoUrl,
                location: downloadLocation,
                name: download.name,
                ext: download.ext,
                downloadName: download.downloadName,
                extractorKey: download.extractorKey,
                status: download.status,
                download: {
                  displayName: download.displayName || '',
                  ...download,
                },
              };
              handleFileNotExistModal(downloadItem);
            }
          } else {
            // In case we don't have the download ID, show a simple toast
            if (downloadId) {
              const download = downloads.find((d) => d.id === downloadId);
              if (download) {
                // Pass the specific download to the modal function
                const downloadItem: DownloadItem = {
                  id: download.id,
                  videoUrl: download.videoUrl,
                  location: download.location,
                  name: download.name,
                  ext: download.ext,
                  downloadName: download.downloadName,
                  extractorKey: download.extractorKey,
                  status: download.status,
                  download: {
                    displayName: download.displayName || '',
                    ...download,
                  },
                };
                handleFileNotExistModal(downloadItem);
              }
            }
            toast({
              variant: 'destructive',
              title: 'File Not Found',
              description: `The file does not exist at the specified location`,
              duration: 3000,
            });
          }
        }
      } catch (error) {
        console.error('Error viewing download:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description:
            error?.message || String(error) || 'Failed to view download',
          duration: 5000,
        });
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'No Download Location',
        description: 'Invalid Download Location',
        duration: 3000,
      });
    }
    setContextMenu({ downloadId: null, x: 0, y: 0 });
  };

  // Handles viewing the folder containing the download.
  // downloadLocation - The location of the download file.
  const handleViewFolder = async (
    downloadLocation?: string,
    filePath?: string,
  ) => {
    if (!downloadLocation) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to open folder',
        duration: 3000,
      });
      setContextMenu({ downloadId: null, x: 0, y: 0 });
      return;
    }

    try {
      // Handle old format with comma-separated paths
      if (downloadLocation.includes(',') && !filePath) {
        const [folderPath, filePathFromString] = downloadLocation.split(',');
        await openFolderWithFallback(folderPath, filePathFromString);
      } else {
        // Handle normal case with separate parameters
        const fullPath = filePath
          ? await window.downlodrFunctions.joinDownloadPath(
              downloadLocation,
              filePath,
            )
          : null;
        await openFolderWithFallback(downloadLocation, fullPath);
      }
    } catch (error) {
      console.error('Error in handleViewFolder:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to open folder',
        duration: 3000,
      });
    }

    setContextMenu({ downloadId: null, x: 0, y: 0 });
  };

  // Helper function to handle folder opening with fallback
  const openFolderWithFallback = async (
    folderPath: string,
    filePath?: string | null,
  ) => {
    if (filePath) {
      // Check if file exists first
      const fileExists = await window.downlodrFunctions.fileExists(filePath);

      if (fileExists) {
        // File exists, try to open folder and highlight file
        const success = await window.downlodrFunctions.openFolder(
          folderPath,
          filePath,
        );
        if (success) return; // Success, we're done

        // If highlighting failed, fall through to just opening folder
      }
    }

    // Either no file path, file doesn't exist, or highlighting failed
    // Try to just open the folder
    const folderExists = await window.downlodrFunctions.fileExists(folderPath);

    if (folderExists) {
      const success = await window.downlodrFunctions.openFolder(
        folderPath,
        null,
      );
      if (!success) {
        throw new Error('Failed to open folder');
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'Missing Folder',
        description: 'The download folder does not exist yet',
        duration: 3000,
      });
    }
  };

  // Enhance drag handlers with better visual cues
  const enhancedStartDragging = (columnId: string, index: number) => {
    startDragging(columnId, index);
    // class to the body  for global drag state
    document.body.classList.add('column-dragging');
  };

  const enhancedHandleDrop = () => {
    handleDrop();
    document.body.classList.remove('column-dragging');
  };

  const enhancedHandleDragOver = (index: number) => {
    handleDragOver(index);
  };

  // effect to cleanup drag state if dragging is interrupted
  useEffect(() => {
    const handleDragEnd = () => {
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
      <div className="flex justify-between items-center">
        <div>
          {categoryId && categoryId !== 'all' && (
            <span className="ml-2 px-2.5 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-100 rounded-full text-xs font-medium whitespace-nowrap flex items-center">
              {categoryId === 'uncategorized'
                ? 'Uncategorized'
                : decodeURIComponent(categoryId)}
            </span>
          )}
        </div>
        <CategorySearchBar key={searchBarKey} onSearch={handleSearch} />
      </div>
      <div className="flex flex-col">
        <table className="w-full">
          <thead className="sticky top-0 z-20 bg-white dark:bg-alternateBlack">
            <tr
              className="text-left"
              onContextMenu={handleColumnHeaderContextMenu}
            >
              <th className="w-8 p-2">
                <input
                  type="checkbox"
                  className="ml-2 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
                  checked={
                    allDownloads.length > 0 &&
                    globalSelectedRowIds.length === allDownloads.length
                  }
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
                  onDragEnd={cancelDrag}
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
                    <span className="flex items-center gap-[0.5px]">
                      {getColumnDisplayName(column.id)}
                      {renderSortIndicator(column.id)}

                      {column.id === 'title' &&
                        globalSelectedRowIds.length > 0 && (
                          <span className="text-xs">
                            ({globalSelectedRowIds.length}{' '}
                            {globalSelectedRowIds.length === 1
                              ? 'item'
                              : 'items'}{' '}
                            selected)
                          </span>
                        )}
                    </span>
                  </div>
                </ResizableHeader>
              ))}
            </tr>
            <tr className="pointer-events-none">
              <th
                colSpan={999}
                className="p-0 h-[1px] bg-gray-200 dark:bg-darkModeCompliment"
              />
            </tr>
          </thead>
          <tbody>
            {allDownloads.map((download) => (
              <React.Fragment key={download.id}>
                <tr
                  className={`border-b hover:bg-gray-50 border-gray-200  dark:border-gray-700 dark:hover:bg-gray-700 cursor-pointer ${
                    selectedDownloadId === download.id
                      ? 'bg-blue-50 dark:bg-gray-600'
                      : 'dark:bg-darkMode'
                  }`}
                  onContextMenu={(e) => handleContextMenu(e, download)}
                  onClick={() => {
                    handleRowClick(download.id);
                    handleCheckboxChange(download.id);
                  }}
                  draggable={true}
                  data-download-id={download.id}
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
                      checked={globalSelectedRowIds.includes(download.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleCheckboxChange(download.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
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
                              <TooltipWrapper
                                content={download.displayName || download.name}
                                side="bottom"
                              >
                                <div className="line-clamp-2 break-words">
                                  {highlightText(
                                    download.displayName || download.name,
                                  )}
                                </div>
                              </TooltipWrapper>
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
                            <div className="flex justify-center">
                              <span className="text-sm text-gray-600 dark:text-gray-300 ml-1">
                                {download.status === 'cancelled' ||
                                download.status === 'initializing' ||
                                download.status === 'queued' ||
                                download.status === 'fetching metadata' ||
                                download.status === 'failed' ? (
                                  <span
                                    style={{
                                      color: getStatusColor(download.status),
                                      fontWeight: '500',
                                      textTransform: 'capitalize',
                                    }}
                                  >
                                    {getStatusIcon(download.status, 20)}
                                  </span>
                                ) : download.status === 'finished' ? (
                                  <button
                                    className="relative flex items-center text-sm underline"
                                    style={{
                                      color: getStatusColor(download.status),
                                    }}
                                  >
                                    <TooltipWrapper
                                      content={t('contextMenu.viewFolder')}
                                      side="bottom"
                                    >
                                      <span>
                                        <FaPlay
                                          className="mr-3 text-green-600 hover:text-green-400 transition-colors duration-200"
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            handleViewDownload(
                                              await window.downlodrFunctions.joinDownloadPath(
                                                download.location,
                                                download.name,
                                              ),
                                              download.id,
                                            );
                                          }}
                                        />
                                      </span>
                                    </TooltipWrapper>
                                    <TooltipWrapper
                                      content={t('contextMenu.viewFolder')}
                                      side="bottom"
                                    >
                                      <span
                                        className="hover:text-green-400 transition-colors"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          handleViewFolder(
                                            download.location,
                                            await window.downlodrFunctions.joinDownloadPath(
                                              download.location,
                                              download.name,
                                            ),
                                          );
                                        }}
                                      >
                                        <HiOutlineFolderOpen
                                          size={20}
                                          className="mr-3 text-green-600 hover:text-green-400 transition-colors duration-200"
                                        />
                                      </span>
                                    </TooltipWrapper>
                                  </button>
                                ) : download.status === 'to download' ? (
                                  <div className="flex items-center space-x-2 justify-center">
                                    <div
                                      style={{
                                        color: getStatusColor(download.status),
                                      }}
                                    >
                                      <DownloadButton
                                        download={{
                                          ...download,
                                          displayName:
                                            download.displayName || '',
                                        }}
                                      />
                                    </div>
                                  </div>
                                ) : download.status === 'paused' ||
                                  download.status === 'downloading' ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePause(download.id);
                                    }}
                                    className="hover:bg-gray-100 dark:hover:bg-darkModeHover w-full flex items-center justify-center"
                                  >
                                    <AnimatedLinearProgressBar
                                      status={download.status}
                                      max={100}
                                      min={0}
                                      value={download.progress}
                                      gaugePrimaryColor="#4CAF50"
                                      gaugeSecondaryColor="#EEEEEE"
                                      width={column.width - 10}
                                    />
                                  </button>
                                ) : (
                                  <span
                                    style={{
                                      color: getStatusColor(download.status),
                                      fontWeight: '500',
                                      textTransform: 'capitalize',
                                    }}
                                  >
                                    {getStatusIcon(download.status, 20)}
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
                                  : t('table.noTags')
                              }
                            >
                              {download.tags && download.tags.length > 0 ? (
                                download.tags.slice(0, 3).map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-blue-100 dark:bg-blue-800 rounded-full text-xs"
                                  >
                                    {tag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500 text-xs">
                                  {t('table.noTags')}
                                </span>
                              )}
                              {download.tags && download.tags.length > 5 && (
                                <span className="text-xs text-gray-500">
                                  +{download.tags.length - 3}
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
                                download.category &&
                                download.category.length > 0
                                  ? download.category.join(', ')
                                  : t('table.noCategories')
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
                                  {t('table.noCategories')}
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
                            className="p-2 dark:text-gray-200 ml-2 justify-center"
                          >
                            {download.status === 'fetching metadata' ? (
                              <div className="space-y-1">
                                <Skeleton className="h-4 w-[100px] rounded-[3px]" />
                              </div>
                            ) : (
                              <TooltipWrapper
                                content={download.extractorKey}
                                side="bottom"
                              >
                                <div className="line-clamp-2 break-words ml-1">
                                  <a
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.downlodrFunctions.openExternalLink(
                                        download.videoUrl,
                                      );
                                    }}
                                    className="hover:underline cursor-pointer flex justify-center items-center"
                                  >
                                    {getExtractorIcon(download.extractorKey)}
                                  </a>
                                </div>
                              </TooltipWrapper>
                            )}
                          </td>
                        );
                      case 'action':
                        return (
                          <td
                            key={column.id}
                            style={{ width: column.width }}
                            className="p-2 dark:text-gray-200 text-center"
                          >
                            <ShareButton
                              videoUrl={download.videoUrl}
                              name={download.name}
                              status={download.status}
                              thumbnailLocation={thumbnailDataUrls[download.id]}
                              format={download.ext || download.audioExt}
                              size={download.size}
                            />
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
        {allDownloads.length === 0 && searchQuery.trim() && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
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
              onClick={handleClearSearch}
              className="mt-1 px-5 py-2 rounded-md bg-[#E8622A] hover:bg-[#d0541e] text-white text-sm font-medium transition-colors"
            >
              Clear Search
            </button>
          </div>
        )}
      </div>

      <FileNotExistModal
        isOpen={showFileNotExistModal}
        onClose={() => setShowFileNotExistModal(false)}
        selectedDownloads={missingFiles}
        download={missingFiles.length === 1 ? missingFiles[0] : null}
      />

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
    </div>
  );
};

export default CategoryTagPage;
