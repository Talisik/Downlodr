/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from 'react';
import useDownloadStore from '../Store/downloadStore';
import { useMainStore } from '../Store/mainStore';
import { HiChevronUpDown } from 'react-icons/hi2';
import { createPortal } from 'react-dom';
import { LuTrash } from 'react-icons/lu';
import { VscPlayCircle } from 'react-icons/vsc';
import { toast } from '../Components/SubComponents/shadcn/hooks/use-toast';

interface FileExistsMap {
  [key: string]: boolean;
}
// Pre change of new version
const History = () => {
  const { historyDownloads, deleteDownload, setDownload } = useDownloadStore();
  const { settings } = useMainStore();

  const [products, setProducts] = useState(historyDownloads);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [allChecked, setAllChecked] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isErrorVisible, setErrorVisible] = useState(false); //error card
  const [errorTitle, setErrorTitle] = useState('');
  const hideErrorCard = () => {
    setErrorVisible(false);
  };
  const maxDownload =
    settings.defaultDownloadSpeed === 0
      ? ''
      : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`;
  const [fileExistsMap, setFileExistsMap] = useState<FileExistsMap>({});
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortMenuPosition, setSortMenuPosition] = useState({ x: 0, y: 0 });
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAllFiles = async () => {
      const newFileExistsMap: FileExistsMap = {};
      for (const download of products) {
        const exists = await window.downlodrFunctions.fileExists(
          `${download.location}${download.name}`,
        );
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
  }, [products]);

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

  const handleClickOutside = (event: MouseEvent) => {
    if (
      miniModalRef.current &&
      !miniModalRef.current.contains(event.target as Node)
    ) {
      setHoveredVideo(null);
    }
  };

  useEffect(() => {
    setProducts(historyDownloads);
  }, [historyDownloads]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  /*
  const OpenVideoButton = async (videoPath: string) => {
    try {
      await window.downlodrFunctions.openVideo(videoPath);
    } catch {
      setErrorTitle('Directory Error');
      setErrorMessage('Failed to open video');
      setErrorVisible(true);
    }
  };

  const handleGoToFolder = async (folderPath: string) => {
    const response = await window.downlodrFunctions.openFolder(folderPath);

    if (response.success) {
      console.log('Folder opened successfully!');
    } else {
      console.log(`Failed to open folder: ${response.error}`);
    }
  }; */

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

  useEffect(() => {
    setAllChecked(selectedItems.length === products.length);
  }, [selectedItems, products]);

  function handleAllCheckboxChange() {
    if (allChecked) {
      setSelectedItems([]);
    } else {
      setSelectedItems(products.map((product) => product.id));
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

  const handleDeleteSelected = async () => {
    const failedToDelete = [];
    try {
      for (const id of selectedItems) {
        const video = products.find((product) => product.id === String(id));
        if (video) {
          console.log('Selected files deleted successfully');
          deleteDownload(video.id);
          toast({
            variant: 'success',
            title: 'Download Log Deleted',
            description: 'Your download log has been deleted successfully',
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

  /*  const handleDeleteSelected = async () => {
    const failedToDelete = [];
    try {
      for (const id of selectedItems) {
        const video = products.find((product) => product.id === String(id));
        if (video) {
          const success = await window.downlodrFunctions.deleteFile(
            await window.downlodrFunctions.joinDownloadPath(
              video.location,
              video.name,
            ),
          );
          if (success) {
            console.log('Selected files deleted successfully');
            deleteDownload(video.id);
          } else {
            failedToDelete.push(video.name);
          }
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

  */

  /* function parseISODate(isoDateString: any) {
    const dateObject = new Date(isoDateString);
    let hours = dateObject.getHours();
    const minutes = String(dateObject.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const time = `${hours}:${minutes} ${ampm}`;
    return time;
  } */

  /* const groupedProducts = products.reduce(
    (acc: { [key: string]: typeof products }, product) => {
      const date = new Date(product.DateAdded).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(product);
      return acc;
    },
    {},
  );
*/
  const handleRedownload = async (video: any) => {
    setDownload(video.videoUrl, video.location, maxDownload);
    setHoveredVideo(null);
    toast({
      variant: 'success',
      title: 'Download Added',
      description: 'Your download has been added successfully',
    });
  };

  // Add sort function
  const sortedProducts = [...products].sort((a, b) => {
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

  // Render the delete button in a portal
  const renderDeleteButton = () => {
    const portalContainer = document.getElementById('taskbar-portal');

    if (portalContainer && selectedItems.length > 0) {
      return createPortal(
        <button
          onClick={handleDeleteSelected}
          className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors text-sm"
        >
          Delete Selected
        </button>,
        portalContainer,
      );
    }
    return null;
  };

  return (
    <div className="w-full">
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
          {sortedProducts.map((product) => (
            <tr
              key={product.id}
              className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              onContextMenu={(e) => handleRowClick(e, product)}
            >
              <td className="w-8 p-2">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(product.id)}
                  onChange={() => handleCheckboxChange(product.id)}
                  className="rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                />
              </td>
              <td className="p-2 dark:text-gray-200 w-4/6">
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
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 min-w-[100px] max-w-[200px] border-2 dark:border-gray-500 border-gray-200"
        >
          <button
            onClick={() => handleRedownload(hoveredVideo)}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
          >
            <span className="flex items-center space-x-2">
              <VscPlayCircle size={18} />
              <span>Redownload video</span>
            </span>{' '}
          </button>
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
            className="text-sm w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <span className="flex items-center space-x-2">
              <LuTrash size={16} />
              <span>Remove from History</span>
            </span>{' '}
          </button>
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
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 min-w-[100px] border-2 dark:border-gray-500 border-gray-200 z-50"
        >
          <button
            onClick={() => {
              setSortOrder('newest');
              setShowSortMenu(false);
            }}
            className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
              sortOrder === 'newest' ? 'bg-gray-100 dark:bg-gray-700' : ''
            }`}
          >
            Newest
          </button>
          <button
            onClick={() => {
              setSortOrder('oldest');
              setShowSortMenu(false);
            }}
            className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
              sortOrder === 'oldest' ? 'bg-gray-100 dark:bg-gray-700' : ''
            }`}
          >
            Oldest
          </button>
        </div>
      )}

      {isErrorVisible && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
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
