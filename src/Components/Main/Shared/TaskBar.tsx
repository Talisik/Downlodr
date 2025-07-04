/**
 * A custom React fixed component
 * A Fixed element in the header portion of Downlodr, displays common download task buttons for downloads such as:
 *  - Remove (Removing finished downloads from drive and log)
 *  - Stop All (Stop all current downloads)
 *  - Stop (Stop selected current downloads)
 *  - Start (Start selected current downloads)
 *  - Add URL (Add a download to the for download via link)
 *
 * @param className - for UI of TaskBar
 * @returns JSX.Element - The rendered component displaying a TaskBar
 *
 */
import React, { useEffect, useState } from 'react';
import { GoDownload } from 'react-icons/go';
import { IoMdClose } from 'react-icons/io';
import { LuTrash } from 'react-icons/lu';
import { PiStopCircle } from 'react-icons/pi';
import { VscPlayCircle } from 'react-icons/vsc';
import { useLocation } from 'react-router-dom';
import FileNotExistModal, {
  DownloadItem,
} from '../../../Components/SubComponents/custom/FileNotExistModal';
import { Button } from '../../../Components/SubComponents/shadcn/components/ui/button';
import useDownloadStore from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import PluginTaskBarExtension from '../../../plugins/components/PluginTaskBarExtension';
import { useToast } from '../../SubComponents/shadcn/hooks/use-toast';
import { cn } from '../../SubComponents/shadcn/lib/utils';
import DownloadModal from '../Modal/DownloadModal';
import PageNavigation from './PageNavigation';

interface TaskBarProps {
  className?: string;
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}

interface TaskBarConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteFolder?: boolean) => void;
  message: string;
  selectedCount: number;
}

const StopModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  message,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-darkModeDropdown rounded-lg border border-darkModeCompliment p-6 max-w-lg w-full mx-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with title and close button */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Stop Download
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <IoMdClose size={20} />
          </button>
        </div>

        {/* Main message */}
        <p className="text-gray-700 dark:text-gray-300 mb-4">{message}</p>

        {/* Action buttons */}
        <div className="flex justify-end space-x-3 bg-[#FEF9F4] dark:bg-darkMode -mx-6 -mb-6 px-4 py-3 rounded-b-lg border-t border-[#D9D9D9] dark:border-darkModeCompliment">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-4 py-1 text-gray-600 bg-white hover:bg-gray-50 dark:hover:bg-darkModeHover dark:hover:text-gray-200 rounded-md font-medium"
          >
            Cancel
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            className="px-4 py-1 bg-[#F45513] text-white rounded-md hover:bg-white hover:text-black font-medium"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
};

