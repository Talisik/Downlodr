import BaseModal from '@/downlodr/components/modal/BaseModal';
import { openAddonManager } from '@/core-app/utils/missingAddonError';
import { initialScrapeGuard } from '@/afda/hooks/initialScrapeGuard';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useAfdaWebsitesStore,
  socialSourceToWebsite,
} from '@/afda/store/afdaWebsitesStore';
import { useAfdaMapperStore } from '@/afda/store/afdaMapperStore';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import { syncSocialSource } from '@/afda/hooks/useAfdaSocialSync';
import { extractFqdn } from '@/afda/utils/extractFqdn';
import type {
  FrequencyAnalysisResult,
  FrequencyInterval,
  MapperResult,
} from '@/afda/types/mapperTypes';
import { FiCheck } from 'react-icons/fi';
import AddonGate from '@/core-app/components/AddonGate';
import { useAddonStore } from '@/core-app/store/addonStore';

/**
 * Turns an exception from an afdaBridge call into copy a user can act on.
 *
 * Electron stringifies a missing `ipcMain.handle` as
 * "Error invoking remote method 'mapper:run': Error: No handler registered
 * for 'mapper:run'". Surfacing that verbatim leaks an internal channel name
 * and tells the user nothing. The realistic cause is that the Article
 * Fetcher add-on pack isn't installed, so its main-process handlers were
 * never registered — point at that instead.
 */
function friendlyBridgeError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (/No handler registered for/i.test(raw)) {
    return 'Article Fetcher is not installed, so this action is unavailable. Install it from Add-ons, then try again.';
  }
  return raw || fallback;
}

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

type Phase = 'form' | 'running' | 'sections' | 'social' | 'saving' | 'error';

// Social platforms handled by AFDA's social pipeline (no mapper / no sections).
// 'fb' is the registry's fallback, so detectPlatform never returns 'article';
// the modal decides article-vs-social by whether the host matches a known
// social domain, not by the registry's fb fallback.
const SOCIAL_PRESETS: { value: string; label: string }[] = [
  { value: 'every_15m', label: 'Every 15 minutes' },
  { value: 'every_30m', label: 'Every 30 minutes' },
  { value: 'every_1h', label: 'Every hour' },
  { value: 'every_6h', label: 'Every 6 hours' },
  { value: 'daily', label: 'Daily' },
];

const SOCIAL_PLATFORM_LABELS: Record<string, string> = {
  x: 'X (Twitter)',
  reddit: 'Reddit',
  youtube: 'YouTube',
  fb: 'Facebook',
};

