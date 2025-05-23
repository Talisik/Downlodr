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
import React, { useState } from 'react';
import { GoDownload } from 'react-icons/go';
import { LuTrash } from 'react-icons/lu';
import { PiStopCircle } from 'react-icons/pi';
import { VscPlayCircle } from 'react-icons/vsc';
import { useLocation } from 'react-router-dom';
import FileNotExistModal, {
  DownloadItem,
} from '../../../Components/SubComponents/custom/FileNotExistModal';
import { cn } from '../../../Components/SubComponents/shadcn/lib/utils';
import { processFileName } from '../../../DataFunctions/FilterName';
import useDownloadStore from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import { useToast } from '../../SubComponents/shadcn/hooks/use-toast';
import DownloadModal from '../Modal/DownloadModal';
interface TaskBarProps {
  className?: string;
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  message,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="bg-white dark:bg-darkMode rounded-lg p-6 max-w-sm w-full mx-4">
        <p className="text-gray-800 dark:text-gray-200 mb-4">{message}</p>
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

const TaskBar: React.FC<TaskBarProps> = ({ className }) => {
  // Handle state for modal
  const [isDownloadModalOpen, setDownloadModalOpen] = useState(false);
  const [showStopConfirmation, setShowStopConfirmation] = useState(false);
  const [showFileNotExistModal, setShowFileNotExistModal] = useState(false);
  const [missingFiles, setMissingFiles] = useState<DownloadItem[]>([]);

  const { toast } = useToast();

  // Get the max download limit and current downloads from stores
  const { settings } = useMainStore();
  const { downloading } = useDownloadStore();

  // Handling selected downloads
  const selectedDownloads = useMainStore((state) => state.selectedDownloads);
  const clearAllSelections = useMainStore((state) => state.clearAllSelections);

  // Add this hook to get the correct path
  const location = useLocation();

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
    } else {
      toast({
        variant: 'default',
        title: 'All Files Exist',
        description: 'All selected files exist at their locations',
        duration: 3000,
      });
    }
  };
  const handleStopConfirm = () => {
    handleRemoveSelected();
    setShowStopConfirmation(false);
  };
  // Stopping all current downloads via killController
  const handleStopAll = async () => {
    // functions for deleting download log from store
    const { deleteDownloading } = useDownloadStore.getState();

    // check if there are any current downloads
    if (downloading && downloading.length > 0) {
      // iterate through current downloads
      for (const download of downloading) {
        console.log(`Attempting to stop download: ${download.id}`);
        // check if download has a controller
        if (download.controllerId) {
          try {
            // kills/stops download
            const success = await window.ytdlp.killController(
              download.controllerId,
            );
            // if the download was stopped successfully then remove log of download
            if (success) {
              deleteDownloading(download.id);
              console.log(
                `Controller with ID ${download.controllerId} has been terminated.`,
              );
              toast({
                variant: 'success',
                title: 'Download stopped',
                description: 'Your download has stopped successfully',
                duration: 3000,
              });
            } else {
              toast({
                variant: 'destructive',
                title: 'Stop Download Error',
                description: `Could not stop current download with controller ${download.controllerId}`,
                duration: 3000,
              });
              // setCurrentDownloadId(download.id);
            }
          } catch (error) {
            toast({
              variant: 'destructive',
              title: 'Stop Download Error',
              description: `Could not stop current download with controller ${download.controllerId}`,
              duration: 3000,
            });
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Stop Download Error',
            description: `Could not stop current download with controller ${download.controllerId}`,
            duration: 3000,
          });
        }
      }
      // Clear selected downloads after stopping all
      // setSelectedDownloading([]);
    } else {
      toast({
        variant: 'destructive',
        title: 'No Downloads Found',
        description: `No current downloads to delete`,
        duration: 3000,
      });
    }
    // setSelectedDownloading([]);
  };

  // Stopping selected current downloads via killController
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

    // Store selected downloads in a temporary variable and clear selections immediately
    const { deleteDownloading, downloading } = useDownloadStore.getState();
    // Filter selected downloads to only include those in forDownloads and remove duplicates
    const validDownloads = selectedDownloads.filter((download) =>
      downloading.some((fd) => fd.id === download.id),
    );
    const uniqueDownloads = [...new Set(validDownloads.map((d) => d.id))]
      .map((id) => validDownloads.find((d) => d.id === id))
      .filter((d): d is (typeof validDownloads)[0] => d !== undefined);

    // removes the selected options to ensure no errors possible
    clearAllSelections();
    // iterate through the listed unique downloads
    for (const download of uniqueDownloads) {
      if (download.controllerId) {
        try {
          // kill/stop the download
          const success = await window.ytdlp.killController(
            download.controllerId,
          );
          // if stopped download was successful, delete download log
          if (success) {
            deleteDownloading(download.id);
            console.log(
              `Controller with ID ${download.controllerId} has been terminated.`,
            );
            toast({
              variant: 'success',
              title: 'Download Stopped',
              description: 'Your download has stopped successfully',
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
      // clear selected download
      clearAllSelections();
    }
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
    const { addDownload, forDownloads, removeFromForDownloads, downloading } =
      useDownloadStore.getState();

    // Filter selected downloads to only include those in forDownloads and remove duplicates
    const validDownloads = selectedDownloads.filter((download) =>
      forDownloads.some((fd) => fd.id === download.id),
    );
    const uniqueDownloads = [...new Set(validDownloads.map((d) => d.id))]
      .map((id) => validDownloads.find((d) => d.id === id))
      .filter((d): d is (typeof validDownloads)[0] => d !== undefined);

    // Clear selections immediately after filtering
    clearAllSelections();

    // If the selected download amount or the currently downloading amount exceeds the max download set inside settings, dont start any downloads
    if (
      uniqueDownloads.length > settings.maxDownloadNum ||
      downloading.length >= settings.maxDownloadNum
    ) {
      toast({
        variant: 'destructive',
        title: 'Download limit reached',
        description: `Maximum download limit (${settings.maxDownloadNum}) reached. Please wait for current downloads to complete or increase limit via settings.`,
        duration: 7000,
      });
      return;
    }

    // iterate through selected unique downloads
    for (const selectedDownload of uniqueDownloads) {
      // get metadata for each selected download
      const downloadInfo = forDownloads.find(
        (d) => d.id === selectedDownload.id,
      );

      if (downloadInfo) {
        // checks download name and location to validate download name and location
        // returns validated processed name
        const processedName = await processFileName(
          downloadInfo.location,
          downloadInfo.name,
          downloadInfo.ext || downloadInfo.audioExt,
        );
        // calls the addDownload function from store to start each selected download
        addDownload(
          downloadInfo.videoUrl,
          `${processedName}.${downloadInfo.ext}`,
          `${processedName}.${downloadInfo.ext}`,
          downloadInfo.size,
          downloadInfo.speed,
          downloadInfo.timeLeft,
          new Date().toISOString(),
          downloadInfo.progress,
          downloadInfo.location,
          'downloading',
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
        // remove the current download from the saved list for forDownloads
        removeFromForDownloads(selectedDownload.id);
      }
    }
  };

  // Remove the finished download from device drive and downloads log
  const handleRemoveSelected = async () => {
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

    const { deleteDownload, forDownloads } = useDownloadStore.getState();

    // Helper function to handle file deletion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deleteFileSafely = async (download: any) => {
      try {
        const success = await window.downlodrFunctions.deleteFile(
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
      } catch (error) {
        handleFileNotExistModal();
      }
    };

    // Process each download
    for (const download of downloadsToRemove) {
      if (!download.location || !download.id) continue;

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

      // Delete the file
      await deleteFileSafely(download);
    }
  };

  // opens download modal
  const handleOpenDownloadModal = () => {
    clearAllSelections();
    setDownloadModalOpen(true);
  };

  return (
    <>
      <div className={`${className} flex items-center justify-between`}>
        <div className="flex items-center h-full px-4 space-x-2">
          <button
            className="primary-custom-btn px-[6px] py-[4px] sm:px-[8px] sm:py-[4px] flex items-center gap-1 sm:gap-1 text-sm sm:text-sm whitespace-nowrap dark:hover:text-black dark:hover:bg-white"
            onClick={handleOpenDownloadModal}
          >
            <GoDownload className="sm:w-[14px] sm:h-[14px]" />
            <span className="hidden sm:inline text-sm">Add URL</span>
          </button>

          <button
            className="hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-1 rounded flex gap-1 font-semibold dark:text-gray-200"
            onClick={handlePlaySelected}
          >
            {' '}
            <VscPlayCircle size={18} className="mt-[0.9px]" /> Start
          </button>

          <button
            className="hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-1 rounded flex gap-1 font-semibold dark:text-gray-200"
            onClick={handleStopSelected}
          >
            <PiStopCircle size={18} className="mt-[0.9px]" /> Stop
          </button>
          <button
            className="hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-1 rounded flex gap-1 font-semibold dark:text-gray-200"
            onClick={() => handleStopAll()}
          >
            {' '}
            <PiStopCircle size={18} className="mt-[0.9px]" /> Stop All
          </button>
        </div>

        <div className="pl-4 flex items-center">
          {/* This is the regular downloads Remove button */}
          {(location.pathname.includes('/status/') ||
            location.pathname.includes('/tags/') ||
            location.pathname.includes('/category/')) && (
            <button
              className={cn(
                'px-3 py-1 rounded-md flex gap-2 text-sm',
                selectedDownloads.length > 0 &&
                  (location.pathname.includes('/status/') ||
                    location.pathname.includes('/tags/') ||
                    location.pathname.includes('/category/'))
                  ? 'bg-black text-gray-200 hover:bg-[#3E3E46] dark:text-darkModeButtonActive dark:bg-darkModeButtonDefault hover:dark:bg-darkModeButtonHover hover:dark:text-body-dark'
                  : 'cursor-not-allowed text-gray-400 bg-gray-200 hover:bg-gray-200 dark:text-darkModeButtonActive dark:bg-darkModeButtonDefault',
              )}
              onClick={() => {
                console.log(selectedDownloads.length);
                console.log(location.pathname);
                setShowStopConfirmation(true);
              }}
              disabled={!(selectedDownloads.length > 0)}
            >
              <LuTrash size={15} className="mt-[2px]" />
              <span className="hidden sm:inline text-sm">Remove</span>{' '}
            </button>
          )}

          {/* Portal target for History-specific Remove button */}
          <div id="taskbar-portal"></div>
        </div>
      </div>
      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
      />
      <ConfirmModal
        isOpen={showStopConfirmation}
        onClose={() => setShowStopConfirmation(false)}
        onConfirm={handleStopConfirm}
        message="Are you sure you want to stop and remove this download?"
      />
      <FileNotExistModal
        isOpen={showFileNotExistModal}
        onClose={() => setShowFileNotExistModal(false)}
        selectedDownloads={missingFiles}
      />
    </>
  );
};

export default TaskBar;
