import React from 'react';

interface DropdownBarProps {
  className?: string;
}

const DropdownBar: React.FC<DropdownBarProps> = ({ className }) => {
  return (
    <div className={className}>
      <div className="flex space-x-4 px-4 items-center h-full">
        <button className="hover:bg-gray-100 px-2 font-semibold">File</button>
        <button className="hover:bg-gray-100 px-2 font-semibold">Task</button>
        <button className="hover:bg-gray-100 px-2 font-semibold">
          Scheduler
        </button>
        <button className="hover:bg-gray-100 px-2 font-semibold">
          Browser
        </button>
        <button className="hover:bg-gray-100 px-2 font-semibold">
          Settings
        </button>
      </div>
    </div>
  );
};

export default DropdownBar;
