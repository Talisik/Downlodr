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

const DropdownBar = ({ className }: { className?: string }) => {
  const [activeMenu, setActiveMenu] = useState<'file' | 'task' | null>(null);
  const [isSchedulerModalOpen, setSchedulerModalOpen] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isAboutModalOpen, setAboutModalOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const [isDownloadModalOpen, setDownloadModalOpen] = useState(false);

  const isSchedulePage = ['/scheduleTable', '/scheduleCalendar'].includes(
    location.pathname,
  );

  const { toast } = useToast();
  const { settings } = useMainStore();
  const { downloading } = useDownloadStore();

  const handleOpenDownloadModal = () => {
    // Check if connection limits are enabled
    if (settings.permitConnectionLimit) {
      // Check if current downloads are at or above the limit
      if (downloading.length >= settings.maxDownloadNum) {
        toast({
          variant: 'destructive',
          title: 'Download limit reached',
          description: `Maximum download limit (${settings.maxDownloadNum}) reached. Please wait for current downloads to complete.`,
        });
        return;
      }
    }

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
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // If we pass the checks, open the modal
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
                  handleOpenDownloadModal();
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
              <button className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold dark:text-gray-200">
                Start All
              </button>
              <button className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold dark:text-gray-200">
                Stop All
              </button>
            </div>
          )}
        </div>

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
          className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded font-semibold"
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
