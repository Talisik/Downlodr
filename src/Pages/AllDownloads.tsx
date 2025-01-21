/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { HiChevronUpDown } from 'react-icons/hi2';
import useDownloadStore from '../Store/downloadStore';
import DownloadContextMenu from '../Components/SubComponents/custom/DownloadContextMenu';
import ExpandedDownloadDetails from '../Components/SubComponents/custom/ExpandedDownloadDetail';

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

  return (
    <div className="w-full pb-5">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left">
            <th className="w-8 p-2">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={selectedRows.length === allDownloads.length}
                onChange={handleSelectAll}
              />
            </th>
            <th className="w-1/5 p-2 font-semibold">Schedule: </th>
            <th className="w-20 p-2 font-semibold">
              <div className="flex items-center">
                Size
                <HiChevronUpDown size={14} className="flex-shrink-0" />
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
          {allDownloads.map((download) => (
            <React.Fragment key={download.id}>
              <tr
                className={`border-b hover:bg-gray-50 cursor-pointer ${
                  selectedDownloadId === download.id ? 'bg-blue-50' : ''
                }`}
                onContextMenu={(e) => handleContextMenu(e, download)}
                onClick={() => handleRowClick(download.id)}
              >
                <td className="p-2">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selectedRows.includes(download.id)}
                    onChange={() => handleCheckboxChange(download.id)}
                  />
                </td>
                <td className="p-2">{download.name}</td>
                <td className="p-2">
                  {download.size
                    ? `${(download.size / 1048576).toFixed(2)} MB`
                    : 'Pending'}
                </td>
                <td className="p-2">
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600">
                      {download.status === 'cancelled' ||
                      download.status === 'initializing' ||
                      download.status === 'finished' ? (
                        <span>{download.status}</span>
                      ) : (
                        <>
                          {download.progress}%
                          <div className="w-48 bg-gray-200 rounded-full h-2.5 mt-1">
                            <div
                              className={`h-2.5 rounded-full transition-all duration-300 ${
                                download.progress === 0
                                  ? 'bg-gray-400'
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
                <td className="p-2">{download.speed || '-'}</td>
                <td className="p-2">{download.timeLeft}</td>
                <td className="p-2">
                  {formatRelativeTime(download.DateAdded)}
                </td>
                <td className="p-2">
                  <a
                    href={download.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    Source
                  </a>
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
        <div className="mt-2 text-sm text-gray-600">
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
        />
      )}
    </div>
  );
};

export default AllDownloads;
