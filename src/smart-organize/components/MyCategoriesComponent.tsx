import { useDownloadStore } from '@/downlodr/store/downloadStore';
import {
  getDraggedVideoIdsFromMemory,
  getDraggedVideoPayloadFromMemory,
  parseDraggedVideoPayload,
  VIDEO_IDS_DRAG_MIME,
} from '../utils/dragDrop';
import React from 'react';
import { GoChevronDown, GoChevronUp } from 'react-icons/go';
import { PiFolderSimplePlus } from 'react-icons/pi';
import type { VideoItem } from './organizationTypes';

type FinishedDownload = ReturnType<
  typeof import('@/downlodr/store/downloadStore').default.getState
>['finishedDownloads'][0];

interface MyCategoriesComponentProps {
  isShowSidePlayer: boolean;
  setShowSidePlayer: (show: boolean) => void;
  activeTab: string;
  onTabChange: (tabName: string) => void;
  onCategoryDotsClick?: (e: React.MouseEvent, categoryName: string) => void;
  inlineRenamingCategory?: string | null;
  inlineRenameValue?: string;
  onInlineRenameChange?: (value: string) => void;
  onInlineRenameConfirm?: () => void;
  onInlineRenameCancel?: () => void;
  onCategoryDoubleClick?: (categoryName: string) => void;
  onCategoryKeyDown?: (e: React.KeyboardEvent, categoryName: string) => void;
  onGroupClick: (groupName: string, videos: VideoItem[]) => void;
  isSearchMode: boolean;
  handleSearchExit: () => void;
  myCategoriesCollapsed: boolean;
  setMyCategoriesCollapsed: (collapsed: boolean) => void;
  newVideosInMyCategories?: Record<string, number>;
  myCategoryGroups?: Record<string, VideoItem[]>;
  onDropVideosToCategory?: (
    videoIds: string[],
    targetCategory: string,
    sourceCategory?: string,
  ) => void;
}

