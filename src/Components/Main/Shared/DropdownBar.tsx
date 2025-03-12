/**
 * A custom React fixed component
 * A Fixed element in the header portion of Downlodr, displays the download options that are available through dropdowns such as:
 *  - File (Has options for Adding new download and closing app)
 *  - Task (Has options for Stopping or Starting All downloads)
 *  - Help (Opens Help Modal)
 *  - Console (Opens Console)
 *  - Settings (Opens Settings Modal)
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
import { RxExit } from 'react-icons/rx';
import DownloadModal from '../Modal/DownloadModal';
import SettingsModal from '../Modal/SettingsModal';
import { useToast } from '../../SubComponents/shadcn/hooks/use-toast';
import useDownloadStore from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import AboutModal from '../Modal/AboutModal';
import HelpModal from '../Modal/HelpModal';
import { processFileName } from '../../../DataFunctions/FilterName';

const DropdownBar = ({ className }: { className?: string }) => {
  // Dropdown element states
  const [activeMenu, setActiveMenu] = useState<'file' | 'task' | null>(null);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isDownloadModalOpen, setDownloadModalOpen] = useState(false);
  const [isAboutModalOpen, setAboutModalOpen] = useState(false);
  const [isHelpModalOpen, setHelpModalOpen] = useState(false);

  // Misc
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Store
  const { settings } = useMainStore();
  const { downloading } = useDownloadStore();

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
              });
            } else {
              toast({
                variant: 'destructive',
                title: 'Stop Download Error',
                description: `Could not stop current download with controller ${download.controllerId}`,
              });
              // setCurrentDownloadId(download.id);
            }
          } catch (error) {
            toast({
              variant: 'destructive',
              title: 'Stop Download Error',
              description: `Could not stop current download with controller ${download.controllerId}`,
            });
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Stop Download Error',
            description: `Could not stop current download with controller ${download.controllerId}`,
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
      );
      removeFromForDownloads(downloadInfo.id);
    }
  };

  return (
    <div
      className={`${className} flex items-center justify-between relative z-48`}
      ref={dropdownRef}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            className={`px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded font-semibold ${
              activeMenu === 'file'
                ? 'bg-gray-100 dark:bg-gray-700 font-semibold'
                : ''
            }`}
            onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-darkMode border dark:border-gray-700 rounded-md shadow-lg py-1 z-50">
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 font-semibold dark:text-gray-200 flex"
                onClick={() => {
                  // handleOpenDownloadModal();
                  setDownloadModalOpen(true);
                  setActiveMenu(null);
                }}
              >
                <IoIosAdd size={18} className="mr-[-2px]" />
                <span>New Download</span>
              </button>
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 font-semibold dark:text-gray-200 flex"
                onClick={() => window.downlodrFunctions.closeApp()}
              >
                <RxExit />
                <span>Exit</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            className={`px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded font-semibold ${
              activeMenu === 'task'
                ? 'bg-gray-100 dark:bg-gray-700 font-semibold'
                : ''
            }`}
            onClick={() => setActiveMenu(activeMenu === 'task' ? null : 'task')}
          >
            Task
          </button>
          {activeMenu === 'task' && (
            <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-darkMode border dark:border-gray-700 rounded-md shadow-lg py-1 z-50">
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold dark:text-gray-200"
                onClick={() => handleStartAll()}
              >
                Start All
              </button>
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold dark:text-gray-200"
                onClick={() => handleStopAll()}
              >
                Stop All
              </button>
            </div>
          )}
        </div>

        <button
          className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded font-semibold"
          onClick={() => setHelpModalOpen(true)}
        >
          Help
        </button>
        <button
          className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded font-semibold"
          onClick={() => window.electronDevTools.toggle()}
        >
          Console
        </button>

        <button
          className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded font-semibold"
          onClick={() => {
            setSettingsModalOpen(true);
            setActiveMenu(null);
          }}
        >
          Settings
        </button>

        <button
          className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded font-semibold"
          onClick={() => {
            setAboutModalOpen(true);
            setActiveMenu(null);
          }}
        >
          About
        </button>
        <NavLink
          to="/history"
          className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded scheduler font-semibold"
        >
          <span> History</span>
        </NavLink>
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
