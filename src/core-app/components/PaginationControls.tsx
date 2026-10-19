/**
 * A custom React component
 * Pagination footer shared by the paginated tables (downloads, categories/tags,
 * subscriptions and AFDA websites). Renders previous/next arrows around a
 * "Page X of Y" button that opens a dropdown for jumping straight to a page.
 *
 * @param currentPage - zero-based index of the page currently shown
 * @param totalPages - total number of pages available
 * @param onPageChange - called with the zero-based index of the page to show
 * @returns JSX.Element - The rendered pagination footer
 *
 */
import { useEffect, useRef, useState } from 'react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { MdOutlineArrowDropDown } from 'react-icons/md';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const PaginationControls = ({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationControlsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // Close the page list on an outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Bring the current page into view when the list opens
  useEffect(() => {
    if (isOpen) activeItemRef.current?.scrollIntoView({ block: 'center' });
  }, [isOpen]);

  const handleSelect = (page: number) => {
    setIsOpen(false);
    if (page !== currentPage) onPageChange(page);
  };

  return (
    <div className="flex-shrink-0 flex items-center justify-center gap-1 px-4 py-1.5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-darkModeTable">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 0}
        className="p-1 rounded-md text-gray-500 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-darkModeTableBorder transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <LuChevronLeft size={14} />
      </button>
      <div className="relative" ref={containerRef}>
        <button
          onClick={() => setIsOpen((open) => !open)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className="pr-1.5 pl-2 py-0.5 items-center hover:text-primary rounded-md text-xs text-gray-400 dark:text-gray-500 min-w-[80px] text-center hover:bg-gray-50 dark:hover:bg-darkModeTableBorder transition-colors flex"
        >
          Page {currentPage + 1} of {totalPages}
          <MdOutlineArrowDropDown size={22} className="hover:text-primary" />
        </button>
        {isOpen && (
          <div
            role="listbox"
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-[110px] max-h-60 overflow-y-auto bg-white dark:bg-darkModeDropdown border dark:border-gray-700 rounded-md shadow-lg py-1 z-50"
          >
            {Array.from({ length: totalPages }, (_, page) => (
              <button
                key={page}
                ref={page === currentPage ? activeItemRef : undefined}
                role="option"
                aria-selected={page === currentPage}
                onClick={() => handleSelect(page)}
                className={`w-full px-3 py-1 text-xs text-left hover:bg-gray-50 dark:hover:bg-darkModeTableBorder transition-colors ${
                  page === currentPage
                    ? 'font-semibold text-gray-700 dark:text-gray-200'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                Page {page + 1}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages - 1}
        className="p-1 rounded-md text-gray-500 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-darkModeTableBorder transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <LuChevronRight size={14} />
      </button>
    </div>
  );
};

export default PaginationControls;
