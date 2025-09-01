import { toast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import { useMainStore } from '@/Store/mainStore';
import React, { useEffect, useState } from 'react';

interface FormatConverterMenuProps {
  menuPositionClass: string;
  onConvert: (
    downloadId: string,
    format: string,
    keepOriginal: boolean,
    saveToCustomLocation?: boolean,
  ) => void | Promise<void>;
}

const FormatConverterMenu: React.FC<FormatConverterMenuProps> = ({
  menuPositionClass,
  onConvert,
}) => {
  const [selectedFormat, setSelectedFormat] = useState('MP4');
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [saveToCustomLocation, setSaveToCustomLocation] = useState(false);
  const selectedDownloads = useMainStore((state) => state.selectedDownloads);
  const clearAllSelections = useMainStore((state) => state.clearAllSelections);

  // Debug logging
  useEffect(() => {
    console.log(
      'Selected Downloads in FormatConverterMenu:',
      selectedDownloads,
    );
  }, [selectedDownloads]);

  // Array of available formats (video and text formats)
  const formats = ['MP4', 'MP3', 'MOV', 'AVI', 'MKV', 'TXT', 'DOCX', 'MD'];

  const handleConvert = async () => {
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

    let successCount = 0;
    let failureCount = 0;
    const totalCount = selectedDownloads.length;

    // Show initial toast for conversion start
    toast({
      variant: 'default',
      title: 'Conversion Starting',
      description: `Initiating conversion of ${totalCount} file(s) to ${selectedFormat}...`,
      duration: 2000,
    });

    // Convert all selected downloads with proper error handling
    const conversionPromises = selectedDownloads.map(async (download) => {
      try {
        // Call onConvert and wait for it to complete if it returns a promise
        const result = onConvert(
          download.id,
          selectedFormat,
          keepOriginal,
          saveToCustomLocation,
        );

        // If onConvert returns a promise, await it
        if (result && typeof result.then === 'function') {
          await result;
        }

        successCount++;
        return { downloadId: download.id, success: true };
      } catch (error) {
        console.error(`Conversion failed for download ${download.id}:`, error);
        failureCount++;

        // Show individual failure toast
        toast({
          variant: 'destructive',
          title: 'Conversion Failed',
          description: `Failed to convert download to ${selectedFormat}`,
          duration: 5000,
        });

        return { downloadId: download.id, success: false, error };
      }
    });

    // Wait for all conversions to complete
    try {
      const results = await Promise.allSettled(conversionPromises);

      // Count actual results
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.success) {
          // Success already counted
        } else {
          // Handle additional failures from Promise.allSettled
          if (result.status === 'rejected') {
            failureCount++;
            successCount = Math.max(0, successCount - 1);
          }
        }
      });

      // Clear selections after all conversions are initiated
      clearAllSelections();

      // Show final status toast based on actual results
      if (failureCount === 0) {
        toast({
          variant: 'success',
          title: 'Conversion Successful',
          description: `Successfully converted ${successCount} file(s) to ${selectedFormat}`,
          duration: 4000,
        });
      } else if (successCount === 0) {
        toast({
          variant: 'destructive',
          title: 'Conversion Failed',
          description: `Failed to convert ${failureCount} file(s) to ${selectedFormat}`,
          duration: 5000,
        });
      } else {
        toast({
          variant: 'default',
          title: 'Conversion Partially Completed',
          description: `${successCount} succeeded, ${failureCount} failed`,
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error during batch conversion:', error);
      toast({
        variant: 'destructive',
        title: 'Conversion Error',
        description: 'An unexpected error occurred during conversion',
        duration: 5000,
      });
    }
  };

  return (
    <div
      data-testid="format-converter-menu"
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

        {/* Save Location Option - Only show for text formats */}
        {['TXT', 'DOCX', 'MD'].includes(selectedFormat) && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="save-custom-location"
                checked={saveToCustomLocation}
                onChange={() => setSaveToCustomLocation(!saveToCustomLocation)}
                className="mr-2"
              />
              <label
                htmlFor="save-custom-location"
                className="text-sm dark:text-gray-200"
              >
                Choose save location (default: video directory)
              </label>
            </div>
          </div>
        )}

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
