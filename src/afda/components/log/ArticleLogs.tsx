/**
 * Log side panel for an article download — the article counterpart of
 * DownloadLogs. Articles have no yt-dlp output, so the timeline comes from the
 * `log` entries the store and download pipelines write (see
 * articleDownloadStore's describeStatusChange and downloadArticle's
 * logArticleStep).
 */
import {
  useArticleDownloadStore,
  type ArticleDownload,
  type ArticleLogEntry,
} from '@/afda/store/articleDownloadStore';
import { mapArticleError } from '@/afda/utils/articleErrorMap';
import {
  resolveArticleDownloadFolder,
  saveArticleFile,
} from '@/afda/utils/downloadArticle';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheckCircle } from 'react-icons/fa';
import { IoCodeSlashSharp } from 'react-icons/io5';
import {
  MdOutlineClose,
  MdOutlineContentCopy,
  MdOutlineFileDownload,
} from 'react-icons/md';

interface ArticleLogsProps {
  onClose: () => void;
  articleId: string;
}

const STATUS_LABEL: Record<ArticleDownload['status'], string> = {
  for_download: 'For download',
  loading: 'Downloading',
  finished: 'Finished',
  failed: 'Failed',
};

const LEVEL_CLASS: Record<ArticleLogEntry['level'], string> = {
  info: 'text-gray-800 dark:text-gray-200',
  success: 'text-green-600 dark:text-green-400',
  warn: 'text-yellow-600 dark:text-yellow-400',
  error: 'text-red-600 dark:text-red-400',
};

const describeSource = (a: ArticleDownload): string =>
  a.id.startsWith('social-post-')
    ? 'Social post'
    : a.id.startsWith('afda-article-')
    ? 'AFDA subscription'
    : 'Pasted URL';

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleTimeString();
};

const formatDate = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
};

const formatBytes = (bytes: number | null): string | null =>
  bytes == null
    ? null
    : bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

/** Label/value pairs for the header block and the copied/saved text. */
const describeArticle = (a: ArticleDownload): [string, string][] =>
  (
    [
      ['Title', a.title || a.articleData?.article_title || null],
      ['URL', a.url],
      ['Status', STATUS_LABEL[a.status] ?? a.status],
      ['Format', a.format.toUpperCase()],
      ['Source', describeSource(a)],
      ['Added', formatDate(a.dateAdded)],
      ['Published', formatDate(a.published_at)],
      ['File', a.filePath],
      ['Size', formatBytes(a.fileSize)],
    ] as [string, string | null][]
  ).filter((pair): pair is [string, string] => !!pair[1]);

const buildLogText = (a: ArticleDownload): string => {
  const info = describeArticle(a)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
  const errorInfo =
    a.status === 'failed' ? mapArticleError(a.errorMessage) : null;
  const error = errorInfo
    ? `\nError [${errorInfo.code}]: ${errorInfo.title}\n${errorInfo.hint}\n${
        a.errorMessage ? `Details: ${a.errorMessage}\n` : ''
      }`
    : '';
  const lines = (a.log ?? [])
    .map((e) => `[${new Date(e.at).toLocaleString()}] ${e.message}`)
    .join('\n');
  return `Article Download Information:
${info}
${error}
=== LOGS ===
${lines || 'No logs available for this article.'}`;
};