const TaskBarConfirmModal: React.FC<TaskBarConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  message,
  selectedCount,
}) => {
  const [deleteFolder, setDeleteFolder] = useState(false);
  // Reset checkbox when modal opens
  useEffect(() => {
    if (isOpen) {
      setDeleteFolder(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-darkModeDropdown rounded-lg border border-darkModeCompliment p-6 max-w-lg w-full mx-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with title and close button */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Remove selected items
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <IoMdClose size={20} />
          </button>
        </div>

        {/* Main message */}
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          Are you sure you want to remove these downloads from the download
          list?
        </p>

        {/* Checkbox */}
        <div className="mb-6">
          <label
            className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={deleteFolder}
              onChange={(e) => {
                e.stopPropagation();
                setDeleteFolder(e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
              className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
            />
            <span>Also remove the downloaded folder</span>
          </label>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end space-x-3 bg-[#FEF9F4] dark:bg-darkMode -mx-6 -mb-6 px-4 py-3 rounded-b-lg border-t border-[#D9D9D9] dark:border-darkModeCompliment">
          <Button
            onClick={(e: any) => {
              e.stopPropagation();
              onClose();
            }}
            variant="outline"
            className="h-8 px-2 py-0.5 rounded-md dark:border-darkModeCompliment dark:bg-darkModeCompliment dark:text-darkModeLight dark:hover:bg-darkModeHover dark:hover:text-white font-medium"
          >
            Cancel
          </Button>
          <button
            onClick={(e: any) => {
              e.stopPropagation();
              onConfirm(deleteFolder);
            }}
            className="h-8 px-2 py-0.5 bg-primary dark:bg-primary dark:text-darkModeLight  dark:hover:bg-primary/90 text-white rounded-md hover:bg-primary/90 cursor-pointer"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};

const TaskBar: React.FC<TaskBarProps> = ({ className }) => {
  // Handle state for modal
  const [isDownloadModalOpen, setDownloadModalOpen] = useState(false);
  const [originalClipboardState, setOriginalClipboardState] = useState<
    boolean | undefined
  >(undefined);
  const [showStopConfirmation, setShowStopConfirmation] = useState(false);
  const [stopAction, setStopAction] = useState<'selected' | 'all' | null>(null);
  const { toast } = useToast();
  const location = useLocation(); // Get current location
  const [showFileNotExistModal, setShowFileNotExistModal] = useState(false);
  const [missingFiles, setMissingFiles] = useState<DownloadItem[]>([]);
  // Get the max download limit and current downloads from stores
  const {
    settings,
    taskBarButtonsVisibility,
    updateEnableClipboardMonitoring,
  } = useMainStore();
  const { downloading, forDownloads } = useDownloadStore();

  // Handling selected downloads
  const selectedDownloads = useMainStore((state) => state.selectedDownloads);
  const clearAllSelections = useMainStore((state) => state.clearAllSelections);

  // Add state for the confirmation modal
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);

  // Check if any selected downloads are in "to download" status (for Start button)
  const hasForDownloadStatus = selectedDownloads.some((download) =>
    forDownloads.some(
      (fd) => fd.id === download.id && fd.status === 'to download',
    ),
  );

  // Check if any selected downloads are in "downloading" or "initializing" status (for Stop button)
  const hasActiveDownloadStatus = selectedDownloads.some((download) =>
    downloading.some(
      (d) =>
        d.id === download.id &&
        (d.status === 'downloading' ||
          d.status === 'initializing' ||
          d.status === 'paused'),
    ),
  );

  // Check if any selected downloads are in "downloading" or "initializing" status (for Stop button)
  const hasDownloadingStatus = downloading.some((download) =>
    downloading.some(
      (d) =>
        d.id === download.id &&
        (d.status === 'downloading' ||
          d.status === 'initializing' ||
          d.status === 'paused'),
    ),
  );

  const handleStopSelected = async () => {
    if (selectedDownloads.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Downloads Selected',
        description: 'Please select downloads to stop',
        duration: 3000,
      });
      return;
    }
    setStopAction('selected');
    setShowStopConfirmation(true);
  };

  const handleStopAll = async () => {
    if (downloading.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Downloads Found',
        description: `No current downloads to stop`,
        duration: 3000,
      });
      return;
    }
    setStopAction('all');
    setShowStopConfirmation(true);
  };

  const handleStopConfirm = async () => {
    if (stopAction === 'selected') {
      const {
        deleteDownloading,
        downloading,
        forDownloads,
        queuedDownloads,
        removeFromForDownloads,
        processQueue,
        removeFromQueue,
      } = useDownloadStore.getState();

      // Store selected downloads in a temporary variable and clear selections immediately
      const downloadsToStop = [...selectedDownloads];
      clearAllSelections();

      for (const download of downloadsToStop) {
        const currentDownload = downloading.find((d) => d.id === download.id);
        const currentForDownload = forDownloads.find(
          (d) => d.id === download.id,
        );

        if (currentDownload?.status === 'paused') {
          deleteDownloading(download.id);
          toast({
            variant: 'success',
            title: 'Download Stopped',
            description: 'Download has been stopped successfully',
            duration: 3000,
          });
        } else if (currentForDownload?.status === 'to download') {
          removeFromForDownloads(download.id);
          toast({
            variant: 'success',
            title: 'Download Stopped',
            description: 'Download has been stopped successfully',
            duration: 3000,
          });
        } else if (currentDownload?.controllerId) {
          try {
            const success = await window.ytdlp.killController(
              currentDownload.controllerId,
            );
            if (success) {
              deleteDownloading(download.id);
              console.log(
                `Controller with ID ${currentDownload.controllerId} has been terminated.`,
              );
              toast({
                variant: 'success',
                title: 'Download Stopped',
                description: 'Download has been stopped successfully',
                duration: 3000,
              });
            } else {
              toast({
                variant: 'destructive',
                title: 'Stop Download Error',
                description: `Could not stop download with controller ${currentDownload.controllerId}`,
                duration: 3000,
              });
            }
          } catch (error) {
            toast({
              variant: 'destructive',
              title: 'Stop Download Error',
              description: `Error stopping download with controller ${currentDownload.controllerId}`,
              duration: 3000,
            });
          }
        }
      }

      // Process queue after stopping selected downloads
      processQueue();
    } else if (stopAction === 'all') {
      const {
        deleteDownloading,
        downloading,
        forDownloads,
        removeFromForDownloads,
        processQueue,
      } = useDownloadStore.getState();

      // Handle all downloads in forDownloads
      forDownloads.forEach((download) => {
        if (download.status === 'to download') {
          removeFromForDownloads(download.id);
        }
      });

      // Handle all active downloads
      if (downloading && downloading.length > 0) {
        for (const download of downloading) {
          if (download.status === 'paused') {
            deleteDownloading(download.id);
            toast({
              variant: 'success',
              title: 'Download Stopped',
              description: 'Download has been stopped successfully',
              duration: 3000,
            });
          } else if (download.controllerId) {
            try {
              const success = await window.ytdlp.killController(
                download.controllerId,
              );
              if (success) {
                deleteDownloading(download.id);
                console.log(
                  `Controller with ID ${download.controllerId} has been terminated.`,
                );
                toast({
                  variant: 'success',
                  title: 'Download Stopped',
                  description: 'Download has been stopped successfully',
                  duration: 3000,
                });
              } else {
                toast({
                  variant: 'destructive',
                  title: 'Stop Download Error',
                  description: `Could not stop download with controller ${download.controllerId}`,
                  duration: 3000,
                });
              }
            } catch (error) {
              toast({
                variant: 'destructive',
                title: 'Stop Download Error',
                description: `Error stopping download with controller ${download.controllerId}`,
                duration: 3000,
              });
            }
          }
        }
      }

      // Process queue after stopping all downloads
      processQueue();
    }
    setShowStopConfirmation(false);
    setStopAction(null);
  };

  // Start downloading selected downloads
  const handlePlaySelected = async () => {
    // check if any downloads have been selected
    if (selectedDownloads.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Downloads Selected',
        description: 'Please select downloads to play',
        duration: 3000,
      });
      return;
    }

    // get the functions and lists from store
    const { forDownloads, removeFromForDownloads, addQueue } =
      useDownloadStore.getState();

    // Filter selected downloads to only include those in forDownloads and remove duplicates
    const validDownloads = selectedDownloads.filter((download) =>
      forDownloads.some((fd) => fd.id === download.id),
    );
    const uniqueDownloads = [...new Set(validDownloads.map((d) => d.id))]
      .map((id) => validDownloads.find((d) => d.id === id))
      .filter(
        (d): d is (typeof validDownloads)[0] =>
          d !== undefined && d.status === 'to download',
      );

    // Clear selections immediately after filtering
    clearAllSelections();

    if (uniqueDownloads.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Valid Downloads',
        description: 'Please select downloads that are ready to start',
        duration: 3000,
      });
      return;
    }

    // Add ALL downloads to queue - let the worker controller handle starting them
    uniqueDownloads.forEach((selectedDownload) => {
      const downloadInfo = selectedDownload.download;
      const processedName = downloadInfo.name.replace(/[\\/:*?"<>|]/g, '_');

      addQueue(
        downloadInfo.videoUrl,
        `${processedName}.${downloadInfo.ext}`,
        `${processedName}.${downloadInfo.ext}`,
        downloadInfo.size,
        downloadInfo.speed,
        downloadInfo.timeLeft,
        new Date().toISOString(),
        downloadInfo.progress,
        downloadInfo.location,
        'queued',
        downloadInfo.ext,
        downloadInfo.formatId,
        downloadInfo.audioExt,
        downloadInfo.audioFormatId,
        downloadInfo.extractorKey,
        settings.defaultDownloadSpeed === 0
          ? ''
          : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
        downloadInfo.automaticCaption,
        downloadInfo.thumbnails,
        downloadInfo.getTranscript || false,
        downloadInfo.getThumbnail || false,
        downloadInfo.duration || 60,
        true,
      );
      removeFromForDownloads(selectedDownload.id);
    });

    // Show toast notification
    toast({
      title: 'Downloads Added to Queue',
      description: `${uniqueDownloads.length} download(s) added to queue. The download controller will start them automatically based on your limit.`,
      duration: 5000,
    });
  };

  const handleFileNotExistModal = async () => {
    const missing = [];

    // Check each selected download to see if it exists
    for (const download of selectedDownloads) {
      if (download.status === 'finished' && download.location) {
        const exists = await window.downlodrFunctions.fileExists(
          download.location,
        );
        if (!exists) {
          missing.push(download);
        }
      }
    }

    // Set the missing files and show the modal if any were found
    if (missing.length > 0) {
      setMissingFiles(missing);
      setShowFileNotExistModal(true);
    }
  };

  const handleRemoveSelected = async (deleteFolder?: boolean) => {
    if (selectedDownloads.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Downloads Selected',
        description: 'Please select downloads to remove',
        duration: 3000,
      });
      return;
    }

    // Store selected downloads and clear selection immediately
    const downloadsToRemove = [...selectedDownloads];
    clearAllSelections();

    const {
      deleteDownload,
      forDownloads,
      downloading,
      deleteDownloading,
      processQueue,
      queuedDownloads,
      removeFromQueue,
    } = useDownloadStore.getState();

    // Helper function to handle file deletion
    const deleteFileSafely = async (download: any) => {
      try {
        let success = false;

        if (deleteFolder && download.location) {
          // Get the parent folder path using path.dirname equivalent
          const folderPath = download.location.substring(
            0,
            download.location.lastIndexOf('/') > 0
              ? download.location.lastIndexOf('/')
              : download.location.lastIndexOf('\\'),
          );

          success = await window.downlodrFunctions.deleteFolder(folderPath);

          if (success) {
            deleteDownload(download.id);
            toast({
              variant: 'success',
              title: 'Folder Deleted',
              description:
                'Folder and its contents have been deleted successfully',
              duration: 3000,
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'Error',
              description:
                'Failed to delete folder. It may not exist or be in use.',
              duration: 3000,
            });
          }
        } else {
          // Original file deletion logic
          success = await window.downlodrFunctions.deleteFile(
            download.location,
          );

          if (success) {
            deleteDownload(download.id);
            toast({
              variant: 'success',
              title: 'File Deleted',
              description: 'File has been deleted successfully',
              duration: 3000,
            });
          } else {
            handleFileNotExistModal();
          }
        }
      } catch (error) {
        handleFileNotExistModal();
      }
    };

    // Process each download
    for (const download of downloadsToRemove) {
      if (!download.location || !download.id) {
        continue;
      }

      // Check if it's a pending download
      const isPending = forDownloads.some((d) => d.id === download.id);
      if (isPending) {
        deleteDownload(download.id);
        toast({
          variant: 'success',
          title: 'Download Removed',
          description: 'Pending download has been removed successfully',
          duration: 3000,
        });
        continue;
      }

      // Check if it's a currently downloading file
      const isDownloading = downloading.some((d) => d.id === download.id);
      if (isDownloading) {
        const currentDownload = downloading.find((d) => d.id === download.id);

        // If download is cancelled or paused, just remove it without stopping
        if (
          currentDownload?.status === 'cancelled' ||
          currentDownload?.status === 'paused' ||
          currentDownload?.status === 'initializing'
        ) {
          deleteDownloading(download.id);
          toast({
            variant: 'success',
            title: 'Download Removed',
            description: `${
              currentDownload.status === 'cancelled'
                ? 'Cancelled'
                : currentDownload.status === 'paused'
                ? 'Paused'
                : 'Initializing'
            } download has been removed successfully`,
            duration: 3000,
          });
          processQueue();

          continue;
        }
        const isQueued = queuedDownloads.some((d) => d.id === download.id);

        if (isQueued) {
          removeFromQueue(download.id);
          toast({
            variant: 'success',
            title: 'Download Removed',
            description: 'Queued download has been removed successfully',
            duration: 3000,
          });
          continue;
        }

        // For active downloads, stop them first
        if (download.controllerId) {
          try {
            const success = await window.ytdlp.killController(
              download.controllerId,
            );
            if (success) {
              deleteDownloading(download.id);
              toast({
                variant: 'success',
                title: 'Download Stopped',
                description: 'Download has been stopped successfully',
                duration: 3000,
              });
            } else {
              toast({
                variant: 'destructive',
                title: 'Stop Download Error',
                description: `Could not stop download with controller ${download.controllerId}`,
                duration: 3000,
              });
              continue; // Skip deletion if we couldn't stop the download
            }
          } catch (error) {
            toast({
              variant: 'destructive',
              title: 'Stop Download Error',
              description: `Error stopping download with controller ${download.controllerId}`,
              duration: 3000,
            });
            continue; // Skip deletion if we couldn't stop the download
          }
          processQueue();
        }
      }

      // Delete the file or folder
      await deleteFileSafely(download);
    }
  };

  // Update the button click handler to show confirmation
  const handleRemoveButtonClick = () => {
    if (selectedDownloads.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Downloads Selected',
        description: 'Please select downloads to remove',
        duration: 3000,
      });
      return;
    }
    setShowRemoveConfirmation(true);
  };

  // opens download modal
  const handleOpenDownloadModal = () => {
    // Instead of disabling clipboard monitoring, just set the modal state
    clearAllSelections();
    setDownloadModalOpen(true);
  };

  return (
    <div className="taskbar-container">
      <div className={cn('flex items-center justify-between', className)}>
        <div className="flex items-center h-full px-2 space-x-0 md:space-x-2">
          <div className="gap-1 flex">
            <PageNavigation />

            <div className="h-6 w-[1.5px] bg-gray-300 dark:bg-gray-600 self-center ml-1 md:ml-3"></div>
          </div>

          {taskBarButtonsVisibility.start && (
            <button
              className={cn(
                'px-1 sm:px-3 py-1 rounded flex gap-1 font-semibold',
                hasForDownloadStatus
                  ? 'dark:text-gray-100'
                  : 'cursor-not-allowed text-gray-800 dark:text-gray-400',
              )}
              onClick={handlePlaySelected}
              disabled={!hasForDownloadStatus}
            >
              {' '}
              <VscPlayCircle size={18} className="mt-[0.9px]" /> Start
            </button>
          )}

          {taskBarButtonsVisibility.stop && (
            <button
              className={cn(
                'px-1 sm:px-3 py-1 rounded flex gap-1 font-semibold',
                hasActiveDownloadStatus
                  ? 'dark:text-gray-100'
                  : 'cursor-not-allowed text-gray-800 dark:text-gray-400',
              )}
              onClick={handleStopSelected}
              disabled={!hasActiveDownloadStatus}
            >
              <PiStopCircle size={18} className="mt-[0.9px]" /> Stop
            </button>
          )}

          {taskBarButtonsVisibility.stopAll && (
            <button
              className={cn(
                'px-1 sm:px-3 py-1 rounded flex gap-1 font-semibold',
                hasDownloadingStatus
                  ? 'dark:text-gray-100'
                  : 'cursor-not-allowed text-gray-800 dark:text-gray-400',
              )}
              onClick={() => handleStopAll()}
              disabled={!hasDownloadingStatus}
            >
              {' '}
              <PiStopCircle size={18} className="mt-[0.9px]" /> Stop All
            </button>
          )}
        </div>

        <div className="pl-4 flex items-center">
          {location.pathname.includes('/status') && (
            <div className="mr-4">
              <PluginTaskBarExtension />
            </div>
          )}
          {/* Portal target for History-specific Remove button */}
          <div id="taskbar-portal"></div>
          {/* This is the regular downloads Remove button */}
          {(location.pathname.includes('/status/') ||
            location.pathname.includes('/tags/') ||
            location.pathname.includes('/category/')) && (
            <button
              className={cn(
                'px-3 py-1 mr-4 rounded-md flex gap-2 text-sm h-[28px] items-center',
                selectedDownloads.length > 0 &&
                  (location.pathname.includes('/status/') ||
                    location.pathname.includes('/tags/') ||
                    location.pathname.includes('/category/'))
                  ? 'bg-black text-gray-200 hover:bg-[#3E3E46] dark:text-body-dark dark:bg-darkModeButtonActive hover:dark:bg-darkModeLight hover:dark:text-body-dark'
                  : 'cursor-not-allowed text-gray-400 bg-gray-200 hover:bg-gray-200 dark:text-darkModeButtonActive dark:bg-darkModeButtonDefault',
              )}
              onClick={handleRemoveButtonClick}
              disabled={
                !(
                  selectedDownloads.length > 0 &&
                  (location.pathname.includes('/status/') ||
                    location.pathname.includes('/tags/') ||
                    location.pathname.includes('/category/'))
                )
              }
            >
              <LuTrash size={15} />{' '}
              <span className="hidden md:inline text-sm">Remove</span>
            </button>
          )}
          <button
            className="primary-custom-btn h-[28px] px-[6px] py-[4px] sm:px-[12px] sm:py-[4px] flex items-center gap-1 sm:gap-1 text-sm sm:text-sm whitespace-nowrap dark:hover:text-black dark:hover:bg-white"
            onClick={handleOpenDownloadModal}
          >
            <GoDownload />
            <span className="hidden md:inline text-sm">Add URL</span>
          </button>
        </div>
      </div>
      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => {
          setDownloadModalOpen(false);
          setOriginalClipboardState(undefined); // Clean up state
        }}
        originalClipboardMonitoringState={originalClipboardState}
      />
      <StopModal
        isOpen={showStopConfirmation}
        onClose={() => {
          setShowStopConfirmation(false);
          setStopAction(null);
        }}
        onConfirm={handleStopConfirm}
        message={
          stopAction === 'all'
            ? 'Are you sure you want to stop all downloads?'
            : 'Are you sure you want to stop the selected downloads?'
        }
      />
      <FileNotExistModal
        isOpen={showFileNotExistModal}
        onClose={() => setShowFileNotExistModal(false)}
        selectedDownloads={missingFiles}
      />
      <TaskBarConfirmModal
        isOpen={showRemoveConfirmation}
        onClose={() => setShowRemoveConfirmation(false)}
        onConfirm={(deleteFolder) => {
          handleRemoveSelected(deleteFolder);
          setShowRemoveConfirmation(false);
        }}
        message="Are you sure you want to remove these downloads?"
        selectedCount={selectedDownloads.length}
      />
    </div>
  );
};

export default TaskBar;
