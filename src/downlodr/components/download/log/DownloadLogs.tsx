import { config } from '@/core-app/client/config';
import useDownloadStore from '@/downlodr/store/downloadStore';
import {
  getAllDownloadActivityLogs,
  getDownloadActivityLog,
  type ActivityItem,
  type ActivityLog,
} from '@/downlodr/utils/error/activityHelper';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheckCircle } from 'react-icons/fa';

import { IoCodeSlashSharp } from 'react-icons/io5';

import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { BiSolidRightArrow } from 'react-icons/bi';
import { HiArrowPath } from 'react-icons/hi2';
import { LuFileSearch2 } from 'react-icons/lu';
import {
  MdAccessTime,
  MdBugReport,
  MdOutlineClose,
  MdOutlineContentCopy,
  MdOutlineFileDownload,
} from 'react-icons/md';
import { TbFileCheck } from 'react-icons/tb';

// Telemetry imports
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { TelemetryService } from '@/core-app/telemetry/utils/telemetryService';

interface DownloadLogsProps {
  isOpen: boolean;
  onClose: () => void;
  downloadId?: string;
}

const DownloadLogs: React.FC<DownloadLogsProps> = ({
  isOpen,
  onClose,
  downloadId,
}) => {
  const { t } = useTranslation('downloadLogs');
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Error telemetry state
  const [isSendingError, setIsSendingError] = useState(false);
  const [errorSendResult, setErrorSendResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  // Get store state for real-time updates
  const history = useDownloadStore((state) => state.historyDownloads);
  const downloading = useDownloadStore((state) => state.downloading);
  const forDownloads = useDownloadStore((state) => state.forDownloads);
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );
  const queuedDownloads = useDownloadStore((state) => state.queuedDownloads);

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

  // Removed automatic error telemetry trigger - now handled app-wide by useErrorTelemetryMonitor

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

    // Reset error report state when switching downloads
    setErrorSendResult(null);
    setIsSendingError(false);
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
      IconComponent = MdOutlineFileDownload;
      colorClass = 'text-yellow-500';
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
    }

    if (status === 'active') {
      animationClass = 'animate-pulse';
    }

    return (
      <IconComponent size={16} className={`${colorClass} ${animationClass}`} />
    );
  };

  const handleCopyLogs = async () => {
    try {
      const logContent =
        specificDownload?.log || 'No logs available for this download.';

      // Prepare metadata to append
      const downloadName = specificDownload?.name || 'Unknown Download';
      const videoUrl = specificDownload?.videoUrl || 'Unknown URL';
      const formatInfo =
        specificDownload?.formatId && specificDownload.formatId.trim() !== ''
          ? `${specificDownload.formatId} ${specificDownload?.ext || ''}`
          : specificDownload?.audioFormatId &&
            specificDownload.audioFormatId.trim() !== ''
          ? `${specificDownload.audioFormatId} ${
              specificDownload?.audioExt || ''
            }`
          : 'Unknown format';

      // Combine metadata and logs
      const fullContent = `Download Information:
Name: ${downloadName}
URL: ${videoUrl}
Format: ${formatInfo}
Status: ${specificDownload?.status || 'Unknown'}

=== LOGS ===
${logContent}`;

      await navigator.clipboard.writeText(fullContent);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy logs to clipboard:', err);
      // Fallback for older browsers
      try {
        const logContent =
          specificDownload?.log || 'No logs available for this download.';

        // Prepare metadata to append (same as above)
        const downloadName = specificDownload?.name || 'Unknown Download';
        const videoUrl = specificDownload?.videoUrl || 'Unknown URL';
        const formatInfo =
          specificDownload?.formatId && specificDownload.formatId.trim() !== ''
            ? `${specificDownload.formatId} ${specificDownload?.ext || ''}`
            : specificDownload?.audioFormatId &&
              specificDownload.audioFormatId.trim() !== ''
            ? `${specificDownload.audioFormatId} ${
                specificDownload?.audioExt || ''
              }`
            : 'Unknown format';

        // Combine metadata and logs
        const fullContent = `Download Information:
Name: ${downloadName}
URL: ${videoUrl}
Format: ${formatInfo}
Status: ${specificDownload?.status || 'Unknown'}

=== LOGS ===
${logContent}`;

        const textArea = document.createElement('textarea');
        textArea.value = fullContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy method also failed:', fallbackErr);
        toast({
          variant: 'destructive',
          title: t('toast.copyFailedTitle'),
          description: t('toast.copyFailedDesc'),
          duration: 3000,
        });
      }
    }
  };

  // Function to save and download logs as a file
  const handleDownloadLogs = async () => {
    try {
      const logContent =
        specificDownload?.log || 'No logs available for this download.';

      // Prepare metadata to append
      const downloadName = specificDownload?.name || 'Unknown Download';
      const videoUrl = specificDownload?.videoUrl || 'Unknown URL';
      const formatInfo =
        specificDownload?.formatId && specificDownload.formatId.trim() !== ''
          ? `${specificDownload.formatId} ${specificDownload?.ext || ''}`
          : specificDownload?.audioFormatId &&
            specificDownload.audioFormatId.trim() !== ''
          ? `${specificDownload.audioFormatId} ${
              specificDownload?.audioExt || ''
            }`
          : 'Unknown format';
      toast({
        variant: 'success',
        title: t('toast.logsSavedTitle'),
        description: t('toast.logsSavedDesc'),
        duration: 3000,
      });
      // Get the download folder path
      const downloadFolderPath = specificDownload?.location || '';
      if (!downloadFolderPath) {
        console.error('No download folder path available');
        return;
      }

      // Create safe filename: downloadName + " activity log.txt"
      const safeDownloadName = downloadName
        .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .slice(0, 50); // Limit length

      const logFileName = `${safeDownloadName}_download_log.txt`;

      // Create the full path for the log file
      const logFilePath = await window.downlodrFunctions.joinDownloadPath(
        downloadFolderPath,
        logFileName,
      );

      // Format the download date
      const downloadDate = specificDownload?.DateAdded
        ? new Date(specificDownload.DateAdded).toLocaleString()
        : 'Unknown date';

      // Combine metadata and logs with download date
      const fullContent = `Activity Log - Generated on ${new Date().toLocaleString()}
================================================================================

Download Information:
Name: ${downloadName}
URL: ${videoUrl}
Format: ${formatInfo}
Status: ${specificDownload?.status || 'Unknown'}
Progress: ${specificDownload?.progress || 0}%
Download Date: ${downloadDate}

=== DOWNLOAD LOGS ===
${logContent}

================================================================================
End of logs - Generated by UI Downlodr v2`;

      // Write the file using the app's file system operations
      const result = await window.plugins.writeFile({
        customPath: logFilePath,
        content: fullContent,
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
          title: t('toast.logsSavedTitle'),
          description: t('toast.logsSavedPathDesc', { path: logFilePath }),
          duration: 3000,
        });
      } else {
        console.error('Failed to save log file:', result.error);
        toast({
          variant: 'destructive',
          title: t('toast.logsFailedTitle'),
          description: t('toast.logsFailedPathDesc', { path: logFilePath }),
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Failed to save log file:', error);
      toast({
        variant: 'destructive',
        title: t('toast.logsFailedTitle'),
        description: t('toast.logsFailedDesc'),
        duration: 3000,
      });
    }
  };

  // Helper function to copy activity log
  const copyActivityLog = async (log: ActivityLog) => {
    try {
      const logText = `Activity Log for: ${log.downloadName}
 ${log.videoUrl}
Status: ${log.currentStage}
Progress: ${log.overallProgress}%

=== ACTIVITY TIMELINE ===
${log.activities
  .map(
    (activity) => `
[${activity.timestamp}] ${activity.title}
Status: ${activity.status}
${activity.description}
${
  activity.details
    ? `Speed: ${activity.details.speed || 'N/A'}, Time Left: ${
        activity.details.timeLeft || 'N/A'
      }`
    : ''
}
`,
  )
  .join('\n')}`;

      await navigator.clipboard.writeText(logText);
      toast({
        variant: 'success',
        title: t('toast.activityCopiedTitle'),
        description: t('toast.activityCopiedDesc'),
        duration: 3000,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('toast.activityCopyFailedTitle'),
        description: t('toast.activityCopyFailedDesc'),
        duration: 3000,
      });
    }
  };

  // Helper function to extract error messages from logs
  const extractErrorMessages = (logContent: string): string => {
    if (!logContent) return 'No logs available';
    const lines = logContent.split('\n');
    const errorLines: string[] = [];
    const errorKeywords = [
      'ERROR:',
      'Error:',
      'error:',
      'FAILED:',
      'Failed:',
      'failed:',
      'EXCEPTION:',
      'Exception:',
      'exception:',
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (errorKeywords.some((keyword) => line.includes(keyword))) {
        errorLines.push(line);
      }
    }
    // If no specific errors found, look for other failure indicators
    if (errorLines.length === 0) {
      const warningKeywords = [
        'WARNING:',
        'Warning:',
        'warning:',
        'WARN:',
        'Warn:',
        'warn:',
      ];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (warningKeywords.some((keyword) => line.includes(keyword))) {
          errorLines.push(line);
        }
      }
    }

    // If still no errors found, return last few lines that might contain relevant info
    if (errorLines.length === 0) {
      const lastLines = lines.slice(-5).filter((line) => line.trim());
      return lastLines.length > 0
        ? lastLines.join('\n')
        : 'No specific error messages found in logs';
    }

    return errorLines.join('\n');
  };

  // Error telemetry function - sends comprehensive error information
  // NOTE: This is for MANUAL error reporting only. Automatic error telemetry
  // is now handled app-wide by useErrorTelemetryMonitor hook in App.tsx
  const handleSendErrorTelemetry = async () => {
    if (isSendingError || !specificDownload) return;

    setIsSendingError(true);
    setErrorSendResult(null);

    try {
      // Create telemetry service
      const tempTelemetry = new TelemetryService({
        apiEndpoint: config.telemetry.endpoint,
      });
      await tempTelemetry.init();

      const logContent = specificDownload.log || '';

      // Use the simplified sendDownloadError method
      const success = await tempTelemetry.sendDownloadError({
        error: new Error(`Download failed: ${specificDownload.status}`),
        logMessage: logContent,
        downloadContext: {
          url: specificDownload.videoUrl,
          format:
            specificDownload.formatId ||
            specificDownload.audioFormatId ||
            'unknown',
          quality:
            specificDownload.formatId ||
            specificDownload.audioFormatId ||
            'unknown',
          downloadName: specificDownload.name,
          downloadId: specificDownload.id,
          progress: specificDownload.progress,
          location: specificDownload.location,
          fileExtension: specificDownload.ext || specificDownload.audioExt,
          sessionDurationSeconds: specificDownload.elapsed || 0,
        },
      });

      setErrorSendResult({ success });

      toast({
        variant: 'success',
        title: t('toast.errorReportSentTitle'),
        description: t('toast.errorReportSentDesc'),
        duration: 3000,
      });
    } catch (error: unknown) {
      const errorMessage =
        (
          error as {
            response?: { data?: { message?: string } };
            message?: string;
          }
        )?.response?.data?.message ||
        (error as { message?: string })?.message ||
        'Failed to send error report';
      console.error('💥 Error telemetry failed:', errorMessage);
      setErrorSendResult({ success: false, error: errorMessage });

      toast({
        variant: 'destructive',
        title: t('toast.errorReportFailedTitle'),
        description: errorMessage,
        duration: 3000,
      });
    } finally {
      setIsSendingError(false);
    }
  };

  // Helper function to determine if error report button should be shown
  const shouldShowErrorReport = () => {
    return (
      specificDownload?.status === 'failed' ||
      specificDownload?.status === 'error' ||
      (specificDownload?.log &&
        (specificDownload.log.toLowerCase().includes('error') ||
          specificDownload.log.toLowerCase().includes('failed') ||
          specificDownload.log.toLowerCase().includes('exception')))
    );
  };

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [specificDownload?.log, autoScroll]);

  // Handle scroll to detect if user manually scrolled up
  const handleScroll = () => {
    if (logContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px tolerance
      setAutoScroll(isAtBottom);
    }
  };

  const logContent =
    specificDownload?.log || 'No logs available for this download.';
  const logLines = logContent.split('\n').filter((line) => line.trim() !== '');

  return (
    <div
      className="h-full bg-white dark:bg-darkMode flex flex-col flex-shrink-0"
      style={{ width: '400px' }}
    >
      {/* Header */}
      <div className="bg-toggleGroupBaseColor pr-6 pl-4 dark:bg-darkModeTable px-2 py-1 pt-[11px] dark:border-darkModeCompliment flex items-center justify-between rounded-t-md">
        <div className="flex items-center flex-1">
          <IoCodeSlashSharp
            size={16}
            color="#F45513"
            className="mr-2 color-[#F45513]"
          />
          <span className="text-black dark:text-white font-semibold text-sm leading-6">
            {t('title')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TooltipWrapper
            content={
              isActiveDownload ? t('tooltip.copyActive') : t('tooltip.copy')
            }
            side="bottom"
          >
            <button
              onClick={handleCopyLogs}
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
              isActiveDownload ? t('tooltip.saveActive') : t('tooltip.save')
            }
            side="bottom"
          >
            <button
              onClick={handleDownloadLogs}
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
          {/* Error Report Button - Only show for failed downloads */}
          {shouldShowErrorReport() && (
            <TooltipWrapper
              content={
                isActiveDownload
                  ? t('tooltip.errorReportActive')
                  : isSendingError
                  ? t('tooltip.errorReportSending')
                  : errorSendResult?.success
                  ? t('tooltip.errorReportSent')
                  : errorSendResult?.error
                  ? t('tooltip.errorReportFailed', {
                      error: errorSendResult.error,
                    })
                  : t('tooltip.errorReport')
              }
              side="bottom"
            >
              <button
                onClick={handleSendErrorTelemetry}
                disabled={isSendingError || isActiveDownload}
                className={`ml-2 p-1 flex-shrink-0 transition-all duration-200 ${
                  isActiveDownload || isSendingError
                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                    : errorSendResult?.success
                    ? 'text-green-500 hover:text-green-600'
                    : errorSendResult?.error
                    ? 'text-red-500 hover:text-red-600'
                    : 'text-black dark:text-white hover:text-orange-500'
                }`}
              >
                {isSendingError ? (
                  <HiArrowPath size={16} className="animate-spin" />
                ) : errorSendResult?.success ? (
                  <FaCheckCircle size={14} />
                ) : (
                  <MdBugReport size={16} />
                )}
              </button>
            </TooltipWrapper>
          )}
          <TooltipWrapper content={t('tooltip.close')} side="bottom">
            <button
              onClick={onClose}
              className="text-black dark:text-white hover:text-red-500 dark:hover:text-red-500 ml-2 p-1 flex-shrink-0"
            >
              <MdOutlineClose size={16} />
            </button>
          </TooltipWrapper>
        </div>
      </div>

      {/* Log content container */}
      <div className="flex-1 overflow-hidden mb-4">
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto pl-4 pr-6 py-4 text-gray-800 dark:text-gray-200 whitespace-pre-wrap"
        >
          <div className="mb-2 space-y-2">
            <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-200 break-words whitespace-pre-wrap break-all">
              {specificDownload?.name}
            </h1>
            <p className="break-words whitespace-pre-wrap break-all">
              {specificDownload?.videoUrl}
            </p>
            <p>
              {t('status')}: {specificDownload?.status}
            </p>
            <p>
              {t('progress')}: {specificDownload?.progress}%
            </p>
            {specificDownload?.status === 'failed' && false && (
              <p className="text-red-500 dark:text-red-400">
                Error Report Sent: {errorSendResult?.success ? 'Yes' : 'No'}
              </p>
            )}
          </div>
          <hr className="solid mb-3 -mx-6 w-[calc(100%+48px)] border-t-2 border-divider dark:border-gray-700" />

          {logLines.length > 0 ? (
            <div className="space-y-3">
              {logLines.map((line, index) => (
                <div
                  key={index}
                  className={`${
                    line.toLowerCase().includes('error') ||
                    line.toLowerCase().includes('failed')
                      ? 'text-red-600 dark:text-red-400'
                      : line.toLowerCase().includes('destination:')
                      ? 'text-blue-600 dark:text-blue-400'
                      : line.toLowerCase().includes('warning')
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : line.toLowerCase().includes('success') ||
                        line.toLowerCase().includes('finished')
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-800 dark:text-gray-200'
                  } text-[12px] whitespace-pre-wrap break-all`}
                >
                  {line}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400 italic">
              {t('noLogs')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DownloadLogs;
