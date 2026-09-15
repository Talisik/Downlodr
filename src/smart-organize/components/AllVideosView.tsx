/**
 * AllVideosView Component
 * Displays all videos from all groups with list/folder view options
 * Supports video playback, thumbnails, and interactive features
 */

import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import {
  FinishedDownloads as FinishedDownload,
  useDownloadStore,
} from '@/downlodr/store/downloadStore';
import { ChevronDown } from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { IoMdClose } from 'react-icons/io';
// import VideoPlayer from '../VideoPlayer';
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

// Type definitions (now imported from SelectedCategoryTools)

interface SearchQuery {
  searchQuery: string;
  filterType: 'Title' | 'Category';
}

interface AllVideosViewProps {
  groups: Record<string, VideoItem[]>;
  finishedDownloads: FinishedDownload[];
  checkedVideos: Set<string>;
  isShowSidePlayer: boolean;
  isFolderView: boolean;
  setShowSidePlayer?: (show: boolean) => void;
  onVideoCheck: (video: VideoItem, checked: boolean) => void;
  onRowClick: (e: React.MouseEvent, video: VideoItem) => void;
  onRightClick: (
    e: React.MouseEvent,
    video: VideoItem,
    category: string,
  ) => void;
  onViewFile: (filePath: string) => void;
  onViewDownload: (location: string) => void;
  onSelectAll?: (videoIds: string[]) => void;
  onDeselectAll?: () => void;
  onSort?: () => void;
  onFilter?: () => void;
  externalSearchQueries?: SearchQuery[];
  onMoveVideoToCategory?: (
    video: VideoWithGroup,
    fromCategory: string,
    toCategory: string,
  ) => void;
  onCategoryClick?: (categoryName: string, videos: VideoItem[]) => void;
}

