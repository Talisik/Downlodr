import React from 'react';
import { HiChevronUpDown } from 'react-icons/hi2';
import useDownloadStore from '../Store/downloadStore';

const CompletedDownloads = () => {
  const finished = useDownloadStore((state) => state.finishedDownloads);
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
          <tr className="border-b text-left">
            <th className="pl-4 w-1/5 p-2 font-semibold">Schedule: </th>
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
          {finished.map((download) => (
            <tr key={download.id} className="border-b hover:bg-gray-50">
              <td className="p-2  pl-5">{download.name}</td>
              <td className="p-2">
                {download.size
                  ? `${(download.size / 1048576).toFixed(2)} MB`
                  : 'Pending'}
              </td>
              <td className="p-2">
                <div className="flex items-center">
                  <span className="text-sm text-gray-600">
                    {download.status}
                  </span>
                </div>
              </td>
              <td className="p-2">{download.speed || '-'}</td>
              <td className="p-2">{download.timeLeft}</td>
              <td className="p-2">{formatRelativeTime(download.DateAdded)}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CompletedDownloads;
