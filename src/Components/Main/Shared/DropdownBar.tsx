import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FaRegClock } from 'react-icons/fa6';
import SchedulerModal from '../Modal/SchedulerModal';
import DownloadModal from '../Modal/DownloadModal';

const DropdownBar = ({ className }: { className?: string }) => {
  const [activeMenu, setActiveMenu] = useState<'file' | 'task' | null>(null);
  const [isSchedulerModalOpen, setSchedulerModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const [isDownloadModalOpen, setDownloadModalOpen] = useState(false);

  const isSchedulePage = ['/scheduleTable', '/scheduleCalendar'].includes(
    location.pathname,
  );

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

  return (
    <div
      className={`${className} flex items-center justify-between relative z-48`}
      ref={dropdownRef}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            className={`px-2 py-1 hover:bg-gray-100 rounded font-semibold ${
              activeMenu === 'file' ? 'bg-gray-100 font-semibold' : ''
            }`}
            onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <div className="absolute left-0 mt-1 w-48 bg-white border rounded-md shadow-lg py-1 z-50">
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 font-semibold"
                onClick={() => {
                  setDownloadModalOpen(true);
                  setActiveMenu(null);
                }}
              >
                <span>+ New Download</span>
              </button>
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 font-semibold"
                onClick={() => window.downlodrFunctions.closeApp()}
              >
                <span>K Exit</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            className={`px-2 py-1 hover:bg-gray-100 rounded font-semibold${
              activeMenu === 'task' ? 'bg-gray-100 font-semibold' : ''
            }`}
            onClick={() => setActiveMenu(activeMenu === 'task' ? null : 'task')}
          >
            Task
          </button>
          {activeMenu === 'task' && (
            <div className="absolute left-0 mt-1 w-48 bg-white border rounded-md shadow-lg py-1 z-50">
              <button className="w-full text-left px-4 py-2 hover:bg-gray-100 font-semibold">
                Start All
              </button>
              <button className="w-full text-left px-4 py-2 hover:bg-gray-100 font-semibold">
                Stop All
              </button>
            </div>
          )}
        </div>

        <button className="px-2 py-1 hover:bg-gray-100 rounded">
          <NavLink to="/scheduleTable" className={'scheduler font-semibold'}>
            <span className="ml-2">Scheduler</span>
          </NavLink>{' '}
        </button>

        <button
          className="px-2 py-1 hover:bg-gray-100 rounded font-semibold"
          onClick={() => window.electronDevTools.toggle()}
        >
          Browser
        </button>

        <button className="px-2 py-1 hover:bg-gray-100 rounded font-semibold">
          Settings
        </button>
      </div>

      {/* Right side button */}
      {isSchedulePage && (
        <button
          className="primary-custom-btn px-[6px] py-[3px] sm:px-[8px] sm:py-[4px] mr-2 sm:mr-4 flex items-center gap-1 sm:gap-2 text-sm sm:text-sm whitespace-nowrap"
          onClick={() => {
            setSchedulerModalOpen(true);
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

      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
      />
    </div>
  );
};

export default DropdownBar;
