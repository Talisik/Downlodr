/**
 * VideoItemRenderer Component
 * Reusable component for rendering individual video items in list or folder view
 * Supports thumbnails, video info, checkboxes, and context menus
 */

import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { formatFileSize } from '@/downlodr/pages/status/statusPageUtils';
import { formatDuration as formatTime } from '@/downlodr/utils/formatDuration';
import { getExtractorIcon } from '@/downlodr/utils/icons/iconMapper';
import {
  clearDraggedVideoIds,
  serializeDraggedVideoPayload,
  setDraggedVideoPayload,
  VIDEO_IDS_DRAG_MIME,
} from '@/smart-organize/utils/dragDrop';
import { DotIcon } from 'lucide-react';
import React, { useState } from 'react';
import { BsThreeDotsVertical, BsYoutube } from 'react-icons/bs';
import { FaRegFolder } from 'react-icons/fa';
import { FiPlayCircle } from 'react-icons/fi';
import TooltipWrapper from '../../core-app/components/wrapper/TooltipWrapper';
import type { VideoItem, VideoWithGroup } from './organizationTypes';

// Type definitions
type FinishedDownload = ReturnType<
  typeof import('@/downlodr/store/downloadStore').useDownloadStore.getState
>['finishedDownloads'][0];

interface VideoItemRendererProps {
  video: VideoItem | VideoWithGroup;
  downloadData: FinishedDownload;
  isFolderView: boolean;
  isShowSidePlayer: boolean;
  checkedVideos: Set<string>;
  finishedDownloads: FinishedDownload[];
  activeTab: string;
  groups: Record<string, VideoItem[]>;
  categoryDropdown: {
    visible: boolean;
    videoId: string | null;
    position: { x: number; y: number };
  };
  isExpandedDetails: boolean;
  onVideoCheck: (video: VideoItem, checked: boolean) => void;
  onRowClick: (e: React.MouseEvent, video: VideoItem) => void;
  onRightClick: (e: React.MouseEvent, video: VideoItem) => void;
  onCategoryDropdownClick: (
    e: React.MouseEvent,
    video: VideoItem | VideoWithGroup,
  ) => void;
  onCloseCategoryDropdown: () => void;
  onViewFile: (filePath: string) => void;
  selectedDownload: FinishedDownload | null;
}

