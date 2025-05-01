import React, { useState } from 'react';
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

    onConvert(downloadId, selectedFormat, keepOriginal);

    toast({
      variant: 'success',
      title: 'Conversion Started',
      description: `Converting to ${selectedFormat}${
        keepOriginal ? ' (keeping original)' : ''
      }`,
      duration: 3000,
    });
  };

  return (
    <div
      className={`absolute ${menuPositionClass} bg-white dark:bg-darkMode border rounded-md shadow-lg py-3 px-4 z-50 w-64 dark:border-gray-700`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="space-y-3">
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
        <div className="text-right">
          <button
            onClick={handleConvert}
            className="px-4 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm"
          >
            Convert
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormatConverterMenu;
