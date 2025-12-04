import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/Components/SubComponents/shadcn/components/ui/alert-dialog';
import { Button } from '@/Components/SubComponents/shadcn/components/ui/button';
import { UpdateInfo } from '@/plugins/types';
import React, { useEffect, useState } from 'react';
import { FaArrowCircleUp, FaDownload, FaCheckCircle } from 'react-icons/fa';
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

          // Show dialog when update is available or downloaded
          if (info.status === 'available' || info.status === 'downloaded') {
            setInternalIsOpen(true);
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
      // Note: With autoDownload=true, this shouldn't happen often
      console.log('[UpdateNotification] Starting download...');
      if (window.appAutoUpdater?.downloadUpdate) {
        await window.appAutoUpdater.downloadUpdate();
      }
      // Keep dialog open to show progress
    }
  };

  // Determine if we should show the dialog
  const shouldShow = () => {
    if (isPluginUpdate) {
      return externalUpdateInfo?.hasUpdate;
    }
    return autoUpdateInfo?.status === 'available' ||
           autoUpdateInfo?.status === 'downloaded' ||
           autoUpdateInfo?.status === 'downloading';
  };

  if (!shouldShow()) {
    return null;
  }

  const getTitle = () => {
    if (isPluginUpdate && pluginName && externalUpdateInfo) {
      return `${pluginName} Update Available: v${externalUpdateInfo.latestVersion}`;
    }

    if (autoUpdateInfo?.status === 'downloaded') {
      return `Update Ready: v${autoUpdateInfo.version}`;
    }
    if (autoUpdateInfo?.status === 'downloading') {
      return `Downloading Update: v${autoUpdateInfo.version}`;
    }
    return `Update Available: v${autoUpdateInfo?.version}`;
  };

  const getDescription = () => {
    if (isPluginUpdate && pluginName) {
      return `A new version of ${pluginName} is available!`;
    }

    if (autoUpdateInfo?.status === 'downloaded') {
      return 'The update has been downloaded and is ready to install.';
    }
    if (autoUpdateInfo?.status === 'downloading') {
      return 'Downloading the update in the background...';
    }
    return 'A new version of Downlodr is available!';
  };

  const getDescription2 = () => {
    if (isPluginUpdate && externalUpdateInfo) {
      return `You're currently using v${externalUpdateInfo.currentVersion}.`;
    }
    return `You're currently using v${autoUpdateInfo?.currentVersion}.`;
  };

  const getActionButtonText = () => {
    if (isPluginUpdate) {
      return 'Update Now';
    }
    if (autoUpdateInfo?.status === 'downloaded') {
      return 'Install & Restart';
    }
    if (autoUpdateInfo?.status === 'downloading') {
      return `Downloading ${Math.round(downloadProgress)}%`;
    }
    return 'Download Now';
  };

  const getActionButtonIcon = () => {
    if (autoUpdateInfo?.status === 'downloaded') {
      return <FaCheckCircle size={14} />;
    }
    if (autoUpdateInfo?.status === 'downloading') {
      return <RxUpdate size={14} className="animate-spin" />;
    }
    return <FaDownload size={14} />;
  };

  const isActionDisabled = autoUpdateInfo?.status === 'downloading';

  const releaseNotes = isPluginUpdate
    ? externalUpdateInfo?.releaseNotes
    : autoUpdateInfo?.releaseNotes;

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent className="sm:max-w-lg bg-white dark:bg-darkModeDropdown rounded-lg pb-4 pt-6 px-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 dark:text-gray-200 text-[15px]">
            <div className="bg-slate-100 rounded-full dark:bg-darkMode p-1">
              {autoUpdateInfo?.status === 'downloaded' ? (
                <FaCheckCircle className="text-green-500" size={17} />
              ) : autoUpdateInfo?.status === 'downloading' ? (
                <RxUpdate className="text-primary animate-spin" size={17} />
              ) : (
                <FaArrowCircleUp className="text-primary" size={17} />
              )}
            </div>
            <span>{getTitle()}</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="ml-1 flex flex-col">
            <span className="text-sm text-gray-500 dark:text-gray-400 text-[12px]">
              {getDescription()}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 text-[12px]">
              {getDescription2()}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Download Progress Bar */}
        {autoUpdateInfo?.status === 'downloading' && (
          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700 my-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        )}

        {releaseNotes && (
          <div className="p-2 bg-slate-100 rounded text-sm max-h-32 overflow-y-auto dark:bg-darkMode dark:text-gray-200">
            <p className="text-sm text-slate-700 dark:text-gray-200 whitespace-pre-line text-[12px]">
              {releaseNotes}
            </p>
          </div>
        )}

        <AlertDialogFooter className="flex items-center justify-end gap-2 py-1">
          <AlertDialogCancel asChild>
            <Button
              variant="default"
              size="sm"
              className="h-7 px-4 py-4.8 text-sm text-black dark:bg-darkModeDropdown text-sm dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
              onClick={handleClose}
            >
              Later
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              onClick={handleAction}
              disabled={isActionDisabled}
              size="sm"
              className="h-7 px-4 py-4.8 text-sm dark:bg-primary dark:text-white bg-primary text-sm text-white dark:hover:bg-primary/90 dark:hover:text-white flex items-center gap-2 disabled:opacity-70"
            >
              {getActionButtonIcon()}
              {getActionButtonText()}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default UpdateNotification;
