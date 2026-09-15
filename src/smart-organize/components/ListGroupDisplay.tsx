import useDownloadStore from '@/downlodr/store/downloadStore';
import React from 'react';
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

const ListGroupsDisplay: React.FC<FolderGroupsDisplayProps> = ({
  groups,
  finishedDownloads,
  onGroupClick,
  viewedGroup,
  className = '',
}) => {
  const categorizedGroups = Object.entries(groups).filter(
    ([groupName]) => groupName !== 'Uncategorized',
  );

  const uncategorizedVideos = groups?.['Uncategorized'] ?? [];

  // If no groups at all
  if (categorizedGroups.length === 0 && uncategorizedVideos.length === 0) {
    return (
      <div
        className={`border border-[#E4E4E7] dark:border-gray-700 rounded-md p-4 bg-white dark:bg-darkModeBG ${className}`}
      >
        <p className="text-center text-gray-500 dark:text-gray-400 text-xs">
          No groups organized yet
        </p>
      </div>
    );
  }

  // Helper function to render a row
  const renderGroupRow = (
    groupName: string,
    videos: typeof uncategorizedVideos,
  ) => {
    const vids = Array.isArray(videos) ? videos : [];
    const firstThumb = vids[0]
      ? finishedDownloads.find((d) => d.id === vids[0].video_id)?.thumbnails
      : null;

    return (
      <div
        key={groupName}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onGroupClick(groupName, videos);
        }}
        className="flex justify-between items-center gap-4 py-2 px-6 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition rounded-md"
      >
        <div className="flex items-center gap-4 p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition rounded-md">
          <input type="checkbox" className="w-4 h-4" />
          {/* Thumbnail */}
          <div className="w-24 h-[55px] rounded-md overflow-hidden cursor-pointer hover:opacity-70 transition-opacity flex-shrink-0 relative">
            {firstThumb && firstThumb !== '—' ? (
              <img
                src={firstThumb}
                alt="Thumbnail"
                className="w-full h-full object-cover"
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
                firstThumb && firstThumb !== '—'
                  ? 'hidden absolute inset-0'
                  : ''
              }`}
            >
              <FiPlayCircle size={20} color="#F45513" />
            </div>
          </div>

          {/* Text Info */}
          <div className="flex flex-col">
            <p
              className={`text-md font-semibold dark:text-gray-200 truncate max-w-[150px] ${
                groupName === 'Uncategorized'
                  ? 'text-primary dark:text-primaryDarkText'
                  : ''
              }`}
            >
              {groupName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-12 px-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 mr-4">
            {vids.length} videos
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className={`mt-2 flex flex-col ${className} gap-1`}>
      {/* Uncategorized row */}
      {uncategorizedVideos.length > 0 &&
        renderGroupRow('Uncategorized', uncategorizedVideos)}

      {/* Categorized groups */}
      {categorizedGroups.map(([groupName, videos]) =>
        renderGroupRow(groupName, videos),
      )}
    </div>
  );
};

export default ListGroupsDisplay;
