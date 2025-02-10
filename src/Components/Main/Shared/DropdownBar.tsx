import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FaRegClock } from 'react-icons/fa6';
import { IoIosAdd } from 'react-icons/io';
import { RxExit } from 'react-icons/rx';
import SchedulerModal from '../Modal/SchedulerModal';
import DownloadModal from '../Modal/DownloadModal';
import SettingsModal from '../Modal/SettingsModal';
import { useToast } from '../../SubComponents/shadcn/hooks/use-toast';
import useDownloadStore from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import AboutModal from '../Modal/AboutModal';
import HelpModal from '../Modal/HelpModal';
import { processFileName } from '../../../DataFunctions/FilterName';

const DropdownBar = ({ className }: { className?: string }) => {
  const [activeMenu, setActiveMenu] = useState<'file' | 'task' | null>(null);
  const [isSchedulerModalOpen, setSchedulerModalOpen] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isDownloadModalOpen, setDownloadModalOpen] = useState(false);
  const [isAboutModalOpen, setAboutModalOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const selectedDownloads = useMainStore((state) => state.selectedDownloads);
  const clearAllSelections = useMainStore((state) => state.clearAllSelections);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const isSchedulePage = ['/scheduleTable', '/scheduleCalendar'].includes(
    location.pathname,
  );

  const { toast } = useToast();
  const { settings } = useMainStore();
  const { downloading } = useDownloadStore();

  // Move useEffect outside of handleOpenDownloadModal
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

  const handlePlaySelected = async () => {
    if (selectedDownloads.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Downloads Selected',
        description: 'Please select downloads to play',
      });
      return;
    }

    const { addDownload, forDownloads, removeFromForDownloads, downloading } =
      useDownloadStore.getState();

    // Filter selected downloads to only include those in forDownloads and remove duplicates
    const validDownloads = selectedDownloads.filter((download) =>
      forDownloads.some((fd) => fd.id === download.id),
    );
    const uniqueDownloads = [...new Set(validDownloads.map((d) => d.id))]
      .map((id) => validDownloads.find((d) => d.id === id))
      .filter((d): d is (typeof validDownloads)[0] => d !== undefined);

    // Clear selections immediately after filtering
    clearAllSelections();

    if (
      uniqueDownloads.length > settings.maxDownloadNum ||
      downloading.length >= settings.maxDownloadNum
    ) {
      toast({
        variant: 'destructive',
        title: 'Download limit reached',
        description: `Maximum download limit (${settings.maxDownloadNum}) reached. Please wait for current downloads to complete.`,
      });
      return;
    }

    for (const selectedDownload of uniqueDownloads) {
      const downloadInfo = forDownloads.find(
        (d) => d.id === selectedDownload.id,
      );

      if (downloadInfo) {
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
          `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
        );
        removeFromForDownloads(selectedDownload.id);
      }
    }
  };

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

  const handleStartAll = async () => {
    const { addDownload, forDownloads, removeFromForDownloads, downloading } =
      useDownloadStore.getState();
    console.log(
      `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
    );
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
        description: `Maximum download limit (${settings.maxDownloadNum}) reached. Please wait for current downloads to complete.`,
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
        `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
      );
      removeFromForDownloads(downloadInfo.id);
    }
  };

  const handleOpenDownloadModal = () => {
    setDownloadModalOpen(true);
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
        {/* 
        <button
          className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded font-semibold"
          onClick={() => setShowHelpModal(true)}
        >
          Help
        </button>
*/}
        {/*  <button className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <NavLink to="/scheduleTable" className={'scheduler font-semibold'}>
            <span className="ml-2">Scheduler</span>
          </NavLink>{' '}
        </button>*/}

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
      {isSchedulePage && (
        <button
          className="primary-custom-btn px-[6px] py-[3px] sm:px-[8px] sm:py-[4px] mr-2 sm:mr-4 flex items-center gap-1 sm:gap-2 text-sm sm:text-sm whitespace-nowrap dark:hover:text-black dark:hover:bg-white"
          onClick={() => {
            setSchedulerModalOpen(true);
            setActiveMenu(null);
          }}
        >
          <FaRegClock size={12} className="sm:w-[14px] sm:h-[14px]" />
          <span className="hidden sm:inline">Create Schedule</span>
          <span className="sm:hidden">Schedule</span>
        </button>
      )}

      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
      <SchedulerModal
        isOpen={isSchedulerModalOpen}
        onClose={() => setSchedulerModalOpen(false)}
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
