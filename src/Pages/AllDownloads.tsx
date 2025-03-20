/**
 * A custom React Main Page
 * This component displays a list of all downloads, including those that
 * are currently downloading, finished, or in history. It provides
 * functionalities to manage downloads, such as pausing, stopping, and
 * viewing details. It also includes a context menu for additional actions.
 *
 * @returns JSX.Element - The rendered component displaying all downloads.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { HiChevronUpDown } from 'react-icons/hi2';
import useDownloadStore from '../Store/downloadStore';
import DownloadContextMenu from '../Components/SubComponents/custom/DownloadContextMenu';
import ExpandedDownloadDetails from '../Components/SubComponents/custom/ExpandedDownloadDetail';
import { useResizableColumns } from '../Components/SubComponents/custom/ResizableColumns/useResizableColumns';
import ResizableHeader from '../Components/SubComponents/custom/ResizableColumns/ResizableHeader';
import { AnimatedCircularProgressBar } from '../Components/SubComponents/custom/RadialProgress';
import { useMainStore } from '../Store/mainStore';
import DownloadButton from '../Components/SubComponents/custom/DownloadButton';
import FormatSelector from '../Components/SubComponents/custom/FormatSelector';
import { Skeleton } from '../Components/SubComponents/shadcn/components/ui/skeleton';
import { toast } from '../Components/SubComponents/shadcn/hooks/use-toast';

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

const AllDownloads = () => {
  // All downloads from different states
  const history = useDownloadStore((state) => state.historyDownloads);
  const downloading = useDownloadStore((state) => state.downloading);
  const forDownloads = useDownloadStore((state) => state.forDownloads);
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );
  // remove download id
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

  const {
    columns,
    startResizing,
    startDragging,
    handleDragOver,
    handleDrop,
    dragging,
    dragOverIndex,
  } = useResizableColumns([
    { id: 'name', width: 110, minWidth: 110 },
    { id: 'size', width: 60, minWidth: 60 },
    { id: 'format', width: 80, minWidth: 80 },
    { id: 'status', width: 110, minWidth: 110 },
    { id: 'speed', width: 70, minWidth: 70 },
    { id: 'dateAdded', width: 90, minWidth: 90 },
    { id: 'source', width: 20, minWidth: 20 },
  ]);

  // Combine downloads from downloading and history
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

  // Close Menu and clear selected download when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu({ downloadId: null, x: 0, y: 0 });
      setSelectedDownloadId(null);
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      });
    } else if (currentDownload.controllerId != '---') {
      try {
        window.ytdlp
          .killController(currentDownload.controllerId)
          .then((success) => {
            if (success) {
              setTimeout(() => {
                updateDownloadStatus(downloadId, 'paused');
                console.log('Status updated to paused after delay');
              }, 1200);
            }
          });
        // When successfully paused
        toast({
          variant: 'success',
          title: 'Download Paused',
          description: 'Download has been paused successfully',
        });
        updateDownloadStatus(downloadId, 'paused');
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to pause/resume download',
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    downloadLocation?: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      });
    } else if (currentForDownload?.status === 'to download') {
      removeFromForDownloads(downloadId);
      toast({
        variant: 'success',
        title: 'Download Stopped',
        description: 'Download has been stopped successfully',
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
                });
              }
            } catch (error) {
              console.error('Error invoking kill-controller:', error);
              toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to stop download',
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Deletion Failed',
          description: 'Failed to delete file',
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
    setExpandedRowId(expandedRowId === downloadId ? null : downloadId);
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

  const handleViewFolder = (downloadLocation?: string) => {
    if (downloadLocation) {
      window.downlodrFunctions.openFolder(downloadLocation);
    }
    setContextMenu({ downloadId: null, x: 0, y: 0 });
  };

  return (
    <div className="w-full">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left dark:border-gray-700">
            <th className="w-8 p-2">
              <input
                type="checkbox"
                className="ml-2 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
                checked={selectedRowIds.length === allDownloads.length}
                onChange={handleSelectAll}
              />
            </th>
            {columns.map((column, index) => {
              if (column.id === 'end') {
                return (
                  <th key={column.id} className="w-20 p-2 font-semibold"></th>
                );
              }
              return (
                <ResizableHeader
                  key={column.id}
                  width={column.width}
                  onResizeStart={(e) => startResizing(column.id, e.clientX)}
                  index={index}
                  onDragStart={startDragging}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  isDragging={dragging?.columnId === column.id}
                  isDragOver={dragOverIndex === index}
                  columnId={column.id}
                  isLastColumn={index === columns.length - 1}
                >
                  <div
                    className="flex items-center cursor-pointer"
                    onClick={() => handleSortClick(column.id)}
                  >
                    {column.id === 'name'
                      ? 'Title'
                      : column.id === 'size'
                      ? 'Size'
                      : column.id === 'format'
                      ? 'Format'
                      : column.id === 'status'
                      ? 'Status'
                      : column.id === 'speed'
                      ? 'Speed'
                      : column.id === 'dateAdded'
                      ? 'Date Added'
                      : column.id === 'source'
                      ? 'Source'
                      : column.id}
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
                className={`border-b hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 cursor-pointer ${
                  selectedDownloadId === download.id
                    ? 'bg-blue-50 dark:bg-gray-600'
                    : 'dark:bg-darkMode'
                }`}
                onContextMenu={(e) => handleContextMenu(e, download)}
                onClick={() => handleRowClick(download.id)}
              >
                <td className="w-8 p-2">
                  <input
                    type="checkbox"
                    className="ml-2 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
                    checked={selectedRowIds.includes(download.id)}
                    onChange={() => handleCheckboxChange(download.id)}
                  />
                </td>
                {columns.map((column) => {
                  switch (column.id) {
                    case 'name':
                      return (
                        <td
                          key={column.id}
                          style={{ width: column.width }}
                          className="p-2 dark:text-gray-200"
                        >
                          {download.status === 'getting metadata' ? (
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
                          {download.status === 'getting metadata' ? (
                            <div className="space-y-1">
                              <Skeleton className="h-4 w-[50px] rounded-[3px]" />
                              <Skeleton className="h-4 w-[70px] rounded-[3px]" />
                            </div>
                          ) : (
                            <div className="line-clamp-2 break-words ml-1">
                              {download.size
                                ? `${(download.size / 1048576).toFixed(2)} MB`
                                : '—'}{' '}
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
                              {download.status === 'getting metadata' ? (
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
                              download.status === 'getting metadata' ? (
                                <span>{download.status}</span>
                              ) : download.status === 'finished' ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewFolder(`${download.location}`);
                                  }}
                                  className="underline"
                                >
                                  {download.status}
                                </button>
                              ) : download.status === 'to download' ? (
                                <DownloadButton download={download} />
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
                          {download.status === 'getting metadata' ? (
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
              {expandedRowId === download.id && (
                <ExpandedDownloadDetails download={download} />
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>

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
    </div>
  );
};

export default AllDownloads;
