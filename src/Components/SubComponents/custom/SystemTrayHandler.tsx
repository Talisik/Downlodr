/**
 * SystemTrayHandler component for handling system tray IPC messages
 * This component listens for IPC messages from the system tray and handles them appropriately
 */

import { useToast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import { useEffect, useState } from 'react';
import SettingsModal from '@/Components/Main/Modal/SettingsModal';

const SystemTrayHandler: React.FC = () => {
  const { toast } = useToast();
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  useEffect(() => {
    let removeUpdateCheckStarted: (() => void) | undefined;
    let removeUpdateCheckCompleted: (() => void) | undefined;
    let removeUpdateCheckError: (() => void) | undefined;
    let removeOpenSettingsModal: (() => void) | undefined;

    if (window.updateAPI) {
      // Listen for update check started
      removeUpdateCheckStarted = window.updateAPI.onUpdateCheckStarted(() => {
        toast({
          title: 'Checking for updates',
          description: 'Currently checking for new updates, please wait',
          duration: 3000,
        });
      });

      // Listen for update check completed
      removeUpdateCheckCompleted = window.updateAPI.onUpdateCheckCompleted((updateInfo) => {
        if (updateInfo.hasUpdate) {
          // The UpdateNotification component will handle showing the update modal
          // This is already handled by the existing 'update-available' message
          console.log('Update available:', updateInfo);
        } else {
          toast({
            title: "You're up to date!",
            description: `You're using the latest version (v${updateInfo.currentVersion}).`,
            duration: 3000,
          });
        }
      });

      // Listen for update check error
      removeUpdateCheckError = window.updateAPI.onUpdateCheckError((error) => {
        toast({
          variant: 'destructive',
          title: 'Update Check Failed',
          description: 'Unable to check for updates. Please try again later.',
          duration: 3000,
        });
        console.error('Update check error:', error);
      });

      // Listen for settings modal open request
      removeOpenSettingsModal = window.updateAPI.onOpenSettingsModal(() => {
        setIsSettingsModalOpen(true);
      });
    }

    // Cleanup function
    return () => {
      if (removeUpdateCheckStarted) removeUpdateCheckStarted();
      if (removeUpdateCheckCompleted) removeUpdateCheckCompleted();
      if (removeUpdateCheckError) removeUpdateCheckError();
      if (removeOpenSettingsModal) removeOpenSettingsModal();
    };
  }, [toast]);

  return (
    <>
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </>
  );
};

export default SystemTrayHandler;