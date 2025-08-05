/**
 * A custom React component
 * A React component that displays an animated linear progress bar.
 * It visually represents progress with customizable colors and status indicators.
 *
 * @param AnimatedLinearProgressBarProps
 *   @param status - The current status of the progress (e.g., 'paused', 'to download').
 *   @param max - The maximum value for the progress.
 *   @param value - The current value of the progress.
 *   @param min - The minimum value for the progress.
 *   @param gaugePrimaryColor - The primary color of the progress gauge.
 *   @param gaugeSecondaryColor - The secondary color of the progress gauge.
 *   @param className - Optional additional CSS classes for styling.
 *   @param width - Optional fixed width - when not provided, component will be responsive.
 *
 * @returns JSX.Element - The rendered animated linear progress bar component.
 */

import { cn } from '@/Components/SubComponents/shadcn/lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FaPlay } from 'react-icons/fa';
import { MdPause } from 'react-icons/md';

interface AnimatedLinearProgressBarProps {
  status: string; // Current status of the progress
  max: number; // Maximum value for the progress
  value: number; // Current value of the progress
  min: number; // Minimum value for the progress
  gaugePrimaryColor: string; // Primary color of the progress gauge
  gaugeSecondaryColor: string; // Secondary color of the progress gauge
  className?: string; // Optional additional CSS classes
  width?: number; // Optional fixed width - when not provided, component will be responsive
}

export function AnimatedLinearProgressBar({
  status,
  max = 200,
  min = 0,
  value = 0,
  gaugePrimaryColor,
  gaugeSecondaryColor,
  className,
  width, // No default - will be responsive when not provided
}: AnimatedLinearProgressBarProps) {
  const currentPercent = Math.round(((value - min) / (max - min)) * 100);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if we should use responsive behavior (same logic as SpeedGraph)
  const isResponsive = width === undefined;
  const fallbackWidth = width || 120; // Fallback width for calculations

  // Track container width for responsive behavior (copied from SpeedGraph)
  const [containerWidth, setContainerWidth] = useState<number>(fallbackWidth);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Ensure we have valid colors
  const backgroundTrackColor = gaugeSecondaryColor || '#e5e7eb';
  const fillBarColor = gaugePrimaryColor || '#3b82f6';

  // Optimized ResizeObserver callback with performance improvements
  const handleResize = useCallback((entries: ResizeObserverEntry[]) => {
    for (const entry of entries) {
      const { width: observedWidth } = entry.contentRect;
      const newWidth = Math.max(observedWidth - 6, 60);

      // Set resizing state for smoother transitions
      setIsResizing(true);
      setContainerWidth(newWidth);

      // Clear existing timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      // Reset resizing state after resize activity stops
      resizeTimeoutRef.current = setTimeout(() => {
        setIsResizing(false);
      }, 150);
    }
  }, []);

  // Effect to track container width when responsive (optimized)
  useEffect(() => {
    if (!isResponsive || !containerRef.current) return;

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [isResponsive, handleResize]);

  // Use container width for calculations when responsive, fallback to fixed width
  const actualWidth = isResponsive ? containerWidth : fallbackWidth;

  // Calculate available width for progress bar (subtract icon and percentage space)
  const iconSpace = 16; // Icon + gap
  const percentageSpace = 32; // Percentage display + gap
  const availableWidth = Math.max(
    actualWidth - iconSpace - percentageSpace,
    30,
  );

  // Dynamic transition classes based on resize state
  const containerTransition = isResizing
    ? 'transition-none' // No transition during active resize for better performance
    : 'transition-all duration-200 ease-out';

  const progressTransition = isResizing
    ? 'transition-none'
    : 'transition-all duration-200 ease-out';

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex items-center justify-center',
        containerTransition,
        isResponsive ? 'w-full' : '',
        className,
      )}
      style={
        isResponsive ? { minWidth: '20px' } : { width: `${actualWidth}px` }
      }
    >
      {/* Status Icon */}
      <div className="flex-shrink-0 mr-1">
        {status === 'paused' ? (
          <MdPause size={12} className="text-gray-500 dark:text-gray-500" />
        ) : status === 'to download' ? (
          <FaPlay size={10} className="text-gray-500 dark:text-gray-500" />
        ) : null}
      </div>

      {/* Progress Bar Container - Uses calculated available width */}
      <div
        className={cn('relative', progressTransition)}
        style={{ width: availableWidth + 'px' }}
      >
        {/* Background Track */}
        <div
          className={cn('w-full h-3 rounded-full relative', progressTransition)}
          style={{
            backgroundColor: backgroundTrackColor,
          }}
        >
          {/* Progress Fill Bar - Grows from 0% to 100% */}
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${Math.max(0, Math.min(100, currentPercent))}%`,
              backgroundColor: fillBarColor,
              minWidth: currentPercent > 0 ? '4px' : '0px',
            }}
          />
        </div>
      </div>

      {/* Percentage Display - Fixed width */}
      <div className="flex-shrink-0 w-8 text-right">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {currentPercent}%
        </span>
      </div>
    </div>
  );
}
