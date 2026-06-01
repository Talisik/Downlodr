/**
 * Single table row for the Status page: checkbox + all column cells.
 */
import { Skeleton } from '@/core-app/components/shadcn/components/ui/skeleton';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import DownloadButton from '@/downlodr/components/download/DownloadButton';
import FormatSelector from '@/downlodr/components/download/FormatSelector';
import { AnimatedLinearProgressBar } from '@/downlodr/components/download/LinearProgress';
import ShareButton from '@/downlodr/components/download/ShareButton';
import SpeedGraph from '@/downlodr/components/download/SpeedGraph';
import TranscrptButton from '@/downlodr/components/download/TranscrptButton';
import type { FinishedDownloads } from '@/downlodr/store/download/types';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import {
  getExtractorIcon,
  getStatusIcon,
} from '@/downlodr/utils/icons/iconMapper';
import { useFavoritesStore } from '@/downlodr/store/favoritesStore';
import React from 'react';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { FiPlayCircle } from 'react-icons/fi';
import { HiOutlineFolderOpen } from 'react-icons/hi';
import { VscPlayCircle } from 'react-icons/vsc';
import type {
  DisplayColumn,
  SearchableDownload,
  StatusPageRowHandlers,
} from './statusPageTypes';
import {
  formatFileSize,
  formatRelativeTime,
  getStatusColor,
} from './statusPageUtils';
import { Separator } from '@radix-ui/react-separator';

const FavoriteButton: React.FC<{ download: SearchableDownload }> = ({
  download,
}) => {
  const isFavorited = useFavoritesStore((s) => s.isFavorited(download.id));
  const addFavorite = useFavoritesStore((s) => s.addFavorite);
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFavorited) {
      removeFavorite(download.id);
    } else {
      addFavorite({
        downloadId: download.id,
        videoUrl: download.videoUrl ?? '',
        title: download.name ?? '',
        displayName: download.displayName,
        downloadName: download.downloadName ?? '',
        location: download.location ?? '',
        channelName: download.channelName ?? '',
        thumbnail:
          typeof download.thumbnails === 'string' && download.thumbnails !== '—'
            ? download.thumbnails
            : undefined,
        ext: download.ext ?? '',
        duration: download.duration ?? 0,
        size: download.size ?? 0,
        extractorKey: download.extractorKey ?? '',
        tags: download.tags ?? [],
        category: download.category ?? [],
        description: download.description,
        status: download.status ?? '',
        autoCaptionLocation: download.autoCaptionLocation,
        transcriptLocation: download.transcriptLocation,
        dateAdded: download.DateAdded ?? '',
      });
    }
  };

  return (
    <button
      onClick={handleClick}
      className="p-1 hover:opacity-80 transition-opacity"
      title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      {isFavorited ? (
        <FaHeart size={14} className="text-red-400" />
      ) : (
        <FaRegHeart size={14} className="text-gray-400 dark:text-gray-500" />
      )}
    </button>
  );
};

const THUMB_PLACEHOLDER_CLASS =
  'h-9 w-14 rounded cursor-pointer overflow-hidden flex justify-center items-center bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.5)_0%,transparent_45%),radial-gradient(circle_at_45%_80%,rgba(255,255,255,0.4)_0%,transparent_35%),linear-gradient(135deg,#ffa42e,#fec77d,#ffa42e,#fec170)]';

export interface StatusPageTableRowProps {
  download: SearchableDownload;
  displayColumns: DisplayColumn[];
  thumbnailDataUrls: Record<string, string>;
  isChecked: boolean;
  isSelectedDownload: boolean;
  index: number;
  handlers: StatusPageRowHandlers;
  isGrouped?: boolean;
}

