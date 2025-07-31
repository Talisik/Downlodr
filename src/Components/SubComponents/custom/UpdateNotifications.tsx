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
import { FaArrowCircleUp } from 'react-icons/fa';

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
  // Internal state for app updates
  const [internalUpdateInfo, setInternalUpdateInfo] =
    useState<UpdateInfo | null>(null);
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Determine which state to use
  const updateInfo = externalUpdateInfo || internalUpdateInfo;
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  useEffect(() => {
    // console.log('UpdateNotification mounting/re-mounting');

    // Only add the listener for app updates when no external control is provided
    if (!externalUpdateInfo && updateType === 'app') {
      let removeListener: (() => void) | undefined;

      if (window.updateAPI?.onUpdateAvailable) {
        // Listen for update notifications from the main process
        removeListener = window.updateAPI.onUpdateAvailable((info) => {
          if (info.hasUpdate) {
            setInternalUpdateInfo(info);
            setInternalIsOpen(true);
          }
        });
      }

      // Clean up the listener when the component unmounts
      return () => {
        console.log('UpdateNotification unmounting');
        if (removeListener) {
          removeListener();
        }
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

  const handleDownload = async () => {
    if (updateType === 'plugin' && onUpdate) {
      // For plugin updates, call the provided update handler
      onUpdate();
    } else if (updateType === 'app' && updateInfo?.downloadUrl) {
      // For app updates, open the download link
      await window.downlodrFunctions.openExternalLink(
        'https://downlodr.com/downloads/',
      );
    }
    handleClose();
  };

  if (!updateInfo || !updateInfo.hasUpdate) {
    return null;
  }

  const getTitle = () => {
    if (updateType === 'plugin' && pluginName) {
      return `${pluginName} Update Available: v${updateInfo.latestVersion}`;
    }
    return `Update Available: v${updateInfo.latestVersion}`;
  };

  const getDescription = () => {
    if (updateType === 'plugin' && pluginName) {
      return `A new version of ${pluginName} is available!`;
    }
    return `A new version of Downlodr is available!`;
  };

  const getDescription2 = () => {
    if (updateType === 'plugin' && pluginName) {
      return `You're currently using v${updateInfo.currentVersion}.`;
    }
    return `You're currently using v${updateInfo.currentVersion}.`;
  };

  const getDownloadButtonText = () => {
    return updateType === 'plugin' ? 'Update Now' : 'Download Now';
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent className="sm:max-w-lg bg-white dark:bg-darkModeDropdown rounded-lg pb-4 pt-6 px-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 dark:text-gray-200 text-[15px]">
            <div className="bg-slate-100 rounded-full dark:bg-darkMode">
              <FaArrowCircleUp className="text-primary" size={19} />
            </div>
            <span>{getTitle()}</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="ml-1 flex flex-col ">
            <span className="text-sm text-gray-500 dark:text-gray-400 text-[12px]">
              {getDescription()}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 text-[12px]">
              {getDescription2()}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {updateInfo.releaseNotes && (
          <div className="p-2 bg-slate-100 rounded text-sm max-h-32 overflow-y-auto dark:bg-darkMode dark:text-gray-200">
            <p className="text-sm text-slate-700 dark:text-gray-200 whitespace-pre-line text-[12px]">
              {updateInfo.releaseNotes}
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
              onClick={handleDownload}
              size="sm"
              className="h-7 px-4 py-4.8 text-sm dark:bg-primary dark:text-white bg-primary text-sm text-white dark:hover:bg-primary/90 dark:hover:text-white"
            >
              {getDownloadButtonText()}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default UpdateNotification;
