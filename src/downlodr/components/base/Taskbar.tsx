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
import { ToastAction } from '@/core-app/components/shadcn/components/ui/toast';
import { useToast } from '@/core-app/components/shadcn/hooks/use-toast';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import { useMainStore } from '@/core-app/store/mainStore';
import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
import { useSettingStore } from '@/core-app/store/settingsStore';
import { useAddonStore } from '@/core-app/store/addonStore';
import AboutModal from '@/downlodr/components/modal/custom/AboutModal';
import FileNotExistModal from '@/downlodr/components/modal/custom/FileNotExistModal';
import HelpModal from '@/downlodr/components/modal/custom/HelpModal';
import RemoveModal from '@/downlodr/components/modal/custom/RemoveModal';
import StopModal from '@/downlodr/components/modal/custom/StopModal';
import { DownloadItem } from '@/downlodr/schema/componentSchema';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
// import PluginTaskBarExtension from '@/plugins/components/PluginTaskBarExtension';
import PageNavigation from '@/downlodr/components/navigation/PageNavigation';
import { useAfdaStore } from '@/afda/store/afdaStore';
import { subscriptionStore } from '@/skedulosa/store/subscriptionStore';
import { formatDistanceToNow } from 'date-fns';
import React, { useEffect, useRef, useState } from 'react';
import { AiOutlineExclamationCircle } from 'react-icons/ai';
import { useTranslation } from 'react-i18next';
import { FaRegClock } from 'react-icons/fa';
import { FiBook } from 'react-icons/fi';
import { LuRefreshCw } from 'react-icons/lu';
import { RxUpdate } from 'react-icons/rx';
import { useLocation } from 'react-router-dom';
import { useDropdownAnimation } from '@/core-app/hooks/animation/useDropdownAnimation';
import SettingsModal from '../modal/custom/SettingsModal';
import AddonManagerModal from '../modal/custom/AddonManagerModal';

interface TaskBarProps {
  className?: string;
}

