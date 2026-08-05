/* eslint-disable @typescript-eslint/no-empty-function */
import { ArticleDownloadTableRow } from '@/afda/components/ArticleDownloadTableRow';
import ArticleContextMenu from '@/afda/components/contextMenu/ArticleContextMenu';
import ArticleSidePanelManager from '@/afda/components/ArticleSidePanelManager';
import SidePanels from '@/downlodr/components/panels/SidePanels';
import { useSidePanels } from '@/downlodr/hooks/useSidePanels';
import {
  fetchArticle,
  isArticleModel,
} from '@/afda/backend/dummy/dummyArticleService';
import { useAfdaStore } from '@/afda/store/afdaStore';
import { usePluginStore } from '@/plugins/store/pluginStore';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';
import { useAfdaSubscriptionsStore } from '@/afda/store/afdaSubscriptionsStore';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import {
  buildArticleFilename,
  fetchSocialPostModel,
  generateArticleDocx,
  generateArticleHtml,
  normalizeArticleRow,
} from '@/afda/utils/articleDocxGenerator';
import { getFaviconUrl } from '@/afda/utils/faviconUrl';
import { Play } from '@/assets/icon';
import { Button } from '@/core-app/components/shadcn/components/ui/button';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
import TaskbarInputField from '@/downlodr/components/base/InputField/TaskbarInputField';
import RemoveModal from '@/downlodr/components/modal/custom/RemoveModal';
import { useWindowSize } from '@/downlodr/pages/status/statusPageHooks';
import { StatusPageTableHeader } from '@/downlodr/pages/status/StatusPageTableHeader';
import type { DisplayColumn } from '@/downlodr/pages/status/statusPageTypes';
import {
  formatRelativeTime,
  sortDownloadsByColumn,
} from '@/downlodr/pages/status/statusPageUtils';
import type { ArticleSearchableDownload } from '@/downlodr/store/taskbarDownloadStore';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FaArrowLeft } from 'react-icons/fa6';
import {
  LuChevronLeft,
  LuChevronRight,
  LuFileSpreadsheet,
  LuNewspaper,
  LuTrash,
} from 'react-icons/lu';
import { useNavigate, useParams } from 'react-router-dom';

const COLUMNS: DisplayColumn[] = [
  {
    id: 'name',
    width: Math.max(Math.floor(window.innerWidth * 0.4), 220),
    minWidth: 220,
  },
  { id: 'status', width: 100, minWidth: 100 },
  { id: 'format', width: 90, minWidth: 90 },
  { id: 'size', width: 70, minWidth: 70 },
  { id: 'source', width: 50, minWidth: 50 },
  { id: 'dateAdded', width: 100, minWidth: 100 },
  { id: 'uploadedOn', width: 100, minWidth: 100, label: 'Published' },
  { id: 'action', width: 60, minWidth: 60 },
];

