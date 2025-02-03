import React, { useState } from 'react';

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
}

const FormatSelector: React.FC<FormatSelectorProps> = ({ download }) => {
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

      // Update download object format properties
      if (isAudioOnly) {
        download.audioExt = 'mp3'; // Force mp3 for audio
        download.audioFormatId = selectedFormat.formatId;
        download.ext = 'mp3'; // Set the main extension to mp3 for audio
        download.formatId = '';
      } else {
        download.audioExt = '';
        download.audioFormatId = '';
        download.ext = selectedFormat.fileExtension;
        download.formatId = selectedFormat.formatId;
      }
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
        className="w-full border rounded-md px-1 py-1 dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-transparent [&>option]:dark:bg-darkMode"
      >
        <option value="" className="dark:bg-darkMode dark:text-gray-200">
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