// Mirror of the backend registry's detectPlatform host rules, used to decide
// whether a URL should take the social path at all (the backend fb fallback
// would otherwise classify every non-social site as 'fb').
function isSocialUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes('x.com') ||
    u.includes('twitter.com') ||
    u.includes('reddit.com') ||
    u.includes('youtube.com') ||
    u.includes('youtu.be') ||
    u.includes('facebook.com') ||
    u.includes('fb.com')
  );
}

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

  // ── Social source state (used when the entered URL is a social platform) ────
  const [socialPlatform, setSocialPlatform] = useState<string | null>(null);
  const [socialPreset, setSocialPreset] = useState<string>('every_1h');
  const [socialAccount, setSocialAccount] = useState<string>('');

  // URL the run effect should actually use. Normally null (meaning: use the
  // `initialUrl` prop), but the error-state Source URL field writes the user's
  // corrected value here so Retry resubmits what they can actually see, rather
  // than silently replaying the original prop.
  const retryUrlRef = useRef<string | null>(null);

  // Article Fetcher backend lives in a downloadable add-on pack. When it isn't
  // installed, none of the `mapper:*` handlers exist in the main process, so
  // every invoke rejects with a raw "No handler registered" error. Gate the
  // modal body on the pack instead of firing IPC into the void.
  const afdaPackStatus = useAddonStore((s) => s.afda.status);
  const afdaWorkerReady = useAddonStore((s) => s.afdaWorkerReady);
  const refreshAfdaWorkerStatus = useAddonStore(
    (s) => s.refreshAfdaWorkerStatus,
  );
  // afdaWorkerReady is required in addition to status === 'ready': the
  // pack's files can be on disk (status flips to 'ready') well before the
  // AFDA utilityProcess worker has actually forked and registered
  // mapper:run — that fork happens asynchronously in the main process.
  // Gating on status alone left a real window (worst case: the worker's own
  // init throws and it never becomes ready at all) where this effect still
  // fired bridge.mapper.run() at an unregistered channel.
  const afdaPackReady = afdaPackStatus === 'ready' && afdaWorkerReady;

  // Belt-and-suspenders against initFromMain's one-time query/subscription
  // missing the worker's ready transition (e.g. this modal is opened long
  // after app start, or the initial query raced the worker in the other
  // direction). Cheap no-op once already ready.
  useEffect(() => {
    if (isOpen && !afdaWorkerReady) {
      void refreshAfdaWorkerStatus();
    }
  }, [isOpen, afdaWorkerReady, refreshAfdaWorkerStatus]);

  const setBridgeError = useCallback((message: string) => {
    setErrorMsg(message);
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
    setSocialPlatform(null);
    setSocialPreset('every_1h');
    setSocialAccount('');
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
    // Pack missing → the gate renders instead of the form; don't invoke IPC.
    if (!afdaPackReady) return;

    // Prefer the value the user corrected in the error state over the prop.
    const url = (retryUrlRef.current ?? initialUrl).trim();
    const fqdn = extractFqdn(url);
    if (!url || !fqdn) {
      setWebsiteUrl(url);
      setPhase('error');
      setErrorMsg('That does not look like a valid URL. Check it and retry.');
      return;
    }

    setWebsiteUrl(url);
    setWebsiteName(fqdn);

    const bridge =
      typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
    if (!bridge) {
      openAddonManager('afda');
      setErrorMsg(
        'Article Fetcher is not available. Install it from Add-ons, then try again.',
      );
      setPhase('error');
      return;
    }

    // ── Social branch ────────────────────────────────────────────────────────
    // A social profile (X / Reddit / Facebook / YouTube) has no article
    // sections, so the mapper does not apply. Skip straight to the social form.
    if (isSocialUrl(url)) {
      const platform = bridge.social?.detectPlatform
        ? undefined // resolved async below
        : 'fb';
      // detectPlatform is cheap + sync server-side, but we call it over IPC.
      Promise.resolve(
        bridge.social?.detectPlatform
          ? bridge.social.detectPlatform({ url })
          : { platform: platform ?? 'fb' },
      )
        .then((res: { platform: string }) => {
          setSocialPlatform(res?.platform ?? 'fb');
        })
        .catch(() => setSocialPlatform('fb'));
      // Default the subscription name to the profile handle.
      let handle = fqdn;
      try {
        const u = new URL(url);
        handle = u.pathname.split('/').filter(Boolean).pop() || fqdn;
      } catch {
        /* keep fqdn */
      }
      setWebsiteName(handle);
      setPhase('social');
      setErrorMsg(null);
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
        setBridgeError(friendlyBridgeError(err, 'Failed to start mapper'));
      });
  }, [isOpen, initialUrl, retryKey, setBridgeError, afdaPackReady]);

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

  // ── Save (social source) ─────────────────────────────────────────────────────

  const handleSaveSocial = useCallback(async () => {
    const bridge =
      typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
    if (!bridge?.social) {
      setPhase('error');
      setErrorMsg('Social sources are unavailable in this build');
      return;
    }
    const url = initialUrl?.trim();
    if (!url) return;

    setPhase('saving');
    try {
      // 1. Persist the source (platform auto-detected server-side from the URL).
      const addRes = await bridge.social.sources.add({
        url,
        label: websiteName || url,
        account: socialAccount.trim() || null,
      });
      const source = addRes?.source;
      if (!addRes?.ok || !source) {
        throw new Error(addRes?.error || 'Failed to add social source');
      }

      // 2. Assign the recurring schedule (preset → ScheduleConfig).
      await bridge.social.schedule.assign({
        id: source.id,
        config: { type: 'preset', preset: socialPreset },
      });

      // 3. Show it in the subscriptions list immediately (re-read so the row
      //    reflects the assigned schedule/next_run_at).
      let finalRow = source;
      try {
        const fresh = await bridge.social.sources.get({ id: source.id });
        if (fresh) finalRow = fresh;
      } catch {
        /* fall back to the add result */
      }
      const savedWebsite = socialSourceToWebsite(finalRow);
      addWebsite(savedWebsite);

      // 4. Kick off an immediate first scrape so posts show up right away.
      //    scrapeNow resolves only after posts are stored, so we can mirror them
      //    into the Downloads-list store immediately rather than waiting for the
      //    60s poll in useAfdaSocialSync. Best-effort: failures shouldn't block
      //    subscribing.
      try {
        await bridge.social.sources.scrapeNow({ id: source.id });
        await syncSocialSource(source.id, savedWebsite.id);
      } catch (err) {
        console.warn('[AFDA] initial social scrape/sync failed:', err);
      }

      const savedName = websiteName || url;
      handleClose();
      // Pass the store id (`social-<id>`), not the raw numeric id — the detail
      // route and website store both key social sources by that prefixed id, so
      // "View Subscription" can navigate to /skedulosa/selected-article/<id>.
      onSaved?.(savedName, savedWebsite.id);
    } catch (err) {
      setPhase('error');
      setErrorMsg(
        friendlyBridgeError(err, 'Failed to add social source'),
      );
    }
  }, [
    initialUrl,
    websiteName,
    socialAccount,
    socialPreset,
    addWebsite,
    handleClose,
    onSaved,
  ]);

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!mapperResult || selectedSections.size === 0) return;

    const bridge =
      typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
    if (!bridge) {
      openAddonManager('afda');
      setErrorMsg('Article Fetcher is not available. Please restart Downlodr.');
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
                  String(data.section_id),
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
      setBridgeError(friendlyBridgeError(err, 'Failed to save website'));
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
              onClick={() => {
                // Resubmit exactly what the field shows, not the original prop.
                retryUrlRef.current = websiteUrl.trim();
                setRetryKey((k) => k + 1);
              }}
              disabled={!websiteUrl.trim()}
              className={`flex-1 max-w-[300px] text-white py-1.5 rounded-md text-sm ${
                websiteUrl.trim()
                  ? 'bg-primary hover:opacity-90'
                  : 'bg-primary/50 cursor-not-allowed'
              }`}
            >
              Retry
            </button>
          ) : (
            (() => {
              const canSubmitSections =
                phase === 'sections' && selectedSections.size > 0;
              const canSubmitSocial =
                phase === 'social' && !!websiteName.trim();
              const canSubmit = canSubmitSections || canSubmitSocial;
              return (
                <button
                  type="button"
                  onClick={phase === 'social' ? handleSaveSocial : handleSave}
                  disabled={!canSubmit}
                  className={`flex-1 max-w-[300px] text-white py-1.5 rounded-md text-sm ${
                    canSubmit
                      ? 'bg-primary hover:opacity-90 dark:hover:opacity-75'
                      : 'bg-primary/50 cursor-not-allowed'
                  }`}
                >
                  {phase === 'saving' ? 'Subscribing…' : 'Subscribe'}
                </button>
              );
            })()
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
      footer={afdaPackReady ? footer : undefined}
    >
      {/* Pack missing → show the install prompt instead of a form that can
          only fail. AddonGate renders its own download/progress UI. */}
      {!afdaPackReady && (
        <div className="p-4">
          <AddonGate packName="afda-backend">{null}</AddonGate>
        </div>
      )}

      {/* ── Error ──
          The Source URL field stays mounted here on purpose. This used to
          render the banner alone, which unmounted every form block: the user
          could not see what they had submitted, could not correct it, and
          Retry silently replayed the original prop. Keeping the field visible
          and editable makes Retry act on what is actually on screen. */}
      {afdaPackReady && phase === 'error' && errorMsg && (
        <div className="flex flex-col gap-3 pt-1 p-4">
          <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2">
            {errorMsg}
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="afda-source-url"
              className="text-xs text-gray-600 dark:text-gray-300"
            >
              Source URL
            </label>
            <input
              id="afda-source-url"
              type="text"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && websiteUrl.trim()) {
                  retryUrlRef.current = websiteUrl.trim();
                  setRetryKey((k) => k + 1);
                }
              }}
              spellCheck={false}
              autoComplete="off"
              placeholder="https://example.com"
              className="w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md h-8 text-sm"
            />
          </div>
        </div>
      )}

      {/* ── Social source form ── */}
      {afdaPackReady &&
        (phase === 'social' || (phase === 'saving' && socialPlatform)) && (
        <div className="flex flex-col gap-3 pt-0 p-4">
          {/* Detected platform banner */}
          <div className="flex items-center gap-2 text-xs bg-primary/10 text-primary rounded-md px-3 py-2">
            <FiCheck size={12} strokeWidth={3} />
            Detected{' '}
            {socialPlatform
              ? SOCIAL_PLATFORM_LABELS[socialPlatform] ?? socialPlatform
              : 'social'}{' '}
            profile — this will be tracked as a social source (no sections).
          </div>

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

          {/* Check frequency */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Check Frequency
            </label>
            <select
              value={socialPreset}
              onChange={(e) => setSocialPreset(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 bg-[#F3F3F3] dark:bg-darkModeCompliment text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {SOCIAL_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Login account (optional — needed for FB/X private/paywalled) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Login Account{' '}
              <span className="text-gray-400 dark:text-gray-500">
                (optional — required for some Facebook/X profiles)
              </span>
            </label>
            <input
              type="text"
              value={socialAccount}
              placeholder="accounts.json username"
              onChange={(e) => setSocialAccount(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 bg-[#F3F3F3] dark:bg-darkModeCompliment text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {phase === 'saving' && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 rounded-md px-3 py-2">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              Adding social source…
            </div>
          )}
        </div>
      )}

      {/* ── Section picker ── */}
      {afdaPackReady &&
        (phase === 'sections' || phase === 'saving') && mapperResult && (
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