export const StatusPageTableRow: React.FC<StatusPageTableRowProps> = ({
  download,
  displayColumns,
  thumbnailDataUrls,
  isChecked,
  isSelectedDownload,
  index,
  handlers,
  isGrouped = false,
}) => {
  const {
    onContextMenu,
    onRowClick,
    onCheckboxChange,
    onViewFile,
    onViewDownload,
    onViewFolder,
    onRetry,
    onPause,
    onRedownloadTranscript,
    onFormatSelect,
    onViewEmbed,
  } = handlers;

  const { t } = useTranslation('downlodr');
  const searchQuery = useTaskbarDownloadStore((s) => s.searchState.searchQuery);

  const highlightText = (text: string) => {
    if (!searchQuery) return text;
    const regex = new RegExp(
      `(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'gi',
    );
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          className="bg-yellow-200 dark:bg-yellow-600 text-inherit rounded-sm px-0"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  const handleRowClick = () => {
    console.log(
      `[StatusPageTableRow] Selected: "${
        download.displayName || download.name
      }" | Status: ${download.status}`,
    );
    onRowClick();
    onCheckboxChange();
  };

  return (
    <tr
      className={`border-b-2 hover:bg-gray-50 dark:border-[#27272ACC] dark:hover:bg-darkModeHover cursor-pointer ${
        isSelectedDownload
          ? 'bg-blue-50  dark:bg-darkMode'
          : index === length - 1
          ? 'border-b-0'
          : 'dark:bg-darkMode'
      } ${
        isGrouped ? 'bg-gray-50 dark:bg-darkMode' : 'bg-white dark:bg-darkMode'
      }`}
      onContextMenu={(e) => onContextMenu(e, download)}
      onClick={handleRowClick}
      data-download-id={download.id}
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData('downloadId', download.id);
        const dragIcon = document.createElement('div');
        dragIcon.className = 'bg-white p-2 rounded shadow';
        dragIcon.textContent = download.name;
        document.body.appendChild(dragIcon);
        e.dataTransfer.setDragImage(dragIcon, 0, 0);
        setTimeout(() => document.body.removeChild(dragIcon), 0);
      }}
    >
      <td className="w-8 p-2">
        <input
          type="checkbox"
          className="ml-2 mt-1 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation();
            onCheckboxChange();
          }}
        />
      </td>
      {displayColumns.map((column) => {
        switch (column.id) {
          case 'name':
            return (
              <td
                key={column.id}
                style={{ width: column.width }}
                className={`p-2 dark:text-gray-200 flex justify-start items-center `}
              >
                {isGrouped ? (
                  <div className="flex items-center self-stretch mr-3 pl-4">
                    <Separator
                      orientation="vertical"
                      className="h-full w-[1px] bg-primary dark:bg-primary"
                    />
                  </div>
                ) : null}
                {download.status === 'fetching metadata' ? (
                  <div className="space-y-1">
                    <Skeleton
                      className="h-4 rounded-[3px]"
                      style={{ width: `${column.width - 20}px` }}
                    />
                    <Skeleton
                      className="h-4 rounded-[3px]"
                      style={{ width: `${column.width - 60}px` }}
                    />
                  </div>
                ) : [
                    'finished',
                    'paused',
                    'downloading',
                    'failed',
                    'initializing',
                  ].includes(download.status) ? (
                  <div className="flex items-start gap-3 w-full">
                    <div className="flex-shrink-0">
                      {download.thumnailsLocation &&
                      download.thumnailsLocation !== '—' ? (
                        thumbnailDataUrls[download.id] ? (
                          <TooltipWrapper
                            content={t('statusPage.thumbnail.viewFull')}
                            side="bottom"
                          >
                            <div
                              className="h-9 w-14 bg-black flex rounded cursor-pointer overflow-hidden justify-center items-center flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewFile(
                                  download.thumnailsLocation,
                                  download.id,
                                );
                              }}
                            >
                              <img
                                src={thumbnailDataUrls[download.id]}
                                alt="Thumbnail"
                                className="max-h-full max-w-full object-contain hover:opacity-70 transition-opacity"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const parent = e.currentTarget.parentElement;
                                  if (parent)
                                    parent.innerHTML = t(
                                      'statusPage.thumbnail.unableToLoad',
                                    );
                                }}
                              />
                            </div>
                          </TooltipWrapper>
                        ) : (
                          <TooltipWrapper
                            content={t('statusPage.thumbnail.notDownloaded')}
                            side="bottom"
                          >
                            <div
                              className={`h-10 w-16 flex-shrink-0 ${THUMB_PLACEHOLDER_CLASS}`}
                            >
                              <FiPlayCircle size={20} color="#F45513" />
                            </div>
                          </TooltipWrapper>
                        )
                      ) : (
                        <TooltipWrapper
                          content={t('statusPage.thumbnail.notAvailable')}
                          side="bottom"
                        >
                          <div className="h-9 w-14 bg-black flex rounded cursor-pointer overflow-hidden flex-shrink-0">
                            <FiPlayCircle size={20} />
                          </div>
                        </TooltipWrapper>
                      )}
                    </div>
                    <div className="line-clamp-2 break-words flex justify-start items-start min-w-0 flex-1">
                      <div className="w-full justify-start items-start">
                        <TooltipWrapper
                          content={download.displayName || download.name}
                          side="bottom"
                          contentClassname="text-start justify-start"
                        >
                          <div>
                            <span className="line-clamp-1 break-words break-all font-semibold">
                              {highlightText(
                                download.displayName || download.name,
                              )}
                            </span>
                          </div>
                        </TooltipWrapper>
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {download.channelName}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : download.status === 'fetching metadata' ? (
                  <div className="space-y-1">
                    <Skeleton
                      className="h-4 rounded-[3px]"
                      style={{ width: `${column.width - 20}px` }}
                    />
                    <Skeleton
                      className="h-4 rounded-[3px]"
                      style={{ width: `${column.width - 60}px` }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex-shrink-0">
                      <TooltipWrapper
                        content={t('statusPage.thumbnail.notAvailable')}
                        side="bottom"
                      >
                        <div className={`h-9 w-14 ${THUMB_PLACEHOLDER_CLASS}`}>
                          <FiPlayCircle size={20} color="#F45513" />
                        </div>
                      </TooltipWrapper>
                    </div>
                    <span className="line-clamp-1 break-words break-all font-semibold min-w-0 flex-1">
                      {highlightText(download.displayName || download.name)}
                    </span>
                  </div>
                )}
              </td>
            );
          case 'size':
            return (
              <td
                key={column.id}
                style={{ width: column.width }}
                className="px-2 py-2 dark:text-gray-200 text-left"
              >
                {download.status === 'to download' ||
                download.status === 'failed' ? (
                  <span className="whitespace-nowrap overflow-hidden">
                    0 MB
                  </span>
                ) : download.status === 'fetching metadata' ? (
                  <div className="flex justify-center items-center">
                    <Skeleton className="h-8 w-[50px] rounded-[3px]" />
                  </div>
                ) : (
                  <span className="whitespace-nowrap overflow-hidden">
                    {formatFileSize(download.size)}
                  </span>
                )}
              </td>
            );
          case 'format':
            return (
              <td
                key={column.id}
                style={{ width: Math.max(column.width), minWidth: '70px' }}
                className="p-2 text-center align-middle"
              >
                {download.status === 'fetching metadata' ? (
                  <div className="flex justify-center items-center w-full">
                    <Skeleton
                      className="h-8 rounded-[3px]"
                      style={{
                        width: `${Math.max(column.width - 70, 90)}px`,
                      }}
                    />
                  </div>
                ) : download.status === 'finished' ? (
                  <div className="text font-medium text-sm text-gray-600 dark:text-gray-300 text-center">
                    {download.ext ||
                      download.audioExt ||
                      t('statusPage.format.unknown')}
                  </div>
                ) : (
                  <div className="w-full">
                    <FormatSelector
                      download={download}
                      onFormatSelect={(formatData) => {
                        useDownloadStore.setState((state) => ({
                          forDownloads: state.forDownloads.map((d) =>
                            d.id === download.id
                              ? {
                                  ...d,
                                  ext: formatData.ext,
                                  formatId: formatData.formatId,
                                  audioExt: formatData.audioExt,
                                  audioFormatId: formatData.audioFormatId,
                                }
                              : d,
                          ),
                        }));
                        onFormatSelect(formatData);
                      }}
                    />
                  </div>
                )}
              </td>
            );
          case 'status':
            return (
              <td
                key={column.id}
                style={{ width: column.width - 10 }}
                className="p-1 ml-1"
              >
                {[
                  'cancelled',
                  'initializing',
                  'queued',
                  'fetching metadata',
                ].includes(download.status) ? (
                  <div className="flex justify-center">
                    <TooltipWrapper
                      content={
                        download.status.charAt(0).toUpperCase() +
                        download.status.slice(1)
                      }
                      side="bottom"
                    >
                      <div className="ml-[2.5px] flex items-center justify-center space-x-2">
                        {getStatusIcon(download.status, 20)}
                      </div>
                    </TooltipWrapper>
                  </div>
                ) : download.status === 'failed' ? (
                  <div className="flex justify-center">
                    <TooltipWrapper
                      content={t('statusPage.status.clickToRetry')}
                      side="bottom"
                    >
                      <button
                        className="ml-[2px] flex items-center justify-center space-x-2 hover:opacity-75 transition-opacity cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetry(download.id);
                        }}
                      >
                        {getStatusIcon(download.status, 20)}
                      </button>
                    </TooltipWrapper>
                  </div>
                ) : download.status === 'finished' ? (
                  <div className="ml-3 flex items-center space-x-2 justify-center">
                    <button
                      className="flex items-center text-sm underline"
                      style={{ color: getStatusColor(download.status) }}
                    >
                      <TooltipWrapper
                        content={t('statusPage.status.viewVideo')}
                        side="bottom"
                      >
                        <span>
                          <VscPlayCircle
                            size={20}
                            className="text-green-600 hover:text-green-400 transition-colors duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewEmbed(download);
                            }}
                          />
                        </span>
                      </TooltipWrapper>
                      <TooltipWrapper
                        content={t('statusPage.status.openFolder')}
                        side="bottom"
                      >
                        <span
                          className="ml-2 hover:text-green-400 transition-colors"
                          onClick={async (e) => {
                            e.stopPropagation();
                            onViewFolder(download.location, download.name);
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
                ) : download.status === 'to download' ? (
                  <div className="ml-1 flex items-center space-x-2 justify-center">
                    <div
                      style={{ color: getStatusColor(download.status) }}
                      className="flex items-center text-sm underline"
                    >
                      <TooltipWrapper content="View preview" side="bottom">
                        <span>
                          <VscPlayCircle
                            size={20}
                            className="text-green-600 hover:text-green-400 transition-colors duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewEmbed(download);
                            }}
                          />
                        </span>
                      </TooltipWrapper>
                      <DownloadButton
                        download={{
                          ...download,
                          displayName: download.displayName || '',
                        }}
                        subscriptionId={download.subscriptionId}
                      />
                    </div>
                  </div>
                ) : download.status === 'paused' ||
                  download.status === 'downloading' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPause(download.id);
                    }}
                    className="ml-2 hover:bg-gray-100 dark:hover:bg-darkModeHover w-full flex items-center justify-center"
                  >
                    <AnimatedLinearProgressBar
                      status={download.status}
                      max={100}
                      min={0}
                      value={download.progress}
                      gaugePrimaryColor="#4CAF50"
                      gaugeSecondaryColor="#EEEEEE"
                      width={column.width - 10}
                    />
                  </button>
                ) : (
                  <AnimatedLinearProgressBar
                    status={download.status}
                    max={100}
                    min={0}
                    value={download.progress}
                    gaugePrimaryColor="#4CAF50"
                    gaugeSecondaryColor="#EEEEEE"
                    width={column.width - 10}
                  />
                )}
              </td>
            );
          case 'speed':
            return (
              <td
                key={column.id}
                style={{ width: column.width }}
                className="pl-2 py-2 dark:text-gray-200 flex justify-center items-center"
              >
                {[
                  'downloading',
                  'finished',
                  'paused',
                  'failed',
                  'initializing',
                ].includes(download.status) ? (
                  <div className="w-full">
                    <SpeedGraph
                      key={`speed-graph-${download.id}`}
                      currentSpeed={download.speed}
                      downloadStatus={download.status}
                      downloadId={download.id}
                      showHeader={false}
                      height={25}
                    />
                  </div>
                ) : download.status === 'fetching metadata' ? (
                  <div className="space-y-1 flex justify-center items-center">
                    <Skeleton className="h-8 w-[50px] rounded-[3px]" />
                  </div>
                ) : (
                  <div className="flex justify-center w-full">
                    <span>—</span>
                  </div>
                )}
              </td>
            );
          case 'dateAdded':
            return (
              <td
                key={column.id}
                style={{ width: column.width }}
                className="p-2 dark:text-gray-200 ml-2 justify-center text-center"
              >
                <TooltipWrapper
                  content={new Date(download.DateAdded).toLocaleDateString()}
                  side="bottom"
                >
                  <div>{formatRelativeTime(download.DateAdded)}</div>
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
                <TranscrptButton
                  download={download as FinishedDownloads}
                  column={column}
                  onViewFile={onViewFile}
                />
              </td>
            );
          case 'source':
            return (
              <td
                key={column.id}
                style={{ width: column.width }}
                className="p-2 dark:text-gray-200"
              >
                {download.status === 'fetching metadata' ? (
                  <div className="flex justify-center items-center">
                    <Skeleton className="h-6 w-[25px] rounded-[3px]" />
                  </div>
                ) : (
                  <TooltipWrapper content={download.extractorKey} side="bottom">
                    <div className="line-clamp-2 break-words flex justify-center items-center text-lg">
                      <a
                        onClick={(e) => {
                          e.stopPropagation();
                          window.downlodrFunctions.openExternalLink(
                            download.videoUrl,
                          );
                        }}
                        className="hover:underline cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        {getExtractorIcon(download.extractorKey)}
                      </a>
                    </div>
                  </TooltipWrapper>
                )}
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
                  <FavoriteButton download={download} />
                  <ShareButton
                    videoUrl={download.videoUrl}
                    name={download.name}
                    status={download.status}
                    thumbnailLocation={thumbnailDataUrls[download.id]}
                    format={download.ext || download.audioExt}
                    size={download.size}
                  />
                </div>
              </td>
            );
          default:
            return null;
        }
      })}
    </tr>
  );
};
