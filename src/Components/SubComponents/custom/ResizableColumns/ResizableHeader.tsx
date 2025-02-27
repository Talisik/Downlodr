/**
 *  A custom React component
 * Component for the table headers, holds table name and resizable border which will resize length of header column
 *
 * @param ResizableHeaderProps
 *   @param children - content of each header column (usually header name as a string)
 *   @param width - a number that specifies the width of the header column in pixels. It is used to set the inline style of the <th> element to control its width.
 *   @param onResizeStart - a function that takes a React.MouseEvent as an argument. It is called when the user starts resizing the header column. This function typically contains the logic to handle the resizing action.
 *   @param showSort - optional boolean parameter (defaults to true). if the chev icon will be shown
 *
 * @returns JSX.Element - The rendered component displaying a TitleBar
 *
 */
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
      <div className="flex items-center gap-[1px]">
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
        <div className="absolute right-[6px] top-0 h-full w-[2px] bg-gray-300 dark:bg-gray-700 group-hover:bg-blue-500" />
      </div>
    </th>
  );
};

export default ResizableHeader;
