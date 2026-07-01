import SidePanels from '@/downlodr/components/panels/SidePanels';
import { useSidePanels } from '@/downlodr/hooks/useSidePanels';
import { useResizableColumns } from '@/downlodr/components/download/resizableColumns/useResizableColumns';
import VideoPlayerPanel from '@/downlodr/components/panel/VideoPlayerPanel';
import ResizableHeader from '@/downlodr/components/download/resizableColumns/ResizableHeader';
import ShareButton from '@/downlodr/components/download/ShareButton';
import FavoritesContextMenu from '@/downlodr/components/contextMenu/FavoritesContextMenu';
import TaskbarInputField from '@/downlodr/components/base/InputField/TaskbarInputField';
import TranscrptButton from '@/downlodr/components/download/TranscrptButton';
import ArticleViewButton from '@/afda/components/ArticleViewButton';
import { useAfdaStore } from '@/afda/store/afdaStore';
import type { FinishedDownloads } from '@/downlodr/store/download/types';
import {
  FavoriteItem,
  useFavoritesStore,
} from '@/downlodr/store/favoritesStore';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import {
  getExtractorIcon,
  getStatusIcon,
} from '@/downlodr/utils/icons/iconMapper';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import {
  formatRelativeTime,
  formatFileSize,
  getColumnDisplayName,
  getStatusColor,
} from '@/downlodr/pages/status/statusPageUtils';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FaHeart } from 'react-icons/fa';
import { FiPlayCircle } from 'react-icons/fi';
import { HiChevronUpDown } from 'react-icons/hi2';
import { HiOutlineFolderOpen } from 'react-icons/hi';
import { IoMdDownload } from 'react-icons/io';
import { LuTrash } from 'react-icons/lu';
import { VscPlayCircle } from 'react-icons/vsc';
import { AiOutlineFileWord } from 'react-icons/ai';

const THUMB_PLACEHOLDER_CLASS =
  'h-9 w-16 rounded overflow-hidden flex justify-center items-center flex-shrink-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.5)_0%,transparent_45%),radial-gradient(circle_at_45%_80%,rgba(255,255,255,0.4)_0%,transparent_35%),linear-gradient(135deg,#ffa42e,#fec77d,#ffa42e,#fec170)]';

const renderSortIndicator = (
  sortColumn: string,
  sortDirection: 'asc' | 'desc',
  columnId: string,
) => {
  if (sortColumn !== columnId) {
    return (
      <HiChevronUpDown size={14} className="flex-shrink-0 dark:text-gray-400" />
    );
  }
  if (sortDirection === 'asc') {
    return <HiChevronUpDown size={14} className="flex-shrink-0 rotate-180" />;
  }
  return <HiChevronUpDown size={14} className="flex-shrink-0" />;
};

