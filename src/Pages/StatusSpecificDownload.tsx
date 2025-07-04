/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * A custom React Page Component for Status-Specific Downloads
 * This component dynamically displays downloads filtered by their status,
 * reusing the UI structure from the AllDownloads component.
 *
 * @returns JSX.Element - The rendered component displaying status-filtered downloads.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { HiChevronUpDown } from 'react-icons/hi2';
import { VscPlayCircle } from 'react-icons/vsc';
import { useParams } from 'react-router-dom';
import ColumnHeaderContextMenu from '../Components/SubComponents/custom/ColumnHeaderContextMenu';
import DownloadButton from '../Components/SubComponents/custom/DownloadButton';
/*import DownloadContextMenu, {
  ConfirmModal as RemoveModal,
  RenameModal,
  StopModal,
} from '../Components/SubComponents/custom/DownloadContextMenu'; */
import LogModal from '../Components/Main/Modal/LogModal';
import DownloadContextMenu from '../Components/SubComponents/custom/DownloadContextMenu';
import ExpandedDownloadDetails from '../Components/SubComponents/custom/ExpandedDownloadDetail';
import FileNotExistModal, {
  DownloadItem,
} from '../Components/SubComponents/custom/FileNotExistModal';
import FormatSelector from '../Components/SubComponents/custom/FormatSelector';
import { AnimatedCircularProgressBar } from '../Components/SubComponents/custom/RadialProgress';
import RemoveModal from '../Components/SubComponents/custom/RemoveModal';
import RenameModal from '../Components/SubComponents/custom/RenameModal';
import ResizableHeader from '../Components/SubComponents/custom/ResizableColumns/ResizableHeader';
import { useResizableColumns } from '../Components/SubComponents/custom/ResizableColumns/useResizableColumns';
import ShareButton from '../Components/SubComponents/custom/ShareButton';
import StopModal from '../Components/SubComponents/custom/StopModal';
import { Skeleton } from '../Components/SubComponents/shadcn/components/ui/skeleton';
import { toast } from '../Components/SubComponents/shadcn/hooks/use-toast';
import useDownloadStore from '../Store/downloadStore';
import { useMainStore } from '../Store/mainStore';
import { usePluginStore } from '../Store/pluginStore';

// Reuse helper functions from AllDownloads
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

// Add this helper function before the StatusSpecificDownloads component
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

