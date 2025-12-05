import { UpdateInfo } from '@/plugins/types';
import React, { useEffect, useState } from 'react';
import { HiOutlineGift } from 'react-icons/hi2';
import { RxUpdate } from 'react-icons/rx';

// Types for auto-updater status
type AutoUpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

interface AutoUpdateInfo {
  status: AutoUpdateStatus;
  version?: string;
  currentVersion?: string;
  releaseNotes?: string;
  releaseDate?: string;
  error?: string;
  progress?: {
    percent: number;
    transferred: number;
    total: number;
    bytesPerSecond: number;
  };
}

interface UpdateNotificationProps {
  // For plugin updates - external control
  updateInfo?: UpdateInfo;
  isOpen?: boolean;
  onClose?: () => void;
  onUpdate?: () => void;
  updateType?: 'app' | 'plugin';
  pluginName?: string;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  updateInfo: externalUpdateInfo,
  isOpen: externalIsOpen,
  onClose,
  onUpdate,
  updateType = 'app',
  pluginName,
}) => {
  // Internal state for app auto-updates
  const [autoUpdateInfo, setAutoUpdateInfo] = useState<AutoUpdateInfo | null>(null);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isDismissed, setIsDismissed] = useState(false);

  // Determine which state to use
  const isPluginUpdate = updateType === 'plugin' && externalUpdateInfo;
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  useEffect(() => {
    // Only add listeners for app updates when no external control is provided
    if (!externalUpdateInfo && updateType === 'app' && window.appAutoUpdater) {
      let removeStatusListener: (() => void) | undefined;
      let removeProgressListener: (() => void) | undefined;

      // Listen for auto-update status changes
      if (window.appAutoUpdater.onUpdateStatus) {
        removeStatusListener = window.appAutoUpdater.onUpdateStatus((info: AutoUpdateInfo) => {
          console.log('[UpdateNotification] Auto-update status:', info);
          setAutoUpdateInfo(info);

          // Show notification when update is available, downloading, or downloaded
          // For auto-download mode: 'available' transitions quickly to 'downloading'
          // so we need to open on 'downloading' as well to ensure visibility
          if (info.status === 'available' || info.status === 'downloading' || info.status === 'downloaded') {
            setInternalIsOpen(true);
            // Reset dismissed state for 'available' and 'downloaded' to ensure user sees the notification
            // - 'available': New update found, user should see it
            // - 'downloaded': Update ready to install, user must see install prompt
            // Don't reset for 'downloading' to respect user's dismissal during download
            if (info.status === 'available' || info.status === 'downloaded') {
              setIsDismissed(false);
            }
          }
        });
      }

      // Listen for download progress
      if (window.appAutoUpdater.onDownloadProgress) {
        removeProgressListener = window.appAutoUpdater.onDownloadProgress((progress) => {
          console.log('[UpdateNotification] Download progress:', progress.percent);
          setDownloadProgress(progress.percent);
        });
      }

      // Clean up listeners when component unmounts
      return () => {
        if (removeStatusListener) removeStatusListener();
        if (removeProgressListener) removeProgressListener();
      };
    }
  }, [externalUpdateInfo, updateType]);

  // Effect to handle external open state changes for plugin updates
  useEffect(() => {
    if (externalIsOpen !== undefined) {
      setInternalIsOpen(externalIsOpen);
    }
  }, [externalIsOpen]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setIsDismissed(true);
      setInternalIsOpen(false);
    }
  };

  const handleAction = async () => {
    if (isPluginUpdate && onUpdate) {
      // For plugin updates, call the provided update handler
      onUpdate();
      handleClose();
    } else if (autoUpdateInfo?.status === 'downloaded') {
      // Update is downloaded - install it
      console.log('[UpdateNotification] Installing update...');
      if (window.appAutoUpdater?.installUpdate) {
        window.appAutoUpdater.installUpdate();
      }
      // Don't close - app will restart
    } else if (autoUpdateInfo?.status === 'available') {
      // Update is available but not downloaded yet - start download
      console.log('[UpdateNotification] Starting download...');
      if (window.appAutoUpdater?.downloadUpdate) {
        await window.appAutoUpdater.downloadUpdate();
      }
    }
  };

  // Determine if we should show the notification
  const shouldShow = () => {
    if (isDismissed) return false;
    if (isPluginUpdate) {
      return externalUpdateInfo?.hasUpdate && isOpen;
    }
    return (
      isOpen &&
      (autoUpdateInfo?.status === 'available' ||
        autoUpdateInfo?.status === 'downloaded' ||
        autoUpdateInfo?.status === 'downloading')
    );
  };

  if (!shouldShow()) {
    return null;
  }

  const getNotificationText = () => {
    if (isPluginUpdate && pluginName) {
      return `${pluginName} update available`;
    }
    if (autoUpdateInfo?.status === 'downloaded') {
      return 'Update ready to install';
    }
    if (autoUpdateInfo?.status === 'downloading') {
      return `Downloading update... ${Math.round(downloadProgress)}%`;
    }
    return 'New update available';
  };

  const getActionButtonText = () => {
    if (isPluginUpdate) {
      return 'Update Now';
    }
    if (autoUpdateInfo?.status === 'downloaded') {
      return 'Install Now';
    }
    if (autoUpdateInfo?.status === 'downloading') {
      return `${Math.round(downloadProgress)}%`;
    }
    // 'available' state: auto-download is enabled, so download starts automatically
    return 'Downloading...';
  };

  // Disable button during downloading and when auto-download is starting
  const isActionDisabled = autoUpdateInfo?.status === 'downloading' || autoUpdateInfo?.status === 'available';

  return (
    <div className="fixed bottom-4 left-4 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3 bg-[#1a1a2e] dark:bg-[#1a1a2e] text-white px-4 py-2.5 rounded-lg shadow-lg border border-gray-700/50">
        {/* Icon */}
        <div className="flex-shrink-0">
          {autoUpdateInfo?.status === 'downloading' ? (
            <RxUpdate className="text-primary animate-spin" size={18} />
          ) : (
            <HiOutlineGift className="text-primary" size={18} />
          )}
        </div>

        {/* Text */}
        <span className="text-sm font-medium text-gray-100">
          {getNotificationText()}
        </span>

        {/* Download Progress Bar (inline for downloading state) */}
        {autoUpdateInfo?.status === 'downloading' && (
          <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={handleClose}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors px-2 py-1"
          >
            Later
          </button>
          <button
            onClick={handleAction}
            disabled={isActionDisabled}
            className="text-sm font-medium text-primary bg-white hover:bg-gray-100 px-3 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {getActionButtonText()}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
