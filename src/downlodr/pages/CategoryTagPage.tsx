/**
 * A custom React component
 * Filtered downloads view for tag and category routes. Renders the same table,
 * toolbar, columns, thumbnails, pagination, and row actions as the main Downloads
 * view — only the underlying filter differs.
 *
 * @param CategoryTagPageProps
 *   @param downloads - Pre-filtered array of downloads to display.
 *   @param categoryId - Optional label shown as a badge when a category filter is active.
 *
 * @returns JSX.Element
 */

import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useMainStore } from '@/core-app/store/mainStore';
import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
import ColumnHeaderContextMenu from '@/downlodr/components/contextMenu/ColumnHeaderContextMenu';
import DownloadContextMenu from '@/downlodr/components/contextMenu/DownloadContextMenu';
import { useResizableColumns } from '@/downlodr/components/download/resizableColumns/useResizableColumns';
import Toolbar from '@/downlodr/components/base/Toolbar';
import { DownloadItem } from '@/downlodr/schema/componentSchema';
import { BaseDownload, useDownloadStore } from '@/downlodr/store/downloadStore';
import {
  useTaskbarDownloadStore,
  type SearchableDownload,
} from '@/downlodr/store/taskbarDownloadStore';
import { useThumbnails } from '@/downlodr/pages/status/statusPageHooks';
import { StatusPageTableHeader } from '@/downlodr/pages/status/StatusPageTableHeader';
import { StatusPageTableRow } from '@/downlodr/pages/status/StatusPageTableRow';
import type { DisplayColumn } from '@/downlodr/pages/status/statusPageTypes';
import { getColumnOptions } from '@/downlodr/pages/status/statusPageUtils';
import { StatusPageModals } from '@/downlodr/pages/status/StatusPageModals';
import { redownloadTranscript } from '@/downlodr/utils/transcription/ffmpegWhisperTranscriber';
import SidePanels from '@/downlodr/components/panels/SidePanels';
import { useSidePanels } from '@/downlodr/hooks/useSidePanels';
import EmptySearch from '@/assets/icon/EmptySearch';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

interface CategoryTagPageProps {
  downloads: BaseDownload[];
  categoryId?: string;
}

const PAGE_SIZE = 7;

