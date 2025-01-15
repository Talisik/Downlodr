import React, { useState } from 'react';
import { GoDownload } from 'react-icons/go';
import { VscPlayCircle } from 'react-icons/vsc';
import { PiStopCircle } from 'react-icons/pi';
import DownloadModal from '../Modal/DownloadModal';
import { useLocation, NavLink } from 'react-router-dom';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '../../SubComponents/shadcn/components/ui/tabs';
import { RiTable3, RiCalendarLine } from 'react-icons/ri';

interface TaskBarProps {
  className?: string;
}

const TaskBar: React.FC<TaskBarProps> = ({ className }) => {
  const [isDownloadModalOpen, setDownloadModalOpen] = useState(false);
  const location = useLocation();

  const isSchedulePage = ['/scheduleTable', '/scheduleCalendar'].includes(
    location.pathname,
  );

  // Determine default value based on current path
  const defaultTab = location.pathname.includes('Calendar')
    ? 'calendar'
    : 'table';

  return (
    <>
      <div className={`${className} flex items-center justify-between`}>
        <div className="flex items-center h-full px-4 space-x-2">
          <button
            onClick={() => setDownloadModalOpen(true)}
            className="primary-custom-btn px-[10px] py-[8px]"
          >
            <GoDownload size={16} /> Add URL
          </button>
          <button className="hover:bg-gray-100 px-3 py-1 rounded flex gap-1 font-semibold">
            {' '}
            <VscPlayCircle size={18} className="mt-[0.9px]" /> Play
          </button>
          <button className="hover:bg-gray-100 px-3 py-1 rounded flex gap-1 font-semibold">
            {' '}
            <PiStopCircle size={18} className="mt-[0.9px]" /> Stop
          </button>
          <button className="hover:bg-gray-100 px-3 py-1 rounded flex gap-1 font-semibold">
            {' '}
            <PiStopCircle size={18} className="mt-[0.9px]" /> Stop All
          </button>
        </div>
        {/* Right side button */}
        {isSchedulePage && (
          <Tabs defaultValue={defaultTab} className="w-[100px]">
            <TabsList>
              <TabsTrigger value="table" asChild>
                <NavLink to="/scheduleTable" className="w-full">
                  <RiTable3 size={18} />
                </NavLink>
              </TabsTrigger>
              <TabsTrigger value="calendar" asChild>
                <NavLink to="/scheduleCalendar" className="w-full">
                  <RiCalendarLine size={18} />
                </NavLink>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
      />
    </>
  );
};

export default TaskBar;
