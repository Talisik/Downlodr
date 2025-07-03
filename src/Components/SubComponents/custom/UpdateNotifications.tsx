import React, { useEffect, useState } from 'react';
import { FaArrowCircleUp } from 'react-icons/fa';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../shadcn/components/ui/alert-dialog';
import { Button } from '../shadcn/components/ui/button';

// Define the update info type
interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseUrl: string;
  releaseNotes: string;
  downloadUrl: string;
  publishedAt: Date;
}

const UpdateNotification: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    console.log('UpdateNotification mounting/re-mounting');

    // Only add the listener if we're in an Electron environment
    let removeListener: (() => void) | undefined;

    if (window.updateAPI?.onUpdateAvailable) {
      // Listen for update notifications from the main process
      removeListener = window.updateAPI.onUpdateAvailable((info) => {
        if (info.hasUpdate) {
          setUpdateInfo(info);
          setOpen(true);
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
  }, []);

  if (!updateInfo) {
    return null;
  }

  const handleDownload = async () => {
    if (updateInfo?.downloadUrl) {
      await window.downlodrFunctions.openExternalLink(
        'https://downlodr.com/downloads/',
      );
    }
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="sm:max-w-lg bg-white dark:bg-darkModeDropdown">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 dark:text-gray-200">
            <div className="bg-slate-100 rounded-full dark:bg-darkMode">
              <FaArrowCircleUp className="text-primary" size={19} />
            </div>
            <span>Update Available: v{updateInfo.latestVersion}</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="ml-1">
            A new version of Downlodr is available! You're currently using v
            {updateInfo.currentVersion}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {updateInfo.releaseNotes && (
          <div className="p-2 bg-slate-100 rounded text-sm max-h-32 overflow-y-auto dark:bg-darkMode dark:text-gray-200">
            <p className="text-sm text-slate-700 dark:text-gray-200 whitespace-pre-line">
              {updateInfo.releaseNotes}
            </p>
          </div>
        )}

        <AlertDialogFooter className="flex items-center justify-end gap-2">
          <AlertDialogCancel asChild>
            <Button
              variant="default"
              size="sm"
              className="h-8 px-4 py-4.8 text-sm text-black dark:bg-darkModeDropdown dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
            >
              Later
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              onClick={handleDownload}
              size="sm"
              className="h-8 px-4 py-4.8 text-sm dark:bg-primary dark:text-white bg-primary text-white dark:hover:bg-primary/90 dark:hover:text-white"
            >
              Download Now
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default UpdateNotification;
