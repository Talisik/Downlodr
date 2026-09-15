import { FinishedDownloads as FinishedDownload } from '@/downlodr/store/downloadStore';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AiOutlineExpandAlt } from 'react-icons/ai';
import { BsSortAlphaDown } from 'react-icons/bs';
import { HiOutlineListBullet, HiOutlineSquares2X2 } from 'react-icons/hi2';
import { LuSettings2 } from 'react-icons/lu';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import {
  SortBy,
  SortDirection,
  VideoItem,
  VideoWithGroup,
} from './SelectedCategoryTools';
import VideoItemRenderer from './VideoItemRenderer';

// Type definitions (now imported from SelectedCategoryTools)
interface SearchQuery {
  searchQuery: string;
  filterType: 'Title' | 'Category';
}

interface AllVideosSearchResultsViewProps {
  groups: Record<string, VideoItem[]>;
  finishedDownloads: FinishedDownload[];
  searchQuery: string;
  checkedVideos: Set<string>;
  onBackToAllVideos: () => void;
  onSelectAll?: (videoIds: string[]) => void;
  onDeselectAll?: () => void;
  onSort?: () => void;
  onViewFile: (filePath: string) => void;
  onVideoCheck: (video: VideoItem, checked: boolean) => void;
  onRowClick: (e: React.MouseEvent, video: VideoItem) => void;
}

