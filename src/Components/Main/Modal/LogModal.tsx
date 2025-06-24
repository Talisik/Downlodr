/**
 * A custom React component
 * Shows the log modal for a specific download, displaying logs in real time
 *
 * @param isOpen - If modal is open, keeps it open
 * @param onClose - If modal has been closed, closes modal
 * @param downloadId - The ID of the download to show logs for
 * @returns JSX.Element - The rendered component displaying download logs
 *
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from 'react';
import useDownloadStore from '../../../Store/downloadStore';

interface LogModalProps {
  isOpen: boolean;
  onClose: () => void;
  downloadId: string;
}

const LogModal: React.FC<LogModalProps> = ({ isOpen, onClose, downloadId }) => {
  const navRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Get all downloads from different states
  const history = useDownloadStore((state) => state.historyDownloads);
  const downloading = useDownloadStore((state) => state.downloading);
  const forDownloads = useDownloadStore((state) => state.forDownloads);
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );
  const queuedDownloads = useDownloadStore((state) => state.queuedDownloads);

  // Close Modal
  const handleClose = () => {
    onClose();
  };

  // Handles event when user clicks outside modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Find the specific download by ID
  const specificDownload = [
    ...forDownloads,
    ...downloading,
    ...finishedDownloads,
    ...history,
    ...queuedDownloads,
  ].find((download) => download.id === downloadId);

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

  // Move conditional return here, after hooks but before render
  if (!isOpen) return null;

  const logContent =
    specificDownload?.log || 'No logs available for this download.';
  const logLines = logContent.split('\n').filter((line) => line.trim() !== '');

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-20 dark:bg-opacity-50 flex items-center justify-center h-full z-[8999]"
      onClick={(e) => {
        // Only close if clicking the overlay background
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        ref={navRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-darkModeDropdown rounded-lg p-6 max-w-4xl w-full mx-4 h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="mb-4 flex-shrink-0">
          <h2 className="text-lg font-semibold dark:text-gray-200">
            Download Logs
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
            {specificDownload?.name || 'Unknown Download'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Status: {specificDownload?.status || 'Unknown'}
          </p>
        </div>

        {/* Log content container */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={logContainerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md p-3 font-mono text-sm"
          >
            {logLines.length > 0 ? (
              <div className="space-y-1">
                {logLines.map((line, index) => (
                  <div
                    key={index}
                    className={`${
                      line.toLowerCase().includes('error') ||
                      line.toLowerCase().includes('failed')
                        ? 'text-red-600 dark:text-red-400'
                        : line.toLowerCase().includes('warning')
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : line.toLowerCase().includes('success') ||
                          line.toLowerCase().includes('finished')
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-800 dark:text-gray-200'
                    } whitespace-pre-wrap break-all`}
                  >
                    {line}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 dark:text-gray-400 italic">
                No logs available for this download.
              </div>
            )}
          </div>
        </div>

        {/* Auto-scroll indicator */}
        {!autoScroll && (
          <div className="mt-2 text-center flex-shrink-0">
            <button
              onClick={() => {
                setAutoScroll(true);
                if (logContainerRef.current) {
                  logContainerRef.current.scrollTop =
                    logContainerRef.current.scrollHeight;
                }
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              ↓ Scroll to bottom for latest logs
            </button>
          </div>
        )}

        {/* Button commands */}
        <hr className="solid mt-4 mb-2 -mx-6 w-[calc(100%+48px)] border-t border-gray-200 dark:border-gray-600 flex-shrink-0" />

        <div className="flex justify-between items-center mt-2 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <label className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="mr-2 rounded"
              />
              Auto-scroll
            </label>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-darkModeHover dark:text-gray-200"
          >
            Close
          </button>
        </div>
        {/* End of Button commands */}
      </div>
    </div>
  );
};

export default LogModal;
