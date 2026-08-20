/**
 * Status page action handlers. Use useStatusPageHandlers() from StatusPage
 * and pass the required state/setters so handlers update the correct UI.
 */
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import { DownloadItem } from '@/downlodr/schema/componentSchema';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import type { SearchableDownload } from '@/downlodr/store/taskbarDownloadStore';
import {
  deletePerDownloadFolder,
  isPerDownloadFolder,
} from '@/downlodr/utils/download/downloadFolder';
import { redownloadTranscript } from '@/downlodr/utils/transcription/ffmpegWhisperTranscriber';
import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContextMenuDownload } from './statusPageUtils';
import { getMenuItemCount } from './statusPageUtils';

/** Context menu state shape used by the page */
export interface ContextMenuState {
  downloadId: string | null;
  x: number;
  y: number;
  downloadLocation?: string;
  controllerId?: string;
  downloadStatus?: string;
}

/** Column header context menu state */
export interface ColumnHeaderContextMenuState {
  x: number;
  y: number;
  visible: boolean;
}

/** Dependencies the handlers need from StatusPage (state + setters) */
export interface StatusPageHandlerDeps {
  allDownloads: SearchableDownload[];
  contextMenu: ContextMenuState;
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState>>;
  columnHeaderContextMenu: ColumnHeaderContextMenuState;
  setColumnHeaderContextMenu: React.Dispatch<
    React.SetStateAction<ColumnHeaderContextMenuState>
  >;
  transitionTimeoutRef: React.MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>;
  setIsTransitioning: (value: boolean) => void;
  setSelectedDownloadId: (id: string | null) => void;
  setLogModalDownloadId: (id: string) => void;
  setShowLogModal: (show: boolean) => void;
  setActivityTrackerDownloadId: (id: string | null) => void;
  setShowActivityTracker: (show: boolean) => void;
  setSelectedRowIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  setSelectedDownloads: (downloads: unknown[]) => void;
  updateIsOpenPluginSidebar: (open: boolean) => void;
  handleFileNotExistModal: (download: DownloadItem) => void;
}

const closeContextMenu = (
  setContextMenu: StatusPageHandlerDeps['setContextMenu'],
) => setContextMenu({ downloadId: null, x: 0, y: 0 });

/** Build DownloadItem for modal from a searchable download */
function toDownloadItem(download: SearchableDownload): DownloadItem {
  return {
    id: download.id,
    videoUrl: download.videoUrl,
    location: download.location,
    name: download.name,
    ext: download.ext,
    downloadName: download.downloadName,
    extractorKey: download.extractorKey,
    status: download.status,
    download: {
      displayName: (download as { displayName?: string }).displayName ?? '',
      ...download,
    } as DownloadItem['download'],
  };
}

/**
 * Hook that returns all status page handlers. Call from StatusPage and pass
 * the current state/setters so handlers update the correct variables.
 */
