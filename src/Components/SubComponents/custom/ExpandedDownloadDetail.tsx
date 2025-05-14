/**
 * A custom React component
 * A React component that displays detailed information about a download.
 * It shows the progress, transfer details, and additional information about the download.
 *
 * @param ExpandedDownloadDetailsProps
 *   @param download - An object containing details about the download, including time active, downloaded size, speed, time left, and status.
 *
 * @returns JSX.Element - The rendered expanded download details component.
 */
import React, { useState } from 'react';
import { formatElapsedTime } from '../../../Store/downloadStore';

// Interface representing the details of a download
interface DownloadDetails {
  timeActive?: string; // Time the download has been active
  downloaded?: string; // Amount downloaded
  speed?: string; // Download speed
  timeLeft?: string; // Estimated time left for the download
  size?: number; // Total size of the download in bytes
  DateAdded: string; // Date the download was added
  location?: string; // Location of the download file
  progress?: number; // Download progress percentage
  status?: string; // Current status of the download
  elapsed: number;
}

// Interface representing the props for the ExpandedDownloadDetails component
interface ExpandedDownloadDetailsProps {
  download?: DownloadDetails | null;
}

const ExpandedDownloadDetails: React.FC<ExpandedDownloadDetailsProps> = ({
  download,
}) => {
  // Add state to track expanded/collapsed state
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Check if download is null or undefined
  const isEmpty = !download;

  // Format file size helper function
  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes) return '—';
    const KB = 1024;
    const MB = KB * 1024;
    const GB = MB * 1024;

    if (bytes >= GB) {
      return `${(bytes / GB).toFixed(2)} GB`;
    } else if (bytes >= MB) {
      return `${(bytes / MB).toFixed(2)} MB`;
    } else if (bytes >= KB) {
      return `${(bytes / KB).toFixed(2)} KB`;
    } else {
      return `${bytes} bytes`;
    }
  };

  // Toggle expanded/collapsed state
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className={`w-full bg-detailsTab dark:bg-darkModeCompliment border-t-2 border-gray-300 dark:border-darkModeBorderColor ${
        isExpanded ? 'h-auto' : 'h-auto'
      } flex flex-col shadow-lg transition-all duration-300`}
    >
      {/* Progress Bar - Always visible */}
      <div className="px-4 pt-2 pb-1">
        <div className="flex flex-row items-center gap-4">
          <p className="font-semibold dark:text-gray-200 text-[12px]">
            Progress
          </p>
          <div className="w-full">
            <div className="w-full bg-white rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  isEmpty || !download.progress || download.progress === 0
                    ? 'bg-gray-400 dark:bg-gray-600'
                    : download.progress === 100
                    ? 'bg-green-500'
                    : 'bg-orange-500'
                }`}
                style={{ width: `${isEmpty ? 0 : download.progress || 0}%` }}
              ></div>
            </div>
          </div>
          {/* Add percentage number */}
          <span className="dark:text-gray-200 text-[12px]">
            {isEmpty ? 0 : download.progress || 0}%
          </span>
        </div>
      </div>

      {/* The rest of your details component */}
      {isExpanded && (
        <div className="px-4 pb-2">
          <div className="flex flex-col md:flex-row py-2 justify-center">
            {/* Transfer section - now takes 40% of the space */}
            <div className="p-3 w-full md:w-2/5">
              <p className="text-[12px] mb-3">Transfer</p>
              <div className="text-[12px]">
                <div className="mb-1">
                  <span className="font-semibold ">Download Time: </span>
                  {isEmpty ? '' : formatElapsedTime(download.elapsed)}
                </div>
                <div className="mb-1">
                  <span className="font-semibold ">Downloaded:</span>{' '}
                  {isEmpty ? '' : formatFileSize(download.size)}
                </div>
                <div className="mb-1">
                  <span className="font-semibold ">Download speed: </span>
                  {isEmpty
                    ? ''
                    : download.progress === 100
                    ? `${download.speed} avg.`
                    : download.speed || 0}
                </div>
                <div>
                  <span className="font-semibold ">ETA: </span>
                  {isEmpty
                    ? ''
                    : download.progress === 100
                    ? '∞'
                    : download.timeLeft || ''}
                </div>
              </div>
            </div>

            {/* Centered divider - thicker and shorter */}
            <div className="hidden md:flex items-center justify-center">
              <div className="w-0.5 h-3/4 bg-gray-300 dark:bg-gray-600 mx-8"></div>
            </div>

            {/* File information section - now takes 60% of the space */}
            <div className="p-3 w-full md:w-3/5">
              <h3 className="text-[12px] mb-3">File information</h3>
              <div className="text-[12px]">
                <div className="mb-1">
                  <span className="font-semibold ">Total Size: </span>{' '}
                  {isEmpty ? '' : formatFileSize(download.size)}
                </div>
                <div className="mb-1">
                  <span className="font-semibold ">Added On: </span>
                  {isEmpty
                    ? ''
                    : download.DateAdded
                    ? new Date(download.DateAdded).toLocaleString()
                    : ''}
                </div>
                <div className="mb-1">
                  <span className="font-semibold ">Save Path: </span>
                  {isEmpty ? '' : download.location || ''}
                </div>
                <div>
                  <span className="font-semibold ">Created On: </span>
                  {isEmpty
                    ? ''
                    : download.DateAdded
                    ? new Date(download.DateAdded).toLocaleString()
                    : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status bar - always visible */}
      <div
        className="sticky bottom-0 left-0 right-0 py-1 border-t dark:border-t border-gray-300 dark:border-darkModeBorderColor flex justify-between mt-auto cursor-pointer"
        onClick={toggleExpanded}
      >
        {/* Toggle button */}
        <button
          className="ml-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          onClick={toggleExpanded}
        >
          {isExpanded ? (
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                clipRule="evenodd"
              ></path>
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              ></path>
            </svg>
          )}
        </button>

        {/* Download info */}
        <p className="text-gray-600 dark:text-gray-300 px-4 flex items-center text-[11px]">
          <svg
            className="w-3 h-3 mr-1"
            fill="blue"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clipRule="evenodd"
            ></path>
          </svg>
          {isEmpty
            ? '0 MB/s'
            : `${download.speed || '0 MB/s'} (${formatFileSize(
                download.size || 0,
              )})`}
        </p>
      </div>
    </div>
  );
};

export default ExpandedDownloadDetails;
