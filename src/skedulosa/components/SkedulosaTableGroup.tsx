/**
 * Accordion group row for the Status page.
 * Groups downloads that share a subscriptionId under a summary row.
 * Clicking the row navigates to the subscription detail page.
 */
import type {
  DisplayColumn,
  FormatSelectData,
  SearchableDownload,
} from '@/downlodr/pages/status/statusPageTypes';
import {
  formatFileSize,
  formatRelativeTime,
} from '@/downlodr/pages/status/statusPageUtils';
import { getExtractorIcon } from '@/downlodr/utils/icons/iconMapper';
import {
  aggregateGroupSize,
  getGroupLastUpdated,
  getGroupVideoCount,
} from '@/skedulosa/utils/skedulosaGroupUtils';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import React, { useCallback, useMemo } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core-app/components/shadcn/components/ui/tooltip';
import { FaCircle } from 'react-icons/fa';
import { LuEye } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';

export interface SkedulosaTableGroupProps {
  subscriptionId: string;
  downloads: SearchableDownload[];
  displayColumns: DisplayColumn[];
  thumbnailDataUrls: Record<string, string>;
  selectedRowIds: string[];
  selectedDownloadId: string | null;
  onContextMenu: (e: React.MouseEvent, download: SearchableDownload) => void;
  onRowClick: (downloadId: string) => void;
  onViewFile: (location?: string, downloadId?: string) => void;
  onViewDownload: (location?: string, downloadId?: string) => void;
  onViewFolder: (location?: string, filePath?: string) => void;
  onRetry: (downloadId: string) => void;
  onPause: (downloadId: string) => void;
  onRedownloadTranscript: (downloadId: string) => void;
  onFormatSelect: (formatData: FormatSelectData) => void;
  onClosePluginSidebar: () => void;
  /**
   * The group's checkbox was clicked. `shiftKey` asks the page to select the
   * range from the last clicked row — this group counts as a single row.
   */
  onGroupCheckboxChange: (shiftKey?: boolean) => void;
  onViewEmbed: (download: SearchableDownload) => void;
  pendingCount?: number;
}