const AllVideosSearchResultsView: React.FC<AllVideosSearchResultsViewProps> = ({
  groups,
  finishedDownloads,
  searchQuery,
  checkedVideos,
  onBackToAllVideos,
  onSelectAll,
  onDeselectAll,
  onSort,
  onViewFile,
  onVideoCheck,
  onRowClick,
}) => {
  // Combine all videos from all groups and filter by search query
  const [filterType, setFilterType] = useState<'Title' | 'Category'>('Title');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Persistent folder view state
  const [isFolderView, setIsFolderView] = useState(() => {
    const saved = localStorage.getItem('organization-view-mode');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Save view mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(
      'organization-view-mode',
      JSON.stringify(isFolderView),
    );
  }, [isFolderView]);

  const [selectedFilters, setSelectedFilters] = useState<{
    ext: Set<string>;
    source: Set<string>;
    category: Set<string>;
  }>({
    ext: new Set(),
    source: new Set(),
    category: new Set(),
  });
  const [pendingFilters, setPendingFilters] = useState<{
    ext: Set<string>;
    source: Set<string>;
    category: Set<string>;
  }>({
    ext: new Set(),
    source: new Set(),
    category: new Set(),
  });

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

  // Sort state
  const [sortBy, setSortBy] = useState<SortBy>('A-Z');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Filter state
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [allMetadata, setAllMetadata] = useState(false);
  const [isExtensionOpen, setIsExtensionOpen] = useState(true);
  const [isSourceOpen, setIsSourceOpen] = useState(true);
  const [isCategoryOpen, setIsCategoryOpen] = useState(true);

  // Active search queries for filtering logic
  const activeSearchQueries = useMemo(
    () => [{ searchQuery, filterType }],
    [searchQuery, filterType],
  );

  const handleSort = useCallback(() => {
    const sortOptions: SortBy[] = [
      'A-Z',
      'Z-A',
      'Oldest',
      'Newest',
      'Largest',
      'Smallest',
    ];
    const currentIndex = sortOptions.indexOf(sortBy);

    if (sortDirection === 'asc') {
      // If ascending, switch to descending for same criteria
      setSortDirection('desc');
    } else {
      // If descending, move to next criteria with ascending direction
      const nextIndex = (currentIndex + 1) % sortOptions.length;
      setSortBy(sortOptions[nextIndex]);
      setSortDirection('asc');
    }
  }, [sortBy, sortDirection]);

  const handleFilterToggle = useCallback(() => {
    setShowFilterDropdown(!showFilterDropdown);
  }, [showFilterDropdown]);

  const handleFilterChange = useCallback(
    (
      filterType: keyof typeof selectedFilters,
      value: string,
      checked: boolean,
    ) => {
      setPendingFilters((prev) => {
        const newFilters = { ...prev };
        const filterSet = new Set(newFilters[filterType]);

        if (checked) {
          filterSet.add(value);
        } else {
          filterSet.delete(value);
        }

        newFilters[filterType] = filterSet;
        return newFilters;
      });
    },
    [],
  );

  const applyFilters = useCallback(() => {
    setSelectedFilters(pendingFilters);
    setShowFilterDropdown(false);
  }, [pendingFilters]);

  const clearPendingFilters = useCallback(() => {
    setPendingFilters(selectedFilters);
  }, [selectedFilters]);

  const searchResults = useMemo(() => {
    const combined: VideoWithGroup[] = [];
    const query = searchQuery.toLowerCase().trim();

    if (filterType === 'Title') {
      // Search in video titles and channel names
      Object.entries(groups).forEach(([groupName, videos]) => {
        videos.forEach((video) => {
          const matchesSearch =
            video.video_title?.toLowerCase().includes(query) ||
            video.channelName?.toLowerCase().includes(query);

          if (matchesSearch) {
            combined.push({ ...video, groupName });
          }
        });
      });
    } else if (filterType === 'Category') {
      // Search in category names and show all videos from matching categories
      Object.entries(groups).forEach(([groupName, videos]) => {
        if (groupName.toLowerCase().includes(query)) {
          // Include all videos from this matching category
          videos.forEach((video) => {
            combined.push({ ...video, groupName });
          });
        }
      });
    }

    return combined;
  }, [groups, searchQuery, filterType]);

  // Filtered and sorted videos memoization
  const sortedVideos = useMemo(() => {
    const filteredVideos = [...searchResults];
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

  // Computed filter values
  const hasActiveFilters =
    selectedFilters.ext.size > 0 ||
    selectedFilters.source.size > 0 ||
    selectedFilters.category.size > 0;

  const pendingFilterCount =
    pendingFilters.ext.size +
    pendingFilters.source.size +
    pendingFilters.category.size;

  const hasPendingChanges = useMemo(() => {
    const extChanged =
      pendingFilters.ext.size !== selectedFilters.ext.size ||
      ![...pendingFilters.ext].every((item) => selectedFilters.ext.has(item)) ||
      ![...selectedFilters.ext].every((item) => pendingFilters.ext.has(item));

    const sourceChanged =
      pendingFilters.source.size !== selectedFilters.source.size ||
      ![...pendingFilters.source].every((item) =>
        selectedFilters.source.has(item),
      ) ||
      ![...selectedFilters.source].every((item) =>
        pendingFilters.source.has(item),
      );

    const categoryChanged =
      pendingFilters.category.size !== selectedFilters.category.size ||
      ![...pendingFilters.category].every((item) =>
        selectedFilters.category.has(item),
      ) ||
      ![...selectedFilters.category].every((item) =>
        pendingFilters.category.has(item),
      );

    return extChanged || sourceChanged || categoryChanged;
  }, [pendingFilters, selectedFilters]);

  // Get unique filter options from search results
  const filterOptions = useMemo(() => {
    if (!searchResults) return { ext: [], source: [], category: [] };

    const extSet = new Set<string>();
    const sourceSet = new Set<string>();
    const categorySet = new Set<string>();

    searchResults.forEach((video) => {
      const downloadData = finishedDownloads.find(
        (download) => download.id === video.video_id,
      );

      if (downloadData) {
        if (downloadData.ext) extSet.add(downloadData.ext);
        if (downloadData.extractorKey) sourceSet.add(downloadData.extractorKey);
      }
      // Add category from video.groupName
      if (video.groupName) categorySet.add(video.groupName);
    });

    return {
      ext: Array.from(extSet).sort(),
      source: Array.from(sourceSet).sort(),
      category: Array.from(categorySet).sort(),
    };
  }, [searchResults, finishedDownloads]);

  const filterButtonClasses = useMemo(() => {
    const baseClasses =
      'flex rounded items-center gap-1.5 px-3 py-1 text-xxs font-medium text-gray-700 dark:text-gray-200 bg-offWhite dark:bg-alternateBlack rounded-md transition-colors';

    if (showFilterDropdown) {
      if (hasPendingChanges) {
        return `${baseClasses} bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-600`;
      } else if (hasActiveFilters) {
        return `${baseClasses} bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-600`;
      }
    } else if (hasActiveFilters) {
      return `${baseClasses} bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-600`;
    }

    return baseClasses;
  }, [showFilterDropdown, hasPendingChanges, hasActiveFilters]);

  const handleAllMetadataChange = useCallback(
    (checked: boolean) => {
      setAllMetadata(checked);
      if (checked) {
        // When "All Metadata" is checked, select all available options
        const allExt = new Set(filterOptions.ext);
        const allSource = new Set(filterOptions.source);
        const allCategory = new Set(filterOptions.category);
        setPendingFilters({
          ext: allExt,
          source: allSource,
          category: allCategory,
        });
      } else {
        // When unchecked, clear all pending filters
        setPendingFilters({
          ext: new Set(),
          source: new Set(),
          category: new Set(),
        });
      }
    },
    [filterOptions],
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

  const handleVideoCheck = useCallback(
    (video: VideoItem, checked: boolean) => {
      onVideoCheck(video, checked);
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

  const handleRowClick = useCallback(
    (e: React.MouseEvent, video: VideoItem) => {
      onRowClick(e, video);
    },
    [onRowClick],
  );

  const handleViewFile = useCallback(
    (filePath: string) => {
      onViewFile(filePath);
    },
    [onViewFile],
  );

  // Don't render if no search query or no results
  if (!searchQuery.trim()) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500 dark:text-gray-400">
          Enter a search query to find videos
        </p>
      </div>
    );
  }

  if (searchResults.length === 0) {
    return (
      <div className="flex flex-row items-center justify-center h-full gap-4">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            No videos found for "{searchQuery}"
          </p>
          <button
            onClick={onBackToAllVideos}
            className="text-xs text-primary hover:underline"
          >
            Back to All Videos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      <div className="flex-1 flex flex-col overflow-hidden gap-2 bg-[#F9F9F9] dark:bg-darkMode">
        {/* Header */}
        <div className="flex justify-between bg-offWhite dark:bg-[#333333] py-3 px-4 items-start justify-center flex-shrink-0">
          <div className="flex justify-between items-center gap-1.5 mt-2">
            <button onClick={onBackToAllVideos} className="text-xs">
              <ChevronLeft
                size={16}
                className="text-gray-500 dark:text-gray-400"
              />
            </button>
            <div className="flex items-center gap-1 justify-center">
              <span className="text-md font-medium">Search Results for</span>
              <span className="text-md font-bold">{searchQuery}</span>
            </div>
          </div>
          <div className="space-x-2">
            <div className="w-fit rounded-lg p-0.5 flex items-center mr-2 gap-1">
              {/* Folder View Tab */}
              <button
                onClick={() => {
                  setIsFolderView(true);
                }}
                className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition
      ${
        isFolderView
          ? 'bg-lightModeBorder dark:bg-gray-200 text-gray-700'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
              >
                <HiOutlineSquares2X2 size={16} />
              </button>

              {/* List View Tab */}
              <button
                onClick={() => {
                  setIsFolderView(false);
                }}
                className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition
      ${
        !isFolderView
          ? 'bg-lightModeBorder dark:bg-gray-200 text-gray-700'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
              >
                <HiOutlineListBullet size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="h-full overflow-y-auto px-4 py-2 bg-white dark:bg-[#151515]">
          <div className="flex flex-row gap-2 justify-between mb-2">
            <div className="flex items-center gap-1 px-4 py-2">
              <TooltipWrapper
                content="Search in video titles and channels"
                side="bottom"
              >
                <button
                  onClick={() => setFilterType('Title')}
                  className={`text-xs px-2 py-1 rounded-md transition-colors ${
                    filterType === 'Title'
                      ? 'bg-lightModeBorder dark:bg-darkModeCompliment text-black dark:text-white'
                      : 'bg-offWhite dark:bg-alternateBlack hover:bg-gray-100 dark:hover:bg-gray-500'
                  }`}
                >
                  Title
                </button>
              </TooltipWrapper>
              <TooltipWrapper content="Search in category names" side="bottom">
                <button
                  onClick={() => setFilterType('Category')}
                  className={`text-xs px-2 py-1 rounded-md transition-colors ${
                    filterType === 'Category'
                      ? 'bg-lightModeBorder dark:bg-darkModeCompliment text-black dark:text-white'
                      : 'bg-offWhite dark:bg-alternateBlack hover:bg-gray-100 dark:hover:bg-gray-500'
                  }`}
                >
                  Category
                </button>
              </TooltipWrapper>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={
                    sortedVideos.length > 0 &&
                    sortedVideos.every((v) => checkedVideos.has(v.video_id))
                  }
                  onChange={(e) => {
                    e.stopPropagation();
                    if (
                      sortedVideos.every((v) => checkedVideos.has(v.video_id))
                    ) {
                      handleDeselectAll();
                    } else {
                      handleSelectAll();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 flex-shrink-0 rounded border dark:bg-gray-700 dark:checked:bg-primary"
                />

                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Select All
                </span>
              </div>
              <div className="flex items-center">
                <div className="flex items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSort();
                      onSort?.();
                    }}
                    className="flex rounded items-center gap-1.5 px-3 py-1 text-xxs font-medium text-gray-700 dark:text-gray-200 bg-offWhite dark:bg-alternateBlack rounded-md transition-colors"
                  >
                    <BsSortAlphaDown size={14} />
                    <span>Sort</span>
                  </button>
                  <div className="relative filter-dropdown">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFilterToggle();
                      }}
                      className={filterButtonClasses}
                    >
                      <LuSettings2 size={14} />
                      <span>Filter</span>
                      {(hasActiveFilters ||
                        (showFilterDropdown && pendingFilterCount > 0)) && (
                        <span
                          className={`ml-1 text-white text-xs rounded-full px-1 min-w-[18px] h-[18px] flex items-center justify-center ${
                            showFilterDropdown && hasPendingChanges
                              ? 'bg-orange-500'
                              : 'bg-blue-500'
                          }`}
                        >
                          {showFilterDropdown
                            ? pendingFilterCount
                            : selectedFilters.ext.size +
                              selectedFilters.source.size +
                              selectedFilters.category.size}
                        </span>
                      )}
                    </button>

                    {/* Filter Dropdown */}
                    {showFilterDropdown && (
                      <div className="pb-1 absolute top-full mt-1 right-0 bg-white dark:bg-gray-800 border border-titleBarBorder dark:border-gray-600 rounded-md shadow-lg z-50 min-w-[200px] max-h-[400px] overflow-y-auto">
                        <div className="">
                          <div className="flex items-center justify-between mb-3 border-b border-titleBarBorder dark:border-gray-600 pb-3">
                            <div className="px-3 pt-2">
                              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-100">
                                Filter
                              </h3>
                              <div className="flex items-center gap-2 mt-2">
                                <input
                                  type="checkbox"
                                  checked={allMetadata}
                                  onChange={(e) =>
                                    handleAllMetadataChange(e.target.checked)
                                  }
                                />
                                <span className="text-xs font-medium">
                                  All Metadata
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Extension Filter */}
                          {filterOptions.ext.length > 0 && (
                            <div className="mb-3 px-3">
                              {/* Header */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={allMetadata}
                                    onChange={(e) =>
                                      handleAllMetadataChange(e.target.checked)
                                    }
                                  />
                                  <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Extension
                                  </h4>
                                </div>

                                <button
                                  onClick={() =>
                                    setIsExtensionOpen((prev) => !prev)
                                  }
                                  className="p-1"
                                >
                                  <ChevronDown
                                    size={14}
                                    className={`transition-transform duration-200 ${
                                      isExtensionOpen
                                        ? 'rotate-0'
                                        : '-rotate-90'
                                    }`}
                                  />
                                </button>
                              </div>

                              {/* Extension List */}
                              {isExtensionOpen && (
                                <div className="space-y-1 ml-6 mt-2">
                                  {filterOptions.ext.map((ext) => (
                                    <label
                                      key={ext}
                                      className="flex items-center text-xs"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={pendingFilters.ext.has(ext)}
                                        onChange={(e) =>
                                          handleFilterChange(
                                            'ext',
                                            ext,
                                            e.target.checked,
                                          )
                                        }
                                        className="w-3 h-3 mr-2 rounded border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="text-gray-600 dark:text-gray-400">
                                        {ext}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Source Filter */}
                          {filterOptions.source.length > 0 && (
                            <div className="mb-3 px-3">
                              {/* Header */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={allMetadata}
                                    onChange={(e) =>
                                      handleAllMetadataChange(e.target.checked)
                                    }
                                  />
                                  <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Source
                                  </h4>
                                </div>

                                <button
                                  onClick={() =>
                                    setIsSourceOpen((prev) => !prev)
                                  }
                                  className="p-1"
                                >
                                  <ChevronDown
                                    size={14}
                                    className={`transition-transform duration-200 ${
                                      isSourceOpen ? 'rotate-0' : '-rotate-90'
                                    }`}
                                  />
                                </button>
                              </div>

                              {/* Source List */}
                              {isSourceOpen && (
                                <div className="space-y-1 ml-6 mt-2">
                                  {filterOptions.source.map((source) => (
                                    <label
                                      key={source}
                                      className="flex items-center text-xs"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={pendingFilters.source.has(
                                          source,
                                        )}
                                        onChange={(e) =>
                                          handleFilterChange(
                                            'source',
                                            source,
                                            e.target.checked,
                                          )
                                        }
                                        className="w-3 h-3 mr-2 rounded border-gray-300 dark:border-gray-600"
                                      />
                                      <span className="text-gray-600 dark:text-gray-400">
                                        {source}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Category Filter */}
                          {filterOptions.category.length > 0 && (
                            <div className="mb-3 px-3">
                              {/* Header */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={allMetadata}
                                    onChange={(e) =>
                                      handleAllMetadataChange(e.target.checked)
                                    }
                                  />
                                  <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Category
                                  </h4>
                                </div>

                                <button
                                  onClick={() =>
                                    setIsCategoryOpen((prev) => !prev)
                                  }
                                  className="p-1"
                                >
                                  <ChevronDown
                                    size={14}
                                    className={`transition-transform duration-200 ${
                                      isCategoryOpen ? 'rotate-0' : '-rotate-90'
                                    }`}
                                  />
                                </button>
                              </div>

                              {isCategoryOpen && (
                                <div className="space-y-1 ml-6 mt-2">
                                  {filterOptions.category.map((category) => (
                                    <label
                                      key={category}
                                      className="flex items-center text-xs gap-2"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={pendingFilters.category.has(
                                          category,
                                        )}
                                        onChange={(e) =>
                                          handleFilterChange(
                                            'category',
                                            category,
                                            e.target.checked,
                                          )
                                        }
                                        className="w-3 h-3 rounded border-gray-300 dark:border-gray-600 flex-shrink-0"
                                      />

                                      <div className="flex-1 min-w-0">
                                        <p className="line-clamp-1 break-words overflow-hidden text-gray-600 dark:text-gray-400">
                                          {category}
                                        </p>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex flex-col px-2 gap-1">
                            <button
                              onClick={applyFilters}
                              className="py-1 primary-custom-btn flex-1 items-center justify-center"
                            >
                              <span className="text-white text-xs">Apply</span>
                            </button>
                            <button
                              onClick={clearPendingFilters}
                              className="py-1 items-center justify-center bg-white text-primary"
                            >
                              <span className="text-primary text-xs">
                                Clear
                              </span>
                            </button>
                          </div>

                          {filterOptions.ext.length === 0 &&
                            filterOptions.source.length === 0 &&
                            filterOptions.category.length === 0 && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                No filter options available
                              </p>
                            )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <button
                      className="flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition"
                      onClick={() => setIsExpandedDetails(!isExpandedDetails)}
                    >
                      <AiOutlineExpandAlt size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            className={`px-2 ${
              isFolderView ? 'grid auto-rows grid-cols-4 gap-2 mx-4 my-4' : ''
            }`}
          >
            {searchResults.map((video) => {
              // Find the corresponding download data
              const downloadData = finishedDownloads.find(
                (download) => download.id === video.video_id,
              );

              if (!downloadData) return null;

              return (
                <VideoItemRenderer
                  key={video.video_id}
                  video={video}
                  downloadData={downloadData}
                  isFolderView={isFolderView}
                  isShowSidePlayer={false}
                  checkedVideos={checkedVideos}
                  finishedDownloads={finishedDownloads}
                  activeTab={'All Videos'}
                  groups={groups}
                  categoryDropdown={categoryDropdown}
                  isExpandedDetails={isExpandedDetails}
                  onVideoCheck={handleVideoCheck}
                  onRowClick={handleRowClick}
                  onRightClick={(e) => {
                    const rect = (
                      e.currentTarget as HTMLElement
                    ).getBoundingClientRect();
                  }}
                  onCategoryDropdownClick={handleCategoryDropdownClick}
                  onCloseCategoryDropdown={closeCategoryDropdown}
                  onViewFile={() => {
                    /*hello */
                  }}
                  selectedDownload={null}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllVideosSearchResultsView;
