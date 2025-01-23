import React from 'react';
import { HiChevronUpDown } from 'react-icons/hi2';
import useDownloadStore from '../Store/downloadStore';
import { useResizableColumns } from '../Components/SubComponents/custom/ResizableColumns/useResizableColumns';
import ResizableHeader from '../Components/SubComponents/custom/ResizableColumns/ResizableHeader';

const CompletedDownloads = () => {
  const finished = useDownloadStore((state) => state.finishedDownloads);

  const { columns, startResizing } = useResizableColumns([
    { id: 'name', width: 300, minWidth: 150 },
    { id: 'size', width: 100, minWidth: 80 },
    { id: 'status', width: 200, minWidth: 150 },
    { id: 'speed', width: 100, minWidth: 80 },
    { id: 'timeLeft', width: 100, minWidth: 80 },
    { id: 'dateAdded', width: 150, minWidth: 120 },
  ]);

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
          <tr className="border-b text-left dark:border-gray-700">
            <ResizableHeader
              width={columns[0].width}
              onResizeStart={(e) => startResizing('name', e.clientX)}
            >
              Schedule
            </ResizableHeader>
            <ResizableHeader
              width={columns[1].width}
              onResizeStart={(e) => startResizing('size', e.clientX)}
            >
              Size
            </ResizableHeader>
            <ResizableHeader
              width={columns[2].width}
              onResizeStart={(e) => startResizing('status', e.clientX)}
            >
              Status
            </ResizableHeader>
            <ResizableHeader
              width={columns[3].width}
              onResizeStart={(e) => startResizing('speed', e.clientX)}
            >
              Speed
            </ResizableHeader>
            <ResizableHeader
              width={columns[4].width}
              onResizeStart={(e) => startResizing('timeLeft', e.clientX)}
            >
              Time Left
            </ResizableHeader>
            <ResizableHeader
              width={columns[5].width}
              onResizeStart={(e) => startResizing('dateAdded', e.clientX)}
            >
              Date Added
            </ResizableHeader>
            <th className="w-20 p-2 font-semibold">
              <div className="flex items-center dark:text-gray-200">
                Source
                <HiChevronUpDown
                  size={14}
                  className="flex-shrink-0 dark:text-gray-400"
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {finished.map((download) => (
            <tr
              key={download.id}
              className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-darkMode"
            >
              <td
                style={{ width: columns[0].width }}
                className="p-2 pl-5 dark:text-gray-200"
              >
                <div className="line-clamp-2 break-words">{download.name}</div>
              </td>
              <td
                style={{ width: columns[1].width }}
                className="p-2 dark:text-gray-200"
              >
                {download.size
                  ? `${(download.size / 1048576).toFixed(2)} MB`
                  : 'Pending'}
              </td>
              <td style={{ width: columns[2].width }} className="p-2">
                <div className="flex items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {download.status}
                  </span>
                </div>
              </td>
              <td
                style={{ width: columns[3].width }}
                className="p-2 dark:text-gray-200"
              >
                {download.speed || '-'}
              </td>
              <td
                style={{ width: columns[4].width }}
                className="p-2 dark:text-gray-200"
              >
                {download.timeLeft}
              </td>
              <td
                style={{ width: columns[5].width }}
                className="p-2 dark:text-gray-200"
              >
                {formatRelativeTime(download.DateAdded)}
              </td>
              <td className="w-20 p-2">
                <a
                  href={download.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline dark:text-blue-400"
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
