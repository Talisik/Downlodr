/**
 * Permanent Category Sidebar for OrganizationTable
 * Displays categories in a structured layout similar to the provided design
 */

import { useComponentTriggerStore } from '../hooks/useComponentTrigger';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import {
  getDraggedVideoIdsFromMemory,
  getDraggedVideoPayloadFromMemory,
  parseDraggedVideoPayload,
  VIDEO_IDS_DRAG_MIME,
} from '../utils/dragDrop';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BiLayer } from 'react-icons/bi';
import { FiPlus, FiSearch } from 'react-icons/fi';
import { GoChevronDown, GoChevronUp } from 'react-icons/go';
import { PiFolderSimpleLight, PiFoldersLight } from 'react-icons/pi';
import AllVideosSearchInput from './AllVideosSearchInput';
import MyCategoriesComponent from './MyCategoriesComponent';
import OrganizationSideSearchBar from './OrganizationSideSearchBar';
import type { VideoItem } from './organizationTypes';

type FinishedDownload = ReturnType<
  typeof useDownloadStore.getState
>['finishedDownloads'][0];

interface PermanentCategorySidebarProps {
  groups: Record<string, VideoItem[]>;
  activeTab: string;
  setActiveTab: (tabName: string | null) => void;
  setIsCategorySelected: (isCategorySelected: boolean) => void;
  onTabChange: (tabName: string) => void;
  onAddNewCategory: () => void;
  onCategoryDotsClick?: (e: React.MouseEvent, categoryName: string) => void;
  inlineRenamingCategory?: string | null;
  inlineRenameValue?: string;
  onInlineRenameChange?: (value: string) => void;
  onInlineRenameConfirm?: () => void;
  onInlineRenameCancel?: () => void;
  onCategoryDoubleClick?: (categoryName: string) => void;
  onCategoryKeyDown?: (e: React.KeyboardEvent, categoryName: string) => void;
  collapsed?: boolean;
  toggleCollapse?: () => void;
  isFolderView: boolean;
  setIsFolderView: (isFolderView: boolean) => void;
  viewedGroup: string | null;
  setViewedGroup: (groupName: string | null) => void;
  finishedDownloads: FinishedDownload[];
  onGroupClick: (groupName: string, videos: VideoItem[]) => void;
  // All Videos search state
  isAllVideosSearchMode?: boolean;
  allVideosSearchQuery?: string;
  onAllVideosSearchQueryChange?: (query: string) => void;
  onAllVideosSearchSubmit?: (query: string) => void;
  onAllVideosSearchCancel?: () => void;
  onAllVideosSearchClick?: () => void;
  newVideosInMyCategories?: Record<string, number>;
  myCategoryGroups?: Record<string, VideoItem[]>;
  onDropVideosToCategory?: (
    videoIds: string[],
    targetCategory: string,
    sourceCategory?: string,
  ) => void;
  setShowSidePlayer: (showSidePlayer: boolean) => void;
  isShowSidePlayer: boolean;
}

