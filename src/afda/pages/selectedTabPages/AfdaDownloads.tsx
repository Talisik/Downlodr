import { useState, useCallback, useMemo, useRef } from 'react';
import { formatWordDate } from '@/afda/pages/utils/afdaUtils';
import { splitIntoParagraphs } from '@/afda/utils/articleFormatter';
import { FiSearch } from 'react-icons/fi';
import { LuCalendar, LuCopy, LuDot } from 'react-icons/lu';
import articlePlaceholder from '@/assets/afda/article-placeholder.svg';
import { IoPersonCircleSharp } from 'react-icons/io5';
import type {
  Website,
  WebsiteSection,
} from '@/afda/backend/afda-backend/src/types';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import type { ArticleDownload } from '@/afda/store/articleDownloadStore';
import { BiSortAZ, BiSortZA } from 'react-icons/bi';
import ArticleContextMenu from '@/afda/components/contextMenu/ArticleContextMenu';
import { useFavoritesStore } from '@/downlodr/store/favoritesStore';

interface ArticleRow {
  id: number;
  title: string | null;
  author: string | null;
  published_at: string | null;
  body_text: string | null;
  word_count: number | null;
  url: string;
}

interface AfdaDownloadsProps {
  website: Website | undefined;
}

const lastCrumb = (name: string) => name.split('/').at(-1) ?? name;

