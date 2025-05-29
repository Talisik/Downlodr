/**
 * A custom React component
 * Shows the Settings modal for Downlodr, provides options for user to customize downlodr via: Download Speed, Default download location, amount of concurrent downloads
 *
 * @param isOpen - If modal is open, keeps it open
 * @param onClose - If modal has been closed, closes modal
 * @returns JSX.Element - The rendered component displaying a SettingsModal
 *
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from 'react';
import { IoMdClose } from 'react-icons/io';
import { useMainStore } from '../../../Store/mainStore';
import { usePluginStore } from '../../../Store/pluginStore';
import { Slider } from '../../SubComponents/shadcn/components/ui/slider';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    updateDefaultLocation,
    updateDefaultDownloadSpeed,
    updatePermitConnectionLimit,
    updateMaxDownloadNum,
    updateDefaultDownloadSpeedBit,
    visibleColumns,
    setVisibleColumns,
    updateRunInBackground,
  } = useMainStore();

  const { settingsPlugin, updateIsShowPlugin } = usePluginStore();
  // Form submission
  const [biteUnit, setBiteUnit] = useState('');
  const [biteUnitVal, setBiteUnitVal] = useState(
    settings.defaultDownloadSpeedBit,
  );
  const [downloadLocation, setDownloadLocation] = useState(
    settings.defaultLocation,
  );
  const [biteVal, setbiteVal] = useState(settings.defaultDownloadSpeed);
  const [maxDownload, setMaxDownload] = useState(settings.maxDownloadNum);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [maxUpload, setmaxUpload] = useState(settings.maxUploadNum);
  const [isConnectionLimitEnabled, setIsConnectionLimitEnabled] = useState(
    settings.permitConnectionLimit,
  );

  // Update the state declaration for local visible columns
  const [localVisibleColumns, setLocalVisibleColumns] = useState<string[]>([]);

  // background running setting
  const [runInBackground, setRunInBackground] = useState(
    settings.runInBackground,
  ); // Default to true for backward compatibility

  // sync with the mainStore's visibleColumns
  useEffect(() => {
    if (isOpen) {
      // Reset the local state when the modal opens to match the store
      setLocalVisibleColumns([...visibleColumns]);
    }
  }, [isOpen, visibleColumns]);

  // Misc
  const navRef = useRef<HTMLDivElement>(null);

  // Add this state for the dummy plugin toggle
  const [isShowPlugin, setIsShowPlugin] = useState(settingsPlugin.isShowPlugin);

  const resetSettingsModal = () => {
    // Reset all state values to their original store values
    const initialBiteOption = getInitialBiteOption();
    setBiteUnit(initialBiteOption);
    setBiteUnitVal(settings.defaultDownloadSpeedBit);
    setDownloadLocation(settings.defaultLocation);
    setbiteVal(settings.defaultDownloadSpeed);
    setMaxDownload(settings.maxDownloadNum);
    setmaxUpload(settings.maxUploadNum);
    setIsConnectionLimitEnabled(settings.permitConnectionLimit);
    // Reset column visibility
    setLocalVisibleColumns([...visibleColumns]);
    // Add this line to reset the background running setting
    setRunInBackground(settings.runInBackground ?? true);
  };
  // New state to track if directory selection is in progress
  const [isSelectingDirectory, setIsSelectingDirectory] =
    useState<boolean>(false);
  const handleDirectory = async () => {
    // Prevent multiple dialogs from being opened
    if (isSelectingDirectory) return;

    try {
      setIsSelectingDirectory(true);
      const path = await window.ytdlp.selectDownloadDirectory();
      if (path) {
        setDownloadLocation(path);
      }
    } finally {
      setIsSelectingDirectory(false);
    }
  };
  // Close Modal
  const handleClose = () => {
    resetSettingsModal();
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

  const biteOptions = [
    { biteDisplayName: 'Kilo byte (KB)', biteUnitVal: 'K' },
    { biteDisplayName: 'Mega byte (MB)', biteUnitVal: 'M' },
    { biteDisplayName: 'Giga byte (GB)', biteUnitVal: 'G' },
  ];

  // Find the initial bite option based on the stored unit value
  const getInitialBiteOption = () => {
    const option = biteOptions.find(
      (bite) => bite.biteUnitVal === settings.defaultDownloadSpeedBit,
    );
    return option ? option.biteDisplayName : 'Kilo byte (KB)';
  };

  useEffect(() => {
    // Update the biteUnit whenever the store value changes
    setBiteUnit(getInitialBiteOption());
    setBiteUnitVal(settings.defaultDownloadSpeedBit);
  }, [settings.defaultDownloadSpeedBit]);

  // Column options with required flag
  const columnOptions = [
    { id: 'format', label: 'Format', required: true },
    { id: 'size', label: 'Size', required: false },
    { id: 'speed', label: 'Speed', required: false },
    { id: 'source', label: 'Source', required: false },
    { id: 'name', label: 'Title', required: true },
    { id: 'dateAdded', label: 'Date Added', required: false },
    { id: 'transcript', label: 'Closed Caption', required: false },
    { id: 'thumbnail', label: 'Thumbnail', required: false },
    { id: 'status', label: 'Status', required: true },
  ];

  // Column toggle handler
  const handleToggleColumn = (columnId: string) => {
    if (localVisibleColumns.includes(columnId)) {
      setLocalVisibleColumns(
        localVisibleColumns.filter((id) => id !== columnId),
      );
    } else {
      setLocalVisibleColumns([...localVisibleColumns, columnId]);
    }
  };

  // Dummy function to handle toggle state
  const handleToggle = () => {
    setIsShowPlugin((prev) => !prev);
    console.log(`Plugin is now ${!isShowPlugin ? 'enabled' : 'disabled'}`);
  };

  // Modify handleSubmit to consider the checkbox
  const handleSubmit = () => {
    updateDefaultLocation(downloadLocation);
    updateDefaultDownloadSpeed(biteVal);
    updateDefaultDownloadSpeedBit(biteUnitVal);
    updatePermitConnectionLimit(isConnectionLimitEnabled);
    // Only update connection limits if enabled, otherwise set to default of 5
    updateMaxDownloadNum(isConnectionLimitEnabled ? maxDownload : 5);
    // Update visible columns
    setVisibleColumns(localVisibleColumns);
    // Add this line to save the background running setting
    console.log('Saving runInBackground value:', runInBackground);
    updateRunInBackground(runInBackground);
    updateIsShowPlugin(isShowPlugin);
    // Also update the main process directly
    if (window.backgroundSettings?.setRunInBackground) {
      console.log('Sending to main process:', runInBackground);
      window.backgroundSettings.setRunInBackground(runInBackground);
    }

    onClose();
  };

  // Move conditional return here, after hooks but before render
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-20 dark:bg-opacity-50 flex items-center justify-center h-full z-[8999]"
      onClick={(e) => {
        // Only close if clicking the overlay background
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      {/* Directory selection overlay - blocks all app interaction */}
      {isSelectingDirectory && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[9999] cursor-not-allowed flex items-center justify-center">
          <div className="bg-white dark:bg-darkModeDropdown p-4 rounded-lg shadow-lg max-w-md text-center">
            <h3 className="text-lg font-medium mb-2 dark:text-gray-200">
              Directory Selection In Progress
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Please complete the directory selection dialog before continuing.
            </p>
          </div>
        </div>
      )}
      <div className="bg-white border border-darkModeCompliment dark:bg-darkModeDropdown rounded-lg pt-4 pr-6 pl-6 pb-4 max-w-2xl w-full mx-4 max-h-[100vh] overflow-y-auto">
        {/* Left side - Form */}
        <div className="w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold dark:text-gray-200">
              Download Options
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
              {/* End of Upload Button */}
              {/* URL Name */}
              <div>
                <label className="text-sm block dark:text-gray-200 mt-4 mb-[-2]">
                  Speed Limit:
                  {biteVal === 0 ? ` No limit` : ` (${biteVal} ${biteUnitVal})`}
                </label>
                <div className="flex gap-4 items-center">
                  <div className="flex-1">
                    <Slider
                      defaultValue={[biteVal]}
                      value={[biteVal]}
                      onValueChange={(value) => setbiteVal(value[0])}
                      max={200}
                      step={1}
                    />
                  </div>

                  <div className="w-48">
                    <select
                      value={biteUnit}
                      onChange={(e) => {
                        setBiteUnit(e.target.value);
                        const selectedBite = biteOptions.find(
                          (bite) => bite.biteDisplayName === e.target.value,
                        );
                        if (selectedBite) {
                          setBiteUnitVal(selectedBite.biteUnitVal);
                        }
                      }}
                      className="w-full border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none [&>option]:dark:bg-darkMode"
                    >
                      {biteOptions.map((bite) => (
                        <option
                          key={bite.biteUnitVal}
                          value={bite.biteDisplayName}
                          className="dark:bg-darkMode dark:text-gray-200"
                        >
                          {bite.biteDisplayName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              {/* End of Schedule Name */}
              {/* Download Location Name */}
              <div className="flex gap-4 pt-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id="connection-limits"
                      checked={isConnectionLimitEnabled}
                      onChange={(e) =>
                        setIsConnectionLimitEnabled(e.target.checked)
                      }
                      className="w-4 h-4 text-primary rounded focus:ring-primary"
                    />
                    <label
                      htmlFor="connection-limits"
                      className="text-sm block dark:text-gray-200 text-nowrap font-bold cursor-pointer"
                    >
                      Connection Limits
                    </label>
                    <hr className="flex-grow border-t-1 border-divider dark:border-gray-700 ml-2" />
                  </div>
                  <div
                    className={
                      isConnectionLimitEnabled
                        ? ''
                        : 'opacity-50 pointer-events-none'
                    }
                  >
                    <div className="flex flex-row items-center gap-4 ml-2">
                      <label className="flex-1 dark:text-gray-200">
                        Maximum Active Downloads
                      </label>
                      <select
                        value={maxDownload}
                        onChange={(e) => setMaxDownload(Number(e.target.value))}
                        className="w-24 border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none [&>option]:dark:bg-darkMode"
                        disabled={!isConnectionLimitEnabled}
                      >
                        {[...Array(10)].map((_, index) => (
                          <option key={index} value={index + 1}>
                            {index + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              {/* End of Download Location Name */}
            </div>

            {/* Add the background running toggle after the connection limits section */}
            <div className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <label className="block dark:text-gray-200 text-nowrap font-bold">
                  Application Behavior
                </label>
                <hr className="flex-grow border-t-1 border-divider dark:border-gray-700 ml-2" />
              </div>

              <div className="flex items-center gap-2 mt-3 ml-2">
                <input
                  type="checkbox"
                  id="run-in-background"
                  checked={runInBackground}
                  onChange={(e) => {
                    console.log('Checkbox toggled:', e.target.checked);
                    setRunInBackground(e.target.checked);
                  }}
                  className="w-4 h-4 text-primary rounded focus:ring-primary"
                />
                <label
                  htmlFor="run-in-background"
                  className="dark:text-gray-200 cursor-pointer"
                >
                  Run in background when window is closed
                </label>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">
                When disabled, closing the window will completely exit the
                application
              </div>
            </div>
            {/* 
            <div className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <label className="block dark:text-gray-200 text-nowrap font-bold">
                  Plugins
                </label>
                <hr className="flex-grow border-t-1 border-divider dark:border-gray-700 ml-2" />
              </div>
 
              <div className="flex gap-2 flex-wrap justify-between">
                <span className="mt-2 text-xs font-medium ml-2">
                  Note: Plugins is an experimental feature and might not work as
                  expected.
                </span>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isShowPlugin}
                      onChange={(e) => {
                        console.log(
                          'Checkbox toggled for plugin',
                          e.target.checked,
                        );
                        setIsShowPlugin(e.target.checked);
                      }}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
                  </label>
                </div>
              </div>
            </div>
            */}
            {/* Add column visibility section */}
            <div className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <label className="block dark:text-gray-200 text-nowrap font-bold">
                  Visible Columns
                </label>
                <hr className="flex-grow border-t-1 border-divider dark:border-gray-700 ml-2" />
              </div>

              <div className="grid grid-cols-4 gap-1 mt-2 ml-2">
                {columnOptions.map((column) => (
                  <div key={column.id} className="flex items-center mr-2">
                    <input
                      type="checkbox"
                      id={`column-${column.id}`}
                      checked={
                        localVisibleColumns.includes(column.id) ||
                        column.required
                      }
                      onChange={() =>
                        column.required ? null : handleToggleColumn(column.id)
                      }
                      disabled={column.required}
                      className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500 mr-2"
                    />
                    <label
                      htmlFor={`column-${column.id}`}
                      className={`dark:text-gray-200 mr-2 text-xs cursor-pointer ${
                        column.required ? 'font-semibold' : ''
                      }`}
                    >
                      {column.label}
                      {column.required && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          (required)
                        </span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* Button commands */}
        <hr className="solid mt-2 mb-2 -mx-6 w-[calc(100%+47px)] border-t-2 border-divider dark:border-darkModeCompliment" />

        <div className="flex gap-3 p-0">
          <div className="ml-auto flex gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              className="bg-primary text-white text-sm px-2 py-1 rounded-md hover:bg-orange-600 dark:hover:text-black dark:hover:bg-white"
            >
              Okay
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-2 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
        {/* End of Button commands */}
      </div>
    </div>
  );
};

export default SettingsModal;
