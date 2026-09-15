/**
 * SelectedCategoryTools Component
 * Reusable component for displaying video lists with filtering, sorting, and selection
 * Used across SelectedCategory, MyCategoriesSelectedCategory, AllVideosView, and AllVideosSearchResultsView
 */

import { FinishedDownloads as FinishedDownload } from '@/downlodr/store/download/types';
import { ChevronDown } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AiOutlineExpandAlt } from 'react-icons/ai';
import { FiPlus } from 'react-icons/fi';
import { IoMdClose } from 'react-icons/io';
import { LuArrowUpDown, LuFilter, LuTrash } from 'react-icons/lu';
import { PiFolderSimpleLight } from 'react-icons/pi';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import MoveVideosModal from './MoveVideosModal';
import VideoItemRenderer from './VideoItemRenderer';
import type { VideoItem, VideoWithGroup } from './organizationTypes';
export type { VideoItem, VideoWithGroup } from './organizationTypes';

export type SortBy =
  | 'Oldest'
  | 'Newest'
  | 'A-Z'
  | 'Z-A'
  | 'Largest'
  | 'Smallest';
export type SortDirection = 'asc' | 'desc';

export interface FilterOptions {
  ext: string[];
  source: string[];
  category: string[];
}

export interface FilterState {
  ext: Set<string>;
  source: Set<string>;
  category: Set<string>;
}

export interface CategoryDropdown {
  visible: boolean;
  videoId: string | null;
  position: { x: number; y: number };
}

export interface SelectedCategoryToolsProps {
  // Video data
  videos: VideoItem[] | VideoWithGroup[];
  finishedDownloads: FinishedDownload[];

  // View state
  isFolderView: boolean;
  isShowSidePlayer: boolean;
  checkedVideos: Set<string>;
  activeTab?: string;
  groups?: Record<string, VideoItem[]>;

  // Filter options
  filterOptions: FilterOptions;

  // Callbacks
  onVideoCheck: (video: VideoItem, checked: boolean) => void;
  onRowClick: (e: React.MouseEvent, video: VideoItem) => void;
  onRightClick: (e: React.MouseEvent, video: VideoItem) => void;
  onViewFile: (filePath: string) => void;
  onSelectAll?: (videoIds: string[]) => void;
  onDeselectAll?: () => void;
  onSort?: () => void;
  onCategoryDropdownClick?: (e: React.MouseEvent, video: VideoItem) => void;
  onCloseCategoryDropdown?: () => void;

  // Category management callbacks
  onMoveVideosToCategory?: (
    videoIds: string[],
    targetCategory: string,
    sourceCategory?: string,
  ) => void;
  onRemoveVideosFromCategory?: (
    videoIds: string[],
    fromCategory: string,
  ) => void;
  onAddVideosToNewCategory?: (
    videoIds: string[],
    newCategoryName: string,
  ) => void;

  // Optional props for customization
  selectedDownload?: FinishedDownload | null;
  categoryDropdown?: CategoryDropdown;
  isExpandedDetails?: boolean;
  onExpandedDetailsToggle?: () => void;

  // External sort/filter state (optional - if not provided, component manages its own)
  externalSortBy?: SortBy;
  externalSortDirection?: SortDirection;
  externalSelectedFilters?: FilterState;
  onSortChange?: (sortBy: SortBy) => void;
  onFilterChange?: (filters: FilterState) => void;

  // Grid configuration
  gridColsWithSidePlayer?: number;
  gridColsWithoutSidePlayer?: number;

  // Debug context for logging
  debugContext?: string;

  // Hide category actions (for MyCategoriesSelectedCategory)
  hideCategoryActions?: boolean;

  // My Categories (merged categories) to include in move modal
  availableCategories?: string[];
}

