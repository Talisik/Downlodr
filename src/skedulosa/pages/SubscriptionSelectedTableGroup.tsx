/* eslint-disable @typescript-eslint/no-empty-function */
import { Play, Stop } from '@/assets/icon';
import { Button } from '@/core-app/components/shadcn/components/ui/button';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
import { useSettingStore } from '@/core-app/store/settingsStore';
import TaskbarInputField from '@/downlodr/components/base/InputField/TaskbarInputField';
import DownloadContextMenu from '@/downlodr/components/contextMenu/DownloadContextMenu';
import SidePanels from '@/downlodr/components/panels/SidePanels';
import { useSidePanels } from '@/downlodr/hooks/useSidePanels';
import BulkTranscriptModal from '@/downlodr/components/modal/custom/BulkTranscriptModal';
import RemoveModal from '@/downlodr/components/modal/custom/RemoveModal';
import RenameModal from '@/downlodr/components/modal/custom/RenameModal';
import StopModal from '@/downlodr/components/modal/custom/StopModal';
import VideoPlayerPanel from '@/downlodr/components/panel/VideoPlayerPanel';
import { useWindowSize } from '@/downlodr/pages/status/statusPageHooks';
import { StatusPageTableHeader } from '@/downlodr/pages/status/StatusPageTableHeader';
import { StatusPageTableRow } from '@/downlodr/pages/status/StatusPageTableRow';
import type {
  DisplayColumn,
  SearchableDownload,
} from '@/downlodr/pages/status/statusPageTypes';
import {
  formatRelativeTime,
  sortDownloadsByColumn,
} from '@/downlodr/pages/status/statusPageUtils';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import { enqueueTranscript } from '@/downlodr/utils/transcription/transcriptQueue';
import { usePluginStore } from '@/plugins/store/pluginStore';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FaRegClosedCaptioning } from 'react-icons/fa';
import { FaArrowLeft } from 'react-icons/fa6';
import { LuChevronLeft, LuChevronRight, LuTrash } from 'react-icons/lu';
import { useNavigate, useParams } from 'react-router-dom';

const COLUMNS: DisplayColumn[] = [
  {
    id: 'name',
    width: Math.max(Math.floor(window.innerWidth * 0.3), 200),
    minWidth: 200,
  },
  { id: 'status', width: 100, minWidth: 100 },
  { id: 'format', width: 90, minWidth: 90 },
  { id: 'size', width: 70, minWidth: 70 },
  { id: 'speed', width: 70, minWidth: 70 },
  { id: 'transcript', width: 40, minWidth: 40 },
  { id: 'dateAdded', width: 100, minWidth: 100 },
  { id: 'uploadedOn', width: 100, minWidth: 100 },
  { id: 'action', width: 60, minWidth: 60 },
];

