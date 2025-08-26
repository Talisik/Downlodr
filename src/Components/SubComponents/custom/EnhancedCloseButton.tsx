/**
 * Enhanced Close Button Component
 * Provides better UX with larger click area, hover effects, and improved accessibility
 */

import React from 'react';
import { IoMdClose } from 'react-icons/io';

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
  variant = 'inspector',
}) => {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  // Size variants
  const sizeClasses = {
    sm: 'h-6 w-6 p-0.5',
    md: 'h-8 w-8 p-1',
    lg: 'h-10 w-10 p-2',
  };

  // Icon size variants
  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  // Variant styles
  const variantClasses = {
    default: `
      bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800
      border border-transparent hover:border-gray-200 dark:hover:border-gray-700
      text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
    `,
    subtle: `
      bg-transparent hover:bg-gray-50 dark:hover:bg-gray-900
      text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300
    `,
    prominent: `
      bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40
      border border-red-200 hover:border-red-300 dark:border-red-800 dark:hover:border-red-700
      text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300
    `,
    inspector: `
      bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
      border border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500
      text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white
      shadow-sm hover:shadow-md
    `,
  };

  return (
    <button
      type="button"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        absolute right-4 top-4
        rounded-md
        transition-all duration-200 ease-in-out
        transform hover:scale-105 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        dark:focus:ring-offset-gray-800
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        flex items-center justify-center
        shadow-sm hover:shadow-md
        ${className}
      `.replace(/\s+/g, ' ').trim()}
    >
      <IoMdClose 
        size={iconSizes[size]} 
        className="transition-transform duration-200"
      />
      <span className="sr-only">{ariaLabel}</span>
    </button>
  );
};

export default EnhancedCloseButton;
