import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { highlightText } from '@/downlodr/components/table/HighlightText';
import type { ArticleSearchableDownload } from '@/downlodr/store/taskbarDownloadStore';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import type { DisplayColumn } from '@/downlodr/pages/status/statusPageTypes';
import {
  formatFileSize,
  formatRelativeTime,
} from '@/downlodr/pages/status/statusPageUtils';
import { useAfdaStore } from '@/afda/store/afdaStore';
import {
  fetchArticle,
  isArticleModel,
} from '@/afda/backend/dummy/dummyArticleService';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import {
  fetchSocialPostModel,
  generateArticleDocx,
  generateArticleHtml,
  normalizeArticleRow,
  sanitizeFilename,
} from '@/afda/utils/articleDocxGenerator';
import { Separator } from '@radix-ui/react-separator';
import React, { useCallback, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core-app/components/shadcn/components/ui/tooltip';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { LuEye } from 'react-icons/lu';
import { HiOutlineFolderOpen } from 'react-icons/hi';
import { AiOutlineFileWord } from 'react-icons/ai';
import { IoMdDownload } from 'react-icons/io';
import ArticleViewButton from '@/afda/components/ArticleViewButton';

const ArticleFavoriteButton: React.FC<{
  download: ArticleSearchableDownload;
}> = ({ download }) => {
  const isFavorited = !!download.favorited;
  const toggleArticleFavorite = useArticleDownloadStore(
    (s) => s.toggleArticleFavorite,
  );

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleArticleFavorite(download.id);
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

interface ArticleDownloadTableRowProps {
  download: ArticleSearchableDownload;
  displayColumns: DisplayColumn[];
  isChecked: boolean;
  isSelectedDownload: boolean;
  index: number;
  /** `shiftKey` asks the page to select the range from the last clicked row. */
  onCheckboxChange: (shiftKey?: boolean) => void;
  onRowClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isGrouped?: boolean;
  hiddenColumnIds?: string[];
}

export const ArticleDownloadTableRow: React.FC<
  ArticleDownloadTableRowProps
> = ({
  download,
  displayColumns,
  isChecked,
  isSelectedDownload,
  index,
  onCheckboxChange,
  onRowClick,
  onContextMenu,
  isGrouped = false,
  hiddenColumnIds = [],
}) => {
  const searchQuery = useTaskbarDownloadStore((s) => s.searchState.searchQuery);
  const fetchAndOpen = useAfdaStore((s) => s.fetchAndOpen);
  const isArticlePanelOpen = useAfdaStore(
    (s) => s.isOpen && s.articleUrl === download.videoUrl,
  );
  const updateArticleDownload = useArticleDownloadStore(
    (s) => s.updateArticleDownload,
  );
  const [isDownloading, setIsDownloading] = useState(false);

  const handleRowClick = (e: React.MouseEvent) => {
    onRowClick();
    onCheckboxChange(e.shiftKey);
  };

  const handleFormatChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      e.stopPropagation();
      updateArticleDownload(download.id, {
        format: e.target.value as 'docx' | 'pdf',
      });
    },
    [download.id, updateArticleDownload],
  );

  const handleDownload = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isDownloading) return;

      setIsDownloading(true);
      updateArticleDownload(download.id, { status: 'loading' });

      try {
        let articleModel;

        const numericId = parseInt(
          download.id.replace('afda-article-', ''),
          10,
        );
        const isSubscriptionArticle =
          !isNaN(numericId) && download.id.startsWith('afda-article-');
        const isSocialPost = download.id.startsWith('social-post-');

        if (isSocialPost) {
          articleModel = await fetchSocialPostModel(
            download.id,
            download.subscriptionId,
          );
        } else if (isSubscriptionArticle) {
          const bridge =
            typeof window !== 'undefined'
              ? (window as any).afdaBridge
              : undefined;
          if (!bridge) throw new Error('Bridge unavailable');
          const row = await bridge.articles.get({ article_id: numericId });
          if (!row) throw new Error('Article not found');
          articleModel = normalizeArticleRow(row as Record<string, unknown>);
        } else {
          const result = await fetchArticle(download.videoUrl);
          if (!isArticleModel(result)) {
            throw new Error(
              result.article_error_status ?? 'Failed to fetch article',
            );
          }
          articleModel = result;
        }
        const currentFormat = download.format ?? 'docx';
        const downloadFolder =
          await window.downlodrFunctions.getDownloadFolder();
        const filename = sanitizeFilename(articleModel.article_title);

        let buffer: number[];
        let ext: string;

        if (currentFormat === 'pdf') {
          const html = generateArticleHtml(articleModel);
          const result = await window.downlodrFunctions.htmlToPdf(html);
          if (!result.success || !result.data) {
            throw new Error(result.error ?? 'PDF generation failed');
          }
          buffer = result.data;
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

        if (!saveResult.success) {
          throw new Error(saveResult.error ?? 'Failed to save file');
        }

        const fileSize =
          (await window.downlodrFunctions.getFileSize(filePath)) ?? 0;

        updateArticleDownload(download.id, {
          status: 'finished',
          title: articleModel.article_title ?? '',
          filePath,
          fileSize,
          articleData: articleModel,
          thumbnailDataUrl:
            articleModel.article_images?.[0]?.url ??
            download.thumbnailDataUrl ??
            null,
        });
      } catch (err) {
        updateArticleDownload(download.id, {
          status: 'for_download',
          errorMessage: err instanceof Error ? err.message : 'Download failed',
        });
      } finally {
        setIsDownloading(false);
      }
    },
    [download.id, download.format, isDownloading, updateArticleDownload],
  );

  const { hostname, siteName } = (() => {
    try {
      const { hostname } = new URL(download.videoUrl);
      const parts = hostname.replace(/^www\./, '').split('.');
      const name = parts.length > 1 ? parts[parts.length - 2] : parts[0];
      const siteName =
        name.length <= 4
          ? name.toUpperCase()
          : name.charAt(0).toUpperCase() + name.slice(1);
      return { hostname, siteName };
    } catch {
      return { hostname: null, siteName: null };
    }
  })();

  const openFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (download.location) {
      window.downlodrFunctions.openFolder(download.location, download.location);
    }
  };

  return (
    <tr
      className={`border-b hover:bg-gray-50 dark:border-darkModeTableBorder dark:hover:bg-darkModeHover cursor-pointer ${
        isArticlePanelOpen
          ? 'bg-[#FEF9F4] dark:bg-gray-600'
          : isSelectedDownload
          ? 'bg-blue-50 dark:bg-gray-600'
          : isGrouped
          ? 'bg-gray-50 dark:bg-darkModeTable'
          : index === 0
          ? ''
          : 'dark:bg-darkModeTable'
      }`}
      onClick={handleRowClick}
      // Shift-click otherwise highlights the text between the two rows.
      onMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault();
      }}
      onContextMenu={onContextMenu}
      data-download-id={download.id}
    >
      <td className="w-8 p-2">
        <input
          type="checkbox"
          className="ml-2 mt-1 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
          checked={isChecked}
          onChange={() => {
            /* handled via onClick, which carries the shift modifier */
          }}
          onClick={(e) => {
            e.stopPropagation();
            onCheckboxChange(e.shiftKey);
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
                className="p-2 dark:text-gray-200 flex justify-start items-center"
              >
                <div className="flex items-center gap-3 w-full">
                  {isGrouped && (
                    <div className="flex items-center self-stretch mr-3 pl-4">
                      <Separator
                        orientation="vertical"
                        className="h-full w-[1px] bg-primary dark:bg-primary"
                      />
                    </div>
                  )}
                  <div className="flex-shrink-0 h-9 w-16 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 rounded overflow-hidden">
                    {download.thumbnailDataUrl ? (
                      <img
                        src={download.thumbnailDataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <AiOutlineFileWord
                        size={24}
                        className="text-blue-600 dark:text-blue-400"
                      />
                    )}
                  </div>
                  <TooltipWrapper content={download.name} side="bottom">
                    <div className="min-w-0 flex-1">
                      <span className="line-clamp-1 break-words break-all font-semibold">
                        {highlightText(
                          download.name || download.videoUrl,
                          searchQuery,
                        )}
                      </span>
                      {siteName && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 truncate block">
                          {siteName}
                        </span>
                      )}
                    </div>
                  </TooltipWrapper>
                </div>
              </td>
            );

          case 'status':
            return (
              <td
                key={column.id}
                style={{ width: column.width - 10 }}
                className="p-1 ml-1"
              >
                <div className="flex justify-center">
                  {download.status === 'for_download' && (
                    <TooltipWrapper content="Download article" side="bottom">
                      <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        style={{ color: '#FF9800' }}
                        className="text-center items-center relative disabled:opacity-50"
                      >
                        <IoMdDownload className={`mr-1`} size={22} />
                      </button>
                    </TooltipWrapper>
                  )}
                  {download.status === 'downloading' && (
                    <TooltipWrapper content="Generating file…" side="bottom">
                      <span className="animate-spin text-blue-500 text-lg">
                        ⟳
                      </span>
                    </TooltipWrapper>
                  )}
                  {download.status === 'finished' && (
                    <div className="flex items-center space-x-2">
                      <ArticleViewButton
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchAndOpen(download.videoUrl);
                        }}
                      />
                      <TooltipWrapper content="Open folder" side="bottom">
                        <button onClick={openFolder}>
                          <HiOutlineFolderOpen
                            size={20}
                            className="text-green-600 hover:text-green-400 transition-colors duration-200"
                          />
                        </button>
                      </TooltipWrapper>
                    </div>
                  )}
                  {download.status === 'failed' && (
                    <TooltipWrapper
                      content={download.errorMessage ?? 'Failed'}
                      side="bottom"
                    >
                      <span className="text-red-500 text-lg">✕</span>
                    </TooltipWrapper>
                  )}
                </div>
              </td>
            );

          case 'size':
            return (
              <td
                key={column.id}
                style={{ width: column.width }}
                className="px-2 py-2 dark:text-gray-200 text-center"
              >
                <span className="whitespace-nowrap overflow-hidden">
                  {download.status === 'finished' && download.size
                    ? formatFileSize(download.size)
                    : '—'}
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
                {download.status === 'for_download' ? (
                  <select
                    value={download.format ?? 'docx'}
                    onChange={handleFormatChange}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer"
                  >
                    <option value="docx">docx</option>
                    <option value="pdf">pdf</option>
                  </select>
                ) : (
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {download.format ?? download.ext ?? 'docx'}
                  </span>
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

          case 'uploadedOn':
            return (
              <td
                key={column.id}
                style={{ width: column.width }}
                className="p-2 dark:text-gray-200 ml-2 justify-center text-center"
              >
                {download.uploadDate ? (
                  <TooltipWrapper
                    content={new Date(download.uploadDate).toLocaleDateString()}
                    side="bottom"
                  >
                    <div>{formatRelativeTime(download.uploadDate)}</div>
                  </TooltipWrapper>
                ) : (
                  <div>—</div>
                )}
              </td>
            );

          case 'speed':
          case 'transcript':
            return (
              <td
                key={column.id}
                style={{ width: column.width }}
                className="p-2 dark:text-gray-200 text-center"
              >
                <span>—</span>
              </td>
            );

          case 'source':
            return (
              <td
                key={column.id}
                style={{ width: column.width }}
                className="p-2 dark:text-gray-200"
              >
                {hostname ? (
                  <TooltipWrapper content={download.videoUrl} side="bottom">
                    <div className="flex items-center justify-center gap-1.5">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
                        alt=""
                        className="w-6 h-6 shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            'none';
                        }}
                      />
                    </div>
                  </TooltipWrapper>
                ) : (
                  <span className="flex justify-center">—</span>
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
                  <ArticleFavoriteButton download={download} />
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
                      <div className="flex justify-center cursor-default">
                        <LuEye
                          size={14}
                          className="text-gray-400 dark:text-gray-500"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="p-2">
                      <div className="space-y-1 text-xs">
                        {hiddenColumnIds.includes('status') && (
                          <div className="flex gap-4 justify-between">
                            <span className="text-gray-400">Status</span>
                            <span className="font-medium capitalize">
                              {download.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        )}
                        {hiddenColumnIds.includes('format') && (
                          <div className="flex gap-4 justify-between">
                            <span className="text-gray-400">Format</span>
                            <span className="font-medium uppercase">
                              {download.format ?? 'docx'}
                            </span>
                          </div>
                        )}
                        {hiddenColumnIds.includes('uploadedOn') && (
                          <div className="flex gap-4 justify-between">
                            <span className="text-gray-400">Uploaded</span>
                            <span className="font-medium">
                              {download.uploadDate
                                ? formatRelativeTime(download.uploadDate)
                                : '—'}
                            </span>
                          </div>
                        )}
                        {hiddenColumnIds.includes('dateAdded') && (
                          <div className="flex gap-4 justify-between">
                            <span className="text-gray-400">Added</span>
                            <span className="font-medium">
                              {formatRelativeTime(download.DateAdded)}
                            </span>
                          </div>
                        )}
                        {hiddenColumnIds.includes('source') &&
                          download.videoUrl && (
                            <div className="flex gap-4 justify-between">
                              <span className="text-gray-400">Source</span>
                              <span className="font-medium truncate max-w-[120px]">
                                {siteName ?? download.extractorKey ?? '—'}
                              </span>
                            </div>
                          )}
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
};
