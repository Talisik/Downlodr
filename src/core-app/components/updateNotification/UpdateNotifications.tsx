import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/core-app/components/shadcn/components/ui/alert-dialog';
import { Button } from '@/core-app/components/shadcn/components/ui/button';
import { useSettingStore } from '@/core-app/store/settingsStore';
import { useUpdateListener } from '@/core-app/utils/manager/eventManager';
import { UpdateInfo } from '@/plugins/schema/types';
import React, { useEffect, useState } from 'react';
import { FaArrowCircleUp } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';

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
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Access main store for "don't show again" preferences
  const settings = useSettingStore((state) => state.settings);
  const updateDontShowAppUpdates = useSettingStore(
    (state) => state.updateDontShowAppUpdates,
  );
  const updateDontShowPluginUpdates = useSettingStore(
    (state) => state.updateDontShowPluginUpdates,
  );

  // Determine which state to use
  const updateInfo = externalUpdateInfo || internalUpdateInfo;
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  useEffect(() => {
    // Only add the listener for app updates when no external control is provided
    if (!externalUpdateInfo && updateType === 'app') {
      // Use the centralized event manager to prevent memory leaks
      const removeListener = useUpdateListener((info) => {
        if (info.hasUpdate && !settings.dontShowAppUpdates) {
          setInternalUpdateInfo(info);
          setInternalIsOpen(true);
        }
      }, 'UpdateNotification');

      // Clean up the listener when the component unmounts
      return removeListener;
    }
  }, [externalUpdateInfo, updateType, settings.dontShowAppUpdates]);

  // Effect to handle external open state changes for plugin updates
  useEffect(() => {
    if (externalIsOpen !== undefined) {
      // For plugin updates, check the preference before showing
      if (updateType === 'plugin' && settings.dontShowPluginUpdates) {
        // Don't show plugin update if user chose not to see them
        return;
      }
      setInternalIsOpen(externalIsOpen);
    }
  }, [externalIsOpen, updateType, settings.dontShowPluginUpdates]);

  const handleClose = () => {
    // Save "don't show again" preference if checked
    if (dontShowAgain) {
      if (updateType === 'app') {
        updateDontShowAppUpdates(true);
      } else if (updateType === 'plugin') {
        updateDontShowPluginUpdates(true);
      }
    }

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
        'https://downlodr.com/download/',
      );
    }
    handleClose();
  };

  if (!updateInfo || !updateInfo.hasUpdate) {
    return null;
  }

  // Check "don't show again" preferences
  if (updateType === 'app' && settings.dontShowAppUpdates) {
    return null;
  }

  if (updateType === 'plugin' && settings.dontShowPluginUpdates) {
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
      <AlertDialogContent className="sm:max-w-lg bg-white dark:bg-darkModeDropdown rounded-lg pb-4 pt-6 px-6 z-[10000]">
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
            <div className="text-sm text-slate-700 dark:text-gray-200 text-[12px]">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-sm font-semibold mb-1">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-sm font-semibold mb-1">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-semibold mb-1">{children}</h3>
                  ),
                  p: ({ children }) => <p className="mb-1">{children}</p>,
                  ul: ({ children }) => (
                    <ul className="list-disc pl-4 mb-1">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-4 mb-1">{children}</ol>
                  ),
                  li: ({ children }) => <li className="mb-0.5">{children}</li>,
                  strong: ({ children }) => (
                    <strong className="font-semibold">{children}</strong>
                  ),
                  a: ({ children, href }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {updateInfo.releaseNotes}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Don't show this again checkbox */}
        <div className="flex items-center space-x-2 px-1">
          <input
            id="dontShowAgain"
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded dark:border-gray-600 dark:bg-darkMode"
          />
          <label
            htmlFor="dontShowAgain"
            className="text-sm text-gray-600 dark:text-gray-400 select-none cursor-pointer"
          >
            Don't show this again
          </label>
        </div>

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
              className="h-7 px-4 py-4.8 text-sm dark:bg-primary dark:text-white bg-primary text-sm text-white hover:bg-primary/90 dark:hover:bg-primary/90 dark:hover:text-white"
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
