/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { HiChevronUpDown } from 'react-icons/hi2';
import useDownloadStore from '../Store/downloadStore';
import { useResizableColumns } from '../Components/SubComponents/custom/ResizableColumns/useResizableColumns';
import ResizableHeader from '../Components/SubComponents/custom/ResizableColumns/ResizableHeader';
import DownloadContextMenu from '../Components/SubComponents/custom/DownloadContextMenu';

const CompletedDownloads = () => {
  const finished = useDownloadStore((state) => state.finishedDownloads);
  const [contextMenu, setContextMenu] = useState<{
    downloadStatus: string;
    downloadId: string | null;
    x: number;
    y: number;
    downloadLocation?: string;
    controllerId?: string;
  }>({ downloadId: null, x: 0, y: 0, downloadStatus: '' });
  const availableCategories = useDownloadStore(
    (state) => state.availableCategories,
  );
  const availableTags = useDownloadStore((state) => state.availableTags);
  const addTag = useDownloadStore((state) => state.addTag);
  const removeTag = useDownloadStore((state) => state.removeTag);
  const addCategory = useDownloadStore((state) => state.addCategory);
  const removeCategory = useDownloadStore((state) => state.removeCategory);
  const deleteDownload = useDownloadStore((state) => state.deleteDownload);

  const { columns, startResizing } = useResizableColumns([
    { id: 'name', width: 150, minWidth: 150 },
    { id: 'size', width: 80, minWidth: 80 },
    { id: 'status', width: 80, minWidth: 80 },
    { id: 'speed', width: 80, minWidth: 80 },
    { id: 'timeLeft', width: 90, minWidth: 80 },
    { id: 'dateAdded', width: 100, minWidth: 100 },
  ]);

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
      return `${diffInMinutes} ${
        diffInMinutes === 1 ? 'minute' : 'minutes'
      } ago`;
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

  const handleViewFolder = (downloadLocation?: string) => {
    if (downloadLocation) {
      window.downlodrFunctions.openFolder(downloadLocation);
    }
    setContextMenu({ downloadId: null, x: 0, y: 0, downloadStatus: '' });
  };

  const handleViewDownload = (downloadLocation?: string) => {
    if (downloadLocation) {
      window.downlodrFunctions.openVideo(downloadLocation);
    }
    setContextMenu({ downloadId: null, x: 0, y: 0, downloadStatus: '' });
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
    setContextMenu({ downloadId: null, x: 0, y: 0, downloadStatus: '' });
  };

  const handleContextMenu = (event: React.MouseEvent, download: any) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      downloadId: download.id,
      x: event.clientX,
      y: event.clientY,
      downloadLocation: `${download.location}${download.name}`,
      controllerId: download.controllerId,
      downloadStatus: download.status,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ downloadId: null, x: 0, y: 0, downloadStatus: '' });
  };

  // Get current tags for a download
  const getCurrentTags = (downloadId: string) => {
    const download = finished.find((d) => d.id === downloadId);
    return download?.tags || [];
  };

  // Get current categories for a download
  const getCurrentCategories = (downloadId: string) => {
    const download = finished.find((d) => d.id === downloadId);
    return download?.category || [];
  };

  // These functions are required by the context menu but not used in completed downloads
  const handlePause = () => {
    // hello
  };
  const handleStop = () => {
    // hello
  };
  const handleForceStart = () => {
    // hello
  };

  return (
    <div className="w-full pb-5">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left dark:border-gray-700">
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
          {finished.map((download) => (
            <tr
              key={download.id}
              className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-darkMode"
              onContextMenu={(e) => handleContextMenu(e, download)}
            >
              <td
                style={{ width: columns[0].width }}
                className="p-2 pl-5 dark:text-gray-200"
              >
                <div className="line-clamp-2 break-words" title={download.name}>
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
                    {download.status}
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
              <td className="w-20 p-2">
                <a
                  onClick={() =>
                    window.downlodrFunctions.openExternalLink(download.videoUrl)
                  }
                  className="text-blue-500 hover:underline dark:text-blue-400 cursor-pointer"
                >
                  {download.extractorKey}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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
        />
      )}
    </div>
  );
};

export default CompletedDownloads;
