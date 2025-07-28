/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * A custom React Page Component for Status-Specific Downloads
 * This component dynamically displays downloads filtered by their status,
 * reusing the UI structure from the AllDownloads component.
 *
 * @returns JSX.Element - The rendered component displaying status-filtered downloads.
 */
import ActivityTracker from '@/Components/SubComponents/custom/ActivityTracker';
import ColumnHeaderContextMenu from '@/Components/SubComponents/custom/ColumnHeaderContextMenu';
import DownloadButton from '@/Components/SubComponents/custom/DownloadButton';
import DownloadContextMenu from '@/Components/SubComponents/custom/DownloadContextMenu';
import DownloadLogs from '@/Components/SubComponents/custom/DownloadLogs';
import ExpandedDownloadDetails from '@/Components/SubComponents/custom/ExpandedDownloadDetail';
import FormatSelector from '@/Components/SubComponents/custom/FormatSelector';
import { AnimatedLinearProgressBar } from '@/Components/SubComponents/custom/LinearProgress';
import RemoveModal from '@/Components/SubComponents/custom/RemoveModal';
import RenameModal from '@/Components/SubComponents/custom/RenameModal';
import ResizableHeader from '@/Components/SubComponents/custom/ResizableColumns/ResizableHeader';
import { useResizableColumns } from '@/Components/SubComponents/custom/ResizableColumns/useResizableColumns';
import ShareButton from '@/Components/SubComponents/custom/ShareButton';
import SpeedGraph from '@/Components/SubComponents/custom/SpeedGraph';
import StopModal from '@/Components/SubComponents/custom/StopModal';
import TooltipWrapper from '@/Components/SubComponents/custom/TooltipWrapper';
import { Skeleton } from '@/Components/SubComponents/shadcn/components/ui/skeleton';
import { toast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import { getExtractorIcon, getStatusIcon } from '@/DataFunctions/IconMapper';
import { DownloadItem } from '@/schema/componentSchema';
import useDownloadStore from '@/Store/downloadStore';
import { useMainStore } from '@/Store/mainStore';
import { usePluginStore } from '@/Store/pluginStore';
import { useTaskbarDownloadStore } from '@/Store/taskbarDownloadStore';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AiOutlineStop } from 'react-icons/ai';
import { FaRegClosedCaptioning } from 'react-icons/fa';
import { HiOutlineFolderOpen } from 'react-icons/hi';
import { HiChevronUpDown } from 'react-icons/hi2';
import { VscPlayCircle } from 'react-icons/vsc';
import { useParams } from 'react-router-dom';
import FileNotExistModal from '../Components/Main/Modal/FileNotExistModal';

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
    return `${diffInMinutes} m ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hr' : 'hrs'} ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  } else if (diffInWeeks < 4) {
    return `${diffInWeeks} ${diffInWeeks === 1 ? 'wk' : 'ws'} ago`;
  } else if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? 'mo' : 'mos'} ago`;
  } else {
    return `${diffInYears} ${diffInYears === 1 ? 'yr' : 'yrs'} ago`;
  }
};

export const formatFileSize = (bytes: number | undefined): string => {
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

// Status mapping for URL parameters to actual status values
const statusMapping: Record<string, string> = {
  'fetching-metadata': 'fetching metadata',
  'to-download': 'to download',
  paused: 'paused',
  initializing: 'initializing',
  failed: 'failed',
  finished: 'finished',
  downloading: 'downloading',
  all: 'all',
};

//  helper function before the StatusSpecificDownloads component
const calculateContextMenuPosition = (
  clientX: number,
  clientY: number,
  menuWidth = 220, // Increased from 200 to account for longer menu items
  menuHeight = 400, // Increased from 300 to account for plugin items and longer menus
) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  const margin = 10; // Margin from viewport edges
  let x = clientX;
  let y = clientY;

  // Adjust horizontal position if menu would overflow right edge
  if (clientX + menuWidth > viewportWidth - margin) {
    x = Math.max(margin, viewportWidth - menuWidth - margin);
  }

  // Adjust vertical position if menu would overflow bottom edge
  if (clientY + menuHeight > viewportHeight - margin) {
    y = Math.max(margin, viewportHeight - menuHeight - margin);
  }

  // Ensure menu doesn't go off the left edge
  if (x < margin) {
    x = margin;
  }

  // Ensure menu doesn't go off the top edge
  if (y < margin) {
    y = margin;
  }

  return { x: x + scrollX, y: y + scrollY };
};

// TypeScript interface for download objects used in context menu
interface ContextMenuDownload {
  id: string;
  status: string;
  controllerId?: string;
  location: string;
  name: string;
  videoUrl: string;
  extractorKey: string;
  size?: number;
  progress?: number;
  DateAdded: string;
  channelName?: string;
  thumnailsLocation?: string;
  autoCaptionLocation?: string;
}

