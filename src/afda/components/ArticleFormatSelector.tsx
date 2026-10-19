/**
 * Format picker for an article row (docx / pdf). Mirrors the look of the
 * video FormatSelector so both download tables share one dropdown style.
 */

import { useDropdownAnimation } from '@/core-app/hooks/animation/useDropdownAnimation';
import React, { useEffect, useRef, useState } from 'react';

export type ArticleFormat = 'docx' | 'pdf';

const ARTICLE_FORMATS: ArticleFormat[] = ['docx', 'pdf'];

interface ArticleFormatSelectorProps {
  value: ArticleFormat;
  onChange: (format: ArticleFormat) => void;
}

const ArticleFormatSelector: React.FC<ArticleFormatSelectorProps> = ({
  value,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { ref: listRef, mounted } = useDropdownAnimation(open);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (format: ArticleFormat) => {
    onChange(format);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-20">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center text-start justify-between w-full border rounded-md py-1 px-2 bg-white dark:bg-inputDarkMode dark:text-gray-200 dark:border-transparent outline-none text-[13px]"
      >
        <span className="truncate">{value}</span>
        <svg
          className={`w-2.5 h-2.5 ml-1 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          viewBox="0 0 10 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {mounted && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 min-w-[10rem] w-max bg-white dark:bg-darkModeDropdown border border-[#E4E4E7] dark:border-transparent rounded-md shadow-md overflow-hidden"
        >
          <div className="max-h-48 overflow-y-auto py-1 ">
            {ARTICLE_FORMATS.map((format) => (
              <div
                key={format}
                role="option"
                aria-selected={value === format}
                onClick={() => handleSelect(format)}
                className={`flex items-center justify-start px-2 py-1 text-[13px] cursor-pointer hover:bg-gray-100 dark:hover:bg-darkModeCompliment dark:text-gray-200 ${
                  value === format ? 'font-medium text-primary' : ''
                }`}
              >
                {format}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticleFormatSelector;
