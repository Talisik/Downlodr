/* eslint-disable @typescript-eslint/no-unused-vars */
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

import ColumnHeaderContextMenu from '@/Components/SubComponents/custom/ColumnHeaderContextMenu';
import ResizableHeader from '@/Components/SubComponents/custom/ResizableColumns/ResizableHeader';
import { useResizableColumns } from '@/Components/SubComponents/custom/ResizableColumns/useResizableColumns';
import ShareButton from '@/Components/SubComponents/custom/ShareButton';
import TooltipWrapper from '@/Components/SubComponents/custom/TooltipWrapper';
import { Skeleton } from '@/Components/SubComponents/shadcn/components/ui/skeleton';
import { toast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import { getExtractorIcon, getStatusIcon } from '@/DataFunctions/IconMapper';
import { DownloadItem } from '@/schema/componentSchema';
import useDownloadStore, { BaseDownload } from '@/Store/downloadStore';
import { useMainStore } from '@/Store/mainStore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaPlay } from 'react-icons/fa';
import { HiOutlineFolderOpen } from 'react-icons/hi';
import { HiChevronUpDown } from 'react-icons/hi2';
import FileNotExistModal from '../../Main/Modal/FileNotExistModal';
import DownloadButton from './DownloadButton';
import { AnimatedLinearProgressBar } from './LinearProgress';

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
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
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
  // Remove duplicate downloads based on ID
  const uniqueDownloads = [
    ...new Map(downloads.map((item) => [item.id, item])).values(),
  ];
  // debug state to track dragging status more visibly
  const [debugDrag, setDebugDrag] = useState<string>('');

  // sort state
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'ascending' | 'descending';
  }>({
    key: null,
    direction: 'ascending',
  });

  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const setSelectedDownloads = useMainStore(
    (state) => state.setSelectedDownloads,
  );
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

  const loadThumbnails = useCallback(
    async (downloads: typeof allDownloads) => {
      const loadPromises = downloads.map(async (download) => {
        if (download.thumnailsLocation && !thumbnailDataUrls[download.id]) {
          try {
            const dataUrl = await window.downlodrFunctions.getThumbnailDataUrl(
              download.thumnailsLocation,
            );
            if (dataUrl) {
              setThumbnailDataUrls((prev) => ({
                ...prev,
                [download.id]: dataUrl,
              }));
            }
          } catch (error) {
            console.warn(`Failed to load thumbnail for ${download.id}:`, error);
          }
        }
      });

      // Process in batches to avoid overwhelming the system
      const batchSize = 5;
      for (let i = 0; i < loadPromises.length; i += batchSize) {
        const batch = loadPromises.slice(i, i + batchSize);
        await Promise.allSettled(batch);
        // Small delay between batches to prevent UI blocking
        if (i + batchSize < loadPromises.length) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
    },
    [thumbnailDataUrls],
  );

  // Get visible columns from the store
  const visibleColumns = useMainStore((state) => state.visibleColumns);

  // Column options with display names (matching AllDownloads)
  const columnOptions = [
    { id: 'title', displayName: 'Title' },
    { id: 'size', displayName: 'Size' },
    { id: 'status', displayName: 'Status' },
    { id: 'tags', displayName: 'Tags' },
    { id: 'categories', displayName: 'Categories' },
    { id: 'source', displayName: 'Source' },
    { id: 'action', displayName: 'Action' },
    { id: 'dateAdded', displayName: 'Date Added' },
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

  // Function to get formatted file size
  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes) return '—';
    const KB = 1024;
    const MB = KB * 1024;
    const GB = MB * 1024;

    if (bytes >= GB) {
      return `${(bytes / GB).toFixed(2)} GB`;
    } else if (bytes >= MB) {
      return `${(bytes / MB).toFixed(2)} MB`;
    } else if (bytes >= KB) {
      return `${(bytes / KB).toFixed(2)} KB`;
    } else {
      return `${bytes} bytes`;
    }
  };
  // Function to get status color
  // color themes
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'downloading':
        return '#2196F3';
      case 'finished':
        return '#34C759';
      case 'failed':
        return '#E74C3C';
      case 'cancelled':
        return '#E74C3C';
      case 'initializing':
        return '#3498DB';
      case 'paused':
        return '#FFEB3B';
      case 'to download':
        return '#FF9800';
      case 'fetching metadata':
        return 'currentColor';
      default:
        return 'currentColor';
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
    const newSelected = selectedRowIds.includes(downloadId)
      ? selectedRowIds.filter((id) => id !== downloadId)
      : [...selectedRowIds, downloadId];

    setSelectedRowIds(newSelected);

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
      useMainStore.getState().setSelectedDownloads(resolvedData);
    });
  };

  const handleSelectAll = () => {
    const newSelected =
      selectedRowIds.length === allDownloads.length
        ? []
        : allDownloads.map((download) => download.id);

    setSelectedRowIds(newSelected);

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
      useMainStore.getState().setSelectedDownloads(resolvedData);
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

  // Transform column options to match the expected interface
  const columnMenuOptions = columnOptions.map((option) => ({
    id: option.id,
    label: option.displayName,
    required: [
      'title',
      'status',
      'format',
      'action',
      'tags',
      'categories',
    ].includes(option.id),
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
      addDownload(
        currentDownload.videoUrl,
        currentDownload.name,
        currentDownload.downloadName,
        currentDownload.size,
        currentDownload.speed,
        currentDownload.channelName,
        currentDownload.timeLeft,
        new Date().toISOString(),
        currentDownload.progress,
        currentDownload.location,
        'downloading',
        currentDownload.ext,
        currentDownload.formatId,
        currentDownload.audioExt,
        currentDownload.audioFormatId,
        currentDownload.extractorKey,
        '',
        currentDownload.automaticCaption,
        currentDownload.thumbnails,
        currentDownload.getTranscript || false,
        currentDownload.getThumbnail || false,
        currentDownload.duration || 60,
        false,
      );
      deleteDownloading(downloadId);
      // Clear selected downloads after starting/resuming download
      setSelectedRowIds([]);
      setSelectedDownloads([]);
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

  // handles the removal of a download.
  const handleRemove = async (
    downloadLocation?: string,
    downloadId?: string,
    controllerId?: string,
    deleteFolder?: boolean,
  ) => {
    if (!downloadLocation || !downloadId) return;

    // Get the download status
    const download = downloads.find((d) => d.id === downloadId);
    if (!download) return;

    // Handle pending downloads
    if (download.status === 'to download') {
      deleteDownload(downloadId);
      toast({
        variant: 'success',
        title: 'Download Deleted',
        description: 'Download has been deleted successfully',
        duration: 3000,
      });
      return;
    }

    // Handle cancelled or paused downloads
    if (download.status === 'cancelled' || download.status === 'paused') {
      deleteDownload(downloadId);
      toast({
        variant: 'success',
        title: 'Download Removed',
        description: `${
          download.status === 'cancelled' ? 'Cancelled' : 'Paused'
        } download has been removed successfully`,
        duration: 3000,
      });
      return;
    }

    // Handle active downloads
    if (download.status === 'downloading' && controllerId) {
      try {
        const success = await window.ytdlp.killController(controllerId);
        if (!success) {
          toast({
            variant: 'destructive',
            title: 'Stop Download Error',
            description: `Could not stop download with controller ${controllerId}`,
            duration: 3000,
          });
          return;
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Stop Download Error',
          description: `Error stopping download with controller ${controllerId}`,
          duration: 3000,
        });
        return;
      }
    }

    try {
      let success = false;

      if (deleteFolder) {
        // Get the parent folder path
        const folderPath = downloadLocation.replace(/(\/|\\)[^/\\]+$/, '');
        success = await window.downlodrFunctions.deleteFolder(folderPath);

        if (success) {
          deleteDownload(downloadId);
          toast({
            variant: 'success',
            title: 'Folder Deleted',
            description:
              'Folder and its contents have been deleted successfully',
            duration: 3000,
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description:
              'Failed to delete folder. It may not exist or be in use.',
            duration: 3000,
          });
        }
      } else {
        // Original file deletion logic
        success = await window.downlodrFunctions.deleteFile(downloadLocation);

        if (success) {
          deleteDownload(downloadId);
          toast({
            variant: 'success',
            title: 'File Deleted',
            description: 'File has been deleted successfully',
            duration: 3000,
          });
        } else {
          // Handle file not found case
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
              ...download,
            },
          };
          handleFileNotExistModal(downloadItem);
        }
      }
    } catch (error) {
      // Handle error case
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
          ...download,
        },
      };
      handleFileNotExistModal(downloadItem);
      console.error('Error deleting:', error);
    }
    setContextMenu({ downloadId: null, x: 0, y: 0 });
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
    console.log(downloadLocation, downloadId);
    if (downloadLocation) {
      try {
        const exists = await window.downlodrFunctions.fileExists(
          downloadLocation,
        );
        if (exists) {
          window.downlodrFunctions.openVideo(downloadLocation);
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
    setDebugDrag(`Dragging: ${columnId}`);
    // class to the body  for global drag state
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

  // effect to cleanup drag state if dragging is interrupted
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

  // rename modal state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameDownloadId, setRenameDownloadId] = useState<string>('');
  const [renameCurrentName, setRenameCurrentName] = useState<string>('');

  // renameDownload function from store
  const renameDownload = useDownloadStore((state) => state.renameDownload);

  // rename handler
  const handleRename = (downloadId: string, currentName: string) => {
    setRenameDownloadId(downloadId);
    setRenameCurrentName(currentName);
    setShowRenameModal(true);
  };

  // function to perform the rename
  const performRename = (newName: string) => {
    renameDownload(renameDownloadId, newName);
    setShowRenameModal(false);
    setRenameDownloadId('');
    setRenameCurrentName('');
  };

  return (
    <div className="w-full">
      <table className="w-full">
        <thead>
          <tr
            className="border-b text-left border-gray-200 dark:border-darkModeCompliment"
            onContextMenu={handleColumnHeaderContextMenu}
          >
            <th className="w-8 p-2">
              <input
                type="checkbox"
                className="ml-2 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
                checked={
                  allDownloads.length > 0 &&
                  selectedRowIds.length === allDownloads.length
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
                    checked={selectedRowIds.includes(download.id)}
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
                              content={download.name}
                              side="bottom"
                            >
                              <div className="line-clamp-2 break-words">
                                {download.name}
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
                                    content="Open folder"
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
                                    content="Open folder"
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
                                    <DownloadButton download={download} />
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
                                : 'No tags'
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
                                No tags
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

export default DownloadList;
