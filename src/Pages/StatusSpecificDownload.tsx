/**
 * A custom React Page Component for Status-Specific Downloads
 * This component dynamically displays downloads filtered by their status,
 * reusing the UI structure from the AllDownloads component.
 *
 * @returns JSX.Element - The rendered component displaying status-filtered downloads.
 */
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { HiChevronUpDown } from 'react-icons/hi2';
import { FaPlay } from 'react-icons/fa6';
import useDownloadStore from '../Store/downloadStore';
import DownloadContextMenu from '../Components/SubComponents/custom/DownloadContextMenu';
import ExpandedDownloadDetails from '../Components/SubComponents/custom/ExpandedDownloadDetail';
import { useResizableColumns } from '../Components/SubComponents/custom/ResizableColumns/useResizableColumns';
import ResizableHeader from '../Components/SubComponents/custom/ResizableColumns/ResizableHeader';
import { AnimatedCircularProgressBar } from '../Components/SubComponents/custom/RadialProgress';
import { useMainStore } from '../Store/mainStore';
import DownloadButton from '../Components/SubComponents/custom/DownloadButton';
import { Skeleton } from '../Components/SubComponents/shadcn/components/ui/skeleton';
import { toast } from '../Components/SubComponents/shadcn/hooks/use-toast';
import ColumnHeaderContextMenu from '../Components/SubComponents/custom/ColumnHeaderContextMenu';
import FormatSelector from '../Components/SubComponents/custom/FormatSelector';

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

