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
  download: DownloadDetails;
}

const ExpandedDownloadDetails: React.FC<ExpandedDownloadDetailsProps> = ({
  download,
}) => {
  // Add this helper function before the AllDownloads component
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

  return (
    <tr className="bg-lightGray dark:bg-gray-800 text-xs">
      <td colSpan={9} className="p-4">
        {/* Progress Bar */}
        <div className="flex flex-row items-center gap-4">
          <p className="font-semibold dark:text-gray-200">Progress</p>
          <div className="w-full">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-2">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  !download.progress || download.progress === 0
                    ? 'bg-gray-400 dark:bg-gray-600'
                    : download.progress === 100
                    ? 'bg-green-500'
                    : 'bg-orange-500'
                }`}
                style={{ width: `${download.progress || 0}%` }}
              ></div>
            </div>
          </div>
          {/* Add percentage number */}
          <span className="dark:text-gray-200">{download.progress || 0}%</span>
        </div>
        <hr className="solid mt-2 mb-2 -mx-4 w-[calc(100%+32px)] border-t-1 border-divider dark:border-gray-700" />

        <div className="flex flex-col gap-4">
          <div>
            <h4 className="mb-2 dark:text-gray-200">Transfer</h4>
            <div className="space-y-1 flex flex-row gap-x-12 items-center justify-start">
              <p>
                <span className="font-bold dark:text-gray-200">
                  Time Active:{' '}
                </span>
                <span className="dark:text-gray-300">
                  {download.timeActive || '1m'}
                </span>
              </p>
              <p>
                <span className="font-bold dark:text-gray-200">
                  Downloaded:{' '}
                </span>
                <span className="dark:text-gray-300">
                  {formatFileSize(download.size)}
                </span>
              </p>
              <p>
                <span className="font-bold dark:text-gray-200">Status: </span>
                <span
                  className="dark:text-gray-300 capitalize
"
                >
                  {download.status}
                </span>
              </p>
              <p>
                <span className="font-bold dark:text-gray-200">
                  Average Download Speed:{' '}
                </span>
                <span className="dark:text-gray-300">
                  {download.speed || '0 KB/s'}
                </span>
              </p>
              {download.speed === 'finished' && (
                <p>
                  <span className="font-bold dark:text-gray-200">ETA: </span>
                  <span className="dark:text-gray-300">
                    {download.timeLeft || '-'}
                  </span>
                </p>
              )}
            </div>
          </div>
          <div>
            <h4 className="mb-2 dark:text-gray-200">File Information</h4>
            <div className="space-y-1 flex flex-row gap-x-12 items-center justify-start">
              <p>
                <span className="font-bold dark:text-gray-200">
                  Total Size:{' '}
                </span>
                <span className="dark:text-gray-300">
                  {formatFileSize(download.size)}
                </span>
              </p>
              <p>
                <span className="font-bold dark:text-gray-200">Added On: </span>
                <span className="dark:text-gray-300">
                  {new Date(download.DateAdded).toLocaleString()}
                </span>
              </p>
              <p>
                <span className="font-bold dark:text-gray-200">
                  Save Path:{' '}
                </span>
                <span className="dark:text-gray-300">{download.location}</span>
              </p>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
};

export default ExpandedDownloadDetails;
