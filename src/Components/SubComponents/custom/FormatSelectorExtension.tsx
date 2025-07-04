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
  const [keepOriginal, setKeepOriginal] = useState<boolean>(
    options.keepOriginal || false,
  );
  const [selectedItems, setSelectedItems] = useState<
    Array<{ id: string; name: string; selected: boolean }>
  >(options.selectedItems || []);
  const [selectAll, setSelectAll] = useState<boolean>(
    options.selectAllDefault || false,
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

  // Update all items when select all changes
  useEffect(() => {
    if (options.showSelectAll) {
      setSelectedItems((prev) =>
        prev.map((item) => ({ ...item, selected: selectAll })),
      );
    }
  }, [selectAll, options.showSelectAll]);

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
      selectedItems: options.showItemSelection ? selectedItems : undefined,
    });

    onClose();
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) => {
      const newItems = prev.map((item) =>
        item.id === itemId ? { ...item, selected: !item.selected } : item,
      );
      // Update select all state based on whether all items are selected
      setSelectAll(newItems.every((item) => item.selected));
      return newItems;
    });
  };

  const handleSelectAll = () => {
    setSelectAll(!selectAll);
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
          {/* Format Selection */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Format
            </h4>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="w-full border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-transparent [&>option]:dark:bg-darkMode"
            >
              {options.formats.map((format: FormatOption) => (
                <option
                  key={format.id}
                  value={format.value}
                  className="dark:bg-darkMode dark:text-gray-200"
                >
                  {format.label}
                </option>
              ))}
            </select>
          </div>

          {/* Item Selection */}
          {options.showItemSelection && selectedItems.length > 0 && (
            <div className="space-y-2 mt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Items
              </h4>
              {options.showSelectAll && (
                <div className="flex items-center py-1 border-b border-gray-200 dark:border-gray-700">
                  <input
                    type="checkbox"
                    id="select-all"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="mr-2"
                  />
                  <label
                    htmlFor="select-all"
                    className="text-sm font-medium dark:text-gray-200"
                  >
                    Select All
                  </label>
                </div>
              )}
              <div className="max-h-48 overflow-y-auto">
                {selectedItems.map((item) => (
                  <div
                    key={`item-${item.id}`}
                    className="flex items-center py-1 gap-2"
                  >
                    <input
                      type="checkbox"
                      id={`item-${item.id}`}
                      checked={item.selected}
                      onChange={() => toggleItemSelection(item.id)}
                      className="w-4 h-4 p-2"
                    />
                    <label
                      htmlFor={`item-${item.id}`}
                      className="w-5/6 text-sm dark:text-gray-200 break-all truncate"
                    >
                      {item.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keep Original Option
          <div className="flex items-center mt-4">
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
           */}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            {options.cancelButtonText || 'Cancel'}
          </button>
          <button
            onClick={handleConvert}
            className="primary-custom-btn px-2 py-2 text-sm font-medium text-white rounded-md dark:hover:text-black dark:hover:bg-white"
          >
            {options.confirmButtonText || 'Convert'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormatSelectorExtension;
