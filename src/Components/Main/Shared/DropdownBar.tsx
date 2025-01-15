import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FaRegClock } from 'react-icons/fa6';

const DropdownBar = ({ className }: { className?: string }) => {
  const [activeMenu, setActiveMenu] = useState<'file' | 'task' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

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
      className={`${className} flex items-center justify-between relative z-50`}
      ref={dropdownRef}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            className={`px-2 py-1 hover:bg-gray-100 rounded ${
              activeMenu === 'file' ? 'bg-gray-100' : ''
            }`}
            onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <div className="absolute left-0 mt-1 w-48 bg-white border rounded-md shadow-lg py-1 z-50">
              <button className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                <span>+ New Download</span>
              </button>
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                onClick={() => window.downlodrFunctions.closeApp()}
              >
                <span>K Exit</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            className={`px-2 py-1 hover:bg-gray-100 rounded ${
              activeMenu === 'task' ? 'bg-gray-100' : ''
            }`}
            onClick={() => setActiveMenu(activeMenu === 'task' ? null : 'task')}
          >
            Task
          </button>
          {activeMenu === 'task' && (
            <div className="absolute left-0 mt-1 w-48 bg-white border rounded-md shadow-lg py-1 z-50">
              <button className="w-full text-left px-4 py-2 hover:bg-gray-100">
                Start All
              </button>
              <button className="w-full text-left px-4 py-2 hover:bg-gray-100">
                Stop All
              </button>
            </div>
          )}
        </div>

        <button className="px-2 py-1 hover:bg-gray-100 rounded">
          <NavLink to="/scheduleTable">
            <span className="ml-2">Scheduler</span>
          </NavLink>{' '}
        </button>

        <button
          className="px-2 py-1 hover:bg-gray-100 rounded"
          onClick={() => window.electronDevTools.toggle()}
        >
          Browser
        </button>

        <button className="px-2 py-1 hover:bg-gray-100 rounded">
          Settings
        </button>
      </div>

      {/* Right side button */}
      {isSchedulePage && (
        <button
          className="primary-custom-btn px-[8px] py-[4px] mr-4 flex items-center gap-2"
          onClick={() => {
            /* Add your action here */
          }}
        >
          <FaRegClock size={14} />
          Create Schedule
        </button>
      )}
    </div>
  );
};

export default DropdownBar;
