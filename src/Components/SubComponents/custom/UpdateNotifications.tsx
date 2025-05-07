import React, { useState, useEffect } from 'react';
import { FaArrowCircleUp } from 'react-icons/fa';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '../shadcn/components/ui/alert-dialog';
import { Button } from '../shadcn/components/ui/button';
import { Badge } from '../shadcn/components/ui/badge';
import { toast } from '../shadcn/hooks/use-toast';

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
      if (removeListener) {
        console.log('Removing update listener');
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
      <AlertDialogContent className="sm:max-w-md bg-white dark:bg-darkMode">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 dark:text-gray-200">
            <div className="bg-slate-100 rounded-full dark:bg-slate-800">
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
          <div className="p-2 bg-slate-100 rounded text-sm max-h-32 overflow-y-auto dark:bg-slate-800 dark:text-gray-200">
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
              className="h-8 px-4 py-4.8 text-sm text-black dark:text-gray-200"
            >
              Later
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              onClick={handleDownload}
              size="sm"
              className="h-7 px-3 py-2 text-sm"
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