const AfdaSelectedTableGroup: React.FC = () => {
  const { websiteId } = useParams<{ websiteId: string }>();
  const navigate = useNavigate();

  const website = useAfdaWebsitesStore((s) =>
    s.websites.find((w) => w.id === websiteId),
  );
  const getAfdaSubscription = useAfdaSubscriptionsStore(
    (s) => s.getAfdaSubscription,
  );
  const articleDownloads = useArticleDownloadStore((s) => s.articleDownloads);
  const removeArticleDownload = useArticleDownloadStore(
    (s) => s.removeArticleDownload,
  );
  const updateArticleDownload = useArticleDownloadStore(
    (s) => s.updateArticleDownload,
  );
  const addArticleTag = useArticleDownloadStore((s) => s.addArticleTag);
  const removeArticleTag = useArticleDownloadStore((s) => s.removeArticleTag);
  const addArticleCategory = useArticleDownloadStore(
    (s) => s.addArticleCategory,
  );
  const removeArticleCategory = useArticleDownloadStore(
    (s) => s.removeArticleCategory,
  );

  const afdaIsOpen = useAfdaStore((s) => s.isOpen);
  const fetchAndOpen = useAfdaStore((s) => s.fetchAndOpen);
  const toggleArticleFavorite = useArticleDownloadStore(
    (s) => s.toggleArticleFavorite,
  );

  const selectedRowIds = useSelectedDownloadStore((s) => s.selectedRowIds);
  const setSelectedRowIds = useSelectedDownloadStore(
    (s) => s.setSelectedRowIds,
  );
  const [selectedDownloadId, setSelectedDownloadId] = useState<string | null>(
    null,
  );

  const searchState = useTaskbarDownloadStore((s) => s.searchState);

  const [sortColumn, setSortColumn] = useState('dateAdded');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSortClick = useCallback(
    (columnId: string) => {
      if (columnId === sortColumn) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortColumn(columnId);
        setSortDirection('desc');
      }
    },
    [sortColumn],
  );
  const { windowHeight } = useWindowSize();
  const PAGE_SIZE = windowHeight >= 1000 ? 20 : windowHeight >= 800 ? 15 : 10;
  const [currentPage, setCurrentPage] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showBulkRemoveModal, setShowBulkRemoveModal] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
    articleId: string | null;
    x: number;
    y: number;
  }>({ articleId: null, x: 0, y: 0 });
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const downloads = useMemo((): ArticleSearchableDownload[] => {
    return articleDownloads
      .filter((a) => a.subscriptionId === websiteId)
      .map((a) => ({
        type: 'article' as const,
        id: a.id,
        name: a.title || a.url,
        displayName: a.title || undefined,
        status: a.status === 'loading' ? 'downloading' : a.status,
        size: a.fileSize ?? 0,
        DateAdded: a.dateAdded,
        uploadDate: a.published_at ?? undefined,
        location: a.filePath ?? '',
        videoUrl: a.url,
        downloadName: a.title || a.url,
        channelName: '',
        extractorKey: 'Article',
        formatId: '',
        audioExt: '',
        audioFormatId: '',
        ext: a.format ?? 'docx',
        format: a.format ?? 'docx',
        speed: '',
        timeLeft: '',
        progress:
          a.status === 'finished' ? 100 : a.status === 'failed' ? 0 : 50,
        isLive: false,
        duration: 0,
        getTranscript: false,
        getThumbnail: false,
        tags: [],
        category: [],
        automaticCaption: null,
        thumbnails: null,
        errorMessage: a.errorMessage,
        thumbnailDataUrl: a.thumbnailDataUrl,
        subscriptionId: a.subscriptionId,
      }));
  }, [articleDownloads, websiteId]);

  const hasForDownloadStatus = selectedRowIds.some(
    (id) => downloads.find((d) => d.id === id)?.status === 'for_download',
  );

  const filteredDownloads = useMemo(() => {
    const base =
      !searchState.isSearchActive || !searchState.searchQuery.trim()
        ? downloads
        : (() => {
            const query = searchState.searchQuery.toLowerCase();
            return downloads.filter(
              (d) =>
                d.name?.toLowerCase().includes(query) ||
                d.displayName?.toLowerCase().includes(query) ||
                d.extractorKey?.toLowerCase().includes(query) ||
                d.status?.toLowerCase().includes(query) ||
                d.tags?.some((t) => t.toLowerCase().includes(query)) ||
                d.category?.some((c) => c.toLowerCase().includes(query)),
            );
          })();
    return sortDownloadsByColumn(base, sortColumn, sortDirection);
  }, [
    downloads,
    searchState.isSearchActive,
    searchState.searchQuery,
    sortColumn,
    sortDirection,
  ]);

  useEffect(() => {
    setCurrentPage(0);
  }, [filteredDownloads.length, PAGE_SIZE]);

  const totalPages = Math.ceil(filteredDownloads.length / PAGE_SIZE);
  const pageStart = currentPage * PAGE_SIZE + 1;
  const pageEnd = Math.min(
    (currentPage + 1) * PAGE_SIZE,
    filteredDownloads.length,
  );
  const pageDownloads = filteredDownloads.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const websiteName = website?.name ?? websiteId ?? '';
  const faviconUrl = getFaviconUrl(website?.url ?? '');
  const isSocial = website?.kind === 'social';
  const itemNoun = isSocial ? 'post' : 'article';

  // Save Location / File Naming Format from the Settings tab (AfdaSettings.tsx)
  // are frontend-only preferences — resolve them here at download time since
  // that's the only place actual files get written.
  const resolveDownloadDestination = useCallback(
    async (title: string | null, dateAdded: string) => {
      const settings = getAfdaSubscription(websiteId ?? '')?.settings[0];
      const downloadFolder =
        settings?.save_location?.trim() ||
        (await window.downlodrFunctions.getDownloadFolder());
      const filename = buildArticleFilename(settings?.file_naming_format, {
        channel: websiteName,
        title,
        date: dateAdded,
      });
      return { downloadFolder, filename };
    },
    [getAfdaSubscription, websiteId, websiteName],
  );

  const handleCheckboxChange = (id: string) => {
    setSelectedRowIds(
      selectedRowIds.includes(id)
        ? selectedRowIds.filter((r) => r !== id)
        : [...selectedRowIds, id],
    );
  };

  const handleSelectPage = (pageIds: string[], allPageSelected: boolean) => {
    if (allPageSelected) {
      setSelectedRowIds(selectedRowIds.filter((id) => !pageIds.includes(id)));
    } else {
      const existing = new Set(selectedRowIds);
      pageIds.forEach((id) => existing.add(id));
      setSelectedRowIds(Array.from(existing));
    }
  };

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, articleId: string) => {
      e.preventDefault();
      const x = e.clientX;
      const y = e.clientY;
      if (contextMenu.articleId !== null) {
        setContextMenu({ articleId: null, x: 0, y: 0 });
        transitionTimeoutRef.current = setTimeout(() => {
          setContextMenu({ articleId, x, y });
          transitionTimeoutRef.current = null;
        }, 120);
      } else {
        setContextMenu({ articleId, x, y });
      }
    },
    [contextMenu.articleId],
  );

  const handleCloseContextMenu = useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    setContextMenu({ articleId: null, x: 0, y: 0 });
  }, []);

  const handleViewArticle = useCallback(
    (articleId: string) => {
      const article = articleDownloads.find((a) => a.id === articleId);
      if (article) fetchAndOpen(article.url);
    },
    [articleDownloads, fetchAndOpen],
  );

  const handleOpenInBrowser = useCallback((url: string) => {
    window.downlodrFunctions.openExternalLink(url);
  }, []);

  const handleOpenFolder = useCallback((filePath: string) => {
    window.downlodrFunctions.openFolder(filePath, filePath);
  }, []);

  const handleRetry = useCallback(
    (articleId: string) => {
      updateArticleDownload(articleId, {
        status: 'for_download',
        errorMessage: undefined,
      });
    },
    [updateArticleDownload],
  );

  const handleToggleFavorite = toggleArticleFavorite;

  const handleContextRemove = useCallback(
    (articleId: string) => {
      const article = articleDownloads.find((a) => a.id === articleId);
      if (article?.filePath) {
        window.downlodrFunctions
          .deleteFile(article.filePath)
          .catch(() => undefined);
      }
      removeArticleDownload(articleId);
      handleCloseContextMenu();
    },
    [articleDownloads, removeArticleDownload, handleCloseContextMenu],
  );

  const handleContextDownload = useCallback(
    async (articleId: string) => {
      const d = downloads.find((dl) => dl.id === articleId);
      if (!d || d.status !== 'for_download') return;
      handleCloseContextMenu();
      updateArticleDownload(d.id, { status: 'loading' });
      try {
        let articleModel;
        const numericId = parseInt(d.id.replace('afda-article-', ''), 10);
        const isSubscriptionArticle =
          !isNaN(numericId) && d.id.startsWith('afda-article-');
        if (isSubscriptionArticle) {
          const bridge =
            typeof window !== 'undefined'
              ? (
                  window as unknown as {
                    afdaBridge?: {
                      articles: {
                        get: (p: {
                          article_id: number;
                        }) => Promise<Record<string, unknown> | null>;
                      };
                    };
                  }
                ).afdaBridge
              : undefined;
          if (!bridge) throw new Error('Bridge unavailable');
          const row = await bridge.articles.get({ article_id: numericId });
          if (!row) throw new Error('Article not found');
          articleModel = normalizeArticleRow(row);
        } else {
          const result = await fetchArticle(d.videoUrl);
          if (!isArticleModel(result)) {
            throw new Error(
              result.article_error_status ?? 'Failed to fetch article',
            );
          }
          articleModel = result;
        }
        const currentFormat = d.format ?? 'docx';
        const { downloadFolder, filename } = await resolveDownloadDestination(
          articleModel.article_title,
          d.DateAdded,
        );
        let buffer: number[];
        let ext: string;
        if (currentFormat === 'pdf') {
          const html = generateArticleHtml(articleModel);
          const pdfResult = await window.downlodrFunctions.htmlToPdf(html);
          if (!pdfResult.success || !pdfResult.data) {
            throw new Error(pdfResult.error ?? 'PDF generation failed');
          }
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
        if (!saveResult.success) {
          throw new Error(saveResult.error ?? 'Failed to save file');
        }
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
    [
      downloads,
      updateArticleDownload,
      handleCloseContextMenu,
      resolveDownloadDestination,
    ],
  );

  const availableTags = useMemo(
    () => Array.from(new Set(articleDownloads.flatMap((a) => a.tags ?? []))),
    [articleDownloads],
  );

  const availableCategories = useMemo(
    () =>
      Array.from(new Set(articleDownloads.flatMap((a) => a.category ?? []))),
    [articleDownloads],
  );

  const activeContextArticle = contextMenu.articleId
    ? articleDownloads.find((a) => a.id === contextMenu.articleId) ?? null
    : null;

  const handleBulkRemove = useCallback(
    async (deleteFolder?: boolean) => {
      const toRemove = downloads.filter((d) => selectedRowIds.includes(d.id));
      setSelectedRowIds([]);

      for (const d of toRemove) {
        if (d.location) {
          try {
            if (deleteFolder) {
              const folderPath = d.location.substring(
                0,
                Math.max(
                  d.location.lastIndexOf('/'),
                  d.location.lastIndexOf('\\'),
                ),
              );
              await window.downlodrFunctions.deleteFolder(folderPath);
            } else {
              await window.downlodrFunctions.deleteFile(d.location);
            }
          } catch {
            /* ignore fs errors */
          }
        }
        removeArticleDownload(d.id);
      }

      toast({
        variant: 'success',
        title: 'Removed',
        description: `${toRemove.length} article${
          toRemove.length !== 1 ? 's' : ''
        } removed.`,
        duration: 5000,
      });
    },
    [downloads, selectedRowIds, setSelectedRowIds, removeArticleDownload],
  );

  const handleBulkDownload = useCallback(async () => {
    const toDownload = downloads.filter(
      (d) => selectedRowIds.includes(d.id) && d.status === 'for_download',
    );
    if (toDownload.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No articles to download',
        description: 'Select articles with "for download" status.',
        duration: 5000,
      });
      return;
    }

    setSelectedRowIds([]);

    for (const d of toDownload) {
      updateArticleDownload(d.id, { status: 'loading' });
      try {
        let articleModel;
        const numericId = parseInt(d.id.replace('afda-article-', ''), 10);
        const isSubscriptionArticle =
          !isNaN(numericId) && d.id.startsWith('afda-article-');
        const isSocialPost = d.id.startsWith('social-post-');

        if (isSocialPost) {
          articleModel = await fetchSocialPostModel(d.id, d.subscriptionId);
        } else if (isSubscriptionArticle) {
          const bridge =
            typeof window !== 'undefined'
              ? (
                  window as unknown as {
                    afdaBridge?: {
                      articles: {
                        get: (p: {
                          article_id: number;
                        }) => Promise<Record<string, unknown> | null>;
                      };
                    };
                  }
                ).afdaBridge
              : undefined;
          if (!bridge) throw new Error('Bridge unavailable');
          const row = await bridge.articles.get({ article_id: numericId });
          if (!row) throw new Error('Article not found');
          articleModel = normalizeArticleRow(row);
        } else {
          const result = await fetchArticle(d.videoUrl);
          if (!isArticleModel(result)) {
            throw new Error(
              result.article_error_status ?? 'Failed to fetch article',
            );
          }
          articleModel = result;
        }

        const currentFormat = d.format ?? 'docx';
        const { downloadFolder, filename } = await resolveDownloadDestination(
          articleModel.article_title,
          d.DateAdded,
        );

        let buffer: number[];
        let ext: string;

        if (currentFormat === 'pdf') {
          const html = generateArticleHtml(articleModel);
          const pdfResult = await window.downlodrFunctions.htmlToPdf(html);
          if (!pdfResult.success || !pdfResult.data) {
            throw new Error(pdfResult.error ?? 'PDF generation failed');
          }
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
        if (!saveResult.success) {
          throw new Error(saveResult.error ?? 'Failed to save file');
        }

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
    }
  }, [
    downloads,
    selectedRowIds,
    setSelectedRowIds,
    updateArticleDownload,
    resolveDownloadDestination,
  ]);

  const handleExportCsv = useCallback(() => {
    const toExport = articleDownloads.filter((a) =>
      selectedRowIds.includes(a.id),
    );
    if (toExport.length === 0) return;

    const csvEscape = (value: string | null | undefined) => {
      const str = value ?? '';
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    const getDomain = (url: string) => {
      try {
        return new URL(url).hostname;
      } catch {
        return '';
      }
    };

    const countWords = (text: string | null | undefined) => {
      if (!text) return '';
      return String(text.trim().split(/\s+/).filter(Boolean).length);
    };

    const headers = [
      'Title',
      'Title (EN)',
      'Author',
      'Published At',
      'URL',
      'Domain',
      'Language',
      'Body Text',
      'Body Text (EN)',
      'Word Count',
      'Article Images',
      'Created At',
      'Website',
      'Category',
      'Section',
    ];

    const rows = toExport.map((a) => [
      csvEscape(a.title),
      '',
      csvEscape(
        (a.articleData?.article_authors ?? []).map((au) => au.name).join('; '),
      ),
      csvEscape(
        a.published_at ??
          (a.articleData?.article_publish_date
            ? new Date(a.articleData.article_publish_date).toISOString()
            : ''),
      ),
      csvEscape(a.url),
      csvEscape(getDomain(a.url)),
      '',
      csvEscape(a.articleData?.article_content),
      '',
      countWords(a.articleData?.article_content),
      csvEscape(
        (a.articleData?.article_images ?? []).map((img) => img.url).join('; '),
      ),
      csvEscape(a.dateAdded),
      csvEscape(websiteName),
      csvEscape((a.category ?? []).join('; ')),
      csvEscape(a.sectionId ?? ''),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${websiteName.replace(/\s+/g, '_')}_articles.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      variant: 'success',
      title: 'Exported',
      description: `${toExport.length} article${
        toExport.length !== 1 ? 's' : ''
      } exported to CSV.`,
      duration: 5000,
    });
  }, [articleDownloads, selectedRowIds, websiteName]);

  const sidePanels = useSidePanels();
  const isPluginSidebarOpen = usePluginStore(
    (s) => s.settingsPlugin.isOpenPluginSidebar,
  );
  const isSidePanelOpen =
    sidePanels.showActivityTracker ||
    sidePanels.showLogModal ||
    isPluginSidebarOpen ||
    afdaIsOpen;
  const displayColumns = isSidePanelOpen
    ? COLUMNS.filter((c) => c.id === 'name' || c.id === 'status')
    : COLUMNS;

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex flex-col overflow-hidden bg-white dark:bg-darkModeTable rounded-md gap-3 py-2 px-4 flex-1 min-w-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition-colors mr-2 border px-2 py-1 rounded text-gray-700 dark:text-gray-300 text-[11px] font-extrabold"
          >
            <span>
              <FaArrowLeft />
            </span>
            <span>Back</span>
          </button>
          <button
            onClick={() => navigate('/status/all')}
            className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors font-medium"
          >
            Downloads
          </button>
          <span>/</span>
          <button
            onClick={() =>
              navigate('/status/all', {
                state: { presetTypeFilter: 'articles' },
              })
            }
            className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors font-medium"
          >
            Article Fetcher
          </button>
          <span>/</span>
          <span className="text-gray-700 dark:text-gray-300 font-bold">
            {websiteName}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <TooltipWrapper
              content={
                hasForDownloadStatus
                  ? 'Start download'
                  : "No articles with 'for download' status selected"
              }
              side="bottom"
            >
              <div>
                <Button
                  variant="transparent"
                  size="icon"
                  className={cn(
                    'rounded-md h-7 flex items-center justify-center p-[2px] dark:bg-transparent',
                    hasForDownloadStatus
                      ? 'dark:text-gray-100'
                      : 'cursor-not-allowed text-gray-800 dark:text-gray-400',
                  )}
                  onClick={handleBulkDownload}
                  disabled={!hasForDownloadStatus}
                  icon={<Play />}
                />
              </div>
            </TooltipWrapper>
            <TooltipWrapper content="Remove selected articles" side="bottom">
              <Button
                variant="transparent"
                size="icon"
                className="text-[12px] text-white rounded-md h-6 flex items-center justify-center px-2 py-[2px] bg-[#FF4F45] hover:bg-red-200 dark:hover:bg-red-900/40"
                onClick={() => setShowBulkRemoveModal(true)}
                disabled={selectedRowIds.length === 0}
                icon={
                  <LuTrash size={13} className="text-white dark:text-white" />
                }
              >
                Delete
              </Button>
            </TooltipWrapper>
            {selectedRowIds.length > 0 && (
              <TooltipWrapper
                content="Export selected articles to CSV"
                side="bottom"
              >
                <Button
                  variant="transparent"
                  size="icon"
                  className="text-[12px] text-white rounded-md h-6 flex items-center justify-center px-2 py-[2px] bg-primary hover:bg-primary/80"
                  onClick={handleExportCsv}
                  icon={
                    <LuFileSpreadsheet
                      size={13}
                      className="text-white dark:text-white"
                    />
                  }
                >
                  Export CSV
                </Button>
              </TooltipWrapper>
            )}
            <div className="mr-3 w-[550px] [&>div]:max-w-full">
              <TaskbarInputField />
            </div>
          </div>
        </div>
        <div className="flex flex-row overflow-hidden flex-1 min-w-0">
          <div className="flex flex-col overflow-hidden flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-4 pb-2 flex-shrink-0">
              {faviconUrl ? (
                <img
                  src={faviconUrl}
                  className="w-9 h-9 rounded-full object-contain flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <LuNewspaper
                    size={15}
                    className="text-blue-500 dark:text-blue-400"
                  />
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <div className="flex gap-1 items-center">
                  <span className="font-bold bg-primary text-white px-2 py-0.5 rounded text-[10.5px]">
                    Sub
                  </span>
                  <span className="font-extrabold text-gray-800 dark:text-gray-100 text-sm">
                    {websiteName}
                  </span>
                </div>
                <div className="flex gap-1.5 items-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {downloads.length} {itemNoun}
                    {downloads.length !== 1 ? 's' : ''}
                  </div>
                  <div className="font-extrabold text-gray-700 dark:text-gray-100 text-[8px]">
                    •
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Last checked:{' '}
                    {website?.lastScrapedAt ?? website?.createdAt
                      ? formatRelativeTime(
                          (website.lastScrapedAt ?? website.createdAt)!,
                        )
                      : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Table + Pagination */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0 border-t-2 dark:border-darkModeTableBorder">
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <div
                  ref={scrollContainerRef}
                  className="flex-1 overflow-auto min-w-0"
                >
                  <table className="w-full">
                    <StatusPageTableHeader
                      displayColumns={displayColumns}
                      columns={displayColumns}
                      selectedRowIds={selectedRowIds}
                      pageRowIds={pageDownloads.map((d) => d.id)}
                      onClearSelection={() => setSelectedRowIds([])}
                      pageStart={pageStart}
                      pageEnd={pageEnd}
                      totalDownloads={filteredDownloads.length}
                      totalPages={totalPages}
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      dragging={null}
                      dragOverIndex={null}
                      onColumnHeaderContextMenu={() => {}}
                      onSelectAll={() =>
                        handleSelectPage(
                          pageDownloads.map((d) => d.id),
                          pageDownloads.every((d) =>
                            selectedRowIds.includes(d.id),
                          ),
                        )
                      }
                      onSortClick={handleSortClick}
                      onResizeStart={() => {}}
                      startDragging={() => {}}
                      onDragOver={() => {}}
                      onDrop={() => {}}
                      cancelDrag={() => {}}
                    />
                    <tbody>
                      {pageDownloads.map((download, index) => (
                        <ArticleDownloadTableRow
                          key={download.id}
                          download={download}
                          displayColumns={displayColumns}
                          isChecked={selectedRowIds.includes(download.id)}
                          isSelectedDownload={
                            selectedDownloadId === download.id
                          }
                          index={index}
                          onCheckboxChange={() =>
                            handleCheckboxChange(download.id)
                          }
                          onRowClick={() => setSelectedDownloadId(download.id)}
                          onContextMenu={(e) =>
                            handleContextMenu(e, download.id)
                          }
                        />
                      ))}
                      {filteredDownloads.length === 0 && (
                        <tr>
                          <td
                            colSpan={displayColumns.length + 1}
                            className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm"
                          >
                            {searchState.isSearchActive &&
                            searchState.searchQuery.trim()
                              ? `No ${itemNoun}s matched "${searchState.searchQuery}"`
                              : `No ${itemNoun}s found`}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
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
            </div>

            <RemoveModal
              isOpen={showBulkRemoveModal}
              onClose={() => setShowBulkRemoveModal(false)}
              onConfirm={(deleteFolder) => {
                handleBulkRemove(deleteFolder);
                setShowBulkRemoveModal(false);
              }}
              allowFolderDeletion={false}
            />

            {activeContextArticle && (
              <ArticleContextMenu
                article={activeContextArticle}
                position={{ x: contextMenu.x, y: contextMenu.y }}
                onClose={handleCloseContextMenu}
                onViewArticle={handleViewArticle}
                onOpenInBrowser={handleOpenInBrowser}
                onOpenFolder={handleOpenFolder}
                onRemove={handleContextRemove}
                onRetry={handleRetry}
                onDownload={handleContextDownload}
                onToggleFavorite={handleToggleFavorite}
                isFavorited={!!activeContextArticle.favorited}
                onAddTag={(articleId, tag) => addArticleTag(articleId, tag)}
                onRemoveTag={(articleId, tag) =>
                  removeArticleTag(articleId, tag)
                }
                currentTags={activeContextArticle.tags ?? []}
                availableTags={availableTags}
                onAddCategory={(articleId, cat) =>
                  addArticleCategory(articleId, cat)
                }
                onRemoveCategory={(articleId, cat) =>
                  removeArticleCategory(articleId, cat)
                }
                currentCategories={activeContextArticle.category ?? []}
                availableCategories={availableCategories}
              />
            )}
          </div>
          <SidePanels {...sidePanels} />
          <ArticleSidePanelManager />
        </div>
      </div>
    </div>
  );
};

export default AfdaSelectedTableGroup;
