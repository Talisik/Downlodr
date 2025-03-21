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

// Add the window interface
declare global {
  interface Window {
    updateAPI: {
      onUpdateAvailable: (callback: (updateInfo: UpdateInfo) => void) => void;
      checkForUpdates: () => Promise<void>;
    };
  }
}

const UpdateNotification: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only add the listener if we're in an Electron environment
    if (window.updateAPI) {
      // Listen for update notifications from the main process
      window.updateAPI.onUpdateAvailable((info) => {
        setUpdateInfo(info);
        setOpen(true);
      });
    }
  }, []);

  if (!updateInfo) {
    return null;
  }

  const handleDownload = () => {
    if (updateInfo?.downloadUrl) {
      window.open(updateInfo.downloadUrl, '_blank');
    }
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <div className="bg-slate-100 p-1.5 rounded-full dark:bg-slate-800">
              <FaArrowCircleUp className="text-primary" size={18} />
            </div>
            <span>Update Available: v{updateInfo.latestVersion}</span>
          </AlertDialogTitle>
          <AlertDialogDescription>
            A new version of Downlodr is available! You're currently using v
            {updateInfo.currentVersion}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {updateInfo.releaseNotes && (
          <div className="my-4 p-3 bg-slate-100 rounded text-sm max-h-32 overflow-y-auto dark:bg-slate-800 dark:text-slate-300">
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line">
              {updateInfo.releaseNotes}
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" size="sm">
              Later
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={handleDownload} size="sm">
              Download Now
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default UpdateNotification;
