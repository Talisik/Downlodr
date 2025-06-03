import React, { useEffect, useState } from 'react';
import {
  FormatOption,
  FormatSelectorOptions,
  FormatSelectorResult,
} from '../../../plugins/types';
import { toast } from '../shadcn/hooks/use-toast';

interface FormatSelectorExtensionProps {
  isOpen: boolean;
  onClose: () => void;
  options: FormatSelectorOptions;
  onSelect: (result: FormatSelectorResult) => void;
}

const FormatSelectorExtension: React.FC<FormatSelectorExtensionProps> = ({
  isOpen,
  onClose,
  options,
  onSelect,
}) => {
  // Find default format or use first one
  const defaultFormat =
    options.formats.find((f) => f.default)?.value ||
    (options.formats.length > 0 ? options.formats[0].value : '');

  const [selectedFormat, setSelectedFormat] = useState<string>(defaultFormat);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [keepOriginal, setKeepOriginal] = useState<boolean>(
    options.keepOriginal || false,
  );

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleConvert = () => {
    if (!selectedFormat) {
      toast({
        variant: 'destructive',
        title: 'Format Required',
        description: 'Please select a format to convert to.',
        duration: 3000,
      });
      return;
    }

    onSelect({
      selectedFormat,
      keepOriginal,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      {/* Modal backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal content */}
      <div
        className="bg-white dark:bg-darkModeDropdown rounded-lg shadow-lg w-full max-w-md mx-4 z-10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {options.title || 'Select Format'}
          </h3>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-3">
          {options.formats.map((format: FormatOption) => (
            <div key={format.id} className="flex items-center">
              <input
                type="radio"
                id={`format-${format.id}`}
                name="format"
                value={format.value}
                checked={selectedFormat === format.value}
                onChange={() => setSelectedFormat(format.value)}
                className="mr-2"
              />
              <label
                htmlFor={`format-${format.id}`}
                className="text-sm dark:text-gray-200"
              >
                {format.label}
              </label>
            </div>
          ))}
          {/* 
          <div className="border-t border-gray-200 dark:border-gray-700 my-2 pt-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="keep-original"
                checked={keepOriginal}
                onChange={() => setKeepOriginal(!keepOriginal)}
                className="mr-2"
              />
              <label
                htmlFor="keep-original"
                className="text-sm dark:text-gray-200"
              >
                Keep the original file
              </label>
            </div>
          </div>
          */}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#FEF9F4] dark:dark:bg-darkMode  border-t border-gray-200 dark:border-darkModeCompliment flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
          >
            Cancel
          </button>
          <button
            onClick={handleConvert}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-medium focus:outline-none"
          >
            Convert
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormatSelectorExtension;