const StatusSpecificDownloads = () => {
  // Get status from URL parameters
  const { status } = useParams<{ status: string }>();
  const currentStatus = status ? statusMapping[status] || status : '';
  const [thumbnailDataUrls, setThumbnailDataUrls] = useState<
    Record<string, string>
  >({});

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

  // Downloads
  const [showFileNotExistModal, setShowFileNotExistModal] = useState(false);
  const [missingFiles, setMissingFiles] = useState<DownloadItem[]>([]);
  const selectedDownloads = useMainStore((state) => state.selectedDownloads);
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
  } = useResizableColumns(
    [
      { id: 'name', width: 100, minWidth: 100 },
      { id: 'size', width: 65, minWidth: 65 },
      { id: 'format', width: 90, minWidth: 90 },
      { id: 'status', width: 110, minWidth: 110 },
      { id: 'speed', width: 100, minWidth: 100 },
      { id: 'dateAdded', width: 100, minWidth: 100 },
      { id: 'transcript', width: 20, minWidth: 20 },
      { id: 'thumbnail', width: 10, minWidth: 10 },
      { id: 'source', width: 20, minWidth: 20 },
      { id: 'action', width: 10, minWidth: 10 },
    ],
    visibleColumns,
  );

  // PERFORMANCE OPTIMIZATION: Memoize expensive computations
  // Combine and process downloads only when dependencies change
  const allDownloads = useMemo(() => {
    const combined = [
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
            const speedA = a.speed ? parseFloat(a.speed.split(' ')[0]) || 0 : 0;
            const speedB = b.speed ? parseFloat(b.speed.split(' ')[0]) || 0 : 0;
            return sortDirection === 'asc' ? speedA - speedB : speedB - speedA;
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
  ]);

  // Memoize display columns computation
  const displayColumns = useMemo(() => {
    return columns.filter(
      (column) =>
        visibleColumns.includes(column.id) ||
        ['name', 'status', 'format'].includes(column.id),
    );
  }, [columns, visibleColumns]);

  // Memoize display columns with indices
  const displayColumnsWithIndices = useMemo(() => {
    return displayColumns.map((column, index) => ({
      ...column,
      displayIndex: index,
    }));
  }, [displayColumns]);

  // Memoize selected download
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
          const exists = await window.downlodrFunctions.fileExists(
            download.location,
          );
          if (!exists) {
            missing.push(download);
          }
        }
      }

      // Set the missing files and show the modal if any were found
      if (missing.length > 0) {
        setMissingFiles(missing);
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

  // Add this new state for the column header context menu
  const [columnHeaderContextMenu, setColumnHeaderContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
  }>({ x: 0, y: 0, visible: false });

  // Add this handler for the column header right-click
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

  // Add this to close the column header context menu
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
      transcript: 'Captions',
      source: 'Source',
      action: 'Action',
    };

    return columnMappings[columnId] || columnId;
  }, []);

  // Memoize column options
  const columnOptions = useMemo(
    () => [
      { id: 'name', label: 'Title', required: true },
      { id: 'size', label: 'Size', required: false },
      { id: 'format', label: 'Format', required: true },
      { id: 'status', label: 'Status', required: true },
      { id: 'speed', label: 'Speed', required: false },
      { id: 'dateAdded', label: 'Date Added', required: false },
      { id: 'source', label: 'Source', required: false },
      { id: 'transcript', label: 'Closed Captions', required: false },
      { id: 'thumbnail', label: 'Thumbnail', required: false },
      { id: 'action', label: 'Action', required: false },
    ],
    [],
  );

  // Memoize menu item count calculation
  const getMenuItemCount = useCallback(
    (downloadStatus: string, pluginCount: number) => {
      // Base items for each status (adjust as needed for your menu)
      let baseCount = 0;
      switch (downloadStatus) {
        case 'finished':
          baseCount = 5; // Play, View Folder, Remove, Tags, Category
          break;
        case 'to download':
          baseCount = 6; // Start, View Folder, Rename, Remove, Tags, Category
          break;
        case 'paused':
        case 'downloading':
        case 'initializing':
          baseCount = 5; // View Folder, Pause/Start, Stop, Tags, Category
          break;
        default:
          baseCount = 5;
      }
      // Plugins: if <=4, add all; if >4, add just 1 for the Plugins button
      return baseCount + (pluginCount > 4 ? 1 : pluginCount);
    },
    [],
  );

  const handleContextMenu = async (
    event: React.MouseEvent,
    allDownloads: any,
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
    const downloadId = allDownloads.id;
    const downloadStatus = allDownloads.status;
    const controllerId = allDownloads.controllerId;

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
      allDownloads.location,
      allDownloads.name,
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

  //Context Menu actons

  const handleRetry = (downloadId: string) => {
    // Get fresh state each time
    console.log('HII FROM RETRY', downloadId);
    const { downloading, deleteDownloading } = useDownloadStore.getState();
    const currentDownload = allDownloads.find((d) => d.id === downloadId);
    const { updateDownloadStatus } = useDownloadStore.getState();

    const { addDownload } = useDownloadStore.getState();
    addDownload(
      currentDownload.videoUrl,
      currentDownload.name,
      currentDownload.downloadName,
      currentDownload.size,
      currentDownload.speed,
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
    deleteDownload(downloadId);
    toast({
      variant: 'success',
      title: 'Download Retried',
      description: 'Download has been retried successfully',
      duration: 3000,
    });
  };

  const handlePause = (downloadId: string, downloadLocation?: string) => {
    // Get fresh state each time
    const { downloading, deleteDownloading } = useDownloadStore.getState();
    const currentDownload = downloading.find((d) => d.id === downloadId);
    const { updateDownloadStatus } = useDownloadStore.getState();

    if (currentDownload?.status === 'paused') {
      const { addDownload } = useDownloadStore.getState();
      addDownload(
        currentDownload.videoUrl,
        currentDownload.name,
        currentDownload.downloadName,
        currentDownload.size,
        currentDownload.speed,
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
  const handleViewDownload = async (
    downloadLocation?: string,
    downloadId?: string,
  ) => {
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
            const download = allDownloads.find((d) => d.id === downloadId);
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
                console.log(
                  `Controller with ID ${download.controllerId} has been terminated.`,
                );
                toast({
                  variant: 'success',
                  title: 'Download Stopped',
                  description: 'Download has been stopped successfully',
                  duration: 3000,
                });
                processQueue();
              }
            } catch (error) {
              console.error('Error invoking kill-controller:', error);
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
    console.log(
      'Force starting:',
      downloadId,
      'at:',
      downloadLocation,
      'controller:',
      controllerId,
    );
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
        console.error('Download not found:', downloadId);
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
    if (downloadLocation) {
      if (downloadLocation.includes(',') && !filePath) {
        const [folderPath, filePathFromString] = downloadLocation.split(',');
        const success = await window.downlodrFunctions.openFolder(
          folderPath,
          filePathFromString,
        );
        // Check if the location contains a comma (indicating old format)
        const exists = await window.downlodrFunctions.fileExists(folderPath);
        console.log('success', exists);
        if (!exists) {
          toast({
            variant: 'destructive',
            title: 'Missing Folder',
            description: 'The folder does not exist in the given location',
            duration: 3000,
          });
        }
      } else {
        // Normal case with separate parameters
        const success = await window.downlodrFunctions.openFolder(
          downloadLocation,
          filePath,
        );
        console.log('success', success);
        if (!success) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to view folder',
            duration: 3000,
          });
        }
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to view folder',
        duration: 3000,
      });
    }
    setContextMenu({ downloadId: null, x: 0, y: 0 });
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

      // Check if we're clicking on a context menu
      const isClickInsideContextMenu = target.closest('[data-context-menu]');

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

  return (
    <div className="flex flex-col h-full">
      {/* Table container with scrolling */}
      <div className="flex-grow overflow-auto">
        <div className="min-w-full">
          <table className="min-w-full table-fixed">
            <thead className="dark:bg-darkModeCompliment">
              <tr
                className="border-b border-t text-left dark:border-darkModeBorderColor"
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
                    return (
                      <th
                        key={column.id}
                        className="w-18 p-2 font-semibold"
                      ></th>
                    );
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
              {allDownloads.map((download) => (
                <React.Fragment key={download.id}>
                  <tr
                    className={`border-b-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover cursor-pointer ${
                      selectedDownloadId === download.id
                        ? 'bg-blue-50 dark:bg-gray-600'
                        : 'dark:bg-darkMode'
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
                                  <Skeleton className="h-4 w-[100px] rounded-[3px]" />
                                  <Skeleton className="h-4 w-[120px] rounded-[3px]" />
                                </div>
                              ) : (
                                <div
                                  className="line-clamp-2 break-words break-all"
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
                              className="px-2 py-2 dark:text-gray-200 text-left"
                            >
                              {download.status === 'fetching metadata' ? (
                                <div className="space-y-1">
                                  <Skeleton className="h-4 w-[50px] rounded-[3px]" />
                                  <Skeleton className="h-4 w-[70px] rounded-[3px]" />
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
                              style={{ width: column.width }}
                              className="p-2 ml-2"
                            >
                              {download.status === 'fetching metadata' ? (
                                <div className="space-y-1">
                                  <Skeleton className="h-8 w-[50px] rounded-[3px]" />
                                </div>
                              ) : download.status === 'finished' ? (
                                <div className="ml-1 font-medium text-sm text-gray-600 dark:text-gray-300">
                                  {download.ext ||
                                    download.audioExt ||
                                    'Unknown'}
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
                                      {download.status}
                                    </span>
                                  ) : download.status === 'finished' ? (
                                    <button
                                      className="relative flex items-center text-sm underline"
                                      style={{
                                        color: getStatusColor(download.status),
                                      }}
                                    >
                                      <VscPlayCircle
                                        size={18}
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
                                      <span
                                        className="hover:text-green-400 transition-colors"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          handleViewFolder(
                                            `${
                                              download.location
                                            },${await window.downlodrFunctions.joinDownloadPath(
                                              download.location,
                                              download.name,
                                            )}`,
                                          );
                                        }}
                                      >
                                        Finished
                                      </span>
                                    </button>
                                  ) : download.status === 'to download' ? (
                                    <div
                                      style={{
                                        color: getStatusColor(download.status),
                                      }}
                                    >
                                      <DownloadButton download={download} />
                                    </div>
                                  ) : download.status === 'paused' ||
                                    download.status === 'downloading' ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePause(download.id);
                                      }}
                                      className="hover:bg-gray-100 dark:hover:bg-darkModeHover p-1 rounded-full"
                                    >
                                      <AnimatedCircularProgressBar
                                        status={download.status}
                                        max={100}
                                        min={0}
                                        value={download.progress}
                                        gaugePrimaryColor="#4CAF50"
                                        gaugeSecondaryColor="#EEEEEE"
                                      />
                                    </button>
                                  ) : (
                                    <AnimatedCircularProgressBar
                                      status={download.status}
                                      max={100}
                                      min={0}
                                      value={download.progress}
                                      gaugePrimaryColor="#4CAF50"
                                      gaugeSecondaryColor="#EEEEEE"
                                    />
                                  )}
                                </span>
                              </div>
                            </td>
                          );
                        case 'speed':
                          return (
                            <td
                              key={column.id}
                              style={{ width: column.width }}
                              className="p-2 dark:text-gray-200"
                            >
                              {download.status === 'downloading' ? (
                                <span className="whitespace-nowrap overflow-hidden">
                                  {download.speed}
                                </span>
                              ) : (
                                <div className="flex justify-center w-full">
                                  <span>—</span>
                                </div>
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
                        case 'thumbnail':
                          return (
                            <td
                              key={column.id}
                              style={{ width: column.width }}
                              className="p-2 dark:text-gray-200 text-center"
                            >
                              {download.status === 'fetching metadata' ? (
                                <div className="flex justify-center w-full">
                                  <Skeleton className="h-8 w-[50px] rounded-[3px]" />
                                </div>
                              ) : download.status === 'finished' &&
                                download.thumnailsLocation &&
                                download.thumnailsLocation !== '—' ? (
                                <div className="flex justify-center items-center w-full">
                                  {thumbnailDataUrls[download.id] ? (
                                    <img
                                      src={thumbnailDataUrls[download.id]}
                                      alt="Thumbnail"
                                      className="h-10 w-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() =>
                                        handleViewDownload(
                                          download.thumnailsLocation,
                                        )
                                      }
                                      title="Click to view full thumbnail"
                                      onError={(e) => {
                                        console.error(
                                          'Failed to load thumbnail:',
                                          download.thumnailsLocation,
                                        );
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.parentElement.innerHTML =
                                          'Unable to load';
                                      }}
                                    />
                                  ) : (
                                    <span>—</span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex justify-center w-full">
                                  <span>—</span>
                                </div>
                              )}
                            </td>
                          );
                        case 'transcript':
                          return (
                            <td
                              key={column.id}
                              style={{ width: column.width }}
                              className="dark:text-gray-200 outline-1"
                            >
                              {download.status === 'fetching metadata' ? (
                                <div className="space-y-1 flex justify-center items-center">
                                  <Skeleton className="h-8 w-[50px] rounded-[3px]" />
                                </div>
                              ) : download.autoCaptionLocation === '' ||
                                download.autoCaptionLocation === null ? (
                                <div className="flex justify-center w-full">
                                  <span>—</span>
                                </div>
                              ) : download.autoCaptionLocation === undefined ? (
                                <span className="text-notAvailableStatus dark:text-darkModeNotAvailableStatus flex justify-center items-center text-center w-full">
                                  Not available
                                </span>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleViewDownload(
                                      download.autoCaptionLocation,
                                    )
                                  }
                                  className="text-availableStatus hover:underline flex justify-center items-center hover:text-green-400 transition-colors duration-200 w-full"
                                >
                                  Available
                                </button>
                              )}
                            </td>
                          );
                        case 'source':
                          return (
                            <td
                              key={column.id}
                              className="w-8 p-2 dark:text-gray-200 ml-2"
                            >
                              {download.status === 'fetching metadata' ? (
                                <div className="space-y-1">
                                  <Skeleton className="h-4 w-[100px] rounded-[3px]" />
                                  <Skeleton className="h-4 w-[120px] rounded-[3px]" />
                                </div>
                              ) : (
                                <div
                                  className="line-clamp-2 break-words ml-1"
                                  title={download.extractorKey}
                                >
                                  <a
                                    onClick={() =>
                                      window.downlodrFunctions.openExternalLink(
                                        download.videoUrl,
                                      )
                                    }
                                    className="hover:underline cursor-pointer"
                                  >
                                    {download.extractorKey}
                                  </a>{' '}
                                </div>
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

      {/* Fixed bottom panel for download details - always present */}
      <div className="flex-shrink-0">
        <ExpandedDownloadDetails download={selectedDownload || null} />
      </div>

      {/* Context Menus - keep these unchanged */}
      {contextMenu.downloadId && !isTransitioning && (
        <DownloadContextMenu
          data-context-menu
          downloadId={contextMenu.downloadId}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          downloadLocation={contextMenu.downloadLocation}
          controllerId={contextMenu.controllerId}
          downloadStatus={contextMenu.downloadStatus}
          onShowLog={handleShowLog}
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
          downloadName={
            allDownloads.find((d) => d.id === contextMenu.downloadId)?.name ||
            ''
          }
          onRename={handleRename}
          onShowRemoveModal={handleShowRemoveModal}
          onShowStopModal={handleShowStopModal}
        />
      )}

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

      {/* Add the LogModal */}
      <LogModal
        isOpen={showLogModal}
        onClose={() => {
          setShowLogModal(false);
          setLogModalDownloadId('');
        }}
        downloadId={logModalDownloadId}
      />
    </div>
  );
};

export default StatusSpecificDownloads;
