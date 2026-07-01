import graph from '@/assets/skedulosa/images/graph.svg';
import Input from '@/core-app/components/shadcn/components/ui/input';
import { ToggleGroup } from '@/core-app/components/shadcn/components/ui/toggle-group';
import { showSkedulosaError } from '@/skedulosa/error-mapping/skedulosaErrors';
import { useSettingStore } from '@/core-app/store/settingsStore';
import BaseModal from '@/downlodr/components/modal/BaseModal';
import {
  useSkedulosaStore,
  type ScheduleDay,
} from '@/skedulosa/store/skedulosaStore';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import { useSubscriptionQueue } from '@/skedulosa/context/SubscriptionQueueContext';
import type { QueuedSubscriptionData } from '@/skedulosa/types/subscriptionQueue';
import { generateDummySubscription } from '@/skedulosa/utils/generateDummySubscription';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/core-app/components/shadcn/components/ui/tooltip';
import { ChevronDown, Folder } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaRegCheckCircle, FaRegClock } from 'react-icons/fa';
import { LiaQuestionCircle } from 'react-icons/lia';
import { useNavigate } from 'react-router-dom';
import { ToastAction } from '@/core-app/components/shadcn/components/ui/toast';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { LuGlobe } from 'react-icons/lu';

const isYouTubeUrl = (url: string): boolean =>
  ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'].some((h) => {
    try {
      return new URL(url).hostname === h;
    } catch {
      return false;
    }
  });

type ChannelAnalysisResult = {
  intelligentPrediction: {
    nextScrapeTime: string;
    pattern: string;
    confidence: number;
    expectedVideos: number;
    isErratic: boolean;
  } | null;
  suggestedSlots: { day_of_week: number; time_minutes: number }[];
  videoCount: number;
  message: string;
  /** Raw video list returned by the toolkit — passed to saveAnalysisVideos to seed the intelligent schedule. */
  videos?: unknown[];
  error?: string;
};

type ChannelDetailsResult = {
  channelName: string;
  avatarUrl: string;
  subscriberCount: number;
  videoCount: string;
  site: string;
};

const formatSubscriberCount = (count: number): string => {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
};