const FavoritesPage: React.FC = () => {
  const favorites = useFavoritesStore((s) => s.favorites);
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite);
  const updateFavoriteTags = useFavoritesStore((s) => s.updateFavoriteTags);
  const updateFavoriteCategories = useFavoritesStore(
    (s) => s.updateFavoriteCategories,
  );

  const searchState = useTaskbarDownloadStore((s) => s.searchState);

  const availableTags = useDownloadStore((s) => s.availableTags);
  const availableCategories = useDownloadStore((s) => s.availableCategories);
  const addTag = useDownloadStore((s) => s.addTag);
  const addCategory = useDownloadStore((s) => s.addCategory);

  // Checkbox state (local — favorites are independent of the download queue)
  const [selectedFavoriteIds, setSelectedFavoriteIds] = useState<string[]>([]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    favId: string | null;
    x: number;
    y: number;
  }>({ favId: null, x: 0, y: 0 });

  const initialColumns = useMemo(
    () => [
      { id: 'checkbox', width: 36, minWidth: 36 },
      {
        id: 'name',
        width: Math.max(Math.floor(window.innerWidth * 0.3), 180),
        minWidth: 180,
      },
      { id: 'size', width: 70, minWidth: 50 },
      { id: 'format', width: 90, minWidth: 70 },
      { id: 'status', width: 130, minWidth: 100 },
      { id: 'speed', width: 80, minWidth: 60 },
      { id: 'dateAdded', width: 100, minWidth: 80 },
      { id: 'transcript', width: 80, minWidth: 60 },
      { id: 'source', width: 60, minWidth: 40 },
      { id: 'action', width: 80, minWidth: 60 },
    ],
    [],
  );

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

  const displayColumns = useMemo(
    () =>
      columns.filter((col) =>
        [
          'checkbox',
          'name',
          'size',
          'format',
          'status',
          'speed',
          'dateAdded',
          'transcript',
          'source',
          'action',
        ].includes(col.id),
      ),
    [columns],
  );

  const [sortColumn, setSortColumn] = useState<string>('dateAdded');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const sortedFavorites = useMemo(() => {
    return [...favorites].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sortColumn) {
        case 'name':
          aVal = (a.displayName ?? a.title).toLowerCase();
          bVal = (b.displayName ?? b.title).toLowerCase();
          break;
        case 'size':
          aVal = a.size ?? 0;
          bVal = b.size ?? 0;
          break;
        case 'format':
          aVal = a.ext?.toLowerCase() ?? '';
          bVal = b.ext?.toLowerCase() ?? '';
          break;
        case 'status':
          aVal = a.status?.toLowerCase() ?? '';
          bVal = b.status?.toLowerCase() ?? '';
          break;
        case 'dateAdded':
          aVal = a.dateAdded ?? '';
          bVal = b.dateAdded ?? '';
          break;
        default:
          aVal = a.dateAdded ?? '';
          bVal = b.dateAdded ?? '';
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [favorites, sortColumn, sortDirection]);

  const filteredFavorites = useMemo(() => {
    if (!searchState.isSearchActive || !searchState.searchQuery.trim()) {
      return sortedFavorites;
    }
    const query = searchState.searchQuery.toLowerCase();
    return sortedFavorites.filter(
      (fav) =>
        fav.title?.toLowerCase().includes(query) ||
        fav.displayName?.toLowerCase().includes(query) ||
        fav.channelName?.toLowerCase().includes(query) ||
        fav.extractorKey?.toLowerCase().includes(query) ||
        fav.status?.toLowerCase().includes(query) ||
        fav.tags?.some((t) => t.toLowerCase().includes(query)) ||
        fav.category?.some((c) => c.toLowerCase().includes(query)),
    );
  }, [sortedFavorites, searchState.isSearchActive, searchState.searchQuery]);

  const handleSortClick = useCallback(
    (column: string) => {
      if (column === 'checkbox' || column === 'action') return;
      if (sortColumn === column) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSortColumn(column);
        setSortDirection('desc');
      }
    },
    [sortColumn, sortDirection],
  );

  // Scroll fade
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScroll = useCallback(() => {
    setIsScrolling(true);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => setIsScrolling(false), 800);
  }, []);

  // Video player state
  const [videoPlayerState, setVideoPlayerState] = useState<{
    isOpen: boolean;
    fav: FavoriteItem | null;
  }>({ isOpen: false, fav: null });
  const [panelWidth, setPanelWidth] = useState(75);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const closePlayer = useCallback(() => {
    setVideoPlayerState({ isOpen: false, fav: null });
    setSelectedId(null);
  }, []);

  const openPlayer = useCallback((fav: FavoriteItem) => {
    setVideoPlayerState({ isOpen: true, fav });
  }, []);

  // Checkbox handlers
  const handleSelectAll = useCallback(() => {
    setSelectedFavoriteIds((prev) =>
      prev.length === filteredFavorites.length
        ? []
        : filteredFavorites.map((f) => f.id),
    );
  }, [filteredFavorites]);

  const handleCheckboxChange = useCallback((id: string) => {
    setSelectedFavoriteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  // Bulk delete selected favorites
  const handleBulkDelete = useCallback(() => {
    selectedFavoriteIds.forEach((favId) => {
      const fav = favorites.find((f) => f.id === favId);
      if (!fav) return;
      removeFavorite(fav.downloadId);
      if (videoPlayerState.fav?.downloadId === fav.downloadId) closePlayer();
    });
    setSelectedFavoriteIds([]);
  }, [selectedFavoriteIds, favorites, removeFavorite, videoPlayerState.fav, closePlayer]);

  // Context menu handlers
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, fav: FavoriteItem) => {
      e.preventDefault();
      setContextMenu({ favId: fav.id, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ favId: null, x: 0, y: 0 });
  }, []);

  // Tag / category handlers for favorites
  const handleFavAddTag = useCallback(
    (downloadId: string, tag: string) => {
      const fav = favorites.find((f) => f.downloadId === downloadId);
      if (!fav) return;
      if (fav.tags.includes(tag)) return;
      updateFavoriteTags(downloadId, [...fav.tags, tag]);
      addTag(downloadId, tag);
    },
    [favorites, updateFavoriteTags, addTag],
  );

  const handleFavRemoveTag = useCallback(
    (downloadId: string, tag: string) => {
      const fav = favorites.find((f) => f.downloadId === downloadId);
      if (!fav) return;
      updateFavoriteTags(
        downloadId,
        fav.tags.filter((t) => t !== tag),
      );
    },
    [favorites, updateFavoriteTags],
  );

  const handleFavAddCategory = useCallback(
    (downloadId: string, category: string) => {
      const fav = favorites.find((f) => f.downloadId === downloadId);
      if (!fav) return;
      if (fav.category.includes(category)) return;
      updateFavoriteCategories(downloadId, [category]);
      addCategory(downloadId, category);
    },
    [favorites, updateFavoriteCategories, addCategory],
  );

  const handleFavRemoveCategory = useCallback(
    (downloadId: string, category: string) => {
      const fav = favorites.find((f) => f.downloadId === downloadId);
      if (!fav) return;
      updateFavoriteCategories(
        downloadId,
        fav.category.filter((c) => c !== category),
      );
    },
    [favorites, updateFavoriteCategories],
  );

  // View folder handler
  const handleViewFolder = useCallback(
    async (location: string, name: string) => {
      if (!location) {
        toast({
          variant: 'destructive',
          title: 'No location',
          description: 'File location is not available.',
          duration: 3000,
        });
        return;
      }
      try {
        const fullPath = await window.downlodrFunctions.joinDownloadPath(
          location,
          name,
        );
        const exists = await window.downlodrFunctions.fileExists(fullPath);
        if (exists) {
          await window.downlodrFunctions.openFolder(location, fullPath);
        } else {
          const folderExists = await window.downlodrFunctions.fileExists(
            location,
          );
          if (folderExists) {
            await window.downlodrFunctions.openFolder(location, null);
          } else {
            toast({
              variant: 'destructive',
              title: 'Folder not found',
              description: 'The download folder could not be found.',
              duration: 3000,
            });
          }
        }
      } catch {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to open folder.',
          duration: 3000,
        });
      }
    },
    [],
  );

  // View download handler (open in external player)
  const handleViewDownload = useCallback(
    async (location: string, downloadName: string) => {
      if (!location) {
        toast({
          variant: 'destructive',
          title: 'No location',
          description: 'File location is not available.',
          duration: 3000,
        });
        return;
      }
      try {
        const fullPath = await window.downlodrFunctions.joinDownloadPath(
          location,
          downloadName,
        );
        const exists = await window.downlodrFunctions.fileExists(fullPath);
        if (exists) {
          window.downlodrFunctions.openVideo(fullPath);
        } else {
          toast({
            variant: 'destructive',
            title: 'File not found',
            description: 'The file could not be found at the saved location.',
            duration: 3000,
          });
        }
      } catch {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to open file.',
          duration: 3000,
        });
      }
    },
    [],
  );

  const activeFav = contextMenu.favId
    ? favorites.find((f) => f.id === contextMenu.favId)
    : null;

  const fetchAndOpen = useAfdaStore((s) => s.fetchAndOpen);

  const sidePanels = useSidePanels();

  const allChecked =
    filteredFavorites.length > 0 &&
    selectedFavoriteIds.length === filteredFavorites.length;
  const someChecked =
    selectedFavoriteIds.length > 0 &&
    selectedFavoriteIds.length < filteredFavorites.length;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-darkMode gap-2">
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div
          className="flex flex-row h-full overflow-hidden"
          style={{ minHeight: 0 }}
        >
          {/* Table area */}
          <div
            className={`flex flex-col flex-1 min-w-0 overflow-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:transition-colors [&::-webkit-scrollbar-thumb]:duration-200 group-hover/scrollarea:[&::-webkit-scrollbar-thumb]:bg-gray-300 dark:group-hover/scrollarea:[&::-webkit-scrollbar-thumb]:bg-gray-600 ${
              isScrolling
                ? '[&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600'
                : '[&::-webkit-scrollbar-thumb]:bg-transparent'
            }`}
            style={{
              width: videoPlayerState.isOpen ? `${100 - panelWidth}%` : '100%',
              transition: 'width 200ms ease',
            }}
            onScroll={handleScroll}
          >
            <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0">
              <FaHeart className="text-red-400" size={16} />
              <span className="font-semibold text-xs dark:text-gray-200">
                Favorites
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                ({favorites.length})
              </span>
              {selectedFavoriteIds.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  title={`Delete ${selectedFavoriteIds.length} selected`}
                  className="ml-2 flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
                >
                  <LuTrash size={13} />
                  Delete ({selectedFavoriteIds.length})
                </button>
              )}
              <div className="ml-auto w-[400px] [&>div]:max-w-full">
                <TaskbarInputField />
              </div>
            </div>

            {favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400 dark:text-gray-500">
                <FaHeart size={40} className="opacity-20" />
                <p className="text-base font-medium">No favorites yet</p>
                <p className="text-xs">
                  Heart a video in the table to save it here
                </p>
              </div>
            ) : filteredFavorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400 dark:text-gray-500">
                <p className="text-base font-bold text-gray-700 dark:text-gray-200">
                  No favorites found
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Nothing matched &ldquo;{searchState.searchQuery}&rdquo;
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 z-20 bg-white dark:bg-alternateBlack">
                  <tr className="text-left">
                    {displayColumns.map((column, displayIndex) => {
                      const originalIndex = columns.findIndex(
                        (col) => col.id === column.id,
                      );

                      if (column.id === 'checkbox') {
                        return (
                          <th
                            key="checkbox"
                            style={{ width: column.width }}
                            className="p-2 text-center"
                          >
                            <input
                              type="checkbox"
                              checked={allChecked}
                              ref={(el) => {
                                if (el) el.indeterminate = someChecked;
                              }}
                              onChange={handleSelectAll}
                              className="cursor-pointer"
                            />
                          </th>
                        );
                      }

                      return (
                        <ResizableHeader
                          key={column.id}
                          width={column.width}
                          onResizeStart={(e) =>
                            startResizing(column.id, e.clientX)
                          }
                          index={originalIndex}
                          onDragStart={startDragging}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onDragEnd={cancelDrag}
                          isDragging={dragging?.columnId === column.id}
                          isDragOver={dragOverIndex === originalIndex}
                          columnId={column.id}
                          isLastColumn={
                            displayIndex === displayColumns.length - 1
                          }
                        >
                          <div
                            className="flex items-center cursor-pointer whitespace-nowrap"
                            onClick={() => handleSortClick(column.id)}
                          >
                            <span className="flex items-center gap-[0.5px]">
                              {getColumnDisplayName(column.id)}
                              {column.id !== 'action' &&
                                column.id !== 'source' &&
                                column.id !== 'transcript' &&
                                renderSortIndicator(
                                  sortColumn,
                                  sortDirection,
                                  column.id,
                                )}
                            </span>
                          </div>
                        </ResizableHeader>
                      );
                    })}
                  </tr>
                  <tr className="pointer-events-none">
                    <th
                      colSpan={999}
                      className="p-0 h-[1px] bg-gray-200 dark:bg-darkModeCompliment"
                    />
                  </tr>
                </thead>
                <tbody>
                  {filteredFavorites.map((fav) => (
                    <tr
                      key={fav.id}
                      className={`border-b-2 hover:bg-gray-50 dark:border-[#27272ACC] dark:hover:bg-darkModeHover cursor-pointer ${
                        selectedId === fav.id
                          ? 'bg-blue-50 dark:bg-gray-600'
                          : 'dark:bg-darkMode'
                      }`}
                      onClick={() => {
                        const isArticle = fav.extractorKey === 'Article';
                        if (isArticle) {
                          fetchAndOpen(fav.videoUrl);
                        } else if (fav.id === selectedId) {
                          setSelectedId(null);
                          closePlayer();
                        } else {
                          setSelectedId(fav.id);
                          openPlayer(fav);
                        }
                      }}
                      onContextMenu={(e) => handleContextMenu(e, fav)}
                    >
                      {displayColumns.map((column) => {
                        switch (column.id) {
                          case 'checkbox':
                            return (
                              <td
                                key="checkbox"
                                style={{ width: column.width }}
                                className="p-2 text-center"
                                onClick={(e) => e.stopPropagation()}
                                onContextMenu={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedFavoriteIds.includes(fav.id)}
                                  onChange={() => handleCheckboxChange(fav.id)}
                                  className="cursor-pointer"
                                />
                              </td>
                            );
                          case 'name': {
                            const isArticle = fav.extractorKey === 'Article';
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200"
                              >
                                <div className="flex items-start gap-3 w-full">
                                  <div className="flex-shrink-0">
                                    {isArticle ? (
                                      <div className="h-9 w-16 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 rounded overflow-hidden">
                                        <AiOutlineFileWord
                                          size={24}
                                          className="text-blue-600 dark:text-blue-400"
                                        />
                                      </div>
                                    ) : fav.thumbnail && fav.thumbnail !== '—' ? (
                                      <TooltipWrapper
                                        content="View full"
                                        side="bottom"
                                      >
                                        <div
                                          className="h-9 w-16 bg-black flex rounded cursor-pointer overflow-hidden justify-center items-center flex-shrink-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openPlayer(fav);
                                            setSelectedId(fav.id);
                                          }}
                                        >
                                          <img
                                            src={fav.thumbnail}
                                            alt="thumbnail"
                                            className="max-h-full max-w-full object-contain hover:opacity-70 transition-opacity"
                                            onError={(e) => {
                                              const el = e.target as HTMLImageElement;
                                              el.style.display = 'none';
                                              const placeholder = document.createElement('div');
                                              placeholder.className = THUMB_PLACEHOLDER_CLASS;
                                              placeholder.innerHTML = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" height="20" width="20" color="#F45513" style="color:#F45513"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>`;
                                              el.parentElement?.replaceChild(placeholder, el);
                                            }}
                                          />
                                        </div>
                                      </TooltipWrapper>
                                    ) : (
                                      <div className={THUMB_PLACEHOLDER_CLASS}>
                                        <FiPlayCircle size={20} color="#F45513" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="line-clamp-2 break-words flex justify-start items-start min-w-0 flex-1">
                                    <div className="w-full">
                                      <TooltipWrapper
                                        content={fav.displayName || fav.title}
                                        side="bottom"
                                        contentClassname="text-start justify-start"
                                      >
                                        <div>
                                          <span className="line-clamp-1 break-words break-all font-semibold">
                                            {fav.displayName || fav.title}
                                          </span>
                                        </div>
                                      </TooltipWrapper>
                                      {fav.channelName && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                                          {fav.channelName}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            );
                          }
                          case 'size':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="px-2 py-2 dark:text-gray-200 text-left text-xs"
                              >
                                <span className="whitespace-nowrap overflow-hidden">
                                  {formatFileSize(fav.size)}
                                </span>
                              </td>
                            );
                          case 'format':
                            return (
                              <td
                                key={column.id}
                                style={{ width: Math.max(column.width), minWidth: '70px' }}
                                className="p-2 text-center align-middle"
                              >
                                <div className="text font-medium text-sm text-gray-600 dark:text-gray-300 text-center">
                                  {fav.ext ? fav.ext.toUpperCase() : '—'}
                                </div>
                              </td>
                            );
                          case 'status': {
                            const isArticle = fav.extractorKey === 'Article';
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width - 10 }}
                                className="p-1 ml-1"
                              >
                                {isArticle ? (
                                  <div className="flex justify-center">
                                    {fav.status === 'for_download' && (
                                      <TooltipWrapper content="Download article" side="bottom">
                                        <button
                                          onClick={(e) => e.stopPropagation()}
                                          style={{ color: '#FF9800' }}
                                          className="text-center items-center"
                                        >
                                          <IoMdDownload className="mr-1" size={22} />
                                        </button>
                                      </TooltipWrapper>
                                    )}
                                    {fav.status === 'finished' && (
                                      <div className="flex items-center space-x-2">
                                        <ArticleViewButton
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            fetchAndOpen(fav.videoUrl);
                                          }}
                                        />
                                        <TooltipWrapper content="Open folder" side="bottom">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleViewFolder(fav.location, fav.downloadName);
                                            }}
                                          >
                                            <HiOutlineFolderOpen
                                              size={20}
                                              className="text-green-600 hover:text-green-400 transition-colors duration-200"
                                            />
                                          </button>
                                        </TooltipWrapper>
                                      </div>
                                    )}
                                    {fav.status === 'failed' && (
                                      <span className="text-red-500 text-lg">✕</span>
                                    )}
                                    {!fav.status && (
                                      <span className="text-xs text-gray-400">—</span>
                                    )}
                                  </div>
                                ) : fav.status === 'finished' ? (
                                  <div className="ml-3 flex items-center space-x-2 justify-center">
                                    <button
                                      className="flex items-center text-sm underline"
                                      style={{ color: getStatusColor(fav.status) }}
                                    >
                                      <TooltipWrapper
                                        content="View video"
                                        side="bottom"
                                      >
                                        <span>
                                          <VscPlayCircle
                                            size={20}
                                            className="text-green-600 hover:text-green-400 transition-colors duration-200"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openPlayer(fav);
                                              setSelectedId(fav.id);
                                            }}
                                          />
                                        </span>
                                      </TooltipWrapper>
                                      <TooltipWrapper
                                        content="Open folder"
                                        side="bottom"
                                      >
                                        <span
                                          className="ml-2 hover:text-green-400 transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewFolder(
                                              fav.location,
                                              fav.downloadName,
                                            );
                                          }}
                                        >
                                          <HiOutlineFolderOpen
                                            size={20}
                                            className="mr-3 text-green-600 hover:text-green-400 transition-colors duration-200"
                                          />
                                        </span>
                                      </TooltipWrapper>
                                    </button>
                                  </div>
                                ) : fav.status ? (
                                  <div className="flex justify-center">
                                    <TooltipWrapper
                                      content={
                                        fav.status.charAt(0).toUpperCase() +
                                        fav.status.slice(1)
                                      }
                                      side="bottom"
                                    >
                                      <div className="ml-[2.5px] flex items-center justify-center space-x-2">
                                        {getStatusIcon(fav.status, 20)}
                                      </div>
                                    </TooltipWrapper>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400 flex justify-center">—</span>
                                )}
                              </td>
                            );
                          }
                          case 'speed':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="pl-2 py-2 dark:text-gray-200 flex justify-center items-center"
                              >
                                <div className="flex justify-center w-full">
                                  <span className="text-xs">—</span>
                                </div>
                              </td>
                            );
                          case 'dateAdded':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200 ml-2 justify-center text-center text-xs"
                              >
                                <TooltipWrapper
                                  content={
                                    fav.dateAdded
                                      ? new Date(fav.dateAdded).toLocaleDateString()
                                      : '—'
                                  }
                                  side="bottom"
                                >
                                  <div>
                                    {fav.dateAdded
                                      ? formatRelativeTime(fav.dateAdded)
                                      : '—'}
                                  </div>
                                </TooltipWrapper>
                              </td>
                            );
                          case 'transcript':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="dark:text-gray-200 outline-1 text-center align-middle justify-center"
                              >
                                {fav.extractorKey === 'Article' ? (
                                  <span className="text-xs text-gray-400">—</span>
                                ) : (
                                  <TranscrptButton
                                    download={fav as unknown as FinishedDownloads}
                                    onViewFile={(location, _id) =>
                                      handleViewDownload(location ?? '', fav.downloadName)
                                    }
                                  />
                                )}
                              </td>
                            );
                          case 'source': {
                            const isArticle = fav.extractorKey === 'Article';
                            const hostname = isArticle ? (() => {
                              try { return new URL(fav.videoUrl).hostname; } catch { return null; }
                            })() : null;
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200"
                              >
                                {isArticle ? (
                                  hostname ? (
                                    <TooltipWrapper content={fav.videoUrl} side="bottom">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <img
                                          src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
                                          alt=""
                                          className="w-6 h-6 shrink-0 cursor-pointer"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.downlodrFunctions.openExternalLink(fav.videoUrl);
                                          }}
                                          onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      </div>
                                    </TooltipWrapper>
                                  ) : (
                                    <span className="flex justify-center text-xs text-gray-400">—</span>
                                  )
                                ) : (
                                  <TooltipWrapper
                                    content={fav.extractorKey}
                                    side="bottom"
                                  >
                                    <div className="line-clamp-2 break-words flex justify-center items-center text-lg">
                                      <a
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.downlodrFunctions.openExternalLink(
                                            fav.videoUrl,
                                          );
                                        }}
                                        className="hover:underline cursor-pointer hover:opacity-80 transition-opacity"
                                      >
                                        {getExtractorIcon(fav.extractorKey)}
                                      </a>
                                    </div>
                                  </TooltipWrapper>
                                )}
                              </td>
                            );
                          }
                          case 'action':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200 text-center"
                              >
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeFavorite(fav.downloadId);
                                      if (
                                        videoPlayerState.fav?.downloadId ===
                                        fav.downloadId
                                      ) {
                                        closePlayer();
                                      }
                                    }}
                                    title="Remove from favorites"
                                    className="p-1 hover:opacity-80 transition-opacity"
                                  >
                                    <FaHeart
                                      size={14}
                                      className="text-red-400"
                                    />
                                  </button>
                                  <ShareButton
                                    videoUrl={fav.videoUrl}
                                    name={fav.title}
                                    status={fav.status}
                                    thumbnailLocation={fav.thumbnail}
                                    format={fav.ext}
                                    size={fav.size}
                                  />
                                </div>
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <SidePanels {...sidePanels} />

          {/* Video player side panel */}
          {videoPlayerState.isOpen && videoPlayerState.fav && (
            <VideoPlayerPanel
              isOpen={videoPlayerState.isOpen}
              onClose={closePlayer}
              videoUrl={videoPlayerState.fav.videoUrl}
              title={
                videoPlayerState.fav.displayName ?? videoPlayerState.fav.title
              }
              autoCaptionLocation={videoPlayerState.fav.autoCaptionLocation}
              transcriptLocation={videoPlayerState.fav.transcriptLocation}
              displayName={videoPlayerState.fav.displayName}
              dateAdded={videoPlayerState.fav.dateAdded}
              location={videoPlayerState.fav.location}
              tags={videoPlayerState.fav.tags}
              category={videoPlayerState.fav.category}
              status={videoPlayerState.fav.status}
              downloadName={videoPlayerState.fav.downloadName}
              description={videoPlayerState.fav.description}
              chapters={videoPlayerState.fav.chapters}
              channelName={videoPlayerState.fav.channelName}
              thumbnail={videoPlayerState.fav.thumbnail}
              ext={videoPlayerState.fav.ext}
              duration={videoPlayerState.fav.duration}
              size={videoPlayerState.fav.size}
              extractorKey={videoPlayerState.fav.extractorKey}
              downloadId={videoPlayerState.fav.downloadId}
              width={panelWidth}
              onWidthChange={setPanelWidth}
            />
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu.favId && activeFav && (
        <div onMouseDown={(e) => e.stopPropagation()}>
          <FavoritesContextMenu
            favorite={activeFav}
            position={{ x: contextMenu.x, y: contextMenu.y }}
            onClose={handleCloseContextMenu}
            onViewFolder={handleViewFolder}
            onViewDownload={handleViewDownload}
            onViewEmbed={(fav) => {
              openPlayer(fav);
              setSelectedId(fav.id);
              handleCloseContextMenu();
            }}
            onRemoveFavorite={(downloadId) => {
              removeFavorite(downloadId);
              if (videoPlayerState.fav?.downloadId === downloadId)
                closePlayer();
              handleCloseContextMenu();
            }}
            onAddTag={handleFavAddTag}
            onRemoveTag={handleFavRemoveTag}
            currentTags={activeFav.tags}
            availableTags={availableTags}
            onAddCategory={handleFavAddCategory}
            onRemoveCategory={handleFavRemoveCategory}
            currentCategories={activeFav.category}
            availableCategories={availableCategories}
          />
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;
