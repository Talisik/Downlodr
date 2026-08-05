/**
 * Base UI shell for context menus. Handles positioning, viewport clamping,
 * and shared styling. Pass menu content as children.
 */

import { cn } from '@/core-app/components/shadcn/lib/utils';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface BaseContextMenuProps {
  /** Screen position for the menu (updated to stay in viewport) */
  position: { x: number; y: number };
  /** Called when the menu should close (e.g. click outside) */
  onClose: () => void;
  /** Menu content (buttons, items, etc.) */
  children: React.ReactNode;
  /** Optional class name merged with the base container styles */
  className?: string;
  /** Optional data attribute for tests (e.g. data-tag-context-menu) */
  dataAttribute?: string;
  /** Minimum width (e.g. min-w-[175px]). Default: none. */
  minWidth?: string;
  /** Max height (e.g. 80vh). Default: none. */
  maxHeight?: string;
  /** Listen for clicks outside and call onClose. Default: true */
  closeOnClickOutside?: boolean;
}

const BASE_CONTAINER_CLASSES =
  'fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 pl-1 pr-2 z-50 dark:border-gray-700';

const BaseContextMenu: React.FC<BaseContextMenuProps> = ({
  position,
  onClose,
  children,
  className,
  dataAttribute,
  minWidth,
  maxHeight,
  closeOnClickOutside = true,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    setAdjustedPosition(position);
  }, [position.x, position.y]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = position.x;
    let adjustedY = position.y;

    if (position.x + rect.width > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 10;
    }
    if (position.y + rect.height > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 10;
    }
    adjustedX = Math.max(10, adjustedX);
    adjustedY = Math.max(10, adjustedY);

    setAdjustedPosition({ x: adjustedX, y: adjustedY });
  }, [position.x, position.y]);

  useEffect(() => {
    if (!closeOnClickOutside) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeOnClickOutside, onClose]);

  const style: React.CSSProperties = {
    left: `${adjustedPosition.x}px`,
    top: `${adjustedPosition.y}px`,
    ...(maxHeight && { maxHeight, overflowY: 'auto' as const }),
    ...(minWidth && { minWidth }),
  };

  return (
    <div
      ref={menuRef}
      className={cn(BASE_CONTAINER_CLASSES, className)}
      style={style}
      onClick={(e) => e.stopPropagation()}
      {...(dataAttribute ? { [dataAttribute]: '' } : {})}
    >
      {children}
    </div>
  );
};

export default BaseContextMenu;
