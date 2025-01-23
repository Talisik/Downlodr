/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { HiChevronUpDown } from 'react-icons/hi2';
import useDownloadStore from '../Store/downloadStore';
import DownloadContextMenu from '../Components/SubComponents/custom/DownloadContextMenu';
import ExpandedDownloadDetails from '../Components/SubComponents/custom/ExpandedDownloadDetail';
import { useResizableColumns } from '../Components/SubComponents/custom/ResizableColumns/useResizableColumns';
import ResizableHeader from '../Components/SubComponents/custom/ResizableColumns/ResizableHeader';
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
  const history = useDownloadStore((state) => state.historyDownloads);
  const downloading = useDownloadStore((state) => state.downloading);
  const forDownloads = useDownloadStore((state) => state.forDownloads);
  const deleteDownload = useDownloadStore((state) => state.deleteDownload);
  const availableTags = useDownloadStore((state) => state.availableTags);
  const addTag = useDownloadStore((state) => state.addTag);
  const removeTag = useDownloadStore((state) => state.removeTag);
  const availableCategories = useDownloadStore(
    (state) => state.availableCategories,
  );
  const addCategory = useDownloadStore((state) => state.addCategory);
  const removeCategory = useDownloadStore((state) => state.removeCategory);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    downloadId: string | null;
    x: number;
    y: number;
    downloadLocation?: string;
    controllerId?: string;
  }>({ downloadId: null, x: 0, y: 0 });
  const [selectedDownloadId, setSelectedDownloadId] = useState<string | null>(
    null,
  );
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const { columns, startResizing } = useResizableColumns([
    { id: 'name', width: 300, minWidth: 150 },
    { id: 'size', width: 100, minWidth: 80 },
    { id: 'status', width: 200, minWidth: 150 },
    { id: 'speed', width: 100, minWidth: 80 },
    { id: 'timeLeft', width: 100, minWidth: 80 },
    { id: 'dateAdded', width: 150, minWidth: 120 },
  ]);

  // Combine downloads from downloading and history
  const allDownloads = [...downloading, ...history, ...forDownloads].filter(
    (download, index, self) =>
      index === self.findIndex((d) => d.id === download.id),
  );

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
      controllerId: allDownloads.controllerId,
    });
    setSelectedDownloadId(allDownloads.id);
  };

  //Context Menu actons
  const handlePause = (
    downloadId: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => {
    console.log(
      'Pausing:',
      downloadId,
      'at:',
      downloadLocation,
      'controller:',
      controllerId,
    );
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
    console.log('Stopping all downloads');
    const { downloading, deleteDownloading } = useDownloadStore.getState();

    if (downloading && downloading.length > 0) {
      downloading.forEach(async (download) => {
        console.log(`Attempting to stop download: ${download.id}`);

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
            } else {
              console.log(
                `Failed to terminate controller with ID ${download.controllerId}.`,
              );
              // setCurrentDownloadId(download.id);
            }
          } catch (error) {
            console.error('Error invoking kill-controller:', error);
          }
        } else {
          console.error(`Controller ID not found for download ${download.id}`);
        }
      });

      // Clear selected downloads after stopping all
      // setSelectedDownloading([]);
    } else {
      console.log('Error deleting');
    }
    // setSelectedDownloading([]);

    console.log(
      'Stopping:',
      downloadId,
      'at:',
      downloadLocation,
      'controller:',
      controllerId,
    );
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
        console.log('File moved to trash successfully');
      } else {
        console.log('Could not delete');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
    setContextMenu({ downloadId: null, x: 0, y: 0 });
  };

  const handleCheckboxChange = (downloadId: string) => {
    setSelectedRows((prev) => {
      if (prev.includes(downloadId)) {
        return prev.filter((id) => id !== downloadId);
      } else {
        return [...prev, downloadId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedRows.length === allDownloads.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(allDownloads.map((download) => download.id));
    }
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

  return (
    <div className="w-full pb-5">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left dark:border-gray-700">
            <th className="w-8 p-2">
              <input
                type="checkbox"
                className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
                checked={selectedRows.length === allDownloads.length}
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
              onResizeStart={(e) => startResizing('status', e.clientX)}
            >
              Status
            </ResizableHeader>
            <ResizableHeader
              width={columns[3].width}
              onResizeStart={(e) => startResizing('speed', e.clientX)}
            >
              Speed
            </ResizableHeader>
            <ResizableHeader
              width={columns[4].width}
              onResizeStart={(e) => startResizing('timeLeft', e.clientX)}
            >
              Time Left
            </ResizableHeader>
            <ResizableHeader
              width={columns[5].width}
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
                    className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
                    checked={selectedRows.includes(download.id)}
                    onChange={() => handleCheckboxChange(download.id)}
                  />
                </td>
                <td
                  style={{ width: columns[0].width }}
                  className="p-2 dark:text-gray-200"
                >
                  <div className="line-clamp-2 break-words">
                    {download.name}
                  </div>
                </td>
                <td
                  style={{ width: columns[1].width }}
                  className="p-2 dark:text-gray-200"
                >
                  {download.size
                    ? `${(download.size / 1048576).toFixed(2)} MB`
                    : 'Pending'}
                </td>
                <td style={{ width: columns[2].width }} className="p-2">
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {download.status === 'cancelled' ||
                      download.status === 'initializing' ||
                      download.status === 'finished' ? (
                        <span>{download.status}</span>
                      ) : (
                        <>
                          {download.progress}%
                          <div className="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-1">
                            <div
                              className={`h-2.5 rounded-full transition-all duration-300 ${
                                download.progress === 0
                                  ? 'bg-gray-400 dark:bg-gray-600'
                                  : download.progress === 100
                                  ? 'bg-green-500'
                                  : 'bg-orange-500'
                              }`}
                              style={{ width: `${download.progress}%` }}
                            ></div>
                          </div>
                        </>
                      )}{' '}
                    </span>
                  </div>
                </td>
                <td
                  style={{ width: columns[3].width }}
                  className="p-2 dark:text-gray-200"
                >
                  {download.speed || '-'}
                </td>
                <td
                  style={{ width: columns[4].width }}
                  className="p-2 dark:text-gray-200"
                >
                  {download.timeLeft}
                </td>
                <td
                  style={{ width: columns[5].width }}
                  className="p-2 dark:text-gray-200"
                >
                  {formatRelativeTime(download.DateAdded)}
                </td>
                <td className="w-20 p-2 dark:text-gray-200">
                  {download.extractorKey}
                </td>
              </tr>
              {expandedRowId === download.id && (
                <ExpandedDownloadDetails download={download} />
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      {/* Optional: Display selected count */}
      {selectedRows.length > 0 && (
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Selected: {selectedRows.length} items
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.downloadId && (
        <DownloadContextMenu
          data-context-menu
          downloadId={contextMenu.downloadId}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          downloadLocation={contextMenu.downloadLocation}
          controllerId={contextMenu.controllerId}
          onClose={handleCloseContextMenu}
          onPause={handlePause}
          onStop={handleStop}
          onForceStart={handleForceStart}
          onRemove={handleRemove}
          onViewDownload={handleViewDownload}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          currentTags={getCurrentTags(contextMenu.downloadId)}
          availableTags={availableTags}
          onAddCategory={addCategory}
          onRemoveCategory={removeCategory}
          currentCategories={getCurrentCategories(contextMenu.downloadId)}
          availableCategories={availableCategories}
        />
      )}
    </div>
  );
};

export default AllDownloads;
