import React, { useEffect, useRef } from 'react';
import { FiX } from 'react-icons/fi';

interface AllVideosSearchInputProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: (query: string) => void;
  onCancel: () => void;
  placeholder?: string;
}

const AllVideosSearchInput: React.FC<AllVideosSearchInputProps> = ({
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  onCancel,
  placeholder = 'Search all videos...',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onCancel]);
  // Focus input when component mounts
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearchSubmit(searchQuery);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchQueryChange(e.target.value);
  };

  return (
    <div className="w-full max-w-full">
      <div
        className="flex items-center px-2 py-1.5 justify-between border border-primary rounded-md w-full max-w-full"
        ref={searchContainerRef}
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="flex-1 text-[13px] font-normal bg-transparent outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
            autoComplete="off"
            maxLength={25}
          />
        </div>
        <button
          onClick={onCancel}
          className="flex-shrink-0 p-1 rounded transition-colors"
        >
          <FiX size={12} className="flex-shrink-0" />
        </button>
      </div>
    </div>
  );
};

export default AllVideosSearchInput;
