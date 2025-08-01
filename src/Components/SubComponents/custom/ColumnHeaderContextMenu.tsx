import { cn } from '@/Components/SubComponents/shadcn/lib/utils';
import React, { useEffect, useRef } from 'react';

interface ColumnOption {
  id: string;
  label: string;
  required: boolean;
}

interface ColumnHeaderContextMenuProps {
  position: { x: number; y: number };
  visible: boolean;
  visibleColumns: string[];
  onToggleColumn: (columnId: string) => void;
  onClose: () => void;
  columnOptions: ColumnOption[];
}

const ColumnHeaderContextMenu: React.FC<ColumnHeaderContextMenuProps> = ({
  position,
  visible,
  visibleColumns,
  onToggleColumn,
  onClose,
  columnOptions,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Add effect to handle clicks outside menu
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="justify-start absolute bg-white dark:bg-darkMode border-2 py-2 dark:border-gray-700 rounded-md shadow-lg z-50 min-w-[149px]"
      style={{ left: position.x + 60, top: position.y + 140 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Column options */}
      {columnOptions.map((column) => (
        <div
          key={column.id}
          className={cn(
            'flex items-center pr-4 pl-4 py-1 hover:bg-gray-100 dark:hover:bg-darkModeHover rounded',
            column.required &&
              'cursor-not-allowed rounded-none bg-gray-200 hover:bg-gray-200 dark:bg-darkModeHover dark:hover:bg-darkModeHover opacity-25',
          )}
        >
          <input
            type="checkbox"
            id={`header-column-${column.id}`}
            checked={visibleColumns.includes(column.id) || column.required}
            onChange={() => {
              if (!column.required) {
                onToggleColumn(column.id);
              }
            }}
            disabled={column.required}
            className="mr-3 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
          />
          <label
            htmlFor={`header-column-${column.id}`}
            className={`font-medium text-[12px] leading-[22px] tracking-normal dark:text-gray-200 ${
              column.required ? 'font-semibold' : ''
            }`}
          >
            {column.label}
          </label>
        </div>
      ))}
    </div>
  );
};

export default ColumnHeaderContextMenu;
