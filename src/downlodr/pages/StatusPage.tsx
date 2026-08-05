/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * A custom React Page Component for Status-Specific Downloads
 * This component dynamically displays downloads filtered by their status,
 * reusing the UI structure from the AllDownloads component.
 *
 * @returns JSX.Element - The rendered component displaying status-filtered downloads.
 */
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useSlidePanel } from '@/core-app/hooks/animation/useSlidePanel';
import { ChapterInfo } from '@/downlodr/store/download/types';
import { useMainStore } from '@/core-app/store/mainStore';
import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
import ColumnHeaderContextMenu from '@/downlodr/components/contextMenu/ColumnHeaderContextMenu';
import DownloadContextMenu from '@/downlodr/components/contextMenu/DownloadContextMenu';
import ArticleContextMenu from '@/afda/components/contextMenu/ArticleContextMenu';
import {
  fetchArticle,
  isArticleModel,
} from '@/afda/backend/dummy/dummyArticleService';
import {
  generateArticleDocx,
  generateArticleHtml,
  normalizeArticleRow,
  sanitizeFilename,
} from '@/afda/utils/articleDocxGenerator';
import { useResizableColumns } from '@/downlodr/components/download/resizableColumns/useResizableColumns';
import ExpandedDownloadDetails from '@/downlodr/components/table/ExpandedDownloadDetail';
import VideoPlayerPanel from '@/downlodr/components/panel/VideoPlayerPanel';
import Toolbar from '@/downlodr/components/base/Toolbar';
import { StatusPageModals } from '@/downlodr/pages/status/StatusPageModals';
import { StatusPageTable } from '@/downlodr/pages/status/StatusPageTable';
import { useStatusPageHandlers } from '@/downlodr/pages/status/statusPageHandler';
import {
  useClickOutsideToCloseMenus,
  useErrorTransitionMonitor,
  usePlaylistAutoSelect,
  useStatusPageTitle,
  useThumbnails,
  useTransitionTimeoutRef,
  useWindowSize,
} from '@/downlodr/pages/status/statusPageHooks';
import {
  getColumnOptions,
  sortDownloadsByColumn,
  statusMapping,
} from '@/downlodr/pages/status/statusPageUtils';
import { DownloadItem } from '@/downlodr/schema/componentSchema';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { usePluginStore } from '@/plugins/store/pluginStore';
import ActivityTracker from '@/downlodr/components/download/log/ActivityTracker';
import DownloadLogs from '@/downlodr/components/download/log/DownloadLogs';
import PluginSidePanelManager from '@/plugins/components/PluginSidePanelManager';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import { useAfdaStore } from '@/afda/store/afdaStore';
import type {
  ArticleSearchableDownload,
  SearchableDownload,
  TypeFilter,
} from '../store/taskbarDownloadStore';
import {
  mapArticleToSearchable,
  useTaskbarDownloadStore,
} from '../store/taskbarDownloadStore';

export { formatFileSize } from '@/downlodr/pages/status/statusPageUtils';

