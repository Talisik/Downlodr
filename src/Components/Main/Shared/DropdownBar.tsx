import React from 'react';

interface DropdownBarProps {
  className?: string;
}

const DropdownBar: React.FC<DropdownBarProps> = ({ className }) => {
  return (
    <div className={className}>
      <div className="flex space-x-4 px-4 items-center h-full">
        <button className="hover:bg-gray-100 px-2">File</button>
        <button className="hover:bg-gray-100 px-2">Task</button>
        <button className="hover:bg-gray-100 px-2">Scheduler</button>
        <button className="hover:bg-gray-100 px-2">Browser</button>
        <button className="hover:bg-gray-100 px-2">Settings</button>
      </div>
    </div>
  );
};

export default DropdownBar;