const PermanentCategorySidebar: React.FC<PermanentCategorySidebarProps> = ({
  groups,
  activeTab,
  setActiveTab,
  setIsCategorySelected,
  onTabChange,
  onAddNewCategory,
  onCategoryDotsClick,
  onGroupClick,
  inlineRenamingCategory,
  inlineRenameValue = '',
  onInlineRenameChange,
  onInlineRenameConfirm,
  onInlineRenameCancel,
  onCategoryDoubleClick,
  onCategoryKeyDown,
  collapsed,
  toggleCollapse,
  isFolderView,
  setIsFolderView,
  viewedGroup,
  setViewedGroup,
  finishedDownloads,
  // All Videos search props
  isAllVideosSearchMode = false,
  allVideosSearchQuery = '',
  onAllVideosSearchQueryChange,
  setShowSidePlayer,
  onAllVideosSearchSubmit,
  onAllVideosSearchCancel,
  onAllVideosSearchClick,
  newVideosInMyCategories = {},
  myCategoryGroups,
  isShowSidePlayer,
  onDropVideosToCategory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [suggestedCategoriesCollapsed, setSuggestedCategoriesCollapsed] =
    useState(false);
  const [myCategoriesCollapsed, setMyCategoriesCollapsed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { isSmartOrganizeSearchOpen, setIsSmartOrganizeSearchOpen } =
    useComponentTriggerStore();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return groups;
    }
    const query = searchQuery.toLowerCase().trim();
    const filtered: Record<string, VideoItem[]> = {};

    Object.keys(groups).forEach((groupName) => {
      const matchingVideos = groups[groupName].filter(
        (video) =>
          video.video_title.toLowerCase().includes(query) ||
          groupName.toLowerCase().includes(query),
      );

      if (matchingVideos.length > 0) {
        filtered[groupName] = matchingVideos;
      }
    });
    return filtered;
  }, [groups, searchQuery]);

  const [allSearchQuery, setAllSearchQuery] = useState<
    { searchQuery: string }[]
  >([]);
  const [inputValue, setInputValue] = useState('');
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

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
    const existingVideos = groups[categoryName] || [];
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
    const categoryVideos = groups[categoryName] || [];
    onGroupClick?.(categoryName, categoryVideos);
  };

  // Handle click outside search div to close search mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      setSearchQuery(inputValue);
    }
    if (
      e.key === 'Backspace' &&
      inputValue === '' &&
      allSearchQuery.length > 0
    ) {
      // Remove last pill on backspace
      setAllSearchQuery((prev) => prev.slice(0, prev.length - 1));
    }
  };

  const handleSearchClick = () => {
    // Normal search flow for other views
    setIsSearchMode(true);
    setSearchQuery('');
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const handleAllVideosSearchClick = () => {
    // Trigger the search mode activation in parent component
    if (onAllVideosSearchClick) {
      onAllVideosSearchClick();
    }
  };

  const handleSearchExit = () => {
    setIsSearchMode(false);
    setSearchQuery('');
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') handleSearchExit();
    if (e.key === 'Enter') {
      const filteredKeys = Object.keys(filteredGroups);
      if (filteredKeys.length === 1) {
        onTabChange(filteredKeys[0]);
        handleSearchExit();
      }
    }
  };

  const handleInlineRenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInlineRenameChange?.(e.target.value);
  };

  const handleInlineRenameKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'Enter') onInlineRenameConfirm?.();
    else if (e.key === 'Escape') onInlineRenameCancel?.();
  };

  const categorizedGroups = useMemo(
    () =>
      Object.keys(filteredGroups).filter((name) => name !== 'Uncategorized'),
    [filteredGroups],
  );

  return (
    <nav
      className="h-full flex flex-col overflow-hidden transition-all duration-300 w-[220px] relative rounded-lg"
      aria-label="Category Tabs"
    >
      <div className="h-full overflow-x-hidden overflow-y-auto scrollbar-hide">
        <div className="py-2 px-3 mt-2 flex flex-col gap-2 pb-8">
          {/* Add New Button */}
          <button
            className="flex flex-nowrap items-center h-7 rounded dark:text-gray-200 hover:bg-[#F2F2F2] dark:hover:bg-darkModeCompliment w-full"
            onClick={() => {
              setShowSidePlayer(false);
              onAddNewCategory();
            }}
          >
            <span className="flex items-center justify-center w-7 flex-shrink-0">
              <FiPlus size={14} />
            </span>
            <span className="text-[12.5px] whitespace-nowrap overflow-hidden min-w-0 truncate">
              Add New Category
            </span>
          </button>
          {/* Search and Categories Header */}
          {isSearchMode ||
          (isAllVideosSearchMode && activeTab === 'All Videos') ? (
            <div ref={searchContainerRef} className="w-full max-w-full px-1">
              {isAllVideosSearchMode && activeTab === 'All Videos' ? (
                onAllVideosSearchQueryChange &&
                onAllVideosSearchSubmit &&
                onAllVideosSearchCancel ? (
                  <AllVideosSearchInput
                    searchQuery={allVideosSearchQuery}
                    onSearchQueryChange={onAllVideosSearchQueryChange}
                    onSearchSubmit={onAllVideosSearchSubmit}
                    onCancel={onAllVideosSearchCancel}
                    placeholder="Search all videos..."
                  />
                ) : null
              ) : (
                <OrganizationSideSearchBar
                  groups={filteredGroups}
                  activeTab={activeTab}
                  onTabChangeHandler={onTabChange}
                />
              )}
            </div>
          ) : (
            <button
              className="flex flex-nowrap items-center h-7 rounded dark:text-gray-200 hover:bg-[#F2F2F2] dark:hover:bg-darkModeCompliment w-full"
              onClick={() => {
                setShowSidePlayer(false);
                if (activeTab === 'All Videos') {
                  handleAllVideosSearchClick();
                } else {
                  handleSearchClick();
                }
              }}
            >
              <span className="flex items-center justify-center w-7 flex-shrink-0">
                <FiSearch size={13} />
              </span>
              <span className="text-[12.5px] whitespace-nowrap overflow-hidden min-w-0 truncate">
                Search
              </span>
            </button>
          )}
          {!isSearchMode && (
            <>
              {/* All Videos Button */}
              <button
                className="flex flex-nowrap items-center h-7 rounded dark:text-gray-200 hover:bg-[#F2F2F2] dark:hover:bg-darkModeCompliment w-full"
                onClick={() => {
                  setShowSidePlayer(false);
                  setIsSmartOrganizeSearchOpen(true);
                  onTabChange('All Videos');
                  setShowSidePlayer(false);
                  if (isSearchMode) handleSearchExit();
                }}
              >
                <span className="flex items-center justify-center w-7 flex-shrink-0">
                  <PiFoldersLight size={15} />
                </span>
                <span className="text-[12.5px] whitespace-nowrap overflow-hidden min-w-0 truncate">
                  All Videos
                </span>
              </button>

              <div className="flex flex-col gap-[6px]">
                {/* Suggested Categories Header for Folder View */}
                <div className="w-full flex items-center h-7 hover:bg-[#F2F2F2] dark:hover:bg-darkModeCompliment rounded dark:text-gray-200">
                  <button
                    className="flex items-center flex-1 min-w-0 h-full"
                    onClick={() => {
                      setViewedGroup(null);
                      setActiveTab(null);
                      setIsFolderView(true);
                      setIsCategorySelected(false);
                    }}
                  >
                    <span className="flex items-center justify-center w-7 flex-shrink-0">
                      <PiFolderSimpleLight size={15} />
                    </span>
                    <span className="text-[12.5px] whitespace-nowrap overflow-hidden min-w-0 truncate">
                      Suggested Categories
                    </span>
                  </button>
                  <button
                    className="flex items-center justify-center flex-shrink-0 w-7 h-7"
                    onClick={() =>
                      setSuggestedCategoriesCollapsed(
                        !suggestedCategoriesCollapsed,
                      )
                    }
                  >
                    {suggestedCategoriesCollapsed ? (
                      <GoChevronUp size={14} />
                    ) : (
                      <GoChevronDown size={14} />
                    )}
                  </button>
                </div>
                {/* Show organization groups */}
                {filteredGroups['Uncategorized'] && (
                  <div
                    className={`text-primary flex flex-nowrap items-center h-7 rounded ${
                      activeTab === 'Uncategorized'
                        ? 'bg-[#F2F2F2] dark:bg-darkModeCompliment'
                        : 'hover:bg-[#F2F2F2] dark:hover:bg-darkModeCompliment'
                    } dark:text-gray-200 ${
                      dragOverCategory === 'Uncategorized'
                        ? 'bg-primary/10 dark:bg-primary/20 ring-1 ring-primary/60'
                        : ''
                    }`}
                    onDragEnter={(event) =>
                      handleDragEnter(event, 'Uncategorized')
                    }
                    onDragLeave={(event) =>
                      handleDragLeave(event, 'Uncategorized')
                    }
                    onDragOver={(event) =>
                      handleDragOver(event, 'Uncategorized')
                    }
                    onDrop={(event) => handleDrop(event, 'Uncategorized')}
                  >
                    <button
                      onClick={() => {
                        setIsSmartOrganizeSearchOpen(false);
                        onTabChange('Uncategorized');
                        onGroupClick(
                          'Uncategorized',
                          filteredGroups['Uncategorized'],
                        );
                        if (isSearchMode) handleSearchExit();
                      }}
                      className="flex items-center flex-1 min-w-0 h-full"
                      tabIndex={0}
                    >
                      <span className="flex items-center justify-center w-7 flex-shrink-0" />
                      <span className="text-primary dark:text-primaryDarkText text-[12.5px] truncate font-[500]">
                        Uncategorized
                      </span>
                    </button>

                    <div className="flex items-center gap-1 flex-shrink-0 mr-3">
                      <span className="text-xxxs text-gray-500 dark:text-gray-400">
                        {filteredGroups['Uncategorized']?.length || 0}
                      </span>
                    </div>
                  </div>
                )}
                {!suggestedCategoriesCollapsed && (
                  <>
                    {categorizedGroups.map((groupName) => (
                      <div
                        key={`category-${groupName}`}
                        className={`flex flex-nowrap items-center h-7 rounded ${
                          activeTab === groupName
                            ? 'bg-[#F2F2F2] dark:bg-darkModeCompliment'
                            : 'hover:bg-[#F2F2F2] dark:hover:bg-darkModeCompliment'
                        } dark:text-gray-200 ${
                          dragOverCategory === groupName
                            ? 'bg-primary/10 dark:bg-primary/20 ring-1 ring-primary/60'
                            : ''
                        }`}
                        onDragEnter={(event) => {
                          setShowSidePlayer(false);
                          handleDragEnter(event, groupName);
                        }}
                        onDragLeave={(event) => {
                          setShowSidePlayer(false);
                          handleDragLeave(event, groupName);
                        }}
                        onDragOver={(event) => {
                          setShowSidePlayer(false);
                          handleDragOver(event, groupName);
                        }}
                        onDrop={(event) => {
                          setShowSidePlayer(false);
                          handleDrop(event, groupName);
                        }}
                      >
                        {inlineRenamingCategory === groupName ? (
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center flex-1 min-w-0">
                              <span className="flex items-center justify-center w-7 flex-shrink-0">
                                <BiLayer
                                  size={16}
                                  className="text-yellow-500"
                                />
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
                              ({filteredGroups[groupName]?.length || 0})
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full h-full">
                            <button
                              onClick={() => {
                                setShowSidePlayer(false);
                                setIsSmartOrganizeSearchOpen(false);
                                onTabChange(groupName);
                                onGroupClick(
                                  groupName,
                                  filteredGroups[groupName],
                                );
                                if (isSearchMode) handleSearchExit();
                              }}
                              onKeyDown={(e) =>
                                onCategoryKeyDown?.(e, groupName)
                              }
                              className="flex items-center flex-1 min-w-0 h-full text-left"
                              tabIndex={0}
                            >
                              <span className="flex items-center justify-center w-7 flex-shrink-0" />
                              <span className="text-[12.5px] font-[500] truncate">
                                {groupName.length > 18
                                  ? groupName.slice(0, 18) + '...'
                                  : groupName}
                              </span>
                            </button>
                            <div className="flex items-center gap-1 flex-shrink-0 mr-3">
                              <span className="text-xxxs text-gray-500 dark:text-gray-400">
                                {filteredGroups[groupName]?.length || 0}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* My Categories - always render, component handles its own visibility */}
              <MyCategoriesComponent
                isShowSidePlayer={isShowSidePlayer}
                setShowSidePlayer={setShowSidePlayer}
                activeTab={activeTab}
                onTabChange={(tabName) => {
                  setIsSmartOrganizeSearchOpen(false);
                  onTabChange(tabName);
                }}
                onCategoryDotsClick={onCategoryDotsClick}
                inlineRenamingCategory={inlineRenamingCategory}
                inlineRenameValue={inlineRenameValue}
                onInlineRenameChange={onInlineRenameChange}
                onInlineRenameConfirm={onInlineRenameConfirm}
                onInlineRenameCancel={onInlineRenameCancel}
                onCategoryDoubleClick={onCategoryDoubleClick}
                onCategoryKeyDown={onCategoryKeyDown}
                onGroupClick={onGroupClick}
                isSearchMode={isSearchMode}
                handleSearchExit={handleSearchExit}
                myCategoriesCollapsed={myCategoriesCollapsed}
                setMyCategoriesCollapsed={setMyCategoriesCollapsed}
                newVideosInMyCategories={newVideosInMyCategories}
                myCategoryGroups={myCategoryGroups}
                onDropVideosToCategory={onDropVideosToCategory}
              />
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default PermanentCategorySidebar;
