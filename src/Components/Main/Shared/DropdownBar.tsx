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
import { useEffect, useRef, useState } from 'react';
import { AiOutlineExclamationCircle } from 'react-icons/ai';
import { FiBook, FiSearch } from 'react-icons/fi';
import { IoIosAdd } from 'react-icons/io';
import { MdOutlineHistory } from 'react-icons/md';
import { RxExit, RxUpdate } from 'react-icons/rx';
import { NavLink } from 'react-router-dom';
import FileNotExistModal, {
  DownloadItem,
} from '../../../Components/SubComponents/custom/FileNotExistModal';
import useDownloadStore, {
  HistoryDownloads,
} from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import { useToast } from '../../SubComponents/shadcn/hooks/use-toast';
import AboutModal from '../Modal/AboutModal';
import DownloadModal from '../Modal/DownloadModal';
import HelpModal from '../Modal/HelpModal';
import SettingsModal from '../Modal/SettingsModal';
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
  const { historyDownloads } = useDownloadStore();

  // Search
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<HistoryDownloads[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // Downloads
  const [showFileNotExistModal, setShowFileNotExistModal] = useState(false);
  const [missingFiles, setMissingFiles] = useState<DownloadItem[]>([]);
  const selectedDownloads = useMainStore((state) => state.selectedDownloads);

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

  const handleFileNotExistModal = async (
    contextDownload: DownloadItem | null = null,
  ) => {
    const missing = [];

    // If a specific download is provided via context menu, check only that one
    const downloadsToCheck = contextDownload
      ? [contextDownload]
      : selectedDownloads;

    // Check each download to see if it exists
    for (const download of downloadsToCheck) {
      if (download.status === 'finished' && download.location) {
        const exists = await window.downlodrFunctions.fileExists(
          download.location,
        );
        if (!exists) {
          missing.push(download);
        }
      }
    }

    // Set the missing files and show the modal if any were found
    if (missing.length > 0) {
      setMissingFiles(missing);
      setShowFileNotExistModal(true);
    } else {
      toast({
        variant: 'default',
        title: 'All Files Exist',
        description: 'All selected files exist at their locations',
        duration: 3000,
      });
    }
  };
  // Handle opening the video file
  const handleOpenVideo = async (download: HistoryDownloads) => {
    if (download.location) {
      const downloadLocation = await window.downlodrFunctions.joinDownloadPath(
        download.location,
        download.downloadName,
      );
      try {
        const exists = await window.downlodrFunctions.fileExists(
          downloadLocation,
        );
        if (exists) {
          window.downlodrFunctions.openVideo(downloadLocation);
        } else {
          // If the file doesn't exist, find the download and show the modal
          if (download.id) {
            const foundDownload = historyDownloads.find(
              (d) => d.id === download.id,
            );
            if (foundDownload) {
              // Pass the specific download to the modal function
              const downloadItem: DownloadItem = {
                id: foundDownload.id,
                videoUrl: foundDownload.videoUrl,
                location: downloadLocation,
                name: foundDownload.name,
                ext: foundDownload.ext,
                downloadName: foundDownload.downloadName,
                extractorKey: foundDownload.extractorKey,
                status: foundDownload.status,
                download: {
                  ...foundDownload,
                },
              };
              handleFileNotExistModal(downloadItem);
            }
          } else {
            // In case we don't have the download ID, show a simple toast
            if (download.id) {
              const foundDownload = historyDownloads.find(
                (d) => d.id === download.id,
              );
              if (foundDownload) {
                // Pass the specific download to the modal function
                const downloadItem: DownloadItem = {
                  id: foundDownload.id,
                  videoUrl: foundDownload.videoUrl,
                  location: foundDownload.location,
                  name: foundDownload.name,
                  ext: foundDownload.ext,
                  downloadName: foundDownload.downloadName,
                  extractorKey: foundDownload.extractorKey,
                  status: foundDownload.status,
                  download: {
                    ...foundDownload,
                  },
                };
                handleFileNotExistModal(downloadItem);
              }
            }
            toast({
              variant: 'destructive',
              title: 'File Not Found',
              description: `The file does not exist at the specified location`,
              duration: 3000,
            });
          }
        }
      } catch (error) {
        console.error('Error viewing download:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description:
            error?.message || String(error) || 'Failed to view download',
          duration: 5000,
        });
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'No Download Location',
        description: 'Invalid Download Location',
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
            className={`px-3 py-1 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded font-semibold ${
              activeMenu === 'file'
                ? 'bg-gray-100 dark:bg-darkModeCompliment font-semibold'
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
            <div className="absolute left-0 mt-1 w-44 bg-white dark:bg-darkModeDropdown border dark:border-gray-700 rounded-md shadow-lg py-1 z-50">
              <div className="mx-1">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
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
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
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
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
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
          className="px-3 py-1 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded font-semibold"
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
            className={`px-3 py-1 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded font-semibold ${
              activeMenu === 'help'
                ? 'bg-gray-100 dark:bg-darkModeCompliment font-semibold'
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
            <div className="absolute left-0 mt-1 w-44 bg-white dark:bg-darkModeDropdown border dark:border-gray-700 rounded-md shadow-lg py-1 z-50">
              <div className="mx-1">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
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
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
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
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
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
      </div>
      {/* Search Bar with increased width */}
      <div ref={searchRef} className="relative my-10 mr-6 w-1/4">
        <div className="flex items-center dark:bg-darkModeDropdown rounded-md border border-[#D1D5DB] dark:border-none px-2">
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
                className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment cursor-pointer text-sm truncate"
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
      <FileNotExistModal
        isOpen={showFileNotExistModal}
        onClose={() => setShowFileNotExistModal(false)}
        selectedDownloads={missingFiles}
      />
    </div>
  );
};

export default DropdownBar;