const ArticleLogs: React.FC<ArticleLogsProps> = ({ onClose, articleId }) => {
  const { t } = useTranslation('downloadLogs');
  const article = useArticleDownloadStore((s) =>
    s.articleDownloads.find((a) => a.id === articleId),
  );
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const isActive = article?.status === 'loading';
  const errorInfo =
    article?.status === 'failed' ? mapArticleError(article.errorMessage) : null;
  const entries = article?.log ?? [];

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [entries.length, autoScroll]);

  const handleScroll = () => {
    if (logContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
      setAutoScroll(scrollTop + clientHeight >= scrollHeight - 10);
    }
  };

  const handleCopy = async () => {
    if (!article) return;
    try {
      await navigator.clipboard.writeText(buildLogText(article));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy article logs to clipboard:', err);
      toast({
        variant: 'destructive',
        title: t('toast.copyFailedTitle'),
        description: t('toast.copyFailedDesc'),
        duration: 5000,
      });
    }
  };

  const handleSave = async () => {
    if (!article) return;
    try {
      const folder = await resolveArticleDownloadFolder();
      const safeName =
        (article.title || 'article')
          .replace(/[^a-zA-Z0-9\s-_]/g, '')
          .replace(/\s+/g, '_')
          .slice(0, 50) || 'article';
      const content = `Article Log - Generated on ${new Date().toLocaleString()}
================================================================================

${buildLogText(article)}

================================================================================
End of logs - Generated by Downlodr`;
      const path = await saveArticleFile(
        folder,
        `${safeName}_article_log`,
        'txt',
        Array.from(new TextEncoder().encode(content)),
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      toast({
        variant: 'success',
        title: t('toast.logsSavedTitle'),
        description: t('toast.logsSavedPathDesc', { path }),
        duration: 5000,
      });
    } catch (err) {
      console.error('Failed to save article log file:', err);
      toast({
        variant: 'destructive',
        title: t('toast.logsFailedTitle'),
        description:
          err instanceof Error ? err.message : t('toast.logsFailedDesc'),
        duration: 5000,
      });
    }
  };

  const actionClass = (hover: string) =>
    isActive || !article
      ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
      : `text-black dark:text-white ${hover}`;

  return (
    <div
      className="h-full bg-white dark:bg-darkMode flex flex-col flex-shrink-0"
      style={{ width: '400px' }}
    >
      {/* Header */}
      <div className="bg-toggleGroupBaseColor pr-6 pl-4 dark:bg-darkModeTable px-2 py-1 pt-[11px] dark:border-darkModeCompliment flex items-center justify-between rounded-t-md">
        <div className="flex items-center flex-1">
          <IoCodeSlashSharp size={16} color="#F45513" className="mr-2" />
          <span className="text-black dark:text-white font-semibold text-sm leading-6">
            {t('title')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TooltipWrapper
            content={isActive ? t('tooltip.copyActive') : t('tooltip.copy')}
            side="bottom"
          >
            <button
              onClick={handleCopy}
              disabled={isActive || !article}
              className={`p-1 flex-shrink-0 transition-all duration-200 ${actionClass(
                'hover:text-blue-500 dark:hover:text-blue-500',
              )}`}
            >
              {copySuccess ? (
                <FaCheckCircle size={14} className="text-green-500" />
              ) : (
                <MdOutlineContentCopy size={14} />
              )}
            </button>
          </TooltipWrapper>
          <TooltipWrapper
            content={isActive ? t('tooltip.saveActive') : t('tooltip.save')}
            side="bottom"
          >
            <button
              onClick={handleSave}
              disabled={isActive || !article}
              className={`ml-2 p-1 flex-shrink-0 transition-all duration-200 ${actionClass(
                'hover:text-green-500 dark:hover:text-green-500',
              )}`}
            >
              {saveSuccess ? (
                <FaCheckCircle size={18} className="text-green-500" />
              ) : (
                <MdOutlineFileDownload size={18} />
              )}
            </button>
          </TooltipWrapper>
          <TooltipWrapper content={t('tooltip.close')} side="bottom">
            <button
              onClick={onClose}
              className="text-black dark:text-white hover:text-red-500 dark:hover:text-red-500 ml-2 p-1 flex-shrink-0"
            >
              <MdOutlineClose size={16} />
            </button>
          </TooltipWrapper>
        </div>
      </div>

      {/* Log content container */}
      <div className="flex-1 overflow-hidden mb-4">
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto pl-4 pr-6 py-4 text-gray-800 dark:text-gray-200"
        >
          {article ? (
            <>
              <div className="mb-2 space-y-1 text-[12px]">
                {describeArticle(article).map(([label, value]) => (
                  <p key={label} className="break-all whitespace-pre-wrap">
                    <span className="font-semibold">{label}:</span> {value}
                  </p>
                ))}
              </div>
              {errorInfo && (
                <div className="mb-3 rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-[12px] text-red-600 dark:text-red-400 break-words whitespace-pre-wrap space-y-1">
                  <p className="font-semibold">
                    {errorInfo.title}{' '}
                    <span className="font-normal opacity-70">
                      ({errorInfo.code})
                    </span>
                  </p>
                  <p className="text-gray-700 dark:text-gray-300">
                    {errorInfo.hint}
                  </p>
                  {article.errorMessage && (
                    <p className="opacity-70 break-all">
                      Details: {article.errorMessage}
                    </p>
                  )}
                </div>
              )}
              <hr className="solid mb-3 -mx-6 w-[calc(100%+48px)] border-t-2 border-divider dark:border-gray-700" />
              {entries.length > 0 ? (
                <div className="space-y-3">
                  {entries.map((entry, index) => (
                    <div
                      key={index}
                      className={`${
                        LEVEL_CLASS[entry.level]
                      } text-[12px] whitespace-pre-wrap break-all`}
                    >
                      <span className="text-gray-500 dark:text-gray-400">
                        [{formatTime(entry.at)}]
                      </span>{' '}
                      {entry.message}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 dark:text-gray-400 italic text-[12px]">
                  No logs yet — they appear once the article is downloaded.
                </div>
              )}
            </>
          ) : (
            <div className="text-gray-500 dark:text-gray-400 italic text-[12px]">
              This article is no longer in the download list.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArticleLogs;
