/**
 *
 * This component displays the history of downloads, allowing users to view and manage their past downloads.
 * It includes functionalities to delete entries from history and provides visual feedback for actions taken.
 *
 * @returns JSX.Element - The rendered component displaying download history.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiChevronUpDown } from 'react-icons/hi2';
import { LuTrash } from 'react-icons/lu';
import { VscPlayCircle } from 'react-icons/vsc';
import { toast } from '../Components/SubComponents/shadcn/hooks/use-toast';
import useDownloadStore from '../Store/downloadStore';
import { useMainStore } from '../Store/mainStore';

interface FileExistsMap {
  [key: string]: boolean;
}
const History = () => {
  // get download historical logs and other functions from downloadStore
  const { historyDownloads, deleteDownload, setDownload } = useDownloadStore();
  // get settings from MainStore
  const { settings } = useMainStore();
  // values of longs are based on historical logs
  const [logs, setLogs] = useState(historyDownloads);
  // handle selected states
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [allChecked, setAllChecked] = useState(false);
  // error handling
  const [errorMessage, setErrorMessage] = useState('');
  const [isErrorVisible, setErrorVisible] = useState(false); //error card
  const [errorTitle, setErrorTitle] = useState('');
  const hideErrorCard = () => {
    setErrorVisible(false);
  };
  // check max download state from settings
  const maxDownload =
    settings.defaultDownloadSpeed === 0
      ? ''
      : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`;
  // check if file exists in specific location
  const [fileExistsMap, setFileExistsMap] = useState<FileExistsMap>({});
  // handle sorting logs
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortMenuPosition, setSortMenuPosition] = useState({ x: 0, y: 0 });
  const sortMenuRef = useRef<HTMLDivElement>(null);
  // checkif file exists, if not cross out name
  useEffect(() => {
    const checkAllFiles = async () => {
      const newFileExistsMap: FileExistsMap = {};
      for (const download of logs) {
        const filePath = await window.downlodrFunctions.joinDownloadPath(
          download.location,
          download.downloadName,
        );
        const exists = await window.downlodrFunctions.fileExists(filePath);
        newFileExistsMap[download.id] = exists;
      }
      setFileExistsMap(newFileExistsMap);
    };
    // Check immediately
    checkAllFiles();
    // Set up interval to check every 2 seconds
    const interval = setInterval(checkAllFiles, 2000);
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [logs]);
  // handle context menu
  const [hoveredVideo, setHoveredVideo] = useState<{
    id: number;
    location: string;
    name: string;
    position: { top: number; left: number };
  } | null>(null);
  const miniModalRef = useRef<HTMLDivElement | null>(null);

  const handleRowClick = (event: React.MouseEvent, video: any) => {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    // Calculate position relative to click position instead of row
    let left = event.clientX;

    // Check if menu would go beyond right edge
    const menuWidth = 120; // matches max-w-[120px] from the className
    if (left + menuWidth > viewportWidth) {
      left = viewportWidth - menuWidth - 10; // 10px padding from edge
    }
    // Ensure menu doesn't go beyond left edge
    left = Math.max(10, left);

    setHoveredVideo({
      ...video,
      position: {
        top: rect.top + window.scrollY,
        left: left,
      },
    });
  };

  // handle clicking outside context menu
  const handleClickOutside = (event: MouseEvent) => {
    if (
      miniModalRef.current &&
      !miniModalRef.current.contains(event.target as Node)
    ) {
      setHoveredVideo(null);
    }
  };
  // updates logs data based on any changes to history inside the store
  useEffect(() => {
    setLogs(historyDownloads);
  }, [historyDownloads]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // handle deleting file
  const handleDelete = async (videoFile: any, id: any) => {
    try {
      if (fileExistsMap[id]) {
        // If file exists, try to delete it from logs
        deleteDownload(id);
      } else {
        // If file doesn't exist, just remove from history
        deleteDownload(id);
      }
    } catch (error) {
      console.error('Error deleting:', error);
      // If any error occurs, at least try to remove from history
      deleteDownload(id);
    }
  };
  // handle state of checkboxes when all of them are checked
  useEffect(() => {
    setAllChecked(selectedItems.length === logs.length);
  }, [selectedItems, logs]);

  function handleAllCheckboxChange() {
    if (allChecked) {
      setSelectedItems([]);
    } else {
      setSelectedItems(logs.map((product) => product.id));
    }
    setAllChecked(!allChecked);
  }

  function handleCheckboxChange(id: string) {
    setSelectedItems((prevSelected) =>
      prevSelected.includes(id)
        ? prevSelected.filter((i) => i !== id)
        : [...prevSelected, id],
    );
  }

  // handle delete selected download
  const handleDeleteSelected = async () => {
    const failedToDelete = [];
    try {
      for (const id of selectedItems) {
        const video = logs.find((product) => product.id === String(id));
        if (video) {
          console.log('Selected files deleted successfully');
          deleteDownload(video.id);
          toast({
            variant: 'success',
            title: 'Download Log Deleted',
            description: 'Your download log has been deleted successfully',
            duration: 3000,
          });
        } else {
          failedToDelete.push(video.name);
        }
      }
      if (failedToDelete.length > 0) {
        setErrorTitle('Deletion Error');
        setErrorMessage(`Failed to delete: ${failedToDelete.join(', ')}`);
        setErrorVisible(true);
      }
      setSelectedItems([]); // Clear selected items after deletion
    } catch (error) {
      console.error('Error deleting selected files:', error);
      console.log(
        'An error occurred while trying to delete the selected files',
      );
    }
  };

  // handle redownload using setDownload
  const handleRedownload = async (video: any) => {
    setDownload(video.videoUrl, video.location, maxDownload);
    setHoveredVideo(null);
    toast({
      variant: 'success',
      title: 'Download Added',
      description: 'Your download has been added successfully',
      duration: 3000,
    });
  };

  // sort function
  const sortedlogs = [...logs].sort((a, b) => {
    const dateA = new Date(a.DateAdded).getTime();
    const dateB = new Date(b.DateAdded).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  // Handle sort menu click
  const handleSortClick = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setSortMenuPosition({ x: rect.left, y: rect.bottom });
    setShowSortMenu(!showSortMenu);
  };

  // Handle clicking outside sort menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(event.target as Node)
      ) {
        setShowSortMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Render the history-specific delete button in a portal
  const renderDeleteButton = () => {
    // Make sure the portal container exists
    const portalContainer = document.getElementById('taskbar-portal');

    if (portalContainer && selectedItems.length > 0) {
      return createPortal(
        <button
          onClick={handleDeleteSelected}
          className="bg-black text-gray-200 hover:bg-[#3E3E46] dark:text-darkModeButtonActive dark:bg-darkModeButtonDefault hover:dark:bg-darkModeLight hover:dark:text-body-dark px-3 py-1 mr-2 rounded-md flex gap-2 text-sm"
        >
          <LuTrash size={15} className="mt-[1.5px]" />{' '}
          <span className="hidden md:inline">Remove from History</span>
        </button>,
        portalContainer,
      );
    }
    return null;
  };

  return (
    <div className="w-full p-1">
      {renderDeleteButton()}
      <table className="w-full">
        <thead>
          <tr className="border-b text-left dark:border-gray-700">
            <th className="w-8 p-2">
              <input
                type="checkbox"
                className="rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                checked={allChecked}
                onChange={handleAllCheckboxChange}
              />
            </th>
            <th className="relative p-2 font-semibold dark:text-gray-200 select-none">
              Name
            </th>
            <th className="relative p-2 font-semibold dark:text-gray-200 select-none">
              <div
                className="flex items-center gap-1 cursor-pointer"
                onClick={handleSortClick}
              >
                Date Added
                <HiChevronUpDown className="h-4 w-4" />
              </div>
            </th>
            <th className="relative p-2 font-semibold dark:text-gray-200 select-none">
              Source
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedlogs.map((product) => (
            <tr
              key={product.id}
              className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-darkModeHover cursor-pointer
                ${
                  selectedItems.length > 0 &&
                  product.id === selectedItems[selectedItems.length - 1]
                    ? 'bg-blue-50 dark:bg-gray-600'
                    : 'dark:bg-darkMode'
                }`}
              onContextMenu={(e) => handleRowClick(e, product)}
              onClick={(e) => {
                e.stopPropagation();
                handleCheckboxChange(product.id);
              }}
            >
              <td className="w-8 p-2">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(product.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleCheckboxChange(product.id);
                  }}
                  className="rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                />
              </td>
              <td className="p-2 dark:text-gray-200 w-3/6">
                <span
                  className={`${
                    fileExistsMap[product.id]
                      ? 'text-gray-700 dark:text-gray-200'
                      : 'line-through text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {product.name}
                </span>
              </td>
              <td className="p-4 text-gray-500 dark:text-gray-400">
                {new Date(product.DateAdded).toLocaleDateString()}
              </td>
              <td className="p-4">
                <a
                  onClick={() =>
                    window.downlodrFunctions.openExternalLink(product.videoUrl)
                  }
                  className="hover:underline cursor-pointer"
                >
                  {product.extractorKey || 'YouTube'}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {hoveredVideo && (
        <div
          ref={miniModalRef}
          style={{
            position: 'absolute',
            top: hoveredVideo.position.top,
            left: hoveredVideo.position.left,
          }}
          className="bg-white dark:bg-darkModeCompliment rounded-lg shadow-lg py-1 min-w-[100px] max-w-[200px] border-2 dark:border-gray-500 border-gray-200"
        >
          <div className="px-2">
            <button
              onClick={() => handleRedownload(hoveredVideo)}
              className="w-full text-left py-2 rounded-md hover:bg-gray-100 dark:hover:bg-darkModeHover text-sm"
            >
              <span className="flex items-center space-x-2 px-2">
                <VscPlayCircle size={18} />
                <span>Redownload video</span>
              </span>
            </button>
          </div>
          <div className="px-2">
            <button
              onClick={async () =>
                handleDelete(
                  await window.downlodrFunctions.joinDownloadPath(
                    hoveredVideo.location,
                    hoveredVideo.name,
                  ),
                  hoveredVideo.id,
                )
              }
              className="w-full text-left py-2 rounded-md hover:bg-gray-100 dark:hover:bg-darkModeHover text-sm"
            >
              <span className="flex items-center space-x-2 px-2">
                <LuTrash size={16} />
                <span>Remove from History</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Sort Menu */}
      {showSortMenu && (
        <div
          ref={sortMenuRef}
          style={{
            position: 'absolute',
            top: sortMenuPosition.y,
            left: sortMenuPosition.x,
          }}
          className="bg-white dark:bg-darkModeCompliment rounded-lg shadow-lg py-1 min-w-[100px] border-2 dark:border-gray-500 border-gray-200 z-50"
        >
          <div className="px-2">
            <button
              onClick={() => {
                setSortOrder('newest');
                setShowSortMenu(false);
              }}
              className={`w-full text-left py-2 rounded-md hover:bg-gray-100 dark:hover:bg-darkModeHover ${
                sortOrder === 'newest' ? 'bg-gray-100 dark:bg-gray-700' : ''
              }`}
            >
              <span className="px-2">Newest</span>
            </button>
          </div>
          <div className="px-2 mt-1">
            <button
              onClick={() => {
                setSortOrder('oldest');
                setShowSortMenu(false);
              }}
              className={`w-full text-left py-2 rounded-md hover:bg-gray-100 dark:hover:bg-darkModeHover ${
                sortOrder === 'oldest' ? 'bg-gray-100 dark:bg-gray-700' : ''
              }`}
            >
              <span className="px-2">Oldest</span>
            </button>
          </div>
        </div>
      )}

      {isErrorVisible && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-darkModeCompliment p-6 rounded-lg shadow-xl">
            <h3 className="text-lg font-semibold mb-2">{errorTitle}</h3>
            <p className="text-gray-600 dark:text-gray-400">{errorMessage}</p>
            <button
              onClick={hideErrorCard}
              className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
