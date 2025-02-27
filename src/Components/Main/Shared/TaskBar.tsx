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
import { VscPlayCircle } from 'react-icons/vsc';
import { PiStopCircle } from 'react-icons/pi';
import DownloadModal from '../Modal/DownloadModal';
import useDownloadStore from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import { useToast } from '../../SubComponents/shadcn/hooks/use-toast';
import { processFileName } from '../../../DataFunctions/FilterName';
import { LuTrash } from 'react-icons/lu';

interface TaskBarProps {
  className?: string;
}

const TaskBar: React.FC<TaskBarProps> = ({ className }) => {
  // Handle state for modal
  const [isDownloadModalOpen, setDownloadModalOpen] = useState(false);
  const { toast } = useToast();

  // Get the max download limit and current downloads from stores
  const { settings } = useMainStore();
  const { downloading } = useDownloadStore();

  // Handling selected downloads
  const selectedDownloads = useMainStore((state) => state.selectedDownloads);
  const clearAllSelections = useMainStore((state) => state.clearAllSelections);

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
              });
            } else {
              toast({
                variant: 'destructive',
                title: 'Stop Download Error',
                description: `Could not stop current download with controller ${download.controllerId}`,
              });
              // setCurrentDownloadId(download.id);
            }
          } catch (error) {
            toast({
              variant: 'destructive',
              title: 'Stop Download Error',
              description: `Could not stop current download with controller ${download.controllerId}`,
            });
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Stop Download Error',
            description: `Could not stop current download with controller ${download.controllerId}`,
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
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'Stop Download Error',
              description: `Could not stop download with controller ${download.controllerId}`,
            });
          }
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Stop Download Error',
            description: `Error stopping download with controller ${download.controllerId}`,
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
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Deletion Failed',
            description: `Failed to delete file: ${download.location}`,
          });
        }
      } catch (error) {
        console.error('Error deleting file:', error);
        toast({
          variant: 'destructive',
          title: 'Deletion Failed',
          description: `Error deleting file: ${download.location}`,
        });
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
        });
        continue;
      }

      // Delete the file
      await deleteFileSafely(download);
    }
  };

  // opens download modal
  const handleOpenDownloadModal = () => {
    setDownloadModalOpen(true);
  };

  return (
    <>
      <div className={`${className} flex items-center justify-between`}>
        <div className="flex items-center h-full px-4 space-x-2">
          <button
            className="primary-custom-btn px-[6px] py-[8px] sm:px-[8px] sm:py-[8px] mr-2 sm:mr-4 flex items-center gap-1 sm:gap-2 text-sm sm:text-sm whitespace-nowrap dark:hover:text-black dark:hover:bg-white"
            onClick={handleOpenDownloadModal}
          >
            <GoDownload size={12} className="sm:w-[14px] sm:h-[14px]" />
            <span className="hidden sm:inline">Add URL</span>
            <span className="sm:hidden"> Add URL</span>
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
          <button
            className="hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-1 rounded flex gap-1 font-semibold dark:text-gray-200"
            onClick={handleRemoveSelected}
          >
            <LuTrash size={15} className="mt-[0.9px]" /> Remove
          </button>
        </div>
      </div>
      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
      />
    </>
  );
};

export default TaskBar;
