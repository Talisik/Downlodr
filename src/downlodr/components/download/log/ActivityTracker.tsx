import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import {
  getAllDownloadActivityLogs,
  getDownloadActivityLog,
  type ActivityItem,
  type ActivityLog,
} from '@/downlodr/utils/error/activityHelper';
import React, { useEffect, useState } from 'react';
import { BiSolidPlusSquare, BiSolidRightArrow } from 'react-icons/bi';
import { FaCheckCircle, FaTerminal } from 'react-icons/fa';
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
  const [downloadSuccess, setDownloadSuccess] = useState(false);
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

  // Check if buttons should be disabled during active downloads
  const isActiveDownload =
    specificDownload &&
    ['downloading', 'initializing', 'fetching metadata', 'queued'].includes(
      specificDownload.status.toLowerCase(),
    );

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
      className="h-full bg-white dark:bg-darkMode flex flex-col flex-shrink-0 "
      style={{ width: '400px' }}
    >
      {/* Header */}
      <div className="bg-toggleGroupBaseColor pr-6 pl-4 dark:bg-darkModeTable px-2 py-1 pt-[11px] dark:border-darkModeCompliment flex items-center justify-between rounded-t-md">
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
          <TooltipWrapper
            content={
              isActiveDownload
                ? 'Cannot copy during active download'
                : 'Copy activity log'
            }
            side="bottom"
          >
            <button
              onClick={copyActivityLog}
              disabled={isActiveDownload}
              className={`p-1 flex-shrink-0 transition-all duration-200 ${
                isActiveDownload
                  ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                  : 'text-black dark:text-white hover:text-blue-500 dark:hover:text-blue-500'
              }`}
            >
              {copySuccess ? (
                <FaCheckCircle size={14} className="text-green-500" />
              ) : (
                <MdOutlineContentCopy size={14} />
              )}
            </button>
          </TooltipWrapper>
          <TooltipWrapper
            content={
              isActiveDownload
                ? 'Cannot save during active download'
                : 'Save activity log'
            }
            side="bottom"
          >
            <button
              onClick={downloadActivityLog}
              disabled={isActiveDownload}
              className={`ml-2 p-1 flex-shrink-0 transition-all duration-200 ${
                isActiveDownload
                  ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                  : 'text-black dark:text-white hover:text-green-500 dark:hover:text-green-500'
              }`}
            >
              {downloadSuccess ? (
                <FaCheckCircle size={18} className="text-green-500" />
              ) : (
                <MdOutlineFileDownload size={18} />
              )}
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="Close logs" side="bottom">
            <button
              onClick={onClose}
              className="text-black dark:text-white hover:text-red-500 dark:hover:text-red-500 ml-2 p-1 flex-shrink-0"
            >
              <MdOutlineClose size={16} />
            </button>
          </TooltipWrapper>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden py-3 mb-4 mt-2">
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
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap break-all">
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
