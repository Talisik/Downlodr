/**
 * A custom React component
 * A React component that allows users to select a file format for download.
 * It displays a dropdown menu with available formats and handles format selection.
 *
 * @param FormatSelectorProps
 *   @param download - An object containing details about the download, including formats and status.
 *   @param onFormatSelect - A function to call when a format is selected.
 *
 * @returns JSX.Element - The rendered format selector component.
 */

import { useDropdownAnimation } from '@/core-app/hooks/animation/useDropdownAnimation';
import React, { useEffect, useRef, useState } from 'react';

interface Format {
  value: string;
  label: string;
  fileExtension: string;
  formatId: string;
}

interface FormatSelectorProps {
  download: {
    formats?: Format[];
    status: string;
    ext?: string;
    audioExt?: string;
    audioFormatId?: string;
    formatId?: string;
  };
  onFormatSelect: (formatData: {
    ext: string;
    formatId: string;
    audioExt: string;
    audioFormatId: string;
  }) => void;
}

const FormatSelector: React.FC<FormatSelectorProps> = ({
  download,
  onFormatSelect,
}) => {
  const [selectedFormatValue, setSelectedFormatValue] = useState('');
  const [selectedFormatDisplay, setSelectedFormatDisplay] = useState('Format');
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

  const handleSelect = (format: Format | null) => {
    if (format) {
      const isAudioOnly = format.label.startsWith('Audio');
      setSelectedFormatValue(format.value);
      setSelectedFormatDisplay(format.label);
      onFormatSelect(
        isAudioOnly
          ? {
              ext: format.fileExtension,
              formatId: '',
              audioExt: format.fileExtension,
              audioFormatId: format.formatId,
            }
          : {
              ext: format.fileExtension,
              formatId: format.formatId,
              audioExt: '',
              audioFormatId: '',
            },
      );
    } else {
      setSelectedFormatValue('');
      setSelectedFormatDisplay('Format');
      onFormatSelect({
        ext: download.ext || '',
        formatId: download.formatId || '',
        audioExt: '',
        audioFormatId: '',
      });
    }
    setOpen(false);
  };

  if (download.status !== 'to download') {
    return <span>{download.ext}</span>;
  }

  const formats = Array.isArray(download.formats) ? download.formats : [];

  return (
    <div ref={containerRef} className="relative w-20">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center text-start justify-between w-full border rounded-md py-1 px-2 bg-white dark:bg-inputDarkMode dark:text-gray-200 dark:border-transparent outline-none text-[13px]"
      >
        <span className="truncate">{selectedFormatDisplay}</span>
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
            <div
              role="option"
              aria-selected={selectedFormatValue === ''}
              onClick={() => handleSelect(null)}
              className="flex items-center justify-start text-left px-2 py-1 text-[13px] cursor-pointer hover:bg-gray-100 dark:hover:bg-darkModeCompliment dark:text-gray-200"
            >
              Format
            </div>
            {formats.length > 0 ? (
              formats.map((format) => (
                <div
                  key={format.value}
                  role="option"
                  aria-selected={selectedFormatValue === format.value}
                  onClick={() => handleSelect(format)}
                  className={`flex items-center justify-start px-2 py-1 text-[13px] cursor-pointer hover:bg-gray-100 dark:hover:bg-darkModeCompliment dark:text-gray-200 ${
                    selectedFormatValue === format.value
                      ? 'font-medium text-primary'
                      : ''
                  }`}
                >
                  {format.label}
                </div>
              ))
            ) : (
              <div className="flex items-center justify-start px-2 py-1 text-[13px] dark:text-gray-400 cursor-default">
                No formats available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FormatSelector;
