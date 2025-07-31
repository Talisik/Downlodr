import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BsGraphUp } from 'react-icons/bs';
import TooltipWrapper from './TooltipWrapper';

interface SpeedDataPoint {
  timestamp: number;
  speed: number; // Speed in MB/s
  rawSpeed: string; // Original speed string (e.g., "1.5 MB/s")
}

interface SpeedGraphProps {
  currentSpeed: string; // Current speed string (e.g., "1.5 MB/s", "512 KB/s")
  downloadStatus: string; // Current download status
  downloadId: string; // Download ID for persistence
  className?: string;
  width?: number; // Made optional - when not provided, component will be responsive
  height?: number;
  maxDataPoints?: number; // Maximum number of data points to keep
  showHeader?: boolean; // Whether to show the header with speed text
  showStatus?: boolean; // Whether to show the status indicator
  debug?: boolean; // Enable debug logging
  responsive?: boolean; // Whether to use responsive width (defaults to true when width not specified)
}

// Speed History Service using localStorage
class SpeedHistoryService {
  private static instance: SpeedHistoryService;
  private storageKey = 'downlodr-speed-history';
  private maxDataPoints = 100; // Limit per download
  private maxDownloads = 50; // Limit number of downloads to store

  static getInstance(): SpeedHistoryService {
    if (!SpeedHistoryService.instance) {
      SpeedHistoryService.instance = new SpeedHistoryService();
    }
    return SpeedHistoryService.instance;
  }

  private getStoredHistory(): Record<string, SpeedDataPoint[]> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Error reading speed history:', error);
      return {};
    }
  }

  private saveHistory(history: Record<string, SpeedDataPoint[]>): void {
    try {
      // Clean up old data - keep only the most recent downloads
      const downloadIds = Object.keys(history);
      if (downloadIds.length > this.maxDownloads) {
        const sortedByLatest = downloadIds.sort((a, b) => {
          const aLatest = Math.max(
            ...(history[a].map((p) => p.timestamp) || [0]),
          );
          const bLatest = Math.max(
            ...(history[b].map((p) => p.timestamp) || [0]),
          );
          return bLatest - aLatest;
        });

        // Keep only the most recent downloads
        const cleanedHistory: Record<string, SpeedDataPoint[]> = {};
        sortedByLatest.slice(0, this.maxDownloads).forEach((id) => {
          cleanedHistory[id] = history[id];
        });
        history = cleanedHistory;
      }

      localStorage.setItem(this.storageKey, JSON.stringify(history));
    } catch (error) {
      console.warn('Error saving speed history:', error);
    }
  }

  getHistory(downloadId: string): SpeedDataPoint[] {
    const allHistory = this.getStoredHistory();
    return allHistory[downloadId] || [];
  }

  addSpeedPoint(downloadId: string, speedPoint: SpeedDataPoint): void {
    const allHistory = this.getStoredHistory();
    const downloadHistory = allHistory[downloadId] || [];

    // Add new point
    downloadHistory.push(speedPoint);

    // Keep only the most recent points
    if (downloadHistory.length > this.maxDataPoints) {
      downloadHistory.splice(0, downloadHistory.length - this.maxDataPoints);
    }

    allHistory[downloadId] = downloadHistory;
    this.saveHistory(allHistory);
  }

  clearHistory(downloadId: string): void {
    const allHistory = this.getStoredHistory();
    delete allHistory[downloadId];
    this.saveHistory(allHistory);
  }

  getStorageSize(): number {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? stored.length : 0;
    } catch {
      return 0;
    }
  }
}

