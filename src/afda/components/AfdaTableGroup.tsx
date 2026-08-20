import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';
import { getFaviconUrl } from '@/afda/utils/faviconUrl';
import type { DisplayColumn } from '@/downlodr/pages/status/statusPageTypes';
import { formatRelativeTime } from '@/downlodr/pages/status/statusPageUtils';
import type { ArticleSearchableDownload } from '@/downlodr/store/taskbarDownloadStore';
import React, { useCallback, useMemo } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core-app/components/shadcn/components/ui/tooltip';
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

const AfdaTableGroup = React.memo(
  ({
    websiteId,
    downloads,
    displayColumns,
    selectedRowIds,
    onGroupCheckboxChange,
  }: AfdaTableGroupProps) => {
    const navigate = useNavigate();

    const website = useAfdaWebsitesStore((s) =>
      s.websites.find((w) => w.id === websiteId),
    );

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
    const latestDate = useMemo(
      () =>
        downloads.reduce(
          (latest, d) => (d.DateAdded > latest ? d.DateAdded : latest),
          '',
        ),
      [downloads],
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
                    {faviconUrl ? (
                      <img
                        src={faviconUrl}
                        className="w-10 h-10 rounded-full object-contain flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <LuNewspaper
                          size={16}
                          className="text-blue-500 dark:text-blue-400"
                        />
                      </div>
                    )}
                    <div>
                      <div className="flex gap-2 mt-1">
                        <div className="bg-primary rounded-xl px-3 text-white flex-shrink-0 h-4 flex mt-1.5 items-center justify-center">
                          <span className="font-semibold text-[10px] mt-0.5">
                            SUB
                          </span>
                        </div>
                        <span className="line-clamp-1 font-bold py-1">
                          {websiteName}
                        </span>
                      </div>
                      <div className="-mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {articleCount} {itemNoun}
                        {articleCount !== 1 ? 's' : ''}
                        {latestDate &&
                          ` · last added ${formatRelativeTime(latestDate)}`}
                      </div>
                    </div>
                  </div>
                </td>
              );

            case 'status':
              return (
                <td
                  key={column.id}
                  style={{ width: column.width }}
                  className="p-2 dark:text-gray-200 text-center"
                >
                  <span className="text-xs text-gray-400">—</span>
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
                          {latestDate && (
                            <div className="flex gap-4 justify-between">
                              <span className="text-gray-400">Latest</span>
                              <span className="font-medium">
                                {formatRelativeTime(latestDate)}
                              </span>
                            </div>
                          )}
                          <div className="flex gap-4 justify-between">
                            <span className="text-gray-400">Source</span>
                            <span className="font-medium">{websiteName}</span>
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
