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
import React from 'react';

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
}

// Interface representing the props for the ExpandedDownloadDetails component
interface ExpandedDownloadDetailsProps {
  download?: DownloadDetails | null;
}

const ExpandedDownloadDetails: React.FC<ExpandedDownloadDetailsProps> = ({
  download,
}) => {
  // Check if download is null or undefined
  const isEmpty = !download;

  // Format file size helper function
  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes) return '—';

    const MB = 1048576;
    const GB = MB * 1024;

    if (bytes >= GB) {
      return `${(bytes / GB).toFixed(2)} GB`;
    } else {
      return `${(bytes / MB).toFixed(2)} MB`;
    }
  };
  //         <hr className="solid mt-2 mb-2 -mx-4 w-[calc(100%+32px)] border-t-1 border-divider dark:border-gray-700" />

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 h-[39%] flex flex-col shadow-lg">
      <div className="overflow-auto flex-grow px-4 pt-3">
        {/* Progress Bar */}
        <div className="flex flex-row items-center gap-4">
          <p className="font-semibold dark:text-gray-200 text-[12px]">
            Progress
          </p>
          <div className="w-full">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
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
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="rounded border-2 border-gray-300 dark:border-gray-600 p-3">
            <p className="text-[12px] font-semibold mb-2">Transfer</p>
            <div className="text-[12px]">
              <div className="mb-1">
                Download Time: {isEmpty ? '—' : download.timeActive || '< 1m'}
              </div>
              <div className="mb-1">
                Downloaded: {isEmpty ? '—' : formatFileSize(download.size)}
              </div>
              <div className="mb-1">
                Download speed: {isEmpty ? '—' : download.speed || '—'}
              </div>
              <div>ETA: {isEmpty ? '—' : download.timeLeft || '—'}</div>
            </div>
          </div>

          <div className="rounded border-2 border-gray-300 dark:border-gray-600 p-3">
            <h3 className="text-[12px] font-semibold mb-2">File information</h3>
            <div className="text-[12px]">
              <div className="mb-1">
                Total Size: {isEmpty ? '—' : formatFileSize(download.size)}
              </div>
              <div className="mb-1">
                Added On:{' '}
                {isEmpty
                  ? '—'
                  : download.DateAdded
                  ? new Date(download.DateAdded).toLocaleString()
                  : '—'}
              </div>
              <div className="mb-1">
                Save Path: {isEmpty ? '—' : download.location || '—'}
              </div>
              <div>
                Created On:{' '}
                {isEmpty
                  ? '—'
                  : download.DateAdded
                  ? new Date(download.DateAdded).toLocaleString()
                  : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 left-0 right-0 py-1 border-t border-gray-300 dark:border-gray-600 flex justify-end mt-auto">
        <p className="text-white px-4 flex items-center text-[11px]">
          <svg
            className="w-3 h-3 mr-1"
            fill="currentColor"
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
