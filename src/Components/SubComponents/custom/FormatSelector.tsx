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

import React, { useState } from 'react';

interface Format {
  value: string; // Value of the format
  label: string; // Display label for the format
  fileExtension: string; // File extension associated with the format
  formatId: string; // Unique identifier for the format
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

  const handleFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const formats = (
      'formats' in download ? (download.formats as Format[]) : []
    ) as Format[];
    const selectedFormat = formats.find(
      (format) => format.value === e.target.value,
    );

    if (selectedFormat) {
      const isAudioOnly = selectedFormat.label.startsWith('Audio');

      // Update local state
      setSelectedFormatValue(selectedFormat.value);
      setSelectedFormatDisplay(selectedFormat.label);

      // Prepare format data
      const formatData = isAudioOnly
        ? {
            ext: selectedFormat.fileExtension,
            formatId: '',
            audioExt: selectedFormat.fileExtension,
            audioFormatId: selectedFormat.formatId,
          }
        : {
            ext: selectedFormat.fileExtension,
            formatId: selectedFormat.formatId,
            audioExt: '',
            audioFormatId: '',
          };

      // Send format data back to parent
      onFormatSelect(formatData);
    } else {
      // When no format is selected, keep existing ext and formatId but clear audio fields
      setSelectedFormatValue('');
      setSelectedFormatDisplay('Format');
      onFormatSelect({
        ext: download.ext || '',
        formatId: download.formatId || '',
        audioExt: '',
        audioFormatId: '',
      });
    }
  };

  if (download.status !== 'to download') {
    return <span>{download.ext}</span>;
  }

  return (
    <div className="flex-1">
      <select
        value={selectedFormatValue}
        onChange={handleFormatChange}
        className="flex-1 w-full border rounded-md py-1 dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-transparent [&>option]:dark:bg-darkMode"
      >
        <option
          value=""
          className="min-w-[50px] border rounded-md py-1 dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-transparent [&>option]:dark:bg-darkMode"
        >
          {selectedFormatDisplay}
        </option>
        {'formats' in download &&
        Array.isArray(download.formats) &&
        (download.formats as Format[]).length > 0 ? (
          (download.formats as Format[]).map((format) => (
            <option
              key={format.value}
              value={format.value}
              className="dark:bg-darkMode dark:text-gray-200"
            >
              {format.label}
            </option>
          ))
        ) : (
          <option value="" className="dark:bg-darkMode dark:text-gray-200">
            No formats available
          </option>
        )}
      </select>
    </div>
  );
};

export default FormatSelector;