const AllVideosView: React.FC<AllVideosViewProps> = ({
  groups,
  finishedDownloads,
  checkedVideos,
  isFolderView,
  onVideoCheck,
  onRowClick,
  onRightClick,
  onViewFile,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onViewDownload,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSelectAll,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onDeselectAll,
  onSort,
  isShowSidePlayer,
  setShowSidePlayer,
  onFilter,
  externalSearchQueries,
  onMoveVideoToCategory,
  onCategoryClick,
}) => {
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [selectedDownloadId, setSelectedDownloadId] = useState<string | null>(
    null,
  );
  const [selectedVideoGroup, setSelectedVideoGroup] = useState<string | null>(
    null,
  );
  const selectedDownload = useDownloadStore(
    (state) =>
      state.finishedDownloads.find(
        (download) => download.id === selectedDownloadId,
      ) || null,
  );

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    video: VideoWithGroup | null;
  }>({
    visible: false,
    position: { x: 0, y: 0 },
    video: null,
  });

  // Delete confirmation modal state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<VideoWithGroup | null>(
    null,
  );

  // Search state
  const searchDivRef = useRef<HTMLDivElement>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [allSearchQuery, setAllSearchQuery] = useState<SearchQuery[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [filterType, setFilterType] = useState<'Title' | 'Category'>('Title');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState<SortBy>('A-Z');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Filter state
  const [selectedFilters, setSelectedFilters] = useState<FilterState>({
    ext: new Set(),
    source: new Set(),
    category: new Set(),
  });

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      visible: false,
      position: { x: 0, y: 0 },
      video: null,
    });
  }, []);

  const closeCategoryDropdown = useCallback(() => {
    setCategoryDropdown({
      visible: false,
      videoId: null,
      position: { x: 0, y: 0 },
    });
  }, []);

  const confirmDeleteVideo = useCallback(() => {
    if (videoToDelete && onMoveVideoToCategory) {
      // Move video to Uncategorized
      onMoveVideoToCategory(
        videoToDelete,
        videoToDelete.groupName,
        'Uncategorized',
      );
      toast({
        title: 'Video Removed',
        description: `Removed "${videoToDelete.video_title}" from ${videoToDelete.groupName} and moved to Uncategorized`,
        duration: 5000,
      });
      setVideoToDelete(null);
    }
    setShowDeleteConfirmation(false);
  }, [videoToDelete, onMoveVideoToCategory]);

  // Combine all videos from all groups, deduplicating by video_id
  const allVideosWithGroups = useMemo(() => {
    const combined: VideoWithGroup[] = [];
    const seenVideoIds = new Set<string>();

    Object.entries(groups).forEach(([groupName, videos]) => {
      videos.forEach((video) => {
        if (!seenVideoIds.has(video.video_id)) {
          seenVideoIds.add(video.video_id);
          combined.push({ ...video, groupName });
        }
      });
    });
    return combined;
  }, [groups]);

  // Get unique filter options from current videos
  const filterOptions: FilterOptions = useMemo(() => {
    if (!allVideosWithGroups) return { ext: [], source: [], category: [] };

    const extSet = new Set<string>();
    const sourceSet = new Set<string>();
    const categorySet = new Set<string>();

    allVideosWithGroups.forEach((video) => {
      const downloadData = finishedDownloads.find(
        (download) => download.id === video.video_id,
      );

      if (downloadData) {
        if (downloadData.ext) extSet.add(downloadData.ext);
        if (downloadData.extractorKey) sourceSet.add(downloadData.extractorKey);
      }
    });

    // Get category options from actual groups (excluding Uncategorized)
    const categoryNames = Object.keys(groups).filter(
      (name) => name !== 'Uncategorized',
    );
    categoryNames.forEach((categoryName) => categorySet.add(categoryName));

    // If no categories exist yet, add a placeholder
    if (categorySet.size === 0) {
      categorySet.add('No categories created yet');
    }

    return {
      ext: Array.from(extSet).sort(),
      source: Array.from(sourceSet).sort(),
      category: Array.from(categorySet).sort(),
    };
  }, [allVideosWithGroups, finishedDownloads, groups]);

  // Use external search queries if provided, otherwise use internal state
  const activeSearchQueries = externalSearchQueries ?? allSearchQuery;

  // Filtered and sorted videos memoization
  const sortedVideos = useMemo(() => {
    const filteredVideos = [...allVideosWithGroups];
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
  }, [groups, finishedDownloads, sortBy, selectedFilters]);

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

  // Handle adding a new search query pill
  const handleAddQuery = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (trimmed === '') return;
      setAllSearchQuery((prev) => [
        ...prev,
        { searchQuery: trimmed, filterType },
      ]);
      setInputValue('');
    },
    [filterType],
  );

  // Handle keyboard events for search input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        handleAddQuery(inputValue);
      }
      if (
        e.key === 'Backspace' &&
        inputValue === '' &&
        allSearchQuery.length > 0
      ) {
        // Remove last pill on backspace
        setAllSearchQuery((prev) => prev.slice(0, prev.length - 1));
      }
    },
    [inputValue, allSearchQuery.length, handleAddQuery],
  );

  // Remove a pill by index
  const removePill = useCallback((index: number) => {
    setAllSearchQuery((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Handle click outside search div to close search mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchDivRef.current &&
        !searchDivRef.current.contains(event.target as Node)
      ) {
        setIsSearchMode(false);
      }
    };

    if (isSearchMode) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchMode]);

  const [isExpandedDetails, setIsExpandedDetails] = useState(false);

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
  // Handle category dropdown positioning and outside clicks
  useEffect(() => {
    if (categoryDropdown.visible) {
      const handleClickOutside = (event: MouseEvent) => {
        if (!(event.target as Element).closest('.category-dropdown-trigger')) {
          closeCategoryDropdown();
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [categoryDropdown.visible, closeCategoryDropdown]);

  // Event handlers
  const handleVideoCheck = useCallback(
    (video: VideoItem, checked: boolean) => {
      onVideoCheck(video, checked);
    },
    [onVideoCheck],
  );

  const handleRowClick = useCallback(
    (e: React.MouseEvent, video: VideoItem) => {
      setSelectedDownloadId(video.video_id);
      // Find the group for this video
      const videoWithGroup = allVideosWithGroups.find(
        (v) => v.video_id === video.video_id,
      );
      setSelectedVideoGroup(videoWithGroup?.groupName || null);
      console.log('selectedDownloadId', video.video_id);
      setShowSidePlayer(true);
      onRowClick(e, video);
    },
    [onRowClick, allVideosWithGroups],
  );

  const handleRightClick = useCallback(
    (e: React.MouseEvent, video: VideoWithGroup) => {
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

  const handleCategoryDropdownClick = useCallback(
    (e: React.MouseEvent, video: VideoWithGroup) => {
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

  const handleViewFile = useCallback(
    (filePath: string) => {
      onViewFile(filePath);
    },
    [onViewFile],
  );

  // Don't render if no videos
  if (allVideosWithGroups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500 dark:text-gray-400">No videos available</p>
      </div>
    );
  }

  // Show message if search filters result in no videos
  if (sortedVideos.length === 0 && activeSearchQueries.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-gray-500 dark:text-gray-400">
          No videos match your search
        </p>
        <button
          onClick={() => {
            setAllSearchQuery([]);
            setInputValue('');
          }}
          className="text-xs text-primary hover:underline"
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-1 overflow-hidden h-full bg-offWhite dark:bg-alternateBlack ${
        isShowSidePlayer ? 'flex-row' : 'flex-row'
      }`}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab Content */}
        <SelectedCategoryTools
          videos={sortedVideos}
          finishedDownloads={finishedDownloads}
          isFolderView={isFolderView}
          isShowSidePlayer={false}
          checkedVideos={checkedVideos}
          activeTab="All Videos"
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
              video: video as VideoWithGroup,
            });
          }}
          onViewFile={handleViewFile}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onSort={onSort}
          selectedDownload={selectedDownload}
          isExpandedDetails={isExpandedDetails}
          onExpandedDetailsToggle={() =>
            setIsExpandedDetails(!isExpandedDetails)
          }
          externalSortBy={sortBy}
          externalSortDirection={sortDirection}
          externalSelectedFilters={selectedFilters}
          onSortChange={(newSortBy) => {
            setSortBy(newSortBy);
          }}
          onFilterChange={(newFilters) => {
            setSelectedFilters(newFilters);
          }}
          gridColsWithSidePlayer={3}
          gridColsWithoutSidePlayer={4}
          debugContext="AllVideosView"
        />
      </div>

      {/* Side Player */}
      {isShowSidePlayer && (
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
                          className="w-full h-full flex items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700"
                          style={
                            selectedDownload.thumbnails
                              ? {
                                  backgroundImage: `url(${selectedDownload.thumbnails})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                }
                              : {}
                          }
                        >
                          <span className="text-sm font-medium text-white dark:text-gray-300 bg-black/90 px-3 py-1 rounded">
                            No video available
                          </span>
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
                            {selectedVideoGroup || 'Unknown Group'}
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

      {/* <RemoveVideoModal
        isOpen={showDeleteConfirmation}
        onClose={() => {
          setShowDeleteConfirmation(false);
          setVideoToDelete(null);
        }}
        onConfirm={confirmDeleteVideo}
        videoToDelete={videoToDelete}
      /> */}

      {/* Video Context Menu */}
      <VideoContextMenu
        isVisible={contextMenu.visible}
        position={contextMenu.position}
        video={contextMenu.video}
        groups={groups}
        onMoveVideo={(video, fromCategory, toCategory) => {
          if (onMoveVideoToCategory) {
            onMoveVideoToCategory(video, fromCategory, toCategory);
          }
        }}
        onDeleteVideo={() => {
          if (contextMenu.video) {
            setVideoToDelete(contextMenu.video);
            setShowDeleteConfirmation(true);
          }
        }}
        onClose={closeContextMenu}
      />
    </div>
  );
};

// Video Context Menu Component
interface VideoContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  video: VideoWithGroup | null;
  groups: Record<string, VideoItem[]>;
  onMoveVideo: (
    video: VideoWithGroup,
    fromCategory: string,
    toCategory: string,
  ) => void;
  onDeleteVideo: () => void;
  onClose: () => void;
}

const VideoContextMenu: React.FC<VideoContextMenuProps> = ({
  isVisible,
  position,
  video,
  groups,
  onMoveVideo,
  onDeleteVideo,
  onClose,
}) => {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [submenuPosition, setSubmenuPosition] = useState('calc(100% + 10px)');

  // Get available categories (excluding current one and Uncategorized)
  const availableCategories = Object.keys(groups).filter(
    (category) => category !== video?.groupName && category !== 'Uncategorized',
  );

  // Calculate submenu position after menu renders
  React.useLayoutEffect(() => {
    if (isVisible && menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      // Check if there's enough space for submenu on the right (include padding, margin, and safe buffer)
      const submenuWidth = 180; // w-32 (128px) + padding (16px) + margin (16px)
      const safeBuffer = 60; // Extra buffer for safety
      const newPosition =
        menuRect.right + submenuWidth + safeBuffer > window.innerWidth
          ? '-144px' // Position to the left with proper spacing
          : 'calc(100% + 10px)'; // Position to the right with small gap

      setSubmenuPosition(newPosition);
    }
  }, [isVisible, showMoveMenu]);

  useEffect(() => {
    if (!isVisible) {
      setShowMoveMenu(false);
    }
  }, [isVisible]);

  const handleMoveClick = () => {
    setShowMoveMenu(!showMoveMenu);
  };

  const handleMoveToCategory = (targetCategory: string) => {
    if (video) {
      onMoveVideo(video, video.groupName, targetCategory);
      toast({
        title: 'Video Moved',
        description: `Moved "${video.video_title}" to ${targetCategory}`,
        duration: 5000,
      });
    }
    onClose();
  };

  const handleDeleteClick = () => {
    onDeleteVideo();
    onClose();
  };

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
          onClick={handleDeleteClick}
        >
          Delete
        </button>
      </div>
    </>
  );
};

export default AllVideosView;
