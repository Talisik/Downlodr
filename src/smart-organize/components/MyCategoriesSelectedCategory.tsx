/**
 * MyCategoriesSelectedCategory Component
 * Displays videos in a selected category from My Categories
 * Works like SelectedCategory but uses download store data instead of organization data
 */

import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { ChevronDown } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiPlayCircle } from 'react-icons/fi';
import { IoMdClose } from 'react-icons/io';
// import VideoPlayer from '../VideoPlayer';
import { LuFolderX } from 'react-icons/lu';
// import RemoveVideoModal from '../OrganizationModal/RemoveVideo';
import SelectedCategoryTools, {
  FilterOptions,
  FilterState,
  SortBy,
  SortDirection,
  VideoItem,
  VideoWithGroup,
} from './SelectedCategoryTools';
import SummaryContent from './SummaryContent';
import TabInterface from './TabInterface';
import TranscriptContent from './TranscriptContent';
import { mergeVideosById } from './myCategoriesUtils';

// Type definitions (now imported from SelectedCategoryTools)

interface MyCategoriesSelectedCategoryProps {
  activeTab: string;
  checkedVideos: Set<string>;
  isFolderView: boolean;
  isShowSidePlayer: boolean;
  setShowSidePlayer?: (show: boolean) => void;
  onVideoCheck: (video: VideoItem, checked: boolean) => void;
  onRowClick?: (e: React.MouseEvent, video: VideoItem) => void;
  onRightClick?: (
    e: React.MouseEvent,
    video: VideoItem,
    category: string,
  ) => void;
  onViewFile?: (filePath: string) => void;
  onViewDownload?: (location: string) => void;
  onSelectAll?: (videoIds: string[]) => void;
  onDeselectAll?: () => void;
  onSort?: () => void;
  onMoveVideoToCategory?: (
    video: VideoItem,
    fromCategory: string,
    toCategory: string,
  ) => void;
  onMoveVideosToCategory?: (videoIds: string[], targetCategory: string) => void;
  onRemoveVideosFromCategory?: (
    videoIds: string[],
    fromCategory: string,
  ) => void;
  onAddVideosToNewCategory?: (
    videoIds: string[],
    newCategoryName: string,
  ) => void;
  pendingCategoryVideos?: Record<string, VideoItem[]>;
  pendingCategoryRemovals?: Record<string, string[]>;
  availableCategories?: string[];
}

// Sort options and filter types are imported from SelectedCategoryTools

const MyCategoriesSelectedCategory: React.FC<
  MyCategoriesSelectedCategoryProps