const ChannelInfo = ({
  name,
  url,
  videoCount,
  details,
  firstScrapeLimit,
  onFirstScrapeLimitChange,
}: {
  name: string;
  url: string;
  videoCount: number;
  details?: ChannelDetailsResult | null;
  firstScrapeLimit: number;
  onFirstScrapeLimitChange: (value: number) => void;
}) => {
  const { t } = useTranslation('skedulosa');

  // Clamp firstScrapeLimit to valid range whenever videoCount changes
  useEffect(() => {
    if (videoCount > 0 && firstScrapeLimit > videoCount) {
      onFirstScrapeLimitChange(videoCount);
    } else if (
      videoCount > 0 &&
      videoCount < 1 &&
      firstScrapeLimit !== videoCount
    ) {
      onFirstScrapeLimitChange(videoCount);
    }
  }, [videoCount]);

  // Build dropdown options: base values filtered to < videoCount, plus videoCount as "All"
  const baseValues = [1, 2, 3, 4, 5];
  const scrapeOptions: { value: number; label: string }[] =
    videoCount < 1
      ? [
          {
            value: videoCount,
            label: t('subscribeModal.channelInfo.scrapeAllLabel', {
              count: videoCount,
            }),
          },
        ]
      : [
          ...baseValues
            .filter((v) => v < videoCount)
            .map((v) => ({ value: v, label: String(v) })),
        ];

  const siteType = details?.site
    ? details.site.charAt(0).toUpperCase() + details.site.slice(1)
    : url.toLowerCase().includes('youtube')
    ? 'YouTube'
    : 'Channel';

  return (
    <div className="flex items-center justify-between gap-2 bg-[#0000000D] dark:bg-white/5 p-2 rounded-md">
      <div className="flex items-center gap-3">
        {details?.avatarUrl ? (
          <img
            src={details.avatarUrl}
            alt={`${name} avatar`}
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
        )}
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-md dark:text-gray-100">{name}</h1>
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
            <span>
              {siteType === 'Channel'
                ? t('subscribeModal.channelInfo.channelFallback')
                : t('subscribeModal.channelInfo.channelType', { siteType })}
            </span>
            {details?.subscriberCount != null && (
              <>
                <span>•</span>
                <span>
                  {t('subscribeModal.channelInfo.subscriberCount', {
                    formatted: formatSubscriberCount(details.subscriberCount),
                  })}
                </span>
              </>
            )}
            <span>•</span>
            <span>
              {t('subscribeModal.channelInfo.videoCount', {
                count: videoCount,
              })}
            </span>
          </div>
          <div className="flex flex-row gap-1 items-center">
            <span className="text-[#818181] text-xs">
              {t('subscribeModal.channelInfo.downloadLast')}{' '}
            </span>
            <select
              className="bg-white dark:bg-gray-800 border rounded px-2 text-xs text-[#474747] dark:text-gray-100"
              value={firstScrapeLimit}
              onChange={(e) =>
                onFirstScrapeLimitChange(parseInt(e.target.value, 10))
              }
            >
              {scrapeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-[#818181] text-xs">
              {' '}
              {t('subscribeModal.channelInfo.videosLabel')}
            </span>
          </div>
          {firstScrapeLimit > 3 && (
            <p className="text-[11px] text-amber-500 mt-0.5">
              {t('subscribeModal.channelInfo.ramWarning')}
            </p>
          )}
        </div>
      </div>
      <div className="p-4 shrink-0">
        <FaRegCheckCircle size={16} className="text-green-500" />
      </div>
    </div>
  );
};

const AutoDetect = ({
  channelName,
  analysis,
}: {
  channelName: string;
  analysis: ChannelAnalysisResult;
}) => {
  const { t } = useTranslation('skedulosa');
  const { intelligentPrediction, videoCount } = analysis;
  const rawPattern = intelligentPrediction?.pattern ?? 'Unknown Pattern';
  const pattern = (() => {
    if (!rawPattern || rawPattern.toLowerCase().includes('unknown'))
      return rawPattern;
    const idx = rawPattern.toLowerCase().indexOf('uploader');
    return idx !== -1
      ? rawPattern.slice(0, idx + 'uploader'.length)
      : rawPattern;
  })();
  const confidence = intelligentPrediction?.confidence ?? 0;
  return (
    <div className="px-1">
      <div className="flex items-center justify-between border border-primary/20 rounded-xl py-1 pl-2 pr-4">
        <div className="flex items-center gap-2">
          <div>
            <img src={graph} alt="graph icon" />
          </div>
          <div>
            {' '}
            <h1 className="font-semibold text-md dark:text-gray-100">
              {channelName}
            </h1>
            <h1 className="text-[11.5px] text-gray-700 dark:text-gray-400">
              {t('subscribeModal.autoDetect.basedOn', { count: videoCount })}
            </h1>
          </div>
        </div>
        <div>
          <h1 className="font-semibold text-primary">{pattern}</h1>
        </div>
      </div>
      <div className="mt-2 px-1">
        <span className="text-gray-500 dark:text-gray-400 text-[11.5px]">
          {t('subscribeModal.autoDetect.usingFrequency')}{' '}
        </span>
        <span className="text-[11.5px] font-semibold text-primary">
          {rawPattern}.
        </span>{' '}
        <span className="text-[11.5px] text-gray-500 dark:text-gray-400">
          {t('subscribeModal.autoDetect.confidence', {
            percent: Math.round(confidence * 100),
          })}
        </span>
      </div>
    </div>
  );
};

const AdvancedOptions = () => {
  const { t } = useTranslation('skedulosa');
  return (
    <div className="p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        {t('subscribeModal.advancedOptions.title')}
      </h2>
      <p className="text-xs text-gray-500">
        {t('subscribeModal.advancedOptions.description')}
      </p>
    </div>
  );
};

const AdvancedOptionsDropdown = () => {
  const { t } = useTranslation('skedulosa');
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-1 text-primary text-xs"
        aria-expanded={isOpen}
        aria-controls="advanced-options-content"
        id="advanced-options-trigger"
      >
        <ChevronDown
          size={15}
          className={`shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
        <span>{t('subscribeModal.advancedOptions.showButton')}</span>
      </button>
      {isOpen && (
        <div
          id="advanced-options-content"
          role="region"
          aria-labelledby="advanced-options-trigger"
          className="mt-2"
        >
          <AdvancedOptions />
        </div>
      )}
    </div>
  );
};

const ManualFrequencyContent = ({
  selectedDays,
  onSelectedDaysChange,
  saveToPath,
  onSelectDirectory,
  isSelectingDirectory,
  checkAtHour,
  onCheckAtHourChange,
  timezone,
  onTimezoneChange,
  qualityPreset,
  onQualityPresetChange,
}: {
  selectedDays: string[];
  onSelectedDaysChange: (days: string[]) => void;
  saveToPath: string;
  onSelectDirectory: () => void;
  isSelectingDirectory: boolean;
  checkAtHour: string;
  onCheckAtHourChange: (value: string) => void;
  timezone: string;
  onTimezoneChange: (value: string) => void;
  qualityPreset: string;
  onQualityPresetChange: (value: string) => void;
}) => {
  const { t } = useTranslation('skedulosa');

  const DAYS_OPTIONS = [
    { label: t('subscribeModal.manualFrequency.days.mon'), value: 'mon' },
    { label: t('subscribeModal.manualFrequency.days.tue'), value: 'tue' },
    { label: t('subscribeModal.manualFrequency.days.wed'), value: 'wed' },
    { label: t('subscribeModal.manualFrequency.days.thu'), value: 'thu' },
    { label: t('subscribeModal.manualFrequency.days.fri'), value: 'fri' },
    { label: t('subscribeModal.manualFrequency.days.sat'), value: 'sat' },
    { label: t('subscribeModal.manualFrequency.days.sun'), value: 'sun' },
  ];

  const QUALITY_OPTIONS = [
    {
      value: 'Lowest Quality',
      label: t('subscribeModal.manualFrequency.quality.lowest'),
    },
    {
      value: 'Low Quality',
      label: t('subscribeModal.manualFrequency.quality.low'),
    },
    {
      value: 'Best Quality',
      label: t('subscribeModal.manualFrequency.quality.best'),
    },
  ];

  return (
    <div>
      <div className="px-1">
        <div className="">
          <label
            htmlFor="days"
            className="text-xs text-gray-500 dark:text-gray-400 mb-1"
          >
            {t('subscribeModal.manualFrequency.daysToCheck')}{' '}
          </label>
          <ToggleGroup
            type="multiple"
            options={DAYS_OPTIONS}
            value={selectedDays}
            onChange={(v) => onSelectedDaysChange(v as string[])}
          />
        </div>
        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="flex-1 gap-2 space-y-1">
            <label
              htmlFor="check-at-hour"
              className="text-xs text-gray-500 dark:text-gray-400 mb-4"
            >
              {t('subscribeModal.manualFrequency.checkAt')}
            </label>
            <select
              id="check-at-hour"
              value={checkAtHour}
              onChange={(e) => onCheckAtHourChange(e.target.value)}
              className="text-xs w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md h-8 "
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={String(i)}>
                  {String(i).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 gap-2 space-y-1">
            <label
              htmlFor="timezone"
              className="text-xs text-gray-500 dark:text-gray-400 mb-4"
            >
              {t('subscribeModal.manualFrequency.timezone')}
            </label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => onTimezoneChange(e.target.value)}
              className="text-xs w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md h-8 "
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Paris">Europe/Paris</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
            </select>
          </div>
        </div>
        <div className="mt-3.5 flex items-center gap-1.5 border border-primary/50 rounded-md p-2">
          <span>
            <FaRegClock className="text-primary" size={13} />
          </span>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('subscribeModal.manualFrequency.schedulePrefix')}{' '}
            <span className="font-bold">
              {selectedDays
                .map((day) => day.charAt(0).toUpperCase() + day.slice(1))
                .join(', ')}
            </span>{' '}
            {t('subscribeModal.manualFrequency.scheduleMid')}{' '}
            <span className="font-bold">
              {String(checkAtHour).padStart(2, '0')}:00
            </span>
          </p>
        </div>
        <div className="flex-1 mt-4">
          <label
            htmlFor="quality-preset"
            className="text-xs text-gray-500 dark:text-gray-400"
          >
            {t('subscribeModal.manualFrequency.qualityPreset')}
          </label>
          <select
            id="quality-preset"
            value={qualityPreset}
            onChange={(e) => onQualityPresetChange(e.target.value)}
            className="text-xs w-full bg-[#0000000D] border border-[#E8E8E8] dark:text-gray-400 dark:border-darkModeCompliment text-black px-2.5 py-1.5 rounded-md h-8 "
          >
            {QUALITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 mt-4">
          <label
            htmlFor="save-to-path"
            className="text-xs text-gray-500 dark:text-gray-400"
          >
            {t('subscribeModal.manualFrequency.saveTo')}
          </label>
          <Input
            id="save-to-path"
            type="text"
            value={saveToPath}
            readOnly
            placeholder={t('subscribeModal.manualFrequency.saveToPlaceholder')}
            className="w-full bg-[#0000000D]  text-black dark:text-gray-400 border border-[#E8E8E8] dark:border-darkModeCompliment px-2.5 py-1.5 rounded-md h-8 mt-1 text-xs"
            rightIcons={[
              {
                icon: <Folder className="text-componentBorder size-4" />,
                onClick: onSelectDirectory,
                tooltip: t(
                  'subscribeModal.manualFrequency.browseFolderTooltip',
                ),
                disabled: isSelectingDirectory,
              },
            ]}
          />
        </div>
        {/*
        <AdvancedOptionsDropdown />
        */}
      </div>
    </div>
  );
};

const SkedulosaSubscribeModal = ({
  isOpen,
  onClose,
  onSubscriptionCreated,
  initialUrl,
  autoSubscribe,
  onWebsiteUrlReady,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubscriptionCreated?: (channelName: string, subscriptionId: string) => void;
  initialUrl?: string;
  autoSubscribe?: boolean;
  onWebsiteUrlReady?: (url: string) => void;
}) => {
  const { t } = useTranslation('skedulosa');
  const navigate = useNavigate();
  const setPendingInputUrl = useTaskbarDownloadStore(
    (s) => s.setPendingInputUrl,
  );
  const { enqueue } = useSubscriptionQueue();
  const addSubscription = useSkedulosaStore((s) => s.addSubscription);
  const clearSubscriptions = useSkedulosaStore((s) => s.clearSubscriptions);
  const existingSubscriptions = useSkedulosaStore((s) => s.subscriptions);
  const {
    startChannelAnalysis,
    finishChannelAnalysis,
    clearChannelAnalysis,
    analyzingStatus,
    pendingAnalysisData,
    setPendingAnalysisData,
  } = useSkedulosaStore();
  const [channelName, setChannelName] = useState('');
  const [sourceURL, setSourceURL] = useState(initialUrl ?? '');
  const [selectedFrequency, setSelectedFrequency] = useState('auto-detect');
  const [selectedDays, setSelectedDays] = useState<string[]>(['sun']);
  const [saveToPath, setSaveToPath] = useState('');
  const [checkAtHour, setCheckAtHour] = useState('6');
  const [timezone, setTimezone] = useState('UTC');
  const [qualityPreset, setQualityPreset] = useState('Best Quality');
  const [isSelectingDirectory, setIsSelectingDirectory] = useState(false);
  const defaultLocation = useSettingStore((s) => s.settings.defaultLocation);
  const [isValidUrl, setIsValidUrl] = useState(false);
  const [channelAnalysis, setChannelAnalysis] =
    useState<ChannelAnalysisResult | null>(null);
  const [channelDetails, setChannelDetails] =
    useState<ChannelDetailsResult | null>(null);
  const [firstScrapeLimit, setFirstScrapeLimit] = useState(1);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlType, setUrlType] = useState<'youtube' | 'website' | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // Tracks whether an analysis has started so we know when it truly finishes
  const analysisStarted = useRef(false);
  // Prevents re-analysis when local state is pre-populated from the store
  const skipNextAnalysis = useRef(false);
  // Incremented on every new analysis start or explicit cancel — stale bridge
  // responses check this before touching state or calling finishChannelAnalysis
  const analysisGeneration = useRef(0);
  // Prevents autoSubscribe from firing more than once per modal open
  const autoSubscribeFired = useRef(false);

  /** Returns null if the URL passes all client-side checks, or an error string. */
  const validateUrlFormat = (raw: string): string | null => {
    if (!raw.trim()) return null; // empty — no error shown yet
    let parsed: URL;
    try {
      parsed = new URL(raw.trim());
    } catch {
      return t('subscribeModal.errors.invalidUrl');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return t('subscribeModal.errors.unsupportedProtocol');
    }
    // Non-YouTube URLs are treated as website subscriptions — format is valid
    if (!isYouTubeUrl(raw.trim())) return null;

    // YouTube-specific: reject video/shorts links
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'youtu.be' ||
      parsed.pathname.startsWith('/watch') ||
      parsed.searchParams.has('v') ||
      parsed.pathname.startsWith('/shorts/')
    ) {
      return t('subscribeModal.errors.videoLink');
    }
    return null;
  };

  // When returning from another tab, restore analysis results from the store immediately
  useEffect(() => {
    if (!pendingAnalysisData || pendingAnalysisData.url !== sourceURL.trim())
      return;
    setChannelAnalysis(
      pendingAnalysisData.channelAnalysis as ChannelAnalysisResult,
    );
    setChannelDetails(
      pendingAnalysisData.channelDetails as ChannelDetailsResult | null,
    );
    if (pendingAnalysisData.channelName)
      setChannelName(pendingAnalysisData.channelName);
    setIsValidUrl(true);
    setUrlError(null);
    skipNextAnalysis.current = true;
    setPendingAnalysisData(null);
  }, [pendingAnalysisData, sourceURL]);

  // Pre-fill sourceURL when modal opens with an initialUrl (e.g. from taskbar channel detection)
  useEffect(() => {
    if (isOpen && initialUrl) {
      setSourceURL(initialUrl);
    }
  }, [isOpen, initialUrl]);

  // Debounced analysis + details fetch: both fire 800 ms after the user stops typing
  useEffect(() => {
    const url = sourceURL.trim();
    if (!url) {
      setChannelAnalysis(null);
      setChannelDetails(null);
      setIsValidUrl(false);
      setUrlError(null);
      setUrlType(null);
      return;
    }

    // Run format check immediately — don't wait for the bridge
    const formatError = validateUrlFormat(url);
    if (formatError === '__redirect_to_download__') {
      setPendingInputUrl(url);
      navigate('/status/all');
      toast({
        title: 'Video link detected',
        description: 'Sending to the download input for you.',
        duration: 3000,
      });
      return;
    }
    if (formatError) {
      setUrlError(formatError);
      setChannelAnalysis(null);
      setChannelDetails(null);
      setIsValidUrl(false);
      setUrlType(null);
      return;
    }
    // Check for duplicate subscription
    const isDuplicate = existingSubscriptions.some(
      (sub) => sub.sourceUrl.trim().toLowerCase() === url.toLowerCase(),
    );
    if (isDuplicate) {
      setUrlError(t('subscribeModal.errors.alreadySubscribed'));
      setChannelAnalysis(null);
      setChannelDetails(null);
      setIsValidUrl(false);
      return;
    }

    setUrlError(null);

    // Skip if local state was just pre-populated from stored results
    if (skipNextAnalysis.current) {
      skipNextAnalysis.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      // ── Website path (non-YouTube) ───────────────────────────────────
      if (!isYouTubeUrl(url)) {
        setUrlType('website');
        setIsValidUrl(true);
        setUrlError(null);
        return;
      }

      // ── YouTube path ─────────────────────────────────────────────────
      setUrlType('youtube');
      const bridge =
        typeof window !== 'undefined' ? window.skedulosaBridge : undefined;
      if (!bridge) {
        setUrlError(t('subscribeModal.errors.bridgeUnavailable'));
        return;
      }

      // Stamp this run. If the user cancels while we're awaiting the bridge,
      // analysisGeneration.current will have been bumped and gen won't match —
      // we discard the response instead of writing stale results to the store.
      const gen = ++analysisGeneration.current;
      analysisStarted.current = true;
      startChannelAnalysis(url, isYouTubeUrl(url));

      // Step 1: fetch channel details (avatar, subs, video count) — sequential, not concurrent with analyzeChannelSchedule
      let capturedDetails: ChannelDetailsResult | null = null;
      try {
        const details = (await bridge.fetchChannelDetails(
          url,
        )) as ChannelDetailsResult;
        if (analysisGeneration.current !== gen) return;
        capturedDetails = details;
        setChannelDetails(details);
      } catch {
        // Non-fatal — channel info panel just won't show avatar/subs
        if (analysisGeneration.current === gen) setChannelDetails(null);
      }

      if (analysisGeneration.current !== gen) return;

      // Step 2: run intelligent scraper analysis only after fetchChannelDetails finishes
      console.log('[Skedulosa] Analyzing channel schedule for URL:', url);

      try {
        const result = (await bridge.analyzeChannelSchedule(
          url,
        )) as ChannelAnalysisResult;
        if (analysisGeneration.current !== gen) return;
        if (result.error) {
          setChannelAnalysis(result);
          setIsValidUrl(false);
          showSkedulosaError(result.error);
          setUrlError(t('subscribeModal.errors.analyzeFailedGeneric'));
        } else if (result.videoCount === 0) {
          setChannelAnalysis(result);
          setIsValidUrl(false);
          const isShortsCandidate =
            url.toLowerCase().includes('youtube') && !url.includes('/shorts');
          setUrlError(
            isShortsCandidate
              ? t('subscribeModal.errors.noVideosShorts')
              : t('subscribeModal.errors.noVideos'),
          );
        } else {
          setChannelAnalysis(result);
          setIsValidUrl(true);
          setUrlError(null);
          // Persist results so the modal can restore them if the user navigated away
          setPendingAnalysisData({
            url,
            channelAnalysis: result,
            channelDetails: capturedDetails,
            channelName: capturedDetails?.channelName ?? '',
          });
        }
      } catch (err) {
        if (analysisGeneration.current !== gen) return;
        setChannelAnalysis(null);
        setIsValidUrl(false);
        const message =
          err instanceof Error
            ? err.message
            : t('subscribeModal.errors.analyzeFailed');
        setUrlError(message);
      } finally {
        if (analysisGeneration.current === gen) finishChannelAnalysis();
      }
    }, 800);
    return () => {
      clearTimeout(timer);
    };
  }, [sourceURL, existingSubscriptions]);

  // Track analysis lifecycle: reset ref on normal completion so the subsequent
  // 'idle' transition (after checkmark animation) isn't mistaken for a cancel.
  useEffect(() => {
    if (analyzingStatus === 'done') {
      analysisStarted.current = false;
      return;
    }
    // If cancelled from the App-level ScanningModal while this modal is mounted,
    // analyzingStatus resets to 'idle' with the ref still true — close to match.
    if (analyzingStatus === 'idle' && analysisStarted.current) {
      analysisStarted.current = false;
      handleClose();
    }
  }, [analyzingStatus]);

  // Reset auto-subscribe guard each time the modal opens
  useEffect(() => {
    if (isOpen) autoSubscribeFired.current = false;
  }, [isOpen]);

  // Trigger subscription automatically when the URL came from the extension
  useEffect(() => {
    if (!autoSubscribe || autoSubscribeFired.current) return;
    if (isValidUrl && channelAnalysis && analyzingStatus === 'idle') {
      autoSubscribeFired.current = true;
      handleSubscribe();
    }
  }, [autoSubscribe, isValidUrl, channelAnalysis, analyzingStatus]);

  // Auto-fill channel name from fetched details; user may override afterward
  useEffect(() => {
    if (channelDetails?.channelName) {
      setChannelName(channelDetails.channelName);
    }
  }, [channelDetails]);

  // Pre-populate manual defaults from suggestedSlots whenever analysis changes
  useEffect(() => {
    const slots = channelAnalysis?.suggestedSlots;
    if (!slots?.length) return;

    const NUM_TO_ABBREV: Record<number, string> = {
      0: 'sun',
      1: 'mon',
      2: 'tue',
      3: 'wed',
      4: 'thu',
      5: 'fri',
      6: 'sat',
    };
    const days = slots
      .map((s) => NUM_TO_ABBREV[s.day_of_week])
      .filter(Boolean) as string[];
    if (days.length) setSelectedDays(days);

    // Median time across all suggested slots → hour of day
    const sorted = [...slots].sort((a, b) => a.time_minutes - b.time_minutes);
    const medianMinutes = sorted[Math.floor(sorted.length / 2)]!.time_minutes;
    setCheckAtHour(String(Math.round(medianMinutes / 60) % 24));
  }, [channelAnalysis]);

  const resetForm = useCallback(() => {
    // Invalidate any in-flight bridge response so it doesn't write stale
    // results or call finishChannelAnalysis after the user has cancelled.
    analysisGeneration.current += 1;
    setChannelName('');
    setSourceURL('');
    setSelectedFrequency('auto-detect');
    setSelectedDays(['sun']);
    setSaveToPath(defaultLocation);
    setCheckAtHour('6');
    setTimezone('UTC');
    setQualityPreset('Best Quality');
    setChannelAnalysis(null);
    setChannelDetails(null);
    setIsValidUrl(false);
    setUrlError(null);
    setUrlType(null);
    setConfirmingCancel(false);
    clearChannelAnalysis();
    setPendingAnalysisData(null);
    analysisStarted.current = false;
    skipNextAnalysis.current = false;
  }, [defaultLocation, clearChannelAnalysis, setPendingAnalysisData]);

  // Use app default as initial value; do not update app default when user picks a folder
  useEffect(() => {
    if (isOpen) {
      setSaveToPath(defaultLocation);
    }
  }, [isOpen, defaultLocation]);

  const handleSubscribe = useCallback(() => {
    const url = sourceURL.trim();

    // ── Website subscription — hand off to parent via onWebsiteUrlReady ──
    // Do NOT call onClose() here: onWebsiteUrlReady sets flowStep → 'website',
    // which already hides this modal (isOpen becomes false). Calling onClose()
    // in the same batch would override that with flowStep → 'idle'.
    if (urlType === 'website') {
      if (!url) return;
      resetForm();
      onWebsiteUrlReady?.(url);
      return;
    }

    const name = channelName.trim();
    if (!name || !url) {
      showSkedulosaError('missing-fields');
      return;
    }
    // ── YouTube subscription ──────────────────────────────────────────

    const data: QueuedSubscriptionData = {
      channelName: name,
      sourceURL: url,
      selectedFrequency,
      selectedDays,
      saveToPath,
      defaultLocation,
      qualityPreset,
      checkAtHour,
      firstScrapeLimit,
      analysisVideos: channelAnalysis?.videos ?? [],
      intelligentPrediction: channelAnalysis?.intelligentPrediction ?? null,
      channelDetails: channelDetails
        ? {
            avatarUrl: channelDetails.avatarUrl,
            subscriberCount: channelDetails.subscriberCount,
            videoCount: channelDetails.videoCount,
            site: channelDetails.site,
          }
        : null,
      onSubscriptionCreated,
    };

    enqueue(data);

    resetForm();
    onClose();
    toast({
      title: t('subscribeModal.toast.queued'),
      description: t('subscribeModal.toast.queuedDesc'),
      variant: 'default',
      duration: 3000,
    });
    if (!onSubscriptionCreated) {
      navigate('/skedulosa/subscription');
    }
  }, [
    channelName,
    sourceURL,
    selectedFrequency,
    selectedDays,
    saveToPath,
    defaultLocation,
    qualityPreset,
    checkAtHour,
    channelAnalysis,
    channelDetails,
    firstScrapeLimit,
    urlType,
    enqueue,
    onSubscriptionCreated,
    resetForm,
    onClose,
    navigate,
    t,
  ]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleCancelClick = useCallback(() => {
    const hasProgress =
      sourceURL.trim().length > 0 &&
      (isValidUrl || !!urlError || analyzingStatus !== 'idle');
    if (hasProgress) {
      setConfirmingCancel(true);
    } else {
      handleClose();
    }
  }, [sourceURL, isValidUrl, urlError, analyzingStatus, handleClose]);

  const handleDeleteAll = useCallback(async () => {
    const bridge =
      typeof window !== 'undefined' ? window.skedulosaBridge : undefined;

    if (bridge) {
      try {
        // Delete all channels first, then all schedules
        const channels = (await bridge.listChannels()) as { id: number }[];
        for (const ch of channels) {
          await bridge.deleteChannel(ch.id);
        }
        const schedules = (await bridge.listSchedules()) as { id: number }[];
        for (const s of schedules) {
          await bridge.deleteSchedule(s.id);
        }
      } catch (err) {
        console.error('[skedulosa] Failed to delete all from toolkit:', err);
      }
    }

    clearSubscriptions();
  }, [clearSubscriptions]);

  const handleSelectDirectory = async () => {
    if (isSelectingDirectory) return;
    try {
      setIsSelectingDirectory(true);
      const path = await window.ytdlp.selectDownloadDirectory();
      if (path) setSaveToPath(path); // local to this subscription only
    } catch (error) {
      console.error('Error selecting directory:', error);
      showSkedulosaError('directory-failed');
    } finally {
      setIsSelectingDirectory(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen && analyzingStatus === 'idle'}
      onClose={handleCancelClick}
      title={t('subscribeModal.title')}
      width="max-w-[530px]"
      maxHeight="max-h-[90vh]"
      footer={
        <div className="flex flex-col gap-2 py-2 mt-2 w-full">
          {confirmingCancel ? (
            <>
              <p className="text-[14px] pb-1 text-center text-gray-600 dark:text-gray-300">
                Exit setup? Your progress will be lost.
              </p>
              <div className="flex items-center justify-center gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(false)}
                  className="flex-1 max-w-[180px] bg-buttonBg dark:bg-darkModeCompliment border border-buttonBorder dark:border-darkModeCompliment text-black dark:text-gray-200 py-1.5 rounded-md"
                >
                  Stay
                </button>
                <button
                  type="button"
                  onClick={() => { resetForm(); onClose(); }}
                  className="flex-1 max-w-[296px] bg-red-500 hover:opacity-90 text-white py-1.5 rounded-md"
                >
                  Exit
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 w-full">
              <button
                type="button"
                onClick={handleCancelClick}
                className="flex-1 max-w-[180px] bg-buttonBg dark:bg-darkModeCompliment border border-buttonBorder dark:border-darkModeCompliment text-black dark:text-gray-200 py-1.5 rounded-md"
              >
                {t('subscribeModal.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={!isValidUrl}
                className={`flex-1 max-w-[296px] text-white py-1.5 rounded-md ${
                  isValidUrl
                    ? 'bg-primary hover:opacity-90 dark:hover:opacity-75'
                    : 'bg-primary/50 cursor-not-allowed'
                }`}
              >
                {t('subscribeModal.subscribe')}
              </button>
            </div>
          )}
        </div>
      }
    >
        <div className="flex flex-col">
          <div>
            {/* ---------------Uncomment for Channel name---------------  */}
            {isValidUrl && channelAnalysis && analyzingStatus === 'idle' ? (
              <>
                <div className="mt-2">
                  <label
                    htmlFor="channelName"
                    className="text-xs text-gray-500 dark:text-gray-400"
                  >
                    {t('subscribeModal.channelNameLabel')}
                  </label>
                </div>
                <input
                  type="text"
                  id="channelName"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md h-8 "
                />
              </>
            ) : (
              <>
                <label
                  htmlFor="sourceURL"
                  className="text-xs text-gray-500 dark:text-gray-400"
                >
                  {t('subscribeModal.sourceUrlLabel')}
                </label>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    id="sourceURL"
                    value={sourceURL}
                    onChange={(e) => setSourceURL(e.target.value)}
                    className={`w-full bg-[#0000000D] dark:bg-darkModeCompliment border text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md h-8 ${
                      urlError && sourceURL.trim()
                        ? 'border-red-400 dark:border-red-500'
                        : 'border-[#E8E8E8] dark:border-darkModeCompliment'
                    }`}
                  />

                  {/* ---------------Uncomment for paste button--------------- */}
                  {/* <button
                        type="button"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            setSourceURL(text);
                          } catch {
                            showSkedulosaError('paste-failed');
                          }
                        }}
                        className="ml-2 flex items-center gap-1 bg-[#0000000D] border border-[#E8E8E8] dark:border-darkModeCompliment px-5 py-2 h-8 rounded-md"
                      >
                      <LuCopy size={13} className="text-gray-500" />
                      <span className="text-[11.7px] text-slate-500">Paste</span>
                    </button> */}
                </div>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 mt-1 text-gray-500 dark:text-gray-400 cursor-default w-fit">
                      <span>
                        <LiaQuestionCircle size={15} />
                      </span>
                      <span className="text-[12px] text-gray-500">
                        {t('subscribeModal.whatCanSubscribe')}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p className="font-semibold mb-1">
                      {t('subscribeModal.supportedSources')}
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-xs">
                      <li>{t('subscribeModal.youtubeChannels')}</li>
                      <li>{t('subscribeModal.articleWebsites')}</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
          {analyzingStatus === 'idle' && urlError && sourceURL.trim() && (
            <p className="ml-1 mt-1.5 text-xs text-red-500 dark:text-red-400">
              {urlError}
            </p>
          )}
          {isValidUrl && channelAnalysis && (
            <div>
              <div className="mt-5">
                <ChannelInfo
                  name={channelName}
                  url={sourceURL}
                  videoCount={channelAnalysis.videoCount}
                  details={channelDetails}
                  firstScrapeLimit={firstScrapeLimit}
                  onFirstScrapeLimitChange={setFirstScrapeLimit}
                />
              </div>
              <div></div>
            </div>
          )}
          {isValidUrl && urlType === 'website' && (
            <div className="mt-5 flex items-center gap-3 bg-[#0000000D] dark:bg-white/5 p-3 rounded-md">
              <LuGlobe size={20} className="text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm dark:text-gray-100 truncate">
                  {(() => {
                    try {
                      return new URL(sourceURL).hostname.replace(/^www\./, '');
                    } catch {
                      return sourceURL;
                    }
                  })()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Website — select sections in the next step
                </p>
              </div>
              <FaRegCheckCircle size={16} className="text-green-500 shrink-0" />
            </div>
          )}
          {isValidUrl && channelAnalysis && analyzingStatus === 'idle' && (
            <div>
              <div className="mt-4 py-3 px-1 border-t-2 border-slate-200 dark:border-slate-700">
                <h1 className="text-gray-500 dark:text-gray-400 text-xs">
                  {t('subscribeModal.basicConfig')}
                </h1>
                <div className="mt-5 flex items-center justify-between gap-2">
                  <label
                    htmlFor="frequency"
                    className="text-xs text-gray-500 dark:text-gray-400"
                  >
                    {t('subscribeModal.checkFrequency')}
                  </label>
                  <div className="flex items-center bg-gray-100 dark:bg-darkModeCompliment rounded-md p-0.5 gap-0.5 w-fit">
                    {[
                      { label: t('subscribeModal.auto'), value: 'auto-detect' },
                      { label: t('subscribeModal.manual'), value: 'manual' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSelectedFrequency(opt.value)}
                        className={`px-4 py-1 text-xs font-medium rounded transition-all ${
                          selectedFrequency === opt.value
                            ? 'bg-white dark:bg-darkMode text-primary shadow-sm'
                            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                {selectedFrequency === 'auto-detect' ? (
                  <AutoDetect
                    channelName={channelName}
                    analysis={channelAnalysis}
                  />
                ) : (
                  <ManualFrequencyContent
                    selectedDays={selectedDays}
                    onSelectedDaysChange={setSelectedDays}
                    saveToPath={saveToPath}
                    onSelectDirectory={handleSelectDirectory}
                    isSelectingDirectory={isSelectingDirectory}
                    checkAtHour={checkAtHour}
                    onCheckAtHourChange={setCheckAtHour}
                    timezone={timezone}
                    onTimezoneChange={setTimezone}
                    qualityPreset={qualityPreset}
                    onQualityPresetChange={setQualityPreset}
                  />
                )}
              </div>
            </div>
          )}
        </div>
    </BaseModal>
  );
};

export default SkedulosaSubscribeModal;
