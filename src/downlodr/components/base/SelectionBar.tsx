import React from 'react';
import { LuX } from 'react-icons/lu';

interface SelectionBarProps {
  count: number;
  onClear: () => void;
}

const SelectionBar: React.FC<SelectionBarProps> = ({ count, onClear }) => {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-sm text-gray-700 dark:text-gray-200 flex-shrink-0">
      <span className="font-medium text-orange-700 dark:text-orange-400">
        {count} {count === 1 ? 'item' : 'items'} selected
      </span>
      <button
        onClick={onClear}
        className="ml-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
        aria-label="Clear selection"
      >
        <LuX size={13} />
        Clear
      </button>
    </div>
  );
};

export default SelectionBar;
