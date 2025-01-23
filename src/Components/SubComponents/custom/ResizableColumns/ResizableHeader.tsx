import React from 'react';
import { HiChevronUpDown } from 'react-icons/hi2';

interface ResizableHeaderProps {
  children: React.ReactNode;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  showSort?: boolean;
}

const ResizableHeader: React.FC<ResizableHeaderProps> = ({
  children,
  width,
  onResizeStart,
  showSort = true,
}) => {
  return (
    <th
      className="relative p-2 font-semibold dark:text-gray-200 select-none"
      style={{ width: `${width}px` }}
    >
      <div className="flex items-center gap-2">
        {children}
        {showSort && (
          <HiChevronUpDown
            size={14}
            className="flex-shrink-0 dark:text-gray-400"
          />
        )}
      </div>
      <div
        className="absolute right-0 top-0 h-full w-4 cursor-col-resize hover:bg-blue-500/20 group -mr-2"
        onMouseDown={onResizeStart}
      >
        <div className="absolute right-[6px] top-0 h-full w-[2px] bg-gray-300 group-hover:bg-blue-500" />
      </div>
    </th>
  );
};

export default ResizableHeader;
