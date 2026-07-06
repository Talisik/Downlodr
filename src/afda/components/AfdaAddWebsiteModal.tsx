import BaseModal from '@/downlodr/components/modal/BaseModal';
import {
  getMissingAddonMessage,
  isMissingHandlerError,
  openAddonManager,
} from '@/core-app/utils/missingAddonError';
import { initialScrapeGuard } from '@/afda/hooks/initialScrapeGuard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';
import { useAfdaMapperStore } from '@/afda/store/afdaMapperStore';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import { extractFqdn } from '@/afda/utils/extractFqdn';
import type {
  FrequencyAnalysisResult,
  FrequencyInterval,
  MapperResult,
} from '@/afda/types/mapperTypes';
import { FiCheck } from 'react-icons/fi';

// ─── Types ───────────────────────────────────────────────────────────────────

type ScheduleConfig =
  | {
      type: 'interval_window';
      days: number[];
      intervals: {
        from: number;
        to: number;
        interval: FrequencyInterval;
        timezone: string;
      }[];
    }
  | { type: 'manual' };

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'News',
  'Sports',
  'Technology',
  'Business',
  'Entertainment',
  'Science',
  'Health',
  'Other',
];
const INTERVALS: FrequencyInterval[] = ['15 min', '1 hour', '6 hours', 'Daily'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractPath(sectionUrl: string): string {
  try {
    return new URL(sectionUrl).pathname || '/';
  } catch {
    return '/';
  }
}

function intervalToScheduleConfig(interval: FrequencyInterval): ScheduleConfig {
  return {
    type: 'interval_window',
    days: ALL_DAYS,
    intervals: [{ from: 0, to: 23, interval, timezone: 'UTC' }],
  };
}

function defaultInterval(
  analysis: FrequencyAnalysisResult | undefined,
): FrequencyInterval {
  return analysis?.status === 'complete'
    ? analysis.suggested_interval
    : '1 hour';
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'text-green-600 dark:text-green-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  low: 'text-gray-500 dark:text-gray-400',
};

const CONFIDENCE_DOT_COLORS: Record<string, string> = {
  high: 'bg-green-500',
  medium: 'bg-orange-500',
  low: 'bg-gray-400',
};

function sectionNameFromUrl(sectionUrl: string): string {
  try {
    const path = new URL(sectionUrl).pathname;
    const segment =
      path.replace(/^\//, '').split('/').filter(Boolean).pop() || '/';
    return segment
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return sectionUrl;
  }
}

// ─── Phase type ───────────────────────────────────────────────────────────────

type Phase = 'form' | 'running' | 'sections' | 'saving' | 'error';

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionRow = ({
  sectionUrl,
  analysis,
  selected,
  interval,
  mode,
  onToggle,
  onIntervalChange,
  onModeChange,
}: {
  sectionUrl: string;
  analysis: FrequencyAnalysisResult | undefined;
  selected: boolean;
  interval: FrequencyInterval;
  mode: 'auto' | 'manual';
  onToggle: () => void;
  onIntervalChange: (v: FrequencyInterval) => void;
  onModeChange: (m: 'auto' | 'manual') => void;
}) => {
  const name = sectionNameFromUrl(sectionUrl);
  const hasTA = analysis?.status === 'complete';
  const confidenceLabel = hasTA
    ? analysis!.confidence.charAt(0).toUpperCase() +
      analysis!.confidence.slice(1)
    : null;

  return (
    <div className="rounded-xl bg-[#F9F9F9] dark:bg-white/5 transition-colors">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-[#F3F3F3] dark:bg-zinc-800 rounded-t-xl"
        onClick={onToggle}
      >
        <div
          className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
            selected
              ? 'bg-primary border-primary'
              : 'bg-white dark:bg-transparent border-gray-300 dark:border-gray-500'
          }`}
        >
          {selected && (
            <FiCheck size={10} className="text-white" strokeWidth={3} />
          )}
        </div>

        <span className="font-semibold text-sm text-gray-800 dark:text-gray-100 flex-1 truncate">
          {name}
        </span>

        {hasTA && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${
                CONFIDENCE_DOT_COLORS[analysis!.confidence]
              }`}
            />
            <span
              className={`text-xs font-medium ${
                CONFIDENCE_COLORS[analysis!.confidence]
              }`}
            >
              {confidenceLabel}
            </span>
          </div>
        )}
      </div>

      {/* Config — only when selected */}
      {selected && (
        <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-700/50">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-2.5 mb-2">
            Basic Configuration
          </p>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Check Frequency
            </span>
            <div className="flex rounded border border-gray-200 dark:border-gray-600 overflow-hidden text-xs">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onModeChange('auto');
                }}
                className={`px-3 py-1 transition-colors ${
                  mode === 'auto'
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'bg-white dark:bg-darkModeCompliment text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onModeChange('manual');
                }}
                className={`px-3 py-1 transition-colors border-l border-gray-200 dark:border-gray-600 ${
                  mode === 'manual'
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'bg-white dark:bg-darkModeCompliment text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                Manual
              </button>
            </div>
          </div>

          {mode === 'auto' && hasTA && (
            <p className="text-xs text-primary mt-1.5">
              Suggested {confidenceLabel} Frequency (Every ~
              {analysis!.suggested_interval})
            </p>
          )}
          {mode === 'manual' && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Interval
              </span>
              <select
                value={interval}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  onIntervalChange(e.target.value as FrequencyInterval)
                }
                className="text-xs border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 bg-white dark:bg-darkModeCompliment text-gray-700 dark:text-gray-300"
              >
                {INTERVALS.map((iv) => (
                  <option key={iv} value={iv}>
                    {iv}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main modal ───────────────────────────────────────────────────────────────

const AfdaAddWebsiteModal = ({
  isOpen,
  onClose,
  initialUrl,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialUrl?: string;
  onSaved?: (name: string, id: string) => void;
}) => {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [websiteName, setWebsiteName] = useState('');

  const addWebsite = useAfdaWebsitesStore((s) => s.addWebsite);
  const addAfdaArticle = useArticleDownloadStore((s) => s.addAfdaArticle);
  const {
    startChannelAnalysis,
    finishChannelAnalysis,
    clearChannelAnalysis,
    analyzingStatus,
  } = useSkedulosaStore();

  const [phase, setPhase] = useState<Phase>('running');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const analysisStarted = useRef(false);

  const [articleLimit, setArticleLimit] = useState<number>(5);
  const [mapperResult, setMapperResult] = useState<MapperResult | null>(null);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    new Set(),
  );
  const [sectionIntervals, setSectionIntervals] = useState<
    Record<string, FrequencyInterval>
  >({});
  const [sectionModes, setSectionModes] = useState<
    Record<string, 'auto' | 'manual'>
  >({});

  const setBridgeError = useCallback((message: string) => {
    if (isMissingHandlerError(message)) {
      openAddonManager('afda');
      setErrorMsg(getMissingAddonMessage('afda'));
    } else {
      setErrorMsg(message);
    }
    setPhase('error');
  }, []);

  const resetForm = useCallback(() => {
    setWebsiteUrl('');
    setWebsiteName('');
    setArticleLimit(5);
    setPhase('running');
    setErrorMsg(null);
    setRetryKey(0);
    setMapperResult(null);
    setSelectedSections(new Set());
    setSectionIntervals({});
    setSectionModes({});
    setConfirmingCancel(false);
    clearChannelAnalysis();
    analysisStarted.current = false;
  }, [clearChannelAnalysis]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleCancelClick = useCallback(() => {
    if (phase === 'sections' || phase === 'saving') {
      setConfirmingCancel(true);
    } else {
      handleClose();
    }
  }, [phase, handleClose]);

  // Close when GlobalScanningModal Cancel is clicked during our analysis.
  // Normal completion sets analysisStarted=false before analyzingStatus→'idle',
  // so this only fires for an external cancel (idle without going through 'done').
  useEffect(() => {
    if (analyzingStatus === 'done') {
      analysisStarted.current = false;
      return;
    }
    if (analyzingStatus === 'idle' && analysisStarted.current) {
      analysisStarted.current = false;
      handleClose();
    }
  }, [analyzingStatus, handleClose]);

  // ── Auto-run mapper whenever the modal opens with a URL ────────────────────

  useEffect(() => {
    if (!isOpen || !initialUrl) return;

    const url = initialUrl.trim();
    const fqdn = extractFqdn(url);
    if (!url || !fqdn) {
      setPhase('error');
      setErrorMsg('Invalid URL provided');
      return;
    }

    setWebsiteUrl(url);
    setWebsiteName(fqdn);

    const bridge =
      typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
    if (!bridge) {
      openAddonManager('afda');
      setErrorMsg(getMissingAddonMessage('afda'));
      setPhase('error');
      return;
    }

    // A finished run for this site may already be stashed (mapper completed
    // while the user was away after "Run in background"). The consume effect
    // below picks it up — don't start a second run.
    const { pendingResult, pendingError } = useAfdaMapperStore.getState();
    if (pendingResult?.fqdn === fqdn || pendingError?.fqdn === fqdn) return;

    // A stash for a different site is stale — this run supersedes it.
    useAfdaMapperStore.getState().clearPending();

    setPhase('running');
    setErrorMsg(null);
    setMapperResult(null);
    setSelectedSections(new Set());
    setSectionIntervals({});

    startChannelAnalysis(url, false);
    analysisStarted.current = true;

    // Completion arrives via mapper:complete/mapper:error, handled app-wide by
    // GlobalAfdaMapperListener (this modal unmounts if the user navigates away
    // mid-analysis) and consumed from afdaMapperStore by the effect below.
    bridge.mapper
      .run({
        website_url: url,
        fqdn,
        website_name: fqdn,
        website_category: 'News',
      })
      .catch((err: unknown) => {
        analysisStarted.current = false;
        finishChannelAnalysis();
        setBridgeError(
          err instanceof Error ? err.message : 'Failed to start mapper',
        );
      });
  }, [isOpen, initialUrl, retryKey, setBridgeError]);

  // ── Consume mapper results stashed by GlobalAfdaMapperListener ─────────────
  // Fires both while the modal stays open and on re-mount after the user
  // navigated away during "Run in background".

  const pendingMapperResult = useAfdaMapperStore((s) => s.pendingResult);
  const pendingMapperError = useAfdaMapperStore((s) => s.pendingError);

  useEffect(() => {
    if (!isOpen || !initialUrl) return;
    const fqdn = extractFqdn(initialUrl.trim());
    if (!fqdn) return;

    if (pendingMapperResult && pendingMapperResult.fqdn === fqdn) {
      useAfdaMapperStore.getState().clearPending();
      const analyses = pendingMapperResult.section_analyses ?? {};
      const intervals: Record<string, FrequencyInterval> = {};
      const modes: Record<string, 'auto' | 'manual'> = {};
      for (const sectionUrl of pendingMapperResult.section_links) {
        intervals[sectionUrl] = defaultInterval(analyses[sectionUrl]);
        modes[sectionUrl] = 'auto';
      }
      setMapperResult(pendingMapperResult);
      setSelectedSections(new Set(pendingMapperResult.section_links));
      setSectionIntervals(intervals);
      setSectionModes(modes);
      setPhase('sections');
    } else if (pendingMapperError && pendingMapperError.fqdn === fqdn) {
      useAfdaMapperStore.getState().clearPending();
      setBridgeError(pendingMapperError.message);
    }
  }, [
    isOpen,
    initialUrl,
    pendingMapperResult,
    pendingMapperError,
    setBridgeError,
  ]);

  // ── Section toggle ─────────────────────────────────────────────────────────

  const toggleSection = useCallback((url: string) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (!mapperResult) return;
    setSelectedSections((prev) =>
      prev.size === mapperResult.section_links.length
        ? new Set()
        : new Set(mapperResult.section_links),
    );
  }, [mapperResult]);

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!mapperResult || selectedSections.size === 0) return;

    const bridge =
      typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
    if (!bridge) {
      openAddonManager('afda');
      setErrorMsg(getMissingAddonMessage('afda'));
      setPhase('error');
      return;
    }

    setPhase('saving');

    // Track section ids added to the initial-scrape guard so we can release
    // them if the save/scrape flow throws before finishInitialScrape runs.
    const guardedSectionIds = new Set<number>();

    const selected_sections = [...selectedSections].map((sectionUrl) => {
      const sectionMode = sectionModes[sectionUrl] ?? 'auto';
      const effectiveInterval =
        sectionMode === 'auto'
          ? defaultInterval(mapperResult.section_analyses?.[sectionUrl])
          : sectionIntervals[sectionUrl] ?? 'Daily';
      return {
        section_url: sectionUrl,
        section_path: extractPath(sectionUrl),
        schedule_config: intervalToScheduleConfig(effectiveInterval),
        enabled: true,
        max_articles_per_run: articleLimit,
      };
    });

    try {
      const result = await bridge.websites.save({
        fqdn: mapperResult.fqdn,
        website_url: mapperResult.website_url,
        website_name: websiteName || mapperResult.website_name,
        website_category: mapperResult.website_category,
        mapper_raw: mapperResult.mapper_raw,
        pagination: mapperResult.pagination,
        selected_sections,
      });
      if (result?.website) {
        addWebsite(result.website);
        const website = result.website;
        const sections: Array<{ id: string; enabled: boolean }> =
          website.sections ?? [];
        const sectionIds = new Set(
          sections.filter((s) => s.enabled).map((s) => parseInt(s.id)),
        );

        console.log('[AFDA] runNow for section_ids:', [...sectionIds]);

        // Block useAfdaArticleSync from adding articles during the initial scrape
        for (const id of sectionIds) {
          initialScrapeGuard.add(id);
          guardedSectionIds.add(id);
        }

        for (const id of sectionIds) {
          await bridge.scrape.runNow({ section_id: id });
        }

        // Collect first N scraped articles then stop listening
        const MAX_ARTICLES = articleLimit;
        let collected = 0;
        let unsub: (() => void) | null = null;

        const finishInitialScrape = () => {
          for (const id of sectionIds) {
            initialScrapeGuard.delete(id);
            guardedSectionIds.delete(id);
            bridge.sections.setMaxArticles({
              section_id: id,
              max_articles_per_run: articleLimit,
            });
          }
        };

        const timeout = setTimeout(() => {
          console.log(
            '[AFDA] scrapeArticleSaved listener timed out after 60s, collected:',
            collected,
          );
          unsub?.();
          finishInitialScrape();
        }, 60_000);

        console.log(
          '[AFDA] registering scrapeArticleSaved listener, watching section_ids:',
          [...sectionIds],
        );
        unsub = bridge.on.scrapeArticleSaved(
          async (data: {
            article_id: number;
            section_id: number;
            url: string;
          }) => {
            console.log(
              '[AFDA] scrapeArticleSaved event received:',
              data,
              '| sectionIds has it:',
              sectionIds.has(data.section_id),
              '| collected:',
              collected,
            );
            if (!sectionIds.has(data.section_id) || collected >= MAX_ARTICLES)
              return;
            collected++;
            if (collected >= MAX_ARTICLES) {
              clearTimeout(timeout);
              unsub?.();
              finishInitialScrape();
            }
            try {
              console.log('[AFDA] fetching article with id:', data.article_id);
              const article = await bridge.articles.get({
                article_id: data.article_id,
              });
              console.log('[AFDA] article fetch result:', article);
              if (article) {
                console.log(
                  '[AFDA] calling addAfdaArticle for:',
                  article.title ?? data.url,
                );
                addAfdaArticle(
                  `afda-article-${data.article_id}`,
                  article.title ?? data.url,
                  data.url,
                  website.id,
                  new Date().toISOString(),
                  article.heroImage ?? null,
                  undefined,
                  article.published_at ?? null,
                );
              } else {
                console.warn(
                  '[AFDA] article fetch returned null/undefined for id:',
                  data.article_id,
                );
              }
            } catch (err) {
              console.error(
                '[AFDA] failed to fetch article:',
                data.article_id,
                err,
              );
            }
          },
        );
      }
      const savedName = websiteName || mapperResult.website_name;
      const savedId = result.website.id;
      handleClose();
      onSaved?.(savedName, savedId);
    } catch (err) {
      // Release any guard entries added before the failure, otherwise
      // useAfdaArticleSync would permanently skip these sections this session.
      for (const id of guardedSectionIds) {
        initialScrapeGuard.delete(id);
      }
      guardedSectionIds.clear();
      setBridgeError(
        err instanceof Error ? err.message : 'Failed to save website',
      );
    }
  }, [
    mapperResult,
    selectedSections,
    sectionIntervals,
    sectionModes,
    articleLimit,
    handleClose,
    onSaved,
    setBridgeError,
  ]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const allSelected =
    mapperResult != null &&
    selectedSections.size === mapperResult.section_links.length;

  const title = 'Subscribe to a source';

  // ── Footer ─────────────────────────────────────────────────────────────────

  const footer = (
    <div className="flex items-center justify-between gap-2 pb-2 -mt-2 w-full">
      {confirmingCancel ? (
        <>
          <p className="text-[12px] text-gray-600 dark:text-gray-300 flex-1 text-center">
            Exit setup? Your progress will be lost.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmingCancel(false)}
              className="bg-buttonBg dark:bg-darkModeCompliment border border-buttonBorder dark:border-darkModeCompliment text-black dark:text-gray-200 px-4 py-1.5 rounded-md text-sm"
            >
              Stay
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="bg-red-500 hover:opacity-90 text-white px-4 py-1.5 rounded-md text-sm"
            >
              Exit
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={handleCancelClick}
            className="flex-1 max-w-[300px] bg-buttonBg dark:bg-darkModeCompliment border border-buttonBorder dark:border-darkModeCompliment text-black dark:text-gray-200 py-1.5 rounded-md text-sm"
          >
            Cancel
          </button>

          {phase === 'error' ? (
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="flex-1 max-w-[300px] bg-primary hover:opacity-90 text-white py-1.5 rounded-md text-sm"
            >
              Retry
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={phase !== 'sections' || selectedSections.size === 0}
              className={`flex-1 max-w-[300px] text-white py-1.5 rounded-md text-sm ${
                phase === 'sections' && selectedSections.size > 0
                  ? 'bg-primary hover:opacity-90 dark:hover:opacity-75'
                  : 'bg-primary/50 cursor-not-allowed'
              }`}
            >
              {phase === 'saving' ? 'Subscribing…' : 'Subscribe'}
            </button>
          )}
        </>
      )}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <BaseModal
      isOpen={isOpen && analyzingStatus === 'idle'}
      onClose={handleCancelClick}
      title={title}
      width="max-w-[600px]"
      maxHeight="max-h-[95vh]"
      contentClassName="overflow-y-auto"
      containerClassName="bg-white dark:bg-darkMode"
      footer={footer}
    >
      {/* ── Error ── */}
      {phase === 'error' && errorMsg && (
        <div className="flex flex-col gap-4 pt-1">
          <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2">
            {errorMsg}
          </div>
        </div>
      )}

      {/* ── Section picker ── */}
      {(phase === 'sections' || phase === 'saving') && mapperResult && (
        <div className="flex flex-col gap-3 pt-0 p-4 ">
          {/* Subscription name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Subscription Name
            </label>
            <input
              type="text"
              value={websiteName}
              onChange={(e) => setWebsiteName(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 bg-[#F3F3F3] dark:bg-darkModeCompliment text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Article limit */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Max Articles to Download
            </label>
            <select
              value={articleLimit}
              onChange={(e) => setArticleLimit(Number(e.target.value))}
              className="w-full text-xs px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 bg-[#F3F3F3] dark:bg-darkModeCompliment text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {[5, 10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between gap-2 flex-wrap mt-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                  selectedSections.size === mapperResult.section_links.length
                    ? 'bg-primary border-primary'
                    : selectedSections.size > 0
                    ? 'bg-primary/40 border-primary/60'
                    : 'bg-white dark:bg-transparent border-gray-300 dark:border-gray-500'
                }`}
                onClick={toggleAll}
              >
                {selectedSections.size > 0 && (
                  <FiCheck size={10} className="text-white" strokeWidth={3} />
                )}
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {mapperResult.section_links.length} section
                {mapperResult.section_links.length !== 1 ? 's' : ''} detected
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedSections.size > 0 && (
                <span className="text-xs text-primary font-medium">
                  ({selectedSections.size}) Selected
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  setSelectedSections(new Set(mapperResult.section_links))
                }
                className="text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded px-2 py-0.5 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelectedSections(new Set())}
                className="text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded px-2 py-0.5 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* Section rows */}
          <div className="flex flex-col gap-4 max-h-[320px] overflow-y-auto hover-scrollbar pr-1">
            {mapperResult.section_links.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 px-3 py-4 text-center">
                No sections were discovered for this site.
              </p>
            ) : (
              mapperResult.section_links.map((url) => (
                <SectionRow
                  key={url}
                  sectionUrl={url}
                  analysis={mapperResult.section_analyses?.[url]}
                  selected={selectedSections.has(url)}
                  interval={sectionIntervals[url] ?? 'Daily'}
                  mode={sectionModes[url] ?? 'auto'}
                  onToggle={() => toggleSection(url)}
                  onIntervalChange={(iv) =>
                    setSectionIntervals((prev) => ({ ...prev, [url]: iv }))
                  }
                  onModeChange={(m) =>
                    setSectionModes((prev) => ({ ...prev, [url]: m }))
                  }
                />
              ))
            )}
          </div>

          {phase === 'saving' && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 rounded-md px-3 py-2">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              Saving website and sections…
            </div>
          )}
        </div>
      )}
    </BaseModal>
  );
};

export default AfdaAddWebsiteModal;
