import React, { useEffect, useState } from 'react';
import { useMainStore } from '../../../Store/mainStore';
import { toast } from '../shadcn/hooks/use-toast';

interface FormatConverterMenuProps {
  downloadId: string;
  menuPositionClass: string;
  onConvert: (
    downloadId: string,
    format: string,
    keepOriginal: boolean,
  ) => void;
}

const FormatConverterMenu: React.FC<FormatConverterMenuProps> = ({
  downloadId,
  menuPositionClass,
  onConvert,
}) => {
  const [selectedFormat, setSelectedFormat] = useState('MP4');
  const [keepOriginal, setKeepOriginal] = useState(false);
  const selectedDownloads = useMainStore((state) => state.selectedDownloads);
  const clearAllSelections = useMainStore((state) => state.clearAllSelections);

  // Debug logging
  useEffect(() => {
    console.log(
      'Selected Downloads in FormatConverterMenu:',
      selectedDownloads,
    );
  }, [selectedDownloads]);

  // Array of available formats
  const formats = ['MP4', 'MP3', 'MOV', 'AVI', 'MKV'];

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

    if (selectedDownloads.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Downloads Selected',
        description: 'Please select at least one download to convert.',
        duration: 3000,
      });
      return;
    }

    // Convert all selected downloads
    selectedDownloads.forEach((download) => {
      onConvert(download.id, selectedFormat, keepOriginal);
    });

    // Clear selections after conversion
    clearAllSelections();

    toast({
      variant: 'success',
      title: 'Conversion Started',
      description: `Converting ${
        selectedDownloads.length
      } file(s) to ${selectedFormat}${
        keepOriginal ? ' (keeping original)' : ''
      }`,
      duration: 3000,
    });
  };

  return (
    <div
      className={`absolute ${menuPositionClass} bg-white dark:bg-darkMode border rounded-md shadow-lg py-3 px-4 z-50 w-80 dark:border-gray-700`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="space-y-4">
        {/* Selected Downloads List */}
        <div className="max-h-40 overflow-y-auto">
          <h3 className="text-sm font-medium mb-2 dark:text-gray-200">
            Selected Downloads ({selectedDownloads.length})
          </h3>
          <div className="space-y-2">
            {selectedDownloads.length > 0 ? (
              selectedDownloads.map((download) => (
                <div
                  key={download.id}
                  className="flex items-center text-sm dark:text-gray-300"
                >
                  <span className="truncate">
                    {download.downloadName || download.id}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                No downloads selected
              </div>
            )}
          </div>
        </div>

        {/* Format Selection */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <h3 className="text-sm font-medium mb-2 dark:text-gray-200">
            Select Format
          </h3>
          <div className="space-y-2">
            {formats.map((format) => (
              <div key={format} className="flex items-center">
                <input
                  type="radio"
                  id={`format-${format}`}
                  name="format"
                  value={format}
                  checked={selectedFormat === format}
                  onChange={() => setSelectedFormat(format)}
                  className="mr-2"
                />
                <label
                  htmlFor={`format-${format}`}
                  className="text-sm dark:text-gray-200"
                >
                  {format}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Keep Original Option */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
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

        {/* Convert Button */}
        <div className="text-right pt-3">
          <button
            onClick={handleConvert}
            className="px-4 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm"
            disabled={selectedDownloads.length === 0}
          >
            Convert {selectedDownloads.length} File
            {selectedDownloads.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormatConverterMenu;