const SelectedCategoryTools: React.FC<SelectedCategoryToolsProps> = ({
  videos,
  finishedDownloads,
  isFolderView,
  isShowSidePlayer,
  checkedVideos,
  activeTab = '',
  groups = {},
  filterOptions,
  onVideoCheck,
  onRowClick,
  onRightClick,
  onViewFile,
  onSelectAll,
  onDeselectAll,
  onCategoryDropdownClick,
  onCloseCategoryDropdown,
  onMoveVideosToCategory,
  onRemoveVideosFromCategory,
  onAddVideosToNewCategory,
  selectedDownload = null,
  categoryDropdown = {
    visible: false,
    videoId: null,
    position: { x: 0, y: 0 },
  },
  isExpandedDetails = false,
  onExpandedDetailsToggle,
  externalSortBy,
  externalSelectedFilters,
  onSortChange,
  onFilterChange,
  gridColsWithSidePlayer = 3,
  gridColsWithoutSidePlayer = 4,
  debugContext = 'SelectedCategoryTools',
  hideCategoryActions = false,
  availableCategories = [],
}) => {
  // Internal state (used when external state is not provided)
  const [internalSortBy, setInternalSortBy] = useState<SortBy>('A-Z');
  useState<SortDirection>('asc');
  const [internalSelectedFilters, setInternalSelectedFilters] =
    useState<FilterState>({
      ext: new Set(),
      source: new Set(),
      category: new Set(),
    });

  // Use external state if provided, otherwise use internal state
  const sortBy = externalSortBy ?? internalSortBy;
  const selectedFilters = externalSelectedFilters ?? internalSelectedFilters;

  // Filter state
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [pendingFilters, setPendingFilters] =
    useState<FilterState>(selectedFilters);
  const [allMetadata, setAllMetadata] = useState(false);

  // Filter dropdown state
  const [isCategoryOpen, setIsCategoryOpen] = useState(true);
  const [isSourceOpen, setIsSourceOpen] = useState(true);
  const [isExtensionOpen, setIsExtensionOpen] = useState(true);

  // Category management state
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const [pendingSortBy, setPendingSortBy] = useState<SortBy>(sortBy);

  const handleSortToggle = useCallback(() => {
    setShowSortDropdown((prev) => !prev);
  }, []);

  const applySort = useCallback(
    (option: SortBy) => {
      setPendingSortBy(option);

      if (onSortChange) {
        onSortChange(option); // use the new value directly
      } else {
        setInternalSortBy(option); // use the new value directly
      }

      setShowSortDropdown(false);
    },
    [onSortChange], // no need to include pendingSortBy
  );

  const clearPendingSort = useCallback(() => {
    const defaultSort: SortBy = 'A-Z';
    setPendingSortBy(defaultSort);

    // Also reset the internal sort or trigger the callback
    if (onSortChange) {
      onSortChange(defaultSort);
    } else {
      setInternalSortBy(defaultSort);
    }
  }, [onSortChange, setInternalSortBy]);

  useEffect(() => {
    if (showSortDropdown) {
      setPendingSortBy(sortBy);
    }
  }, [showSortDropdown, sortBy]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSortDropdown) {
        const target = event.target as Element;
        if (!target.closest('.sort-dropdown')) {
          setShowSortDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSortDropdown]);

  const handleAllMetadataChange = useCallback((checked: boolean) => {
    setAllMetadata(checked);
  }, []);

  // Filtered and sorted videos memoization
  const sortedVideos = useMemo(() => {
    const filteredVideos = [...videos];

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
  }, [videos, finishedDownloads, sortBy, selectedFilters, activeTab]);

  // Event handlers
  const handleVideoCheck = useCallback(
    (video: VideoItem, checked: boolean) => {
      onVideoCheck(video, checked);
    },
    [onVideoCheck],
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

  // Filter handlers
  const handleFilterToggle = useCallback(() => {
    setShowFilterDropdown(!showFilterDropdown);
  }, [showFilterDropdown]);

  const handleFilterChange = useCallback(
    (filterType: keyof FilterState, value: string, checked: boolean) => {
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
    if (onFilterChange) {
      onFilterChange(pendingFilters);
    } else {
      setInternalSelectedFilters(pendingFilters);
    }
    setShowFilterDropdown(false);
  }, [pendingFilters, onFilterChange]);

  const clearPendingFilters = useCallback(() => {
    setPendingFilters(selectedFilters);
  }, [selectedFilters]);

  const hasActiveFilters =
    selectedFilters.ext.size > 0 ||
    selectedFilters.source.size > 0 ||
    selectedFilters.category.size > 0;

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

  const filterButtonClasses = useMemo(() => {
    const baseClasses =
      'flex  rounded items-center gap-1.5 px-3 py-1 text-xxs font-medium text-gray-700 dark:text-gray-200 bg-offWhite dark:bg-alternateBlack rounded-md transition-colors';

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

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showFilterDropdown) {
        const target = event.target as Element;
        if (!target.closest('.filter-dropdown')) {
          setShowFilterDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterDropdown]);

  // Initialize pending filters when dropdown opens
  useEffect(() => {
    if (showFilterDropdown) {
      setPendingFilters(selectedFilters);
    }
  }, [showFilterDropdown, selectedFilters]);

  // Category management handlers
  const handleMoveVideos = useCallback(() => {
    if (checkedVideos.size === 0) return;
    console.log('groups:', groups);
    console.log('activeTab:', activeTab);
    const available = groups
      ? Object.keys(groups).filter((categoryName) => categoryName !== activeTab)
      : [];
    console.log('availableCategories for modal:', available);
    setShowMoveModal(true);
  }, [checkedVideos.size, groups, activeTab]);

  const handleRemoveVideos = useCallback(() => {
    if (checkedVideos.size === 0) return;
    setShowRemoveConfirmation(true);
  }, [checkedVideos.size]);

  const handleAddToNewCategory = useCallback(() => {
    if (checkedVideos.size === 0) return;
    setShowNewCategoryModal(true);
  }, [checkedVideos.size]);

  const confirmMoveVideos = useCallback(
    (targetCategory: string) => {
      if (checkedVideos.size === 0 || !onMoveVideosToCategory) return;

      const videoIds = Array.from(checkedVideos);
      // Pass activeTab as sourceCategory (similar to drag and drop)
      const sourceCategory =
        activeTab && activeTab !== 'All Videos' ? activeTab : undefined;
      onMoveVideosToCategory(videoIds, targetCategory, sourceCategory);
      setShowMoveModal(false);

      toast({
        title: 'Videos Moved',
        description: `Moved ${videoIds.length} video(s) to "${targetCategory}"`,
        duration: 5000,
      });
    },
    [checkedVideos, onMoveVideosToCategory, activeTab],
  );

  const confirmRemoveVideos = useCallback(() => {
    if (checkedVideos.size === 0 || !onRemoveVideosFromCategory || !activeTab)
      return;

    const videoIds = Array.from(checkedVideos);
    onRemoveVideosFromCategory(videoIds, activeTab);
    setShowRemoveConfirmation(false);

    toast({
      title: 'Videos Removed',
      description: `Removed ${videoIds.length} video(s) from "${activeTab}"`,
      duration: 5000,
    });
  }, [checkedVideos, onRemoveVideosFromCategory, activeTab]);

  const confirmAddToNewCategory = useCallback(() => {
    if (
      checkedVideos.size === 0 ||
      !onAddVideosToNewCategory ||
      !newCategoryName.trim()
    )
      return;

    const videoIds = Array.from(checkedVideos);
    const trimmedName = newCategoryName.trim();

    onAddVideosToNewCategory(videoIds, trimmedName);
    setShowNewCategoryModal(false);
    setNewCategoryName('');

    toast({
      title: 'Category Created',
      description: `Created "${trimmedName}" and added ${videoIds.length} video(s)`,
      duration: 5000,
    });
  }, [checkedVideos, onAddVideosToNewCategory, newCategoryName]);

  return (
    <div className="flex-1 min-h-0">
      <div className="h-full overflow-y-auto">
        {/* Header with controls */}
        <div
          className={`mt-3 flex items-center justify-between flex-1 rounded-md py-2 px-4 ${
            checkedVideos.size > 0 && !hideCategoryActions
              ? 'bg-lightModeBorder dark:bg-darkModeCompliment'
              : ''
          }`}
        >
          <div
            className="flex items-center gap-2"
            onClick={(e) => {
              e.stopPropagation();
              if (sortedVideos.every((v) => checkedVideos.has(v.video_id))) {
                handleDeselectAll();
              } else {
                handleSelectAll();
              }
            }}
          >
            <input
              type="checkbox"
              checked={
                sortedVideos.length > 0 &&
                sortedVideos.every((v) => checkedVideos.has(v.video_id))
              }
              onChange={(e) => {
                e.stopPropagation();
                if (sortedVideos.every((v) => checkedVideos.has(v.video_id))) {
                  handleDeselectAll();
                } else {
                  handleSelectAll();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 flex-shrink-0 rounded border dark:bg-gray-700 dark:checked:bg-primary"
            />
            <span className="text-md text-gray-500 dark:text-gray-400 font-medium">
              Select All
            </span>
            {checkedVideos.size > 0 && (
              <span className="text-md text-gray-500 dark:text-gray-400 font-medium">
                ({checkedVideos.size} video{checkedVideos.size > 1 ? 's' : ''})
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {checkedVideos.size > 0 && !hideCategoryActions ? (
              <div className="flex items-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToNewCategory();
                  }}
                  className="bg-lightModeBorder dark:bg-darkModeCompliment dark:hover:bg-[#3D3D3D] flex rounded hover:bg-[#FCFCFC] items-center gap-1 px-2 py-1 text-xxs font-medium text-gray-700 dark:text-gray-200 rounded-md transition-colors"
                >
                  <FiPlus size={14} />
                  <span>Add New Category</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveVideos();
                  }}
                  className="bg-lightModeBorder dark:bg-darkModeCompliment hover:bg-[#FCFCFC] dark:hover:bg-[#3D3D3D] flex rounded items-center gap-1 px-2 py-1 text-xxs font-medium text-gray-700 dark:text-gray-200 rounded-md transition-colors"
                >
                  <PiFolderSimpleLight size={14} />
                  <span>Move</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveVideos();
                  }}
                  className="bg-lightModeBorder dark:bg-darkModeCompliment hover:bg-[#FCFCFC] dark:hover:bg-[#3D3D3D] flex rounded items-center gap-1 px-2 py-1 text-xxs font-medium text-gray-700 dark:text-gray-200 rounded-md transition-colors"
                >
                  <LuTrash size={14} />
                  <span>Remove</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center">
                <div className="relative sort-dropdown">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSortToggle();
                    }}
                    className="bg-offWhite dark:bg-alternateBlack flex rounded items-center gap-1 px-3 py-1 text-xxs font-medium text-gray-700 dark:text-gray-200 transition-colors"
                  >
                    <LuArrowUpDown size={14} />
                    <span>Sort</span>
                  </button>

                  {showSortDropdown && (
                    <div className="flex flex-col justify-start pb-1 py-4 absolute top-full mt-1 right-0 bg-white dark:bg-darkModeCompliment rounded-md shadow-lg z-50 min-w-[130px]">
                      {/* Sort By */}
                      <div className="px-2">
                        <div className="mb-2">
                          <h4 className="px-2 text-xs text-gray-600 dark:text-gray-300 font-medium">
                            Sort By
                          </h4>
                        </div>
                        <div className="gap-2 ">
                          {(
                            [
                              'Oldest',
                              'Newest',
                              'A-Z',
                              'Z-A',
                              'Largest',
                              'Smallest',
                            ] as SortBy[]
                          ).map((option) => (
                            <button
                              key={option}
                              className={`mt-1 pl-2 flex w-full rounded ${
                                option === sortBy
                                  ? 'bg-yellow-200 dark:bg-yellow-800'
                                  : 'hover:bg-[#D9D9D980] dark:hover:bg-[#3D3D3D]'
                              }`}
                              onClick={() => applySort(option)}
                            >
                              <span className="capitalize text-xs py-1 pl-2">
                                {option}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="ml-5 px-1">
                        <button onClick={clearPendingSort} className="py-1">
                          <span className="text-xs text-[#930800] dark:text-red-400">
                            Reset
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative filter-dropdown">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterToggle();
                    }}
                    className={filterButtonClasses}
                  >
                    <LuFilter size={14} />
                    <span>Filter</span>
                  </button>

                  {/* Filter Dropdown */}
                  {showFilterDropdown && (
                    <div className="pb-1 p-2 absolute top-full mt-1 right-0 bg-white dark:bg-darkModeCompliment rounded-md shadow-lg z-50 min-w-[200px] max-h-[450px] overflow-y-auto">
                      <div className="">
                        <div className="flex items-center justify-between mb-3 border-b border-titleBarBorder dark:border-gray-600 pb-3">
                          <div className="px-3 pt-3">
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
                                    isExtensionOpen ? 'rotate-0' : '-rotate-90'
                                  }`}
                                />
                              </button>
                            </div>
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
                                onClick={() => setIsSourceOpen((prev) => !prev)}
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
                            className="py-1 bg-primary text-white hover:bg-gray-100 dark:hover:bg-primaryDarkHover rounded-md flex gap-2 text-sm flex-1 items-center justify-center hover:text-black dark:hover:text-white"
                          >
                            <span className="text-xs">Apply</span>
                          </button>
                          <button
                            onClick={clearPendingFilters}
                            className="py-1 items-center justify-center bg-white dark:bg-darkModeCompliment text-primary"
                          >
                            <span className="text-primary text-xs">Clear</span>
                          </button>
                        </div>

                        {filterOptions.ext.length === 0 &&
                          filterOptions.source.length === 0 &&
                          filterOptions.category.length === 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 px-3">
                              No filter options available
                            </p>
                          )}
                      </div>
                    </div>
                  )}
                </div>
                {onExpandedDetailsToggle && (
                  <div>
                    <button
                      className="bg-offWhite dark:bg-alternateBlack flex rounded items-center gap-1 px-3 py-1 text-xxs font-medium text-gray-700 dark:text-gray-200 rounded-md transition-colors"
                      onClick={onExpandedDetailsToggle}
                    >
                      <AiOutlineExpandAlt size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Video Grid */}
        <div
          className={`px-5 ${
            isFolderView && isShowSidePlayer
              ? `grid auto-rows grid-cols-${gridColsWithSidePlayer} gap-2 my-2`
              : isFolderView && !isShowSidePlayer
              ? `grid auto-rows grid-cols-${gridColsWithoutSidePlayer} gap-2 my-2`
              : ''
          }`}
        >
          {sortedVideos.map((video, index) => {
            // Ensure videoTitle is valid and not empty
            const safeVideoTitle = video.video_title || `Video ${index + 1}`;

            // Find the corresponding download data
            const downloadData = finishedDownloads.find(
              (download) => download.id === video.video_id,
            );

            // Debug logging for troubleshooting
            if (!video.video_title || video.video_title.trim() === '') {
              console.warn(
                `Empty videoTitle at index ${index} in ${debugContext}:`,
                {
                  originalVideoTitle: video,
                  safeVideoTitle,
                  debugContext,
                  downloadData,
                },
              );
            }

            // If no downloadData found, skip rendering this item
            if (!downloadData) {
              console.warn(
                `No matching download found for video: ${safeVideoTitle} in ${debugContext}`,
              );
              return null;
            }

            return (
              <VideoItemRenderer
                key={video.video_id}
                video={video}
                downloadData={downloadData}
                isFolderView={isFolderView}
                isShowSidePlayer={isShowSidePlayer}
                checkedVideos={checkedVideos}
                finishedDownloads={finishedDownloads}
                activeTab={activeTab}
                groups={groups}
                categoryDropdown={categoryDropdown}
                isExpandedDetails={isExpandedDetails}
                onVideoCheck={handleVideoCheck}
                onRowClick={onRowClick}
                onRightClick={onRightClick}
                onCategoryDropdownClick={onCategoryDropdownClick}
                onCloseCategoryDropdown={onCloseCategoryDropdown}
                onViewFile={onViewFile}
                selectedDownload={selectedDownload}
              />
            );
          })}
        </div>
      </div>

      <MoveVideosModal
        show={showMoveModal}
        activeTab={activeTab}
        availableCategories={(() => {
          // Get categories from groups (excluding activeTab)
          const groupCategories = groups
            ? Object.keys(groups).filter(
                (categoryName) => categoryName !== activeTab,
              )
            : [];

          // Get My Categories (merged categories) that aren't already in groups
          const myCategories = availableCategories.filter(
            (categoryName) =>
              categoryName !== activeTab &&
              !groupCategories.includes(categoryName),
          );

          // Combine and deduplicate, attaching video counts
          return [
            ...groupCategories.map((name) => ({
              name,
              count: groups?.[name]?.length ?? 0,
            })),
            ...myCategories.map((name) => ({ name, count: 0 })),
          ];
        })()}
        onConfirmMove={confirmMoveVideos}
        onClose={() => setShowMoveModal(false)}
        checkedVideoCount={checkedVideos.size}
      />

      {/* New Category Modal */}
      {showNewCategoryModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNewCategoryModal(false);
              setNewCategoryName('');
            }
          }}
        >
          <div
            className="bg-white dark:bg-[#3D3D3D] rounded-lg border border-darkModeCompliment p-6 max-w-md w-full mx-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-primaryLight dark:bg-primaryDark text-primary rounded-md p-3">
                  <FiPlus size={20} />
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">
                    Add to New Category
                  </h3>
                  <p>{checkedVideos.size} video(s) selected</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowNewCategoryModal(false);
                  setNewCategoryName('');
                }}
                className="hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <IoMdClose size={16} />
              </button>
            </div>

            {/* Input */}
            <div className="mb-4">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmAddToNewCategory();
                  } else if (e.key === 'Escape') {
                    setShowNewCategoryModal(false);
                    setNewCategoryName('');
                  }
                }}
                className="w-full px-3 py-2 rounded-md
                           focus:outline-none bg-primaryInput dark:bg-[#474747]"
              />
              <h1 className="text-xs italic ml-1 mt-2">
                Selected videos will be added to newly created category
              </h1>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-3 -mx-6 -mb-6 px-4 py-3 ">
              <button
                onClick={() => {
                  setShowNewCategoryModal(false);
                  setNewCategoryName('');
                }}
                className="px-4 py-2 border rounded-md hover:bg-gray-50 flex justify-center items-center
                           dark:border-secondarkDarkHover dark:hover:bg-secondarkDarkHover dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddToNewCategory}
                disabled={!newCategoryName.trim()}
                className="px-3 py-2 bg-primary text-white rounded-md flex justify-center items-center
                           hover:bg-primary/90 dark:bg-primary dark:hover:bg-primaryDarkHover disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Add to New
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {showRemoveConfirmation && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            // Only close if clicking the overlay background
            if (e.target === e.currentTarget) {
              e.stopPropagation();
              setShowRemoveConfirmation(false);
            }
          }}
        >
          <div
            className="bg-white dark:bg-[#3D3D3D] rounded-lg border border-darkModeCompliment p-6 max-w-md w-full mx-2"
            onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-primaryLight dark:bg-primaryDark text-primary rounded-md p-3">
                  <LuTrash size={20} />
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">
                    Remove Videos
                  </h3>
                  <p>{checkedVideos.size} video(s) selected</p>
                </div>
              </div>
              <button
                onClick={() => setShowRemoveConfirmation(false)}
                className="hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <IoMdClose size={16} />
              </button>
            </div>

            {/* Main message */}
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              You are about to remove video(s) from{' '}
              <span className="font-bold">{activeTab}</span> category. This will
              cause some videos to be reclassified as{' '}
              <span className="font-bold">Uncategorized</span>.
            </p>

            {/* Action buttons */}
            <div className="flex justify-end space-x-3 -mx-6 -mb-6 px-4 py-3">
              <button
                onClick={() => setShowRemoveConfirmation(false)}
                className="px-4 py-2 border rounded-md hover:bg-gray-50 flex justify-center items-center
                dark:border-secondarkDarkHover dark:hover:bg-secondarkDarkHover dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveVideos}
                className="px-3 py-2 bg-primary text-white rounded-md flex justify-center items-center
                hover:bg-primary/90 dark:bg-primary dark:hover:bg-primaryDarkHover disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SelectedCategoryTools;
