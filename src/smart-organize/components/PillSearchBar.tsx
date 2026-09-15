/**
 * PillSearchBar Component
 * A reusable pill-based search bar component that allows multiple search queries
 * with filter type selection (Title, Tag, Category)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiChevronDown, FiFolder, FiSearch, FiTag, FiX } from 'react-icons/fi';
import { RxText } from 'react-icons/rx';

export interface SearchQuery {
  searchQuery: string;
  filterType: 'Title' | 'Tag' | 'Category';
}

interface PillSearchBarProps {
  placeholder?: string;
  onSearchQueriesChange?: (queries: SearchQuery[]) => void;
  defaultFilterType?: 'Title' | 'Tag' | 'Category';
  showFilterType?: boolean;
  className?: string;
  initialQueries?: SearchQuery[];
}

const PillSearchBar: React.FC<PillSearchBarProps> = ({
  placeholder = 'Search videos...',
  onSearchQueriesChange,
  defaultFilterType = 'Title',
  showFilterType = true,
  className = '',
  initialQueries = [],
}) => {
  const searchDivRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [allSearchQuery, setAllSearchQuery] =
    useState<SearchQuery[]>(initialQueries);
  const [inputValue, setInputValue] = useState('');
  const [filterType, setFilterType] = useState<'Title' | 'Tag' | 'Category'>(
    defaultFilterType,
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Notify parent when search queries change
  useEffect(() => {
    onSearchQueriesChange?.(allSearchQuery);
  }, [allSearchQuery, onSearchQueriesChange]);

  // Sync with initial queries prop changes
  useEffect(() => {
    if (initialQueries.length > 0) {
      setAllSearchQuery(initialQueries);
    }
  }, [initialQueries]);

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

  // Clear all pills
  const clearAllPills = useCallback(() => {
    setAllSearchQuery([]);
    setInputValue('');
  }, []);

  // Handle click outside search div to close search mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchDivRef.current &&
        !searchDivRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsSearchMode(false);
        setIsDropdownOpen(false);
      }
    };

    if (isSearchMode) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchMode]);

  const getFilterIcon = () => {
    switch (filterType) {
      case 'Title':
        return <RxText size={11} color="gray" />;
      case 'Tag':
        return <FiTag size={11} color="gray" />;
      case 'Category':
        return <FiFolder size={11} color="gray" />;
      default:
        return <RxText size={11} color="gray" />;
    }
  };

  if (!isSearchMode) {
    return (
      <div className={`flex items-center gap-2 outline-none ${className}`}>
        <button
          className="bg-gray-100 dark:bg-gray-700 rounded-md p-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          onClick={() => {
            setIsSearchMode(true);
            setTimeout(() => {
              searchDivRef.current?.querySelector('input')?.focus();
            }, 0);
          }}
        >
          <FiSearch size={12} className="text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={searchDivRef}
      className={`flex flex-wrap rounded-md bg-[#F3F3F3] dark:bg-gray-700 justify-between ${className}`}
    >
      <div className="rounded-l-md flex flex-1 items-center flex-wrap gap-2 p-2 bg-[#F3F3F3] dark:bg-gray-700">
        <FiSearch size={14} className="text-gray-400 flex-shrink-0" />
        {allSearchQuery.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-gray-600 text-xs text-gray-900 dark:text-gray-100"
          >
            {item.searchQuery}
            <FiX
              size={10}
              className="cursor-pointer hover:text-red-500 text-gray-500 dark:text-gray-400"
              onClick={() => removePill(index)}
            />
          </div>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 min-w-[120px] text-sm bg-transparent outline-none ring-0 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          autoFocus
        />
      </div>
      {/* Dropdown */}
      {showFilterType && (
        <div
          className="relative w-[12%] border-l-2 border-gray-300 dark:border-gray-600 items-center justify-center flex"
          ref={dropdownRef}
        >
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex justify-center items-center gap-1 rounded-md text-xs h-full w-full px-2 text-gray-700 dark:text-gray-300"
          >
            {getFilterIcon()}
            <span className="truncate font-semibold">{filterType}</span>
            <FiChevronDown size={10} color="gray" />
          </button>
          {isDropdownOpen && (
            <ul className="p-1 absolute right-0 mt-1 w-[100px] bg-white dark:bg-gray-700 border border-titleBarBorder dark:border-gray-600 rounded-md shadow-lg z-10">
              {['Title', 'Tag', 'Category'].map((option) => (
                <li
                  key={option}
                  className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-xs text-gray-900 dark:text-gray-100"
                  onClick={() => {
                    setFilterType(option as 'Title' | 'Tag' | 'Category');
                    setIsDropdownOpen(false);
                  }}
                >
                  {option}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default PillSearchBar;
