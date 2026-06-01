import { useResizableColumns } from '@/downlodr/components/download/resizableColumns/useResizableColumns';
import VideoPlayerPanel from '@/downlodr/components/panel/VideoPlayerPanel';
import ResizableHeader from '@/downlodr/components/download/resizableColumns/ResizableHeader';
import ShareButton from '@/downlodr/components/download/ShareButton';
import {
  FavoriteItem,
  useFavoritesStore,
} from '@/downlodr/store/favoritesStore';
import { getExtractorIcon } from '@/downlodr/utils/icons/iconMapper';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import {
  formatRelativeTime,
  formatFileSize,
  getColumnDisplayName,
} from '@/downlodr/pages/status/statusPageUtils';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FaHeart } from 'react-icons/fa';
import { HiChevronUpDown } from 'react-icons/hi2';

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

  const initialColumns = useMemo(
    () => [
      {
        id: 'name',
        width: Math.max(Math.floor(window.innerWidth * 0.3), 180),
        minWidth: 180,
      },
      { id: 'size', width: 70, minWidth: 50 },
      { id: 'format', width: 90, minWidth: 70 },
      { id: 'dateAdded', width: 100, minWidth: 80 },
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
        ['name', 'size', 'format', 'dateAdded', 'source', 'action'].includes(
          col.id,
        ),
      ),
    [columns],
  );

  const [sortColumn, setSortColumn] = useState<string>('dateAdded');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSortClick = useCallback(
    (column: string) => {
      if (sortColumn === column) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSortColumn(column);
        setSortDirection('desc');
      }
    },
    [sortColumn, sortDirection],
  );

  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback(() => {
    setIsScrolling(true);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => setIsScrolling(false), 800);
  }, []);

  const [videoPlayerState, setVideoPlayerState] = useState<{
    isOpen: boolean;
    fav: FavoriteItem | null;
  }>({ isOpen: false, fav: null });
  const [panelWidth, setPanelWidth] = useState(75);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openPlayer = (fav: FavoriteItem) => {
    setVideoPlayerState({ isOpen: true, fav });
  };

  const closePlayer = () => {
    setVideoPlayerState({ isOpen: false, fav: null });
    setSelectedId(null);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-darkMode">
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
          >
            <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <FaHeart className="text-red-400" size={16} />
              <span className="font-semibold text-xs dark:text-gray-200">
                Favorites
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                ({favorites.length})
              </span>
            </div>

            {favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400 dark:text-gray-500">
                <FaHeart size={40} className="opacity-20" />
                <p className="text-base font-medium">No favorites yet</p>
                <p className="text-xs">
                  Heart a video in the player to save it here
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
                              {renderSortIndicator(
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
                  {favorites.map((fav) => (
                    <tr
                      key={fav.id}
                      className={`border-b-2 hover:bg-gray-50 dark:border-[#27272ACC] dark:hover:bg-darkModeHover cursor-pointer ${
                        selectedId === fav.id
                          ? 'bg-blue-50 dark:bg-gray-600'
                          : 'dark:bg-darkMode'
                      }`}
                      onClick={() => {
                        if (fav.id === selectedId) {
                          setSelectedId(null);
                          closePlayer();
                        } else {
                          setSelectedId(fav.id);
                          openPlayer(fav);
                        }
                      }}
                    >
                      {displayColumns.map((column) => {
                        switch (column.id) {
                          case 'name':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200"
                              >
                                <div className="flex items-center gap-3">
                                  {fav.thumbnail && fav.thumbnail !== '—' && (
                                    <img
                                      src={fav.thumbnail}
                                      alt="thumbnail"
                                      className="h-9 w-16 object-cover rounded flex-shrink-0 bg-black"
                                      onError={(e) => {
                                        (
                                          e.target as HTMLImageElement
                                        ).style.display = 'none';
                                      }}
                                    />
                                  )}
                                  <TooltipWrapper
                                    content={fav.displayName ?? fav.title}
                                    side="bottom"
                                  >
                                    <span className="line-clamp-2 text-xxs break-words">
                                      {fav.displayName ?? fav.title}
                                    </span>
                                  </TooltipWrapper>
                                </div>
                              </td>
                            );
                          case 'size':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200 text-xs"
                              >
                                {formatFileSize(fav.size)}
                              </td>
                            );
                          case 'format':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200 text-xs"
                              >
                                {fav.ext ? fav.ext.toUpperCase() : '—'}
                              </td>
                            );
                          case 'dateAdded':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200 text-xs"
                              >
                                {fav.dateAdded
                                  ? formatRelativeTime(fav.dateAdded)
                                  : '—'}
                              </td>
                            );
                          case 'source':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200 text-center"
                              >
                                <TooltipWrapper
                                  content={fav.extractorKey}
                                  side="bottom"
                                >
                                  <a
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.downlodrFunctions.openExternalLink(
                                        fav.videoUrl,
                                      );
                                    }}
                                    className="hover:underline cursor-pointer hover:opacity-80 transition-opacity flex justify-center text-lg"
                                  >
                                    {getExtractorIcon(fav.extractorKey)}
                                  </a>
                                </TooltipWrapper>
                              </td>
                            );
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
    </div>
  );
};

export default FavoritesPage;
