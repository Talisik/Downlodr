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
import { Play, Stop, StopAll } from '@/assets/icon';
import { Button } from '@/core-app/components/shadcn/components/ui/button';
import { useToast } from '@/core-app/components/shadcn/hooks/use-toast';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { useMainStore } from '@/core-app/store/mainStore';
import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
import { useSettingStore } from '@/core-app/store/settingsStore';
import TaskbarInputField from '@/downlodr/components/base/InputField/TaskbarInputField';
import FileNotExistModal from '@/downlodr/components/modal/custom/FileNotExistModal';
import RemoveModal from '@/downlodr/components/modal/custom/RemoveModal';
import StopModal from '@/downlodr/components/modal/custom/StopModal';
import { DownloadItem } from '@/downlodr/schema/componentSchema';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
// import PluginTaskBarExtension from '@/plugins/components/PluginTaskBarExtension';
import PageNavigation from '@/downlodr/components/navigation/PageNavigation';
import React, { useState } from 'react';
import { LuTrash } from 'react-icons/lu';
import { useLocation } from 'react-router-dom';

interface TaskBarProps {
  className?: string;
}

const TaskBar: React.FC<TaskBarProps> = ({ className }) => {
  // Handle state for modal
  const [showStopConfirmation, setShowStopConfirmation] = useState(false);
  const [stopAction, setStopAction] = useState<'selected' | 'all' | null>(null);
  const { toast } = useToast();
  const location = useLocation(); // Get current location
  const [showFileNotExistModal, setShowFileNotExistModal] = useState(false);
  const [missingFiles, setMissingFiles] = useState<DownloadItem[]>([]);
  // Get the max download limit and current downloads from stores
  const { taskBarButtonsVisibility } = useMainStore();
  const { settings } = useSettingStore();
  const { downloading, forDownloads } = useDownloadStore();
  const setSelectedRowIds = useSelectedDownloadStore(
    (state) => state.setSelectedRowIds,
  );
  const setSelectedDownloads = useSelectedDownloadStore(
    (state) => state.setSelectedDownloads,
  );
  // Handling selected downloads
  const selectedDownloads = useSelectedDownloadStore(
    (state) => state.selectedDownloads,
  );
  const clearAllSelections = useSelectedDownloadStore(
    (state) => state.clearAllSelections,
  );

  // confirmation modal
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
        removeFromForDownloads,
        processQueue,
      } = useDownloadStore.getState();

      // Store selected downloads in a temporary variable and clear selections immediately
      const downloadsToStop = [...selectedDownloads];
      clearAllSelections();

      for (const download of downloadsToStop) {
        setSelectedRowIds([]);
        setSelectedDownloads([]);
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
      setSelectedRowIds([]);
      setSelectedDownloads([]);
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

    // all downloads to queue - let the worker controller handle starting them
    uniqueDownloads.forEach((selectedDownload) => {
      const downloadInfo = selectedDownload.download;
      const processedName = downloadInfo.name.replace(/[\\/:*?"<>|]/g, '_');

      addQueue({
        videoUrl: selectedDownload.videoUrl ?? downloadInfo.videoUrl ?? '',
        name: `${processedName}.${downloadInfo.ext}`,
        downloadName: `${processedName}.${downloadInfo.ext}`,
        displayName:
          downloadInfo.displayName ?? `${processedName}.${downloadInfo.ext}`,
        size: downloadInfo.size,
        speed: downloadInfo.speed,
        channelName: downloadInfo.channelName ?? '',
        timeLeft: downloadInfo.timeLeft ?? '',
        DateAdded: new Date().toISOString(),
        uploadDate: downloadInfo.uploadDate,
        progress: downloadInfo.progress ?? 0,
        location: downloadInfo.location ?? selectedDownload.location ?? '',
        status: 'queued',
        ext: downloadInfo.ext,
        formatId: downloadInfo.formatId,
        audioExt: downloadInfo.audioExt,
        audioFormatId: downloadInfo.audioFormatId,
        extractorKey: downloadInfo.extractorKey,
        limitRate:
          settings.defaultDownloadSpeed === 0
            ? ''
            : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
        automaticCaption: downloadInfo.automaticCaption,
        thumbnails: downloadInfo.thumbnails,
        getTranscript: downloadInfo.getTranscript ?? false,
        getThumbnail: downloadInfo.getThumbnail ?? false,
        duration: downloadInfo.duration ?? 60,
        isCreateFolder: true,
        isLive: downloadInfo.isLive ?? false,
      });
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
      setMissingFiles(missing as DownloadItem[]);
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
    const deleteFileSafely = async (download: DownloadItem) => {
      try {
        let success = false;
        if (deleteFolder && download.location) {
          const folderExists = await window.downlodrFunctions.fileExists(
            download.location,
          );

          if (!folderExists) {
            deleteDownload(download.id);
            toast({
              variant: 'success',
              title: 'Download Deleted',
              description: 'Download has been deleted successfully',
              duration: 3000,
            });
            return;
          }
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

      // Handle failed downloads - just remove from list since no file was created
      if (download.status === 'failed') {
        deleteDownload(download.id);
        toast({
          variant: 'success',
          title: 'Download Removed',
          description: 'Failed download has been removed successfully',
          duration: 3000,
        });
        // Process queue after removing a failed download
        processQueue();
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
      await deleteFileSafely(download as DownloadItem);
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

  return (
    <div className="taskbar-container">
      <div className={cn('flex items-center justify-between', className)}>
        <div className="flex items-center h-full px-2 space-x-0 md:space-x-2">
          <div className="gap-1 flex">
            <PageNavigation />

            <div className="h-6 w-[1.5px] bg-gray-300 dark:bg-inputDarkModeBorder self-center ml-1 md:ml-3"></div>
          </div>

          <div className="flex items-center gap-3 pl-5">
            {taskBarButtonsVisibility.start && (
              <TooltipWrapper content="Start" side="bottom">
                <Button
                  variant="transparent"
                  size="icon"
                  className={cn(
                    'rounded font-semibold',
                    hasForDownloadStatus
                      ? 'dark:text-gray-100'
                      : 'cursor-not-allowed text-gray-800 dark:text-gray-400',
                  )}
                  onClick={handlePlaySelected}
                  disabled={!hasForDownloadStatus}
                  icon={<Play />}
                />
              </TooltipWrapper>
            )}

            {taskBarButtonsVisibility.stop && (
              <TooltipWrapper content="Stop" side="bottom">
                <Button
                  variant="transparent"
                  size="icon"
                  className={cn(
                    'rounded font-semibold',
                    hasActiveDownloadStatus
                      ? 'dark:text-gray-100'
                      : 'cursor-not-allowed text-gray-800 dark:text-gray-400',
                  )}
                  onClick={handleStopSelected}
                  disabled={!hasActiveDownloadStatus}
                  icon={<Stop />}
                />
              </TooltipWrapper>
            )}

            {taskBarButtonsVisibility.stopAll && (
              <TooltipWrapper content="Stop All" side="bottom">
                <Button
                  variant="transparent"
                  size="icon"
                  className={cn(
                    'rounded font-semibold',
                    hasDownloadingStatus
                      ? 'dark:text-gray-100'
                      : 'cursor-not-allowed text-gray-800 dark:text-gray-400',
                  )}
                  onClick={() => handleStopAll()}
                  disabled={!hasDownloadingStatus}
                  icon={<StopAll />}
                />
              </TooltipWrapper>
            )}
          </div>
        </div>

        <div className="pl-4 flex items-center w-full">
          <div className="w-full flex items-center justify-end">
            {/* 
            {location.pathname.includes('/status') && (
              <PluginTaskBarExtension />
            )}
*/}
            {/* Portal target for History-specific Remove button */}
            <div id="taskbar-portal"></div>

            {selectedDownloads.length > 0 &&
              (location.pathname.includes('/status/') ||
                location.pathname.includes('/tags/') ||
                location.pathname.includes('/category/')) && (
                <TooltipWrapper content="Remove" side="bottom">
                  <Button
                    variant="transparent"
                    size="icon"
                    className={cn(
                      'px-[10px] py-4 rounded-md flex gap-2 text-sm h-7 items-center hover:bg-gray-100 dark:hover:bg-darkModeHover',
                      selectedDownloads.length > 0 &&
                        (location.pathname.includes('/status/') ||
                          location.pathname.includes('/tags/') ||
                          location.pathname.includes('/category/'))
                        ? 'dark:text-gray-500'
                        : 'cursor-not-allowed text-gray-800 dark:text-gray-400',
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
                    icon={
                      <LuTrash
                        size={15}
                        className="text-gray-700 dark:text-gray-300 hover:dark:text-gray-100"
                      />
                    }
                  />
                </TooltipWrapper>
              )}

            <TaskbarInputField />
          </div>
        </div>
      </div>
      <StopModal
        isOpen={showStopConfirmation}
        onClose={() => {
          setShowStopConfirmation(false);
          setStopAction(null);
        }}
        onConfirm={() => {
          handleStopConfirm();
          setShowStopConfirmation(false);
          setStopAction(null);
        }}
      />
      <FileNotExistModal
        isOpen={showFileNotExistModal}
        onClose={() => setShowFileNotExistModal(false)}
        selectedDownloads={missingFiles}
      />
      <RemoveModal
        isOpen={showRemoveConfirmation}
        onClose={() => setShowRemoveConfirmation(false)}
        onConfirm={(deleteFolder) => {
          handleRemoveSelected(deleteFolder);
          setShowRemoveConfirmation(false);
        }}
        allowFolderDeletion={true}
      />
    </div>
  );
};

export default TaskBar;
