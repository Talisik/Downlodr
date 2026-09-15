import React from 'react';
import { GoChevronRight } from 'react-icons/go';

interface ContextMenuItemProps {
  icon: React.ReactNode;
  label: string;
  chevron?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  buttonRef?: React.RefObject<HTMLButtonElement>;
}

const ContextMenuItem = React.forwardRef<HTMLButtonElement, ContextMenuItemProps>(
  ({ icon, label, chevron = false, onClick, buttonRef }, ref) => {
    return (
      <button
        ref={buttonRef ?? ref}
        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2"
        onClick={onClick}
      >
        <span className="flex items-center gap-2 flex-1">
          <span className="inline-flex items-center justify-center shrink-0">
            {icon}
          </span>
          <span>{label}</span>
        </span>
        {chevron && (
          <span className="ml-auto">
            <GoChevronRight size={16} />
          </span>
        )}
      </button>
    );
  },
);

ContextMenuItem.displayName = 'ContextMenuItem';

export default ContextMenuItem;