const StatusSpecificDownloads = () => {
  // Get status from URL parameters
  const { status } = useParams<{ status: string }>();
  const currentStatus = status ? statusMapping[status] || status : '';
  const [thumbnailDataUrls, setThumbnailDataUrls] = useState<
    Record<string, string>
  >({});

  // Add window width state for responsive columns
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  // Calculate SpeedGraph height as 33% of app height
  const speedGraphHeight = Math.floor(windowHeight * 0.027);

  // Set page title based on status
  useEffect(() => {
    document.title = `${
      currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)
    } Downloads - Downlodr`;
  }, [currentStatus]);

  // All downloads from different states
  const history = useDownloadStore((state) => state.historyDownloads);
  const downloading = useDownloadStore((state) => state.downloading);
  const forDownloads = useDownloadStore((state) => state.forDownloads);
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );
  const queuedDownloads = useDownloadStore((state) => state.queuedDownloads);
  const deleteDownload = useDownloadStore((state) => state.deleteDownload);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>('dateAdded');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Tag and Category states and imports
  const availableTags = useDownloadStore((state) => state.availableTags);
  const addTag = useDownloadStore((state) => state.addTag);
  const removeTag = useDownloadStore((state) => state.removeTag);
  const availableCategories = useDownloadStore(
    (state) => state.availableCategories,
  );
  const addCategory = useDownloadStore((state) => state.addCategory);
  const removeCategory = useDownloadStore((state) => state.removeCategory);

  // Selected state management
  const selectedRowIds = useMainStore((state) => state.selectedRowIds);
  const setSelectedRowIds = useMainStore((state) => state.setSelectedRowIds);
  const setSelectedDownloads = useMainStore(
    (state) => state.setSelectedDownloads,
  );
  const [contextMenu, setContextMenu] = useState<{
    downloadId: string | null;
    x: number;
    y: number;
    downloadLocation?: string;
    controllerId?: string;
    downloadStatus?: string;
  }>({ downloadId: null, x: 0, y: 0 });
  const [selectedDownloadId, setSelectedDownloadId] = useState<string | null>(
    null,
  );
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Get visible columns from the store
  const visibleColumns = useMainStore((state) => state.visibleColumns);
  const { updateIsOpenPluginSidebar } = usePluginStore();

  const searchState = useTaskbarDownloadStore((state) => state.searchState);
  const { isSearchActive, searchQuery, searchResults } = searchState;

  // Downloads
  const [showFileNotExistModal, setShowFileNotExistModal] = useState(false);
  const [missingFiles, setMissingFiles] = useState<DownloadItem[]>([]);
  const selectedDownloads = useMainStore((state) => state.selectedDownloads);
  const [showActivityTracker, setShowActivityTracker] = useState(false);
  const [activityTrackerDownloadId, setActivityTrackerDownloadId] = useState<
    string | null
  >(null);

  // Memoize initial columns to prevent re-initialization on window resize
  const initialColumns = useMemo(
    () => [
      {
        id: 'name',
        width: Math.max(Math.floor(window.innerWidth * 0.3), 180),
        minWidth: 180,
      },
      { id: 'size', width: 50, minWidth: 50 },
      { id: 'format', width: 90, minWidth: 90 },
      { id: 'status', width: 90, minWidth: 90 },
      { id: 'speed', width: 60, minWidth: 60 },
      { id: 'dateAdded', width: 70, minWidth: 70 },
      { id: 'transcript', width: 20, minWidth: 20 },
      { id: 'thumbnail', width: 20, minWidth: 20 },
      { id: 'source', width: 20, minWidth: 20 },
      { id: 'action', width: 10, minWidth: 10 },
    ],
    [],
  ); // Empty dependency array ensures this only runs once

  // Call the hook with visible column IDs
  const {
    columns,
    startResizing,
    startDragging,
    handleDragOver,
    handleDrop,
    cancelDrag,
    dragging,
    dragOverIndex,
  } = useResizableColumns(initialColumns, visibleColumns);

  // PERFORMANCE OPTIMIZATION: Memoize expensive computations
  // Combine and process downloads only when dependencies change
  const allDownloads = useMemo(() => {
    let combined;

    // If search is active, use search results
    if (isSearchActive) {
      combined = searchResults;
    } else {
      combined = [
        ...forDownloads,
        ...downloading,
        ...finishedDownloads,
        ...history,
        ...queuedDownloads,
      ]
        .filter(
          (download, index, self) =>
            index === self.findIndex((d) => d.id === download.id),
        )
        // Filter by status if we're on a status-specific page
        .filter((download) => {
          if (!currentStatus) return true; // If no status filter, show all
          if (currentStatus.toLowerCase() === 'all') return true; // Show all for 'all' status
          return download.status.toLowerCase() === currentStatus.toLowerCase();
        })
        .sort((a, b) => {
          // Apply sorting based on sortColumn and sortDirection
          switch (sortColumn) {
            case 'name':
              return sortDirection === 'asc'
                ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name);
            case 'size': {
              const sizeA = a.size || 0;
              const sizeB = b.size || 0;
              return sortDirection === 'asc' ? sizeA - sizeB : sizeB - sizeA;
            }
            case 'format': {
              const formatA = a.ext || '';
              const formatB = b.ext || '';
              return sortDirection === 'asc'
                ? formatA.localeCompare(formatB)
                : formatB.localeCompare(formatA);
            }
            case 'status': {
              return sortDirection === 'asc'
                ? a.status.localeCompare(b.status)
                : b.status.localeCompare(a.status);
            }
            case 'speed': {
              // Handle speed sorting (numbers with units)
              const speedA = a.speed
                ? parseFloat(a.speed.split(' ')[0]) || 0
                : 0;
              const speedB = b.speed
                ? parseFloat(b.speed.split(' ')[0]) || 0
                : 0;
              return sortDirection === 'asc'
                ? speedA - speedB
                : speedB - speedA;
            }
            case 'dateAdded': {
              return sortDirection === 'asc'
                ? new Date(a.DateAdded).getTime() -
                    new Date(b.DateAdded).getTime()
                : new Date(b.DateAdded).getTime() -
                    new Date(a.DateAdded).getTime();
            }
            case 'source': {
              const sourceA = a.extractorKey || '';
              const sourceB = b.extractorKey || '';
              return sortDirection === 'asc'
                ? sourceA.localeCompare(sourceB)
                : sourceB.localeCompare(sourceA);
            }
            case 'thumbnail': {
              const sourceA = a.extractorKey || '';
              const sourceB = b.extractorKey || '';
              return sortDirection === 'asc'
                ? sourceA.localeCompare(sourceB)
                : sourceB.localeCompare(sourceA);
            }
            case 'transcript': {
              const sourceA = a.extractorKey || '';
              const sourceB = b.extractorKey || '';
              return sortDirection === 'asc'
                ? sourceA.localeCompare(sourceB)
                : sourceB.localeCompare(sourceA);
            }
            default: {
              return sortDirection === 'asc'
                ? new Date(a.DateAdded).getTime() -
                    new Date(b.DateAdded).getTime()
                : new Date(b.DateAdded).getTime() -
                    new Date(a.DateAdded).getTime();
            }
          }
        });
    }

    return combined;
  }, [
    forDownloads,
    downloading,
    finishedDownloads,
    history,
    queuedDownloads,
    currentStatus,
    sortColumn,
    sortDirection,
    isSearchActive,
    searchQuery,
  ]);

  // Memoize display columns computation
  const displayColumns = useMemo(() => {
    return columns.filter(
      (column) =>
        visibleColumns.includes(column.id) ||
        ['name', 'status', 'format', 'action'].includes(column.id),
    );
  }, [columns, visibleColumns]);

  // Memoize display columns with indices
  const displayColumnsWithIndices = useMemo(() => {
    return displayColumns.map((column, index) => ({
      ...column,
      displayIndex: index,
    }));
  }, [displayColumns]);

  const selectedDownload = useMemo(() => {
    return selectedDownloadId
      ? allDownloads.find((d) => d.id === selectedDownloadId)
      : null;
  }, [selectedDownloadId, allDownloads]);

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

  // Map the displayColumns to have correct indices for drag and drop
  // This line is now handled by the memoized displayColumnsWithIndices above

  // PERFORMANCE OPTIMIZATION: Memoize event handlers
  const handleFileNotExistModal = useCallback(
    async (contextDownload: DownloadItem | null = null) => {
      const missing = [];
      // If a specific download is provided via context menu, check only that one
      const downloadsToCheck = contextDownload
        ? [contextDownload]
        : selectedDownloads;
      // Check each download to see if it exists
      for (const download of downloadsToCheck) {
        if (download.status === 'finished' && download.location) {
          const fullDownloadLocation =
            await window.downlodrFunctions.joinDownloadPath(
              download.location,
              download.downloadName,
            );
          const exists = await window.downlodrFunctions.fileExists(
            fullDownloadLocation,
          );
          if (!exists) {
            missing.push(download);
          }
        }
      }

      // Set the missing files and show the modal if any were found
      if (missing.length > 0) {
        // Filter and ensure all items are valid DownloadItem objects
        const validMissingFiles = missing.filter(
          (item): item is DownloadItem =>
            'videoUrl' in item && item.videoUrl !== undefined,
        );
        setMissingFiles(validMissingFiles);
        setShowFileNotExistModal(true);
      }
    },
    [selectedDownloads],
  );

  // Handle column header click for sorting
  const handleSortClick = useCallback(
    (column: string) => {
      if (sortColumn === column) {
        // Toggle direction if same column
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        // Set new column and default to desc
        setSortColumn(column);
        setSortDirection('desc');
      }
    },
    [sortColumn, sortDirection],
  );

  // Function to render sort indicator
  const renderSortIndicator = useCallback(
    (column: string) => {
      if (sortColumn !== column) {
        return (
          <HiChevronUpDown
            size={14}
            className="flex-shrink-0 dark:text-gray-400"
          />
        );
      }

      if (sortDirection === 'asc') {
        return (
          <HiChevronUpDown size={14} className="flex-shrink-0 rotate-180" />
        );
      } else {
        return <HiChevronUpDown size={14} className="flex-shrink-0" />;
      }
    },
    [sortColumn, sortDirection],
  );

  //  new state for the column header context menu
  const [columnHeaderContextMenu, setColumnHeaderContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
  }>({ x: 0, y: 0, visible: false });

  //  handler for the column header right-click
  const handleColumnHeaderContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Close any active download context menu first
    setContextMenu({ downloadId: null, x: 0, y: 0 });
    // Get the table's position
    const tableRect = e.currentTarget.getBoundingClientRect();

    // Calculate position relative to the table/header
    const x = e.clientX - tableRect.left + 2; // Small offset for better appearance
    const y = e.clientY - tableRect.top + window.scrollY + 2;

    setColumnHeaderContextMenu({
      x: x,
      y: y,
      visible: true,
    });
  }, []);

  //  to close the column header context menu
  const handleCloseColumnHeaderContextMenu = useCallback(() => {
    setColumnHeaderContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  // Handle toggle column visibility
  const handleToggleColumn = useCallback(
    (columnId: string) => {
      const newVisibleColumns = visibleColumns.includes(columnId)
        ? visibleColumns.filter((id) => id !== columnId)
        : [...visibleColumns, columnId];

      useMainStore.getState().setVisibleColumns(newVisibleColumns);
    },
    [visibleColumns],
  );

  // Add state to track menu transitions
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Add ref to track timeout for cleanup
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  // PERFORMANCE OPTIMIZATION: Optimize thumbnail loading
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

  // Optimize thumbnail loading effect
  useEffect(() => {
    if (allDownloads.length > 0) {
      loadThumbnails(allDownloads);
    }
  }, [allDownloads, loadThumbnails]);

  // Memoize column display name function
  const getColumnDisplayName = useCallback((columnId: string): string => {
    const columnMappings: Record<string, string> = {
      name: 'Title',
      size: 'Size',
      format: 'Format',
      status: 'Status',
      speed: 'Speed',
      dateAdded: 'Date Added',
      thumbnail: 'Thumbnail',
      transcript: 'Caption',
      source: 'Source',
      action: 'Action',
    };

    return columnMappings[columnId] || columnId;
  }, []);

  // Memoize column options
  const columnOptions = useMemo(
    () => [
      { id: 'name', label: 'Title', required: true },
      { id: 'action', label: 'Action', required: true },

      { id: 'format', label: 'Format', required: true },
      { id: 'status', label: 'Status', required: true },
      { id: 'speed', label: 'Speed', required: false },
      { id: 'dateAdded', label: 'Date Added', required: false },
      { id: 'source', label: 'Source', required: false },
      { id: 'transcript', label: 'Closed Captions', required: false },
      { id: 'thumbnail', label: 'Thumbnail', required: false },
      { id: 'size', label: 'Size', required: false },
    ],
    [],
  );

  // Memoize menu item count calculation
  const getMenuItemCount = useCallback(
    (downloadStatus: string, pluginCount: number) => {
      let baseCount = 0;
      switch (downloadStatus) {
        case 'finished':
          baseCount = 6; // Play, View Folder, Remove, Tags, Category
          break;
        case 'to download':
          baseCount = 7; // Start, View Folder, Rename, Remove, Tags, Category
          break;
        case 'paused':
        case 'downloading':
        case 'initializing':
          baseCount = 6; // View Folder, Pause/Start, Stop, Tags, Category
          break;
        default:
          baseCount = 6;
      }
      // Plugins: if <=4, add all; if >4, add just 1 for the Plugins button
      return baseCount + (pluginCount > 3 ? 1 : pluginCount);
    },
    [],
  );

  const handleContextMenu = async (
    event: React.MouseEvent,
    download: ContextMenuDownload,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    // Clear any pending transitions to prevent race conditions
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    // Close any active column header context menu first
    updateIsOpenPluginSidebar(false);
    setColumnHeaderContextMenu({
      ...columnHeaderContextMenu,
      visible: false,
    });

    // Pre-calculate values to avoid stale closures
    const downloadId = download.id;
    const downloadStatus = download.status;
    const controllerId = download.controllerId;

    // Get plugin count from the window.plugins API
    const pluginCount = await window.plugins
      .getMenuItems('download-context')
      .then((items) => items.length);

    // Calculate menu height
    const itemHeight = 40; // px
    const menuItemCount = getMenuItemCount(downloadStatus, pluginCount);
    const menuHeight = menuItemCount * itemHeight;
    const margin = 10;

    // Calculate Y position
    let y = event.clientY;
    if (y + menuHeight > window.innerHeight - margin) {
      y = Math.max(margin, window.innerHeight - menuHeight - margin);
    }

    // Calculate X position (keep your existing logic or use calculateContextMenuPosition for X)
    let x = event.clientX;
    const menuWidth = 220;
    if (x + menuWidth > window.innerWidth - margin) {
      x = Math.max(margin, window.innerWidth - menuWidth - margin);
    }

    // Pre-fetch the download location to avoid async issues in timeout
    const downloadLocation = await window.downlodrFunctions.joinDownloadPath(
      download.location,
      download.name,
    );

    // Check if a context menu is already open
    const isMenuAlreadyOpen = contextMenu.downloadId !== null;

    if (isMenuAlreadyOpen) {
      // If a menu is already open, implement the "blink" behavior like Windows File Explorer
      setIsTransitioning(true);

      // First, hide the current menu
      setContextMenu({ downloadId: null, x: 0, y: 0 });

      // After a brief delay, show the new menu
      transitionTimeoutRef.current = setTimeout(() => {
        // Double-check component is still mounted and timeout wasn't cleared
        if (transitionTimeoutRef.current) {
          // Batch all state updates together
          setContextMenu({
            downloadId,
            x,
            y,
            downloadLocation,
            downloadStatus,
            controllerId,
          });
          setSelectedDownloadId(downloadId);
          setIsTransitioning(false);

          // Clear the ref
          transitionTimeoutRef.current = null;
        }
      }, 120); // Back to 120ms for visible blink effect
    } else {
      // If no menu is open, show immediately (no blink)
      setContextMenu({
        downloadId,
        x,
        y,
        downloadLocation,
        downloadStatus,
        controllerId,
      });
      setSelectedDownloadId(downloadId);
    }
  };

  const handleShowLog = (downloadId: string) => {
    setLogModalDownloadId(downloadId);
    setShowLogModal(true);
  };

  const handleShowActivityTracker = (downloadId: string) => {
    setActivityTrackerDownloadId(downloadId);
    setShowActivityTracker(true);
  };

  //Context Menu actons

  const handleRetry = (downloadId: string) => {
    // Get fresh state each time
    const currentDownload = allDownloads.find((d) => d.id === downloadId);
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
      0,
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
    deleteDownload(downloadId);
    toast({
      variant: 'success',
      title: 'Download Retried',
      description: 'Download has been retried successfully',
      duration: 3000,
    });
  };

  const handlePause = async (downloadId: string, downloadLocation?: string) => {
    // Get fresh state each time
    const { downloading, deleteDownloading } = useDownloadStore.getState();
    const currentDownload = downloading.find((d) => d.id === downloadId);
    const { updateDownloadStatus } = useDownloadStore.getState();

    if (currentDownload?.status === 'paused') {
      // Check if this is an m4a download and handle existing partial file
      const isM4aDownload =
        currentDownload.ext === 'm4a' || currentDownload.audioExt === 'm4a';
      console.log('isM4aDownload', isM4aDownload);

      if (
        isM4aDownload &&
        currentDownload.location &&
        currentDownload.downloadName
      ) {
        console.log('yesss');

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
            if (deleteSuccess) {
              console.log(`Deleted existing partial m4a file: ${fullFilePath}`);
            } else {
              console.warn(
                `Failed to delete existing partial m4a file: ${fullFilePath}`,
              );
            }
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

  const handleViewFile = async (
    downloadLocation?: string,
    downloadId?: string,
  ) => {
    if (downloadLocation) {
      const download = allDownloads.find((d) => d.id === downloadId);

      try {
        const exists = await window.downlodrFunctions.fileExists(
          downloadLocation,
        );
        if (exists) {
          window.downlodrFunctions.openVideo(downloadLocation);
        } else {
          toast({
            variant: 'destructive',
            title: 'No Download Location',
            description: 'Invalid Download Location',
            duration: 3000,
          });
        }
      } catch (error) {
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
  const handleViewDownload = async (
    downloadLocation?: string,
    downloadId?: string,
  ) => {
    if (downloadLocation) {
      const download = allDownloads.find((d) => d.id === downloadId);

      try {
        const fullDownloadLocation =
          await window.downlodrFunctions.joinDownloadPath(
            downloadLocation,
            download.name,
          );
        const exists = await window.downlodrFunctions.fileExists(
          fullDownloadLocation,
        );
        if (exists) {
          window.downlodrFunctions.openVideo(fullDownloadLocation);
        } else {
          // If the file doesn't exist, find the download and show the modal
          if (downloadId) {
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
          } else {
            // In case we don't have the download ID, show a simple toast
            if (downloadId) {
              const download = allDownloads.find((d) => d.id === downloadId);
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

  const handleStop = (
    downloadId: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => {
    const {
      downloading,
      deleteDownloading,
      forDownloads,
      removeFromForDownloads,
      processQueue,
    } = useDownloadStore.getState();
    const currentDownload = downloading.find((d) => d.id === downloadId);
    const currentForDownload = forDownloads.find((d) => d.id === downloadId);

    if (currentDownload?.status === 'paused') {
      deleteDownloading(downloadId);
      toast({
        variant: 'success',
        title: 'Download Stopped',
        description: 'Download has been stopped successfully',
        duration: 3000,
      });
    } else if (currentForDownload?.status === 'to download') {
      removeFromForDownloads(downloadId);
      toast({
        variant: 'success',
        title: 'Download Stopped',
        description: 'Download has been stopped successfully',
        duration: 3000,
      });
      processQueue();
    } else {
      if (downloading && downloading.length > 0) {
        downloading.forEach(async (download) => {
          if (download.controllerId) {
            try {
              const success = await window.ytdlp.killController(
                download.controllerId,
              );
              if (success) {
                deleteDownloading(download.id);
                toast({
                  variant: 'success',
                  title: 'Download Stopped',
                  description: 'Download has been stopped successfully',
                  duration: 3000,
                });
                processQueue();
              }
            } catch (error) {
              toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to stop download',
                duration: 3000,
              });
            }
          }
        });
      }
    }

    setContextMenu({ downloadId: null, x: 0, y: 0 });
  };

  const handleForceStart = (
    downloadId: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => {
    setContextMenu({ downloadId: null, x: 0, y: 0 });
  };

  const handleRemove = async (
    downloadLocation?: string,
    downloadId?: string,
    controllerId?: string,
    deleteFolder?: boolean,
  ) => {
    if (!downloadLocation || !downloadId) return;

    // Get the download status
    const download = allDownloads.find((d) => d.id === downloadId);
    if (!download) return;

    // Get processQueue function
    const { processQueue } = useDownloadStore.getState();

    // Handle pending downloads
    if (download.status === 'to download') {
      deleteDownload(downloadId);
      toast({
        variant: 'success',
        title: 'Download Deleted',
        description: 'Download has been deleted successfully',
        duration: 3000,
      });
      // Process queue after removing a pending download
      processQueue();
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
      // Process queue after removing a paused/cancelled download
      processQueue();
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
        // Process queue after stopping an active download
        processQueue();
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
        // const folderPath = downloadLocation.replace(/(\/|\\)[^/\\]+$/, '');
        success = await window.downlodrFunctions.deleteFolder(downloadLocation);

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
    }
    setContextMenu({ downloadId: null, x: 0, y: 0 });
  };

  const handleCheckboxChange = useCallback(
    (downloadId: string) => {
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
        setSelectedDownloads(resolvedData);
      });
    },
    [selectedRowIds, allDownloads, setSelectedRowIds, setSelectedDownloads],
  );

  const handleSelectAll = useCallback(() => {
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
      setSelectedDownloads(resolvedData);
    });
  }, [selectedRowIds, allDownloads, setSelectedRowIds, setSelectedDownloads]);

  const handleCloseContextMenu = () => {
    // Clear any pending transitions
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    // Batch state updates
    setContextMenu({ downloadId: null, x: 0, y: 0 });
    setSelectedDownloadId(null);
    setIsTransitioning(false);
  };

  const handleRowClick = useCallback(
    (downloadId: string) => {
      // Find the download object
      const clickedDownload = allDownloads.find((d) => d.id === downloadId);

      if (!clickedDownload) {
        return;
      }

      // Set the selected download ID - this is crucial for the details panel
      setSelectedDownloadId(downloadId);

      // Update the expanded row state
      setExpandedRowId(downloadId === expandedRowId ? null : downloadId);

      // Update selected row IDs for highlighting
      // setSelectedRowIds([downloadId]);
    },
    [allDownloads, expandedRowId],
  );

  // Find current tags for the selected download
  const getCurrentTags = useCallback(
    (downloadId: string) => {
      const download = allDownloads.find((d) => d.id === downloadId);
      return download?.tags || [];
    },
    [allDownloads],
  );

  const getCurrentCategories = useCallback(
    (downloadId: string) => {
      const download = allDownloads.find((d) => d.id === downloadId);
      return download?.category || [];
    },
    [allDownloads],
  );

  const handleViewFolder = async (
    downloadLocation?: string,
    filePath?: string,
  ) => {
    if (!downloadLocation) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to view folder',
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
        description: 'Failed to view folder',
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

  // Update click outside handler to clean up timeouts
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't clear selection if clicking inside the table or the details panel
      const target = event.target as HTMLElement;
      const isClickInsideTable = target.closest('table');
      const isClickInsideDetailsPanel = target.closest(
        '.download-details-panel',
      );

      // Check if we're clicking on a context menu by checking for common context menu classes
      const isClickInsideContextMenu =
        target.closest(
          '.fixed.bg-white.dark\\:bg-darkMode.border.rounded-md.shadow-lg',
        ) ||
        target.closest(
          '.fixed.bg-white.dark\\:bg-darkMode.border.rounded-md.shadow-lg.py-1.z-50',
        ) ||
        target.closest('div[style*="position: fixed"]');

      // Always close context menu if we're clicking on a different row
      const clickedRow = target.closest('tr');
      const isClickOnDifferentRow =
        clickedRow &&
        contextMenu.downloadId &&
        !clickedRow.querySelector(
          `[data-download-id="${contextMenu.downloadId}"]`,
        );

      if (
        (!isClickInsideTable &&
          !isClickInsideDetailsPanel &&
          !isClickInsideContextMenu) ||
        isClickOnDifferentRow
      ) {
        // Clear any pending transitions
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
          transitionTimeoutRef.current = null;
        }

        // Batch state updates
        setContextMenu({ downloadId: null, x: 0, y: 0 });
        setSelectedDownloadId(null);
        setColumnHeaderContextMenu((prev) => ({ ...prev, visible: false }));
        setIsTransitioning(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu.downloadId]);

  // Add rename modal state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameDownloadId, setRenameDownloadId] = useState<string>('');
  const [renameCurrentName, setRenameCurrentName] = useState<string>('');

  // Add remove modal state
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeDownloadId, setRemoveDownloadId] = useState<string>('');
  const [removeDownloadLocation, setRemoveDownloadLocation] =
    useState<string>('');
  const [removeControllerId, setRemoveControllerId] = useState<string>('');

  // Add stop modal state
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopDownloadId, setStopDownloadId] = useState<string>('');
  const [stopDownloadLocation, setStopDownloadLocation] = useState<string>('');
  const [stopControllerId, setStopControllerId] = useState<string>('');

  // log modal state
  const [showLogModal, setShowLogModal] = useState(false);
  const [logModalDownloadId, setLogModalDownloadId] = useState<string>('');

  // Get renameDownload function from store
  const renameDownload = useDownloadStore((state) => state.renameDownload);

  // Add rename handler
  const handleRename = useCallback(
    (downloadId: string, currentName: string) => {
      setRenameDownloadId(downloadId);
      setRenameCurrentName(currentName);
      setShowRenameModal(true);
    },
    [],
  );

  // Add remove handler
  const handleShowRemoveModal = useCallback(
    (downloadId: string, downloadLocation?: string, controllerId?: string) => {
      setRemoveDownloadId(downloadId);
      setRemoveDownloadLocation(downloadLocation || '');
      setRemoveControllerId(controllerId || '');
      setShowRemoveModal(true);
    },
    [],
  );

  // Add stop handler
  const handleShowStopModal = useCallback(
    (downloadId: string, downloadLocation?: string, controllerId?: string) => {
      setStopDownloadId(downloadId);
      setStopDownloadLocation(downloadLocation || '');
      setStopControllerId(controllerId || '');
      setShowStopModal(true);
    },
    [],
  );

  // Add function to perform the rename
  const performRename = useCallback(
    (newName: string) => {
      renameDownload(renameDownloadId, newName);
      setShowRenameModal(false);
      setRenameDownloadId('');
      setRenameCurrentName('');
    },
    [renameDownload, renameDownloadId],
  );

  // Add function to perform the remove
  const performRemove = useCallback(
    (deleteFolder?: boolean) => {
      handleRemove(
        removeDownloadLocation,
        removeDownloadId,
        removeControllerId,
        deleteFolder,
      );
      setShowRemoveModal(false);
      setRemoveDownloadId('');
      setRemoveDownloadLocation('');
      setRemoveControllerId('');
    },
    [removeDownloadLocation, removeDownloadId, removeControllerId],
  );

  // Add function to perform the stop
  const performStop = useCallback(() => {
    // Get processQueue function
    const { processQueue } = useDownloadStore.getState();
    handleStop(stopDownloadId, stopDownloadLocation, stopControllerId);
    processQueue();
    setShowStopModal(false);
    setStopDownloadId('');
    setStopDownloadLocation('');
    setStopControllerId('');
  }, [stopDownloadId, stopDownloadLocation, stopControllerId]);

  // Add effect to handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Table container with scrolling */}
      <div className="flex-grow overflow-auto">
        <div className="min-w-full">
          <table className="min-w-full table-fixed">
            <thead className="bg-titleBar dark:bg-alternateBlack">
              <tr
                className="border-b border-t text-left font-sans dark:border-inputDarkModeBorder font-bold"
                onContextMenu={handleColumnHeaderContextMenu}
              >
                <th className="w-6 px-2 py-1">
                  <input
                    type="checkbox"
                    className="mt-2 ml-2 rounded custom-white-checkmark"
                    style={{
                      ...(document.documentElement.classList.contains(
                        'dark',
                      ) && {
                        backgroundColor: '#272727',
                        borderColor: '#6b7280',
                      }),
                    }}
                    checked={selectedRowIds.length === allDownloads.length}
                    onChange={handleSelectAll}
                  />
                </th>
                {displayColumns.map((column, displayIndex) => {
                  if (column.id === 'end') {
                    return <th key={column.id} className="w-18 p-2"></th>;
                  }

                  // Find original index in the full columns array
                  const originalIndex = columns.findIndex(
                    (col) => col.id === column.id,
                  );

                  return (
                    <ResizableHeader
                      key={column.id}
                      width={column.width}
                      onResizeStart={(e) => startResizing(column.id, e.clientX)}
                      index={originalIndex} // Use the original index from the full columns array
                      onDragStart={startDragging}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onDragEnd={cancelDrag}
                      isDragging={dragging?.columnId === column.id}
                      isDragOver={dragOverIndex === originalIndex}
                      columnId={column.id}
                      isLastColumn={displayIndex === displayColumns.length - 1}
                    >
                      <div
                        className="flex items-center cursor-pointer whitespace-nowrap"
                        onClick={() => handleSortClick(column.id)}
                      >
                        {getColumnDisplayName(column.id)}
                        {renderSortIndicator(column.id)}
                      </div>
                    </ResizableHeader>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {allDownloads.map((download, index) => (
                <React.Fragment key={download.id}>
                  <tr
                    className={`border-b-2 hover:bg-gray-50 dark:border-[#27272ACC] dark:hover:bg-darkModeHover cursor-pointer ${
                      selectedDownloadId === download.id
                        ? 'bg-blue-50 dark:bg-gray-600'
                        : index % 2 === 0
                        ? 'dark:bg-darkMode'
                        : 'bg-titleBar dark:bg-alternateBlack'
                    }`}
                    onContextMenu={(e) => handleContextMenu(e, download)}
                    onClick={() => {
                      updateIsOpenPluginSidebar(false);
                      handleRowClick(download.id);
                      handleCheckboxChange(download.id);
                    }}
                    data-download-id={download.id}
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
                        className="ml-2 mt-1 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
                        checked={selectedRowIds.includes(download.id)}
                        onChange={() => handleCheckboxChange(download.id)}
                      />
                    </td>
                    {displayColumns.map((column) => {
                      switch (column.id) {
                        case 'name':
                          return (
                            <td
                              key={column.id}
                              style={{ width: column.width }}
                              className="p-2 dark:text-gray-200"
                            >
                              {download.status === 'fetching metadata' ? (
                                <div className="space-y-1">
                                  <Skeleton
                                    className="h-4 rounded-[3px]"
                                    style={{ width: `${column.width - 20}px` }}
                                  />
                                  <Skeleton
                                    className="h-4 rounded-[3px]"
                                    style={{ width: `${column.width - 60}px` }}
                                  />
                                </div>
                              ) : (
                                <div className="line-clamp-2 break-words flex justify-start items-start">
                                  <div>
                                    <TooltipWrapper
                                      content={download.name}
                                      side="bottom"
                                      contentClassname="text-start justify-start"
                                    >
                                      <div>
                                        <span
                                          className={` line-clamp-1 break-words break-all font-semibold`}
                                        >
                                          {download.name}
                                        </span>
                                      </div>
                                    </TooltipWrapper>

                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {download.channelName}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        case 'size':
                          return (
                            <td
                              key={column.id}
                              style={{ width: column.width }}
                              className="px-2 py-2 dark:text-gray-200 text-left"
                            >
                              {download.status === 'fetching metadata' ? (
                                <div className="flex justify-center items-center">
                                  <Skeleton className="h-8 w-[50px] rounded-[3px]" />
                                </div>
                              ) : (
                                <span className="whitespace-nowrap overflow-hidden">
                                  {formatFileSize(download.size)}
                                </span>
                              )}
                            </td>
                          );
                        case 'format':
                          return (
                            <td
                              key={column.id}
                              style={{
                                width: Math.max(column.width),
                                minWidth: '70px',
                              }}
                              className="p-2 text-center align-middle"
                            >
                              {download.status === 'fetching metadata' ? (
                                <div className="flex justify-center items-center w-full">
                                  <Skeleton
                                    className="h-8 rounded-[3px]"
                                    style={{
                                      width: `${Math.max(
                                        column.width - 30,
                                        90,
                                      )}px`,
                                    }}
                                  />
                                </div>
                              ) : download.status === 'finished' ? (
                                <div className="font-medium text-sm text-gray-600 dark:text-gray-300 text-center">
                                  {download.ext ||
                                    download.audioExt ||
                                    'Unknown'}
                                </div>
                              ) : (
                                <div className="w-full">
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
                                </div>
                              )}
                            </td>
                          );
                        case 'status':
                          return (
                            <td
                              key={column.id}
                              style={{ width: column.width - 10 }}
                              className="p-1"
                            >
                              {download.status === 'cancelled' ||
                              download.status === 'initializing' ||
                              download.status === 'queued' ||
                              download.status === 'fetching metadata' ||
                              download.status === 'failed' ? (
                                <div className="flex justify-center">
                                  <TooltipWrapper
                                    content={
                                      download.status.charAt(0).toUpperCase() +
                                      download.status.slice(1)
                                    }
                                    side="bottom"
                                  >
                                    <div className="flex items-center justify-center space-x-2">
                                      {getStatusIcon(download.status, 20)}
                                    </div>
                                  </TooltipWrapper>
                                </div>
                              ) : download.status === 'finished' ? (
                                <div className="flex items-center space-x-2 justify-center">
                                  <button
                                    className="relative flex items-center text-sm underline"
                                    style={{
                                      color: getStatusColor(download.status),
                                    }}
                                  >
                                    <TooltipWrapper
                                      content="View video"
                                      side="bottom"
                                    >
                                      <span>
                                        <VscPlayCircle
                                          size={20}
                                          className="ml-2 text-green-600 hover:text-green-400 transition-colors duration-200"
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            handleViewDownload(
                                              download.location,
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
                                        className="ml-2 hover:text-green-400 transition-colors"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          handleViewFolder(
                                            download.location,
                                            download.name,
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
                                </div>
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
                                <AnimatedLinearProgressBar
                                  status={download.status}
                                  max={100}
                                  min={0}
                                  value={download.progress}
                                  gaugePrimaryColor="#4CAF50"
                                  gaugeSecondaryColor="#EEEEEE"
                                  width={column.width - 10}
                                />
                              )}
                            </td>
                          );
                        case 'speed':
                          return (
                            <td
                              key={column.id}
                              style={{ width: column.width - 10 }}
                              className="pl-2 py-2 dark:text-gray-200 flex justify-center items-center"
                            >
                              {[
                                'downloading',
                                'finished',
                                'paused',
                                'failed',
                                'initializing',
                              ].includes(download.status) ? (
                                <div className="w-full">
                                  <SpeedGraph
                                    key={`speed-graph-${download.id}`}
                                    currentSpeed={download.speed}
                                    downloadStatus={download.status}
                                    downloadId={download.id}
                                    showHeader={false}
                                    height={25}
                                  />
                                </div>
                              ) : download.status === 'fetching metadata' ? (
                                <div className="space-y-1 flex justify-center items-center">
                                  <Skeleton className="h-8 w-[50px] rounded-[3px]" />
                                </div>
                              ) : (
                                <div className="flex justify-center w-full">
                                  <span>—</span>
                                </div>
                              )}
                            </td>
                          );
                        case 'dateAdded':
                          return (
                            <td
                              key={column.id}
                              style={{ width: column.width }}
                              className="p-2 dark:text-gray-200 ml-2 justify-center text-center"
                            >
                              <TooltipWrapper
                                content={new Date(
                                  download.DateAdded,
                                ).toLocaleDateString()}
                                side="bottom"
                              >
                                <div>
                                  {formatRelativeTime(download.DateAdded)}
                                </div>
                              </TooltipWrapper>
                            </td>
                          );
                        case 'thumbnail':
                          return (
                            <td
                              key={column.id}
                              style={{ width: column.width }}
                              className="p-2 dark:text-gray-200"
                            >
                              {download.status === 'fetching metadata' ? (
                                <div className=" w-full flex justify-center items-center">
                                  <Skeleton className="h-8 w-[50px] rounded-[3px]" />
                                </div>
                              ) : (download.status === 'finished' ||
                                  download.status === 'paused' ||
                                  download.status === 'downloading' ||
                                  download.status === 'failed' ||
                                  download.status === 'initializing') &&
                                download.thumnailsLocation &&
                                download.thumnailsLocation !== '—' ? (
                                <div className="flex justify-center items-center w-full">
                                  {thumbnailDataUrls[download.id] ? (
                                    <TooltipWrapper
                                      content="View full thumbnail"
                                      side="bottom"
                                    >
                                      <img
                                        src={thumbnailDataUrls[download.id]}
                                        alt="Thumbnail"
                                        className="h-10 object-cover rounded cursor-pointer hover:opacity-70 transition-opacity"
                                        onClick={() =>
                                          handleViewFile(
                                            download.thumnailsLocation,
                                            download.id,
                                          )
                                        }
                                        onError={(e) => {
                                          e.currentTarget.style.display =
                                            'none';
                                          e.currentTarget.parentElement.innerHTML =
                                            'Unable to load';
                                        }}
                                      />
                                    </TooltipWrapper>
                                  ) : (
                                    <TooltipWrapper
                                      content="Thumbnail not downloaded"
                                      side="bottom"
                                    >
                                      <span className="text-notAvailableStatus dark:text-darkModeNotAvailableStatus flex justify-center items-center text-center w-full">
                                        —
                                      </span>
                                    </TooltipWrapper>
                                  )}
                                </div>
                              ) : (
                                <TooltipWrapper
                                  content="Thumbnail not downloaded"
                                  side="bottom"
                                >
                                  <span className="text-notAvailableStatus dark:text-darkModeNotAvailableStatus flex justify-center items-center text-center w-full">
                                    —
                                  </span>
                                </TooltipWrapper>
                              )}
                            </td>
                          );
                        case 'transcript':
                          return (
                            <td
                              key={column.id}
                              style={{ width: column.width }}
                              className="dark:text-gray-200 outline-1 text-center align-middle justify-center"
                            >
                              {download.status === 'fetching metadata' ? (
                                <div className="space-y-1 flex justify-center items-center">
                                  <Skeleton className="h-8 w-[50px] rounded-[3px]" />
                                </div>
                              ) : download.autoCaptionLocation === '' ||
                                download.autoCaptionLocation === null ? (
                                <TooltipWrapper
                                  content="Transcript not downloaded"
                                  side="bottom"
                                >
                                  <span className="text-notAvailableStatus dark:text-darkModeNotAvailableStatus flex justify-center items-center text-center w-full">
                                    —
                                  </span>
                                </TooltipWrapper>
                              ) : download.autoCaptionLocation === undefined ? (
                                <TooltipWrapper
                                  content="Transcript not available"
                                  side="bottom"
                                >
                                  <span className="text-notAvailableStatus dark:text-darkModeNotAvailableStatus flex justify-center items-center text-center w-full">
                                    <AiOutlineStop
                                      size={20}
                                      className="text-red-500 hover:text-red-400 transition-colors duration-200"
                                    />
                                  </span>
                                </TooltipWrapper>
                              ) : (
                                <TooltipWrapper
                                  content="View transcript"
                                  side="bottom"
                                >
                                  <button
                                    onClick={() =>
                                      handleViewFile(
                                        download.autoCaptionLocation,
                                        download.id,
                                      )
                                    }
                                    className="text-availableStatus hover:underline flex justify-center items-center hover:text-green-400 transition-colors duration-200 w-full text-center"
                                  >
                                    <FaRegClosedCaptioning
                                      size={20}
                                      className="text-green-600 hover:text-green-400 transition-colors duration-200 text-center align-middle justify-center"
                                    />
                                  </button>
                                </TooltipWrapper>
                              )}
                            </td>
                          );
                        case 'source':
                          return (
                            <td
                              key={column.id}
                              style={{ width: column.width }}
                              className="p-2 dark:text-gray-200"
                            >
                              {download.status === 'fetching metadata' ? (
                                <div className="flex justify-center items-center">
                                  <Skeleton className="h-6 w-[25px] rounded-[3px]" />
                                </div>
                              ) : (
                                <TooltipWrapper
                                  content={download.extractorKey}
                                  side="bottom"
                                >
                                  <div className="line-clamp-2 break-words flex justify-center items-center text-lg">
                                    <a
                                      onClick={() =>
                                        window.downlodrFunctions.openExternalLink(
                                          download.videoUrl,
                                        )
                                      }
                                      className="hover:underline cursor-pointer hover:opacity-80 transition-opacity"
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
                                thumbnailLocation={
                                  thumbnailDataUrls[download.id]
                                }
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
        </div>
      </div>

      <div className="flex-shrink-0">
        <ExpandedDownloadDetails
          download={
            selectedDownload
              ? {
                  ...selectedDownload,
                  elapsed: selectedDownload.elapsed || 0,
                }
              : null
          }
        />
      </div>

      {/* Context Menus - keep these unchanged */}
      {contextMenu.downloadId &&
        !isTransitioning &&
        (() => {
          const download = allDownloads.find(
            (d) => d.id === contextMenu.downloadId,
          );
          return download ? (
            <DownloadContextMenu
              download={download}
              position={{ x: contextMenu.x, y: contextMenu.y }}
              onShowLog={handleShowLog}
              onShowActivityTracker={handleShowActivityTracker}
              onClose={handleCloseContextMenu}
              onRetry={handleRetry}
              onPause={handlePause}
              onStop={handleStop}
              onForceStart={handleForceStart}
              onRemove={handleRemove}
              onViewDownload={handleViewDownload}
              onViewFolder={handleViewFolder}
              onAddTag={addTag}
              onRemoveTag={removeTag}
              currentTags={getCurrentTags(contextMenu.downloadId)}
              availableTags={availableTags}
              onAddCategory={addCategory}
              onRemoveCategory={removeCategory}
              currentCategories={getCurrentCategories(contextMenu.downloadId)}
              availableCategories={availableCategories}
              onRename={handleRename}
              onShowRemoveModal={handleShowRemoveModal}
              onShowStopModal={handleShowStopModal}
            />
          ) : null;
        })()}

      <ColumnHeaderContextMenu
        position={{
          x: columnHeaderContextMenu.x,
          y: columnHeaderContextMenu.y,
        }}
        visible={columnHeaderContextMenu.visible}
        visibleColumns={visibleColumns}
        onToggleColumn={handleToggleColumn}
        onClose={handleCloseColumnHeaderContextMenu}
        columnOptions={columnOptions}
      />
      <FileNotExistModal
        isOpen={showFileNotExistModal}
        onClose={() => setShowFileNotExistModal(false)}
        selectedDownloads={missingFiles}
        download={missingFiles.length === 1 ? missingFiles[0] : null}
      />

      {/* Add the RenameModal */}
      <RenameModal
        isOpen={showRenameModal}
        onClose={() => {
          setShowRenameModal(false);
          setRenameDownloadId('');
          setRenameCurrentName('');
        }}
        onRename={performRename}
        currentName={renameCurrentName}
      />

      {/* Add the RemoveModal */}
      <RemoveModal
        isOpen={showRemoveModal}
        onClose={() => {
          setShowRemoveModal(false);
          setRemoveDownloadId('');
          setRemoveDownloadLocation('');
          setRemoveControllerId('');
        }}
        onConfirm={performRemove}
        message="Are you sure you want to remove this download?"
        allowFolderDeletion={true}
      />

      {/* Add the StopModal */}
      <StopModal
        isOpen={showStopModal}
        onClose={() => {
          setShowStopModal(false);
          setStopDownloadId('');
          setStopDownloadLocation('');
          setStopControllerId('');
        }}
        onConfirm={performStop}
        message="Are you sure you want to stop this download?"
      />

      {/* Only render ActivityTracker when it's actually open */}
      {showActivityTracker && (
        <ActivityTracker
          isOpen={showActivityTracker}
          onClose={() => setShowActivityTracker(false)}
          downloadId={activityTrackerDownloadId}
        />
      )}

      {/* Only render DownloadLogs when it's actually open */}
      {showLogModal && (
        <DownloadLogs
          isOpen={showLogModal}
          onClose={() => {
            setShowLogModal(false);
            setLogModalDownloadId('');
          }}
          downloadId={logModalDownloadId}
        />
      )}
    </div>
  );
};

export default StatusSpecificDownloads;
