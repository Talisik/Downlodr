/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { IoMdCheckmark } from 'react-icons/io';
import useDownloadStore from '../Store/downloadStore';
import { HiChevronUpDown } from 'react-icons/hi2';

const Downloading = () => {
  const downloading = useDownloadStore((state) => state.downloading);

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
            <th className="w-1/4 p-2 font-semibold pl-5">Schedule: </th>
            <th className="w-20 p-2 font-semibold">
              <div className="flex items-center">
                Size
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
            <th className="w-1/4 p-2 font-semibold">
              <div className="flex items-center">
                Status
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
            <th className="w-24 p-2 font-semibold">
              <div className="flex items-center">
                Speed
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
            <th className="w-24 p-2 font-semibold">
              <div className="flex items-center">
                Time Left
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
            <th className="w-32 p-2 font-semibold">
              <div className="flex items-center">
                Date Added
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
            <th className="w-24 p-2 font-semibold">
              <div className="flex items-center">
                Source
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {downloading.map((download) => (
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

export default Downloading;
