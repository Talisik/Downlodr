import React from 'react';

interface DownloadDetails {
  timeActive?: string;
  downloaded?: string;
  speed?: string;
  timeLeft?: string;
  size?: number;
  DateAdded: string;
  location?: string;
  progress?: number;
  status?: string;
}

interface ExpandedDownloadDetailsProps {
  download: DownloadDetails;
}

const ExpandedDownloadDetails: React.FC<ExpandedDownloadDetailsProps> = ({
  download,
}) => {
  return (
    <tr className="bg-lightGray text-xs">
      <td colSpan={8} className="p-4">
        {/* Progress Bar */}
        <div className="flex flex-row items-center gap-4">
          <p className="font-semibold">Progress</p>
          <div className="w-full">
            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  !download.progress || download.progress === 0
                    ? 'bg-gray-400'
                    : download.progress === 100
                    ? 'bg-green-500'
                    : 'bg-orange-500'
                }`}
                style={{ width: `${download.progress || 0}%` }}
              ></div>
            </div>
          </div>
          {/* Add percentage number */}
          <span>{download.progress || 0}%</span>
        </div>
        <hr className="solid mt-2 mb-2 -mx-4 w-[calc(100%+32px)] border-t-1 border-divider" />

        <div className="flex flex-col gap-4">
          <div>
            <h4 className="mb-2">Transfer</h4>
            <div className="space-y-1 flex flex-row gap-x-12 items-center justify-start">
              <p>
                {' '}
                <span className="font-bold">Time Active: </span>{' '}
                <span>{download.timeActive || '1m'}</span>
              </p>
              <p>
                {' '}
                <span className="font-bold">Downloaded: </span>{' '}
                <span>{download.size || '0 MB'}</span>
              </p>
              <p>
                {' '}
                <span className="font-bold">Download Speed: </span>{' '}
                <span>{download.speed || '0 KB/s'}</span>
              </p>
              <p>
                {' '}
                <span className="font-bold">ETA:</span>{' '}
                <span>{download.timeLeft || 'Unknown' || 'Unknown'}</span>
              </p>
            </div>
          </div>
          <div>
            <h4 className="mb-2">Information</h4>
            <div className="space-y-1 flex flex-row gap-x-12 items-center justify-start">
              <p>
                {' '}
                <span className="font-bold">Total Size:</span>{' '}
                <span>
                  {' '}
                  {download.size
                    ? `${(download.size / 1048576).toFixed(2)} MB`
                    : 'Unknown'}
                </span>
              </p>
              <p>
                {' '}
                <span className="font-bold">Added On: </span>{' '}
                <span>{new Date(download.DateAdded).toLocaleString()}</span>
              </p>
              <p>
                {' '}
                <span className="font-bold">Save Path: </span>{' '}
                <span>{download.location}</span>
              </p>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
};

export default ExpandedDownloadDetails;
