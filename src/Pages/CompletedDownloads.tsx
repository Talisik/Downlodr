/**
 *
 * This component displays a list of completed downloads. It allows users to manage their completed downloads, including deleting and viewing details.
 * It also provides functionalities to handle tags and categories.
 *
 * @returns JSX.Element - The rendered component displaying completed downloads.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
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

// Calculation for date added relative to current time
// returns relative time
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

  // changes time measure depending on diffInMinutes
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

// completed downloads page component
const CompletedDownloads = () => {
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );
  // remove download id
  const deleteDownload = useDownloadStore((state) => state.deleteDownload);

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
  // column size values
  const { columns, startResizing } = useResizableColumns([
    { id: 'name', width: 110, minWidth: 110 },
    { id: 'size', width: 60, minWidth: 60 },
    { id: 'format', width: 80, minWidth: 80 },
    { id: 'status', width: 80, minWidth: 80 },
    { id: 'speed', width: 80, minWidth: 80 },
    { id: 'timeLeft', width: 90, minWidth: 80 },
    { id: 'dateAdded', width: 100, minWidth: 100 },
  ]);

  // Combine downloads from downloading and history
  const CompletedDownloads = [...finishedDownloads]
    .filter(
      (download, index, self) =>
        index === self.findIndex((d) => d.id === download.id),
    )
    .sort(
      (a, b) =>
        new Date(b.DateAdded).getTime() - new Date(a.DateAdded).getTime(),
    ); // Sort by date, newest first

  // Close Menu and clear selected download when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu({ downloadId: null, x: 0, y: 0 });
      setSelectedDownloadId(null);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleContextMenu = (
    event: React.MouseEvent,
    CompletedDownloads: any,
  ) => {
    event.preventDefault();
    event.stopPropagation(); // Prevent the click outside handler from firing immediately
    setContextMenu({
      downloadId: CompletedDownloads.id,
      x: event.clientX,
      y: event.clientY,
      downloadLocation: `${CompletedDownloads.location}${CompletedDownloads.name}`,
      downloadStatus: CompletedDownloads.status,
      controllerId: CompletedDownloads.controllerId,
    });
    setSelectedDownloadId(CompletedDownloads.id);
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

  // view downloaded video through openVideo
  const handleViewDownload = (downloadLocation?: string) => {
    if (downloadLocation) {
      window.downlodrFunctions.openVideo(downloadLocation);
    }
    setContextMenu({ downloadId: null, x: 0, y: 0 });
  };

  // handles pause, stop and unpause functions depending on download status
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
    // if status is paused
    if (currentDownload?.status === 'paused') {
      deleteDownloading(downloadId);
      // if the download is to download
    } else if (currentForDownload?.status === 'to download') {
      removeFromForDownloads(downloadId);
    } // if the download is to download
    else {
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
                  description: 'Your download has stopped successfully',
                });
              }
            } catch (error) {
              console.error('Error invoking kill-controller:', error);
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
      console.error('Error deleting file:', error);
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: 'Failed to delete file',
      });
    }
    setContextMenu({ downloadId: null, x: 0, y: 0 });
  };

  const handleCheckboxChange = (downloadId: string) => {
    const newSelected = selectedRowIds.includes(downloadId)
      ? selectedRowIds.filter((id) => id !== downloadId)
      : [...selectedRowIds, downloadId];

    setSelectedRowIds(newSelected);

    const selectedDownloadsData = newSelected.map((id) => {
      const download = CompletedDownloads.find((d) => d.id === id);
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
      selectedRowIds.length === CompletedDownloads.length
        ? []
        : CompletedDownloads.map((download) => download.id);

    setSelectedRowIds(newSelected);

    const selectedDownloadsData = newSelected.map((id) => {
      const download = CompletedDownloads.find((d) => d.id === id);
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
    const download = CompletedDownloads.find((d) => d.id === downloadId);
    return download?.tags || [];
  };

  const getCurrentCategories = (downloadId: string) => {
    const download = CompletedDownloads.find((d) => d.id === downloadId);
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
                className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
                checked={selectedRowIds.length === CompletedDownloads.length}
                onChange={handleSelectAll}
              />
            </th>
            <ResizableHeader
              width={columns[0].width}
              onResizeStart={(e) => startResizing('name', e.clientX)}
            >
              Schedule
            </ResizableHeader>
            <ResizableHeader
              width={columns[1].width}
              onResizeStart={(e) => startResizing('size', e.clientX)}
            >
              Size
            </ResizableHeader>
            <ResizableHeader
              width={columns[2].width}
              onResizeStart={(e) => startResizing('format', e.clientX)}
            >
              Format
            </ResizableHeader>
            <ResizableHeader
              width={columns[3].width}
              onResizeStart={(e) => startResizing('status', e.clientX)}
            >
              Status
            </ResizableHeader>
            <ResizableHeader
              width={columns[4].width}
              onResizeStart={(e) => startResizing('speed', e.clientX)}
            >
              Speed
            </ResizableHeader>
            <ResizableHeader
              width={columns[5].width}
              onResizeStart={(e) => startResizing('timeLeft', e.clientX)}
            >
              Time Left
            </ResizableHeader>
            <ResizableHeader
              width={columns[6].width}
              onResizeStart={(e) => startResizing('dateAdded', e.clientX)}
            >
              Date Added
            </ResizableHeader>
            <th className="w-20 p-2 font-semibold">
              <div className="flex items-center dark:text-gray-200">
                Source
                <HiChevronUpDown
                  size={14}
                  className="flex-shrink-0 dark:text-gray-400"
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {CompletedDownloads.map((download) => (
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
                    className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
                    checked={selectedRowIds.includes(download.id)}
                    onChange={() => handleCheckboxChange(download.id)}
                  />
                </td>
                <td
                  style={{ width: columns[0].width }}
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
                <td
                  style={{ width: columns[1].width }}
                  className="p-2 dark:text-gray-200"
                >
                  {download.status === 'getting metadata' ? (
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-[50px] rounded-[3px]" />
                      <Skeleton className="h-4 w-[70px] rounded-[3px]" />
                    </div>
                  ) : (
                    <div className="line-clamp-2 break-words">
                      {download.size
                        ? `${(download.size / 1048576).toFixed(2)} MB`
                        : '—'}{' '}
                    </div>
                  )}
                </td>
                <td style={{ width: columns[2].width }} className="p-2">
                  <div className="flex items-center">
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
                              forDownloads: state.forDownloads.map((d) =>
                                d.id === download.id
                                  ? {
                                      ...d,
                                      ext: formatData.ext,
                                      formatId: formatData.formatId,
                                      audioExt: formatData.audioExt,
                                      audioFormatId: formatData.audioFormatId,
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
                <td style={{ width: columns[3].width }} className="p-2">
                  <div className="flex justify-start">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {download.status === 'cancelled' ||
                      download.status === 'initializing' ||
                      download.status === 'getting metadata' ||
                      download.status === 'finished' ? (
                        <span>{download.status}</span>
                      ) : download.status === 'to download' ? (
                        <DownloadButton download={download} />
                      ) : (
                        <AnimatedCircularProgressBar
                          status={download.status}
                          max={100}
                          min={0}
                          value={download.progress}
                          gaugePrimaryColor="#4CAF50"
                          gaugeSecondaryColor="#EEEEEE"
                        />
                      )}{' '}
                    </span>
                  </div>
                </td>
                <td
                  style={{ width: columns[4].width }}
                  className="p-2 dark:text-gray-200"
                >
                  {download.status === 'downloading' ? (
                    <span>{download.speed}</span>
                  ) : (
                    <span>—</span>
                  )}{' '}
                </td>
                <td
                  style={{ width: columns[5].width }}
                  className="p-2 dark:text-gray-200"
                >
                  {download.status === 'downloading' ? (
                    <span>{download.timeLeft}</span>
                  ) : (
                    <span>—</span>
                  )}{' '}
                </td>
                <td
                  style={{ width: columns[6].width }}
                  className="p-2 dark:text-gray-200"
                >
                  {formatRelativeTime(download.DateAdded)}
                </td>
                <td className="w-20 p-2 dark:text-gray-200">
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
            CompletedDownloads.find((d) => d.id === contextMenu.downloadId)
              ?.name || ''
          }
        />
      )}
    </div>
  );
};

export default CompletedDownloads;