const subStatusColor = (status: string): string => {
  switch (status) {
    case 'Active':
      return 'text-green-500';
    case 'Paused':
      return 'text-yellow-500';
    case 'Error':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
};

const SkedulosaTableGroup = React.memo(
  ({
    subscriptionId,
    downloads,
    displayColumns,
    selectedRowIds,
    onGroupCheckboxChange,
    pendingCount = 0,
  }: SkedulosaTableGroupProps) => {
    const navigate = useNavigate();

    const selectedSet = useMemo(
      () => new Set(selectedRowIds),
      [selectedRowIds],
    );

    const isAllSelected = useMemo(
      () =>
        downloads.length > 0 && downloads.every((d) => selectedSet.has(d.id)),
      [downloads, selectedSet],
    );

    const isIndeterminate = useMemo(
      () => !isAllSelected && downloads.some((d) => selectedSet.has(d.id)),
      [downloads, selectedSet, isAllSelected],
    );

    const checkboxRef = useCallback(
      (node: HTMLInputElement | null) => {
        if (node) node.indeterminate = isIndeterminate;
      },
      [isIndeterminate],
    );

    const subscription = useSkedulosaStore((state) =>
      state.subscriptions.find((sub) => sub.id === subscriptionId),
    );

    const aggregatedSize = useMemo(
      () => aggregateGroupSize(downloads),
      [downloads],
    );

    const videoCount = useMemo(
      () => getGroupVideoCount(downloads),
      [downloads],
    );

    const sourceName = subscription?.source ?? subscriptionId;
    const subStatus = subscription?.status ?? '—';
    const lastChecked = subscription?.last_checked_time ?? '';

    const dateCreated = useMemo(() => {
      if (subscription?.date_created) return subscription.date_created;
      if (downloads.length === 0) return '';
      return downloads.reduce((earliest, d) => {
        if (!earliest) return d.DateAdded;
        return d.DateAdded < earliest ? d.DateAdded : earliest;
      }, '');
    }, [subscription?.date_created, downloads]);

    return (
      <tr
        // Shift-click extends the selection instead of opening the subscription.
        onClick={(e) => {
          if (e.shiftKey) {
            onGroupCheckboxChange(true);
            return;
          }
          navigate(`/status/group/subscription/${subscriptionId}`);
        }}
        // Shift-click otherwise highlights the text between the two rows.
        onMouseDown={(e) => {
          if (e.shiftKey) e.preventDefault();
        }}
        className="pl-4 border-b dark:border-darkModeTableBorder cursor-pointer"
      >
        <td className="w-8 p-2">
          <input
            ref={checkboxRef}
            type="checkbox"
            className="ml-2 mt-1 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
            checked={isAllSelected}
            onChange={() => {
              /* handled via onClick */
            }}
            onClick={(e) => {
              e.stopPropagation();
              onGroupCheckboxChange(e.shiftKey);
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
                  className="p-2 dark:text-gray-200"
                >
                  <div className="flex items-center gap-2">
                    {subscription?.channel_details?.avatarUrl && (
                      <img
                        src={subscription.channel_details.avatarUrl}
                        alt={sourceName}
                        className="h-10 w-10 rounded-full flex-shrink-0 object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <div className="flex gap-2 mt-1">
                        <div className="bg-primary rounded-xl px-3 text-white flex-shrink-0 h-4 flex mt-1.5 items-center justify-center">
                          <span className="font-semibold text-[10px] mt-0.5">
                            SUB
                          </span>
                        </div>
                        <span className="line-clamp-1 font-bold py-1">
                          {sourceName}
                        </span>
                      </div>
                      <div className="-mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {videoCount} videos · last checked{' '}
                        {lastChecked &&
                        dateCreated &&
                        new Date(lastChecked) >= new Date(dateCreated)
                          ? formatRelativeTime(lastChecked)
                          : dateCreated
                          ? formatRelativeTime(dateCreated)
                          : 'never checked'}
                        {pendingCount > 0 && (
                          <span className="ml-1 text-primary">
                            · +{pendingCount} queued
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
              );
            case 'size':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="px-2 py-2 dark:text-gray-200 text-left"
                >
                  {formatFileSize(aggregatedSize)}
                </td>
              );
            case 'format':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="p-2 text-center"
                >
                  mp4
                </td>
              );
            case 'status':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="p-2 dark:text-gray-200 text-center"
                >
                  <div
                    className={`flex items-center justify-center gap-1.5 ${subStatusColor(
                      subStatus,
                    )}`}
                  >
                    <FaCircle size={8} />
                    <span>{subStatus}</span>
                  </div>
                </td>
              );
            case 'speed':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="p-2 dark:text-gray-200 text-center"
                >
                  —
                </td>
              );
            case 'dateAdded':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="p-2 dark:text-gray-200 text-center"
                >
                  {dateCreated ? formatRelativeTime(dateCreated) : '—'}
                </td>
              );
            case 'transcript':
              return <td key={column.id} style={{ width: column.width }} />;
            case 'source':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="p-2 dark:text-gray-200"
                >
                  <div className="flex justify-center items-center">
                    {getExtractorIcon('youtube')}
                  </div>
                </td>
              );
            case 'action':
              return <td key={column.id} style={{ width: column.width }} />;
            case 'eye':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="p-2 text-center"
                >
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="flex justify-center cursor-default"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <LuEye
                            size={14}
                            className="text-gray-400 dark:text-gray-500"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="p-2">
                        <div className="space-y-1 text-xs">
                          <div className="flex gap-4 justify-between">
                            <span className="text-gray-400">Videos</span>
                            <span className="font-medium">{videoCount}</span>
                          </div>
                          <div className="flex gap-4 justify-between">
                            <span className="text-gray-400">Size</span>
                            <span className="font-medium">
                              {aggregatedSize
                                ? formatFileSize(aggregatedSize)
                                : '—'}
                            </span>
                          </div>
                          {lastChecked && (
                            <div className="flex gap-4 justify-between">
                              <span className="text-gray-400">
                                Last checked
                              </span>
                              <span className="font-medium">
                                {formatRelativeTime(lastChecked)}
                              </span>
                            </div>
                          )}
                          <div className="flex gap-4 justify-between">
                            <span className="text-gray-400">Status</span>
                            <span className="font-medium">{subStatus}</span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </td>
              );
            default:
              return null;
          }
        })}
      </tr>
    );
  },
);

SkedulosaTableGroup.displayName = 'SkedulosaTableGroup';

export default SkedulosaTableGroup;
