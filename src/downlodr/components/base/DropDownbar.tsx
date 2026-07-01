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
import { ToastAction } from '@/core-app/components/shadcn/components/ui/toast';
import { useToast } from '@/core-app/components/shadcn/hooks/use-toast';
import AboutModal from '@/downlodr/components/modal/custom/AboutModal';
import FileNotExistModal from '@/downlodr/components/modal/custom/FileNotExistModal';
import HelpModal from '@/downlodr/components/modal/custom/HelpModal';
import SettingsModal from '@/downlodr/components/modal/custom/SettingsModal';
import { DownloadItem } from '@/downlodr/schema/componentSchema';
import {
  HistoryDownloads,
  useDownloadStore,
} from '@/downlodr/store/downloadStore';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import { useDropdownAnimation } from '@/core-app/hooks/animation/useDropdownAnimation';
import { useEffect, useRef, useState } from 'react';
import { AiOutlineExclamationCircle } from 'react-icons/ai';
import { FiBook, FiSearch } from 'react-icons/fi';
import { LuRefreshCw } from 'react-icons/lu';
import { MdOutlineHistory } from 'react-icons/md';
import { RxExit, RxUpdate } from 'react-icons/rx';
import { NavLink } from 'react-router-dom';

const DropdownBar = ({ className }: { className?: string }) => {
  // Dropdown element states
  const [activeMenu, setActiveMenu] = useState<
    'file' | 'help' | 'help2' | null
  >(null);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isAboutModalOpen, setAboutModalOpen] = useState(false);
  const [isHelpModalOpen, setHelpModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Store
  const { historyDownloads } = useDownloadStore();
  const activeButton = useTaskbarDownloadStore((state) => state.activeButton);
  const setActiveButton = useTaskbarDownloadStore(
    (state) => state.setActiveButton,
  );

  const { ref: fileRef, mounted: fileMounted } = useDropdownAnimation(activeMenu === 'file');
  const { ref: helpRef, mounted: helpMounted } = useDropdownAnimation(activeMenu === 'help');

  // Search
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<HistoryDownloads[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // modal
  const [showFileNotExistModal, setShowFileNotExistModal] = useState(false);
  const [missingFile, setMissingFile] = useState<DownloadItem | null>(null);

  // Filter search results when search term changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSearchResults([]);
      return;
    }
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

  // Update the handleOpenVideo function to check if the file exists first
  const handleOpenVideo = async (download: HistoryDownloads) => {
    try {
      const filePath = await window.downlodrFunctions.joinDownloadPath(
        download.location,
        download.downloadName,
      );

      // Check if the file exists before trying to open it
      const exists = await window.downlodrFunctions.fileExists(filePath);

      if (exists) {
        window.downlodrFunctions.openVideo(filePath);
      } else {
        // If the file doesn't exist, prepare the download item for the modal
        const downloadItem: DownloadItem = {
          id: download.id,
          videoUrl: download.videoUrl,
          location: filePath,
          name: download.name,
          ext: download.ext,
          downloadName: download.downloadName,
          extractorKey: download.extractorKey,
          status: download.status,
          download: {
            displayName: download.displayName || '',
            ...download,
          },
        };

        // Set the missing file and show the modal
        setMissingFile(downloadItem);
        setShowFileNotExistModal(true);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error Opening File',
        description: error?.message || String(error) || 'Failed to open file',
        duration: 5000,
        expandable: true,
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
      } else {
        if (activeButton) {
          setActiveButton(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = () => {
    toast({
      title: 'Download Started',
      description:
        'Your file is being downloaded. This may take a few minutes depending on the file size and your connection speed.',
      variant: 'destructive',
      expandable: true, // Add this to make it expandable
      duration: 5500,
      action: (
        <ToastAction
          altText="Retry connection check"
          onClick={handleCheckForUpdates}
        >
          <LuRefreshCw size={12} className="mt-0.5" />
        </ToastAction>
      ),
    });
  };

  const handleCheckForUpdates = async () => {
    // Show connection checking toast
    toast({
      title: 'Checking connection',
      description: 'Verifying internet connectivity...',
      duration: 5500, // Slightly longer than the 5s timeout
    });

    const hasInternet =
      await window.downlodrFunctions.checkInternetConnection();

    if (!hasInternet) {
      toast({
        variant: 'destructive',
        title: 'No internet connection',
        description: `Please check your internet connection and try again`,
        duration: 5000,
        action: (
          <ToastAction
            altText="Retry connection check"
            onClick={handleCheckForUpdates}
          >
            Retry
          </ToastAction>
        ),
      });
      setActiveMenu(null);
      return;
    }

    console.log(hasInternet);
    toast({
      title: 'Checking for updates',
      description: `Currently checking for new updates, please wait`,
      duration: 3000,
    });

    if (window.updateAPI?.checkForUpdates && hasInternet) {
      try {
        const result = await window.updateAPI.checkForUpdates();
        if (result.error) {
          toast({
            variant: 'destructive',
            title: 'Update Check Failed',
            description: result.error,
            duration: 4000,
          });
        } else if (result.hasUpdate) {
          toast({
            title: `Update v${result.latestVersion} available`,
            description: 'Downloading in the background...',
            duration: 4000,
          });
        } else {
          toast({
            title: "You're up to date!",
            description: `You're using the latest version (v${result.currentVersion}).`,
            duration: 3000,
          });
        }
        setActiveMenu(null);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Update Check Failed',
          description: 'Unable to check for updates. Please try again later.',
          duration: 3000,
        });
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
          {fileMounted && (
            <div ref={fileRef} className="absolute left-0 mt-1 w-[100px] bg-white dark:bg-darkModeDropdown border dark:border-gray-700 rounded-md shadow-lg py-1 z-50">
              <div className="mx-1">
                <NavLink
                  to="/history"
                  className="w-full text-left px-1 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(null);
                  }}
                >
                  <MdOutlineHistory size={18} className="mr-[-2px]" />
                  <span className="text-xs"> History</span>
                </NavLink>
              </div>
              <div className="mx-1">
                <button
                  className="w-full text-left px-1 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.downlodrFunctions.closeApp();
                    setActiveMenu(null);
                  }}
                >
                  <RxExit size={16} />
                  <span className="text-xs">Exit</span>
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
          {helpMounted && (
            <div ref={helpRef} className="absolute left-0 mt-1 w-[125px] bg-white dark:bg-darkModeDropdown border dark:border-gray-700 rounded-md shadow-lg py-1 z-50">
              <div className="mx-1">
                <button
                  className="w-full text-left px-1 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHelpModalOpen(true);
                    setActiveMenu(null);
                  }}
                >
                  <FiBook size={16} />
                  <span className="text-xs">Guide</span>
                </button>
              </div>
              <div className="mx-1">
                <button
                  className="w-full text-left px-1 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCheckForUpdates();
                  }}
                >
                  <RxUpdate size={16} />
                  <span className="text-xs">App Updates</span>
                </button>
              </div>
              <div className="mx-1">
                <button
                  className="w-full text-left px-1 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAboutModalOpen(true);
                    setActiveMenu(null);
                  }}
                >
                  <AiOutlineExclamationCircle size={16} />
                  <span className="text-xs">About</span>
                </button>
              </div>
            </div>
          )}
        </div>
        {/*
        <button
          onClick={async () => {
            try {
              await selectAndTranscribe({
                language: 'en',
                format: 'srt',
              });
            } catch (error) {
              toast({
                title: 'Transcription Error',
                description:
                  error instanceof Error
                    ? error.message
                    : 'Failed to transcribe video',
                variant: 'destructive',
                duration: 5000,
              });
            }
          }}
          className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Transcribe Video
        </button>
        */}
      </div>
      {/* Search Bar */}

      <div ref={searchRef} className="relative my-10 mr-6 w-1/4 hidden">
        <div className="flex items-center dark:bg-darkModeDropdown rounded-md border border-[#D1D5DB] dark:border-none px-2">
          <FiSearch className="text-gray-500 dark:text-gray-400 h-4 w-4 mr-1" />
          <input
            type="text"
            placeholder="Search downloads..."
            className="py-1 px-2 bg-transparent focus:outline-none text-xs w-full"
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
                className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment cursor-pointer text-xs truncate"
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
              <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
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

      <FileNotExistModal
        isOpen={showFileNotExistModal}
        onClose={() => setShowFileNotExistModal(false)}
        selectedDownloads={missingFile ? [missingFile] : []}
        download={missingFile}
      />
    </div>
  );
};

export default DropdownBar;