const StatusSpecificDownloads = () => {
  const { status } = useParams<{ status: string }>();
  const currentStatus = status ? statusMapping[status] || status : '';
  const location = useLocation();
  const navigate = useNavigate();

  useStatusPageTitle(currentStatus);
  const { windowWidth, windowHeight } = useWindowSize();
  const speedGraphHeight = Math.floor(windowHeight * 0.027);

  // All downloads from different states
  const history = useDownloadStore((state) => state.historyDownloads);
  const downloading = useDownloadStore((state) => state.downloading);
  const forDownloads = useDownloadStore((state) => state.forDownloads);
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );
  const queuedDownloads = useDownloadStore((state) => state.queuedDownloads);
  const failedDownloads = useDownloadStore((state) => state.failedDownloads);
  const articleDownloads = useArticleDownloadStore(
    (state) => state.articleDownloads,
  );
  const fetchAndOpen = useAfdaStore((s) => s.fetchAndOpen);
  const updateArticleDownload = useArticleDownloadStore(
    (state) => state.updateArticleDownload,
  );
  const removeArticleDownload = useArticleDownloadStore(
    (state) => state.removeArticleDownload,
  );
  const addArticleTag = useArticleDownloadStore((state) => state.addArticleTag);
  const removeArticleTag = useArticleDownloadStore(
    (state) => state.removeArticleTag,
  );
  const addArticleCategory = useArticleDownloadStore(
    (state) => state.addArticleCategory,
  );
  const removeArticleCategory = useArticleDownloadStore(
    (state) => state.removeArticleCategory,
  );
  const articleAvailableTags = useMemo(
    () => [...new Set(articleDownloads.flatMap((a) => a.tags ?? []))],
    [articleDownloads],
  );
  const articleAvailableCategories = useMemo(
    () => [...new Set(articleDownloads.flatMap((a) => a.category ?? []))],
    [articleDownloads],
  );
  const toggleArticleFavorite = useArticleDownloadStore(
    (s) => s.toggleArticleFavorite,
  );
  const deleteDownload = useDownloadStore((state) => state.deleteDownload);

  const handleArticleDownload = useCallback(
    async (articleId: string) => {
      const d = articleDownloads.find((a) => a.id === articleId);
      if (!d || d.status !== 'for_download') return;
      updateArticleDownload(d.id, { status: 'loading' });
      try {
        let articleModel;
        const numericId = parseInt(d.id.replace('afda-article-', ''), 10);
        const isSubscriptionArticle =
          !isNaN(numericId) && d.id.startsWith('afda-article-');
        if (isSubscriptionArticle) {
          const bridge = (
            window as unknown as {
              afdaBridge?: {
                articles: {
                  get: (p: {
                    article_id: number;
                  }) => Promise<Record<string, unknown> | null>;
                };
              };
            }
          ).afdaBridge;
          if (!bridge) throw new Error('Bridge unavailable');
          const row = await bridge.articles.get({ article_id: numericId });
          if (!row) throw new Error('Article not found');
          articleModel = normalizeArticleRow(row);
        } else {
          const result = await fetchArticle(d.url);
          if (!isArticleModel(result)) {
            throw new Error(
              result.article_error_status ?? 'Failed to fetch article',
            );
          }
          articleModel = result;
        }
        const currentFormat = d.format ?? 'docx';
        const downloadFolder = await window.downlodrFunctions.getDownloadFolder();
        const filename = sanitizeFilename(articleModel.article_title);
        let buffer: number[];
        let ext: string;
        if (currentFormat === 'pdf') {
          const html = generateArticleHtml(articleModel);
          const pdfResult = await window.downlodrFunctions.htmlToPdf(html);
          if (!pdfResult.success || !pdfResult.data)
            throw new Error(pdfResult.error ?? 'PDF generation failed');
          buffer = pdfResult.data;
          ext = 'pdf';
        } else {
          const bytes = await generateArticleDocx(articleModel);
          buffer = Array.from(bytes);
          ext = 'docx';
        }
        const filePath = await window.downlodrFunctions.joinDownloadPath(
          downloadFolder,
          `${filename}.${ext}`,
        );
        const saveResult = await window.downlodrFunctions.saveBufferToFile(
          buffer,
          filePath,
        );
        if (!saveResult.success)
          throw new Error(saveResult.error ?? 'Failed to save file');
        const fileSize =
          (await window.downlodrFunctions.getFileSize(filePath)) ?? 0;
        updateArticleDownload(d.id, {
          status: 'finished',
          title: articleModel.article_title ?? '',
          filePath,
          fileSize,
          articleData: articleModel,
          thumbnailDataUrl:
            articleModel.article_images?.[0]?.url ?? d.thumbnailDataUrl ?? null,
        });
      } catch (err) {
        updateArticleDownload(d.id, {
          status: 'for_download',
          errorMessage: err instanceof Error ? err.message : 'Download failed',
        });
      }
    },
    [articleDownloads, updateArticleDownload],
  );

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>('dateAdded');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [videoPlayerState, setVideoPlayerState] = useState<{
    isOpen: boolean;
    videoUrl: string;
    title: string;
    autoCaptionLocation?: string;
    transcriptLocation?: string;
    displayName?: string;
    dateAdded?: string;
    location?: string;
    tags?: string[];
    category?: string[];
    status?: string;
    downloadName?: string;
    description?: string;
    chapters?: ChapterInfo[];
    channelName?: string;
    thumbnail?: string;
    ext?: string;
    duration?: number;
    size?: number;
    extractorKey?: string;
    downloadId?: string;
  }>({ isOpen: false, videoUrl: '', title: '' });
  const [panelWidth, setPanelWidth] = useState(75);

  // Tag and Category states and imports
  const availableTags = useDownloadStore((state) => state.availableTags);
  const addTag = useDownloadStore((state) => state.addTag);
  const removeTag = useDownloadStore((state) => state.removeTag);
  const availableCategories = useDownloadStore(
    (state) => state.availableCategories,
  );
  const addCategory = useDownloadStore((state) => state.addCategory);
  const removeCategory = useDownloadStore((state) => state.removeCategory);

  // Selected state management
  const selectedRowIds = useSelectedDownloadStore(
    (state) => state.selectedRowIds,
  );
  const getSelectedWithStatusCount = useSelectedDownloadStore(
    (state) => state.getSelectedWithStatusCount,
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
  const [contextMenu, setContextMenu] = useState<{
    downloadId: string | null;
    x: number;
    y: number;
    downloadLocation?: string;
    controllerId?: string;
    downloadStatus?: string;
  }>({ downloadId: null, x: 0, y: 0 });
  const [selectedDownloadId, setSelectedDownloadId] = useState<string | null>(
    null,
  );
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Get visible columns from the store
  const visibleColumns = useMainStore((state) => state.visibleColumns);
  const { updateIsOpenPluginSidebar, settingsPlugin } = usePluginStore();
  const isPluginSidebarOpen = settingsPlugin.isOpenPluginSidebar;

  const searchState = useTaskbarDownloadStore((state) => state.searchState);
  const { isSearchActive, searchQuery, searchResults } = searchState;
  const activeTypeFilters = useTaskbarDownloadStore((s) => s.activeTypeFilters);
  const clearTypeFilters = useTaskbarDownloadStore((s) => s.clearTypeFilters);
  const toggleTypeFilter = useTaskbarDownloadStore((s) => s.toggleTypeFilter);

  // Clear selection when the filter context changes (different status or search query).
  useEffect(() => {
    clearAllSelections();
  }, [currentStatus, isSearchActive, searchQuery]);

  // Sync type filters when navigating to a different status page. A caller can
  // preset a chip (e.g. the "Subscriptions" breadcrumb) by navigating here with
  // `state: { presetTypeFilter }`; otherwise the chips reset to none.
  useEffect(() => {
    const presetTypeFilter = (
      location.state as { presetTypeFilter?: TypeFilter } | null
    )?.presetTypeFilter;
    clearTypeFilters();
    if (presetTypeFilter) {
      toggleTypeFilter(presetTypeFilter);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStatus]);

  const transitionTimeoutRef = useTransitionTimeoutRef();

  // Downloads
  const [showFileNotExistModal, setShowFileNotExistModal] = useState(false);
  const [missingFiles, setMissingFiles] = useState<DownloadItem[]>([]);
  const selectedDownloads = useSelectedDownloadStore(
    (state) => state.selectedDownloads,
  );
  const [showActivityTracker, setShowActivityTrackerRaw] = useState(false);
  const [activityTrackerDownloadId, setActivityTrackerDownloadId] = useState<
    string | null
  >(null);

  // Memoize initial columns to prevent re-initialization on window resize
  const initialColumns = useMemo(
    () => [
      {
        id: 'name',
        width: Math.max(Math.floor(window.innerWidth * 0.3), 180),
        minWidth: 180,
      },
      { id: 'size', width: 50, minWidth: 50 },
      { id: 'format', width: 90, minWidth: 90 },
      { id: 'status', width: 90, minWidth: 90 },
      { id: 'speed', width: 60, minWidth: 60 },
      { id: 'dateAdded', width: 70, minWidth: 70 },
      { id: 'transcript', width: 20, minWidth: 20 },
      { id: 'source', width: 20, minWidth: 20 },
      { id: 'action', width: 10, minWidth: 10 },
    ],
    [],
  ); // Empty dependency array ensures this only runs once

  // Call the hook with visible column IDs
  const {
    columns,
    startResizing,
    startDragging,
    handleDragOver,
    handleDrop,
    cancelDrag,
    dragging,
    dragOverIndex,
  } = useResizableColumns(initialColumns, visibleColumns);

  // PERFORMANCE OPTIMIZATION: Memoize expensive computations
  // Combine and process downloads only when dependencies change
  const allDownloads = useMemo((): SearchableDownload[] => {
    if (isSearchActive) {
      return searchResults;
    }
    const seenIds = new Set<string>();
    const merged = [
      ...forDownloads,
      ...downloading,
      ...finishedDownloads,
      ...history,
      ...queuedDownloads,
    ].filter((download) => {
      if (seenIds.has(download.id)) return false;
      seenIds.add(download.id);
      return true;
    });

    const mappedArticles: ArticleSearchableDownload[] = articleDownloads.map(
      mapArticleToSearchable,
    );

    const allItems = [...merged, ...mappedArticles];
    const byStatus = currentStatus
      ? currentStatus.toLowerCase() === 'all'
        ? allItems
        : currentStatus.toLowerCase() === 'subscriptions'
        ? merged.filter((d) => !!d.subscriptionId)
        : currentStatus.toLowerCase() === 'articles'
        ? allItems.filter((d) => (d as { type?: string }).type === 'article')
        : allItems.filter(
            (d) => d.status.toLowerCase() === currentStatus.toLowerCase(),
          )
      : allItems;

    if (activeTypeFilters.size === 0) {
      return sortDownloadsByColumn(byStatus, sortColumn, sortDirection);
    }
    const byType = byStatus.filter((d) => {
      const isArticle = (d as { type?: string }).type === 'article';
      const isSubscription = !isArticle && !!d.subscriptionId;
      const isVideo = !isArticle && !isSubscription;
      return (
        (activeTypeFilters.has('articles') && isArticle) ||
        (activeTypeFilters.has('subscriptions') && isSubscription) ||
        (activeTypeFilters.has('videos') && isVideo)
      );
    });
    return sortDownloadsByColumn(byType, sortColumn, sortDirection);
  }, [
    forDownloads,
    downloading,
    finishedDownloads,
    history,
    queuedDownloads,
    articleDownloads,
    currentStatus,
    sortColumn,
    sortDirection,
    isSearchActive,
    searchQuery,
    activeTypeFilters,
  ]);

  // Prune stale items from selection when allDownloads changes.
  useEffect(() => {
    const currentIds = useSelectedDownloadStore.getState().selectedRowIds;
    if (currentIds.length === 0) return;
    const visibleIds = new Set(allDownloads.map((d) => d.id));
    const still = currentIds.filter((id) => visibleIds.has(id));
    if (still.length !== currentIds.length) {
      setSelectedRowIds(still);
    }
  }, [allDownloads]);

  const { thumbnailDataUrls, setThumbnailDataUrls } =
    useThumbnails(allDownloads);
  useErrorTransitionMonitor(allDownloads);

  // Memoize display columns computation
  const displayColumns = useMemo(() => {
    return columns.filter(
      (column) =>
        visibleColumns.includes(column.id) ||
        ['name', 'status', 'format', 'action'].includes(column.id),
    );
  }, [columns, visibleColumns]);

  // Memoize display columns with indices
  const displayColumnsWithIndices = useMemo(() => {
    return displayColumns.map((column, index) => ({
      ...column,
      displayIndex: index,
    }));
  }, [displayColumns]);

  const selectedDownload = useMemo(() => {
    return selectedDownloadId
      ? allDownloads.find((d) => d.id === selectedDownloadId)
      : null;
  }, [selectedDownloadId, allDownloads]);

  // PERFORMANCE OPTIMIZATION: Memoize event handlers
  const handleFileNotExistModal = useCallback(
    async (contextDownload: DownloadItem | null = null) => {
      const missing = [];
      // If a specific download is provided via context menu, check only that one
      const downloadsToCheck = contextDownload
        ? [contextDownload]
        : selectedDownloads;
      // Check each download to see if it exists
      for (const download of downloadsToCheck) {
        const fileName = download.downloadName || download.name;
        if (download.status === 'finished' && download.location && fileName) {
          const fullDownloadLocation =
            await window.downlodrFunctions.joinDownloadPath(
              download.location,
              fileName,
            );
          const exists = await window.downlodrFunctions.fileExists(
            fullDownloadLocation,
          );
          if (!exists) {
            missing.push(download);
          }
        }
      }

      // Set the missing files and show the modal if any were found
      if (missing.length > 0) {
        // Filter and ensure all items are valid DownloadItem objects
        const validMissingFiles = missing.filter(
          (item): item is DownloadItem =>
            'videoUrl' in item && item.videoUrl !== undefined,
        );
        setMissingFiles(validMissingFiles);
        setShowFileNotExistModal(true);
      }
    },
    [selectedDownloads],
  );

  const noopFormatSelect = useCallback(
    (_formatData: { ext: string; formatId: string }) => {
      void _formatData;
    },
    [],
  );

  // Handle column header click for sorting
  const handleSortClick = useCallback(
    (column: string) => {
      if (sortColumn === column) {
        // Toggle direction if same column
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        // Set new column and default to desc
        setSortColumn(column);
        setSortDirection('desc');
      }
    },
    [sortColumn, sortDirection],
  );

  //  new state for the column header context menu
  const [columnHeaderContextMenu, setColumnHeaderContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
  }>({ x: 0, y: 0, visible: false });

  //  handler for the column header right-click
  const handleColumnHeaderContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Close any active download context menu first
    setContextMenu({ downloadId: null, x: 0, y: 0 });
    // Get the table's position
    const tableRect = e.currentTarget.getBoundingClientRect();

    // Calculate position relative to the table/header
    const x = e.clientX - tableRect.left + 2; // Small offset for better appearance
    const y = e.clientY - tableRect.top + window.scrollY + 2;

    setColumnHeaderContextMenu({
      x: x,
      y: y,
      visible: true,
    });
  }, []);

  //  to close the column header context menu
  const handleCloseColumnHeaderContextMenu = useCallback(() => {
    setColumnHeaderContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  // Handle toggle column visibility
  const handleToggleColumn = useCallback(
    (columnId: string) => {
      const newVisibleColumns = visibleColumns.includes(columnId)
        ? visibleColumns.filter((id) => id !== columnId)
        : [...visibleColumns, columnId];

      useMainStore.getState().setVisibleColumns(newVisibleColumns);
    },
    [visibleColumns],
  );

  // state to track menu transitions
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleCheckboxChange = useCallback(
    (downloadId: string) => {
      const newSelected = selectedRowIds.includes(downloadId)
        ? selectedRowIds.filter((id) => id !== downloadId)
        : [...selectedRowIds, downloadId];

      setSelectedRowIds(newSelected);

      // Create promises for each download
      const promises = newSelected.map(async (id) => {
        const download = allDownloads.find((d) => d.id === id);
        return {
          id,
          controllerId: download?.controllerId,
          videoUrl: download?.videoUrl,
          downloadName: download?.displayName,
          status: download?.status,
          download: download,
          location: download?.location
            ? await window.downlodrFunctions.joinDownloadPath(
                download.location,
                download.name,
              )
            : undefined,
        };
      });

      // Resolve all promises before updating state
      Promise.all(promises).then((resolvedData) => {
        setSelectedDownloads(resolvedData);
      });
    },
    [selectedRowIds, allDownloads, setSelectedRowIds, setSelectedDownloads],
  );

  const handleGroupCheckboxChange = useCallback(
    (downloadIds: string[]) => {
      const selectedSet = new Set(selectedRowIds);
      const allSelected = downloadIds.every((id) => selectedSet.has(id));
      const newSelected = allSelected
        ? selectedRowIds.filter((id) => !downloadIds.includes(id))
        : [...new Set([...selectedRowIds, ...downloadIds])];

      setSelectedRowIds(newSelected);

      const promises = newSelected.map(async (id) => {
        const download = allDownloads.find((d) => d.id === id);
        return {
          id,
          controllerId: download?.controllerId,
          videoUrl: download?.videoUrl,
          downloadName: download?.displayName,
          status: download?.status,
          download: download,
          location: download?.location
            ? await window.downlodrFunctions.joinDownloadPath(
                download.location,
                download.name,
              )
            : undefined,
        };
      });

      Promise.all(promises).then((resolvedData) => {
        setSelectedDownloads(resolvedData);
      });
    },
    [selectedRowIds, allDownloads, setSelectedRowIds, setSelectedDownloads],
  );

  const handleSelectPage = useCallback(
    async (pageIds: string[], allPageSelected: boolean) => {
      let newSelected: string[];
      if (allPageSelected) {
        newSelected = selectedRowIds.filter((id) => !pageIds.includes(id));
      } else {
        const existing = new Set(selectedRowIds);
        pageIds.forEach((id) => existing.add(id));
        newSelected = Array.from(existing);
      }
      setSelectedRowIds(newSelected);

      const promises = newSelected.map(async (id) => {
        const download = allDownloads.find((d) => d.id === id);
        return {
          id,
          controllerId: download?.controllerId,
          videoUrl: download?.videoUrl,
          downloadName: download?.displayName,
          status: download?.status,
          download: download,
          location: download?.location
            ? await window.downlodrFunctions.joinDownloadPath(
                download.location,
                download.name,
              )
            : undefined,
        };
      });
      const resolvedDownloads = await Promise.all(promises);
      setSelectedDownloads(resolvedDownloads);
    },
    [selectedRowIds, allDownloads, setSelectedRowIds, setSelectedDownloads],
  );

  const handleCloseContextMenu = () => {
    // Clear any pending transitions
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    // Batch state updates
    setContextMenu({ downloadId: null, x: 0, y: 0 });
    setSelectedDownloadId(null);
    setIsTransitioning(false);
  };

  const handleRowClick = useCallback(
    (downloadId: string) => {
      // Find the download object
      const clickedDownload = allDownloads.find((d) => d.id === downloadId);

      if (!clickedDownload) {
        return;
      }

      // Set the selected download ID - this is crucial for the details panel
      setSelectedDownloadId(downloadId);

      // Update the expanded row state
      setExpandedRowId(downloadId === expandedRowId ? null : downloadId);

      // Update selected row IDs for highlighting
      // setSelectedRowIds([downloadId]);
    },
    [allDownloads, expandedRowId],
  );

  // Find current tags for the selected download
  const getCurrentTags = useCallback(
    (downloadId: string) => {
      const download = allDownloads.find((d) => d.id === downloadId);
      return download?.tags || [];
    },
    [allDownloads],
  );

  const getCurrentCategories = useCallback(
    (downloadId: string) => {
      const download = allDownloads.find((d) => d.id === downloadId);
      return download?.category || [];
    },
    [allDownloads],
  );

  useClickOutsideToCloseMenus({
    contextMenuDownloadId: contextMenu.downloadId,
    transitionTimeoutRef,
    setContextMenu: (menu) => setContextMenu((prev) => ({ ...prev, ...menu })),
    setSelectedDownloadId,
    setColumnHeaderContextMenuVisible: (visible) =>
      setColumnHeaderContextMenu((prev) => ({ ...prev, visible })),
    setIsTransitioning,
  });

  usePlaylistAutoSelect({
    forDownloads,
    selectedRowIds,
    allDownloads,
    setSelectedRowIds,
    setSelectedDownloads,
  });

  // rename modal state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameDownloadId, setRenameDownloadId] = useState<string>('');
  const [renameCurrentName, setRenameCurrentName] = useState<string>('');

  // remove modal state
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeDownloadId, setRemoveDownloadId] = useState<string>('');
  const [removeDownloadLocation, setRemoveDownloadLocation] =
    useState<string>('');
  const [removeControllerId, setRemoveControllerId] = useState<string>('');

  // stop modal state
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopDownloadId, setStopDownloadId] = useState<string>('');
  const [stopDownloadLocation, setStopDownloadLocation] = useState<string>('');
  const [stopControllerId, setStopControllerId] = useState<string>('');

  // log modal state
  const [showLogModal, setShowLogModalRaw] = useState(false);
  const [logModalDownloadId, setLogModalDownloadId] = useState<string>('');

  const {
    wrapperRef: activityTrackerWrapperRef,
    panelRef: activityTrackerRef,
    mounted: activityTrackerMounted,
  } = useSlidePanel(showActivityTracker);
  const {
    wrapperRef: downloadLogsWrapperRef,
    panelRef: downloadLogsRef,
    mounted: downloadLogsMounted,
  } = useSlidePanel(showLogModal);
  const { wrapperRef: pluginWrapperRef, panelRef: pluginPanelRef } =
    useSlidePanel(isPluginSidebarOpen, { gapPx: 8 });

  // Mutually exclusive side panel openers — opening one closes the others
  const setShowActivityTracker = useCallback(
    (open: boolean) => {
      if (open) {
        setShowLogModalRaw(false);
        updateIsOpenPluginSidebar(false);
      }
      setShowActivityTrackerRaw(open);
    },
    [updateIsOpenPluginSidebar],
  );

  const setShowLogModal = useCallback(
    (open: boolean) => {
      if (open) {
        setShowActivityTrackerRaw(false);
        updateIsOpenPluginSidebar(false);
      }
      setShowLogModalRaw(open);
    },
    [updateIsOpenPluginSidebar],
  );

  // Close other side panels when the plugin sidebar opens
  React.useEffect(() => {
    if (isPluginSidebarOpen) {
      setShowActivityTrackerRaw(false);
      setShowLogModalRaw(false);
    }
  }, [isPluginSidebarOpen]);

  const statusHandlers = useStatusPageHandlers({
    allDownloads,
    contextMenu,
    setContextMenu,
    columnHeaderContextMenu,
    setColumnHeaderContextMenu,
    transitionTimeoutRef,
    setIsTransitioning,
    setSelectedDownloadId,
    setLogModalDownloadId,
    setShowLogModal,
    setActivityTrackerDownloadId,
    setShowActivityTracker,
    setSelectedRowIds,
    setSelectedDownloads,
    updateIsOpenPluginSidebar,
    handleFileNotExistModal,
  });

  // Get renameDownload function from store
  const renameDownload = useDownloadStore((state) => state.renameDownload);

  // rename handler
  const handleRename = useCallback(
    (downloadId: string, currentName: string) => {
      setRenameDownloadId(downloadId);
      setRenameCurrentName(currentName);
      setShowRenameModal(true);
    },
    [],
  );

  // remove handler
  const handleShowRemoveModal = useCallback(
    (downloadId: string, downloadLocation?: string, controllerId?: string) => {
      setRemoveDownloadId(downloadId);
      setRemoveDownloadLocation(downloadLocation || '');
      setRemoveControllerId(controllerId || '');
      setShowRemoveModal(true);
    },
    [],
  );

  // stop handler
  const handleShowStopModal = useCallback(
    (downloadId: string, downloadLocation?: string, controllerId?: string) => {
      setStopDownloadId(downloadId);
      setStopDownloadLocation(downloadLocation || '');
      setStopControllerId(controllerId || '');
      setShowStopModal(true);
    },
    [],
  );

  // function to perform the rename
  const performRename = useCallback(
    (newName: string) => {
      renameDownload(renameDownloadId, newName);
      setShowRenameModal(false);
      setRenameDownloadId('');
      setRenameCurrentName('');
    },
    [renameDownload, renameDownloadId],
  );

  // function to perform the remove
  const performRemove = useCallback(
    (deleteFolder?: boolean) => {
      statusHandlers.handleRemove(
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
    [removeDownloadLocation, removeDownloadId, removeControllerId],
  );

  // function to perform the stop
  const performStop = useCallback(() => {
    // Get processQueue function
    const { processQueue } = useDownloadStore.getState();
    statusHandlers.handleStop(
      stopDownloadId,
      stopDownloadLocation,
      stopControllerId,
    );
    processQueue();
    setShowStopModal(false);
    setStopDownloadId('');
    setStopDownloadLocation('');
    setStopControllerId('');
  }, [stopDownloadId, stopDownloadLocation, stopControllerId]);

  return (
    <div
      className={`flex flex-col h-full gap-2 ${
        videoPlayerState.isOpen
          ? 'bg-white dark:bg-darkMode'
          : 'bg-[#F9F9F9] dark:bg-darkMode'
      }`}
    >
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {videoPlayerState.isOpen && (
          <Toolbar
            className="pt-2 pb-1 pr-4 flex-shrink-0 bg-white dark:bg-darkModeTable"
            hidePluginExtension
          />
        )}
        {videoPlayerState.isOpen ? (
          <div className="flex flex-row flex-1 min-h-0 overflow-hidden" style={{ minHeight: 0 }}>
            <VideoPlayerPanel
                isOpen={true}
                onClose={() =>
                  setVideoPlayerState({
                    isOpen: false,
                    videoUrl: '',
                    title: '',
                    autoCaptionLocation: undefined,
                    transcriptLocation: undefined,
                    displayName: undefined,
                    dateAdded: undefined,
                    location: undefined,
                    tags: undefined,
                    category: undefined,
                    description: undefined,
                    chapters: undefined,
                    channelName: undefined,
                    thumbnail: undefined,
                    ext: undefined,
                    duration: undefined,
                    size: undefined,
                    extractorKey: undefined,
                    downloadId: undefined,
                  })
                }
                videoUrl={videoPlayerState.videoUrl}
                title={videoPlayerState.title}
                autoCaptionLocation={videoPlayerState.autoCaptionLocation}
                transcriptLocation={videoPlayerState.transcriptLocation}
                displayName={videoPlayerState.displayName}
                dateAdded={videoPlayerState.dateAdded}
                location={videoPlayerState.location}
                tags={videoPlayerState.tags}
                category={videoPlayerState.category}
                status={videoPlayerState.status}
                downloadName={videoPlayerState.downloadName}
                description={videoPlayerState.description}
                chapters={videoPlayerState.chapters}
                channelName={videoPlayerState.channelName}
                thumbnail={videoPlayerState.thumbnail}
                ext={videoPlayerState.ext}
                duration={videoPlayerState.duration}
                size={videoPlayerState.size}
                extractorKey={videoPlayerState.extractorKey}
                downloadId={videoPlayerState.downloadId}
                width={100}
                onWidthChange={setPanelWidth}
                allDownloads={allDownloads}
                thumbnailDataUrls={thumbnailDataUrls}
                activeDownloadId={videoPlayerState.downloadId}
                onSelectDownload={(download) => {
                  setVideoPlayerState({
                    isOpen: true,
                    videoUrl: download.videoUrl ?? '',
                    title:
                      'displayName' in download && download.displayName
                        ? download.displayName
                        : download.name ?? '',
                    autoCaptionLocation:
                      'autoCaptionLocation' in download
                        ? download.autoCaptionLocation
                        : undefined,
                    transcriptLocation:
                      'transcriptLocation' in download
                        ? download.transcriptLocation
                        : undefined,
                    displayName:
                      'displayName' in download
                        ? download.displayName
                        : undefined,
                    dateAdded:
                      'DateAdded' in download ? download.DateAdded : undefined,
                    location:
                      'location' in download ? download.location : undefined,
                    tags: 'tags' in download ? download.tags : undefined,
                    category:
                      'category' in download ? download.category : undefined,
                    status: download.status,
                    downloadName: download.name,
                    description:
                      'description' in download
                        ? download.description
                        : undefined,
                    chapters:
                      'chapters' in download ? download.chapters : undefined,
                    channelName:
                      'channelName' in download
                        ? download.channelName
                        : undefined,
                    thumbnail:
                      'thumbnails' in download &&
                      typeof download.thumbnails === 'string' &&
                      download.thumbnails !== '—'
                        ? download.thumbnails
                        : undefined,
                    ext: 'ext' in download ? download.ext : undefined,
                    duration:
                      'duration' in download ? download.duration : undefined,
                    size: 'size' in download ? download.size : undefined,
                    extractorKey:
                      'extractorKey' in download
                        ? download.extractorKey
                        : undefined,
                    downloadId: download.id,
                  });
                }}
              />
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden gap-2 -mr-2">
            <div className="flex-1 min-w-0 overflow-hidden flex flex-col min-h-0 gap-2">
              <StatusPageTable
                allDownloads={allDownloads}
                searchQuery={searchQuery}
                isSearchActive={isSearchActive}
                displayColumns={displayColumns}
                columns={columns}
                thumbnailDataUrls={thumbnailDataUrls}
                selectedRowIds={selectedRowIds}
                selectedDownloadId={selectedDownloadId}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                dragging={dragging}
                dragOverIndex={dragOverIndex}
                onClearSelection={clearAllSelections}
                onSelectPage={handleSelectPage}
                onColumnHeaderContextMenu={handleColumnHeaderContextMenu}
                onSortClick={handleSortClick}
                onResizeStart={startResizing}
                startDragging={startDragging}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                cancelDrag={cancelDrag}
                onContextMenu={statusHandlers.handleContextMenu}
                onRowClick={handleRowClick}
                onCheckboxChange={handleCheckboxChange}
                onViewFile={statusHandlers.handleViewFile}
                onViewDownload={statusHandlers.handleViewDownload}
                onViewFolder={statusHandlers.handleViewFolder}
                onRetry={statusHandlers.handleRetry}
                onPause={statusHandlers.handlePause}
                onStop={statusHandlers.handleStop}
                onFinishRecording={statusHandlers.handleFinishRecording}
                onRedownloadTranscript={
                  statusHandlers.handleRedownloadTranscript
                }
                onFormatSelect={noopFormatSelect}
                isPanelOpen={
                  showActivityTracker ||
                  showLogModal ||
                  settingsPlugin.isOpenPluginSidebar
                }
                onClosePluginSidebar={() => updateIsOpenPluginSidebar(false)}
                onGroupCheckboxChange={handleGroupCheckboxChange}
                onViewEmbed={(download) => {
                  setVideoPlayerState({
                    isOpen: true,
                    videoUrl: download.videoUrl ?? '',
                    title: download.displayName ?? download.name ?? '',
                    autoCaptionLocation: download.autoCaptionLocation,
                    transcriptLocation: download.transcriptLocation,
                    displayName: download.displayName,
                    dateAdded: download.DateAdded,
                    location: download.location,
                    tags: download.tags,
                    category: download.category,
                    status: download.status,
                    downloadName: download.name,
                    description: download.description,
                    chapters: download.chapters,
                    channelName: download.channelName,
                    thumbnail:
                      typeof download.thumbnails === 'string' &&
                      download.thumbnails !== '—'
                        ? download.thumbnails
                        : undefined,
                    ext: download.ext,
                    duration: download.duration,
                    size: download.size,
                    extractorKey: download.extractorKey,
                    downloadId: download.id,
                  });
                }}
              />
              <div className="flex-shrink-0">
                <ExpandedDownloadDetails
                  download={
                    selectedDownload
                      ? {
                          ...selectedDownload,
                          elapsed: selectedDownload.elapsed || 0,
                        }
                      : null
                  }
                  finishedCount={finishedDownloads.length}
                  queuedCount={queuedDownloads.length + forDownloads.length}
                  failedCount={
                    downloading.filter((d) => d.status === 'failed').length +
                    failedDownloads.length
                  }
                />
              </div>
            </div>
            <div
              ref={pluginWrapperRef}
              className="overflow-hidden flex-shrink-0 flex flex-col"
            >
              <div ref={pluginPanelRef} className="flex-1 min-h-0">
                <PluginSidePanelManager />
              </div>
            </div>
            {activityTrackerMounted && (
              <div
                ref={activityTrackerWrapperRef}
                className="overflow-hidden flex-shrink-0 flex flex-col"
              >
                <div ref={activityTrackerRef} className="flex-1 min-h-0">
                  <ActivityTracker
                    isOpen={showActivityTracker}
                    onClose={() => setShowActivityTracker(false)}
                    downloadId={activityTrackerDownloadId}
                  />
                </div>
              </div>
            )}
            {downloadLogsMounted && (
              <div
                ref={downloadLogsWrapperRef}
                className="overflow-hidden flex-shrink-0 flex flex-col"
              >
                <div ref={downloadLogsRef} className="flex-1 min-h-0">
                  <DownloadLogs
                    isOpen={showLogModal}
                    onClose={() => {
                      setShowLogModal(false);
                      setLogModalDownloadId('');
                    }}
                    downloadId={logModalDownloadId}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Menus */}
      {contextMenu.downloadId &&
        !isTransitioning &&
        (() => {
          const download = allDownloads.find(
            (d) => d.id === contextMenu.downloadId,
          );
          if (!download) return null;

          if ('type' in download && download.type === 'article') {
            const article = articleDownloads.find(
              (a) => a.id === contextMenu.downloadId,
            );
            if (!article) return null;
            return (
              <ArticleContextMenu
                article={article}
                position={{ x: contextMenu.x, y: contextMenu.y }}
                onClose={handleCloseContextMenu}
                onViewArticle={(articleId) => {
                  const a = articleDownloads.find((x) => x.id === articleId);
                  if (a?.url) fetchAndOpen(a.url);
                }}
                onOpenInBrowser={(url) =>
                  window.downlodrFunctions.openExternalLink(url)
                }
                onOpenFolder={(filePath) =>
                  window.downlodrFunctions.openFolder(filePath, filePath)
                }
                onRemove={(articleId) => {
                  const a = articleDownloads.find((x) => x.id === articleId);
                  if (a?.filePath) {
                    window.downlodrFunctions.deleteFile(a.filePath).catch(() => {});
                  }
                  removeArticleDownload(articleId);
                  handleCloseContextMenu();
                }}
                onRetry={(articleId) =>
                  updateArticleDownload(articleId, {
                    status: 'for_download',
                    errorMessage: undefined,
                  })
                }
                onDownload={handleArticleDownload}
                onToggleFavorite={toggleArticleFavorite}
                isFavorited={!!article.favorited}
                onAddTag={addArticleTag}
                onRemoveTag={removeArticleTag}
                currentTags={article.tags ?? []}
                availableTags={articleAvailableTags}
                onAddCategory={addArticleCategory}
                onRemoveCategory={removeArticleCategory}
                currentCategories={article.category ?? []}
                availableCategories={articleAvailableCategories}
              />
            );
          }

          return (
            <DownloadContextMenu
              download={download}
              position={{ x: contextMenu.x, y: contextMenu.y }}
              onShowLog={statusHandlers.handleShowLog}
              onShowActivityTracker={statusHandlers.handleShowActivityTracker}
              onClose={handleCloseContextMenu}
              onRetry={statusHandlers.handleRetry}
              onPause={statusHandlers.handlePause}
              onStop={statusHandlers.handleStop}
              onForceStart={statusHandlers.handleForceStart}
              onRemove={statusHandlers.handleRemove}
              onViewDownload={statusHandlers.handleViewDownload}
              onViewFolder={statusHandlers.handleViewFolder}
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
              onFinishRecording={statusHandlers.handleFinishRecording}
              onViewEmbed={(
                videoUrl,
                title,
                autoCaptionLocation,
                transcriptLocation,
                displayName,
                dateAdded,
                location,
                tags,
                category,
                status,
                downloadName,
              ) => {
                if (!videoUrl && !location) return;
                setVideoPlayerState({
                  isOpen: true,
                  videoUrl,
                  title,
                  autoCaptionLocation,
                  transcriptLocation,
                  displayName,
                  dateAdded,
                  location,
                  tags,
                  category,
                  status,
                  downloadName,
                });
              }}
            />
          );
        })()}

      <ColumnHeaderContextMenu
        position={{
          x: columnHeaderContextMenu.x,
          y: columnHeaderContextMenu.y,
        }}
        visible={columnHeaderContextMenu.visible}
        visibleColumns={visibleColumns}
        onToggleColumn={handleToggleColumn}
        onClose={handleCloseColumnHeaderContextMenu}
        columnOptions={getColumnOptions()}
      />
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
    </div>
  );
};

export default StatusSpecificDownloads;