export function useStatusPageHandlers(deps: StatusPageHandlerDeps) {
  const { t } = useTranslation('downlodr');
  const deleteDownload = useDownloadStore((s) => s.deleteDownload);
  const removeArticleDownload = useArticleDownloadStore(
    (s) => s.removeArticleDownload,
  );
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const tRef = useRef(t);
  tRef.current = t;

  const handleRedownloadTranscript = useCallback(async (downloadId: string) => {
    const { allDownloads } = depsRef.current;
    const download = allDownloads.find((d) => d.id === downloadId);
    if (!download) return;

    const inputLocation = await window.downlodrFunctions.joinDownloadPath(
      download.location,
      download.downloadName,
    );
    const outputLocation = await window.downlodrFunctions.joinDownloadPath(
      download.location,
      download.downloadName.replace(/\.[^/.]+$/, '.srt'),
    );
    redownloadTranscript({
      inputFile: inputLocation,
      outputFile: outputLocation,
      modelPath: 'ggml-small.bin',
      // 'auto', not 'en': forcing English makes Whisper *translate* non-English
      // audio into English rather than transcribe it in its own language.
      language: 'auto',
      format: 'srt',
    });
    toast({
      variant: 'success',
      title: tRef.current('statusHandler.transcriptRedownloaded'),
      description: tRef.current('statusHandler.transcriptRedownloadedDesc'),
      duration: 5000,
    });
    useDownloadStore
      .getState()
      .updateDownloadTranscript(downloadId, outputLocation);
  }, []);

  const handleContextMenu = useCallback(
    async (event: React.MouseEvent, download: ContextMenuDownload) => {
      event.preventDefault();
      event.stopPropagation();
      const {
        contextMenu,
        setContextMenu,
        columnHeaderContextMenu,
        setColumnHeaderContextMenu,
        transitionTimeoutRef,
        setIsTransitioning,
        setSelectedDownloadId,
        updateIsOpenPluginSidebar,
      } = depsRef.current;

      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }

      updateIsOpenPluginSidebar(false);
      setColumnHeaderContextMenu({
        ...columnHeaderContextMenu,
        visible: false,
      });

      const downloadId = download.id;
      const downloadStatus = download.status;
      const controllerId = download.controllerId;

      const pluginCount = await window.plugins
        .getMenuItems('download-context')
        .then((items) => items.length);

      const itemHeight = 40;
      const menuItemCount = getMenuItemCount(downloadStatus, pluginCount);
      const menuHeight = menuItemCount * itemHeight;
      const margin = 10;

      let y = event.clientY;
      if (y + menuHeight > window.innerHeight - margin) {
        y = Math.max(margin, window.innerHeight - menuHeight - margin);
      }
      let x = event.clientX;
      const menuWidth = 220;
      if (x + menuWidth > window.innerWidth - margin) {
        x = Math.max(margin, window.innerWidth - menuWidth - margin);
      }

      const downloadLocation = await window.downlodrFunctions.joinDownloadPath(
        download.location,
        download.name,
      );

      const isMenuAlreadyOpen = contextMenu.downloadId !== null;

      if (isMenuAlreadyOpen) {
        setIsTransitioning(true);
        setContextMenu({ downloadId: null, x: 0, y: 0 });

        transitionTimeoutRef.current = setTimeout(() => {
          if (transitionTimeoutRef.current) {
            setContextMenu({
              downloadId,
              x,
              y,
              downloadLocation,
              downloadStatus,
              controllerId,
            });
            setSelectedDownloadId(downloadId);
            setIsTransitioning(false);
            transitionTimeoutRef.current = null;
          }
        }, 120);
      } else {
        setContextMenu({
          downloadId,
          x,
          y,
          downloadLocation,
          downloadStatus,
          controllerId,
        });
        setSelectedDownloadId(downloadId);
      }
    },
    [],
  );

  const handleShowLog = useCallback((downloadId: string) => {
    depsRef.current.setLogModalDownloadId(downloadId);
    depsRef.current.setShowLogModal(true);
  }, []);

  const handleShowActivityTracker = useCallback((downloadId: string) => {
    depsRef.current.setActivityTrackerDownloadId(downloadId);
    depsRef.current.setShowActivityTracker(true);
  }, []);

  const handleRetry = useCallback(
    (downloadId: string) => {
      const { allDownloads, setSelectedRowIds, setSelectedDownloads } =
        depsRef.current;
      const currentDownload = allDownloads.find((d) => d.id === downloadId);
      if (!currentDownload) return;

      const { retryDownload } = useDownloadStore.getState();
      retryDownload({
        videoUrl: currentDownload.videoUrl ?? '',
        name: currentDownload.name,
        downloadName: currentDownload.downloadName,
        displayName: currentDownload.displayName ?? '',
        size: currentDownload.size,
        speed: currentDownload.speed,
        channelName: currentDownload.channelName ?? '',
        timeLeft: currentDownload.timeLeft ?? '',
        DateAdded: new Date().toISOString(),
        uploadDate: currentDownload.uploadDate,
        progress: 0,
        location: currentDownload.location ?? '',
        status: 'downloading',
        ext: currentDownload.ext,
        formatId: currentDownload.formatId,
        audioExt: currentDownload.audioExt,
        audioFormatId: currentDownload.audioFormatId,
        extractorKey: currentDownload.extractorKey,
        limitRate: '',
        automaticCaption: currentDownload.automaticCaption,
        thumbnails: currentDownload.thumbnails ?? null,
        getTranscript: currentDownload.getTranscript ?? false,
        getThumbnail: currentDownload.getThumbnail ?? false,
        duration: currentDownload.duration ?? 60,
        thumnailsLocation:
          (currentDownload as { thumnailsLocation?: string })
            .thumnailsLocation ?? '',
        autoCaptionLocation:
          (currentDownload as { autoCaptionLocation?: string })
            .autoCaptionLocation ?? '',
        isCreateFolder: false,
        tags: currentDownload.tags,
        category: currentDownload.category,
      });
      deleteDownload(downloadId);
      setSelectedRowIds([]);
      setSelectedDownloads([]);
      toast({
        variant: 'success',
        title: tRef.current('statusHandler.downloadRetried'),
        description: tRef.current('statusHandler.downloadRetriedDesc'),
        duration: 5000,
      });
    },
    [deleteDownload],
  );

  const handlePause = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature matches callback from context menu
    async (downloadId: string, _downloadLocation?: string | undefined) => {
      const { setContextMenu } = depsRef.current;
      const {
        downloading,
        deleteDownloading,
        addDownload,
        updateDownloadStatus,
      } = useDownloadStore.getState();
      const currentDownload = downloading.find((d) => d.id === downloadId);

      if (currentDownload?.status === 'paused') {
        const isM4aDownload =
          currentDownload.ext === 'm4a' || currentDownload.audioExt === 'm4a';

        if (
          isM4aDownload &&
          currentDownload.location &&
          currentDownload.downloadName
        ) {
          try {
            const fullFilePath =
              await window.downlodrFunctions.joinDownloadPath(
                currentDownload.location,
                currentDownload.downloadName,
              );
            const fileExists = await window.downlodrFunctions.fileExists(
              fullFilePath,
            );
            if (fileExists) {
              await window.downlodrFunctions.deleteFile(fullFilePath);
            }
          } catch (error) {
            console.error('Error handling existing m4a file:', error);
          }
        }

        addDownload({
          subscriptionId: currentDownload.subscriptionId,
          videoUrl: currentDownload.videoUrl ?? '',
          name: currentDownload.name,
          downloadName: currentDownload.downloadName,
          displayName: currentDownload.displayName ?? '',
          size: currentDownload.size,
          speed: currentDownload.speed,
          channelName: currentDownload.channelName ?? '',
          timeLeft: currentDownload.timeLeft ?? '',
          DateAdded: new Date().toISOString(),
          progress: currentDownload.progress,
          location: currentDownload.location ?? '',
          status: 'downloading',
          ext: currentDownload.ext,
          formatId: currentDownload.formatId,
          audioExt: currentDownload.audioExt,
          audioFormatId: currentDownload.audioFormatId,
          extractorKey: currentDownload.extractorKey,
          limitRate: '',
          automaticCaption: currentDownload.automaticCaption,
          thumbnails: currentDownload.thumbnails ?? null,
          getTranscript: currentDownload.getTranscript ?? false,
          getThumbnail: currentDownload.getThumbnail ?? false,
          autoCaptionLocation:
            (currentDownload as { autoCaptionLocation?: string })
              .autoCaptionLocation ?? '',
          thumnailsLocation:
            (currentDownload as { thumnailsLocation?: string })
              .thumnailsLocation ?? '',
          duration: currentDownload.duration ?? 60,
          isCreateFolder: false,
          tags: currentDownload.tags,
          category: currentDownload.category,
        });
        deleteDownloading(downloadId);
        depsRef.current.setSelectedRowIds([]);
        depsRef.current.setSelectedDownloads([]);
        toast({
          variant: 'success',
          title: tRef.current('statusHandler.downloadResumed'),
          description: tRef.current('statusHandler.downloadResumedDesc'),
          duration: 5000,
        });
      } else if (
        currentDownload &&
        (currentDownload as { controllerId?: string }).controllerId &&
        (currentDownload as { controllerId?: string }).controllerId !== '---'
      ) {
        const controllerId = (currentDownload as { controllerId?: string })
          .controllerId;
        try {
          // Block Resume until the process actually exits: 'pausing' has no
          // Resume option in the UI, so a second process can't start writing
          // the same output file while the first is still alive.
          updateDownloadStatus(downloadId, 'pausing');
          const killed = await window.ytdlp.killController(controllerId ?? '');
          if (killed) {
            updateDownloadStatus(downloadId, 'paused');
            toast({
              variant: 'success',
              title: tRef.current('statusHandler.downloadPaused'),
              description: tRef.current('statusHandler.downloadPausedDesc'),
              duration: 5000,
            });
          } else {
            updateDownloadStatus(downloadId, 'downloading');
            toast({
              variant: 'destructive',
              title: tRef.current('statusHandler.pauseFailed'),
              description: tRef.current('statusHandler.pauseFailedDesc'),
              duration: 5000,
            });
          }
        } catch (error) {
          updateDownloadStatus(downloadId, 'downloading');
          toast({
            variant: 'destructive',
            title: tRef.current('statusHandler.error'),
            description: tRef.current('statusHandler.pauseError'),
            duration: 5000,
          });
          console.error('Error in pause:', error);
        }
      } else if (currentDownload) {
        toast({
          variant: 'destructive',
          title: tRef.current('statusHandler.cannotPauseYet'),
          description: tRef.current('statusHandler.cannotPauseYetDesc'),
          duration: 5000,
        });
      }

      closeContextMenu(setContextMenu);
    },
    [],
  );

  const handleViewFile = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature matches callback from context menu
    async (downloadLocation?: string, _downloadId?: string) => {
      const { setContextMenu } = depsRef.current;
      if (!downloadLocation) {
        toast({
          variant: 'destructive',
          title: tRef.current('statusHandler.noDownloadLocation'),
          description: tRef.current('statusHandler.invalidDownloadLocation'),
          duration: 5000,
        });
        closeContextMenu(setContextMenu);
        return;
      }

      try {
        const exists = await window.downlodrFunctions.fileExists(
          downloadLocation,
        );
        if (exists) {
          window.downlodrFunctions.openVideo(downloadLocation);
        } else {
          toast({
            variant: 'destructive',
            title: tRef.current('statusHandler.noDownloadLocation'),
            description: tRef.current('statusHandler.invalidDownloadLocation'),
            duration: 5000,
          });
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: tRef.current('statusHandler.error'),
          description:
            (error as Error)?.message ??
            String(error) ??
            tRef.current('statusHandler.failedToViewDownload'),
          duration: 5000,
        });
      }
      closeContextMenu(setContextMenu);
    },
    [],
  );

  const handleViewDownload = useCallback(
    async (downloadLocation?: string, downloadId?: string) => {
      const { allDownloads, setContextMenu, handleFileNotExistModal } =
        depsRef.current;

      if (!downloadLocation) {
        toast({
          variant: 'destructive',
          title: tRef.current('statusHandler.noDownloadLocation'),
          description: tRef.current('statusHandler.invalidDownloadLocation'),
          duration: 5000,
        });
        closeContextMenu(setContextMenu);
        return;
      }

      const download = downloadId
        ? allDownloads.find((d) => d.id === downloadId)
        : undefined;

      try {
        const fullDownloadLocation =
          await window.downlodrFunctions.joinDownloadPath(
            downloadLocation,
            download?.name ?? '',
          );
        const exists = await window.downlodrFunctions.fileExists(
          fullDownloadLocation,
        );
        if (exists) {
          window.downlodrFunctions.openVideo(fullDownloadLocation);
        } else if (download) {
          handleFileNotExistModal(toDownloadItem(download));
        } else {
          toast({
            variant: 'destructive',
            title: tRef.current('statusHandler.fileNotFound'),
            description: tRef.current('statusHandler.fileNotFoundDesc'),
            duration: 5000,
          });
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: tRef.current('statusHandler.error'),
          description:
            (error as Error)?.message ??
            String(error) ??
            tRef.current('statusHandler.failedToViewDownload'),
          duration: 5000,
        });
      }
      closeContextMenu(setContextMenu);
    },
    [],
  );

  /* eslint-disable @typescript-eslint/no-unused-vars -- signatures match context menu callbacks */
  const handleStop = useCallback(
    async (
      downloadId: string,
      _downloadLocation?: string | undefined,
      _controllerId?: string | undefined,
    ) => {
      const { setSelectedRowIds, setSelectedDownloads, setContextMenu } =
        depsRef.current;
      const {
        downloading,
        deleteDownloading,
        forDownloads,
        removeFromForDownloads,
        processQueue,
      } = useDownloadStore.getState();
      const currentDownload = downloading.find((d) => d.id === downloadId);
      const currentForDownload = forDownloads.find((d) => d.id === downloadId);

      if (currentDownload?.status === 'paused') {
        // Stop discards the record outright, so unlike Pause there is no
        // Resume left to reuse the folder — it only holds `.part` files now.
        await deletePerDownloadFolder(currentDownload);
        deleteDownloading(downloadId);
        toast({
          variant: 'success',
          title: tRef.current('toolbar.toast.downloadStoppedTitle'),
          description: tRef.current('toolbar.toast.downloadStoppedDesc'),
          duration: 5000,
        });
      } else if (currentForDownload?.status === 'to download') {
        // Usually a no-op (the controller hasn't made a folder yet), but a
        // retried download is re-queued with `location` already pointing at
        // the folder its first attempt created.
        await deletePerDownloadFolder(currentForDownload);
        removeFromForDownloads(downloadId);
        toast({
          variant: 'success',
          title: tRef.current('toolbar.toast.downloadStoppedTitle'),
          description: tRef.current('toolbar.toast.downloadStoppedDesc'),
          duration: 5000,
        });
        processQueue();
      } else if (currentDownload) {
        const cid = (currentDownload as { controllerId?: string }).controllerId;
        if (cid && cid !== '---') {
          window.ytdlp
            .killController(cid)
            .then(async (result: unknown) => {
              if (result) {
                // Only after the kill resolves: trashing the folder while
                // yt-dlp still holds a handle fails on Windows.
                await deletePerDownloadFolder(currentDownload);
                deleteDownloading(currentDownload.id);
                toast({
                  variant: 'success',
                  title: tRef.current('toolbar.toast.downloadStoppedTitle'),
                  description: tRef.current(
                    'toolbar.toast.downloadStoppedDesc',
                  ),
                  duration: 5000,
                });
                processQueue();
              } else {
                // killController returns false only when the controller ID
                // no longer resolves to a running process — which the
                // gracefulKill/SIGKILL fallback guarantees means the process
                // already exited on its own (finished/failed) before we
                // could kill it, not that the kill itself failed. Re-check
                // the live state before showing an error for what's usually
                // already resolved.
                const fresh = useDownloadStore
                  .getState()
                  .downloading.find((d) => d.id === downloadId);
                if (
                  !fresh ||
                  fresh.status === 'finished' ||
                  fresh.status === 'failed'
                ) {
                  processQueue();
                  return;
                }
                toast({
                  variant: 'destructive',
                  title: tRef.current('statusHandler.stopFailed'),
                  description: tRef.current('statusHandler.stopFailedDesc'),
                  duration: 5000,
                });
              }
            })
            .catch(() => {
              toast({
                variant: 'destructive',
                title: tRef.current('statusHandler.error'),
                description: tRef.current('statusHandler.failedToStopDownload'),
                duration: 5000,
              });
            });
        } else {
          toast({
            variant: 'destructive',
            title: tRef.current('statusHandler.cannotStopYet'),
            description: tRef.current('statusHandler.cannotStopYetDesc'),
            duration: 5000,
          });
        }
      }
      setSelectedRowIds([]);
      setSelectedDownloads([]);
      closeContextMenu(setContextMenu);
    },
    [],
  );

  // Live-recording "finish" button. Unlike handleStop (kill + remove from
  // the list), this sends the same graceful CTRL_C kill but leaves the
  // download entry alone — the process exiting cleanly (exit code 0)
  // drives the normal 'completion' flow in lifecycleActions.updateDownload,
  // which marks the download 'finished' so it stays in the log like any
  // other completed download instead of disappearing.
  const handleFinishRecording = useCallback((downloadId: string) => {
    const { downloading } = useDownloadStore.getState();
    const currentDownload = downloading.find((d) => d.id === downloadId);
    const cid = (currentDownload as { controllerId?: string } | undefined)
      ?.controllerId;
    if (!cid) return;

    useDownloadStore.setState((state) => ({
      downloading: state.downloading.map((d) =>
        d.id === downloadId ? { ...d, isFinishingRecording: true } : d,
      ),
    }));
    toast({
      title: tRef.current('statusHandler.savingLivestream'),
      description: tRef.current('statusHandler.savingLivestreamDesc'),
      duration: 5000,
    });

    window.ytdlp.killController(cid).catch(() => {
      useDownloadStore.setState((state) => ({
        downloading: state.downloading.map((d) =>
          d.id === downloadId ? { ...d, isFinishingRecording: false } : d,
        ),
      }));
      toast({
        variant: 'destructive',
        title: tRef.current('statusHandler.error'),
        description: tRef.current('statusHandler.failedToStopDownload'),
        duration: 5000,
      });
    });
  }, []);

  const handleForceStart = useCallback(
    (
      _downloadId: string,
      _downloadLocation?: string,
      _controllerId?: string,
    ) => {
      closeContextMenu(depsRef.current.setContextMenu);
    },
    [],
  );
  /* eslint-enable @typescript-eslint/no-unused-vars */

  const handleRemove = useCallback(
    async (
      downloadLocation?: string,
      downloadId?: string,
      controllerId?: string,
      deleteFolder?: boolean,
    ) => {
      const {
        allDownloads,
        setContextMenu,
        setSelectedRowIds,
        setSelectedDownloads,
      } = depsRef.current;

      if (!downloadLocation || !downloadId) return;

      const download = allDownloads.find((d) => d.id === downloadId);
      if (!download) return;

      // Article downloads live in articleDownloadStore, not downloadStore.
      if ((download as { type?: string }).type === 'article') {
        const filePath = download.location;
        if (filePath) {
          // Best-effort file delete; ignore errors (file may not exist yet).
          try {
            await window.downlodrFunctions.deleteFile(filePath);
          } catch {
            /* ignore */
          }
        }
        removeArticleDownload(downloadId);
        setSelectedRowIds([]);
        setSelectedDownloads([]);
        closeContextMenu(setContextMenu);
        return;
      }

      const { processQueue, queuedDownloads, removeFromQueue } =
        useDownloadStore.getState();

      if (download.status === 'to download') {
        deleteDownload(downloadId);
        setSelectedRowIds([]);
        setSelectedDownloads([]);
        toast({
          variant: 'success',
          title: tRef.current('toolbar.toast.downloadDeletedTitle'),
          description: tRef.current('toolbar.toast.downloadDeletedDesc'),
          duration: 5000,
        });
        processQueue();
        closeContextMenu(setContextMenu);
        return;
      }

      // Queued downloads haven't produced a file yet — just drop them from
      // the queue instead of falling into the filesystem check below.
      if (queuedDownloads.some((d) => d.id === downloadId)) {
        removeFromQueue(downloadId);
        setSelectedRowIds([]);
        setSelectedDownloads([]);
        toast({
          variant: 'success',
          title: tRef.current('toolbar.toast.downloadRemovedTitle'),
          description: tRef.current('toolbar.toast.queuedRemovedDesc'),
          duration: 5000,
        });
        closeContextMenu(setContextMenu);
        return;
      }

      if (
        download.status === 'cancelled' ||
        download.status === 'paused' ||
        download.status === 'initializing' ||
        download.status === 'failed'
      ) {
        const descKey =
          download.status === 'cancelled'
            ? 'toolbar.toast.cancelledRemovedDesc'
            : download.status === 'paused'
            ? 'toolbar.toast.pausedRemovedDesc'
            : download.status === 'initializing'
            ? 'toolbar.toast.initializingRemovedDesc'
            : 'toolbar.toast.failedRemovedDesc';
        // The download never finished, so its own folder only holds partial
        // files — remove it whether or not "also delete folder" was ticked.
        await deletePerDownloadFolder(download);
        deleteDownload(downloadId);
        setSelectedRowIds([]);
        setSelectedDownloads([]);
        toast({
          variant: 'success',
          title: tRef.current('toolbar.toast.downloadRemovedTitle'),
          description: tRef.current(descKey),
          duration: 5000,
        });
        processQueue();
        closeContextMenu(setContextMenu);
        return;
      }

      if (download.status === 'downloading' && controllerId) {
        try {
          const success = await window.ytdlp.killController(controllerId);
          if (!success) {
            toast({
              variant: 'destructive',
              title: tRef.current('toolbar.toast.stopErrorTitle'),
              description: tRef.current('toolbar.toast.stopErrorCouldNotDesc', {
                controllerId,
              }),
              duration: 5000,
            });
            return;
          }
          processQueue();
        } catch (error) {
          toast({
            variant: 'destructive',
            title: tRef.current('toolbar.toast.stopErrorTitle'),
            description: tRef.current('toolbar.toast.stopErrorDesc', {
              controllerId,
            }),
            duration: 5000,
          });
          return;
        }
      }

      try {
        const fileName = download.downloadName || download.name;
        const fullFilePath = fileName
          ? await window.downlodrFunctions.joinDownloadPath(
              downloadLocation,
              fileName,
            )
          : downloadLocation;

        // "Also delete folder" only ever removes the folder this download
        // owns. `downloadLocation` is the directory the file sits in, which is
        // not the same thing — for a plugin's output it is a shared
        // FormatConverter/ folder holding every conversion of one video. When
        // the guard declines, fall through to deleting just the file.
        if (
          deleteFolder &&
          isPerDownloadFolder(downloadLocation, download.name)
        ) {
          const folderExists = await window.downlodrFunctions.fileExists(
            downloadLocation,
          );
          if (!folderExists) {
            deleteDownload(downloadId);
            setSelectedRowIds([]);
            setSelectedDownloads([]);
            toast({
              variant: 'success',
              title: tRef.current('toolbar.toast.downloadDeletedTitle'),
              description: tRef.current('toolbar.toast.downloadDeletedDesc'),
              duration: 5000,
            });
            closeContextMenu(setContextMenu);
            return;
          }
          const success = await window.downlodrFunctions.deleteFolder(
            downloadLocation,
          );
          if (success) {
            deleteDownload(downloadId);
            setSelectedRowIds([]);
            setSelectedDownloads([]);
            toast({
              variant: 'success',
              title: tRef.current('toolbar.toast.folderDeletedTitle'),
              description: tRef.current('toolbar.toast.folderDeletedDesc'),
              duration: 5000,
            });
          } else {
            toast({
              variant: 'destructive',
              title: tRef.current('statusHandler.error'),
              description: tRef.current('toolbar.toast.folderDeleteErrorDesc'),
              duration: 5000,
            });
          }
        } else {
          // A download stopped mid-flight has no final file yet, only
          // yt-dlp's `.part` files inside the folder it owns — so drop the
          // whole folder instead of deleting a filename that isn't there.
          if (download.status !== 'finished') {
            const folderRemoved = await deletePerDownloadFolder(download);
            if (folderRemoved) {
              deleteDownload(downloadId);
              setSelectedRowIds([]);
              setSelectedDownloads([]);
              toast({
                variant: 'success',
                title: tRef.current('toolbar.toast.folderDeletedTitle'),
                description: tRef.current('toolbar.toast.folderDeletedDesc'),
                duration: 5000,
              });
              closeContextMenu(setContextMenu);
              return;
            }
          }

          const success = await window.downlodrFunctions.deleteFile(
            fullFilePath,
          );
          // Whether or not the file itself was on disk, the user asked to
          // delete this download, so the log always goes away.
          deleteDownload(downloadId);
          setSelectedRowIds([]);
          setSelectedDownloads([]);
          toast({
            variant: 'success',
            title: success
              ? tRef.current('toolbar.toast.fileDeletedTitle')
              : tRef.current('toolbar.toast.downloadDeletedTitle'),
            description: success
              ? tRef.current('toolbar.toast.fileDeletedDesc')
              : tRef.current('toolbar.toast.downloadDeletedDesc'),
            duration: 5000,
          });
        }
      } catch {
        deleteDownload(downloadId);
        setSelectedRowIds([]);
        setSelectedDownloads([]);
        toast({
          variant: 'success',
          title: tRef.current('toolbar.toast.downloadDeletedTitle'),
          description: tRef.current('toolbar.toast.downloadDeletedDesc'),
          duration: 5000,
        });
      }
      closeContextMenu(setContextMenu);
    },
    [deleteDownload, removeArticleDownload],
  );

  const handleViewFolder = useCallback(
    async (downloadLocation?: string, filePath?: string) => {
      const { allDownloads, setContextMenu, handleFileNotExistModal } =
        depsRef.current;
      if (!downloadLocation) {
        toast({
          variant: 'destructive',
          title: tRef.current('statusHandler.error'),
          description: tRef.current('statusHandler.failedToViewFolder'),
          duration: 5000,
        });
        closeContextMenu(setContextMenu);
        return;
      }

      const download = allDownloads.find(
        (d) => d.location === downloadLocation && d.name === filePath,
      );

      const openFolderWithFallback = async (
        folderPath: string,
        filePathArg?: string | null,
      ) => {
        if (filePathArg) {
          const fileExists = await window.downlodrFunctions.fileExists(
            filePathArg,
          );
          if (fileExists) {
            const success = await window.downlodrFunctions.openFolder(
              folderPath,
              filePathArg,
            );
            if (success) return;
          }
        }
        const folderExists = await window.downlodrFunctions.fileExists(
          folderPath,
        );
        if (folderExists) {
          const success = await window.downlodrFunctions.openFolder(
            folderPath,
            null,
          );
          if (!success) throw new Error('Failed to open folder');
        } else if (download) {
          handleFileNotExistModal(toDownloadItem(download));
        } else {
          toast({
            variant: 'destructive',
            title: tRef.current('statusHandler.missingFolder'),
            description: tRef.current('statusHandler.missingFolderDesc'),
            duration: 5000,
          });
        }
      };

      try {
        if (downloadLocation.includes(',') && !filePath) {
          const [folderPath, filePathFromString] = downloadLocation.split(',');
          await openFolderWithFallback(folderPath, filePathFromString);
        } else {
          const fullPath = filePath
            ? await window.downlodrFunctions.joinDownloadPath(
                downloadLocation,
                filePath,
              )
            : null;
          await openFolderWithFallback(downloadLocation, fullPath);
        }
      } catch (error) {
        console.error('Error in handleViewFolder:', error);
        toast({
          variant: 'destructive',
          title: tRef.current('statusHandler.error'),
          description: tRef.current('statusHandler.failedToViewFolder'),
          duration: 5000,
        });
      }
      closeContextMenu(setContextMenu);
    },
    [],
  );

  return {
    handleRedownloadTranscript,
    handleContextMenu,
    handleShowLog,
    handleShowActivityTracker,
    handleRetry,
    handlePause,
    handleViewFile,
    handleViewDownload,
    handleStop,
    handleFinishRecording,
    handleForceStart,
    handleRemove,
    handleViewFolder,
  };
}
