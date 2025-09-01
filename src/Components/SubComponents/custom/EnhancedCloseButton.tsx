/**
 * Enhanced Close Button Component
 * A properly styled close button that works across all modal systems
 */

import React from 'react';
import { MdOutlineClose } from 'react-icons/md';

interface EnhancedCloseButtonProps {
  onClose: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'subtle' | 'prominent' | 'inspector';
}

const EnhancedCloseButton: React.FC<EnhancedCloseButtonProps> = ({
  onClose,
  disabled = false,
  className = '',
  ariaLabel = 'Close dialog',
  size = 'md',
  variant = 'default',
}) => {
  const iconSize = size === 'lg' ? 18 : size === 'sm' ? 14 : 16;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClose();
    }
  };

  // Define variant-specific styles
  const getVariantStyles = () => {
    const baseStyles = `
      absolute right-1 top-1 z-[100]
      flex items-center justify-center
      cursor-pointer
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
      pointer-events-auto
    `;

    switch (variant) {
      case 'subtle':
        // Apple-like subtle hover effect - ensure full clickable area
        return `${baseStyles}
          h-9 w-9 p-2 rounded-full
          text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200
          hover:bg-gray-200/60 dark:hover:bg-gray-700/60
          transition-all duration-150 ease-out
          disabled:hover:bg-transparent
          min-h-[36px] min-w-[36px]
          border border-transparent hover:border-gray-300/30 dark:hover:border-gray-600/30
        `;

      case 'prominent':
        // More prominent hover for important dialogs
        return `${baseStyles}
          h-10 w-10 p-2 rounded-full
          text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400
          hover:bg-red-50 dark:hover:bg-red-900/20
          hover:shadow-lg hover:shadow-red-400/20
          transition-all duration-300 ease-in-out
          transform hover:scale-105 active:scale-95
          disabled:hover:scale-100
        `;

      case 'inspector':
        // Minimal style for inspector/developer tools
        return `${baseStyles}
          h-6 w-6 p-1 rounded
          text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
          hover:bg-gray-200/60 dark:hover:bg-gray-700/60
          transition-colors duration-100
        `;

      default:
        // Original default style
        return `${baseStyles}
          h-10 w-10 p-2 rounded-full
          text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
          hover:bg-gray-100 dark:hover:bg-gray-700
          hover:shadow-lg hover:shadow-gray-400/30 dark:hover:shadow-gray-600/30
          transition-all duration-300 ease-in-out
          transform hover:scale-110 active:scale-95
          disabled:hover:scale-100
        `;
    }
  };

  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      tabIndex={0}
      className={`${getVariantStyles()} ${className}`}
      style={{
        ...(variant === 'default' || variant === 'prominent'
          ? { minWidth: '40px', minHeight: '40px' }
          : variant === 'subtle'
          ? { minWidth: '36px', minHeight: '36px' }
          : {}),
      }}
    >
      <MdOutlineClose size={iconSize} />
    </button>
  );
};

EnhancedCloseButton.displayName = 'EnhancedCloseButton';

export default EnhancedCloseButton;
