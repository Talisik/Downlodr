/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { IoMdCheckmark } from 'react-icons/io';
import useDownloadStore from '../Store/downloadStore';
import { HiChevronUpDown } from 'react-icons/hi2';

const Downloading = () => {
  const downloads = useDownloadStore((state) => state.downloading);

  return (
    <div className="w-full pb-5">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left">
            {/*  <th className="p-2 w-4">
              <input type="checkbox" className="rounded" />
            </th>*/}
            <th className="w-1/6 p-2 font-semibold">Schedule: </th>
            <th className="p-2 font-semibold">
              <div className="flex items-center gap-1">
                Size
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
            <th className="w-1/6 p-2 font-semibold">
              <div className="flex items-center gap-1">
                Status
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
            <th className="p-2 font-semibold">
              <div className="flex items-center gap-1">
                Speed
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
            <th className="p-2 font-semibold">
              <div className="flex items-center gap-1">
                Time Left
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
            <th className="p-2 font-semibold">
              <div className="flex items-center gap-1">
                Date Added
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
            <th className="p-2 font-semibold">
              <div className="flex items-center gap-1">
                Source
                <HiChevronUpDown size={14} className="flex-shrink-0" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {downloads.map((download: any) => (
            <tr key={download.id} className="border-b hover:bg-gray-50">
              <td className="p-2">
                <input type="checkbox" className="rounded" />
              </td>
              <td className="p-2">{download.displayName}</td>
              <td className="p-2">{download.size || '300 MB'}</td>
              <td className="p-2">
                {download.status === 'finished' ? (
                  <div className="flex items-center">
                    <div className="w-full bg-green-500 h-1.5 rounded-full" />
                    <IoMdCheckmark className="text-green-500 ml-2" />
                  </div>
                ) : (
                  <div className="w-full bg-gray-200 h-1.5 rounded-full">
                    <div
                      className="bg-green-500 h-full rounded-full"
                      style={{ width: `${download.progress || 0}%` }}
                    />
                  </div>
                )}
              </td>
              <td className="p-2">{download.speed || '4 MB/s'}</td>
              <td className="p-2">{download.timeLeft || '10m 30s left'}</td>
              <td className="p-2">{download.DateAdded || '30 min ago'}</td>
              <td className="p-2">{download.source || 'YouTube'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Downloading;