const SubscriptionSelectedTableGroup: React.FC = () => {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const navigate = useNavigate();

  const subscription = useSkedulosaStore((s) =>
    s.subscriptions.find((sub) => sub.id === subscriptionId),
  );

  const forDownloads = useDownloadStore((s) => s.forDownloads);
  const downloading = useDownloadStore((s) => s.downloading);
  const finishedDownloads = useDownloadStore((s) => s.finishedDownloads);
  const history = useDownloadStore((s) => s.historyDownloads);
  const queuedDownloads = useDownloadStore((s) => s.queuedDownloads);
  const availableTags = useDownloadStore((s) => s.availableTags);
  const availableCategories = useDownloadStore((s) => s.availableCategories);
  const addTag = useDownloadStore((s) => s.addTag);
  const removeTag = useDownloadStore((s) => s.removeTag);
  const addCategory = useDownloadStore((s) => s.addCategory);
  const removeCategory = useDownloadStore((s) => s.removeCategory);
  const renameDownload = useDownloadStore((s) => s.renameDownload);

  const selectedRowIds = useSelectedDownloadStore((s) => s.selectedRowIds);
  const setSelectedRowIds = useSelectedDownloadStore(
    (s) => s.setSelectedRowIds,
  );
  const setSelectedDownloads = useSelectedDownloadStore(
    (s) => s.setSelectedDownloads,
  );
  const [selectedDownloadId, setSelectedDownloadId] = useState<string | null>(
    null,
  );

  const { settings } = useSettingStore();
  const searchState = useTaskbarDownloadStore((s) => s.searchState);

  const [sortColumn, setSortColumn] = useState('dateAdded');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSortClick = useCallback(
    (columnId: string) => {
      if (columnId === sortColumn) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortColumn(columnId);
        setSortDirection('desc');
      }
    },
    [sortColumn],
  );
  const { windowHeight } = useWindowSize();
  const PAGE_SIZE = windowHeight >= 1000 ? 20 : windowHeight >= 800 ? 15 : 10;
  const [currentPage, setCurrentPage] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Bulk action modals
  const [showBulkRemoveModal, setShowBulkRemoveModal] = useState(false);
  const [showBulkTranscriptConfirmation, setShowBulkTranscriptConfirmation] =
    useState(false);
  const [showStopConfirmation, setShowStopConfirmation] = useState(false);
  const [stopAction, setStopAction] = useState<
    'selected' | 'all' | 'single' | null
  >(null);
  const [singleStopTarget, setSingleStopTarget] = useState<{
    downloadId: string;
    location?: string;
    controllerId?: string;
  } | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    downloadId: string | null;
    x: number;
    y: number;
  }>({ downloadId: null, x: 0, y: 0 });
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Rename modal
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameDownloadId, setRenameDownloadId] = useState('');
  const [renameCurrentName, setRenameCurrentName] = useState('');

  // Per-item remove modal (from context menu)
  const [showContextRemoveModal, setShowContextRemoveModal] = useState(false);
  const [contextRemoveTarget, setContextRemoveTarget] = useState<{
    downloadId: string;
    location?: string;
    controllerId?: string;
  } | null>(null);

  // Video player panel
  const [videoPlayerState, setVideoPlayerState] = useState<{
    isOpen: boolean;
    download: SearchableDownload | null;
  }>({ isOpen: false, download: null });
  const [panelWidth, setPanelWidth] = useState(75);

  const downloads = useMemo((): SearchableDownload[] => {
    const seenIds = new Set<string>();
    return [
      ...forDownloads,
      ...downloading,
      ...finishedDownloads,
      ...history,
      ...queuedDownloads,
    ].filter((d) => {
      if (d.subscriptionId !== subscriptionId) return false;
      if (seenIds.has(d.id)) return false;
      seenIds.add(d.id);
      return true;
    });
  }, [
    forDownloads,
    downloading,
    finishedDownloads,
    history,
    queuedDownloads,
    subscriptionId,
  ]);

  const hasForDownloadStatus = selectedRowIds.some(
    (id) => downloads.find((d) => d.id === id)?.status === 'to download',
  );

  const hasActiveDownloadStatus = selectedRowIds.some((id) =>
    downloading.some(
      (d) =>
        d.id === id &&
        (d.status === 'downloading' ||
          d.status === 'initializing' ||
          d.status === 'paused'),
    ),
  );

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

  const eligibleSelectedDownloads = useMemo(
    () =>
      selectedRowIds
        .map((id) => finishedDownloads.find((fd) => fd.id === id))
        .filter(
          (fd): fd is (typeof finishedDownloads)[0] =>
            fd !== undefined &&
            fd.status === 'finished' &&
            fd.transcriptionStatus !== 'transcribing' &&
            fd.transcriptionStatus !== 'queued' &&
            isTranscriptMissing(fd.transcriptLocation, fd.autoCaptionLocation),
        ),
    [selectedRowIds, finishedDownloads],
  );

  const filteredDownloads = useMemo(() => {
    const base =
      !searchState.isSearchActive || !searchState.searchQuery.trim()
        ? downloads
        : (() => {
            const query = searchState.searchQuery.toLowerCase();
            return downloads.filter(
              (d) =>
                d.name?.toLowerCase().includes(query) ||
                d.displayName?.toLowerCase().includes(query) ||
                d.channelName?.toLowerCase().includes(query) ||
                d.extractorKey?.toLowerCase().includes(query) ||
                d.status?.toLowerCase().includes(query) ||
                d.tags?.some((t) => t.toLowerCase().includes(query)) ||
                d.category?.some((c) => c.toLowerCase().includes(query)),
            );
          })();
    return sortDownloadsByColumn(base, sortColumn, sortDirection);
  }, [
    downloads,
    searchState.isSearchActive,
    searchState.searchQuery,
    sortColumn,
    sortDirection,
  ]);

  useEffect(() => {
    setCurrentPage(0);
  }, [filteredDownloads.length, PAGE_SIZE]);

  const totalPages = Math.ceil(filteredDownloads.length / PAGE_SIZE);
  const pageStart = currentPage * PAGE_SIZE + 1;
  const pageEnd = Math.min(
    (currentPage + 1) * PAGE_SIZE,
    filteredDownloads.length,
  );
  const pageDownloads = filteredDownloads.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const sourceName = subscription?.source ?? subscriptionId ?? '';
  const avatarUrl = subscription?.channel_details?.avatarUrl;

  const handleCheckboxChange = (id: string) => {
    setSelectedRowIds(
      selectedRowIds.includes(id)
        ? selectedRowIds.filter((r) => r !== id)
        : [...selectedRowIds, id],
    );
  };

  const handleSelectPage = (pageIds: string[], allPageSelected: boolean) => {
    if (allPageSelected) {
      setSelectedRowIds(selectedRowIds.filter((id) => !pageIds.includes(id)));
    } else {
      const existing = new Set(selectedRowIds);
      pageIds.forEach((id) => existing.add(id));
      setSelectedRowIds(Array.from(existing));
    }
  };

  // ── Context menu ────────────────────────────────────────────────────────────

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, download: SearchableDownload) => {
      e.preventDefault();
      const x = e.clientX;
      const y = e.clientY;

      if (contextMenu.downloadId !== null) {
        setContextMenu({ downloadId: null, x: 0, y: 0 });
        transitionTimeoutRef.current = setTimeout(() => {
          setContextMenu({ downloadId: download.id, x, y });
          transitionTimeoutRef.current = null;
        }, 120);
      } else {
        setContextMenu({ downloadId: download.id, x, y });
      }
      setSelectedDownloadId(download.id);
    },
    [contextMenu.downloadId],
  );

  const handleCloseContextMenu = useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    setContextMenu({ downloadId: null, x: 0, y: 0 });
    setSelectedDownloadId(null);
  }, []);

  const handleRetry = useCallback(
    (downloadId: string) => {
      const download = downloads.find((d) => d.id === downloadId);
      if (!download) return;
      const { retryDownload, deleteDownload } = useDownloadStore.getState();
      retryDownload({
        videoUrl: download.videoUrl ?? '',
        name: download.name,
        downloadName: download.downloadName,
        displayName: download.displayName ?? '',
        size: download.size,
        speed: download.speed,
        channelName: download.channelName ?? '',
        timeLeft: download.timeLeft ?? '',
        DateAdded: new Date().toISOString(),
        uploadDate: download.uploadDate,
        progress: 0,
        location: download.location ?? '',
        status: 'downloading',
        ext: download.ext,
        formatId: download.formatId,
        audioExt: download.audioExt,
        audioFormatId: download.audioFormatId,
        extractorKey: download.extractorKey,
        limitRate: '',
        automaticCaption: download.automaticCaption,
        thumbnails: download.thumbnails ?? null,
        getTranscript: download.getTranscript ?? false,
        getThumbnail: download.getThumbnail ?? false,
        duration: download.duration ?? 60,
        thumnailsLocation: download.thumnailsLocation ?? '',
        autoCaptionLocation: download.autoCaptionLocation ?? '',
        isCreateFolder: false,
        tags: download.tags,
        category: download.category,
      });
      deleteDownload(downloadId);
      setSelectedRowIds([]);
      setSelectedDownloads([]);
      toast({ variant: 'success', title: 'Download retried', duration: 5000 });
    },
    [downloads, setSelectedRowIds, setSelectedDownloads],
  );

  const handlePause = useCallback(
    async (
      downloadId: string,
      _location?: string,
      _controllerId?: string,
      downloadStatus?: string,
    ) => {
      const { downloading, deleteDownloading, addQueue, updateDownloadStatus } =
        useDownloadStore.getState();
      const currentDownload = downloading.find((d) => d.id === downloadId);
      if (!currentDownload) return;

      if (downloadStatus === 'paused' || currentDownload.status === 'paused') {
        // Resume: re-queue the download
        addQueue({
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
          status: 'queued',
          ext: currentDownload.ext,
          formatId: currentDownload.formatId,
          audioExt: currentDownload.audioExt,
          audioFormatId: currentDownload.audioFormatId,
          extractorKey: currentDownload.extractorKey,
          limitRate:
            (currentDownload as { limitRate?: string }).limitRate ?? '',
          automaticCaption: currentDownload.automaticCaption,
          thumbnails: currentDownload.thumbnails ?? null,
          getTranscript: currentDownload.getTranscript ?? false,
          getThumbnail: currentDownload.getThumbnail ?? false,
          duration: currentDownload.duration ?? 60,
          isCreateFolder: false,
          subscriptionId: currentDownload.subscriptionId,
          tags: currentDownload.tags,
          category: currentDownload.category,
          isLive: currentDownload.isLive,
        });
        deleteDownloading(downloadId);
      } else if (currentDownload.controllerId) {
        // Pause active download
        const stopped = await window.ytdlp.killController(
          currentDownload.controllerId,
        );
        if (stopped) {
          updateDownloadStatus(downloadId, 'paused');
        }
      }
    },
    [],
  );

  const handleViewDownload = useCallback(
    async (location?: string, downloadId?: string) => {
      if (!location || !downloadId) return;
      const download = downloads.find((d) => d.id === downloadId);
      if (!download) return;
      try {
        const fullPath = await window.downlodrFunctions.joinDownloadPath(
          location,
          download.name,
        );
        const exists = await window.downlodrFunctions.fileExists(fullPath);
        if (exists) {
          window.downlodrFunctions.openVideo(fullPath);
        }
      } catch {
        /* ignore */
      }
    },
    [downloads],
  );

  const handleViewFile = useCallback(
    async (downloadLocation?: string, _downloadId?: string) => {
      if (!downloadLocation) {
        toast({
          variant: 'destructive',
          title: 'No download location',
          description: 'The transcript location could not be found.',
          duration: 5000,
        });
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
            title: 'No download location',
            description: 'The transcript location could not be found.',
            duration: 5000,
          });
        }
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const handleViewFolder = useCallback(
    async (location?: string, fileName?: string) => {
      if (!location) return;
      try {
        if (fileName) {
          const fullPath = await window.downlodrFunctions.joinDownloadPath(
            location,
            fileName,
          );
          const exists = await window.downlodrFunctions.fileExists(fullPath);
          if (exists) {
            await window.downlodrFunctions.openFolder(location, fullPath);
            return;
          }
        }
        const folderExists = await window.downlodrFunctions.fileExists(
          location,
        );
        if (folderExists) {
          await window.downlodrFunctions.openFolder(location, null);
        }
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const handleShowRemoveModal = useCallback(
    (downloadId: string, location?: string, controllerId?: string) => {
      setContextRemoveTarget({ downloadId, location, controllerId });
      setShowContextRemoveModal(true);
    },
    [],
  );

  const handleContextRemoveConfirm = useCallback(
    async (deleteFolder?: boolean) => {
      if (!contextRemoveTarget) return;
      const { downloadId, location, controllerId } = contextRemoveTarget;
      const {
        deleteDownload,
        deleteDownloading,
        processQueue,
        forDownloads: currentForDownloads,
        downloading: currentDownloading,
        queuedDownloads: currentQueued,
        removeFromQueue,
      } = useDownloadStore.getState();

      const download = downloads.find((d) => d.id === downloadId);

      const isPending = currentForDownloads.some((fd) => fd.id === downloadId);
      if (isPending) {
        deleteDownload(downloadId);
        processQueue();
        toast({
          variant: 'success',
          title: 'Download removed',
          duration: 5000,
        });
        setShowContextRemoveModal(false);
        setContextRemoveTarget(null);
        return;
      }

      const isQueued = currentQueued.some((q) => q.id === downloadId);
      if (isQueued) {
        removeFromQueue(downloadId);
        toast({
          variant: 'success',
          title: 'Download removed',
          duration: 5000,
        });
        setShowContextRemoveModal(false);
        setContextRemoveTarget(null);
        return;
      }

      const isActiveDownload = currentDownloading.some(
        (dl) => dl.id === downloadId,
      );
      if (isActiveDownload) {
        const current = currentDownloading.find((dl) => dl.id === downloadId);
        if (
          current?.status === 'cancelled' ||
          current?.status === 'paused' ||
          current?.status === 'initializing'
        ) {
          deleteDownloading(downloadId);
          processQueue();
        } else if (controllerId) {
          try {
            const stopped = await window.ytdlp.killController(controllerId);
            if (stopped) {
              deleteDownloading(downloadId);
              processQueue();
            }
          } catch {
            /* ignore */
          }
        }
        setShowContextRemoveModal(false);
        setContextRemoveTarget(null);
        return;
      }

      if (location && download) {
        try {
          if (deleteFolder) {
            const folderPath = location.substring(
              0,
              Math.max(location.lastIndexOf('/'), location.lastIndexOf('\\')),
            );
            await window.downlodrFunctions.deleteFolder(folderPath);
          } else {
            const fullPath = await window.downlodrFunctions.joinDownloadPath(
              location,
              download.name,
            );
            const exists = await window.downlodrFunctions.fileExists(fullPath);
            if (exists) {
              await window.downlodrFunctions.deleteFile(fullPath);
            }
          }
        } catch {
          /* ignore */
        }
      }
      deleteDownload(downloadId);
      toast({ variant: 'success', title: 'Download removed', duration: 5000 });
      setShowContextRemoveModal(false);
      setContextRemoveTarget(null);
    },
    [contextRemoveTarget, downloads],
  );

  const handleShowStopModal = useCallback(
    (downloadId: string, location?: string, controllerId?: string) => {
      setSingleStopTarget({ downloadId, location, controllerId });
      setStopAction('single');
      setShowStopConfirmation(true);
    },
    [],
  );

  const handleRename = useCallback(
    (downloadId: string, currentName: string) => {
      setRenameDownloadId(downloadId);
      setRenameCurrentName(currentName);
      setShowRenameModal(true);
    },
    [],
  );

  const performRename = useCallback(
    (newName: string) => {
      renameDownload(renameDownloadId, newName);
      setShowRenameModal(false);
      setRenameDownloadId('');
      setRenameCurrentName('');
    },
    [renameDownload, renameDownloadId],
  );

  const getCurrentTags = useCallback(
    (downloadId: string | null) => {
      if (!downloadId) return [];
      const download = downloads.find((d) => d.id === downloadId);
      return download?.tags ?? [];
    },
    [downloads],
  );

  const getCurrentCategories = useCallback(
    (downloadId: string | null) => {
      if (!downloadId) return [];
      const download = downloads.find((d) => d.id === downloadId);
      return download?.category ?? [];
    },
    [downloads],
  );

  // ── Bulk handlers ────────────────────────────────────────────────────────────

  const handleBulkRemove = useCallback(
    async (deleteFolder?: boolean) => {
      const toRemove = downloads.filter((d) => selectedRowIds.includes(d.id));
      setSelectedRowIds([]);

      const {
        deleteDownload,
        deleteDownloading,
        processQueue,
        forDownloads,
        downloading,
        queuedDownloads,
        removeFromQueue,
      } = useDownloadStore.getState();

      for (const d of toRemove) {
        if (!d.id) continue;

        const isPending = forDownloads.some((fd) => fd.id === d.id);
        if (isPending) {
          deleteDownload(d.id);
          toast({
            variant: 'success',
            title: 'Download removed',
            description: 'Pending download removed.',
            duration: 5000,
          });
          continue;
        }

        if (d.status === 'failed') {
          deleteDownload(d.id);
          processQueue();
          toast({
            variant: 'success',
            title: 'Download removed',
            description: 'Failed download removed.',
            duration: 5000,
          });
          continue;
        }

        const isQueued = queuedDownloads.some((q) => q.id === d.id);
        if (isQueued) {
          removeFromQueue(d.id);
          toast({
            variant: 'success',
            title: 'Download removed',
            description: 'Queued download removed.',
            duration: 5000,
          });
          continue;
        }

        const isDownloading = downloading.some((dl) => dl.id === d.id);
        if (isDownloading) {
          const current = downloading.find((dl) => dl.id === d.id);
          if (
            current?.status === 'cancelled' ||
            current?.status === 'paused' ||
            current?.status === 'initializing'
          ) {
            deleteDownloading(d.id);
            processQueue();
            continue;
          }
          if (d.controllerId) {
            try {
              const stopped = await window.ytdlp.killController(d.controllerId);
              if (stopped) {
                deleteDownloading(d.id);
                processQueue();
              }
            } catch {
              /* ignore */
            }
          }
          continue;
        }

        if (d.location) {
          try {
            if (deleteFolder) {
              const folderPath = d.location.substring(
                0,
                Math.max(
                  d.location.lastIndexOf('/'),
                  d.location.lastIndexOf('\\'),
                ),
              );
              await window.downlodrFunctions.deleteFolder(folderPath);
            } else {
              await window.downlodrFunctions.deleteFile(d.location);
            }
          } catch {
            /* ignore */
          }
        }
        deleteDownload(d.id);
        toast({
          variant: 'success',
          title: 'Download removed',
          description: 'Download removed successfully.',
          duration: 5000,
        });
      }
    },
    [downloads, selectedRowIds, setSelectedRowIds],
  );

  const handleBulkDownload = useCallback(() => {
    const { forDownloads, removeFromForDownloads, addQueue } =
      useDownloadStore.getState();

    const toQueue = downloads.filter(
      (d) =>
        selectedRowIds.includes(d.id) &&
        forDownloads.some((fd) => fd.id === d.id) &&
        d.status === 'to download',
    );

    if (toQueue.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No downloads to start',
        description: 'Select downloads with "to download" status.',
        duration: 5000,
      });
      return;
    }

    setSelectedRowIds([]);

    for (const d of toQueue) {
      const processedName = d.name.replace(/[\\/:*?"<>|]/g, '_');
      addQueue({
        subscriptionId: d.subscriptionId,
        videoUrl: d.videoUrl,
        name: `${processedName}.${d.ext}`,
        downloadName: `${processedName}.${d.ext}`,
        displayName: d.displayName ?? `${processedName}.${d.ext}`,
        size: d.size,
        speed: d.speed,
        channelName: d.channelName ?? '',
        timeLeft: d.timeLeft ?? '',
        DateAdded: new Date().toISOString(),
        uploadDate: d.uploadDate,
        progress: d.progress ?? 0,
        location: d.location ?? '',
        status: 'queued',
        ext: d.ext,
        formatId: (d as { formatId?: string }).formatId ?? '',
        audioExt: (d as { audioExt?: string }).audioExt ?? '',
        audioFormatId: (d as { audioFormatId?: string }).audioFormatId ?? '',
        extractorKey: d.extractorKey,
        limitRate:
          settings.defaultDownloadSpeed === 0
            ? ''
            : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
        automaticCaption: d.automaticCaption ?? null,
        thumbnails: d.thumbnails ?? null,
        getTranscript: d.getTranscript ?? false,
        getThumbnail: d.getThumbnail ?? false,
        duration: d.duration ?? 60,
        isCreateFolder: true,
        tags: d.tags,
        category: d.category,
        isLive: (d as { isLive?: boolean }).isLive,
      });
      removeFromForDownloads(d.id);
    }

    toast({
      title: 'Added to queue',
      description: `${toQueue.length} download${
        toQueue.length !== 1 ? 's' : ''
      } queued.`,
      duration: 5000,
    });
  }, [downloads, selectedRowIds, setSelectedRowIds, settings]);

  const handleStopSelected = useCallback(() => {
    if (selectedRowIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No downloads selected',
        description: 'Select a download to stop.',
        duration: 5000,
      });
      return;
    }
    setStopAction('selected');
    setShowStopConfirmation(true);
  }, [selectedRowIds]);

  const handleBatchTranscript = useCallback(() => {
    if (eligibleSelectedDownloads.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No eligible downloads',
        description:
          'Select finished downloads without an existing transcript.',
        duration: 5000,
      });
      return;
    }
    setShowBulkTranscriptConfirmation(true);
  }, [eligibleSelectedDownloads]);

  const runBatchTranscript = useCallback(() => {
    const downloadsToProcess = [...eligibleSelectedDownloads];
    setSelectedRowIds([]);

    for (const download of downloadsToProcess) {
      enqueueTranscript({
        downloadId: download.id,
        location: download.location,
        downloadName: download.downloadName,
      });
    }

    toast({
      title: 'Transcription started',
      description: `Generating transcripts for ${
        downloadsToProcess.length
      } download${downloadsToProcess.length !== 1 ? 's' : ''}.`,
      duration: 5000,
    });
  }, [eligibleSelectedDownloads, setSelectedRowIds]);

  const handleStopConfirm = useCallback(async () => {
    const {
      deleteDownloading,
      downloading: currentDownloading,
      forDownloads: currentForDownloads,
      removeFromForDownloads,
      processQueue,
    } = useDownloadStore.getState();

    if (stopAction === 'single' && singleStopTarget) {
      const { downloadId, controllerId } = singleStopTarget;
      const currentDownload = currentDownloading.find(
        (d) => d.id === downloadId,
      );
      const currentForDownload = currentForDownloads.find(
        (d) => d.id === downloadId,
      );

      if (currentDownload?.status === 'paused') {
        deleteDownloading(downloadId);
      } else if (currentForDownload?.status === 'to download') {
        removeFromForDownloads(downloadId);
      } else if (controllerId) {
        try {
          const success = await window.ytdlp.killController(controllerId);
          if (success) deleteDownloading(downloadId);
        } catch {
          /* ignore */
        }
      } else if (currentDownload?.controllerId) {
        try {
          const success = await window.ytdlp.killController(
            currentDownload.controllerId,
          );
          if (success) deleteDownloading(downloadId);
        } catch {
          /* ignore */
        }
      }
      processQueue();
    } else if (stopAction === 'selected') {
      const toStop = [...selectedRowIds];
      setSelectedRowIds([]);

      for (const id of toStop) {
        const currentDownload = currentDownloading.find((d) => d.id === id);
        const currentForDownload = currentForDownloads.find((d) => d.id === id);

        if (currentDownload?.status === 'paused') {
          deleteDownloading(id);
        } else if (currentForDownload?.status === 'to download') {
          removeFromForDownloads(id);
        } else if (currentDownload?.controllerId) {
          try {
            const success = await window.ytdlp.killController(
              currentDownload.controllerId,
            );
            if (success) deleteDownloading(id);
          } catch {
            /* ignore */
          }
        }
      }
      processQueue();
    } else if (stopAction === 'all') {
      const subscriptionDownloadIds = new Set(downloads.map((d) => d.id));

      currentForDownloads
        .filter(
          (d) =>
            subscriptionDownloadIds.has(d.id) && d.status === 'to download',
        )
        .forEach((d) => removeFromForDownloads(d.id));

      for (const dl of currentDownloading.filter((d) =>
        subscriptionDownloadIds.has(d.id),
      )) {
        if (dl.status === 'paused') {
          deleteDownloading(dl.id);
        } else if (dl.controllerId) {
          try {
            const success = await window.ytdlp.killController(dl.controllerId);
            if (success) deleteDownloading(dl.id);
          } catch {
            /* ignore */
          }
        }
      }
      processQueue();
    }

    setShowStopConfirmation(false);
    setStopAction(null);
    setSingleStopTarget(null);
  }, [
    stopAction,
    selectedRowIds,
    setSelectedRowIds,
    downloads,
    singleStopTarget,
  ]);

  // ── Active context menu download ─────────────────────────────────────────────

  const activeContextDownload = contextMenu.downloadId
    ? downloads.find((d) => d.id === contextMenu.downloadId) ?? null
    : null;

  const sidePanels = useSidePanels();
  const isPluginSidebarOpen = usePluginStore(
    (s) => s.settingsPlugin.isOpenPluginSidebar,
  );
  const isSidePanelOpen =
    sidePanels.showActivityTracker ||
    sidePanels.showLogModal ||
    isPluginSidebarOpen ||
    videoPlayerState.isOpen;
  const displayColumns = isSidePanelOpen
    ? COLUMNS.filter((c) => c.id === 'name' || c.id === 'status')
    : COLUMNS;

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex flex-col overflow-hidden bg-white dark:bg-darkModeTable rounded-md gap-3 py-2 px-4 flex-1 min-w-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition-colors mr-2 border px-2 py-1 rounded text-gray-700 dark:text-gray-300 text-[11px] font-extrabold"
          >
            <span>
              <FaArrowLeft />
            </span>
            <span>Back</span>
          </button>
          <button
            onClick={() => navigate('/status/all')}
            className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors font-medium"
          >
            Downloads
          </button>
          <span>/</span>
          <button
            onClick={() =>
              navigate('/status/all', {
                state: { presetTypeFilter: 'subscriptions' },
              })
            }
            className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors font-medium"
          >
            Subscriptions
          </button>
          <span>/</span>
          <span className="text-gray-700 dark:text-gray-300 font-bold">
            {sourceName}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <TooltipWrapper
              content={
                hasForDownloadStatus
                  ? 'Start download'
                  : "No downloads with 'to download' status selected"
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
                  onClick={handleBulkDownload}
                  disabled={!hasForDownloadStatus}
                  icon={<Play />}
                />
              </div>
            </TooltipWrapper>
            <TooltipWrapper
              content={
                hasActiveDownloadStatus
                  ? 'Stop selected downloads'
                  : 'No active downloads selected'
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
            <TooltipWrapper
              content={
                eligibleSelectedDownloads.length > 0
                  ? 'Generate captions'
                  : 'Select finished downloads without a transcript'
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
            <TooltipWrapper content="Remove selected downloads" side="bottom">
              <Button
                variant="transparent"
                size="icon"
                className="text-[12px] text-white rounded-md h-6 flex items-center justify-center px-2 py-[2px] bg-[#FF4F45] hover:bg-red-200 dark:hover:bg-red-900/40"
                onClick={() => setShowBulkRemoveModal(true)}
                disabled={selectedRowIds.length === 0}
                icon={
                  <LuTrash size={13} className="text-white dark:text-white" />
                }
              >
                Delete
              </Button>
            </TooltipWrapper>
            <div className="mr-3 w-[550px] [&>div]:max-w-full">
              <TaskbarInputField />
            </div>
          </div>
        </div>
        <div className="flex flex-row overflow-hidden flex-1 min-w-0">
          <div className="flex flex-col overflow-hidden flex-1 min-w-0">
            <div className="flex items-center gap-4 pb-2 flex-shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={sourceName}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0" />
              )}
              <div className="flex flex-col gap-0.5">
                <div className="flex gap-1 items-center">
                  <span className="font-bold bg-primary text-white px-2 py-0.5 rounded text-[10.5px]">
                    Sub
                  </span>
                  <span className="font-extrabold text-gray-800 dark:text-gray-100 text-sm">
                    {sourceName}
                  </span>
                </div>
                <div className="flex gap-1.5 items-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {downloads.length} video
                    {downloads.length !== 1 ? 's' : ''}
                  </div>
                  <div className="font-extrabold text-gray-700 dark:text-gray-100 text-[8px]">
                    •
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Last checked:{' '}
                    {subscription?.last_checked_time
                      ? formatRelativeTime(subscription.last_checked_time)
                      : subscription?.date_created
                      ? formatRelativeTime(subscription.date_created)
                      : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

                  {/* Table + Pagination */}
                  <div className="flex-1 flex flex-col overflow-hidden min-w-0 border-t-2 dark:border-darkModeTableBorder">
                    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                      <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-auto min-w-0"
                      >
                        <table className="w-full">
                          <StatusPageTableHeader
                            displayColumns={displayColumns}
                            columns={displayColumns}
                            selectedRowIds={selectedRowIds}
                            pageRowIds={pageDownloads.map((d) => d.id)}
                            onClearSelection={() => setSelectedRowIds([])}
                            pageStart={pageStart}
                            pageEnd={pageEnd}
                            totalDownloads={filteredDownloads.length}
                            totalPages={totalPages}
                            sortColumn={sortColumn}
                            sortDirection={sortDirection}
                            dragging={null}
                            dragOverIndex={null}
                            onColumnHeaderContextMenu={() => {}}
                            onSelectAll={() =>
                              handleSelectPage(
                                pageDownloads.map((d) => d.id),
                                pageDownloads.every((d) =>
                                  selectedRowIds.includes(d.id),
                                ),
                              )
                            }
                            onSortClick={handleSortClick}
                            onResizeStart={() => {}}
                            startDragging={() => {}}
                            onDragOver={() => {}}
                            onDrop={() => {}}
                            cancelDrag={() => {}}
                          />
                          <tbody>
                            {pageDownloads.map((download, index) => (
                              <StatusPageTableRow
                                key={download.id}
                                download={download}
                                displayColumns={displayColumns}
                                thumbnailDataUrls={{}}
                                isChecked={selectedRowIds.includes(download.id)}
                                isSelectedDownload={
                                  selectedDownloadId === download.id
                                }
                                index={index}
                                handlers={{
                                  onContextMenu: (e) =>
                                    handleContextMenu(e, download),
                                  onRowClick: () =>
                                    setSelectedDownloadId(download.id),
                                  onCheckboxChange: () =>
                                    handleCheckboxChange(download.id),
                                  onViewFile: (location, downloadId) =>
                                    handleViewFile(location, downloadId),
                                  onViewDownload: (location, downloadId) =>
                                    handleViewDownload(location, downloadId),
                                  onViewFolder: (location, name) =>
                                    handleViewFolder(location, name),
                                  onRetry: () => {},
                                  onPause: () => {},
                                  onRedownloadTranscript: () => {},
                                  onFormatSelect: () => {},
                                  onViewEmbed: (d) =>
                                    setVideoPlayerState({
                                      isOpen: true,
                                      download: d,
                                    }),
                                }}
                              />
                            ))}
                            {filteredDownloads.length === 0 && (
                              <tr>
                                <td
                                  colSpan={displayColumns.length + 1}
                                  className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm"
                                >
                                  {searchState.isSearchActive &&
                                  searchState.searchQuery.trim()
                                    ? `No downloads matched "${searchState.searchQuery}"`
                                    : 'No downloads found'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {totalPages > 1 && (
                        <div className="flex-shrink-0 flex items-center justify-center gap-1 px-4 py-1.5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-darkModeTable">
                          <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 0}
                            className="p-1 rounded-md text-gray-500 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-darkModeTableBorder transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <LuChevronLeft size={14} />
                          </button>
                          <span className="text-xs text-gray-400 dark:text-gray-500 min-w-[80px] text-center">
                            Page {currentPage + 1} of {totalPages}
                          </span>
                          <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage >= totalPages - 1}
                            className="p-1 rounded-md text-gray-500 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-darkModeTableBorder transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <LuChevronRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

            {/* Modals */}
            <RemoveModal
              isOpen={showBulkRemoveModal}
              onClose={() => setShowBulkRemoveModal(false)}
              onConfirm={(deleteFolder) => {
                handleBulkRemove(deleteFolder);
                setShowBulkRemoveModal(false);
              }}
              allowFolderDeletion={true}
            />
            <RemoveModal
              isOpen={showContextRemoveModal}
              onClose={() => {
                setShowContextRemoveModal(false);
                setContextRemoveTarget(null);
              }}
              onConfirm={(deleteFolder) => {
                handleContextRemoveConfirm(deleteFolder);
              }}
              allowFolderDeletion={true}
            />
            <StopModal
              isOpen={showStopConfirmation}
              onClose={() => {
                setShowStopConfirmation(false);
                setStopAction(null);
                setSingleStopTarget(null);
              }}
              onConfirm={() => handleStopConfirm()}
            />
            <RenameModal
              isOpen={showRenameModal}
              onClose={() => {
                setShowRenameModal(false);
                setRenameDownloadId('');
                setRenameCurrentName('');
              }}
              onRename={performRename}
              currentName={renameCurrentName}
            />
            <BulkTranscriptModal
              isOpen={showBulkTranscriptConfirmation}
              onClose={() => setShowBulkTranscriptConfirmation(false)}
              onConfirm={runBatchTranscript}
              count={eligibleSelectedDownloads.length}
            />
          </div>
          <SidePanels {...sidePanels} />
          {/* Video player panel */}
          {videoPlayerState.isOpen && videoPlayerState.download && (
            <VideoPlayerPanel
              isOpen={true}
              onClose={() =>
                setVideoPlayerState({ isOpen: false, download: null })
              }
              videoUrl={videoPlayerState.download.videoUrl ?? ''}
              title={
                videoPlayerState.download.displayName ??
                videoPlayerState.download.name ??
                ''
              }
              autoCaptionLocation={
                videoPlayerState.download.autoCaptionLocation
              }
              transcriptLocation={videoPlayerState.download.transcriptLocation}
              displayName={videoPlayerState.download.displayName}
              dateAdded={videoPlayerState.download.DateAdded}
              location={videoPlayerState.download.location}
              tags={videoPlayerState.download.tags}
              category={videoPlayerState.download.category}
              status={videoPlayerState.download.status}
              downloadName={videoPlayerState.download.name}
              ext={videoPlayerState.download.ext}
              duration={videoPlayerState.download.duration}
              size={videoPlayerState.download.size}
              extractorKey={videoPlayerState.download.extractorKey}
              downloadId={videoPlayerState.download.id}
              width={panelWidth}
              onWidthChange={setPanelWidth}
            />
          )}
        </div>
      </div>

      {activeContextDownload && (
        <DownloadContextMenu
          download={activeContextDownload}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={handleCloseContextMenu}
          onPause={handlePause}
          onRetry={handleRetry}
          onShowLog={sidePanels.openLog}
          onShowActivityTracker={sidePanels.openActivityTracker}
          onStop={() => {}}
          onForceStart={() => {}}
          onRemove={() => {}}
          onViewDownload={handleViewDownload}
          onViewFolder={handleViewFolder}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          currentTags={getCurrentTags(contextMenu.downloadId)}
          availableTags={availableTags}
          onAddCategory={addCategory}
          onRemoveCategory={removeCategory}
          currentCategories={getCurrentCategories(contextMenu.downloadId)}
          availableCategories={availableCategories}
          onRename={handleRename}
          onShowRemoveModal={handleShowRemoveModal}
          onShowStopModal={handleShowStopModal}
          onViewEmbed={() => {
            if (activeContextDownload) {
              setVideoPlayerState({
                isOpen: true,
                download: activeContextDownload,
              });
            }
            handleCloseContextMenu();
          }}
        />
      )}
    </div>
  );
};

export default SubscriptionSelectedTableGroup;
