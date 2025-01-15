import React, { useState } from 'react';
import { GoDownload } from 'react-icons/go';
import { VscPlayCircle } from 'react-icons/vsc';
import { PiStopCircle } from 'react-icons/pi';
import DownloadModal from '../Modal/DownloadModal';

interface TaskBarProps {
  className?: string;
}

const TaskBar: React.FC<TaskBarProps> = ({ className }) => {
  const [isDownloadModalOpen, setDownloadModalOpen] = useState(false);

  return (
    <>
      <div className={className}>
        <div className="flex items-center h-full px-4 space-x-2">
          <button
            onClick={() => setDownloadModalOpen(true)}
            className="text-sm bg-primary text-white font-normal px-[10px] py-[8px] hover:bg-gray-100 rounded flex gap-2"
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
      </div>

      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
      />
    </>
  );
};

export default TaskBar;