const TaskBar: React.FC<TaskBarProps> = ({ className }) => {
  const { t } = useTranslation('downlodr');
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
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const helpMenuRef = useRef<HTMLDivElement>(null);
  const { ref: helpDropdownRef, mounted: helpDropdownMounted } = useDropdownAnimation(showHelpMenu);
  const setAddonManagerOpen = useAddonStore((s) => s.setAddonManagerOpen);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        helpMenuRef.current &&
        !helpMenuRef.current.contains(event.target as Node)
      ) {
        setShowHelpMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setAddonManagerOpen(showAddonModal);
  }, [showAddonModal, setAddonManagerOpen]);

  const handleCheckForUpdates = async () => {
    setShowHelpMenu(false);
    toast({
      title: t('dropdownBar.toast.checkingConnectionTitle'),
      description: t('dropdownBar.toast.checkingConnectionDesc'),
      duration: 5500,
    });
    const hasInternet =
      await window.downlodrFunctions.checkInternetConnection();

    if (!hasInternet) {
      toast({
        variant: 'destructive',
        title: t('dropdownBar.toast.noInternetTitle'),
        description: t('dropdownBar.toast.noInternetDesc'),
        duration: 5000,
        action: (
          <ToastAction
            altText="Retry connection check"
            onClick={handleCheckForUpdates}
          >
            {t('dropdownBar.toast.retry')}
          </ToastAction>
        ),
      });
      return;
    }

    toast({
      title: t('dropdownBar.toast.checkingUpdatesTitle'),
      description: t('dropdownBar.toast.checkingUpdatesDesc'),
      duration: 3000,
    });

    if (window.updateAPI?.checkForUpdates && hasInternet) {
      try {
        const result = await window.updateAPI.checkForUpdates();
        if (result.error) {
          toast({
            variant: 'destructive',
            title: t('dropdownBar.toast.updateCheckFailedTitle'),
            description: result.error,
            duration: 4000,
          });
        } else if (!result.hasUpdate) {
          toast({
            title: t('dropdownBar.toast.upToDateTitle'),
            description: t('dropdownBar.toast.upToDateDesc', {
              version: result.currentVersion,
            }),
            duration: 3000,
          });
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('dropdownBar.toast.updateCheckFailedTitle'),
          description: t('dropdownBar.toast.updateCheckFailedDesc'),
          duration: 3000,
        });
        console.error('Error checking for updates:', error);
      }
    }
  };

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
        title: t('toolbar.toast.noDownloadsSelectedTitle'),
        description: t('toolbar.toast.noDownloadsSelectedStop'),
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
        title: t('toolbar.toast.noDownloadsFoundTitle'),
        description: t('toolbar.toast.noDownloadsFoundDesc'),
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
            title: t('toolbar.toast.downloadStoppedTitle'),
            description: t('toolbar.toast.downloadStoppedDesc'),
            duration: 3000,
          });
        } else if (currentForDownload?.status === 'to download') {
          removeFromForDownloads(download.id);
          toast({
            variant: 'success',
            title: t('toolbar.toast.downloadStoppedTitle'),
            description: t('toolbar.toast.downloadStoppedDesc'),
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
                title: t('toolbar.toast.downloadStoppedTitle'),
                description: t('toolbar.toast.downloadStoppedDesc'),
                duration: 3000,
              });
            } else {
              toast({
                variant: 'destructive',
                title: t('toolbar.toast.stopErrorTitle'),
                description: t('toolbar.toast.stopErrorCouldNotDesc', {
                  controllerId: currentDownload.controllerId,
                }),
                duration: 3000,
              });
            }
          } catch (error) {
            toast({
              variant: 'destructive',
              title: t('toolbar.toast.stopErrorTitle'),
              description: t('toolbar.toast.stopErrorDesc', {
                controllerId: currentDownload.controllerId,
              }),
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
              title: t('toolbar.toast.downloadStoppedTitle'),
              description: t('toolbar.toast.downloadStoppedDesc'),
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
                  title: t('toolbar.toast.downloadStoppedTitle'),
                  description: t('toolbar.toast.downloadStoppedDesc'),
                  duration: 3000,
                });
              } else {
                toast({
                  variant: 'destructive',
                  title: t('toolbar.toast.stopErrorTitle'),
                  description: t('toolbar.toast.stopErrorCouldNotDesc', {
                    controllerId: download.controllerId,
                  }),
                  duration: 3000,
                });
              }
            } catch (error) {
              toast({
                variant: 'destructive',
                title: t('toolbar.toast.stopErrorTitle'),
                description: t('toolbar.toast.stopErrorDesc', {
                  controllerId: download.controllerId,
                }),
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
        title: t('toolbar.toast.noDownloadsSelectedTitle'),
        description: t('toolbar.toast.noDownloadsSelectedPlay'),
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
        title: t('toolbar.toast.noValidDownloadsTitle'),
        description: t('toolbar.toast.noValidDownloadsDesc'),
        duration: 3000,
      });
      return;
    }

    // all downloads to queue - let the worker controller handle starting them
    uniqueDownloads.forEach((selectedDownload) => {
      const downloadInfo = selectedDownload.download;
      const processedName = downloadInfo.name.replace(/[\\/:*?"<>|]/g, '_');
      console.log('Processed name:', downloadInfo);
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
        title: t('toolbar.toast.noDownloadsSelectedTitle'),
        description: t('toolbar.toast.noDownloadsSelectedRemove'),
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
              title: t('toolbar.toast.downloadDeletedTitle'),
              description: t('toolbar.toast.downloadDeletedDesc'),
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
              title: t('toolbar.toast.folderDeletedTitle'),
              description: t('toolbar.toast.folderDeletedDesc'),
              duration: 3000,
            });
          } else {
            toast({
              variant: 'destructive',
              title: t('toolbar.toast.folderDeleteErrorTitle'),
              description: t('toolbar.toast.folderDeleteErrorDesc'),
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
              title: t('toolbar.toast.fileDeletedTitle'),
              description: t('toolbar.toast.fileDeletedDesc'),
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
          title: t('toolbar.toast.downloadRemovedTitle'),
          description: t('toolbar.toast.pendingRemovedDesc'),
          duration: 3000,
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
            title: t('toolbar.toast.downloadRemovedTitle'),
            description:
              currentDownload.status === 'cancelled'
                ? t('toolbar.toast.cancelledRemovedDesc')
                : currentDownload.status === 'paused'
                ? t('toolbar.toast.pausedRemovedDesc')
                : t('toolbar.toast.initializingRemovedDesc'),
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
            title: t('toolbar.toast.downloadRemovedTitle'),
            description: t('toolbar.toast.queuedRemovedDesc'),
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
                title: t('toolbar.toast.downloadStoppedTitle'),
                description: t('toolbar.toast.downloadStoppedDesc'),
                duration: 3000,
              });
            } else {
              toast({
                variant: 'destructive',
                title: t('toolbar.toast.stopErrorTitle'),
                description: t('toolbar.toast.stopErrorCouldNotDesc', {
                  controllerId: download.controllerId,
                }),
                duration: 3000,
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
        title: t('toolbar.toast.noDownloadsSelectedTitle'),
        description: t('toolbar.toast.noDownloadsSelectedRemove'),
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
          <div className="gap-1 flex mr-2">
            <PageNavigation onAddonRequired={() => setShowAddonModal(true)} isAddonModalOpen={showAddonModal} />
          </div>
          {/*
          {location.pathname.startsWith('/skedulosa') && (
            <div className="gap-1 flex whitespace-nowrap shrink-0 text-primary ml-10">
              <span className="mr-1">
                <FaRegClock className="text-primary mt-1" size={12} />
              </span>
              <span className="">
                Skedulosa Trial -{' '}
                {formatDistanceToNow(
                  subscriptionStore.getState().expirationDate,
                )}{' '}
                remaining.
              </span>
              <span className="font-semibold underline">Learn more</span>
            </div>
          )}
            */}
        </div>

        <div className="pl-4 flex items-center w-full">
          <div className="flex-1 flex items-center justify-center mx-4">
            <div className="flex items-center rounded-lg px-3 py-1 max-w-md w-full"></div>
          </div>

          <div className="flex items-center justify-end">
            <button
              className="px-3 py-1 rounded font-semibold hover:bg-gray-100 dark:hover:bg-darkModeNavigation"
              onClick={(e) => {
                e.stopPropagation();
                setShowAddonModal(true);
              }}
            >
              Add-ons
            </button>
            <button
              className="px-3 py-1 rounded font-semibold hover:bg-gray-100 dark:hover:bg-darkModeNavigation "
              onClick={(e) => {
                e.stopPropagation();
                setShowSettingsModal(true);
              }}
            >
              {t('toolbar.settingsButton')}
            </button>
            <div className="relative" ref={helpMenuRef}>
              <button
                className={`px-3 py-1 hover:bg-gray-100 dark:hover:bg-darkModeNavigation rounded font-semibold ${
                  showHelpMenu ? 'bg-gray-100 dark:bg-darkModeNavigation' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHelpMenu((prev) => !prev);
                }}
              >
                {t('dropdownBar.menus.help')}
              </button>
              {helpDropdownMounted && (
                <div ref={helpDropdownRef} className="absolute right-0 mt-1 w-[125px] bg-white dark:bg-darkModeDropdown border dark:border-gray-700 rounded-md shadow-lg py-1 z-50">
                  <div className="mx-1">
                    <button
                      className="w-full text-left px-1 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHelpModal(true);
                        setShowHelpMenu(false);
                      }}
                    >
                      <FiBook size={16} />
                      <span className="text-xs">
                        {t('dropdownBar.help.guide')}
                      </span>
                    </button>
                  </div>
                  <div className="mx-1">
                    <button
                      className="w-full text-left px-1 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCheckForUpdates();
                      }}
                    >
                      <RxUpdate size={16} />
                      <span className="text-xs">
                        {t('dropdownBar.help.appUpdates')}
                      </span>
                    </button>
                  </div>
                  <div className="mx-1">
                    <button
                      className="w-full text-left px-1 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAboutModal(true);
                        setShowHelpMenu(false);
                      }}
                    >
                      <AiOutlineExclamationCircle size={16} />
                      <span className="text-xs">
                        {t('dropdownBar.help.about')}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
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
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
      <AddonManagerModal
        isOpen={showAddonModal}
        onClose={() => setShowAddonModal(false)}
      />
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
      {/* <PluginTaskBarExtension /> */}
    </div>
  );
};

export default TaskBar;
