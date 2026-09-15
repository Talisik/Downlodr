/**
 * A custom React component for tabbed navigation
 * Displays scrollable tabs with categories, following the Navigation component patterns
 * Features horizontal scrolling, inline renaming, and dropdown overflow menu
 *
 * @param groups - Object containing category groups and their items
 * @param activeTab - Currently active tab name
 * @param onTabChange - Callback when tab is changed
 * @param onAddNewCategory - Callback when "Add New" is clicked
 * @param onCategoryRename - Callback when category is renamed
 * @param onCategoryDotsClick - Callback when category dots menu is clicked
 * @param className - Additional CSS classes
 * @returns JSX.Element - The rendered tabs navigation component
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiPlus,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';
import { TbStack2 } from 'react-icons/tb';
import { BiLayer } from 'react-icons/bi';
import TooltipWrapper from '../TooltipWrapper';

interface TabsNavigationProps {
  groups: Record<string, unknown[]>;
  activeTab: string;
  onTabChange: (tabName: string) => void;
  onAddNewCategory: () => void;
  onCategoryRename?: (oldName: string, newName: string) => void;
  onCategoryDotsClick?: (e: React.MouseEvent, categoryName: string) => void;
  className?: string;
  // Inline renaming props
  inlineRenamingCategory?: string | null;
  inlineRenameValue?: string;
  onInlineRenameChange?: (value: string) => void;
  onInlineRenameConfirm?: () => void;
  onInlineRenameCancel?: () => void;
  onCategoryDoubleClick?: (categoryName: string) => void;
  onCategoryKeyDown?: (e: React.KeyboardEvent, categoryName: string) => void;
  // Toggle props
  collapsed?: boolean;
  toggleCollapse?: () => void;
}

const TabsNavigation: React.FC<TabsNavigationProps> = ({
  groups,
  activeTab,
  onTabChange,
  onAddNewCategory,
  onCategoryDotsClick,
  className = '',
  inlineRenamingCategory,
  inlineRenameValue = '',
  onInlineRenameChange,
  onInlineRenameConfirm,
  onInlineRenameCancel,
  onCategoryDoubleClick,
  onCategoryKeyDown,
  collapsed,
  toggleCollapse,
}) => {
  // Scrolling state
  const [showLeftChevron, setShowLeftChevron] = useState(false);
  const [showRightChevron, setShowRightChevron] = useState(false);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Dropdown state
  const [open, setOpen] = useState(false);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);

  // Search state
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Check scroll position to show/hide chevrons
  const checkScrollPosition = useCallback(() => {
    if (tabsContainerRef.current) {
      const container = tabsContainerRef.current;
      const scrollTop = container.scrollTop;
      const maxScrollTop = container.scrollHeight - container.clientHeight;

      const newShowLeft = scrollTop > 5; // "Left" chevron now means "Up"
      const newShowRight = scrollTop < maxScrollTop - 5; // "Right" chevron now means "Down"

      if (newShowLeft !== showLeftChevron) {
        setShowLeftChevron(newShowLeft);
      }
      if (newShowRight !== showRightChevron) {
        setShowRightChevron(newShowRight);
      }
    }
  }, [showLeftChevron, showRightChevron]);

  // Handle dropdown selection
  const handleSelect = (groupName: string) => {
    onTabChange(groupName);
    setOpen(false);
    if (isSearchMode) {
      handleSearchExit();
    }
  };

  // Filter groups based on search query
  const filteredGroups = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return groups;
    }

    const filtered: Record<string, unknown[]> = {};
    const query = searchQuery.toLowerCase().trim();

    Object.keys(groups).forEach((groupName) => {
      if (groupName.toLowerCase().includes(query)) {
        filtered[groupName] = groups[groupName];
      }
    });

    return filtered;
  }, [groups, searchQuery]);

  // Handle search mode activation
  const handleSearchClick = () => {
    setIsSearchMode(true);
    setSearchQuery('');
    // Focus the input after state update
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  };

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle search exit
  const handleSearchExit = () => {
    setIsSearchMode(false);
    setSearchQuery('');
  };

  // Handle search input key events
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleSearchExit();
    } else if (e.key === 'Enter') {
      // If there's exactly one filtered result, navigate to it
      const filteredKeys = Object.keys(filteredGroups);
      if (filteredKeys.length === 1) {
        onTabChange(filteredKeys[0]);
        handleSearchExit();
      }
    }
  };

  // Handle inline rename input changes
  const handleInlineRenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInlineRenameChange?.(e.target.value);
  };

  // Handle inline rename key events
  const handleInlineRenameKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'Enter') {
      onInlineRenameConfirm?.();
    } else if (e.key === 'Escape') {
      onInlineRenameCancel?.();
    }
  };

  // Setup scroll listener
  useEffect(() => {
    checkScrollPosition();
    const container = tabsContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollPosition, {
        passive: true,
      });
      return () => container.removeEventListener('scroll', checkScrollPosition);
    }
  }, [checkScrollPosition]);

  // Close dropdown and search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Handle dropdown click outside
      if (
        dropdownMenuRef.current &&
        !dropdownMenuRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }

      // Handle search click outside
      if (
        isSearchMode &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node) &&
        !tabsContainerRef.current?.contains(event.target as Node)
      ) {
        handleSearchExit();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSearchMode]);

  if (Object.keys(groups).length === 0) {
    return null;
  }

  return (
    <div
      className={`h-full flex flex-col w-full ${className} transition-all duration-300 ${
        collapsed ? 'w-[70px]' : ''
      } relative overflow-x-hidden`}
    >
      <div className="flex-1 relative pt-6 pb-2">
        {/* Scrollable Tabs Container */}
        <div
          ref={tabsContainerRef}
          onScroll={checkScrollPosition}
          className="h-full overflow-y-auto scrollbar-hide"
        >
          <nav
            className="flex flex-col space-y-[5px]"
            aria-label="Category Tabs"
          >
            <div className={collapsed ? 'flex flex-col items-center' : ''}>
              {/* Add New Button */}
              <TooltipWrapper
                content={collapsed ? 'Add New' : null}
                side="left"
              >
                <button
                  className={`nav-link flex items-center ${
                    collapsed
                      ? 'justify-center p-2 hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200 mx-1'
                      : 'ml-2 hover:bg-[#F2F2F2] dark:hover:bg-darkModeCompliment w-full max-w-full'
                  } text-primary dark:text-primary transition-colors`}
                  onClick={onAddNewCategory}
                >
                  <FiPlus size={16} className="text-primary flex-shrink-0" />
                  {!collapsed && (
                    <span className="ml-2 text-[13.5px] font-semibold truncate">
                      Add New
                    </span>
                  )}
                </button>
              </TooltipWrapper>

              {!collapsed && (
                <div
                  ref={searchContainerRef}
                  className="mt-4 pl-5 pr-3 flex items-center gap-1 mb-3 w-full max-w-full"
                >
                  {isSearchMode ? (
                    // Search Input Mode
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <BiLayer size={16} className="flex-shrink-0" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Search categories..."
                        className="flex-1 bg-transparent border-b border-current text-sm outline-none min-w-0 font-bold placeholder:font-normal placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        autoComplete="off"
                      />
                    </div>
                  ) : (
                    // Normal Categories Header
                    <>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <BiLayer size={16} className="flex-shrink-0" />
                        <h1 className="text-sm font-bold truncate">
                          Categories
                        </h1>
                      </div>
                      <button
                        onClick={handleSearchClick}
                        className="flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Search categories"
                      >
                        <FiSearch size={16} />
                      </button>
                    </>
                  )}
                </div>
              )}

              {collapsed && (
                <TooltipWrapper content="Categories" side="left">
                  <div
                    className="p-2 hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200 mt-4 cursor-pointer"
                    onClick={() => {
                      toggleCollapse?.();
                    }}
                  >
                    <BiLayer
                      size={16}
                      className="text-[#16161E] dark:text-white"
                      title="Categories"
                    />
                  </div>
                </TooltipWrapper>
              )}
            </div>
            {/* Uncategorized Tab - Only show when not collapsed */}
            {!collapsed && filteredGroups['Uncategorized'] && (
              <TooltipWrapper content="Uncategorized items" side="top">
                <div
                  className={`nav-link flex items-center ml-2 mr-2 transition-colors py-1 w-full max-w-full ${
                    activeTab === 'Uncategorized'
                      ? 'bg-[#F2F2F2] dark:bg-darkModeCompliment'
                      : 'hover:bg-[#F2F2F2] dark:hover:bg-darkModeCompliment'
                  } dark:text-gray-200`}
                >
                  <button
                    onClick={() => {
                      onTabChange('Uncategorized');
                      if (isSearchMode) {
                        handleSearchExit();
                      }
                    }}
                    className="flex items-center flex-1 min-w-0 mr-2"
                    tabIndex={0}
                    title="Uncategorized items"
                  >
                    <span className="ml-2 text-[12px] truncate font-semibold text-primary">
                      Uncategorized
                    </span>
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xxxs text-gray-500 dark:text-gray-400">
                      {filteredGroups['Uncategorized'].length || 0}
                    </span>
                  </div>
                </div>
              </TooltipWrapper>
            )}

            {/* Regular Category Tabs - Only show when not collapsed */}
            {!collapsed &&
              Object.keys(filteredGroups)
                .filter((groupName) => groupName !== 'Uncategorized')
                .map((groupName) => (
                  <div
                    key={`category-${groupName}`}
                    className={`nav-link flex items-center ml-2 mr-2 transition-colors py-1 w-full max-w-full ${
                      activeTab === groupName
                        ? 'bg-[#F2F2F2] dark:bg-darkModeCompliment'
                        : 'hover:bg-[#F2F2F2] dark:hover:bg-darkModeCompliment'
                    } dark:text-gray-200 hover:bg-[#F2F2F2] dark:hover:bg-darkModeCompliment`}
                  >
                    {inlineRenamingCategory === groupName ? (
                      // Inline Rename Input
                      <>
                        <div className="flex items-center flex-1 min-w-0">
                          <BiLayer
                            size={16}
                            className="text-yellow-500 flex-shrink-0"
                          />
                          <input
                            type="text"
                            value={inlineRenameValue}
                            onChange={handleInlineRenameChange}
                            onBlur={onInlineRenameConfirm}
                            onKeyDown={handleInlineRenameKeyDown}
                            className="ml-2 flex-1 bg-transparent border-b border-current text-[12px] outline-none min-w-0"
                            autoFocus
                            onFocus={(e) => e.target.select()}
                            maxLength={50}
                          />
                        </div>
                        <span className="text-[12px] text-gray-500 dark:text-gray-400 flex-shrink-0">
                          ({filteredGroups[groupName]?.length || 0})
                        </span>
                      </>
                    ) : (
                      // Normal Category Display
                      <>
                        <button
                          onClick={() => {
                            onTabChange(groupName);
                            if (isSearchMode) {
                              handleSearchExit();
                            }
                          }}
                          onDoubleClick={() =>
                            onCategoryDoubleClick?.(groupName)
                          }
                          onKeyDown={(e) => onCategoryKeyDown?.(e, groupName)}
                          className="flex items-center flex-1 min-w-0 mr-2"
                          tabIndex={0}
                          title={`Double-click to rename or press F2. Current name: ${groupName}`}
                        >
                          <span className="ml-2 text-[12px] truncate font-semibold">
                            {groupName}
                          </span>
                        </button>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-xxxs text-gray-500 dark:text-gray-400">
                            {filteredGroups[groupName]?.length || 0}
                          </span>
                          {/* 
                          {onCategoryDotsClick && (
                            <TooltipWrapper content="Category options" side="top">
                              <HiDotsVertical
                              className="cursor-pointer hover:text-primary transition-colors"
                              size={14}
                              onClick={(e) => {
                                e.stopPropagation();
                                onCategoryDotsClick(e, groupName);
                              }}
                            />
                          </TooltipWrapper>
                        )}
                                                 */}
                        </div>
                      </>
                    )}
                  </div>
                ))}
          </nav>
        </div>

        {/* Overflow Dropdown Button - Only show when not collapsed */}
        {!collapsed && (showRightChevron || showLeftChevron) && (
          <div className="absolute bottom-2 right-4">
            <TooltipWrapper content="View all categories" side="top">
              <button
                onClick={() => setOpen((prev) => !prev)}
                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition bg-white dark:bg-gray-900"
              >
                <TbStack2
                  className="text-gray-600 dark:text-gray-300"
                  size={18}
                />
              </button>
            </TooltipWrapper>

            {/* Dropdown Menu */}
            {open && (
              <div
                ref={dropdownMenuRef}
                className="absolute bottom-full mb-2 right-0 bg-white dark:bg-darkModeCompliment border border-titleBarBorder dark:border-inputDarkMode rounded-lg shadow-lg z-50"
              >
                {Object.keys(filteredGroups).length > 0 ? (
                  <ul className="py-1">
                    {Object.keys(filteredGroups).map((groupName) => (
                      <li key={groupName}>
                        <button
                          onClick={() => handleSelect(groupName)}
                          className={`flex items-center w-full text-left px-3 py-2 text-[12px] hover:bg-[#F2F2F2] dark:hover:bg-darkModeNavigation transition-colors ${
                            activeTab === groupName
                              ? 'bg-titleBar dark:bg-darkModeNavigation font-semibold'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <div className="flex items-center">
                            <BiLayer
                              size={16}
                              className={
                                groupName === 'Uncategorized'
                                  ? 'text-blue-500'
                                  : 'text-yellow-500'
                              }
                            />
                            <span className="ml-2 truncate">
                              {groupName.length > 15
                                ? groupName.slice(0, 15) + '…'
                                : groupName}
                            </span>
                          </div>
                          <span className="text-gray-500 dark:text-gray-400 ml-2">
                            {filteredGroups[groupName]?.length || 0}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-2 text-gray-500 dark:text-gray-400 text-[12px]">
                    No categories
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toggle Button - Only show if toggleCollapse is provided */}
      {toggleCollapse && (
        <div
          className="fixed bottom-4 z-10 ml-2 pointer-events-none"
          style={{
            width: collapsed ? '70px' : '205px',
            transform: 'translateX(-50%)',
            left: collapsed ? '35px' : '102.5px',
          }}
        >
          <TooltipWrapper
            content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            side="left"
          >
            <button
              onClick={toggleCollapse}
              className={`flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-darkModeCompliment shadow-md hover:bg-titleBar dark:hover:bg-secondary dark:text-white dark:hover:text-white border border-titleBarBorder dark:border-inputDarkMode pointer-events-auto`}
            >
              {collapsed ? (
                <FiChevronRight size={22} />
              ) : (
                <FiChevronLeft size={22} />
              )}
            </button>
          </TooltipWrapper>
        </div>
      )}
    </div>
  );
};

export default TabsNavigation;
