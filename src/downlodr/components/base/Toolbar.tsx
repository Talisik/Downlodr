/**
 * A custom React fixed component
 * A Fixed element in the header portion of Downlodr, displays common download task buttons for downloads such as:
 *  - Remove (Removing finished downloads from drive and log)
 *  - Stop All (Stop all current downloads)
 *  - Stop (Stop selected current downloads)
 *  - Start (Start selected current downloads)
 *  - Add URL (Add a download to the for download via link)
 *
 * @param className - for UI of Toolbar
 * @returns JSX.Element - The rendered component displaying a Toolbar
 *
 */

// HIII you are adding disabled tooltip logic, bye bye

import { Play, Stop, StopAll } from '@/assets/icon';
import {
  useTaskbarDownloadStore,
  type TypeFilter,
} from '@/downlodr/store/taskbarDownloadStore';
import { HiXMark } from 'react-icons/hi2';
import { Button } from '@/core-app/components/shadcn/components/ui/button';
import { useToast } from '@/core-app/components/shadcn/hooks/use-toast';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { useMainStore } from '@/core-app/store/mainStore';
import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
import { useSettingStore } from '@/core-app/store/settingsStore';
import TaskBarInputField from '@/downlodr/components/base/InputField/TaskbarInputField';
import BulkTranscriptModal from '@/downlodr/components/modal/custom/BulkTranscriptModal';
import RemoveModal from '@/downlodr/components/modal/custom/RemoveModal';
import StopModal from '@/downlodr/components/modal/custom/StopModal';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import { DownloadItem } from '@/downlodr/schema/componentSchema';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { maybeShowFormatHint } from '@/downlodr/utils/formatHint';
import PluginToolbarExtension from '@/plugins/components/PluginTaskBarExtension';
import React, { useState } from 'react';
import { LuTrash } from 'react-icons/lu';
import { enqueueTranscript } from '@/downlodr/utils/transcription/transcriptQueue';
import { FaRegClosedCaptioning } from 'react-icons/fa';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface ToolbarProps {
  className?: string;
  hidePluginExtension?: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  className,
  hidePluginExtension,
}) => {
  const { t } = useTranslation('downlodr');
  // Handle state for modal
  const [showStopConfirmation, setShowStopConfirmation] = useState(false);
  const [stopAction, setStopAction] = useState<'selected' | 'all' | null>(null);
  const { toast } = useToast();
  const location = useLocation(); // Get current location
  // Get the max download limit and current downloads from stores
  const { taskBarButtonsVisibility } = useMainStore();
  const { settings } = useSettingStore();
  const { downloading, forDownloads, finishedDownloads } = useDownloadStore();
  const removeArticleDownload = useArticleDownloadStore(
    (s) => s.removeArticleDownload,
  );
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

  const searchState = useTaskbarDownloadStore((s) => s.searchState);
  const clearSearch = useTaskbarDownloadStore((s) => s.clearSearch);
  const activeTypeFilters = useTaskbarDownloadStore((s) => s.activeTypeFilters);
  const toggleTypeFilter = useTaskbarDownloadStore((s) => s.toggleTypeFilter);

  // confirmation modals
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [showBulkTranscriptConfirmation, setShowBulkTranscriptConfirmation] =
    useState(false);

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
          d.status === 'paused' ||
          d.status === 'pausing'),
    ),
  );

  // Check if any selected downloads are in "downloading" or "initializing" status (for Stop button)
  const hasDownloadingStatus = downloading.some((download) =>
    downloading.some(
      (d) =>
        d.id === download.id &&
        (d.status === 'downloading' ||
          d.status === 'initializing' ||
          d.status === 'paused' ||
          d.status === 'pausing'),
    ),
  );

  // Helper: mirrors TranscrptButton invalid-location check
  const isTranscriptMissing = (
    transcriptLocation: string | undefined,
    autoCaptionLocation: string | undefined,
  ): boolean => {
    const resolvedLocation =
      typeof transcriptLocation === 'string'
        ? transcriptLocation
        : autoCaptionLocation;
    const isValid =
      !!resolvedLocation &&
      resolvedLocation.trim() !== '' &&
      resolvedLocation !== 'iu' &&
      resolvedLocation !== 'fu';
    return !isValid;
  };

  // Eligible = finished, no valid transcript, not currently transcribing
  const eligibleSelectedDownloads = selectedDownloads
    .map((selected) => finishedDownloads.find((fd) => fd.id === selected.id))
    .filter(
      (fd): fd is (typeof finishedDownloads)[0] =>
        fd !== undefined &&
        fd.status === 'finished' &&
        fd.transcriptionStatus !== 'transcribing' &&
        fd.transcriptionStatus !== 'queued' &&
        isTranscriptMissing(fd.transcriptLocation, fd.autoCaptionLocation),
    );

  const handleStopSelected = async () => {
    if (selectedDownloads.length === 0) {
      toast({
        variant: 'destructive',
        title: t('toolbar.toast.noDownloadsSelectedTitle'),
        description: t('toolbar.toast.noDownloadsSelectedStop'),
        duration: 5000,
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
        title: t('toolbar.toast.noDownloadsFoundTitle'),
        description: t('toolbar.toast.noDownloadsFoundDesc'),
        duration: 5000,
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
            title: t('toolbar.toast.downloadStoppedTitle'),
            description: t('toolbar.toast.downloadStoppedDesc'),
            duration: 5000,
          });
        } else if (currentForDownload?.status === 'to download') {
          removeFromForDownloads(download.id);
          toast({
            variant: 'success',
            title: t('toolbar.toast.downloadStoppedTitle'),
            description: t('toolbar.toast.downloadStoppedDesc'),
            duration: 5000,
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
                title: t('toolbar.toast.downloadStoppedTitle'),
                description: t('toolbar.toast.downloadStoppedDesc'),
                duration: 5000,
              });
            } else {
              toast({
                variant: 'destructive',
                title: t('toolbar.toast.stopErrorTitle'),
                description: t('toolbar.toast.stopErrorCouldNotDesc', {
                  controllerId: currentDownload.controllerId,
                }),
                duration: 5000,
              });
            }
          } catch (error) {
            toast({
              variant: 'destructive',
              title: t('toolbar.toast.stopErrorTitle'),
              description: t('toolbar.toast.stopErrorDesc', {
                controllerId: currentDownload.controllerId,
              }),
              duration: 5000,
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
              title: t('toolbar.toast.downloadStoppedTitle'),
              description: t('toolbar.toast.downloadStoppedDesc'),
              duration: 5000,
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
                  title: t('toolbar.toast.downloadStoppedTitle'),
                  description: t('toolbar.toast.downloadStoppedDesc'),
                  duration: 5000,
                });
              } else {
                toast({
                  variant: 'destructive',
                  title: t('toolbar.toast.stopErrorTitle'),
                  description: t('toolbar.toast.stopErrorCouldNotDesc', {
                    controllerId: download.controllerId,
                  }),
                  duration: 5000,
                });
              }
            } catch (error) {
              toast({
                variant: 'destructive',
                title: t('toolbar.toast.stopErrorTitle'),
                description: t('toolbar.toast.stopErrorDesc', {
                  controllerId: download.controllerId,
                }),
                duration: 5000,
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
        title: t('toolbar.toast.noDownloadsSelectedTitle'),
        description: t('toolbar.toast.noDownloadsSelectedPlay'),
        duration: 5000,
      });
      return;
    }

    // One-time hint: consumes this click without starting any downloads.
    if (maybeShowFormatHint()) return;

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
        title: t('toolbar.toast.noValidDownloadsTitle'),
        description: t('toolbar.toast.noValidDownloadsDesc'),
        duration: 5000,
      });
      return;
    }

    // all downloads to queue - let the worker controller handle starting them
    uniqueDownloads.forEach((selectedDownload) => {
      const downloadInfo = selectedDownload.download;
      const processedName = downloadInfo.name.replace(/[\\/:*?"<>|]/g, '_');

      addQueue({
        subscriptionId: downloadInfo.subscriptionId,
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
        tags: downloadInfo.tags,
        category: downloadInfo.category,
        isLive: downloadInfo.isLive ?? false,
      });
      removeFromForDownloads(selectedDownload.id);
    });

    // Show toast notification
    toast({
      title: t('toolbar.toast.addedToQueueTitle'),
      description: t('toolbar.toast.addedToQueueDesc', {
        count: uniqueDownloads.length,
      }),
      duration: 5000,
    });
  };

  const handleRemoveSelected = async (deleteFolder?: boolean) => {
    if (selectedDownloads.length === 0) {
      toast({
        variant: 'destructive',
        title: t('toolbar.toast.noDownloadsSelectedTitle'),
        description: t('toolbar.toast.noDownloadsSelectedRemove'),
        duration: 5000,
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
              title: t('toolbar.toast.downloadDeletedTitle'),
              description: t('toolbar.toast.downloadDeletedDesc'),
              duration: 5000,
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
              title: t('toolbar.toast.folderDeletedTitle'),
              description: t('toolbar.toast.folderDeletedDesc'),
              duration: 5000,
            });
          } else {
            toast({
              variant: 'destructive',
              title: t('toolbar.toast.folderDeleteErrorTitle'),
              description: t('toolbar.toast.folderDeleteErrorDesc'),
              duration: 5000,
            });
          }
        } else {
          // Original file deletion logic
          success = await window.downlodrFunctions.deleteFile(
            download.location,
          );

          // Whether or not the file itself was on disk, the user asked to
          // delete this download, so the log always goes away.
          deleteDownload(download.id);
          toast({
            variant: 'success',
            title: success
              ? t('toolbar.toast.fileDeletedTitle')
              : t('toolbar.toast.downloadDeletedTitle'),
            description: success
              ? t('toolbar.toast.fileDeletedDesc')
              : t('toolbar.toast.downloadDeletedDesc'),
            duration: 5000,
          });
        }
      } catch (error) {
        deleteDownload(download.id);
        toast({
          variant: 'success',
          title: t('toolbar.toast.downloadDeletedTitle'),
          description: t('toolbar.toast.downloadDeletedDesc'),
          duration: 5000,
        });
      }
    };

    // Process each download
    for (const download of downloadsToRemove) {
      if (!download.id) continue;

      // Article downloads live in articleDownloadStore, not downloadStore.
      const isArticle =
        (download.download as { type?: string })?.type === 'article';
      if (isArticle) {
        const filePath = download.location;
        if (filePath) {
          try {
            await window.downlodrFunctions.deleteFile(filePath);
          } catch {
            /* ignore */
          }
        }
        removeArticleDownload(download.id);
        continue;
      }

      if (!download.location) {
        continue;
      }

      // Check if it's a pending download
      const isPending = forDownloads.some((d) => d.id === download.id);
      if (isPending) {
        deleteDownload(download.id);
        toast({
          variant: 'success',
          title: t('toolbar.toast.downloadRemovedTitle'),
          description: t('toolbar.toast.pendingRemovedDesc'),
          duration: 5000,
        });
        continue;
      }

      // Handle failed downloads - just remove from list since no file was created
      if (download.status === 'failed') {
        deleteDownload(download.id);
        toast({
          variant: 'success',
          title: t('toolbar.toast.downloadRemovedTitle'),
          description: t('toolbar.toast.failedRemovedDesc'),
          duration: 5000,
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
            title: t('toolbar.toast.downloadRemovedTitle'),
            description:
              currentDownload.status === 'cancelled'
                ? t('toolbar.toast.cancelledRemovedDesc')
                : currentDownload.status === 'paused'
                ? t('toolbar.toast.pausedRemovedDesc')
                : t('toolbar.toast.initializingRemovedDesc'),
            duration: 5000,
          });
          processQueue();

          continue;
        }
        const isQueued = queuedDownloads.some((d) => d.id === download.id);

        if (isQueued) {
          removeFromQueue(download.id);
          toast({
            variant: 'success',
            title: t('toolbar.toast.downloadRemovedTitle'),
            description: t('toolbar.toast.queuedRemovedDesc'),
            duration: 5000,
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
                title: t('toolbar.toast.downloadStoppedTitle'),
                description: t('toolbar.toast.downloadStoppedDesc'),
                duration: 5000,
              });
            } else {
              toast({
                variant: 'destructive',
                title: t('toolbar.toast.stopErrorTitle'),
                description: t('toolbar.toast.stopErrorCouldNotDesc', {
                  controllerId: download.controllerId,
                }),
                duration: 5000,
              });
              continue; // Skip deletion if we couldn't stop the download
            }
          } catch (error) {
            toast({
              variant: 'destructive',
              title: t('toolbar.toast.stopErrorTitle'),
              description: t('toolbar.toast.stopErrorDesc', {
                controllerId: download.controllerId,
              }),
              duration: 5000,
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
        title: t('toolbar.toast.noDownloadsSelectedTitle'),
        description: t('toolbar.toast.noDownloadsSelectedRemove'),
        duration: 5000,
      });
      return;
    }
    setShowRemoveConfirmation(true);
  };

  const handleGetLink = async () => {
    if (selectedDownloads.length !== 1) {
      toast({
        variant: 'destructive',
        title: t('toolbar.toast.selectOneTitle'),
        description: t('toolbar.toast.selectOneDesc'),
        duration: 5000,
      });
      return;
    }
    const directUrl = await window.ytdlp.getDirectUrl(
      'https://www.youtube.com/watch?v=mRNtw_Tc1Jc',
    );
    console.log('Direct URL:', directUrl);
  };

  const handleBatchTranscript = () => {
    if (eligibleSelectedDownloads.length === 0) {
      toast({
        variant: 'destructive',
        title: t('toolbar.toast.noEligibleTitle'),
        description: t('toolbar.toast.noEligibleDesc'),
        duration: 5000,
      });
      return;
    }
    setShowBulkTranscriptConfirmation(true);
  };

  const runBatchTranscript = () => {
    const downloadsToProcess = [...eligibleSelectedDownloads];
    clearAllSelections();

    for (const download of downloadsToProcess) {
      enqueueTranscript({
        downloadId: download.id,
        location: download.location,
        downloadName: download.downloadName,
      });
    }

    toast({
      title: t('toolbar.toast.batchStartedTitle'),
      description: t('toolbar.toast.batchStartedDesc', {
        count: downloadsToProcess.length,
      }),
      duration: 5000,
    });
  };

  return (
    <>
      <div className="Toolbar-container">
        <div className={cn('flex items-center justify-between', className)}>
          <div className="flex items-center h-full px-2 space-x-0 md:space-x-2">
            <div className="flex items-center gap-1.5 pl-2 pr-2">
              {(['videos', 'subscriptions', 'articles'] as TypeFilter[]).map(
                (f) => {
                  const active = activeTypeFilters.has(f);
                  const label = f.charAt(0).toUpperCase() + f.slice(1);
                  return (
                    <button
                      key={f}
                      onClick={() => toggleTypeFilter(f)}
                      className={`h-6 px-2.5 rounded-full text-[11.5px] font-medium transition-colors border ${
                        active
                          ? 'bg-primary text-white border-primary'
                          : 'bg-transparent text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-primary hover:text-primary dark:hover:text-primary'
                      }`}
                    >
                      {label}
                    </button>
                  );
                },
              )}
            </div>
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1 flex-shrink-0" />
            <div className="flex items-center gap-3">
              {taskBarButtonsVisibility.start && (
                <div>
                  <TooltipWrapper
                    content={
                      !hasForDownloadStatus
                        ? t('toolbar.tooltip.startDisabled')
                        : t('toolbar.tooltip.startEnabled')
                    }
                    side="bottom"
                  >
                    <div>
                      <Button
                        variant="transparent"
                        size="icon"
                        className={cn(
                          'rounded-md h-7 flex items-center justify-center p-[2px] dark:bg-transparent',
                          hasForDownloadStatus
                            ? 'dark:text-gray-100'
                            : 'cursor-not-allowed text-gray-800 dark:text-gray-400',
                        )}
                        onClick={handlePlaySelected}
                        disabled={!hasForDownloadStatus}
                        icon={<Play />}
                      />
                    </div>
                  </TooltipWrapper>
                </div>
              )}

              {taskBarButtonsVisibility.stop && (
                <div>
                  <TooltipWrapper
                    content={
                      hasActiveDownloadStatus
                        ? t('toolbar.tooltip.stopEnabled')
                        : t('toolbar.tooltip.stopDisabled')
                    }
                    side="bottom"
                  >
                    <div>
                      <Button
                        variant="transparent"
                        size="icon"
                        className={cn(
                          'rounded-md h-7 flex items-center justify-center p-[2px] bg-[#f9f9f9] dark:bg-transparent hover:bg-gray-100 dark:hover:bg-darkModeHover',
                          hasActiveDownloadStatus
                            ? 'dark:text-gray-100'
                            : 'cursor-not-allowed text-gray-800 dark:text-gray-400',
                        )}
                        onClick={handleStopSelected}
                        disabled={!hasActiveDownloadStatus}
                        icon={<Stop />}
                      />
                    </div>
                  </TooltipWrapper>
                </div>
              )}
              {/*
              {taskBarButtonsVisibility.stopAll && (
                <div className="">
                  <TooltipWrapper
                    content={
                      !hasDownloadingStatus
                        ? t('toolbar.tooltip.stopAllDisabled')
                        : t('toolbar.tooltip.stopAll')
                    }
                    side="bottom"
                  >
                    <div>
                      <Button
                        variant="transparent"
                        size="icon"
                        className={cn(
                          'rounded-md h-7 flex items-center justify-center p-[2px] bg-[#f9f9f9] dark:bg-transparent hover:bg-gray-100 dark:hover:bg-darkModeHover',
                          hasDownloadingStatus
                            ? 'dark:text-gray-100'
                            : 'cursor-not-allowed text-gray-800 dark:text-gray-400',
                        )}
                        onClick={() => handleStopAll()}
                        disabled={!hasDownloadingStatus}
                        icon={<StopAll className="w-[16px] h-[16px]" />}
                      />
                    </div>
                  </TooltipWrapper>
                </div>
              )}
                 */}
              {(location.pathname.includes('/status/') ||
                location.pathname.includes('/tags/') ||
                location.pathname.includes('/category/')) && (
                <TooltipWrapper
                  content={
                    !(eligibleSelectedDownloads.length === 0)
                      ? t('toolbar.tooltip.generateCaptions')
                      : t('toolbar.tooltip.generateCaptionsDisabled')
                  }
                  side="bottom"
                >
                  <div>
                    <Button
                      variant="transparent"
                      size="icon"
                      className={cn(
                        'rounded-md h-7 flex items-center justify-center p-[2px] bg-[#f9f9f9] dark:bg-transparent hover:bg-gray-100 dark:hover:bg-darkModeHover',
                        eligibleSelectedDownloads.length > 0
                          ? 'dark:text-gray-100'
                          : 'cursor-not-allowed text-gray-800 dark:text-gray-400',
                      )}
                      onClick={handleBatchTranscript}
                      disabled={eligibleSelectedDownloads.length === 0}
                      icon={
                        <FaRegClosedCaptioning
                          size={16}
                          className="text-gray-700 dark:text-gray-300 hover:dark:text-gray-100"
                        />
                      }
                    />
                  </div>
                </TooltipWrapper>
              )}
              {selectedDownloads.length > 0 &&
                (location.pathname.includes('/status/') ||
                  location.pathname.includes('/tags/') ||
                  location.pathname.includes('/category/')) && (
                  <TooltipWrapper
                    content={t('toolbar.tooltip.remove')}
                    side="bottom"
                  >
                    <Button
                      variant="transparent"
                      size="icon"
                      className="text-[12px] text-white rounded-md h-6 flex items-center justify-center px-2 py-[2px] bg-[#FF4F45] hover:bg-red-200 dark:hover:bg-red-900/40"
                      onClick={handleRemoveButtonClick}
                      icon={
                        <LuTrash
                          size={13}
                          className="text-white dark:text-white"
                        />
                      }
                    >
                      {t('toolbar.deleteLabel')}
                    </Button>
                  </TooltipWrapper>
                )}
            </div>
          </div>

          <div className="pl-4 flex items-center w-full">
            <div className="w-full flex items-center justify-end">
              {location.pathname.includes('/status') &&
                !hidePluginExtension && <PluginToolbarExtension />}

              {/* Portal target for History-specific Remove button */}
              <div id="Toolbar-portal"></div>
            </div>
          </div>

          <TaskBarInputField />
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
        <RemoveModal
          isOpen={showRemoveConfirmation}
          onClose={() => setShowRemoveConfirmation(false)}
          onConfirm={(deleteFolder) => {
            handleRemoveSelected(deleteFolder);
            setShowRemoveConfirmation(false);
          }}
          allowFolderDeletion={true}
        />
        <BulkTranscriptModal
          isOpen={showBulkTranscriptConfirmation}
          onClose={() => setShowBulkTranscriptConfirmation(false)}
          onConfirm={runBatchTranscript}
          count={eligibleSelectedDownloads.length}
        />
      </div>
      {/* {searchState.isSearchActive && searchState.searchQuery && (
        <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="ml-2 flex flex-row gap-2 justify-center items-center">
            <span>Filters:</span>
            <span className="flex items-center gap-1 bg-lightOrangeTag/40 dark:bg-red-900/20 text-orange-500 dark:text-red-400 rounded-full px-2 py-0.5">
              Search: &ldquo;{searchState.searchQuery}&rdquo;
              <button
                onClick={clearSearch}
                className="ml-0.5 hover:text-red-800 dark:hover:text-red-200"
                aria-label="Clear search"
              >
                <HiXMark className="w-3 h-3" />
              </button>
            </span>
          </div>

          <div className='mr-2'>
            {searchState.searchResults.length}{' '}
            {searchState.searchResults.length === 1 ? 'item' : 'items'}
          </div>
        </div>
      )} */}
    </>
  );
};

export default Toolbar;
