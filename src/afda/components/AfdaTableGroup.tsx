import {
  AfdaWebsiteLoadingIcon,
  AfdaWebsiteLoadingName,
} from '@/afda/components/AfdaWebsiteLoading';
import { useAfdaWebsiteDisplay } from '@/afda/store/afdaWebsiteMetaCache';
import {
  useAfdaWebsitesStore,
  websiteStatusLabel,
} from '@/afda/store/afdaWebsitesStore';
import { getFaviconUrl } from '@/afda/utils/faviconUrl';
import type { DisplayColumn } from '@/downlodr/pages/status/statusPageTypes';
import { formatRelativeTime } from '@/downlodr/pages/status/statusPageUtils';
import type { ArticleSearchableDownload } from '@/downlodr/store/taskbarDownloadStore';
import { subStatusColor } from '@/skedulosa/utils/skedulosaGroupUtils';
import React, { useCallback, useMemo } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core-app/components/shadcn/components/ui/tooltip';
import { FaCircle } from 'react-icons/fa';
import { LuEye, LuNewspaper } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';

interface AfdaTableGroupProps {
  websiteId: string;
  downloads: ArticleSearchableDownload[];
  displayColumns: DisplayColumn[];
  selectedRowIds: string[];
  selectedDownloadId: string | null;
  onRowClick: (id: string) => void;
  /**
   * The group's checkbox was clicked. `shiftKey` asks the page to select the
   * range from the last clicked row — this group counts as a single row.
   */
  onGroupCheckboxChange: (shiftKey?: boolean) => void;
  onClosePluginSidebar: () => void;
}

/** Collapsed summary row for a publication — mirrors SkedulosaTableGroup's layout. */
const AfdaTableGroup = React.memo(
  ({
    websiteId,
    downloads,
    displayColumns,
    selectedRowIds,
    onGroupCheckboxChange,
  }: AfdaTableGroupProps) => {
    const navigate = useNavigate();

    // Falls back to cached name/url while the AFDA worker is still starting.
    const website = useAfdaWebsiteDisplay(websiteId);
    // Status and dates only exist on the live entry; until the worker is up
    // those cells show "—" rather than guessing.
    const liveWebsite = useAfdaWebsitesStore((s) =>
      s.websites.find((w) => w.id === websiteId),
    );
    // Nothing live or cached: show a loading placeholder until the worker has
    // loaded, then fall back to the raw id (the website is genuinely unknown).
    const websitesLoaded = useAfdaWebsitesStore((s) => s.loaded);
    const isResolving = !website && !websitesLoaded;

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

    const websiteName = website?.name ?? websiteId;
    const faviconUrl = getFaviconUrl(website?.url ?? '');
    const isSocial = website?.kind === 'social';
    const itemNoun = isSocial ? 'post' : 'article';
    const articleCount = downloads.length;
    const subStatus = liveWebsite
      ? websiteStatusLabel(liveWebsite.status)
      : '—';
    const lastChecked = liveWebsite?.lastScrapedAt ?? '';

    const formatLabel = useMemo(() => {
      const formats = new Set(
        downloads.map((d) => d.format ?? d.ext ?? 'docx'),
      );
      return [...formats].sort().join(' / ');
    }, [downloads]);

    const dateCreated = useMemo(() => {
      if (liveWebsite?.createdAt) return liveWebsite.createdAt;
      if (downloads.length === 0) return '';
      return downloads.reduce((earliest, d) => {
        if (!earliest) return d.DateAdded;
        return d.DateAdded < earliest ? d.DateAdded : earliest;
      }, '');
    }, [liveWebsite?.createdAt, downloads]);

    const favicon = (sizeClass: string) =>
      isResolving ? (
        <AfdaWebsiteLoadingIcon className={sizeClass} />
      ) : faviconUrl ? (
        <img
          src={faviconUrl}
          alt=""
          className={`${sizeClass} rounded-full object-contain flex-shrink-0`}
        />
      ) : (
        <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
          <LuNewspaper size={16} className="text-blue-500 dark:text-blue-400" />
        </div>
      );

    return (
      <tr
        // Shift-click extends the selection instead of opening the group.
        onClick={(e) => {
          if (e.shiftKey) {
            onGroupCheckboxChange(true);
            return;
          }
          navigate(`/status/group/afda/${websiteId}`);
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
                    {favicon('w-10 h-10')}
                    <div>
                      <div className="flex gap-2 mt-1">
                        <div className="bg-primary rounded-xl px-3 text-white flex-shrink-0 h-4 flex mt-1.5 items-center justify-center">
                          <span className="font-semibold text-[10px] mt-0.5">
                            SUB
                          </span>
                        </div>
                        <span className="line-clamp-1 font-bold py-1">
                          {isResolving ? (
                            <AfdaWebsiteLoadingName />
                          ) : (
                            websiteName
                          )}
                        </span>
                      </div>
                      <div className="-mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {articleCount} {itemNoun}
                        {articleCount !== 1 ? 's' : ''} · last checked{' '}
                        {lastChecked
                          ? formatRelativeTime(lastChecked)
                          : 'never checked'}
                      </div>
                    </div>
                  </div>
                </td>
              );
            case 'format':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="p-2 text-center"
                >
                  {formatLabel}
                </td>
              );
            case 'status':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="p-2 dark:text-gray-200 text-center"
                >
                  {liveWebsite ? (
                    <div
                      className={`flex items-center justify-center gap-1.5 ${subStatusColor(
                        subStatus,
                      )}`}
                    >
                      <FaCircle size={8} />
                      <span>{subStatus}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
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
            case 'source':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="p-2 dark:text-gray-200"
                >
                  <div className="flex justify-center items-center">
                    {favicon('w-6 h-6')}
                  </div>
                </td>
              );

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
                            <span className="text-gray-400">
                              {isSocial ? 'Posts' : 'Articles'}
                            </span>
                            <span className="font-medium">{articleCount}</span>
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
              return <td key={column.id} style={{ width: column.width }} />;
          }
        })}
      </tr>
    );
  },
);

AfdaTableGroup.displayName = 'AfdaTableGroup';

export default AfdaTableGroup;
