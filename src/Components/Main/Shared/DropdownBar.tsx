/**
 * A custom React fixed component
 * A Fixed element in the header portion of Downlodr, displays the download options that are available through dropdowns such as:
 *  - File (Has options for Adding new download and closing app)
 *  - Task (Has options for Stopping or Starting All downloads)
 *  - Help (Opens Help Modal)
 *  - Console (Opens Console)
 *  - settings (Opens settings Modal)
 *  - About (Opens About Modal)
 *  - History (Navigates to History component)
 *
 * @param className - for UI of DropdownBar
 * @returns JSX.Element - The rendered component displaying a DropdownBar
 *
 */
import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { IoIosAdd } from 'react-icons/io';
import { RxExit, RxUpdate } from 'react-icons/rx';
import DownloadModal from '../Modal/DownloadModal';
import SettingsModal from '../Modal/SettingsModal';
import { useToast } from '../../SubComponents/shadcn/hooks/use-toast';
import useDownloadStore, {
  HistoryDownloads,
} from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import { usePluginStore } from '../../../Store/pluginStore';
import AboutModal from '../Modal/AboutModal';
import HelpModal from '../Modal/HelpModal';
import { processFileName } from '../../../DataFunctions/FilterName';
import { FiSearch, FiBook } from 'react-icons/fi';
import { MdOutlineHistory } from 'react-icons/md';
import { AiOutlineExclamationCircle } from 'react-icons/ai';