const MyCategoriesComponent: React.FC<MyCategoriesComponentProps> = ({
  activeTab,
  onTabChange,
  isShowSidePlayer,
  setShowSidePlayer,
  onCategoryDotsClick,
  inlineRenamingCategory,
  inlineRenameValue = '',
  onInlineRenameChange,
  onInlineRenameConfirm,
  onInlineRenameCancel,
  onCategoryDoubleClick,
  onCategoryKeyDown,
  onGroupClick,
  isSearchMode,
  handleSearchExit,
  myCategoriesCollapsed,
  setMyCategoriesCollapsed,
  newVideosInMyCategories = {},
  myCategoryGroups,
  onDropVideosToCategory,
}) => {
  // Get data from download store (like DownloadList does)
  const availableCategories = useDownloadStore(
    (state) => state.availableCategories,
  );
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );

  // Get available categories from the store (same source as Navigation component)
  const myCategories = availableCategories;

  const getCategoryVideos = React.useMemo(() => {
    const categoryVideos: Record<string, VideoItem[]> = {};

    myCategories.forEach((category) => {
      categoryVideos[category] = [];
    });

    if (myCategoryGroups) {
      myCategories.forEach((categoryName) => {
        const videos = myCategoryGroups[categoryName] || [];
        categoryVideos[categoryName] = videos.filter(
          (video, index, self) =>
            index === self.findIndex((v) => v.video_id === video.video_id),
        );
      });
      return categoryVideos;
    }

    finishedDownloads.forEach((download: FinishedDownload) => {
      if (download.category && download.category.length > 0) {
        download.category.forEach((categoryName) => {
          if (myCategories.includes(categoryName)) {
            const videoItem: VideoItem = {
              video_id: download.id,
              video_title: download.downloadName || download.name,
              thumbnails: download.thumbnails || '',
              channelName: download.channelName || '',
              tags: download.tags || [],
            };
            categoryVideos[categoryName].push(videoItem);
          }
        });
      }
    });

    return categoryVideos;
  }, [myCategories, finishedDownloads, myCategoryGroups]);

  const handleInlineRenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInlineRenameChange?.(e.target.value);
  };

  const handleInlineRenameKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'Enter') onInlineRenameConfirm?.();
    else if (e.key === 'Escape') onInlineRenameCancel?.();
  };

  const [dragOverCategory, setDragOverCategory] = React.useState<string | null>(
    null,
  );

  const getDraggedVideoIds = (event: React.DragEvent<HTMLDivElement>) => {
    const payload =
      event.dataTransfer.getData(VIDEO_IDS_DRAG_MIME) ||
      event.dataTransfer.getData('text/plain');
    const parsedPayload = parseDraggedVideoPayload(payload);
    if (parsedPayload.videoIds.length > 0) {
      return parsedPayload.videoIds;
    }
    return [];
  };

  const getDragIdsForHover = (event: React.DragEvent<HTMLDivElement>) => {
    const storedIds = getDraggedVideoIdsFromMemory();
    if (storedIds.length > 0) return storedIds;
    const hasType = event.dataTransfer.types?.includes(VIDEO_IDS_DRAG_MIME);
    return hasType ? ['__pending__'] : [];
  };

  const canDropOnCategory = (
    categoryName: string,
    draggedVideoIds: string[],
  ) => {
    if (draggedVideoIds.length === 0) return false;
    const existingVideos = getCategoryVideos[categoryName] || [];
    return draggedVideoIds.some(
      (id) => !existingVideos.some((video) => video.video_id === id),
    );
  };

  const handleDragEnter = (
    event: React.DragEvent<HTMLDivElement>,
    categoryName: string,
  ) => {
    const draggedVideoIds = getDragIdsForHover(event);
    if (draggedVideoIds.length === 0) {
      return;
    }
    if (
      draggedVideoIds[0] !== '__pending__' &&
      !canDropOnCategory(categoryName, draggedVideoIds)
    ) {
      return;
    }
    setDragOverCategory(categoryName);
  };

  const handleDragLeave = (
    event: React.DragEvent<HTMLDivElement>,
    categoryName: string,
  ) => {
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) {
      return;
    }
    if (dragOverCategory === categoryName) {
      setDragOverCategory(null);
    }
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    categoryName: string,
  ) => {
    const draggedVideoIds = getDragIdsForHover(event);
    if (draggedVideoIds.length === 0) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    if (
      draggedVideoIds[0] !== '__pending__' &&
      !canDropOnCategory(categoryName, draggedVideoIds)
    ) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
    categoryName: string,
  ) => {
    event.preventDefault();
    setDragOverCategory(null);

    const parsedIds = getDraggedVideoIds(event);
    const draggedVideoIds =
      parsedIds.length > 0 ? parsedIds : getDraggedVideoIdsFromMemory();
    const parsedPayload = parseDraggedVideoPayload(
      event.dataTransfer.getData(VIDEO_IDS_DRAG_MIME),
    );
    const payloadSourceCategory =
      parsedPayload.sourceCategory ??
      getDraggedVideoPayloadFromMemory().sourceCategory;
    if (!canDropOnCategory(categoryName, draggedVideoIds)) {
      return;
    }
    onDropVideosToCategory?.(
      draggedVideoIds,
      categoryName,
      payloadSourceCategory ?? undefined,
    );
    // Switch to the dropped category as the active tab
    onTabChange(categoryName);
    const categoryVideos = getCategoryVideos[categoryName] || [];
    onGroupClick?.(categoryName, categoryVideos);
  };

  // Debug: temporarily always render to check if component is showing
  // if (myCategories.length === 0) {
  //   return null;
  // }

  // Sort categories: prioritize categories with newVideosCount, then by video count (most to least)
  const sortedCategories = React.useMemo(() => {
    return [...myCategories].sort((a, b) => {
      const aNewVideosCount = newVideosInMyCategories[a] || 0;
      const bNewVideosCount = newVideosInMyCategories[b] || 0;
      const aVideoCount = getCategoryVideos[a]?.length || 0;
      const bVideoCount = getCategoryVideos[b]?.length || 0;

      // First priority: categories with new videos come first
      if (aNewVideosCount > 0 && bNewVideosCount === 0) return -1;
      if (bNewVideosCount > 0 && aNewVideosCount === 0) return 1;

      // Second priority: sort by video count (most to least)
      if (aVideoCount !== bVideoCount) {
        return bVideoCount - aVideoCount;
      }

      // If video counts are equal, maintain alphabetical order for consistency
      return a.localeCompare(b);
    });
  }, [myCategories, newVideosInMyCategories, getCategoryVideos]);

  return (
    <div className="flex flex-col gap-[6px]">
      <div className="w-full flex items-center h-7 hover:bg-[#F2F2F2] dark:hover:bg-darkModeCompliment rounded dark:text-gray-200">
        <button
          className="flex items-center flex-1 min-w-0 h-full"
          onClick={() => setMyCategoriesCollapsed(!myCategoriesCollapsed)}
        >
          <span className="flex items-center justify-center w-7 flex-shrink-0">
            <PiFolderSimplePlus size={16} />
          </span>
          <span className="text-[12.5px] whitespace-nowrap overflow-hidden min-w-0 truncate">
            My Categories
          </span>
        </button>
        <button
          className="flex items-center justify-center flex-shrink-0 w-7 h-7"
          onClick={() => setMyCategoriesCollapsed(!myCategoriesCollapsed)}
        >
          {myCategoriesCollapsed ? (
            <GoChevronUp size={14} />
          ) : (
            <GoChevronDown size={14} />
          )}
        </button>
      </div>
      {!myCategoriesCollapsed && (
        <>
          {sortedCategories.map((categoryName) => {
            const categoryVideos = (
              getCategoryVideos[categoryName] || []
            ).filter(
              (video, index, self) =>
                index === self.findIndex((v) => v.video_id === video.video_id),
            );
            const newVideosCount = newVideosInMyCategories[categoryName] || 0;

            return (
              <div
                key={`my-category-${categoryName}`}
                className={`flex flex-nowrap items-center h-7 rounded ${
                  activeTab === categoryName
                    ? 'bg-[#F2F2F2] dark:bg-darkModeCompliment'
                    : 'hover:bg-[#F2F2F2] dark:hover:bg-darkModeCompliment'
                } dark:text-gray-200 ${
                  dragOverCategory === categoryName
                    ? 'bg-primary/10 dark:bg-primary/20 ring-1 ring-primary/60'
                    : ''
                }`}
                onDragEnter={(event) => handleDragEnter(event, categoryName)}
                onDragLeave={(event) => handleDragLeave(event, categoryName)}
                onDragOver={(event) => handleDragOver(event, categoryName)}
                onDrop={(event) => handleDrop(event, categoryName)}
              >
                {inlineRenamingCategory === categoryName ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center flex-1 min-w-0">
                      <span className="flex items-center justify-center w-7 flex-shrink-0">
                        <div className="w-4 h-4 rounded bg-blue-500 flex-shrink-0" />
                      </span>
                      <input
                        type="text"
                        value={inlineRenameValue}
                        onChange={handleInlineRenameChange}
                        onBlur={onInlineRenameConfirm}
                        onKeyDown={handleInlineRenameKeyDown}
                        className="flex-1 bg-transparent border-b border-current text-[12.5px] outline-none min-w-0"
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        maxLength={50}
                      />
                    </div>
                    <span className="text-[12.5px] text-gray-500 dark:text-gray-400 flex-shrink-0 mr-3">
                      ({categoryVideos.length})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full h-full">
                    <button
                      onClick={() => {
                        setShowSidePlayer?.(false);
                        onTabChange?.(categoryName);
                        onGroupClick?.(categoryName, categoryVideos);
                        if (isSearchMode) handleSearchExit?.();
                      }}
                      onKeyDown={(e) => onCategoryKeyDown?.(e, categoryName)}
                      className="flex items-center flex-1 min-w-0 h-full text-left"
                      tabIndex={0}
                    >
                      <span className="flex items-center justify-center w-7 flex-shrink-0" />
                      <span className="text-[12.5px] font-[500] truncate">
                        {categoryName.length > 17
                          ? categoryName.slice(0, 17) + '...'
                          : categoryName}
                      </span>
                    </button>

                    <div className="flex items-center gap-1 flex-shrink-0 mr-3">
                      {categoryVideos.length !== newVideosCount && (
                        <span className="text-xxxs text-gray-500 dark:text-gray-400">
                          {categoryVideos.length}
                        </span>
                      )}
                      {newVideosCount > 0 && (
                        <span className="-mr-2 py-0.5 px-2 bg-primary text-white text-[10px] font-semibold rounded-full min-w-[16px] h-[16px] flex items-center justify-center">
                          {newVideosCount}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default MyCategoriesComponent;
