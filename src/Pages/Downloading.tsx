/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
// import { IoMdCheckmark } from 'react-icons/io';
import useDownloadStore from '../Store/downloadStore';
import { HiChevronUpDown } from 'react-icons/hi2';
import DownloadContextMenu from '../Components/SubComponents/custom/DownloadContextMenu';

const Downloading = () => {
  const downloading = useDownloadStore((state) => state.downloading);
  const deleteDownload = useDownloadStore((state) => state.deleteDownload);
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
  const availableTags = useDownloadStore((state) => state.availableTags);
  const addTag = useDownloadStore((state) => state.addTag);
  const removeTag = useDownloadStore((state) => state.removeTag);
  const availableCategories = useDownloadStore(
    (state) => state.availableCategories,
  );
  const addCategory = useDownloadStore((state) => state.addCategory);
  const removeCategory = useDownloadStore((state) => state.removeCategory);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  // Find current tags for the selected download
  const getCurrentTags = (downloadId: string) => {
    const download = downloading.find((d) => d.id === downloadId);
    return download?.tags || [];
  };

  const getCurrentCategories = (downloadId: string) => {
    const download = downloading.find((d) => d.id === downloadId);
    return download?.category || [];
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

  const handleContextMenu = (event: React.MouseEvent, downloading: any) => {
    event.preventDefault();
    event.stopPropagation(); // Prevent the click outside handler from firing immediately
    setContextMenu({
      downloadId: downloading.id,
      x: event.clientX,
      y: event.clientY,
      downloadLocation: `${downloading.location}${downloading.name}`,
      controllerId: downloading.controllerId,
    });
    setSelectedDownloadId(downloading.id);
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
    if (selectedRows.length === downloading.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(downloading.map((download) => download.id));
    }
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ downloadId: null, x: 0, y: 0 });
    setSelectedDownloadId(null);
  };

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

  return (
    <div className="w-full pb-5">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left dark:border-gray-700">
            <th className="w-8 p-2">
              <input
                type="checkbox"
                className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
                checked={selectedRows.length === downloading.length}
                onChange={handleSelectAll}
              />
            </th>
            <th className="w-1/5 p-2 font-semibold dark:text-gray-200">
              Schedule:{' '}
            </th>
            <th className="w-20 p-2 font-semibold">
              <div className="flex items-center dark:text-gray-200">
                Size
                <HiChevronUpDown
                  size={14}
                  className="flex-shrink-0 dark:text-gray-400"
                />
              </div>
            </th>
            <th className="w-1/6 p-2 font-semibold">
              <div className="flex items-center">
                Status
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
            <th className="w-22 p-2 font-semibold">
              <div className="flex items-center">
                Speed
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
            <th className="w-26 p-2 font-semibold">
              <div className="flex items-center">
                Time Left
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
            <th className="w-26 p-2 font-semibold">
              <div className="flex items-center">
                Date Added
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
            <th className="w-20 p-2 font-semibold">
              <div className="flex items-center">
                Source
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {downloading.map((download) => (
            <tr
              key={download.id}
              className={`border-b hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 ${
                selectedDownloadId === download.id
                  ? 'bg-blue-50 dark:bg-gray-600'
                  : 'dark:bg-darkMode'
              }`}
              onContextMenu={(e) => handleContextMenu(e, download)}
            >
              <td className="p-2">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
                  checked={selectedRows.includes(download.id)}
                  onChange={() => handleCheckboxChange(download.id)}
                />
              </td>
              <td className="p-2 pl-5 dark:text-gray-200">{download.name}</td>
              <td className="p-2 dark:text-gray-200">
                {download.size
                  ? `${(download.size / 1048576).toFixed(2)} MB`
                  : 'Pending'}
              </td>
              <td className="p-2">
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
                    )}
                  </span>
                </div>
              </td>
              <td className="p-2 dark:text-gray-200">
                {download.speed || '-'}
              </td>
              <td className="p-2 dark:text-gray-200">{download.timeLeft}</td>
              <td className="p-2 dark:text-gray-200">
                {formatRelativeTime(download.DateAdded)}
              </td>
              <td className="p-2">
                <a
                  href={download.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline dark:text-blue-400"
                >
                  Source
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Selected count */}
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

export default Downloading;