const DropdownBar = ({ className }: { className?: string }) => {
  // Dropdown element states
  const [activeMenu, setActiveMenu] = useState<'file' | 'help' | null>(null);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isDownloadModalOpen, setDownloadModalOpen] = useState(false);
  const [isAboutModalOpen, setAboutModalOpen] = useState(false);
  const [isHelpModalOpen, setHelpModalOpen] = useState(false);

  // Misc
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Store
  const { settings } = useMainStore();
  const { downloading, historyDownloads } = useDownloadStore();

  // Search
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<HistoryDownloads[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // Plug-ins:
  const showPlugin = true;
  const pluginVals = ['2', '2'];
  const { settingsPlugin } = usePluginStore();

  // Filter search results when search term changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSearchResults([]);
      return;
    }
    console.log(searchTerm);
    console.log(historyDownloads);
    const results = historyDownloads.filter((download) =>
      download.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    setSearchResults(results);
  }, [searchTerm, historyDownloads]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle opening the video file
  const handleOpenVideo = async (download: HistoryDownloads) => {
    try {
      const filePath = await window.downlodrFunctions.joinDownloadPath(
        download.location,
        download.downloadName,
      );
      window.downlodrFunctions.openVideo(filePath);
    } catch (error) {
      console.error('Error opening file:', error);
      toast({
        variant: 'destructive',
        title: 'Error Opening File',
        description: 'An error occurred while trying to open the file',
        duration: 3000,
      });
    }

    setShowResults(false);
    setSearchTerm('');
  };

  // UseEffect for clicking outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handles stopping all current downloads
  const handleStopAll = async () => {
    console.log('Stopping all downloads');
    const { deleteDownloading } = useDownloadStore.getState();

    if (downloading && downloading.length > 0) {
      for (const download of downloading) {
        console.log(`Attempting to stop download: ${download.id}`);

        if (download.controllerId) {
          try {
            const success = await window.ytdlp.killController(
              download.controllerId,
            );
            if (success) {
              deleteDownloading(download.id);
              console.log(
                `Controller with ID ${download.controllerId} has been terminated.`,
              );
              toast({
                variant: 'success',
                title: 'Download Stopped',
                description: 'Your download has stopped successfully',
                duration: 3000,
              });
            } else {
              toast({
                variant: 'destructive',
                title: 'Stop Download Error',
                description: `Could not stop current download with controller ${download.controllerId}`,
                duration: 3000,
              });
              // setCurrentDownloadId(download.id);
            }
          } catch (error) {
            toast({
              variant: 'destructive',
              title: 'Stop Download Error',
              description: `Could not stop current download with controller ${download.controllerId}`,
              duration: 3000,
            });
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Stop Download Error',
            description: `Could not stop current download with controller ${download.controllerId}`,
            duration: 3000,
          });
        }
      }
      // Clear selected downloads after stopping all
      // setSelectedDownloading([]);
    } else {
      toast({
        variant: 'destructive',
        title: 'No Downloads Found',
        description: `No current downloads to delete`,
        duration: 3000,
      });
    }
    // setSelectedDownloading([]);
  };

  // Handles starting all for downloads
  const handleStartAll = async () => {
    const { addDownload, forDownloads, removeFromForDownloads, downloading } =
      useDownloadStore.getState();
    if (forDownloads.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Downloads Available',
        description: 'No downloads available to start',
        duration: 3000,
      });
      return;
    }

    if (
      downloading.length >= settings.maxDownloadNum ||
      forDownloads.length > settings.maxDownloadNum
    ) {
      toast({
        variant: 'destructive',
        title: 'Download limit reached',
        description: `Maximum download limit (${settings.maxDownloadNum}) reached. Please wait for current downloads to complete or increase limit via settings.`,
        duration: 7000,
      });
      return;
    }

    for (const downloadInfo of forDownloads) {
      const processedName = await processFileName(
        downloadInfo.location,
        downloadInfo.name,
        downloadInfo.ext || downloadInfo.audioExt,
      );

      addDownload(
        downloadInfo.videoUrl,
        `${processedName}.${downloadInfo.ext}`,
        `${processedName}.${downloadInfo.ext}`,
        downloadInfo.size,
        downloadInfo.speed,
        downloadInfo.timeLeft,
        new Date().toISOString(),
        downloadInfo.progress,
        downloadInfo.location,
        'downloading',
        downloadInfo.ext,
        downloadInfo.formatId,
        downloadInfo.audioExt,
        downloadInfo.audioFormatId,
        downloadInfo.extractorKey,
        settings.defaultDownloadSpeed === 0
          ? ''
          : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
        downloadInfo.automaticCaption,
        downloadInfo.thumbnails,
        downloadInfo.getTranscript || false,
        downloadInfo.getThumbnail || false,
      );
      removeFromForDownloads(downloadInfo.id);
    }
  };

  const handleCheckForUpdates = async () => {
    console.log('Check for updates button clicked');
    console.log('updateAPI available:', !!window.updateAPI?.checkForUpdates);
    if (window.updateAPI?.checkForUpdates) {
      try {
        console.log('Calling checkForUpdates...');
        const result = await window.updateAPI.checkForUpdates();
        console.log('Update check result:', result);
        if (!result.hasUpdate) {
          toast({
            title: "You're up to date!",
            description: `You're using the latest version (v${result.currentVersion}).`,
            duration: 3000,
          });
        }
        setActiveMenu(null);
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    } else {
      console.error('updateAPI is not available');
      setActiveMenu(null);
    }
  };

  // use effect to close dropdown on window blur
  useEffect(() => {
    const handleWindowBlur = () => {
      setActiveMenu(null);
    };

    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  return (
    <div
      className={`${className} flex items-center justify-between relative z-48 py-4`}
      ref={dropdownRef}
      data-active-dropdown={activeMenu !== null}
      onClick={(e) => {
        // Only close if clicking the DropdownBar itself, not its children
        if (e.currentTarget === e.target) {
          setActiveMenu(null);
        }
      }}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            className={`px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded font-semibold ${
              activeMenu === 'file'
                ? 'bg-gray-100 dark:bg-gray-700 font-semibold'
                : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenu(activeMenu === 'file' ? null : 'file');
            }}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <div className="absolute left-0 mt-1 w-44 bg-white dark:bg-darkMode border dark:border-gray-700 rounded-md shadow-lg py-1 z-50">
              <div className="mx-1">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDownloadModalOpen(true);
                    setActiveMenu(null);
                  }}
                >
                  <IoIosAdd size={20} className="ml-[-2px]" />
                  <span>New Download</span>
                </button>
              </div>
              <div className="mx-1">
                <NavLink
                  to="/history"
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(null);
                  }}
                >
                  <MdOutlineHistory size={18} />
                  <span> History</span>
                </NavLink>
              </div>
              <div className="mx-1">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.downlodrFunctions.closeApp();
                  }}
                >
                  <RxExit />
                  <span>Exit</span>
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          className="px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded font-semibold"
          onClick={(e) => {
            e.stopPropagation();
            setSettingsModalOpen(true);
            setActiveMenu(null);
          }}
        >
          Settings
        </button>
        <div className="relative">
          <button
            className={`px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded font-semibold ${
              activeMenu === 'help'
                ? 'bg-gray-100 dark:bg-gray-700 font-semibold'
                : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenu(activeMenu === 'help' ? null : 'help');
            }}
          >
            Help
          </button>
          {activeMenu === 'help' && (
            <div className="absolute left-0 mt-1 w-44 bg-white dark:bg-darkMode border dark:border-gray-700 rounded-md shadow-lg py-1 z-50">
              <div className="mx-1">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHelpModalOpen(true);
                    setActiveMenu(null);
                  }}
                >
                  <FiBook size={16} />
                  <span>Guide</span>
                </button>
              </div>
              <div className="mx-1">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCheckForUpdates();
                  }}
                >
                  <RxUpdate size={16} />
                  <span>Check for Updates</span>
                </button>
              </div>
              <div className="mx-1">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAboutModalOpen(true);
                    setActiveMenu(null);
                  }}
                >
                  <AiOutlineExclamationCircle size={16} />
                  <span>About</span>
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          {pluginVals.length > 0 && settingsPlugin.isShowPlugin && (
            <NavLink
              to="/plugin-manager"
              className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded font-semibold"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenu(null);
              }}
            >
              <span> Plugins</span>
            </NavLink>
          )}
        </div>
      </div>
      {/* Search Bar with increased width */}
      <div ref={searchRef} className="relative my-10 mr-6 w-1/4">
        <div className="flex items-center dark:bg-[#30303C] rounded-md border border-[#D1D5DB] dark:border-none px-2">
          <FiSearch className="text-gray-500 dark:text-gray-400 h-4 w-4 mr-1" />
          <input
            type="text"
            placeholder="Search downloads..."
            className="py-1 px-2 bg-transparent focus:outline-none text-sm w-full"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (e.target.value.trim() !== '') {
                setShowResults(true);
              } else {
                setShowResults(false);
              }
            }}
            onFocus={() => {
              setActiveMenu(null);
              if (searchTerm.trim() !== '') {
                setShowResults(true);
              }
            }}
          />
        </div>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-gray-800 rounded-md shadow-lg z-10">
            {searchResults.map((download) => (
              <div
                key={download.id}
                className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm truncate"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenVideo(download);
                }}
                title={download.name}
              >
                {download.name}
              </div>
            ))}
          </div>
        )}

        {/* No Results Message */}
        {showResults &&
          searchTerm.trim() !== '' &&
          searchResults.length === 0 && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10">
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                No downloads found
              </div>
            </div>
          )}
      </div>

      {/* Right side button */}
      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />

      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
      />
      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
      />
    </div>
  );
};

export default DropdownBar;
