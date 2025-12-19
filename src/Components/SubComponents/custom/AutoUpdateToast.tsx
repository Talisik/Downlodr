/**
 * Auto-Update Toast Component
 * VS Code/Cursor-style toast notification for update ready state
 * Shows persistent toast when update is downloaded and ready to install
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  toast,
  useToast,
} from '@/Components/SubComponents/shadcn/hooks/use-toast';
import { ToastAction } from '@/Components/SubComponents/shadcn/components/ui/toast';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

export const AutoUpdateToast: React.FC = () => {
  const { dismiss } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const toastIdRef = useRef<string | null>(null);

  // Handle restart and install
  const handleRestartNow = useCallback(() => {
    if (window.autoUpdateAPI) {
      window.autoUpdateAPI.quitAndInstall();
    }
  }, []);

  // Show the "Update Ready" toast
  const showUpdateReadyToast = useCallback(
    (info: UpdateInfo) => {
      // Dismiss any existing toast first
      if (toastIdRef.current) {
        dismiss(toastIdRef.current);
      }

      const { id } = toast({
        title: 'Update Ready',
        description: `Downlodr ${info.version} is ready to install. Restart to update.`,
        duration: Infinity, // Keep showing until user acts
        action: (
          <ToastAction
            altText="Restart Now"
            onClick={handleRestartNow}
            className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-3 py-1.5 text-xs font-medium rounded"
          >
            <RefreshCw className="mr-1.5 h-3 w-3" />
            Restart Now
          </ToastAction>
        ),
      });

      toastIdRef.current = id;
    },
    [dismiss, handleRestartNow],
  );

  useEffect(() => {
    // Skip if autoUpdateAPI is not available (development mode)
    if (!window.autoUpdateAPI) {
      return;
    }

    const cleanupFunctions: Array<() => void> = [];

    // Listen for update available - download starting
    const cleanupAvailable = window.autoUpdateAPI.onUpdateAvailable(
      (info: UpdateInfo) => {
        setUpdateInfo(info);
        setIsDownloading(true);
        setUpdateReady(false);

        // Optional: Show a subtle downloading notification
        // Uncomment if you want to show download progress
        // toast({
        //   title: 'Downloading Update',
        //   description: `Version ${info.version} is being downloaded...`,
        //   duration: 3000,
        // });
      },
    );
    cleanupFunctions.push(cleanupAvailable);

    // Listen for download progress (optional - for future progress UI)
    const cleanupProgress = window.autoUpdateAPI.onDownloadProgress(
      (progress) => {
        // Progress tracking - could be used for a progress bar
        // console.log(`Download progress: ${Math.round(progress.percent)}%`);
      },
    );
    cleanupFunctions.push(cleanupProgress);

    // Listen for update downloaded - SHOW MAIN NOTIFICATION
    const cleanupDownloaded = window.autoUpdateAPI.onUpdateDownloaded(
      (info: UpdateInfo) => {
        setIsDownloading(false);
        setUpdateReady(true);
        setUpdateInfo(info);

        // Show the "Restart to Update" toast
        showUpdateReadyToast(info);
      },
    );
    cleanupFunctions.push(cleanupDownloaded);

    // Listen for errors (silent handling)
    const cleanupError = window.autoUpdateAPI.onError((error) => {
      setIsDownloading(false);
      console.error('Auto-update error:', error.message);
      // Silent fail - don't show error toast to avoid annoying users
    });
    cleanupFunctions.push(cleanupError);

    // Check if there's already a downloaded update on mount
    const checkExistingUpdate = async () => {
      try {
        const isReady = await window.autoUpdateAPI.isReady();
        if (isReady) {
          const state = await window.autoUpdateAPI.getState();
          if (state.updateInfo) {
            setUpdateReady(true);
            setUpdateInfo({
              version: state.updateInfo.version,
              releaseNotes: state.updateInfo.releaseNotes as string | undefined,
              releaseDate: state.updateInfo.releaseDate as string | undefined,
            });
            showUpdateReadyToast({
              version: state.updateInfo.version,
              releaseNotes: state.updateInfo.releaseNotes as string | undefined,
              releaseDate: state.updateInfo.releaseDate as string | undefined,
            });
          }
        }
      } catch (error) {
        // Ignore errors during initial check
      }
    };

    checkExistingUpdate();

    // Cleanup all listeners on unmount
    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [showUpdateReadyToast]);

  // This component doesn't render anything visible directly
  // It manages toast notifications through the useToast hook
  return null;
};

export default AutoUpdateToast;
