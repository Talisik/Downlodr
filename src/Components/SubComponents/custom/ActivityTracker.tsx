import TooltipWrapper from '@/Components/SubComponents/custom/TooltipWrapper';
import { toast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import {
  getAllDownloadActivityLogs,
  getDownloadActivityLog,
  type ActivityItem,
  type ActivityLog,
} from '@/DataFunctions/ActivityHelper';
import useDownloadStore from '@/Store/downloadStore';
import React, { useEffect, useRef, useState } from 'react';
import { BiSolidPlusSquare, BiSolidRightArrow } from 'react-icons/bi';
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaTerminal,
} from 'react-icons/fa';
import { HiArrowPath } from 'react-icons/hi2';
import { LuFileSearch2 } from 'react-icons/lu';
import {
  MdAccessTime,
  MdOutlineClose,
  MdOutlineContentCopy,
  MdOutlineFileDownload,
} from 'react-icons/md';
import { RxCross2 } from 'react-icons/rx';
import { TbFileCheck } from 'react-icons/tb';

interface ActivityTrackerProps {
  isOpen: boolean;
  onClose: () => void;
  downloadId?: string;
}

const ActivityTracker: React.FC<ActivityTrackerProps> = ({
  isOpen,
  onClose,
  downloadId,
  // onAction,
}) => {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Get store state for real-time updates
  const downloading = useDownloadStore((state) => state.downloading);
  const forDownloads = useDownloadStore((state) => state.forDownloads);
  const queuedDownloads = useDownloadStore((state) => state.queuedDownloads);
  const history = useDownloadStore((state) => state.historyDownloads);
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );

  // Find the specific download by ID
  const specificDownload = [
    ...forDownloads,
    ...downloading,
    ...finishedDownloads,
    ...history,
    ...queuedDownloads,
  ].find((download) => download.id === downloadId);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Update activity logs when store changes
  useEffect(() => {
    if (downloadId) {
      // Show specific download activity
      const log = getDownloadActivityLog(downloadId);
      if (log) {
        setActivityLogs([log]);
        setSelectedLog(log);
      }
    } else {
      // Show all download activities
      const logs = getAllDownloadActivityLogs();
      setActivityLogs(logs);
      if (logs.length > 0 && !selectedLog) {
        setSelectedLog(logs[0]);
      }
    }
  }, [downloadId, downloading, forDownloads, queuedDownloads]);

  // Helper function to get activity status icon based on stage and status
  const getActivityStatusIcon = (
    status: ActivityItem['status'],
    stage: string,
    title: string,
  ) => {
    // Determine base icon and color based on activity stage/title
    let IconComponent = MdAccessTime;
    let colorClass = 'text-gray-500';
    let animationClass = '';

    if (
      title.toLowerCase().includes('metadata') ||
      title.toLowerCase().includes('fetching')
    ) {
      IconComponent = LuFileSearch2;
      colorClass = 'text-[#3498DB] dark:text-[#3498DB]';
    } else if (
      title.toLowerCase().includes('readying') ||
      title.toLowerCase().includes('ready')
    ) {
      IconComponent = TbFileCheck;
      colorClass = 'text-[#3498DB] dark:text-[#3498DB]';
    } else if (title.toLowerCase().includes('queue')) {
      IconComponent = BiSolidPlusSquare;
      colorClass = 'text-yellow-500';
    } else if (title.toLowerCase().includes('paused')) {
      IconComponent = MdAccessTime;
      colorClass = 'text-orange-500';
      animationClass = 'animate-pulse';
    } else if (title.toLowerCase().includes('download')) {
      IconComponent = MdOutlineFileDownload;
      colorClass = 'text-[#F45513] dark:text-[#F45513]';
    } else if (
      title.toLowerCase().includes('initializing') ||
      title.toLowerCase().includes('processing')
    ) {
      IconComponent = HiArrowPath;
      colorClass = 'text-green-500';
    } else if (title.toLowerCase().includes('finished')) {
      IconComponent = BiSolidRightArrow;
      colorClass = 'text-green-500';
    } else {
      IconComponent = RxCross2;
      colorClass = 'text-red-500';
    }

    if (status === 'active') {
      animationClass = 'animate-pulse';
    }

    return (
      <IconComponent size={16} className={`${colorClass} ${animationClass}`} />
    );
  };

  // Helper function to get activity status color
  const getActivityStatusColor = (
    status: ActivityItem['status'],
    title: string,
  ) => {
    // Return consistent colors based on activity type, not status
    if (
      title.toLowerCase().includes('metadata') ||
      title.toLowerCase().includes('fetching')
    ) {
      return 'text-[#3498DB] dark:text-[#3498DB]';
    } else if (
      title.toLowerCase().includes('readying') ||
      title.toLowerCase().includes('ready')
    ) {
      return 'text-[#3498DB] dark:text-[#3498DB]';
    } else if (title.toLowerCase().includes('queue')) {
      return 'text-yellow-600 dark:text-yellow-400';
    } else if (title.toLowerCase().includes('paused')) {
      return 'text-orange-600 dark:text-orange-400';
    } else if (title.toLowerCase().includes('download')) {
      return 'text-[#F45513] dark:text-[#F45513]';
    } else if (
      title.toLowerCase().includes('initializing') ||
      title.toLowerCase().includes('processing')
    ) {
      return 'text-green-600 dark:text-green-400';
    } else if (title.toLowerCase().includes('finished')) {
      return 'text-green-600 dark:text-green-400';
    } else if (title.toLowerCase().includes('failed')) {
      return 'text-red-600 dark:text-red-400';
    }

    return 'text-red-600 dark:text-red-400';
  };

  // Enhanced error information display
  const renderErrorDetails = (activity: ActivityItem) => {
    if (!activity.details?.errorInfo) return null;

    const errorInfo = activity.details.errorInfo;
    const errorCode = activity.details.errorCode;

    return (
      <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
        <div className="flex items-start space-x-2">
          <FaExclamationTriangle className="text-red-500 mt-0.5" size={14} />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h5 className="font-medium text-red-800 dark:text-red-200">
                Error Code: {errorCode}
              </h5>
              <div className="flex items-center space-x-2">
                {errorInfo.canRetry && (
                  <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded">
                    Retryable
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    errorInfo.severity === 'high'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                      : errorInfo.severity === 'medium'
                      ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                  }`}
                >
                  {errorInfo.severity} severity
                </span>
              </div>
            </div>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {errorInfo.description}
            </p>
            <div className="mt-2">
              <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-1">
                Category: {errorInfo.category}
              </p>
              {errorInfo.suggestions.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-1">
                    Suggestions:
                  </p>
                  <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                    {errorInfo.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start">
                        <span className="mr-1">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Helper function to copy activity log
  const copyActivityLog = async () => {
    if (!selectedLog) return;

    try {
      let errorSection = '';
      if (selectedLog.hasError && selectedLog.errorInfo) {
        errorSection = `
=== ERROR DETAILS ===
Error Code: ${selectedLog.errorCode}
Error Type: ${selectedLog.errorInfo.title}
Description: ${selectedLog.errorInfo.description}
Category: ${selectedLog.errorInfo.category}
Severity: ${selectedLog.errorInfo.severity}
Can Retry: ${selectedLog.canRetry ? 'Yes' : 'No'}

Suggestions:
${selectedLog.errorInfo.suggestions.map((s) => `• ${s}`).join('\n')}
`;
      }

      const logText = `Activity Log for: ${selectedLog.downloadName}
URL: ${selectedLog.videoUrl}
Status: ${selectedLog.currentStage}
Progress: ${selectedLog.overallProgress}%
${errorSection}
=== ACTIVITY TIMELINE ===
${selectedLog.activities
  .map(
    (activity) => `
[${activity.timestamp}] ${activity.title}
Status: ${activity.status}
${activity.description}
${
  activity.details
    ? `Speed: ${activity.details.speed || 'N/A'}, Time Left: ${
        activity.details.timeLeft || 'N/A'
      }${
        activity.details.errorCode
          ? `, Error Code: ${activity.details.errorCode}`
          : ''
      }`
    : ''
}
`,
  )
  .join('\n')}`;

      await navigator.clipboard.writeText(logText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy activity log:', error);
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Failed to copy activity log to clipboard',
        duration: 3000,
      });
    }
  };

  // Helper function to download activity log as text file
  const downloadActivityLog = async () => {
    if (!selectedLog) return;

    try {
      // Get the download folder path
      const downloadFolderPath = specificDownload?.location || '';
      if (!downloadFolderPath) {
        console.error('No download folder path available');
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No download folder path available',
          duration: 3000,
        });
        return;
      }

      // Create safe filename: downloadName + "_activity_log.txt"
      const safeDownloadName = selectedLog.downloadName
        .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .slice(0, 50); // Limit length

      const logFileName = `${safeDownloadName}_activity_log.txt`;

      // Create the full path for the log file
      const logFilePath = await window.downlodrFunctions.joinDownloadPath(
        downloadFolderPath,
        logFileName,
      );

      // Format the download date
      const downloadDate = specificDownload?.DateAdded
        ? new Date(specificDownload.DateAdded).toLocaleString()
        : 'Unknown date';

      const logText = `Activity Log - Generated on ${new Date().toLocaleString()}
================================================================================

Download Information:
Name: ${selectedLog.downloadName}
URL: ${selectedLog.videoUrl}
Status: ${selectedLog.currentStage}
Progress: ${selectedLog.overallProgress}%
Download Date: ${downloadDate}

=== ACTIVITY TIMELINE ===
${selectedLog.activities
  .map(
    (activity) => `
[${activity.timestamp}] ${activity.title}
Status: ${activity.status}
${activity.description}
${
  activity.details
    ? `Speed: ${activity.details.speed || 'N/A'}, Time Left: ${
        activity.details.timeLeft || 'N/A'
      }${
        activity.details.progress
          ? `, Progress: ${activity.details.progress}`
          : ''
      }${
        activity.details.size
          ? `, Size: ${(activity.details.size / 1024 / 1024).toFixed(2)} MB`
          : ''
      }`
    : ''
}
`,
  )
  .join('\n')}

=== SUMMARY ===
Total Activities: ${selectedLog.activities.length}
Current Stage: ${selectedLog.currentStage}
Overall Progress: ${selectedLog.overallProgress}%

================================================================================
End of logs - Generated by UI Downlodr v2`;

      // Write the file using the app's file system operations
      const result = await window.plugins.writeFile({
        customPath: logFilePath,
        content: logText,
        overwrite: true,
        pluginId: 'downlodr_core',
        fileName: logFileName,
      });

      if (result.success) {
        // Show success feedback
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 2000);
        console.log('Activity log saved successfully to:', logFilePath);
        toast({
          variant: 'success',
          title: 'Activity Log Saved',
          description: 'Activity log saved to download folder',
          duration: 3000,
        });
      } else {
        console.error('Failed to save activity log:', result.error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to save activity log',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Failed to save activity log:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save activity log',
        duration: 3000,
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed right-0 top-10 h-full drop-shadow-md bg-white dark:bg-darkMode shadow-lg z-40 flex flex-col border-l-2 border-[#D1D5DB] dark:border-darkModeCompliment"
      style={{ width: '350px' }}
    >
      {/* Header */}
      <div className="bg-titleBar pr-6 pl-4 dark:bg-darkModeDropdown px-2 py-1 pt-[11px] dark:border-darkModeCompliment flex items-center justify-between">
        <div className="flex items-center flex-1">
          <FaTerminal
            size={16}
            color="#F45513"
            className="mr-2 color-[#F45513]"
          />
          <span className="text-black dark:text-white font-semibold text-sm leading-6">
            Activity Logs
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TooltipWrapper content="Copy activity log" side="bottom">
            <button
              onClick={copyActivityLog}
              className="text-black dark:text-white hover:text-blue-500 p-1 flex-shrink-0"
            >
              {copySuccess ? (
                <FaCheckCircle size={14} className="text-green-500" />
              ) : (
                <MdOutlineContentCopy size={14} />
              )}
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="Save activity log" side="bottom">
            <button
              onClick={downloadActivityLog}
              className="text-black dark:text-white hover:text-green-500 ml-2 p-1 flex-shrink-0"
            >
              <MdOutlineFileDownload size={18} />
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="Close activity logs" side="bottom">
            <button
              onClick={onClose}
              className="text-black dark:text-white hover:text-red-500 ml-2 p-1 flex-shrink-0"
            >
              <MdOutlineClose size={16} />
            </button>
          </TooltipWrapper>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden py-3 mb-12 mt-2">
        {activityLogs.length === 0 ? (
          // No activities
          <div className="pl-4 pr-6 py-4 text-center text-gray-500 dark:text-gray-400">
            <p>No download activities to display</p>
          </div>
        ) : (
          <div className="flex h-full">
            {/* Activity Details (right side) */}
            <div className="flex-1 overflow-y-auto">
              {selectedLog && (
                <div className="px-3 py-1">
                  {/* Activity Timeline */}
                  <div className="space-y-3">
                    {selectedLog.activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start space-x-3"
                      >
                        <div className="flex-shrink-0 mt-1">
                          {getActivityStatusIcon(
                            activity.status,
                            activity.stage,
                            activity.title,
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4
                              className={`text-sm font-medium ${getActivityStatusColor(
                                activity.status,
                                activity.title,
                              )}`}
                            >
                              {activity.title}
                            </h4>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">
                            {activity.description}
                          </div>
                          {activity.details && (
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 space-y-1">
                              {activity.details.progress && (
                                <div>Progress: {activity.details.progress}</div>
                              )}
                              {activity.details.speed && (
                                <div>Speed: {activity.details.speed}</div>
                              )}
                              {activity.details.timeLeft && (
                                <div>
                                  Time Left: {activity.details.timeLeft}
                                </div>
                              )}
                              {activity.details.size && (
                                <div>
                                  Size:{' '}
                                  {(
                                    activity.details.size /
                                    1024 /
                                    1024
                                  ).toFixed(2)}{' '}
                                  MB
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityTracker;
