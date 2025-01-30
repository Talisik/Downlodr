/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { IoMdClose } from 'react-icons/io';
import { FiUpload } from 'react-icons/fi';

interface SchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ScheduleDay {
  dayDisplayName: string;
  dayVal: string;
}

interface ScheduleFrequency {
  frequencyDisplayName: string;
  frequency: string;
}

interface Format {
  formatDisplayName: string;
  format: string;
}

const SchedulerModal: React.FC<SchedulerModalProps> = ({ isOpen, onClose }) => {
  // Form submission
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleDay, setScheduleDay] = useState('');
  const [scheduleDayVal, setScheduleDayVal] = useState('');
  const [channelUrls, setChannelUrls] = useState('');
  const [downloadLocation, setDownloadLocation] = useState('');
  const [downloadFomat, setDownloadFomat] = useState('');

  const [scheduleFrequency, setScheduleFrequency] = useState('');
  const [scheduleFrequencVal, setScheduleFrequencVal] = useState('');
  const [downloadSubtitles, setDownloadSubtitles] = useState(false);
  const [downloadThumbnail, setDownloadThumbnail] = useState(false);
  const [downloadDescription, setDownloadDescription] = useState(false);

  //Misc
  const navRef = useRef<HTMLDivElement>(null);

  const resetSchedulerModal = () => {
    // reset everything
    setDownloadSubtitles(false);
    setDownloadThumbnail(false);
    setDownloadDescription(false);
  };

  // checks if file location is correct
  const isValidPath = async (path: string): Promise<boolean> => {
    // Check for undefined or empty path
    if (!path || path.includes('undefined')) {
      console.log('undefined path');
      return false;
    }
    try {
      // Call the validatePath method from the preload script
      const isValid = await window.downlodrFunctions.validatePath(path);
      return isValid;
    } catch (error) {
      console.error('Error validating path:', error);
      return false;
    }
  };

  // Find location
  const handleDirectory = async () => {
    const path = await window.ytdlp.selectDownloadDirectory();
    setDownloadLocation(path);
  };

  // Close Modal
  const handleClose = () => {
    resetSchedulerModal();
    onClose();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const dayOptions = [
    { dayDisplayName: 'Monday', dayVal: '1' },
    { dayDisplayName: 'Tuesday', dayVal: '2' },
    { dayDisplayName: 'Wednesday', dayVal: '3' },
    { dayDisplayName: 'Thursday', dayVal: '4' },
    { dayDisplayName: 'Friday', dayVal: '5' },
    { dayDisplayName: 'Saturday', dayVal: '6' },
    { dayDisplayName: 'Sunday', dayVal: '7' },
  ];

  const frequencyOptions = [
    { frequencyDisplayName: '7:00am', frequencyVal: '1' },
    { frequencyDisplayName: '7:30am', frequencyVal: '2' },
    { frequencyDisplayName: '8:00am', frequencyVal: '3' },
    { frequencyDisplayName: '8:30am', frequencyVal: '4' },
    { frequencyDisplayName: '9:00am', frequencyVal: '5' },
    { frequencyDisplayName: '9:30am', frequencyVal: '6' },
    { frequencyDisplayName: '10:00am', frequencyVal: '7' },
  ];

  const formatOptions = [
    { dayDisplayName: 'Default video', formatVal: '1' },
    { dayDisplayName: 'Default audio', formatVal: '2' },
  ];

  // Move conditional return here, after hooks but before render
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-20 dark:bg-opacity-50 flex items-center justify-center h-full"
      onClick={(e) => {
        // Only close if clicking the overlay background
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="bg-white dark:bg-darkMode rounded-lg pt-6 pr-6 pl-6 pb-4 max-w-xl w-full mx-4">
        {/* Left side - Form */}
        <div className="w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold dark:text-gray-200">
              Create New Schedule
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <IoMdClose size={16} />
            </button>
          </div>

          <form onSubmit={(e) => e.preventDefault()}>
            {/* Schedule Name */}
            <div className="space-y-2">
              <div>
                <label className="block mb-2 dark:text-gray-200">
                  Schedule Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g Tech Daily News"
                    value={scheduleName}
                    onChange={(e) => setScheduleName(e.target.value)}
                    className="flex-1 border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none  "
                  />
                </div>
              </div>
              {/* End of Schedule Name */}
              {/* Upload Button */}
              <div className="space-y-2 flex justify-end">
                <div className="flex gap-3">
                  <a
                    href="https://www.w3schools.com/"
                    target="_blank"
                    className="mt-2 text-xs underline underline-offset-2 text-primary dark:text-primary"
                  >
                    CSV Format
                  </a>
                  <button className="bg-secondary text-white px-2 py-2 rounded-md text-sm hover:bg-orange-600">
                    <div className="flex items-center gap-2">
                      <FiUpload size={14} />
                      <span>Upload CSV</span>
                    </div>
                  </button>
                </div>
              </div>
              {/* End of Upload Button */}
              {/* URL Name */}
              <div className="flex gap-4 pt-2">
                <div className="flex-1">
                  <label className="block mb-2 dark:text-gray-200">
                    Channel URL
                  </label>
                  <input
                    type="text"
                    placeholder="Name"
                    value={channelUrls}
                    onChange={(e) => setChannelUrls(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none  "
                  />
                </div>

                <div className="">
                  <label className="block mb-2 dark:text-gray-200">Day</label>
                  <select
                    value={scheduleDay}
                    onChange={(e) => {
                      setScheduleDay(e.target.value);
                      const selectedDay = dayOptions.find(
                        (day) => day.dayDisplayName === e.target.value,
                      );
                      if (selectedDay) {
                        setScheduleDayVal(selectedDay.dayVal);
                      }
                    }}
                    className="w-full border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none   [&>option]:dark:bg-darkMode"
                  >
                    {dayOptions.map((day) => (
                      <option
                        key={day.dayVal}
                        value={day.dayDisplayName}
                        className="dark:bg-darkMode dark:text-gray-200"
                      >
                        {day.dayDisplayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="">
                  <label className="block mb-2 dark:text-gray-200">
                    Check Frequency
                  </label>
                  <select
                    value={scheduleFrequency}
                    onChange={(e) => {
                      setScheduleFrequency(e.target.value);
                      const selectedFrequency = frequencyOptions.find(
                        (frequency) =>
                          frequency.frequencyDisplayName === e.target.value,
                      );
                      if (selectedFrequency) {
                        setScheduleDayVal(selectedFrequency.frequencyVal);
                      }
                    }}
                    className="w-full border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none   [&>option]:dark:bg-darkMode"
                  >
                    {frequencyOptions.map((frequency) => (
                      <option
                        key={frequency.frequencyVal}
                        value={frequency.frequencyDisplayName}
                        className="dark:bg-darkMode dark:text-gray-200"
                      >
                        {frequency.frequencyDisplayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* End of Schedule Name */}
              {/* Download Location Name */}
              <div className="flex gap-4 pt-4">
                <div className="flex-1">
                  <label className="block mb-2 dark:text-gray-200">
                    Download Location
                  </label>
                  <input
                    type="text"
                    placeholder="Download Location"
                    value={downloadLocation}
                    onClick={handleDirectory}
                    className="w-full border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none  "
                    readOnly
                  />
                </div>

                <div className="">
                  <label className="block mb-2 dark:text-gray-200">
                    Format
                  </label>
                  <select
                    value={downloadFomat}
                    onChange={(e) => {
                      setDownloadFomat(e.target.value);
                      const selectedFormat = formatOptions.find(
                        (format) => format.dayDisplayName === e.target.value,
                      );
                      if (selectedFormat) {
                        setScheduleDayVal(selectedFormat.formatVal);
                      }
                    }}
                    className="w-full border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none   [&>option]:dark:bg-darkMode"
                  >
                    {formatOptions.map((format) => (
                      <option
                        key={format.formatVal}
                        value={format.dayDisplayName}
                        className="dark:bg-darkMode dark:text-gray-200"
                      >
                        {format.dayDisplayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* End of Download Location Name */}
              {/* Checkboxes*/}
              <div className="flex-1">
                <div className="flex flex-row justify-between items-center  mt-6 text-xs">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={downloadSubtitles}
                      onChange={(e) => setDownloadSubtitles(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    />
                    <span className="text-sm dark:text-gray-200">
                      Download Subtitles
                    </span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={downloadThumbnail}
                      onChange={(e) => setDownloadThumbnail(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    />
                    <span className="text-sm dark:text-gray-200">
                      Download Thumbnail
                    </span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={downloadDescription}
                      onChange={(e) => setDownloadDescription(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    />
                    <span className="text-sm dark:text-gray-200">
                      Create Channel Subfolders
                    </span>
                  </label>
                </div>
              </div>
              {/* End of Download Location Name */}
            </div>
          </form>
        </div>

        {/* Button commands */}
        <hr className="solid mt-4 mb-2 -mx-6 w-[calc(100%+47px)] border-t-2 border-divider dark:border-gray-700" />

        <div className="flex gap-3">
          <button
            type="submit"
            className="bg-primary text-white px-2 py-2 rounded-md hover:bg-orange-600 dark:hover:text-black dark:hover:bg-white"
          >
            Schedule
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-2 py-2 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            Cancel
          </button>
        </div>
        {/* End of Button commands */}
      </div>
    </div>
  );
};

export default SchedulerModal;