> = ({
  activeTab,
  checkedVideos,
  isFolderView,
  isShowSidePlayer,
  setShowSidePlayer,
  onVideoCheck,
  onRowClick,
  onRightClick,
  onViewFile,
  onViewDownload,
  onSelectAll,
  onDeselectAll,
  onSort,
  onMoveVideoToCategory,
  onMoveVideosToCategory,
  onRemoveVideosFromCategory,
  onAddVideosToNewCategory,
  pendingCategoryVideos,
  pendingCategoryRemovals,
}) => {
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [selectedDownloadId, setSelectedDownloadId] = useState<string | null>(
    null,
  );

  const selectedDownload = useDownloadStore(
    (state) =>
      state.finishedDownloads.find(
        (download) => download.id === selectedDownloadId,
      ) || null,
  );

  // Sort state
  const [sortBy, setSortBy] = useState<SortBy>('A-Z');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Filter state
  const [selectedFilters, setSelectedFilters] = useState<FilterState>({
    ext: new Set(),
    source: new Set(),
    category: new Set(),
  });

  // Get data from download store
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );
  const availableCategories = useDownloadStore(
    (state) => state.availableCategories,
  );

  // Get videos for the active category
  const categoryVideos = useMemo(() => {
    const videos: VideoItem[] = [];
    const removedIds = new Set(pendingCategoryRemovals?.[activeTab] ?? []);

    finishedDownloads.forEach((download) => {
      if (download.category && download.category.includes(activeTab)) {
        if (removedIds.has(download.id)) {
          return;
        }
        videos.push({
          video_id: download.id,
          video_title: download.downloadName || download.name,
          thumbnails: download.thumbnails || '',
          channelName: download.channelName || '',
          tags: download.tags || [],
        });
      }
    });

    return videos;
  }, [finishedDownloads, activeTab, pendingCategoryRemovals]);

  const pendingCategoryVideosForTab = useMemo(
    () => pendingCategoryVideos?.[activeTab] ?? [],
    [pendingCategoryVideos, activeTab],
  );

  const mergedCategoryVideos = useMemo(
    () => mergeVideosById(categoryVideos, pendingCategoryVideosForTab),
    [categoryVideos, pendingCategoryVideosForTab],
  );

  // Create groups mapping for category context menu
  const groups = useMemo(() => {
    const groupsMap: Record<string, VideoItem[]> = {};

    finishedDownloads.forEach((download) => {
      if (download.category && Array.isArray(download.category)) {
        download.category.forEach((categoryName) => {
          if (!groupsMap[categoryName]) {
            groupsMap[categoryName] = [];
          }
          groupsMap[categoryName].push({
            video_id: download.id,
            video_title: download.downloadName || download.name,
            thumbnails: download.thumbnails || '',
            channelName: download.channelName || '',
            tags: download.tags || [],
          });
        });
      }
    });

    return groupsMap;
  }, [finishedDownloads]);

  const [isExpandedDetails, setIsExpandedDetails] = useState(false);

  // Get unique filter options from current videos
  const filterOptions: FilterOptions = useMemo(() => {
    const extSet = new Set<string>();
    const sourceSet = new Set<string>();

    mergedCategoryVideos.forEach((video) => {
      const downloadData = finishedDownloads.find(
        (download) => download.id === video.video_id,
      );

      if (downloadData) {
        if (downloadData.ext) extSet.add(downloadData.ext);
        if (downloadData.extractorKey) sourceSet.add(downloadData.extractorKey);
      }
    });

    return {
      ext: Array.from(extSet).sort(),
      source: Array.from(sourceSet).sort(),
      category: [activeTab], // Only current category for filtering
    };
  }, [mergedCategoryVideos, finishedDownloads, activeTab]);

  const sortedVideos = useMemo(() => {
    const filteredVideos = [...mergedCategoryVideos];

    // Apply filters
    if (
      selectedFilters.ext.size > 0 ||
      selectedFilters.source.size > 0 ||
      selectedFilters.category.size > 0
    ) {
      // Apply sorting
      return filteredVideos.sort((a, b) => {
        const downloadA = finishedDownloads.find(
          (download) => download.id === a.video_id,
        );
        const downloadB = finishedDownloads.find(
          (download) => download.id === b.video_id,
        );

        switch (sortBy) {
          case 'A-Z': {
            const titleA = downloadA?.name || a.video_title || '';
            const titleB = downloadB?.name || b.video_title || '';
            return titleA.localeCompare(titleB);
          }

          case 'Z-A': {
            const titleA = downloadA?.name || a.video_title || '';
            const titleB = downloadB?.name || b.video_title || '';
            return titleB.localeCompare(titleA);
          }

          case 'Oldest': {
            const dateA = downloadA?.DateAdded
              ? new Date(downloadA.DateAdded).getTime()
              : 0;
            const dateB = downloadB?.DateAdded
              ? new Date(downloadB.DateAdded).getTime()
              : 0;
            return dateA - dateB;
          }

          case 'Newest': {
            const dateA = downloadA?.DateAdded
              ? new Date(downloadA.DateAdded).getTime()
              : 0;
            const dateB = downloadB?.DateAdded
              ? new Date(downloadB.DateAdded).getTime()
              : 0;
            return dateB - dateA;
          }

          case 'Smallest': {
            const sizeA = downloadA?.size ?? 0;
            const sizeB = downloadB?.size ?? 0;
            return sizeA - sizeB;
          }

          case 'Largest': {
            const sizeA = downloadA?.size ?? 0;
            const sizeB = downloadB?.size ?? 0;
            return sizeB - sizeA;
          }

          default:
            return 0;
        }
      });
    }

    // Apply sorting
    return filteredVideos.sort((a, b) => {
      const downloadA = finishedDownloads.find(
        (download) => download.id === a.video_id,
      );
      const downloadB = finishedDownloads.find(
        (download) => download.id === b.video_id,
      );

      let comparison = 0;

      switch (sortBy) {
        case 'A-Z': {
          const titleA = downloadA?.name || a.video_title || '';
          const titleB = downloadB?.name || b.video_title || '';
          comparison = titleA.localeCompare(titleB);
          break;
        }

        case 'Z-A': {
          const titleA = downloadA?.name || a.video_title || '';
          const titleB = downloadB?.name || b.video_title || '';
          comparison = titleB.localeCompare(titleA);
          break;
        }

        case 'Oldest': {
          const dateA = downloadA?.DateAdded
            ? typeof downloadA.DateAdded === 'number'
              ? downloadA.DateAdded
              : new Date(downloadA.DateAdded).getTime()
            : 0;

          const dateB = downloadB?.DateAdded
            ? typeof downloadB.DateAdded === 'number'
              ? downloadB.DateAdded
              : new Date(downloadB.DateAdded).getTime()
            : 0;

          comparison = dateA - dateB;
          break;
        }

        case 'Newest': {
          const dateA = downloadA?.DateAdded
            ? typeof downloadA.DateAdded === 'number'
              ? downloadA.DateAdded
              : new Date(downloadA.DateAdded).getTime()
            : 0;

          const dateB = downloadB?.DateAdded
            ? typeof downloadB.DateAdded === 'number'
              ? downloadB.DateAdded
              : new Date(downloadB.DateAdded).getTime()
            : 0;

          comparison = dateB - dateA;
          break;
        }

        case 'Smallest': {
          const sizeA = downloadA?.size ?? 0;
          const sizeB = downloadB?.size ?? 0;
          comparison = sizeA - sizeB;
          break;
        }

        case 'Largest': {
          const sizeA = downloadA?.size ?? 0;
          const sizeB = downloadB?.size ?? 0;
          comparison = sizeB - sizeA;
          break;
        }

        default:
          comparison = 0;
      }

      return comparison;
    });
  }, [
    mergedCategoryVideos,
    finishedDownloads,
    sortBy,
    selectedFilters,
    activeTab,
  ]);
  /*
  // Load video when selected download changes
  useEffect(() => {
    if (selectedDownload?.videoUrl) {
      setIsVideoLoading(true);
      setVideoSrc(selectedDownload.videoUrl);
      // Simulate loading
      const timer = setTimeout(() => {
        setIsVideoLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setVideoSrc(null);
      setIsVideoLoading(false);
    }
  }, [selectedDownload]);
  */
  // Category dropdown state
  const [categoryDropdown, setCategoryDropdown] = useState<{
    visible: boolean;
    videoId: string | null;
    position: { x: number; y: number };
  }>({
    visible: false,
    videoId: null,
    position: { x: 0, y: 0 },
  });

  // Event handlers
  const handleVideoCheck = useCallback(
    (video: VideoItem, checked: boolean) => {
      onVideoCheck?.(video, checked);
    },
    [onVideoCheck],
  );

  const closeCategoryDropdown = useCallback(() => {
    setCategoryDropdown({
      visible: false,
      videoId: null,
      position: { x: 0, y: 0 },
    });
  }, []);

  const handleCategoryDropdownClick = useCallback(
    (e: React.MouseEvent, video: VideoItem) => {
      e.preventDefault();
      e.stopPropagation();

      if (
        categoryDropdown.visible &&
        categoryDropdown.videoId === video.video_id
      ) {
        // Close if already open for this video
        closeCategoryDropdown();
        return;
      }

      // Open dropdown
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setCategoryDropdown({
        visible: true,
        videoId: video.video_id,
        position: { x: rect.left, y: rect.top },
      });
    },
    [categoryDropdown.visible, categoryDropdown.videoId, closeCategoryDropdown],
  );

  const handleRowClick = useCallback(
    (e: React.MouseEvent, video: VideoItem) => {
      setSelectedDownloadId(video.video_id);
      console.log('selectedDownloadId', video.video_id);
      setShowSidePlayer(true);
      onRowClick?.(e, video);
    },
    [onRowClick],
  );

  const handleRightClick = useCallback(
    (e: React.MouseEvent, video: VideoItem) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setContextMenu({
        visible: true,
        position: { x: rect.left, y: rect.bottom },
        video: video,
      });
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      visible: false,
      position: { x: 0, y: 0 },
      video: null,
    });
  }, []);

  const handleViewFile = useCallback(
    (filePath: string) => {
      onViewFile?.(filePath);
    },
    [onViewFile],
  );

  const handleSelectAll = useCallback(() => {
    if (onSelectAll && sortedVideos.length > 0) {
      const videoIds = sortedVideos.map((video) => video.video_id);
      onSelectAll(videoIds);
    }
  }, [onSelectAll, sortedVideos]);

  const handleDeselectAll = useCallback(() => {
    if (onDeselectAll) {
      onDeselectAll();
    }
  }, [onDeselectAll]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    video: VideoItem | null;
  }>({
    visible: false,
    position: { x: 0, y: 0 },
    video: null,
  });

  // Delete confirmation modal state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<VideoItem | null>(null);

  // Drag and drop handlers
  const [isDragOver, setIsDragOver] = useState(false);

  const confirmDeleteVideo = useCallback(() => {
    if (videoToDelete) {
      // Move video to Uncategorized
      if (onMoveVideoToCategory) {
        onMoveVideoToCategory(videoToDelete, activeTab, 'Uncategorized');
      }
      toast({
        title: 'Video Removed',
        description: `Removed "${videoToDelete.video_title}" from ${activeTab} and moved to Uncategorized`,
        duration: 5000,
      });
      setVideoToDelete(null);
    }
    setShowDeleteConfirmation(false);
  }, [videoToDelete, activeTab, onMoveVideoToCategory]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        const { video, fromCategory } = data;

        if (video && onMoveVideoToCategory) {
          // Move to active category or "Uncategorized" if no active category
          const targetCategory = activeTab || 'Uncategorized';
          onMoveVideoToCategory(video, fromCategory, targetCategory);

          toast({
            title: 'Video Moved',
            description: `Moved "${video.video_title}" to ${targetCategory}`,
            duration: 5000,
          });
        }
      } catch (error) {
        console.error('Error handling drop:', error);
        toast({
          title: 'Drop Error',
          description: 'Failed to move video',
          variant: 'destructive',
          duration: 5000,
        });
      }
    },
    [activeTab, onMoveVideoToCategory],
  );

  // Don't render if no active tab or no videos in the active tab
  if (!activeTab || mergedCategoryVideos.length === 0) {
    return (
      <div className="flex flex-1 justify-center mt-28 h-full">
        <div className="text-center ">
          <div className="text-4xl mb-2 flex items-center justify-center">
            <LuFolderX size={60} className="" />
          </div>
          <p className="text-[16px] font-bold mb-1">
            Looks like you have no videos in this category
          </p>
          <p className="text-[14px]">
            Drag and drop from other categories or directly move videos here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-1 overflow-hidden h-full bg-offWhite dark:bg-alternateBlack ${
        isShowSidePlayer ? 'flex-row' : 'flex-row'
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={`px-2 flex-1 flex flex-col overflow-hidden transition-colors duration-200 ${
          isDragOver
            ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-300 dark:border-blue-600'
            : ''
        }`}
      >
        {/* Tab Content */}
        <SelectedCategoryTools
          videos={sortedVideos}
          finishedDownloads={finishedDownloads}
          isFolderView={isFolderView}
          isShowSidePlayer={isShowSidePlayer}
          checkedVideos={checkedVideos}
          activeTab={activeTab}
          groups={groups}
          filterOptions={filterOptions}
          onVideoCheck={handleVideoCheck}
          onRowClick={handleRowClick}
          onRightClick={(e, video) => {
            const rect = (
              e.currentTarget as HTMLElement
            ).getBoundingClientRect();
            setContextMenu({
              visible: true,
              position: { x: rect.left, y: rect.bottom },
              video: video,
            });
          }}
          onViewFile={handleViewFile}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onSort={onSort}
          onCategoryDropdownClick={(e, video) =>
            handleCategoryDropdownClick(e, video)
          }
          onCloseCategoryDropdown={closeCategoryDropdown}
          selectedDownload={selectedDownload}
          categoryDropdown={categoryDropdown}
          isExpandedDetails={isExpandedDetails}
          onExpandedDetailsToggle={() =>
            setIsExpandedDetails(!isExpandedDetails)
          }
          externalSortBy={sortBy}
          externalSortDirection={sortDirection}
          externalSelectedFilters={selectedFilters}
          onSortChange={(newSortBy: SortBy) => {
            setSortBy(newSortBy);
          }}
          onFilterChange={(newFilters) => {
            setSelectedFilters(newFilters);
          }}
          gridColsWithSidePlayer={2}
          gridColsWithoutSidePlayer={4}
          debugContext={`MyCategoriesSelectedCategory-${activeTab}`}
          hideCategoryActions={true}
          onMoveVideosToCategory={onMoveVideosToCategory}
          onRemoveVideosFromCategory={onRemoveVideosFromCategory}
          onAddVideosToNewCategory={onAddVideosToNewCategory}
          availableCategories={availableCategories}
        />
      </div>

      {/* Side Player */}
      {isShowSidePlayer && selectedDownload?.videoUrl && (
        <div className="w-[33%] bg-[#F2F2F2] dark:bg-[#333333] p-2 border-l-2 border-titleBarBorder dark:border-darkModeBorderColor h-full">
          <div className="text-gray-600 dark:text-gray-400 h-full">
            {selectedDownload?.videoUrl ? (
              <div className="h-full flex flex-col space-y-2">
                {selectedDownload?.videoUrl && (
                  <div className="flex flex-col h-full">
                    {/* Title */}
                    <div className="mb-2 font-semibold flex items-center justify-between gap-2 pl-1 text-[#333333] dark:text-white flex-shrink-0">
                      <div className="line-clamp-1 flex-1 text-[12px]">
                        {selectedDownload?.name?.replace(/\.[^/.]+$/, '') ||
                          'Unknown Video'}
                      </div>
                      <button onClick={() => setShowSidePlayer?.(false)}>
                        <IoMdClose size={16} className="-pr-8" />
                      </button>
                    </div>

                    {/* Player Wrapper */}
                    <div className="w-[97%] overflow-hidden rounded mx-1 flex-shrink-0 relative bg-black h-[28%] items-center">
                      {isVideoLoading ? (
                        <div className="w-full h-full flex items-center justify-center bg-black dark:bg-black rounded-lg">
                          <div className="flex flex-col items-center space-y-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <span className="text-xs text-white dark:text-white">
                              Loading video...
                            </span>
                          </div>
                        </div>
                      ) : selectedDownload?.videoUrl ? (
                        <div className="w-full h-full flex items-center justify-center">
                          {/* <VideoPlayer selectedDownload={selectedDownload} /> */}
                        </div>
                      ) : (
                        <div
                          className={`w-full h-full flex items-center justify-center rounded-lg ${
                            selectedDownload.thumbnails &&
                            selectedDownload.thumbnails !== '—'
                              ? ''
                              : 'bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.5)_0%,transparent_45%),radial-gradient(circle_at_45%_80%,rgba(255,255,255,0.4)_0%,transparent_35%),linear-gradient(135deg,#ffa42e,#fec77d,#ffa42e,#fec170)]'
                          }`}
                          style={
                            selectedDownload.thumbnails &&
                            selectedDownload.thumbnails !== '—'
                              ? {
                                  backgroundImage: `url(${selectedDownload.thumbnails})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                }
                              : {}
                          }
                        >
                          {!selectedDownload.thumbnails ||
                          selectedDownload.thumbnails === '—' ? (
                            <FiPlayCircle size={28} color="#F45513" />
                          ) : (
                            <span className="text-sm font-medium text-white dark:text-gray-300 bg-black/90 px-3 py-1 rounded">
                              No video available
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Channel and Tags */}
                    <div className="mt-2 px-1 dark:text-white flex-shrink-0">
                      <div className="font-semibold dark:text-white text-xs pl-1">
                        {selectedDownload?.channelName || 'Unknown Channel'}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="space-x-2">
                          <span className="px-2 py-0.5 bg-[#E6E6E6] dark:bg-[#4D4D4D] rounded-full text-[10px] text-black dark:text-white">
                            {activeTab}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Transcript and Summary Tabs */}
                    <div className="flex-1 flex flex-col min-h-0 pb-2 mt-2 px-1">
                      <TabInterface
                        tabs={[
                          {
                            id: 'transcript',
                            label: 'Transcript',
                            content: (
                              <TranscriptContent
                                transcriptLocation={
                                  selectedDownload?.transcriptLocation
                                }
                              />
                            ),
                          },
                          {
                            id: 'summary',
                            label: 'Summary',
                            content: (
                              <SummaryContent
                                transcriptLocation={
                                  selectedDownload?.autoCaptionLocation
                                }
                                existingSummary={selectedDownload?.summary}
                              />
                            ),
                          },
                        ]}
                        transcriptLocation={
                          selectedDownload?.autoCaptionLocation
                        }
                        videoTitle={`${selectedDownload?.name?.replace(
                          /\.[^/.]+$/,
                          '',
                        )} - ${selectedDownload?.channelName}`}
                        defaultActiveTab="transcript"
                        className="w-full h-full flex flex-col"
                        tabClassName="text-xs"
                        contentClassName="flex-1 overflow-y-auto min-h-0"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🎥</div>
                <p>No video available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video Context Menu */}
      <VideoContextMenu
        isVisible={contextMenu.visible}
        position={contextMenu.position}
        video={contextMenu.video}
        activeTab={activeTab}
        groups={groups}
        onMoveVideo={(video, fromCategory, toCategory) => {
          if (onMoveVideoToCategory) {
            onMoveVideoToCategory(video, fromCategory, toCategory);
          }
        }}
        onClose={closeContextMenu}
        onShowDeleteConfirmation={() => {
          if (contextMenu.video) {
            setVideoToDelete(contextMenu.video);
            setShowDeleteConfirmation(true);
          }
          closeContextMenu();
        }}
      />

      {/* <RemoveVideoModal
        isOpen={showDeleteConfirmation}
        onClose={() => {
          setShowDeleteConfirmation(false);
          setVideoToDelete(null);
        }}
        onConfirm={confirmDeleteVideo}
        videoToDelete={videoToDelete as VideoWithGroup}
      /> */}
    </div>
  );
};

// Video Context Menu Component
interface VideoContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  video: VideoItem | null;
  activeTab: string;
  groups: Record<string, VideoItem[]>;
  onMoveVideo: (
    video: VideoItem,
    fromCategory: string,
    toCategory: string,
  ) => void;
  onClose: () => void;
  onShowDeleteConfirmation: () => void;
}

const VideoContextMenu: React.FC<VideoContextMenuProps> = ({
  isVisible,
  position,
  video,
  activeTab,
  groups,
  onMoveVideo,
  onClose,
  onShowDeleteConfirmation,
}) => {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [submenuPosition, setSubmenuPosition] = useState('calc(100% + 4px)');

  // Get available categories (excluding current one)
  const availableCategories = Object.keys(groups).filter(
    (category) => category !== activeTab && category !== 'Uncategorized',
  );

  // Calculate submenu position after menu renders
  React.useLayoutEffect(() => {
    if (isVisible && menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      // Check if there's enough space for submenu on the right (include padding, margin, and safe buffer)
      const submenuWidth = 160; // w-32 (128px) + padding (16px) + margin (16px)
      const safeBuffer = 20; // Extra buffer for safety
      const newPosition =
        menuRect.right + submenuWidth + safeBuffer > window.innerWidth
          ? '-144px' // Position to the left with proper spacing
          : 'calc(100% + 4px)'; // Position to the right with small gap

      setSubmenuPosition(newPosition);
    }
  }, [isVisible, showMoveMenu]);

  const handleMoveClick = () => {
    setShowMoveMenu(!showMoveMenu);
  };

  const handleMoveToCategory = (targetCategory: string) => {
    if (video) {
      onMoveVideo(video, activeTab, targetCategory);
      toast({
        title: 'Video Moved',
        description: `Moved "${video.video_title}" to ${targetCategory}`,
        duration: 5000,
      });
    }
    onClose();
  };

  useEffect(() => {
    if (!isVisible) {
      setShowMoveMenu(false);
    }
  }, [isVisible]);

  // Handle positioning adjustments when menu is shown
  React.useEffect(() => {
    if (isVisible && menuRef.current) {
      const checkAndAdjustPosition = () => {
        if (menuRef.current) {
          const menuRect = menuRef.current.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;
          const margin = 10;
          let needsAdjustment = false;
          let newX = position.x;
          let newY = position.y;

          // Calculate approximate menu height
          const itemHeight = 32; // approximate height of each menu item
          const moveOptionHeight =
            availableCategories.length > 0 ? itemHeight : 0;
          const deleteOptionHeight = itemHeight;
          const totalMenuHeight = moveOptionHeight + deleteOptionHeight + 16; // + padding

          // Check if menu goes off bottom
          if (menuRect.bottom > viewportHeight - margin) {
            newY = Math.max(margin, viewportHeight - totalMenuHeight - margin);
            needsAdjustment = true;
          }

          // Check if menu goes off right
          if (menuRect.right > viewportWidth - margin) {
            newX = Math.max(margin, viewportWidth - 96 - margin); // w-24 = 96px
            needsAdjustment = true;
          }

          // Check if menu goes off left
          if (menuRect.left < margin) {
            newX = margin;
            needsAdjustment = true;
          }

          // Check if menu goes off top
          if (menuRect.top < margin) {
            newY = margin;
            needsAdjustment = true;
          }

          if (needsAdjustment) {
            menuRef.current.style.left = `${newX}px`;
            menuRef.current.style.top = `${newY}px`;
          }
        }
      };

      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(checkAndAdjustPosition);
    }
  }, [isVisible, position, availableCategories.length]);

  if (!isVisible || !video) return null;

  return (
    <>
      {/* Backdrop to close menu when clicking outside */}
      <div className="fixed inset-0 z-[8999]" onClick={onClose} />

      {/* Context Menu */}
      <div
        ref={menuRef}
        className="fixed bg-offWhite dark:bg-darkModeCompliment rounded-lg drop-shadow-lg shadow-md z-[9000] py-1 px-2 w-24 text-xs font-medium"
        style={{
          left: position.x,
          top: position.y,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Move Option */}
        {availableCategories.length > 0 && (
          <div className="relative">
            <button
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200 rounded transition-colors flex items-center justify-between"
              onClick={handleMoveClick}
            >
              <span>Move</span>
              <ChevronDown
                size={12}
                className={`transition-transform ${
                  showMoveMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Move Submenu */}
            {showMoveMenu && (
              <div
                className="absolute top-0 bg-offWhite dark:bg-darkModeCompliment rounded-lg drop-shadow-lg shadow-md z-[9001] py-1 px-2 w-32"
                style={{
                  left: submenuPosition,
                }}
              >
                {availableCategories.map((category) => (
                  <button
                    key={category}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200 rounded transition-colors"
                    onClick={() => handleMoveToCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Delete Option */}
        <button
          className="w-full text-left px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          onClick={onShowDeleteConfirmation}
        >
          Delete
        </button>
      </div>
    </>
  );
};

export default MyCategoriesSelectedCategory;
