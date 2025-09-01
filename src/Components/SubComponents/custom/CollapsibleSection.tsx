/**
 * A reusable collapsible section component for settings modal
 * Provides accessible expand/collapse functionality with smooth animations
 */

import React, { useState, useRef, useEffect } from 'react';
import { IoChevronDown, IoChevronUp } from 'react-icons/io5';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
  onToggle?: (isExpanded: boolean) => void;
  ariaLabel?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultExpanded = false,
  className = '',
  titleClassName = '',
  contentClassName = '',
  onToggle,
  ariaLabel,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const contentId = `collapsible-content-${title
    .replace(/\s+/g, '-')
    .toLowerCase()}`;

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(isExpanded ? contentRef.current.scrollHeight : 0);
    }
  }, [isExpanded, children]);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onToggle?.(newExpanded);
  };

  return (
    <div className={`pt-3 ${className}`}>
      {/* Section Header with Toggle */}
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-2 text-left hover:bg-gray-50 dark:hover:bg-darkModeHover rounded-md p-1 -ml-1 transition-colors"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          aria-label={ariaLabel || `Toggle ${title} section`}
        >
          <span className="text-gray-400 dark:text-gray-500">
            {isExpanded ? (
              <IoChevronUp size={16} />
            ) : (
              <IoChevronDown size={16} />
            )}
          </span>
          <label
            className={`block dark:text-gray-200 text-nowrap font-bold cursor-pointer ${titleClassName}`}
          >
            {title}
          </label>
        </button>
        <hr className="flex-grow border-t-1 border-divider dark:border-gray-700 ml-2" />
      </div>

      {/* Collapsible Content */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ height: `${contentHeight}px` }}
        aria-hidden={!isExpanded}
      >
        <div
          ref={contentRef}
          id={contentId}
          role="region"
          aria-label={`${title} content`}
          className={contentClassName}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;
