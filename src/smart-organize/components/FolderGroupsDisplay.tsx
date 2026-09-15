/**
 * A folder-style display component for organization groups
 * Shows groups as visual folder containers with thumbnail grids
 * Similar to CourseSmartOrganize but adapted for OrganizationTable
 *
 * @param groups - Object containing category groups and their videos
 * @param finishedDownloads - Array of download data for thumbnails
 * @param onGroupClick - Callback when a group folder is clicked
 * @param viewedGroup - Currently viewed group (if any)
 * @param className - Additional CSS classes
 * @returns JSX.Element - The rendered folder groups display
 */

import useDownloadStore from '@/downlodr/store/downloadStore';
import React from 'react';
import { BsPlusLg } from 'react-icons/bs';
import { FiPlayCircle } from 'react-icons/fi';

type FinishedDownload = ReturnType<
  typeof useDownloadStore.getState
>['finishedDownloads'][0];

interface FolderGroupsDisplayProps {
  groups: Record<
    string,
    {
      video_id: string;
      video_title: string;
      thumbnails?: string;
      channelName?: string;
      tags?: string[];
    }[]
  >;
  handleAddNewCategory: () => void;
  finishedDownloads: FinishedDownload[];
  onGroupClick: (
    groupName: string,
    videos: {
      video_id: string;
      video_title: string;
      thumbnails?: string;
      channelName?: string;
      tags?: string[];
    }[],
  ) => void;
  viewedGroup?: string | null;
  className?: string;
}