const formatFileSize = (bytes: number | undefined): string => {
  if (!bytes) return '—';

  const MB = 1048576;
  const GB = MB * 1024;

  if (bytes >= GB) {
    return `${(bytes / GB).toFixed(2)} GB`;
  } else {
    return `${(bytes / MB).toFixed(2)} MB`;
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

const StatusSpecificDownloads = () => {
  // Get status from URL parameters
  const { status } = useParams<{ status: string }>();
  const currentStatus = status ? statusMapping[status] || status : '';

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
  const deleteDownload = useDownloadStore((state) => state.deleteDownload);

  // Add sorting state
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

  // Call the hook with visible column IDs
  const {
    columns,
    startResizing,
    startDragging,
    handleDragOver,
    handleDrop,
    dragging,
    dragOverIndex,
  } = useResizableColumns(
    [
      { id: 'name', width: 110, minWidth: 110 },
      { id: 'size', width: 60, minWidth: 60 },
      { id: 'format', width: 80, minWidth: 80 },
      { id: 'status', width: 110, minWidth: 110 },
      { id: 'speed', width: 70, minWidth: 70 },
      { id: 'dateAdded', width: 90, minWidth: 90 },
      { id: 'source', width: 20, minWidth: 20 },
    ],
    visibleColumns,
  );

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

  // Combine downloads from downloading and history
  // Filter by status if we're on a status-specific page
  const allDownloads = [
    ...forDownloads,
    ...downloading,
    ...finishedDownloads,
    ...history,
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
            ? new Date(a.DateAdded).getTime() - new Date(b.DateAdded).getTime()
            : new Date(b.DateAdded).getTime() - new Date(a.DateAdded).getTime();
        }
        case 'source': {
          const sourceA = a.extractorKey || '';
          const sourceB = b.extractorKey || '';
          return sortDirection === 'asc'
            ? sourceA.localeCompare(sourceB)
            : sourceB.localeCompare(sourceA);
        }
        default: {
          return sortDirection === 'asc'
            ? new Date(a.DateAdded).getTime() - new Date(b.DateAdded).getTime()
            : new Date(b.DateAdded).getTime() - new Date(a.DateAdded).getTime();
        }
      }
    });

  // Filter columns based on visibility settings, ensuring essential columns are always included
  const displayColumns = columns.filter(
    (column) =>
      visibleColumns.includes(column.id) ||
      ['name', 'status', 'format'].includes(column.id),
  );

  // Map the displayColumns to have correct indices for drag and drop
  const displayColumnsWithIndices = displayColumns.map((column, index) => ({
    ...column,
    displayIndex: index,
  }));

  // Handle column header click for sorting
  const handleSortClick = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to desc
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Function to render sort indicator
  const renderSortIndicator = (column: string) => {
    if (sortColumn !== column) {
      return (
        <HiChevronUpDown
          size={14}
          className="flex-shrink-0 dark:text-gray-400"
        />
      );
    }

    if (sortDirection === 'asc') {
      return <HiChevronUpDown size={14} className="flex-shrink-0 rotate-180" />;
    } else {
      return <HiChevronUpDown size={14} className="flex-shrink-0" />;
    }
  };

  // Add this new state for the column header context menu
  const [columnHeaderContextMenu, setColumnHeaderContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
  }>({ x: 0, y: 0, visible: false });

  // Add this handler for the column header right-click
  const handleColumnHeaderContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

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
  };

  // Add this to close the column header context menu
  const handleCloseColumnHeaderContextMenu = () => {
    setColumnHeaderContextMenu((prev) => ({ ...prev, visible: false }));
  };

  // Handle toggle column visibility
  const handleToggleColumn = (columnId: string) => {
    const newVisibleColumns = visibleColumns.includes(columnId)
      ? visibleColumns.filter((id) => id !== columnId)
      : [...visibleColumns, columnId];

    useMainStore.getState().setVisibleColumns(newVisibleColumns);
  };

  // Close Menu and clear selected download when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't clear selection if clicking inside the table or the details panel
      const target = event.target as HTMLElement;
      const isClickInsideTable = target.closest('table');
      const isClickInsideDetailsPanel = target.closest(
        '.download-details-panel',
      );

      // Only clear selection if clicking outside both table and details panel
      if (!isClickInsideTable && !isClickInsideDetailsPanel) {
        setContextMenu({ downloadId: null, x: 0, y: 0 });
        setSelectedDownloadId(null);
        setColumnHeaderContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleContextMenu = (event: React.MouseEvent, allDownloads: any) => {
    event.preventDefault();
    event.stopPropagation(); // Prevent the click outside handler from firing immediately
    setContextMenu({
      downloadId: allDownloads.id,
      x: event.clientX,
      y: event.clientY,
      downloadLocation: `${allDownloads.location}${allDownloads.name}`,
      downloadStatus: allDownloads.status,
      controllerId: allDownloads.controllerId,
    });
    setSelectedDownloadId(allDownloads.id);
  };

  //Context Menu actons
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
        currentDownload.backupExt,
        currentDownload.backupFormatId,
        currentDownload.backupAudioExt,
        currentDownload.backupAudioFormatId,
        currentDownload.extractorKey,
        '',
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

  const handleViewDownload = (downloadLocation?: string) => {
    if (downloadLocation) {
      window.downlodrFunctions.openVideo(downloadLocation);
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
  ) => {
    if (!downloadLocation || !downloadId) return;

    // Get the download status
    const download = allDownloads.find((d) => d.id === downloadId);
    if (download?.status === 'to download') {
      deleteDownload(downloadId);
      toast({
        variant: 'success',
        title: 'Download Deleted',
        description: 'Download has been deleted successfully',
        duration: 3000,
      });

      return;
    }

    try {
      const success = await window.downlodrFunctions.deleteFile(
        downloadLocation,
      );
      if (success) {
        deleteDownload(downloadId);
        toast({
          variant: 'success',
          title: 'File Deleted',
          description: 'File has been deleted successfully',
          duration: 3000,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Deletion Failed',
          description: 'Failed to delete file',
          duration: 3000,
        });
      }
    } catch (error) {
      deleteDownload(downloadId);
      console.error('Error deleting file:', error);
    }
    setContextMenu({ downloadId: null, x: 0, y: 0 });
  };

  const handleCheckboxChange = (downloadId: string) => {
    const newSelected = selectedRowIds.includes(downloadId)
      ? selectedRowIds.filter((id) => id !== downloadId)
      : [...selectedRowIds, downloadId];

    setSelectedRowIds(newSelected);

    // Update selectedDownloads with full download info
    const selectedDownloadsData = newSelected.map((id) => {
      const download = allDownloads.find((d) => d.id === id);
      return {
        id,
        controllerId: download?.controllerId,
        location: download?.location
          ? `${download.location}${download.name}`
          : undefined,
      };
    });
    setSelectedDownloads(selectedDownloadsData);
  };

  const handleSelectAll = () => {
    const newSelected =
      selectedRowIds.length === allDownloads.length
        ? []
        : allDownloads.map((download) => download.id);

    setSelectedRowIds(newSelected);

    // Update selectedDownloads with full download info
    const selectedDownloadsData = newSelected.map((id) => {
      const download = allDownloads.find((d) => d.id === id);
      return {
        id,
        controllerId: download?.controllerId,
        location: download?.location
          ? `${download.location}${download.name}`
          : undefined,
      };
    });
    setSelectedDownloads(selectedDownloadsData);
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ downloadId: null, x: 0, y: 0 });
    setSelectedDownloadId(null);
  };

  const handleRowClick = (downloadId: string) => {
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
    setSelectedRowIds([downloadId]);
  };

  // Find current tags for the selected download
  const getCurrentTags = (downloadId: string) => {
    const download = allDownloads.find((d) => d.id === downloadId);
    return download?.tags || [];
  };

  const getCurrentCategories = (downloadId: string) => {
    const download = allDownloads.find((d) => d.id === downloadId);
    return download?.category || [];
  };

  const handleViewFolder = (downloadLocation?: string, filePath?: string) => {
    if (downloadLocation) {
      // Check if the location contains a comma (indicating old format)
      if (downloadLocation.includes(',') && !filePath) {
        const [folderPath, filePathFromString] = downloadLocation.split(',');
        window.downlodrFunctions.openFolder(folderPath, filePathFromString);
      } else {
        // Normal case with separate parameters
        window.downlodrFunctions.openFolder(downloadLocation, filePath);
      }
    }
    setContextMenu({ downloadId: null, x: 0, y: 0 });
  };

  // Add a column display name mapping
  const getColumnDisplayName = (columnId: string): string => {
    const columnMappings: Record<string, string> = {
      name: 'Title',
      size: 'Size',
      format: 'Format',
      status: 'Status',
      speed: 'Speed',
      dateAdded: 'Date Added',
      source: 'Source',
      // Add any other columns here
    };

    return columnMappings[columnId] || columnId;
  };

  // Column options configuration - consistent with SettingsModal
  const columnOptions = [
    { id: 'name', label: 'Title', required: true },
    { id: 'size', label: 'Size', required: false },
    { id: 'format', label: 'Format', required: true },
    { id: 'status', label: 'Status', required: true },
    { id: 'speed', label: 'Speed', required: false },
    { id: 'dateAdded', label: 'Date Added', required: false },
    { id: 'source', label: 'Source', required: false },
    { id: 'timeLeft', label: 'Time Left', required: false },
  ];

  // Make sure we're passing the selectedDownload correctly
  const selectedDownload = selectedDownloadId
    ? allDownloads.find((d) => d.id === selectedDownloadId)
    : null;

  return (
    <div className="w-full flex flex-col h-full relative">
      <div className="flex-grow overflow-x-auto overflow-y-auto pb-[30vh]">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr
              className="border-b text-left dark:border-componentBorder"
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
              {displayColumns.map((column, displayIndex) => {
                if (column.id === 'end') {
                  return (
                    <th key={column.id} className="w-20 p-2 font-semibold"></th>
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
                    isDragging={dragging?.columnId === column.id}
                    isDragOver={dragOverIndex === originalIndex}
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
                );
              })}
            </tr>
          </thead>
          <tbody>
            {allDownloads.map((download) => (
              <React.Fragment key={download.id}>
                <tr
                  className={`border-b hover:bg-gray-50 dark:border-componentBorder dark:hover:bg-gray-700 cursor-pointer ${
                    selectedDownloadId === download.id
                      ? 'bg-blue-50 dark:bg-gray-600'
                      : 'dark:bg-darkMode'
                  }`}
                  onContextMenu={(e) => handleContextMenu(e, download)}
                  onClick={() => handleRowClick(download.id)}
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
                                          `${download.location},${download.location}${download.name}`,
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
                                    className="hover:bg-gray-100 dark:hover:bg-gray-600 p-1 rounded-full"
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

      {/* ExpandedDownloadDetails with adjusted positioning to not cover scrollbar */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0">
        <div className="pointer-events-auto">
          <ExpandedDownloadDetails download={selectedDownload} />
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.downloadId && (
        <DownloadContextMenu
          data-context-menu
          downloadId={contextMenu.downloadId}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          downloadLocation={contextMenu.downloadLocation}
          controllerId={contextMenu.controllerId}
          downloadStatus={contextMenu.downloadStatus}
          onClose={handleCloseContextMenu}
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
        />
      )}

      {/* Add the column header context menu component */}
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
    </div>
  );
};

export default StatusSpecificDownloads;