// Helper function to parse speed string to number (in MB/s)
function parseSpeedString(speedStr: string): number {
  if (
    !speedStr ||
    speedStr === '--' ||
    speedStr === '---' ||
    speedStr === '0 B/s' ||
    speedStr === 'Unknown B/s'
  )
    return 0;

  // Trim whitespace and normalize the string
  const cleanStr = speedStr.trim();

  // Updated regex to handle both binary (MiB/s) and decimal (MB/s) units, plus spaces
  const match = cleanStr.match(/(\d+\.?\d*)\s*([KMGT]?i?B\/s)/i);

  if (!match) {
    console.warn('Failed to parse speed string:', speedStr);
    return 0;
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  // Handle both binary (MiB, KiB, GiB) and decimal (MB, KB, GB) units
  switch (unit) {
    case 'B/S':
      return value / (1024 * 1024); // Convert to MB/s
    case 'KIB/S': // Binary kilobytes
      return value / 1024; // Convert to MB/s
    case 'KB/S': // Decimal kilobytes
      return value / 1000; // Convert to MB/s (decimal)
    case 'MIB/S': // Binary megabytes
      return value; // MiB ≈ MB for display purposes
    case 'MB/S': // Decimal megabytes
      return value;
    case 'GIB/S': // Binary gigabytes
      return value * 1024; // Convert to MB/s
    case 'GB/S': // Decimal gigabytes
      return value * 1000; // Convert to MB/s (decimal)
    case 'TIB/S': // Binary terabytes (just in case!)
      return value * 1024 * 1024;
    case 'TB/S': // Decimal terabytes
      return value * 1000 * 1000;
    default:
      console.warn('Unknown speed unit:', unit, 'in string:', speedStr);
      return value; // Fallback to raw value
  }
}

// Helper function to format speed for display
function formatSpeed(speed: number): string {
  if (speed === 0) return '0 B/s';
  if (speed < 1) return `${(speed * 1024).toFixed(1)} KiB/s`;
  if (speed < 1024) return `${speed.toFixed(1)} MiB/s`;
  return `${(speed / 1024).toFixed(1)} GiB/s`;
}

const SpeedGraph: React.FC<SpeedGraphProps> = ({
  currentSpeed,
  downloadStatus,
  downloadId,
  className = '',
  width, // No default - will be responsive when not provided
  height = 80,
  maxDataPoints = 60, // Increased to show more history
  showHeader = true,
  showStatus = false,
  debug = false,
  responsive, // Will auto-determine based on width prop
}) => {
  const [speedHistory, setSpeedHistory] = useState<SpeedDataPoint[]>([]);
  const lastSpeedRef = useRef<string>('');
  const lastSpeedValueRef = useRef<number>(0);
  const mountedRef = useRef(true);
  const componentIdRef = useRef(Math.random().toString(36).substr(2, 9));
  const speedHistoryService = SpeedHistoryService.getInstance();

  // Determine if we should use responsive behavior
  const isResponsive =
    responsive !== undefined ? responsive : width === undefined;
  const actualWidth = width || 240; // Fallback width for calculations

  // Track container width for responsive behavior
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(actualWidth);

  // Effect to track container width when responsive
  useEffect(() => {
    if (!isResponsive || !containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: observedWidth } = entry.contentRect;
        setContainerWidth(Math.max(observedWidth - 6, 120)); // Account for padding, minimum width
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isResponsive]);

  // Use container width for calculations when responsive, fallback to actualWidth
  const graphWidth = isResponsive ? containerWidth : actualWidth;
  const graphHeight = height;

  // Generate unique gradient ID for this component instance
  const gradientId = `speedGradient-${componentIdRef.current}`;
  const gridPatternId = `gridPattern-${componentIdRef.current}`;

  // Function to calculate trend from speed history
  const calculateTrendFromHistory = useCallback(
    (history: SpeedDataPoint[]): 'increasing' | 'decreasing' | 'stable' => {
      if (history.length < 2) return 'stable';

      const lastSpeed = history[history.length - 1].speed;
      const secondLastSpeed = history[history.length - 2].speed;
      const speedDiff = lastSpeed - secondLastSpeed;

      // Use a dynamic threshold based on the speed values
      const threshold = Math.max(
        0.05,
        Math.max(lastSpeed, secondLastSpeed) * 0.03,
      );

      if (speedDiff > threshold) {
        return 'increasing';
      } else if (speedDiff < -threshold) {
        return 'decreasing';
      } else {
        return 'stable';
      }
    },
    [],
  );

  // Load speed history from persistence on mount
  useEffect(() => {
    const persistedHistory = speedHistoryService.getHistory(downloadId);
    setSpeedHistory(persistedHistory);

    if (debug) {
      console.log(
        `SpeedGraph [${componentIdRef.current}]: Loaded ${persistedHistory.length} persisted speed points for download ${downloadId}`,
      );
    }
  }, [downloadId, debug]);

  // Memoized speed parsing to avoid unnecessary recalculations
  const currentSpeedValue = useCallback(
    () => parseSpeedString(currentSpeed),
    [currentSpeed],
  );

  // Enhanced update function that responds immediately to changes
  const updateSpeedHistory = useCallback(() => {
    if (!mountedRef.current) return;

    const now = Date.now();
    const speedValue = currentSpeedValue();
    const isDownloading = downloadStatus === 'downloading';

    if (debug) {
      console.log('SpeedGraph Update:', {
        currentSpeed,
        speedValue,
        downloadStatus,
        isDownloading,
        historyLength: speedHistory.length,
        lastSpeed: lastSpeedRef.current,
        lastSpeedValue: lastSpeedValueRef.current,
        shouldUpdate:
          isDownloading &&
          (currentSpeed !== lastSpeedRef.current ||
            speedValue !== lastSpeedValueRef.current),
        speedChanged: currentSpeed !== lastSpeedRef.current,
        speedValueChanged: speedValue !== lastSpeedValueRef.current,
      });
    }

    // Add data points when actively downloading AND (speed has changed OR we have no data yet)
    // This ensures we capture at least some data during download
    if (
      isDownloading &&
      (currentSpeed !== lastSpeedRef.current ||
        speedValue !== lastSpeedValueRef.current ||
        speedHistory.length === 0) // Always add first data point
    ) {
      const newDataPoint: SpeedDataPoint = {
        timestamp: now,
        speed: speedValue,
        rawSpeed: currentSpeed,
      };

      // Add to persistent storage
      speedHistoryService.addSpeedPoint(downloadId, newDataPoint);

      // Update local state
      setSpeedHistory((prev) => {
        const newHistory = [...prev, newDataPoint];

        // Keep only the last maxDataPoints for performance
        if (newHistory.length > maxDataPoints) {
          newHistory.splice(0, newHistory.length - maxDataPoints);
        }

        if (debug) {
          console.log(
            'SpeedGraph: Added data point. New history length:',
            newHistory.length,
          );
        }

        return newHistory;
      });

      lastSpeedRef.current = currentSpeed;
      lastSpeedValueRef.current = speedValue;
    }

    // When not downloading, we simply retain all existing speedHistory data
    // No new data is added, but all previous points remain visible
  }, [
    currentSpeed,
    downloadStatus,
    downloadId,
    currentSpeedValue,
    maxDataPoints,
    debug,
    speedHistory.length,
    speedHistoryService,
  ]);

  // Effect to handle prop changes immediately - this makes it super responsive
  useEffect(() => {
    updateSpeedHistory();
  }, [currentSpeed, downloadStatus, updateSpeedHistory]);

  // No interval needed anymore - we update immediately on prop changes
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Calculate max speed for scaling with better scaling
  const maxSpeed =
    speedHistory.length > 0
      ? Math.max(...speedHistory.map((point) => point.speed), 0.1) * 1.1 // Reduced headroom for better scaling
      : 1;
  const speedScale = graphHeight / maxSpeed;

  // Generate SVG path for the speed line
  const generateSpeedPath = (): string => {
    if (speedHistory.length < 1) return '';

    if (speedHistory.length === 1) {
      // Single point - draw a line across the full width at that speed
      const point = speedHistory[0];
      const y = graphHeight - point.speed * speedScale;
      return `M 0,${y} L ${graphWidth},${y}`;
    }

    const points = speedHistory.map((point, index) => {
      // Always spread points across the full width
      const x = (index / Math.max(speedHistory.length - 1, 1)) * graphWidth;
      const y = graphHeight - point.speed * speedScale;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  // Generate fill path for area under the curve
  const generateFillPath = (): string => {
    if (speedHistory.length < 1) return '';

    if (speedHistory.length === 1) {
      // Single point - fill the entire area at that speed level
      const point = speedHistory[0];
      const y = graphHeight - point.speed * speedScale;
      const bottomY = graphHeight;
      return `M 0,${y} L ${graphWidth},${y} L ${graphWidth},${bottomY} L 0,${bottomY} Z`;
    }

    const speedPath = generateSpeedPath();
    const bottomY = graphHeight;

    // Ensure the fill area extends to the full width
    return `${speedPath} L ${graphWidth},${bottomY} L 0,${bottomY} Z`;
  };

  // Get colors based on trend - enhanced for better visual feedback
  const getColors = () => {
    const isActivelyDownloading = downloadStatus === 'downloading';
    const currentTrend = calculateTrendFromHistory(speedHistory);

    switch (currentTrend) {
      case 'increasing':
        return {
          line: isActivelyDownloading ? '#10b981' : '#10b98180', // green-500, muted when not downloading
          gradientStart: '#10b98130', // green-500
          gradientEnd: '#10b981', // green-500 with opacity
          bg: 'bg-transparent border-gray-200 dark:border-gray-700', // No background, just border
        };
      case 'decreasing':
        return {
          line: isActivelyDownloading ? '#ef4444' : '#ef444480', // red-500, muted when not downloading
          gradientStart: '#ef444430', // red-500 '#ef444430'
          gradientEnd: '#ef4444', // red-500 with opacity
          bg: 'bg-transparent border-gray-200 dark:border-gray-700', // No background, just border
        };
      default:
        return {
          line: isActivelyDownloading ? '#6b7280' : '#3b82f680', // gray-500, muted when not downloading
          gradientStart: isActivelyDownloading ? '#6b7280' : '#3b82f6', // gray-500
          gradientEnd: isActivelyDownloading ? '#6b728030' : '#3b82f630', // gray-500 with opacity
          bg: 'bg-transparent border-gray-200 dark:border-gray-700', // No background, just border
        };
    }
  };

  const colors = getColors();
  const currentSpeedDisplay = formatSpeed(currentSpeedValue());
  const isActivelyDownloading = downloadStatus === 'downloading';
  const currentTrend = calculateTrendFromHistory(speedHistory);

  // Calculate responsive icon sizing based on component dimensions
  const iconContainerSize = Math.min(actualWidth * 0.7, height * 1.5, 70); // Max 48px, min 15% of width or 40% of height
  const iconSize = iconContainerSize * 0.5;

  return (
    <TooltipWrapper content={currentSpeedDisplay} side="bottom">
      <div
        ref={containerRef}
        className={`relative rounded-lg transition-all duration-200 min-w-12 ${
          colors.bg
        } ${isResponsive ? 'w-full' : ''} ${className}`}
        style={
          isResponsive
            ? { height: `${height + 2}px` }
            : { width: `${actualWidth + 6}px`, height: `${height + 4}px` }
        }
      >
        {/* Header */}
        {showHeader && (
          <div className="flex items-center justify-between p-2 pb-1">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Download Speed{' '}
              {!isActivelyDownloading && speedHistory.length > 0 && (
                <span className="text-xs opacity-70 font-normal">
                  (Last Session)
                </span>
              )}
            </span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {isActivelyDownloading
                ? currentSpeedDisplay
                : speedHistory.length > 0
                ? formatSpeed(speedHistory[speedHistory.length - 1].speed)
                : '—'}
            </span>
          </div>
        )}

        {/* Graph */}
        <div className="p-1 pt-1">
          <svg
            width={isResponsive ? undefined : actualWidth}
            height={height}
            className={`rounded overflow-hidden ${
              isResponsive ? 'w-full' : ''
            }`}
            viewBox={isResponsive ? `0 0 ${graphWidth} ${height}` : undefined}
            preserveAspectRatio={isResponsive ? 'none' : undefined}
          >
            {/* Gradient definitions */}
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop
                  offset="0%"
                  stopColor={colors.gradientStart}
                  stopOpacity={isActivelyDownloading ? '0.8' : '0.5'}
                />
                <stop
                  offset="100%"
                  stopColor={colors.gradientEnd}
                  stopOpacity="0.2"
                />
              </linearGradient>

              {/* Subtle grid pattern */}
              <pattern
                id={gridPatternId}
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 10 0 L 0 0 0 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  opacity="0.1"
                />
              </pattern>
            </defs>

            {/* Background grid - only for larger graphs */}
            {actualWidth > 120 && (
              <rect
                width={graphWidth}
                height={height}
                fill={`url(#${gridPatternId})`}
              />
            )}

            {/* Speed area fill */}
            {speedHistory.length >= 1 && (
              <path
                d={generateFillPath()}
                fill={`url(#${gradientId})`}
                className="transition-all duration-200"
              />
            )}

            {/* Speed line */}
            {speedHistory.length >= 1 && (
              <path
                d={generateSpeedPath()}
                stroke={colors.line}
                strokeWidth="2"
                fill={`url(#${gradientId})`}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-200"
              />
            )}

            {/* Current speed indicator dot - only show when actively downloading */}
            {speedHistory.length > 0 && isActivelyDownloading && (
              <circle
                cx={
                  speedHistory.length === 1
                    ? graphWidth / 2 // Center for single point
                    : graphWidth // Right edge for multiple points (last data point)
                }
                cy={graphHeight - currentSpeedValue() * speedScale}
                r="2"
                fill={colors.line}
                className="animate-pulse"
              />
            )}
          </svg>
        </div>

        {/* Status indicator */}
        {showStatus && (
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center space-x-2">
              <div
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-200`}
                style={{ backgroundColor: colors.line }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {isActivelyDownloading
                  ? currentTrend === 'increasing'
                    ? 'Increasing'
                    : currentTrend === 'decreasing'
                    ? 'Decreasing'
                    : 'Stable'
                  : speedHistory.length > 0
                  ? currentTrend === 'increasing'
                    ? 'Last: Increasing'
                    : currentTrend === 'decreasing'
                    ? 'Last: Decreasing'
                    : 'Last: Stable'
                  : 'No Data'}
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {speedHistory.length} points
            </span>
          </div>
        )}

        {/* Debug info */}
        {debug && (
          <div className="px-2 pb-2 text-xs text-gray-500 dark:text-gray-400 font-mono">
            <div>
              Current: {currentSpeed} → {currentSpeedValue().toFixed(3)} MiB/s
            </div>
            <div>
              Status: {downloadStatus} | Mode:{' '}
              {isActivelyDownloading ? 'COLLECTING' : 'RETAINED'}
            </div>
            <div>
              Trend: {currentTrend} | Points: {speedHistory.length}/
              {maxDataPoints}
            </div>
            <div>Max Speed: {maxSpeed.toFixed(3)} MiB/s</div>
          </div>
        )}

        {/* No data state */}
        {speedHistory.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center mt-2">
            <div className="text-center">
              <div
                className="mx-auto mb-2 rounded-full flex items-center justify-center"
                style={{
                  width: `${iconContainerSize}px`,
                  height: `${iconContainerSize}px`,
                }}
              >
                <BsGraphUp
                  className="text-gray-400"
                  style={{
                    width: `${iconSize}px`,
                    height: `${iconSize}px`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipWrapper>
  );
};

export default SpeedGraph;