const FolderGroupsDisplay: React.FC<FolderGroupsDisplayProps> = ({
  groups,
  finishedDownloads,
  onGroupClick,
  viewedGroup,
  className = '',
  handleAddNewCategory,
}) => {
  // Filter out Uncategorized for folder display
  const categorizedGroups = Object.entries(groups).filter(
    ([groupName]) => groupName !== 'Uncategorized',
  );
  // At the top of your component
  const uncategorizedVideos = groups?.['Uncategorized'] ?? [];

  const previewLimit = uncategorizedVideos.length > 4 ? 9 : 4;

  const gridClass =
    previewLimit === 9 ? 'grid-cols-3 grid-rows-3' : 'grid-cols-2 grid-rows-2';

  const displayVideos = uncategorizedVideos.slice(0, previewLimit);

  if (categorizedGroups.length === 0 && uncategorizedVideos.length === 0) {
    return (
      <div
        className={`border border-[#E4E4E7] dark:border-gray-700 rounded-md p-4 pl-8 bg-white dark:bg-darkModeBG ${className}`}
      >
        <p className="text-center text-gray-500 dark:text-gray-400 text-xs">
          No groups organized yet
        </p>
      </div>
    );
  }

  return (
    <div
      className={`${
        viewedGroup
          ? 'flex flex-col gap-4 py-6 px-4 pl-8'
          : 'flex flex-row gap-8 py-6 px-4 flex-wrap pl-10'
      } ${className}`}
    >
      <div
        className="flex flex-col items-center gap-1 cursor-pointer"
        onClick={() => handleAddNewCategory()}
      >
        <div className="flex justify-center items-center rounded-2xl bg-[#F2F2F2] dark:bg-[#272727] shadow-sm p-3 w-[180px] h-44">
          <BsPlusLg size={32} />
        </div>
        <div className="mt-1 text-center">
          <p
            className={`text-xs font-bold truncate dark:text-gray-200 
              w-full max-w-[200px] text-center
            `}
          >
            Add New Category
          </p>
        </div>
      </div>

      {/* Uncategorized Videos Folder */}
      {/* Uncategorized Videos Folder */}
      {uncategorizedVideos.length > 0 && (
        <div
          className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => onGroupClick('Uncategorized', uncategorizedVideos)}
        >
          <div className="flex justify-center items-center rounded-2xl bg-[#F2F2F2] dark:bg-[#272727] shadow-sm p-3 w-[180px] h-44 relative overflow-hidden">
            <div className={`grid ${gridClass} gap-1 w-full h-full`}>
              {displayVideos.map((video) => {
                const downloadData = finishedDownloads.find(
                  (d) => d.id === video.video_id,
                );
                return (
                  <div
                    key={video.video_id}
                    className="aspect-square w-full rounded-md overflow-hidden"
                  >
                    {downloadData?.thumbnails &&
                    downloadData.thumbnails !== '—' ? (
                      <img
                        src={downloadData.thumbnails}
                        alt={video.video_title}
                        className="w-full h-full object-cover object-center"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove(
                            'hidden',
                          );
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-full h-full rounded-md flex items-center justify-center bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.5)_0%,transparent_45%),radial-gradient(circle_at_45%_80%,rgba(255,255,255,0.4)_0%,transparent_35%),linear-gradient(135deg,#ffa42e,#fec77d,#ffa42e,#fec170)] ${
                        downloadData?.thumbnails &&
                        downloadData.thumbnails !== '—'
                          ? 'hidden'
                          : ''
                      }`}
                    >
                      <FiPlayCircle size={14} color="#F45513" />
                    </div>
                  </div>
                );
              })}
              {Array.from({ length: previewLimit - displayVideos.length }).map(
                (_, index) => (
                  <div
                    key={`empty-${index}`}
                    className="aspect-square bg-[#F2F2F2] dark:bg-[#272727] rounded-sm opacity-50"
                  />
                ),
              )}
            </div>
          </div>

          <div className="mt-1 text-center">
            <p className="text-xs text-primary dark:text-primaryDarkText font-bold truncate dark:text-gray-200 w-full max-w-[200px] text-center">
              Uncategorized
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {uncategorizedVideos.length} videos
            </p>
          </div>
        </div>
      )}

      {categorizedGroups.map(([groupName, videos]) => {
        const vids = Array.isArray(videos) ? videos : [];

        const previewLimit = vids.length > 4 ? 9 : 4;
        const display = vids.slice(0, previewLimit);

        const gridClass =
          previewLimit === 9
            ? 'grid-cols-3 grid-rows-3'
            : 'grid-cols-2 grid-rows-2';

        return (
          <div
            key={groupName}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onGroupClick(groupName, videos);
            }}
            className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity gap-1"
          >
            {/* Folder Container */}
            <div
              className={`${
                viewedGroup ? 'w-full max-w-[200px] h-36' : 'w-[180px] h-44'
              } rounded-2xl bg-[#F2F2F2] dark:bg-[#272727] shadow-sm grid ${gridClass} overflow-hidden p-3 gap-2`}
            >
              {display.map((video, i) => {
                const id = typeof video === 'string' ? video : video.video_id;
                const rawThumb = finishedDownloads.find((d) => d.id === id)
                  ?.thumbnails;
                const thumb = rawThumb && rawThumb !== '—' ? rawThumb : '';
                return (
                  <div
                    key={i}
                    className="aspect-square w-full rounded-md overflow-hidden"
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        className="w-full h-full object-cover object-center"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove(
                            'hidden',
                          );
                        }}
                        alt={`Thumbnail ${i + 1}`}
                      />
                    ) : null}
                    <div
                      className={`w-full h-full rounded-md flex items-center justify-center bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.5)_0%,transparent_45%),radial-gradient(circle_at_45%_80%,rgba(255,255,255,0.4)_0%,transparent_35%),linear-gradient(135deg,#ffa42e,#fec77d,#ffa42e,#fec170)] ${
                        thumb ? 'hidden' : ''
                      }`}
                    >
                      <FiPlayCircle size={14} color="#F45513" />
                    </div>
                  </div>
                );
              })}

              {/* Fill Empty Slots */}
              {Array.from({ length: previewLimit - display.length }).map(
                (_, i) => (
                  <div
                    key={'empty-' + i}
                    className="w-full h-full rounded-md bg-[#F2F2F2] dark:bg-[#272727] opacity-20"
                  />
                ),
              )}
            </div>

            {/* Folder Label */}
            <div className="mt-1 text-center">
              <p
                className={`text-xs font-bold truncate dark:text-gray-200 ${
                  viewedGroup ? 'w-full max-w-[200px]' : 'w-28'
                }`}
              >
                {groupName}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {vids.length} videos
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FolderGroupsDisplay;
