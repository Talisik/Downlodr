/**
 * A custom React component
 * Shows the About modal for Downlodr, displays features as well as link to official site
 *
 * @param isOpen - If modal is open, keeps it open
 * @param onClose - If modal has been closed, closes modal
 * @returns JSX.Element - The rendered component displaying a AboutModal
 *
 */

import DownlodrLogo from '@/Assets/Logo/DownlodrLogo-NoName.svg';
import React, { useEffect, useRef, useState } from 'react';
import { FiExternalLink } from 'react-icons/fi';
import { IoMdClose } from 'react-icons/io';
import { RxUpdate } from 'react-icons/rx';
import { FaCheckCircle } from 'react-icons/fa';
import { useToast } from '@/Components/SubComponents/shadcn/hooks/use-toast';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Get current app version on mount
  useEffect(() => {
    const getVersion = async () => {
      try {
        // Get current version from the API
        if (window.updateAPI?.getCurrentVersion) {
          const currentVersion = await window.updateAPI.getCurrentVersion();
          if (currentVersion) {
            setAppVersion(currentVersion);
          }
        }
      } catch (error) {
        console.error('Error getting version:', error);
      }
    };

    getVersion();
  }, []);

  // Listen for auto-update status changes (only update UI state, no toasts)
  useEffect(() => {
    if (!window.appAutoUpdater?.onUpdateStatus) return;

    const removeListener = window.appAutoUpdater.onUpdateStatus((info: {
      status: UpdateStatus;
      version?: string;
      currentVersion?: string;
      error?: string;
    }) => {
      console.log('[AboutModal] Update status:', info);
      setUpdateStatus(info.status);

      if (info.version) {
        setUpdateVersion(info.version);
      }
      if (info.currentVersion) {
        setAppVersion(info.currentVersion);
      }

      // Note: No toasts here - the UpdateNotification component handles
      // showing the persistent notification bar at bottom-left
    });

    return () => {
      removeListener();
    };
  }, [appVersion]);

  // Close Modal
  const handleClose = () => {
    onClose();
  };

  // Open Link
  const handleLink = async () => {
    await window.downlodrFunctions.openExternalLink('https://downlodr.com/');
    onClose();
  };

  // Check for Updates - triggers auto-updater
  const handleCheckUpdates = async () => {
    setUpdateStatus('checking');

    try {
      // Use the auto-updater to check for updates
      if (window.appAutoUpdater?.checkForUpdates) {
        const result = await window.appAutoUpdater.checkForUpdates();
        console.log('[AboutModal] Check updates result:', result);

        // Only show toast for "no update" or "error" cases
        // The UpdateNotification component will show the persistent bottom-left bar
        // for 'available', 'downloading', and 'downloaded' states
        if (result.status === 'not-available') {
          toast({
            title: "You're up to date!",
            description: `You're using the latest version.`,
            duration: 3000,
          });
        } else if (result.status === 'error') {
          toast({
            title: 'Update check failed',
            description: result.error || 'Please try again later.',
            variant: 'destructive',
            duration: 3000,
          });
        }
        // For 'available', 'downloading', 'downloaded' states,
        // the UpdateNotification component shows the persistent notification
      } else {
        // Fallback: auto-updater not available (dev mode)
        setUpdateStatus('error');
        toast({
          title: 'Auto-updates unavailable',
          description: 'Auto-updates are only available in the packaged app.',
          variant: 'destructive',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      setUpdateStatus('error');
    }
  };

  // Install downloaded update
  const handleInstallUpdate = () => {
    if (window.appAutoUpdater?.installUpdate) {
      toast({
        title: 'Installing update...',
        description: 'The app will restart momentarily.',
        duration: 2000,
      });
      window.appAutoUpdater.installUpdate();
    }
  };

  // Get button text based on update status
  const getUpdateButtonContent = () => {
    switch (updateStatus) {
      case 'checking':
        return (
          <>
            <RxUpdate size={14} className="animate-spin" />
            Checking...
          </>
        );
      case 'downloading':
        return (
          <>
            <RxUpdate size={14} className="animate-spin" />
            Downloading...
          </>
        );
      case 'downloaded':
        return (
          <>
            <FaCheckCircle size={14} />
            Install Update
          </>
        );
      default:
        return (
          <>
            <RxUpdate size={14} />
            Check Updates
          </>
        );
    }
  };

  // Handle button click based on status
  const handleUpdateButtonClick = () => {
    if (updateStatus === 'downloaded') {
      handleInstallUpdate();
    } else if (updateStatus !== 'checking' && updateStatus !== 'downloading') {
      handleCheckUpdates();
    }
  };

  const isUpdateButtonDisabled = updateStatus === 'checking' || updateStatus === 'downloading';

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

  // Move conditional return here, after hooks but before render
  if (!isOpen) return null;

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
        className="bg-white dark:bg-darkModeDropdown border border-gray-200 dark:border-gray-700 rounded-lg pt-6 pr-6 pl-6 pb-4 max-w-md w-full mx-4"
      >
        {/* Left side - Form */}
        <div className="w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold dark:text-gray-200">About</h2>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <IoMdClose size={16} />
            </button>
          </div>

          {/* Schedule Name */}
          <div className="space-y-2">
            <div className="flex flex-row items-start">
              <img src={DownlodrLogo} alt="Downlodr" className="h-[50px]" />

              <div className="flex flex-col ml-4 items-start">
                <h1 className="font-bold text-xl">Downlodr</h1>
                <h1 className="font-bold text-[15px] text-[#BCBCBC]">
                  Version {appVersion}
                </h1>
                <button
                  onClick={handleUpdateButtonClick}
                  disabled={isUpdateButtonDisabled}
                  className={`mt-2 px-3 py-1.5 text-xs font-medium text-white rounded-md flex items-center gap-1.5 transition-colors ${
                    updateStatus === 'downloaded'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-primary hover:bg-primary/90'
                  } disabled:bg-primary/50 disabled:cursor-not-allowed`}
                >
                  {getUpdateButtonContent()}
                </button>
                {updateStatus === 'downloaded' && updateVersion && (
                  <span className="text-xs text-green-600 dark:text-green-400 mt-1">
                    v{updateVersion} ready to install
                  </span>
                )}
              </div>
            </div>
            {/* End of Upload Button */}
            {/* URL Name */}
            <div>
              <label className="block dark:text-gray-200 mt-4 font-bold">
                Developed for you.
              </label>
              <div className="flex gap-1 pt-1 items-start">
                <a
                  onClick={() => handleLink()}
                  className="text-[11px] text-primary underline cursor-pointer hover:text-primary/80"
                  role="button"
                >
                  Visit the project website{' '}
                </a>
                <FiExternalLink className="self-center" size={10} />
              </div>
            </div>
            {/* End of Schedule Name */}
            {/* Download Location Name */}
            <div className="flex gap-4 pt-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <label className="block dark:text-gray-200 text-nowrap font-bold">
                    Features
                  </label>
                </div>
                <h1 className="font-bold text-[13px]">
                  Download Videos from All Your Favorite Sites
                </h1>
                <ul className="list-disc">
                  <li className="text-xs ml-6">
                    Works with YouTube, Twitch, Twitter, TikTok, and hundreds
                    more
                  </li>
                  <li className="text-xs ml-6">
                    Download entire channels or playlists with one click
                  </li>
                  <li className="text-xs ml-6">
                    Save live streams, shorts, and stories{' '}
                  </li>
                  <li className="text-xs ml-6">
                    Choose your preferred video quality{' '}
                  </li>
                </ul>
                <h1 className="font-bold text-[13px] mt-2">Easy to Use</h1>
                <ul className="list-disc">
                  <li className="text-xs ml-6">
                    Customize where your files are saved
                  </li>
                  <li className="text-xs ml-6">Choose how files are named</li>
                  <li className="text-xs ml-6">
                    Update to the latest version automatically
                  </li>
                </ul>
                <h1 className="font-bold text-[13px] mt-2">
                  Advanced Media Options
                </h1>
                <ul className="list-disc">
                  <li className="text-xs ml-6">
                    Keep video thumbnails with your downloads
                  </li>
                  <li className="text-xs ml-6 mb-2">
                    Download selected parts of playlists{' '}
                  </li>
                </ul>
              </div>
            </div>
            {/* End of Download Location Name */}
          </div>
        </div>

        {/* Button commands */}
        <hr className="solid mt-2 mb-2 -mx-6 w-[calc(100%+47px)] border-t-2 border-divider dark:border-gray-700" />

        <div className="flex justify-end mt-1">
          <button
            type="button"
            onClick={handleClose}
            className="px-2 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
          >
            Close
          </button>
        </div>
        {/* End of Button commands */}
      </div>
    </div>
  );
};

export default AboutModal;