const VideoItemRenderer: React.FC<VideoItemRendererProps> = ({
  video,
  downloadData,
  isFolderView,
  isShowSidePlayer,
  checkedVideos,
  finishedDownloads,
  activeTab,
  groups,
  categoryDropdown,
  isExpandedDetails,
  onVideoCheck,
  onRowClick,
  onRightClick,
  onCategoryDropdownClick,
  onCloseCategoryDropdown,
  onViewFile,
  selectedDownload,
}) => {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  const getDragVideoIds = (currentVideoId: string): string[] => {
    if (checkedVideos.has(currentVideoId)) {
      return Array.from(checkedVideos);
    }

    return Array.from(new Set([...checkedVideos, currentVideoId]));
  };

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    currentVideo: VideoItem,
  ) => {
    const target = e.target as HTMLElement;

    if (target.closest('input') || target.closest('button')) {
      e.preventDefault();
      return;
    }

    const dragVideoIds = getDragVideoIds(currentVideo.video_id);

    if (!checkedVideos.has(currentVideo.video_id)) {
      onVideoCheck(currentVideo, true);
    }

    const sourceCategory = activeTab !== 'All Videos' ? activeTab : undefined;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(
      VIDEO_IDS_DRAG_MIME,
      serializeDraggedVideoPayload({
        videoIds: dragVideoIds,
        sourceCategory,
      }),
    );
    e.dataTransfer.setData('text/plain', dragVideoIds.join(','));
    setDraggedVideoPayload({ videoIds: dragVideoIds, sourceCategory });
  };

  const handleDragEnd = () => {
    clearDraggedVideoIds();
  };

  const toggleSelectionFromRow = (e: React.MouseEvent, video: VideoItem) => {
    const target = e.target as HTMLElement;

    // Ignore clicks from interactive elements
    if (
      target.closest('input[type="checkbox"]') ||
      target.closest('button') ||
      target.closest('img') ||
      target.closest('.category-dropdown-trigger')
    ) {
      return;
    }

    const isChecked = checkedVideos.has(video.video_id);
    onVideoCheck(video, !isChecked);
  };
  if (!downloadData) {
    return null;
  }

  return (
    <div
      key={video.video_id}
      className={`rounded-md cursor-pointer bg-offWhite dark:bg-alternateBlack hover:bg-lightModeBorder dark:hover:bg-darkModeCompliment `}
      onClick={(e) => {
        toggleSelectionFromRow(e, video);
        onRowClick(e, video);
      }}
      onContextMenu={(e) => onRightClick(e, video)}
      draggable
      onDragStart={(e) => handleDragStart(e, video)}
      onDragEnd={handleDragEnd}
    >
      {/* Conditional rendering based on view mode */}
      {!isFolderView ? (
        // List View - Clean table layout
        <div className="py-2 mt-2">
          <div
            className={`grid items-center text-xs px-2 justify-between ${
              isShowSidePlayer ? 'grid-cols-8 gap-3' : 'grid-cols-9 gap-3'
            }`}
          >
            {/* Name */}
            <div
              className={`flex flex-row text-xs items-center gap-3 ${
                isShowSidePlayer ? 'col-span-3' : 'col-span-4'
              }`}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={checkedVideos.has(video.video_id)}
                onChange={(e) => {
                  e.stopPropagation();
                  onVideoCheck(video, e.target.checked);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 flex-shrink-0 rounded border thumbnail-checkbox dark:bg-white dark:checked:bg-white dark:accent-black"
              />
              {/* Thumbnail */}
              <div className="flex items-center rounded-md overflow-hidden flex-shrink-0 w-24 h-[55px]">
                {downloadData?.thumbnails &&
                downloadData.thumbnails !== '—' &&
                !thumbnailFailed ? (
                  <TooltipWrapper content="View full thumbnail" side="bottom">
                    <img
                      src={downloadData.thumbnails}
                      alt="Thumbnail"
                      className="w-full h-full object-cover cursor-pointer hover:opacity-70 transition-opacity"
                      onError={() => setThumbnailFailed(true)}
                      onClick={(e) => {
                        e.stopPropagation();
                        const download = finishedDownloads.find(
                          (d) => d.id === video.video_id,
                        );
                        if (download?.thumnailsLocation) {
                          onViewFile(download.thumnailsLocation);
                        } else {
                          toast({
                            title: 'Thumbnail Not Found',
                            description:
                              'Thumbnail file location not available',
                            variant: 'destructive',
                            duration: 5000,
                          });
                        }
                      }}
                    />
                  </TooltipWrapper>
                ) : (
                  <div className="w-full h-full rounded-md flex items-center justify-center bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.5)_0%,transparent_45%),radial-gradient(circle_at_45%_80%,rgba(255,255,255,0.4)_0%,transparent_35%),linear-gradient(135deg,#ffa42e,#fec77d,#ffa42e,#fec170)]">
                    <FiPlayCircle size={20} color="#F45513" />
                  </div>
                )}
              </div>
              {/* Title + Channel */}
              <div className="flex flex-col text-xs leading-snug gap-1">
                <span className="text-gray-900 dark:text-gray-100 font-semibold line-clamp-1">
                  {downloadData?.displayName || video.video_title}
                </span>
                <span className="text-xxs text-[#666666] dark:text-gray-100 font-medium line-clamp-1">
                  {downloadData?.channelName ||
                    downloadData?.extractorKey ||
                    video.channelName ||
                    'Channel'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end">
              <span className="text-xxs font-bold">
                {formatFileSize(downloadData?.size || 0)}
              </span>
            </div>
            <div className="flex items-center justify-end">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {downloadData?.ext || ''}
              </span>
            </div>
            <div className="flex items-center justify-end">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatTime(downloadData?.duration || 0)}
              </span>
            </div>
            <div className="flex items-center justify-end">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {getExtractorIcon(downloadData?.extractorKey || '')}
              </span>
            </div>
            <div className="flex items-center justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = (
                    e.currentTarget as HTMLElement
                  ).getBoundingClientRect();
                  // This would need to be handled by parent component
                  onRightClick(e, video);
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <BsThreeDotsVertical
                  size={14}
                  className="text-gray-500 dark:text-gray-400"
                />
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Folder View - Grid layout for thumbnails
        <div className="w-full p-2 rounded-lg">
          <div className="flex flex-col">
            {/* Thumbnail */}
            <div className="w-full aspect-video bg-gray-200 dark:bg-gray-600 rounded-lg overflow-hidden relative group">
              {downloadData?.thumbnails &&
              downloadData.thumbnails !== '—' &&
              !thumbnailFailed ? (
                <img
                  src={downloadData?.thumbnails}
                  alt="Thumbnail"
                  className="w-full h-full object-cover cursor-pointer hover:opacity-70 transition-opacity"
                  onError={() => setThumbnailFailed(true)}
                  onClick={(e) => {
                    e.stopPropagation();
                    const download = finishedDownloads.find(
                      (d) => d.id === video.video_id,
                    );
                    if (download?.thumnailsLocation) {
                      onViewFile(download.thumnailsLocation);
                    } else {
                      toast({
                        title: 'Thumbnail Not Found',
                        description: 'Thumbnail file location not available',
                        variant: 'destructive',
                        duration: 5000,
                      });
                    }
                  }}
                />
              ) : (
                <div
                  className="absolute inset-0
                  flex items-center justify-center
                  bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.5)_0%,transparent_45%),radial-gradient(circle_at_45%_80%,rgba(255,255,255,0.4)_0%,transparent_35%),linear-gradient(135deg,#ffa42e,#fec77d,#ffa42e,#fec170)]"
                >
                  <FiPlayCircle size={32} color="#F45513" />
                </div>
              )}
              {/* Hover overlay with checkbox and menu icon */}
              <div
                className={`absolute inset-0 transition-all duration-200 ${
                  checkedVideos.has(video.video_id)
                    ? 'bg-black bg-opacity-0'
                    : 'bg-black opacity-0 group-hover:opacity-100 group-hover:bg-opacity-30'
                }`}
              >
                {/* Checkbox */}
                <div
                  className={`
      absolute top-4 left-3 transition-opacity
      ${
        checkedVideos.has(video.video_id)
          ? 'opacity-100'
          : 'opacity-0 group-hover:opacity-100'
      }
    `}
                >
                  <input
                    type="checkbox"
                    checked={checkedVideos.has(video.video_id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      onVideoCheck(video, e.target.checked);
                      console.log(video.video_id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 flex-shrink-0 rounded border thumbnail-checkbox"
                  />
                </div>

                {/* Folder dropdown (unchanged) */}
                <div
                  className="
      absolute top-3 right-3
      opacity-0 group-hover:opacity-100
      transition-opacity
      bg-white p-1.5 rounded-md cursor-pointer
      hover:bg-gray-50 category-dropdown-trigger
    "
                  onClick={(e) =>
                    onCategoryDropdownClick(e, {
                      ...video,
                      groupName:
                        (video as VideoWithGroup).groupName || activeTab,
                    })
                  }
                >
                  <div className="absolute -top-2 -right-1 bg-primary w-4 h-4 flex items-center justify-center rounded-full">
                    <span className="text-[10px] text-white leading-none">
                      {
                        Object.values(groups).filter((categoryVideos) =>
                          categoryVideos.some(
                            (catVideo) => catVideo.video_id === video.video_id,
                          ),
                        ).length
                      }
                    </span>
                  </div>

                  <FaRegFolder
                    size={13}
                    className="text-black hover:text-gray-600 transition-colors"
                  />
                </div>
              </div>
            </div>
            {/* Video Info */}
            <div className="w-full min-w-0 text-left space-y-[2px] dark:bg-darkModeNavigation py-1 px-2">
              <div>
                <p className="px-0.2 truncate text-[12.5px] font-semibold text-gray-900 dark:text-gray-100">
                  {downloadData?.displayName || video.video_title}
                </p>
                <p className="text-[10.5px] text-gray-600 dark:text-gray-400 line-clamp-1">
                  {downloadData?.channelName || ''}
                </p>
              </div>

              {isExpandedDetails && (
                <div>
                  <div className="mb-1 font-bold inline-block bg-lightModeBorder dark:bg-darkModeBorderColor dark:text-darkModeButtonActive rounded-md p-1 text-[9.5px] text-gray-600 dark:text-gray-400 line-clamp-1">
                    {activeTab}
                  </div>
                  <div className="flex items-center ml-1 -mt-2 w-full min-w-0 whitespace-nowrap">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 mr-1.5">
                      <BsYoutube size={14} color="red" />
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {formatFileSize(downloadData?.size || 0)}
                    </span>
                    <span>
                      <DotIcon size={12} color="gray" />
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {downloadData?.ext || ''}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Category Dropdown */}
            {categoryDropdown.visible && categoryDropdown.videoId && (
              <>
                {/* Backdrop to close dropdown when clicking outside */}
                <div
                  className="fixed inset-0 z-[8998]"
                  onClick={onCloseCategoryDropdown}
                />

                {/* Category Dropdown */}
                <div
                  className="fixed bg-white dark:bg-darkModeDropdown border border-titleBarBorder dark:border-gray-800 rounded-lg shadow-lg z-[8999] py-2 px-2 min-w-[200px] max-h-[200px] overflow-y-auto"
                  style={{
                    left: categoryDropdown.position.x - 150,
                    top: categoryDropdown.position.y + 30, // Position below the button
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-xs mb-2">
                    <div className="font-semibold text-gray-700 dark:text-gray-300 mb-0.5">
                      Found in{' '}
                      {
                        Object.values(groups).filter((categoryVideos) =>
                          categoryVideos.some(
                            (catVideo) =>
                              String(catVideo.video_id) ===
                              String(categoryDropdown.videoId),
                          ),
                        ).length
                      }{' '}
                      {Object.values(groups).filter((categoryVideos) =>
                        categoryVideos.some(
                          (catVideo) =>
                            catVideo.video_id === categoryDropdown.videoId,
                        ),
                      ).length > 1
                        ? 'categories'
                        : 'category'}
                    </div>

                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      {(() => {
                        const foundVideo = Object.values(groups)
                          .flat()
                          .find(
                            (v) =>
                              String(v.video_id) ===
                              String(categoryDropdown.videoId),
                          );

                        return foundVideo?.video_title ? (
                          <span>"{foundVideo.video_title}"</span>
                        ) : (
                          <span>name not found</span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="space-y-1">
                    {Object.entries(groups).map(
                      ([categoryName, categoryVideos]) => {
                        const hasVideo = categoryVideos.some(
                          (catVideo) =>
                            catVideo.video_id === categoryDropdown.videoId,
                        );

                        if (!hasVideo) return null;

                        return (
                          <button
                            key={categoryName}
                            className="bg-courseTab dark:bg-darkModeCompliment dark:text-gray-100 w-full text-left flex items-center gap-2 text-xxs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1 transition-colors"
                          >
                            <span className="truncate">{categoryName}</span>
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoItemRenderer;