const AfdaDownloads = ({ website }: AfdaDownloadsProps) => {
  const sections = website?.sections ?? [];
  const updateWebsite = useAfdaWebsitesStore((s) => s.updateWebsite);

  const getSectionLabel = (section: WebsiteSection) => {
    const nameCrumb = lastCrumb((section.name ?? '').trim());
    if (nameCrumb) return nameCrumb;
    const pathCrumb = lastCrumb((section.path ?? '').trim());
    if (pathCrumb) return pathCrumb;
    const idx = sections.findIndex((s) => s.id === section.id);
    const source = (website?.name ?? 'source').trim().replace(/\s+/g, '_');
    return `${source}_section_${idx + 1}`;
  };

  // All persisted articles for this website — reactive to useAfdaArticleSync writes
  const allArticleDownloads = useArticleDownloadStore(
    (s) => s.articleDownloads,
  );
  const websiteArticles = useMemo(
    () =>
      website
        ? allArticleDownloads.filter((a) => a.subscriptionId === website.id)
        : [],
    [allArticleDownloads, website],
  );

  const [selectedSection, setSelectedSection] = useState<WebsiteSection | null>(
    website?.sections[0] ?? null,
  );
  const [selectedArticle, setSelectedArticle] = useState<ArticleRow | null>(
    null,
  );
  const [togglingSection, setTogglingSection] = useState<string | null>(null);
  const [runningSection, setRunningSection] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [sectionSearch, setSectionSearch] = useState('');
  const [sectionSortAsc, setSectionSortAsc] = useState(true);
  const [showSectionSearch, setShowSectionSearch] = useState(false);
  const [articleSearch, setArticleSearch] = useState('');
  const [articleSortAsc, setArticleSortAsc] = useState(false);
  const [showArticleSearch, setShowArticleSearch] = useState(false);
  const sectionSearchRef = useRef<HTMLInputElement>(null);
  const articleSearchRef = useRef<HTMLInputElement>(null);

  const [contextMenu, setContextMenu] = useState<{
    article: ArticleDownload;
    position: { x: number; y: number };
  } | null>(null);

  const removeArticleDownload = useArticleDownloadStore((s) => s.removeArticleDownload);
  const addArticleTag = useArticleDownloadStore((s) => s.addArticleTag);
  const removeArticleTag = useArticleDownloadStore((s) => s.removeArticleTag);
  const addArticleCategory = useArticleDownloadStore((s) => s.addArticleCategory);
  const removeArticleCategory = useArticleDownloadStore((s) => s.removeArticleCategory);

  const isFavorited = useFavoritesStore((s) => s.isFavorited);
  const addFavorite = useFavoritesStore((s) => s.addFavorite);
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite);

  // Articles for the selected section — derived from the persistent store
  const sectionArticles = useMemo(
    () =>
      selectedSection
        ? websiteArticles.filter((a) => a.sectionId === selectedSection.id)
        : [],
    [websiteArticles, selectedSection],
  );

  // Per-section counts derived from the store — no bridge calls needed
  const sectionArticleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of websiteArticles) {
      if (a.sectionId) counts[a.sectionId] = (counts[a.sectionId] ?? 0) + 1;
    }
    return counts;
  }, [websiteArticles]);

  // ── Per-section toggle (pause / resume) ───────────────────────────────────
  const handleToggleSection = useCallback(
    async (e: React.MouseEvent, section: WebsiteSection) => {
      e.stopPropagation();
      const bridge =
        typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
      if (!bridge || !website || togglingSection) return;

      setTogglingSection(section.id);
      try {
        if (section.enabled) {
          await bridge.schedule.pause({ section_id: parseInt(section.id) });
        } else {
          await bridge.schedule.resume({ section_id: parseInt(section.id) });
        }
        // Re-fetch a fresh hydrated website to sync the store
        const result = await bridge.websites.update({
          id: parseInt(website.id),
          patch: {},
        });
        if (result?.website) updateWebsite(result.website);
      } catch (err) {
        console.error('[afda] section toggle failed:', err);
      } finally {
        setTogglingSection(null);
      }
    },
    [website, updateWebsite, togglingSection],
  );

  // ── Per-section run now ───────────────────────────────────────────────────
  const handleRunSection = useCallback(
    async (e: React.MouseEvent, section: WebsiteSection) => {
      e.stopPropagation();
      const bridge =
        typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
      if (!bridge || runningSection) return;

      setRunningSection(section.id);
      try {
        await bridge.scrape.runNow({ section_id: parseInt(section.id) });
      } catch (err) {
        console.error('[afda] run section failed:', err);
      } finally {
        setRunningSection(null);
      }
    },
    [runningSection],
  );

  // ── Fetch full article for preview (store has title/url/date; bridge has body_text/author) ──
  const handleSelectStoreArticle = useCallback(
    async (
      storeId: string,
      fallbackUrl: string,
      fallbackTitle: string | null,
    ) => {
      const bridge =
        typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;

      // Show a minimal stub immediately so the panel opens
      setImgError(false);
      setSelectedArticle({
        id: 0,
        title: fallbackTitle,
        author: null,
        published_at: null,
        body_text: null,
        word_count: null,
        url: fallbackUrl,
      });

      if (!bridge) return;
      const numericId = parseInt(storeId.replace('afda-article-', ''));
      if (Number.isNaN(numericId)) return;

      setLoadingPreview(true);
      try {
        const full = await bridge.articles.get({ article_id: numericId });
        if (full) setSelectedArticle(full);
      } catch {
        // keep the stub shown
      } finally {
        setLoadingPreview(false);
      }
    },
    [],
  );

  const allAvailableTags = useMemo(
    () => [...new Set(allArticleDownloads.flatMap((a) => a.tags ?? []))],
    [allArticleDownloads],
  );

  const allAvailableCategories = useMemo(
    () => [...new Set(allArticleDownloads.flatMap((a) => a.category ?? []))],
    [allArticleDownloads],
  );

  const filteredSections = useMemo(() => {
    const q = sectionSearch.toLowerCase();
    const filtered = q
      ? sections.filter((s) => (s.name || s.path).toLowerCase().includes(q))
      : sections;
    return [...filtered].sort((a, b) => {
      const cmp = (a.name || a.path).localeCompare(b.name || b.path);
      return sectionSortAsc ? cmp : -cmp;
    });
  }, [sections, sectionSearch, sectionSortAsc]);

  const filteredArticles = useMemo(() => {
    const q = articleSearch.toLowerCase();
    const filtered = q
      ? sectionArticles.filter(
          (a) =>
            (a.title ?? '').toLowerCase().includes(q) ||
            a.url.toLowerCase().includes(q),
        )
      : sectionArticles;
    return [...filtered].sort((a, b) => {
      const da = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
      const db = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
      return articleSortAsc ? da - db : db - da;
    });
  }, [sectionArticles, articleSearch, articleSortAsc]);

  if (sections.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400 text-sm">
        No sections available.
      </div>
    );
  }

  return (
    <div className="flex flex-row h-full overflow-hidden">
      {/* ── Sections Sidebar ── */}
      <div className="w-[180px] min-w-[120px] xl:w-[200px] 1xl:w-1/3 1xl:min-w-[250px] 1xl:max-w-[300px] overflow-y-auto flex-shrink-0 bg-[#EDEDED] dark:bg-darkModeTable">
        <div className="">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[12px] text-[#808080]">
              {sections.length} section{sections.length !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSectionSearch((v) => !v);
                  if (!showSectionSearch)
                    setTimeout(() => sectionSearchRef.current?.focus(), 0);
                  else setSectionSearch('');
                }}
              >
                <FiSearch size={16} />
              </button>
              <button
                type="button"
                title={sectionSortAsc ? 'Sort Z→A' : 'Sort A→Z'}
                onClick={() => setSectionSortAsc((v) => !v)}
              >
                {sectionSortAsc ? (
                  <BiSortAZ size={16} />
                ) : (
                  <BiSortZA size={16} />
                )}
              </button>
              {/* 
              <button type="button">
                <FaRegPenToSquare />
              </button>
              <button type="button" onClick={() => setPendingSubscribeUrl(' ')}>
                <FiPlus />
              </button>
              */}
            </div>
          </div>
          {showSectionSearch && (
            <div className="px-3 pb-2">
              <input
                ref={sectionSearchRef}
                type="text"
                value={sectionSearch}
                onChange={(e) => setSectionSearch(e.target.value)}
                placeholder="Search sections…"
                onBlur={() =>
                  setTimeout(() => {
                    setShowSectionSearch(false);
                    setSectionSearch('');
                  }, 150)
                }
                className="w-full text-[12px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 outline-none placeholder-gray-400"
              />
            </div>
          )}
        </div>
        {filteredSections.map((section) => {
          const isActive = selectedSection?.id === section.id;
          const isToggling = togglingSection === section.id;
          const isRunning = runningSection === section.id;

          return (
            <div
              key={section.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedSection(section);
                setSelectedArticle(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedSection(section);
                  setSelectedArticle(null);
                }
              }}
              className={`w-full text-left px-3 py-3 transition-colors cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-darkModeHover'
                  : 'bg-[#EDEDED] dark:bg-darkModeTable hover:bg-slate-50 dark:hover:bg-zinc-600'
              }`}
            >
              <div className="flex flex-row items-center justify-between">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {getSectionLabel(section)}
                  </div>
                  {section.frequencyInterval && (
                    <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {section.frequencyInterval}
                    </div>
                  )}
                </div>
                <div className="flex flex-row items-center gap-2 flex-shrink-0">
                  {sectionArticleCounts[section.id] !== undefined && (
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                      {sectionArticleCounts[section.id]}
                    </div>
                  )}

                  {/* Run now */}
                  <button
                    type="button"
                    title={section.enabled ? 'Run now' : 'Section is paused'}
                    disabled={
                      isRunning || !section.enabled || !!togglingSection
                    }
                    onClick={(e) => handleRunSection(e, section)}
                    className="disabled:opacity-40"
                  >
                    {isRunning ? (
                      <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <LuCalendar />
                    )}
                  </button>

                  {/* Enable / disable toggle */}
                  {isToggling ? (
                    <div className="w-6 h-4 flex items-center justify-center">
                      <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      title={
                        section.enabled ? 'Pause section' : 'Resume section'
                      }
                      onClick={(e) => handleToggleSection(e, section)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ')
                          handleToggleSection(e as any, section);
                      }}
                      className={`w-6 h-4 rounded-full flex items-center flex-shrink-0 px-0.5 cursor-pointer transition-colors ${
                        section.enabled
                          ? 'bg-[#34C759] justify-end'
                          : 'bg-gray-300 dark:bg-gray-600 justify-start'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Article List ── */}
      <div
        className={`overflow-y-auto flex-shrink-0 transition-all border-l-2 dark:border-darkModeTableBorder ${
          selectedSection
            ? 'w-[180px] min-w-[120px] xl:w-[200px] 1xl:w-1/3 1xl:min-w-[250px] 1xl:max-w-[300px]'
            : 'flex-1'
        }`}
      >
        {!selectedSection ? (
          <div className="flex items-center justify-center h-full py-12 text-gray-400 dark:text-gray-500 text-sm">
            Select a section to view articles.
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <label className="hidden 1xl:block font-bold text-[15px] truncate max-w-[60%]">
                  {getSectionLabel(selectedSection)}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-[#F3F3F3] dark:bg-darkModeTable px-3 py-1 rounded text-[#808080] dark:text-white">
                    {filteredArticles.length} articles
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowArticleSearch((v) => !v);
                      if (!showArticleSearch)
                        setTimeout(() => articleSearchRef.current?.focus(), 0);
                      else setArticleSearch('');
                    }}
                  >
                    <FiSearch size={16} />
                  </button>
                  <button
                    type="button"
                    title={articleSortAsc ? 'Oldest first' : 'Newest first'}
                    onClick={() => setArticleSortAsc((v) => !v)}
                  >
                    {articleSortAsc ? (
                      <BiSortAZ size={16} />
                    ) : (
                      <BiSortZA size={16} />
                    )}
                  </button>
                </div>
              </div>
              {showArticleSearch && (
                <div className="px-3 pb-2">
                  <input
                    ref={articleSearchRef}
                    type="text"
                    value={articleSearch}
                    onChange={(e) => setArticleSearch(e.target.value)}
                    placeholder="Search articles…"
                    onBlur={() =>
                      setTimeout(() => {
                        setShowArticleSearch(false);
                        setArticleSearch('');
                      }, 150)
                    }
                    className="w-full text-[12px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 outline-none placeholder-gray-400"
                  />
                </div>
              )}
            </div>
            {sectionArticles.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500 text-sm">
                No articles scraped yet.
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500 text-sm">
                No articles match your search.
              </div>
            ) : (
              filteredArticles.map((article) => {
                const isActive = selectedArticle?.url === article.url;
                return (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() =>
                      handleSelectStoreArticle(
                        article.id,
                        article.url,
                        article.title,
                      )
                    }
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ article, position: { x: e.clientX, y: e.clientY } });
                    }}
                    className={`w-full text-left px-3 py-3 transition-colors ${
                      isActive
                        ? 'bg-[#F3F3F3] dark:bg-darkModeTable'
                        : 'hover:bg-gray-50 dark:hover:bg-zinc-700'
                    }`}
                  >
                    <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
                      {article.title || '(no title)'}
                    </div>
                    <div className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 truncate">
                      {article.url}
                    </div>
                    <div className="flex gap-2 mt-1.5 text-[11px] text-gray-400 dark:text-gray-300">
                      <span>
                        {article.published_at
                          ? formatWordDate(article.published_at)
                          : '—'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </>
        )}
      </div>

      {/* ── Article Preview ── */}
      {selectedSection && (
        <div className="flex-1 overflow-y-auto border-l-2 border-[#E6E6E6] dark:border-darkModeTableBorder">
          {selectedArticle ? (
            <div className="flex flex-col gap-3 py-4 px-8">
              <div className="flex flex-col gap-3 px-3 pb-3">
                <div className="flex flex-row items-center gap-2.5">
                  <div className="flex items-center w-30 h-30 shrink-0">
                    <img
                      src={imgError ? articlePlaceholder : `https://picsum.photos/seed/${encodeURIComponent(selectedArticle.title ?? '')}/200/120`}
                      alt=""
                      className="w-28 h-28 object-cover self-center mt-3 rounded-md shadow-lg"
                      onError={() => setImgError(true)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p
                      className="text-[21px] font-black text-[#474747] dark:text-gray-100 leading-snug line-clamp-2"
                      title={selectedArticle.title ?? '(no title)'}
                      style={{
                        fontFamily: 'Roboto, sans-serif',
                        fontWeight: 950,
                        WebkitTextStroke: '0.3px currentColor',
                      }}
                    >
                      {selectedArticle.title ?? '(no title)'}
                    </p>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex flex-row items-center">
                        {selectedArticle.published_at && (
                          <p className="text-[11.5px] text-[#808080] dark:text-gray-500">
                            Published{' '}
                            {formatWordDate(selectedArticle.published_at)}
                          </p>
                        )}
                        {selectedArticle.url && (
                          <>
                            <LuDot className="text-[#808080]" />
                            <a
                              href={selectedArticle.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-[#808080] dark:text-gray-400"
                              title={selectedArticle.url}
                            >
                              {selectedArticle.url.length > 25
                                ? selectedArticle.url.slice(
                                    0,
                                    selectedArticle.url.indexOf('/', 25) + 1 ||
                                      25,
                                  ) + '…'
                                : selectedArticle.url}
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-row gap-1.5 items-center">
                      <div className="flex flex-row items-center gap-1">
                        <IoPersonCircleSharp
                          className="text-[#808080]"
                          size={18}
                        />
                        <p className="text-[11px] text-[#808080] dark:text-gray-400">
                          {selectedArticle.author ?? '—'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          navigator.clipboard.writeText(selectedArticle.url)
                        }
                        title="Copy link"
                        className="text-[#808080] hover:text-[#474747] dark:hover:text-gray-200"
                      >
                        <LuCopy size={13} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-4 mt-1">
                  {loadingPreview ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                      <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                      Loading content…
                    </div>
                  ) : selectedArticle.body_text ? (
                    <div className="flex flex-col gap-4">
                      {splitIntoParagraphs(selectedArticle.body_text).map(
                        (para, i) => (
                          <p
                            key={i}
                            className="text-[13px] text-[#5B5B5B] dark:text-gray-300 leading-relaxed font-[400]"
                          >
                            {para}
                          </p>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#5B5B5B] dark:text-gray-400 leading-relaxed font-[400]">
                      (no content)
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
              Select an article to preview.
            </div>
          )}
        </div>
      )}

      {contextMenu && (
        <ArticleContextMenu
          article={contextMenu.article}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onViewArticle={(id) => {
            const a = allArticleDownloads.find((d) => d.id === id);
            if (a) handleSelectStoreArticle(a.id, a.url, a.title);
          }}
          onOpenInBrowser={(url) => window.open(url, '_blank')}
          onOpenFolder={(filePath) => {
            (window as any).downlodrFunctions?.openFolder?.(filePath);
          }}
          onRemove={(id) => removeArticleDownload(id)}
          onRetry={(id) => {
            const a = allArticleDownloads.find((d) => d.id === id);
            if (a) {
              useArticleDownloadStore.getState().updateArticleDownload(id, { status: 'for_download' });
            }
          }}
          onToggleFavorite={(id) => {
            const a = allArticleDownloads.find((d) => d.id === id);
            if (!a) return;
            if (isFavorited(id)) {
              removeFavorite(id);
            } else {
              addFavorite({
                downloadId: a.id,
                videoUrl: a.url,
                title: a.title ?? '',
                displayName: a.title ?? '',
                downloadName: a.title ?? '',
                location: a.filePath ?? '',
                channelName: '',
                thumbnail: undefined,
                ext: '',
                duration: 0,
                size: a.fileSize ?? 0,
                extractorKey: '',
                tags: a.tags,
                category: a.category,
                description: undefined,
                chapters: undefined,
                status: a.status,
                autoCaptionLocation: undefined,
                transcriptLocation: undefined,
                dateAdded: a.dateAdded,
              });
            }
          }}
          isFavorited={contextMenu ? isFavorited(contextMenu.article.id) : false}
          onAddTag={addArticleTag}
          onRemoveTag={removeArticleTag}
          currentTags={contextMenu?.article.tags ?? []}
          availableTags={allAvailableTags}
          onAddCategory={addArticleCategory}
          onRemoveCategory={removeArticleCategory}
          currentCategories={contextMenu?.article.category ?? []}
          availableCategories={allAvailableCategories}
        />
      )}
    </div>
  );
};

export default AfdaDownloads;
