import React, { useEffect, useRef, useState } from 'react';
import useDownloadStore from '../Store/downloadStore';
import { FaYoutube } from 'react-icons/fa';

interface FileExistsMap {
  [key: string]: boolean;
}

const History = () => {
  const { historyDownloads, deleteDownload } = useDownloadStore();
  const [products, setProducts] = useState(historyDownloads);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [allChecked, setAllChecked] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isErrorVisible, setErrorVisible] = useState(false); //error card
  const [errorTitle, setErrorTitle] = useState('');
  const hideErrorCard = () => {
    setErrorVisible(false);
  };

  const [fileExistsMap, setFileExistsMap] = useState<FileExistsMap>({});

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

    // Calculate initial position
    let left = rect.left + window.scrollX - target.offsetWidth;

    // Check if menu would go beyond right edge (assuming menu width of 160px)
    const menuWidth = 160; // matches min-w-[160px] from the className
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
  };

  const handleDelete = async (videoFile: any, id: any) => {
    try {
      if (fileExistsMap[id]) {
        // If file exists, try to delete it from disk
        const success = await window.downlodrFunctions.deleteFile(videoFile);
        if (success) {
          deleteDownload(id);
          console.log('File moved to trash successfully');
        } else {
          setErrorTitle('Deletion Error');
          setErrorMessage('Failed to send to trash');
          setErrorVisible(true);
        }
      } else {
        // If file doesn't exist, just remove from history
        deleteDownload(id);
        console.log('Removed from history');
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

  function parseISODate(isoDateString: any) {
    const dateObject = new Date(isoDateString);
    let hours = dateObject.getHours();
    const minutes = String(dateObject.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const time = `${hours}:${minutes} ${ampm}`;
    return time;
  }

  const groupedProducts = products.reduce(
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-white dark:bg-darkModeCompliment rounded-lg shadow-lg">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              checked={allChecked}
              onChange={handleAllCheckboxChange}
            />
            <h3 className="text-lg font-semibold dark:text-white">All</h3>
          </div>
          {selectedItems.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
            >
              Delete Selected
            </button>
          )}
        </div>

        {Object.entries(groupedProducts)
          .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
          .map(([date, products]) => (
            <div key={date} className="p-4">
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                {date}
              </h4>
              <div className="space-y-2">
                {(products as any[]).map((product: any) => (
                  <div
                    key={product.id}
                    className="flex items-center space-x-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(product.id)}
                      onChange={() => handleCheckboxChange(product.id)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-20">
                      {parseISODate(product.DateAdded)}
                    </span>
                    <FaYoutube className="text-red-500 text-xl" />
                    <span
                      className={`flex-1 truncate ${
                        fileExistsMap[product.id]
                          ? 'text-gray-700 dark:text-gray-200'
                          : 'line-through text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {product.name}
                    </span>
                    <button
                      onClick={(event) => handleRowClick(event, product)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"
                    >
                      ⋮
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      {hoveredVideo && (
        <div
          ref={miniModalRef}
          style={{
            position: 'absolute',
            top: `${Math.min(
              hoveredVideo.position.top,
              window.innerHeight - 150, // Approximate menu height
            )}px`,
            left: hoveredVideo.position.left,
          }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 min-w-[50px] max-w-[120px] border-2 dark:border-gray-500 border-gray-200"
        >
          {fileExistsMap[hoveredVideo.id] && (
            <button
              onClick={async () =>
                OpenVideoButton(
                  await window.downlodrFunctions.joinDownloadPath(
                    hoveredVideo.location,
                    hoveredVideo.name,
                  ),
                )
              }
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              View Video
            </button>
          )}
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500"
          >
            Delete
          </button>
          <button
            onClick={async () => handleGoToFolder(hoveredVideo.location)}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Open Folder
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