const CategoryTagPage: React.FC<CategoryTagPageProps> = ({
  downloads,
  categoryId,
}) => {
  const [windowWidth] = useState(window.innerWidth);

  const initialColumns: DisplayColumn[] = [
    { id: 'name', width: Math.floor(windowWidth * 0.28), minWidth: 170 },
    { id: 'size', width: 90, minWidth: 80 },
    { id: 'format', width: 90, minWidth: 70 },
    { id: 'status', width: 100, minWidth: 80 },
    { id: 'speed', width: 80, minWidth: 60 },
    { id: 'dateAdded', width: 90, minWidth: 90 },
    { id: 'transcript', width: 40, minWidth: 40 },
    { id: 'source', width: 50, minWidth: 50 },
    { id: 'action', width: 60, minWidth: 60 },
  ];

  const {
    columns,
    startResizing,
    startDragging,
    handleDragOver,
    handleDrop,
    cancelDrag,
    dragging,
    dragOverIndex,
  } = useResizableColumns(initialColumns);

  const {
    isSearchActive,
    searchResults,
    searchQuery: taskbarQuery,
  } = useTaskbarDownloadStore((state) => state.searchState);
  const clearSearch = useTaskbarDownloadStore((s) => s.clearSearch);

  const availableTags = useDownloadStore((s) => s.availableTags);
  const addTag = useDownloadStore((s) => s.addTag);
  const removeTag = useDownloadStore((s) => s.removeTag);
  const availableCategories = useDownloadStore((s) => s.availableCategories);
  const addCategory = useDownloadStore((s) => s.addCategory);
  const removeCategory = useDownloadStore((s) => s.removeCategory);
  const renameDownload = useDownloadStore((s) => s.renameDownload);

  const uniqueDownloads = useMemo(() => {
    const deduped = [
      ...new Map(downloads.map((item) => [item.id, item])).values(),
    ];
    if (!isSearchActive) return deduped;
    const resultIds = new Set(searchResults.map((r) => r.id));
    return deduped.filter((d) => resultIds.has(d.id));
  }, [downloads, isSearchActive, searchResults]);

  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  const globalSelectedRowIds = useSelectedDownloadStore(
    (state) => state.selectedRowIds,
  );
  const setSelectedRowIds = useSelectedDownloadStore(
    (state) => state.setSelectedRowIds,
  );
  const setSelectedDownloads = useSelectedDownloadStore(
    (state) => state.setSelectedDownloads,
  );
  const clearAllSelections = useSelectedDownloadStore(
    (state) => state.clearAllSelections,
  );

  const [selectedDownloadId, setSelectedDownloadId] = useState<string | null>(
    null,
  );
  const [contextMenu, setContextMenu] = useState<{
    downloadId: string | null;
    x: number;
    y: number;
    downloadLocation?: string;
    controllerId?: string;
  } | null>(null);
  const [columnHeaderContextMenu, setColumnHeaderContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameDownloadId, setRenameDownloadId] = useState('');
  const [renameCurrentName, setRenameCurrentName] = useState('');
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeDownloadId, setRemoveDownloadId] = useState('');
  const [removeDownloadLocation, setRemoveDownloadLocation] = useState('');
  const [removeControllerId, setRemoveControllerId] = useState('');
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopDownloadId, setStopDownloadId] = useState('');
  const [stopDownloadLocation, setStopDownloadLocation] = useState('');
  const [stopControllerId, setStopControllerId] = useState('');

  const [currentPage, setCurrentPage] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const visibleColumns = useMainStore((state) => state.visibleColumns);

  const displayColumns = useMemo<DisplayColumn[]>(() => {
    const required = ['name', 'status', 'format', 'action'];
    return columns.filter(
      (col) => visibleColumns.includes(col.id) || required.includes(col.id),
    );
  }, [columns, visibleColumns]);

  const sortedDownloads = useMemo(() => {
    const sortable = [...uniqueDownloads];
    if (sortConfig.key !== null) {
      sortable.sort((a, b) => {
        const val = (item: BaseDownload, key: string): string | number => {
          switch (key) {
            case 'name':
              return (item.displayName || item.name).toLowerCase();
            case 'size':
              return item.size;
            case 'format':
              return item.ext?.toLowerCase() || '';
            case 'status':
              return item.status?.toLowerCase() || '';
            case 'dateAdded':
              return item.DateAdded;
            case 'source':
              return (item.extractorKey || '').toLowerCase();
            default:
              return '';
          }
        };
        const a0 = val(a, sortConfig.key!);
        const b0 = val(b, sortConfig.key!);
        if (a0 < b0) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a0 > b0) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [uniqueDownloads, sortConfig]);

  const totalPages = Math.ceil(sortedDownloads.length / PAGE_SIZE);
  const pageStart = currentPage * PAGE_SIZE + 1;
  const pageEnd = Math.min(
    (currentPage + 1) * PAGE_SIZE,
    sortedDownloads.length,
  );

  const pageItems = useMemo(
    () =>
      sortedDownloads.slice(
        currentPage * PAGE_SIZE,
        (currentPage + 1) * PAGE_SIZE,
      ),
    [sortedDownloads, currentPage],
  );

  const visiblePageIds = useMemo(
    () =>
      sortedDownloads
        .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
        .map((d) => d.id),
    [sortedDownloads, currentPage],
  );

  useEffect(() => {
    setCurrentPage(0);
  }, [downloads]);

  useEffect(() => {
    clearAllSelections();
  }, [categoryId, isSearchActive, taskbarQuery]);

  // Prune stale items from selection when downloads changes.
  useEffect(() => {
    const currentIds = useSelectedDownloadStore.getState().selectedRowIds;
    if (currentIds.length === 0) return;
    const visibleIds = new Set(downloads.map((d) => d.id));
    const still = currentIds.filter((id) => visibleIds.has(id));
    if (still.length !== currentIds.length) {
      setSelectedRowIds(still);
    }
  }, [downloads]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const { thumbnailDataUrls } = useThumbnails(
    uniqueDownloads as unknown as SearchableDownload[],
  );

  // ── selection ────────────────────────────────────────────────────────────

  const buildSelectionPayload = useCallback(
    async (ids: string[]) => {
      const promises = ids.map(async (id) => {
        const dl = sortedDownloads.find((d) => d.id === id);
        return {
          id,
          controllerId: dl?.controllerId,
          videoUrl: dl?.videoUrl,
          downloadName: dl?.downloadName,
          status: dl?.status,
          download: dl,
          location: dl?.location
            ? await window.downlodrFunctions.joinDownloadPath(
                dl.location,
                dl.name,
              )
            : undefined,
        };
      });
      return Promise.all(promises);
    },
    [sortedDownloads],
  );

  const handleRowClick = (downloadId: string) => {
    setSelectedDownloadId(
      downloadId === selectedDownloadId ? null : downloadId,
    );
  };

  const handleCheckboxChange = (downloadId: string) => {
    const newSelected = globalSelectedRowIds.includes(downloadId)
      ? globalSelectedRowIds.filter((id) => id !== downloadId)
      : [...globalSelectedRowIds, downloadId];
    useSelectedDownloadStore.getState().setSelectedRowIds(newSelected);
    buildSelectionPayload(newSelected).then((data) =>
      useSelectedDownloadStore.getState().setSelectedDownloads(data),
    );
  };

  const handleSelectPage = useCallback(
    (pageIds: string[], allPageSelected: boolean) => {
      if (allPageSelected) {
        setSelectedRowIds(
          globalSelectedRowIds.filter((id) => !pageIds.includes(id)),
        );
      } else {
        const existing = new Set(globalSelectedRowIds);
        pageIds.forEach((id) => existing.add(id));
        setSelectedRowIds(Array.from(existing));
      }
    },
    [globalSelectedRowIds, setSelectedRowIds],
  );

  // ── column header context menu ────────────────────────────────────────────

  const handleColumnHeaderContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);
    const rect = e.currentTarget.getBoundingClientRect();
    setColumnHeaderContextMenu({
      visible: true,
      x: e.clientX - rect.left + 2,
      y: e.clientY - rect.top + window.scrollY + 2,
    });
  };

  const handleCloseColumnHeaderContextMenu = () =>
    setColumnHeaderContextMenu((prev) => ({ ...prev, visible: false }));

  const handleToggleColumn = (columnId: string) => {
    const next = visibleColumns.includes(columnId)
      ? visibleColumns.filter((id) => id !== columnId)
      : [...visibleColumns, columnId];
    useMainStore.getState().setVisibleColumns(next);
  };

  // ── row context menu ──────────────────────────────────────────────────────

  const handleContextMenu = (
    event: React.MouseEvent,
    download: SearchableDownload,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      downloadId: download.id,
      x: event.clientX,
      y: event.clientY,
      downloadLocation: `${download.location}${download.name}`,
      controllerId: download.controllerId,
    });
    setSelectedDownloadId(download.id);
  };

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const insideMenu = target.closest('[data-context-menu]');
      const clickedRow = target.closest('tr');
      const differentRow =
        clickedRow &&
        contextMenu?.downloadId &&
        !clickedRow.querySelector(
          `[data-download-id="${contextMenu.downloadId}"]`,
        );
      if (!insideMenu || differentRow) {
        setContextMenu(null);
        setSelectedDownloadId(null);
        setColumnHeaderContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu?.downloadId]);

  // ── drag cleanup ──────────────────────────────────────────────────────────

  const enhancedStartDragging = (columnId: string, index: number) => {
    startDragging(columnId, index);
    document.body.classList.add('column-dragging');
  };
  const enhancedHandleDrop = () => {
    handleDrop();
    document.body.classList.remove('column-dragging');
  };

  useEffect(() => {
    const end = () => document.body.classList.remove('column-dragging');
    document.addEventListener('dragend', end);
    return () => {
      document.removeEventListener('dragend', end);
      document.body.classList.remove('column-dragging');
    };
  }, []);

  // ── sort ──────────────────────────────────────────────────────────────────

  const handleSortClick = (columnId: string) => {
    setSortConfig((prev) => ({
      key: columnId,
      direction:
        prev.key === columnId && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // ── download actions ──────────────────────────────────────────────────────

  const handlePause = async (
    downloadId: string,
    _downloadLocation?: string,
    _controllerId?: string,
    _downloadStatus?: string,
  ) => {
    const {
      downloading,
      deleteDownloading,
      addDownload,
      updateDownloadStatus,
    } = useDownloadStore.getState();
    const current = downloading.find((d) => d.id === downloadId);

    if (current?.status === 'paused') {
      const isM4aDownload = current.ext === 'm4a' || current.audioExt === 'm4a';

      if (isM4aDownload && current.location && current.downloadName) {
        try {
          const fullFilePath = await window.downlodrFunctions.joinDownloadPath(
            current.location,
            current.downloadName,
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
        videoUrl: current.videoUrl ?? '',
        name: current.name,
        downloadName: current.downloadName,
        displayName: current.displayName ?? '',
        size: current.size,
        speed: current.speed,
        channelName: current.channelName ?? '',
        timeLeft: current.timeLeft ?? '',
        DateAdded: new Date().toISOString(),
        progress: current.progress,
        location: current.location ?? '',
        status: 'downloading',
        ext: current.ext,
        formatId: current.formatId,
        audioExt: current.audioExt,
        audioFormatId: current.audioFormatId,
        extractorKey: current.extractorKey,
        limitRate: '',
        automaticCaption: current.automaticCaption,
        thumbnails: current.thumbnails ?? null,
        getTranscript: current.getTranscript ?? false,
        getThumbnail: current.getThumbnail ?? false,
        autoCaptionLocation:
          (current as { autoCaptionLocation?: string }).autoCaptionLocation ??
          '',
        thumnailsLocation:
          (current as { thumnailsLocation?: string }).thumnailsLocation ?? '',
        duration: current.duration ?? 60,
        isCreateFolder: false,
      });
      deleteDownloading(downloadId);
      useSelectedDownloadStore.getState().clearAllSelections();
      toast({
        variant: 'success',
        title: 'Download Resumed',
        description: 'Download has been resumed successfully',
        duration: 3000,
      });
    } else if (
      current &&
      (current as { controllerId?: string }).controllerId &&
      (current as { controllerId?: string }).controllerId !== '---'
    ) {
      const controllerId = (current as { controllerId?: string }).controllerId;
      try {
        updateDownloadStatus(downloadId, 'paused');
        const killed = await window.ytdlp.killController(controllerId ?? '');
        if (killed) {
          toast({
            variant: 'success',
            title: 'Download Paused',
            description: 'Download has been paused successfully',
            duration: 3000,
          });
        } else {
          updateDownloadStatus(downloadId, 'downloading');
          toast({
            variant: 'destructive',
            title: 'Pause Failed',
            description: 'Could not pause the download',
            duration: 3000,
          });
        }
      } catch {
        updateDownloadStatus(downloadId, 'downloading');
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to pause/resume download',
          duration: 3000,
        });
      }
    }
    setContextMenu(null);
  };

  const handleRetry = useCallback(
    (downloadId: string) => {
      const current = sortedDownloads.find((d) => d.id === downloadId) as
        | SearchableDownload
        | undefined;
      if (!current) return;
      const { retryDownload, deleteDownload } = useDownloadStore.getState();
      retryDownload({
        videoUrl: current.videoUrl ?? '',
        name: current.name,
        downloadName: current.downloadName,
        displayName: current.displayName ?? '',
        size: current.size,
        speed: current.speed,
        channelName: current.channelName ?? '',
        timeLeft: current.timeLeft ?? '',
        DateAdded: new Date().toISOString(),
        progress: 0,
        location: current.location ?? '',
        status: 'downloading',
        ext: current.ext,
        formatId: current.formatId,
        audioExt: current.audioExt,
        audioFormatId: current.audioFormatId,
        extractorKey: current.extractorKey,
        limitRate: '',
        automaticCaption: current.automaticCaption,
        thumbnails: current.thumbnails ?? null,
        getTranscript: current.getTranscript ?? false,
        getThumbnail: current.getThumbnail ?? false,
        duration: current.duration ?? 60,
        thumnailsLocation:
          (current as { thumnailsLocation?: string }).thumnailsLocation ?? '',
        autoCaptionLocation:
          (current as { autoCaptionLocation?: string }).autoCaptionLocation ??
          '',
        isCreateFolder: false,
      });
      deleteDownload(downloadId);
    },
    [sortedDownloads],
  );

  const handleRedownloadTranscript = useCallback(
    async (downloadId: string) => {
      const current = sortedDownloads.find((d) => d.id === downloadId);
      if (!current) return;
      const inputLocation = await window.downlodrFunctions.joinDownloadPath(
        current.location,
        current.downloadName,
      );
      const outputLocation = await window.downlodrFunctions.joinDownloadPath(
        current.location,
        current.downloadName.replace(/\.[^/.]+$/, '.srt'),
      );
      redownloadTranscript({
        inputFile: inputLocation,
        outputFile: outputLocation,
        modelPath: 'ggml-small.bin',
        language: 'en',
        format: 'srt',
      });
      toast({
        variant: 'success',
        title: 'Transcript queued',
        description: 'Transcript re-download has been queued',
        duration: 3000,
      });
      useDownloadStore
        .getState()
        .updateDownloadTranscript(downloadId, outputLocation);
    },
    [sortedDownloads],
  );

  // ── tags / categories ────────────────────────────────────────────────────

  const getCurrentTags = useCallback(
    (downloadId: string) =>
      sortedDownloads.find((d) => d.id === downloadId)?.tags || [],
    [sortedDownloads],
  );

  const getCurrentCategories = useCallback(
    (downloadId: string) =>
      sortedDownloads.find((d) => d.id === downloadId)?.category || [],
    [sortedDownloads],
  );

  // ── log / activity tracker ───────────────────────────────────────────────

  const sidePanels = useSidePanels();
  const handleShowLog = useCallback(
    (downloadId: string) => sidePanels.openLog(downloadId),
    [sidePanels.openLog],
  );
  const handleShowActivityTracker = useCallback(
    (downloadId: string) => sidePanels.openActivityTracker(downloadId),
    [sidePanels.openActivityTracker],
  );

  // ── stop / force-start ───────────────────────────────────────────────────

  const handleStop = useCallback(
    (
      downloadId: string,
      _downloadLocation?: string,
      _controllerId?: string,
    ) => {
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
        deleteDownloading(downloadId);
        toast({
          variant: 'success',
          title: 'Download Stopped',
          description: 'Download has been stopped',
          duration: 3000,
        });
      } else if (currentForDownload?.status === 'to download') {
        removeFromForDownloads(downloadId);
        processQueue();
        toast({
          variant: 'success',
          title: 'Download Stopped',
          description: 'Download has been stopped',
          duration: 3000,
        });
      } else if (currentDownload) {
        const cid = (currentDownload as { controllerId?: string }).controllerId;
        if (cid) {
          window.ytdlp
            .killController(cid)
            .then((result) => {
              if (result) {
                deleteDownloading(downloadId);
                processQueue();
                toast({
                  variant: 'success',
                  title: 'Download Stopped',
                  description: 'Download has been stopped',
                  duration: 3000,
                });
              }
            })
            .catch(() => {
              toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to stop download',
                duration: 3000,
              });
            });
        }
      }
      setContextMenu(null);
    },
    [],
  );

  const handleForceStart = useCallback(() => {
    setContextMenu(null);
  }, []);

  // ── remove ────────────────────────────────────────────────────────────────

  const handleRemove = useCallback(
    async (
      downloadLocation?: string,
      downloadId?: string,
      controllerId?: string,
      deleteFolder?: boolean,
    ) => {
      if (!downloadLocation || !downloadId) return;
      const { deleteDownload, processQueue } = useDownloadStore.getState();
      const dl = downloads.find((d) => d.id === downloadId);
      if (!dl) return;

      if (
        dl.status === 'to download' ||
        ['cancelled', 'paused', 'failed'].includes(dl.status)
      ) {
        deleteDownload(downloadId);
        processQueue();
        toast({
          variant: 'success',
          title: 'Download Removed',
          description: 'Download has been removed',
          duration: 3000,
        });
        setContextMenu(null);
        return;
      }

      if (dl.status === 'downloading' && controllerId) {
        try {
          const success = await window.ytdlp.killController(controllerId);
          if (!success) {
            toast({
              variant: 'destructive',
              title: 'Error',
              description: 'Failed to stop download before removing',
              duration: 3000,
            });
            return;
          }
          processQueue();
        } catch {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to stop download',
            duration: 3000,
          });
          return;
        }
      }

      try {
        if (deleteFolder) {
          const folderExists = await window.downlodrFunctions.fileExists(
            downloadLocation,
          );
          if (!folderExists) {
            deleteDownload(downloadId);
            toast({
              variant: 'success',
              title: 'Download Removed',
              duration: 3000,
            });
            setContextMenu(null);
            return;
          }
          const success = await window.downlodrFunctions.deleteFolder(
            downloadLocation,
          );
          if (success) {
            deleteDownload(downloadId);
            toast({
              variant: 'success',
              title: 'Download and folder removed',
              duration: 3000,
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'Error',
              description: 'Failed to delete folder',
              duration: 3000,
            });
          }
        } else {
          const success = await window.downlodrFunctions.deleteFile(
            downloadLocation,
          );
          if (success) {
            deleteDownload(downloadId);
            toast({
              variant: 'success',
              title: 'Download Removed',
              duration: 3000,
            });
          } else {
            const src = downloads.find((d) => d.id === downloadId);
            if (src) {
              setMissingFiles([
                {
                  id: src.id,
                  videoUrl: src.videoUrl,
                  location: downloadLocation,
                  name: src.name,
                  ext: src.ext,
                  downloadName: src.downloadName,
                  extractorKey: src.extractorKey,
                  status: src.status,
                  download: { displayName: src.displayName || '', ...src },
                },
              ]);
              setShowFileNotExistModal(true);
            }
          }
        }
      } catch {
        const src = downloads.find((d) => d.id === downloadId);
        if (src) {
          setMissingFiles([
            {
              id: src.id,
              videoUrl: src.videoUrl,
              location: downloadLocation,
              name: src.name,
              ext: src.ext,
              downloadName: src.downloadName,
              extractorKey: src.extractorKey,
              status: src.status,
              download: { displayName: src.displayName || '', ...src },
            },
          ]);
          setShowFileNotExistModal(true);
        }
      }
      setContextMenu(null);
    },
    [downloads],
  );

  // ── rename / remove / stop modals ─────────────────────────────────────────

  const handleRename = useCallback(
    (downloadId: string, currentName: string) => {
      setRenameDownloadId(downloadId);
      setRenameCurrentName(currentName);
      setShowRenameModal(true);
    },
    [],
  );

  const handleShowRemoveModal = useCallback(
    (downloadId: string, downloadLocation?: string, controllerId?: string) => {
      setRemoveDownloadId(downloadId);
      setRemoveDownloadLocation(downloadLocation ?? '');
      setRemoveControllerId(controllerId ?? '');
      setShowRemoveModal(true);
      setContextMenu(null);
    },
    [],
  );

  const handleShowStopModal = useCallback(
    (downloadId: string, downloadLocation?: string, controllerId?: string) => {
      setStopDownloadId(downloadId);
      setStopDownloadLocation(downloadLocation ?? '');
      setStopControllerId(controllerId ?? '');
      setShowStopModal(true);
      setContextMenu(null);
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

  const performRemove = useCallback(
    (deleteFolder?: boolean) => {
      handleRemove(
        removeDownloadLocation,
        removeDownloadId,
        removeControllerId,
        deleteFolder,
      );
      setShowRemoveModal(false);
      setRemoveDownloadId('');
      setRemoveDownloadLocation('');
      setRemoveControllerId('');
    },
    [
      handleRemove,
      removeDownloadLocation,
      removeDownloadId,
      removeControllerId,
    ],
  );

  const performStop = useCallback(() => {
    const { processQueue } = useDownloadStore.getState();
    handleStop(stopDownloadId, stopDownloadLocation, stopControllerId);
    processQueue();
    setShowStopModal(false);
    setStopDownloadId('');
    setStopDownloadLocation('');
    setStopControllerId('');
  }, [handleStop, stopDownloadId, stopDownloadLocation, stopControllerId]);

  // ── file / folder viewers ─────────────────────────────────────────────────

  const [showFileNotExistModal, setShowFileNotExistModal] = useState(false);
  const [missingFiles, setMissingFiles] = useState<DownloadItem[]>([]);

  const handleViewFile = async (location?: string) => {
    if (!location) return;
    try {
      const exists = await window.downlodrFunctions.fileExists(location);
      if (exists) window.downlodrFunctions.openVideo(location);
    } catch (err) {
      console.error('Error viewing file:', err);
    }
  };

  const handleViewDownload = async (
    downloadLocation?: string,
    downloadId?: string,
  ) => {
    if (!downloadLocation) {
      toast({
        variant: 'destructive',
        title: 'No Download Location',
        description: 'Invalid Download Location',
        duration: 3000,
      });
      setContextMenu(null);
      return;
    }
    try {
      const dl = sortedDownloads.find((d) => d.id === downloadId);
      if (!dl) return;
      const fullPath = await window.downlodrFunctions.joinDownloadPath(
        dl.location,
        dl.downloadName,
      );
      const exists = await window.downlodrFunctions.fileExists(fullPath);
      if (exists) {
        window.downlodrFunctions.openVideo(fullPath);
      } else if (downloadId) {
        const src = downloads.find((d) => d.id === downloadId);
        if (src) {
          setMissingFiles([
            {
              id: src.id,
              videoUrl: src.videoUrl,
              location: downloadLocation,
              name: src.name,
              ext: src.ext,
              downloadName: src.downloadName,
              extractorKey: src.extractorKey,
              status: src.status,
              download: { displayName: src.displayName || '', ...src },
            },
          ]);
          setShowFileNotExistModal(true);
        }
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: String(err) || 'Failed to view download',
        duration: 5000,
      });
    }
    setContextMenu(null);
  };

  const handleViewFolder = async (
    downloadLocation?: string,
    filePath?: string,
  ) => {
    if (!downloadLocation) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to open folder',
        duration: 3000,
      });
      setContextMenu(null);
      return;
    }
    try {
      const fullPath = filePath
        ? await window.downlodrFunctions.joinDownloadPath(
            downloadLocation,
            filePath,
          )
        : null;
      if (fullPath) {
        const fileExists = await window.downlodrFunctions.fileExists(fullPath);
        if (fileExists) {
          const ok = await window.downlodrFunctions.openFolder(
            downloadLocation,
            fullPath,
          );
          if (ok) {
            setContextMenu(null);
            return;
          }
        }
      }
      const folderExists = await window.downlodrFunctions.fileExists(
        downloadLocation,
      );
      if (folderExists) {
        await window.downlodrFunctions.openFolder(downloadLocation, null);
      } else {
        toast({
          variant: 'destructive',
          title: 'Missing Folder',
          description: 'The download folder does not exist yet',
          duration: 3000,
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to open folder',
        duration: 3000,
      });
    }
    setContextMenu(null);
  };

  const handleViewEmbed = async (download: SearchableDownload) => {
    if (
      download.status === 'finished' ||
      download.status === 'paused' ||
      download.status === 'downloading'
    ) {
      const fullPath = await window.downlodrFunctions.joinDownloadPath(
        download.location ?? '',
        download.downloadName ?? '',
      );
      handleViewDownload(fullPath, download.id);
    } else if (download.videoUrl) {
      window.downlodrFunctions.openExternalLink(download.videoUrl);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  const columnMenuOptions = getColumnOptions();

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-darkModeTable rounded-md group/scrollarea gap-2">
      <Toolbar className="pt-2 pb-1 pr-4 flex-shrink-0" />

      {categoryId && categoryId !== 'all' && (
        <div className="ml-4 flex-shrink-0">
          <span className="px-2.5 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-100 rounded-full text-xs font-medium whitespace-nowrap inline-flex items-center">
            {categoryId === 'uncategorized'
              ? 'Uncategorized'
              : decodeURIComponent(categoryId)}
          </span>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden gap-2 -mr-2">
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div
            ref={scrollContainerRef}
            className={`${
              isSearchActive && sortedDownloads.length === 0 && taskbarQuery
                ? ''
                : 'flex-1'
            } overflow-auto min-w-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:transition-colors [&::-webkit-scrollbar-thumb]:duration-200 group-hover/scrollarea:[&::-webkit-scrollbar-thumb]:bg-gray-300 dark:group-hover/scrollarea:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:bg-transparent`}
          >
            <table className="w-full">
              <StatusPageTableHeader
                displayColumns={displayColumns}
                columns={columns}
                selectedRowIds={globalSelectedRowIds}
                pageRowIds={visiblePageIds}
                onClearSelection={clearAllSelections}
                pageStart={pageStart}
                pageEnd={pageEnd}
                totalDownloads={sortedDownloads.length}
                totalPages={totalPages}
                sortColumn={sortConfig.key ?? ''}
                sortDirection={sortConfig.direction}
                dragging={dragging}
                dragOverIndex={dragOverIndex}
                onColumnHeaderContextMenu={handleColumnHeaderContextMenu}
                onSelectAll={() =>
                  handleSelectPage(
                    visiblePageIds,
                    visiblePageIds.every((id) =>
                      globalSelectedRowIds.includes(id),
                    ),
                  )
                }
                onSortClick={handleSortClick}
                onResizeStart={(columnId, clientX) =>
                  startResizing(columnId, clientX)
                }
                startDragging={enhancedStartDragging}
                onDragOver={handleDragOver}
                onDrop={enhancedHandleDrop}
                cancelDrag={cancelDrag}
              />
              <tbody>
                {pageItems.map((download, index) => (
                  <StatusPageTableRow
                    key={download.id}
                    download={download as unknown as SearchableDownload}
                    displayColumns={displayColumns}
                    thumbnailDataUrls={thumbnailDataUrls}
                    isChecked={globalSelectedRowIds.includes(download.id)}
                    isSelectedDownload={selectedDownloadId === download.id}
                    index={index}
                    handlers={{
                      onContextMenu: handleContextMenu,
                      onRowClick: () => handleRowClick(download.id),
                      onCheckboxChange: () => handleCheckboxChange(download.id),
                      onViewFile: handleViewFile,
                      onViewDownload: handleViewDownload,
                      onViewFolder: handleViewFolder,
                      onRetry: handleRetry,
                      onPause: handlePause,
                      onRedownloadTranscript: handleRedownloadTranscript,
                      onFormatSelect: () => {},
                      onViewEmbed: handleViewEmbed,
                    }}
                  />
                ))}
              </tbody>
            </table>

            {isSearchActive && sortedDownloads.length === 0 && taskbarQuery && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <EmptySearch className="text-gray-300 dark:text-gray-600" />
                <p className="text-base font-bold text-gray-700 dark:text-gray-200">
                  No downloads found
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Nothing matched{' '}
                  <span className="font-semibold text-gray-600 dark:text-gray-300">
                    &ldquo;{taskbarQuery}&rdquo;
                  </span>
                  .
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 -mt-2">
                  Try a different title
                </p>
                <button
                  onClick={clearSearch}
                  className="mt-1 px-5 py-2 rounded-md bg-[#E8622A] hover:bg-[#d0541e] text-white text-sm font-medium transition-colors"
                >
                  Clear Search
                </button>
              </div>
            )}
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
        <SidePanels {...sidePanels} />
      </div>

      {contextMenu?.downloadId &&
        (() => {
          const dl = downloads.find((d) => d.id === contextMenu.downloadId) as
            | BaseDownload
            | undefined;
          return dl ? (
            <DownloadContextMenu
              download={dl}
              position={{ x: contextMenu.x, y: contextMenu.y }}
              onClose={() => setContextMenu(null)}
              onPause={handlePause}
              onRetry={handleRetry}
              onShowLog={handleShowLog}
              onShowActivityTracker={handleShowActivityTracker}
              onStop={handleStop}
              onForceStart={handleForceStart}
              onRemove={handleRemove}
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
              onViewEmbed={(
                videoUrl,
                _title,
                _autoCaptionLocation,
                _transcriptLocation,
                _displayName,
                _dateAdded,
                location,
                _tags,
                _category,
                status,
                downloadName,
              ) => {
                if (!videoUrl && !location) return;
                if (
                  (status === 'finished' ||
                    status === 'paused' ||
                    status === 'downloading') &&
                  location &&
                  downloadName
                ) {
                  window.downlodrFunctions
                    .joinDownloadPath(location, downloadName)
                    .then((fullPath) => {
                      handleViewDownload(
                        fullPath,
                        contextMenu.downloadId ?? undefined,
                      );
                    });
                } else if (videoUrl) {
                  window.downlodrFunctions.openExternalLink(videoUrl);
                }
              }}
            />
          ) : null;
        })()}

      <StatusPageModals
        showFileNotExistModal={showFileNotExistModal}
        onCloseFileNotExistModal={() => setShowFileNotExistModal(false)}
        missingFiles={missingFiles}
        showRenameModal={showRenameModal}
        onCloseRenameModal={() => {
          setShowRenameModal(false);
          setRenameDownloadId('');
          setRenameCurrentName('');
        }}
        renameCurrentName={renameCurrentName}
        onRename={performRename}
        showRemoveModal={showRemoveModal}
        onCloseRemoveModal={() => {
          setShowRemoveModal(false);
          setRemoveDownloadId('');
          setRemoveDownloadLocation('');
          setRemoveControllerId('');
        }}
        onConfirmRemove={performRemove}
        showStopModal={showStopModal}
        onCloseStopModal={() => {
          setShowStopModal(false);
          setStopDownloadId('');
          setStopDownloadLocation('');
          setStopControllerId('');
        }}
        onConfirmStop={performStop}
      />

      <ColumnHeaderContextMenu
        position={{
          x: columnHeaderContextMenu.x,
          y: columnHeaderContextMenu.y,
        }}
        visible={columnHeaderContextMenu.visible}
        visibleColumns={visibleColumns}
        onToggleColumn={handleToggleColumn}
        onClose={handleCloseColumnHeaderContextMenu}
        columnOptions={columnMenuOptions}
      />
    </div>
  );
};

export default CategoryTagPage;
