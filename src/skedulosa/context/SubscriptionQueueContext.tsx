// src/skedulosa/context/SubscriptionQueueContext.tsx

import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import {
  showScrapeErrors,
  showSkedulosaError,
} from '@/skedulosa/error-mapping/skedulosaErrors';
import type {
  ScheduleDay,
  Subscription,
  SubscriptionAnalysis,
  SubscriptionSettings,
} from '@/skedulosa/store/skedulosaStore';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import type { QueuedSubscriptionData } from '@/skedulosa/types/subscriptionQueue';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';

// ─── Internal helpers ───────────────────────────────────────────────────────

const ABBREV_TO_DAY: Record<string, ScheduleDay> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

const DAY_ABBREV_TO_NUM: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/**
 * Performs the full subscription creation for a single queued item:
 * toolkit DB registration → Zustand → runScraperOnce.
 *
 * Errors from individual bridge calls are caught and logged; the function
 * does not throw so that Promise.all continues with remaining batch items.
 */
async function createSubscription(item: QueuedSubscriptionData): Promise<void> {
  const bridge =
    typeof window !== 'undefined' ? window.skedulosaBridge : undefined;

  const isManual = item.selectedFrequency === 'manual';

  const days: ScheduleDay[] =
    item.selectedDays.length > 0
      ? (item.selectedDays
          .map((a) => ABBREV_TO_DAY[a.toLowerCase()])
          .filter(Boolean) as ScheduleDay[])
      : ['Sunday'];

  const timeMinutesForStore = parseInt(item.checkAtHour, 10) * 60;
  const scheduleTime = days.map((day) => ({
    day,
    time_minutes: timeMinutesForStore,
  }));

  const settings: SubscriptionSettings[] = [
    {
      frequency: isManual ? '' : 'auto-detect',
      download_quality: isManual ? item.qualityPreset : 'Best Quality',
      save_location: item.saveToPath || item.defaultLocation,
      download_priority: '',
      lookback_period: '7 days',
      file_naming_format: '',
    },
  ];

  let toolkitScheduleId: number | undefined;
  let toolkitChannelId: number | undefined;

  if (bridge) {
    try {
      const schedule = (await bridge.createSchedule({
        name: item.channelName,
      })) as { id: number };
      toolkitScheduleId = schedule.id;
      console.log(
        '[SubscriptionQueue] Toolkit schedule created, id:',
        toolkitScheduleId,
      );

      const ch = (await bridge.createChannel({
        schedule_id: schedule.id,
        url: item.sourceURL,
        name: item.channelName,
        download_format: 'mp4',
        active: 1,
        first_scrape_limit: item.firstScrapeLimit,
      })) as { id: number };
      toolkitChannelId = ch.id;
      console.log(
        '[SubscriptionQueue] Toolkit channel created, id:',
        toolkitChannelId,
      );

      if (isManual && item.selectedDays.length > 0) {
        const timeMinutes = parseInt(item.checkAtHour, 10) * 60;
        const slots = item.selectedDays.map((day) => ({
          day_of_week: DAY_ABBREV_TO_NUM[day] ?? 0,
          time_minutes: timeMinutes,
        }));
        await bridge.replaceChannelSlots(toolkitChannelId, slots);
      }
    } catch (err) {
      console.error(
        '[SubscriptionQueue] Failed to register with toolkit:',
        item.channelName,
        err,
      );
      // Non-fatal — still save to Zustand so the UI reflects the subscription
    }
  }

  // ── Zustand store ────────────────────────────────────────────────────────
  const savedChannelAnalysis: SubscriptionAnalysis | undefined =
    item.intelligentPrediction
      ? {
          pattern: item.intelligentPrediction.pattern,
          confidence: item.intelligentPrediction.confidence,
          nextScrapeTime: item.intelligentPrediction.nextScrapeTime,
          isErratic: item.intelligentPrediction.isErratic,
        }
      : undefined;

  const subscription: Subscription = {
    id: String(toolkitScheduleId ?? Date.now()),
    downloads: [],
    schedule_time: scheduleTime,
    last_checked_time: '',
    source: item.channelName,
    sourceUrl: item.sourceURL,
    recurring: true,
    status: 'Active',
    date_created: new Date().toISOString(),
    upload_cadence: '',
    settings,
    toolkit_schedule_id: toolkitScheduleId,
    toolkit_channel_id: toolkitChannelId,
    channel_details: item.channelDetails ?? undefined,
    channel_analysis: savedChannelAnalysis,
  };

  useSkedulosaStore.getState().addSubscription(subscription);
  item.onSubscriptionCreated?.(item.channelName, subscription.id);

  // ── Initial scrape ───────────────────────────────────────────────────────
  if (bridge && toolkitChannelId !== undefined) {
    const channelIdForClosure = toolkitChannelId;
    useSkedulosaStore
      .getState()
      .setChannelScraping(channelIdForClosure, item.channelName);

    await (bridge.runScraperOnce(channelIdForClosure) as Promise<unknown>)
      .then(async (result) => {
        showScrapeErrors(result);
        const scrapeResult = result as {
          scrapedCount?: number;
          errors?: unknown[];
          message?: string;
        };
        const scrapeMessage = scrapeResult.message ?? '';
        const scrapeSkipped =
          scrapeMessage === 'Already running' ||
          scrapeMessage.startsWith('Cooldown:') ||
          scrapeMessage.includes('Scraper not initialized');
        const scrapeCompletedCleanly =
          !scrapeResult.errors || scrapeResult.errors.length === 0;
        if (
          scrapeCompletedCleanly &&
          !scrapeSkipped &&
          (scrapeResult.scrapedCount ?? 0) === 0
        ) {
          const isYouTubeNonShorts =
            item.sourceURL.toLowerCase().includes('youtube') &&
            !item.sourceURL.toLowerCase().includes('/shorts');
          toast({
            variant: 'destructive',
            title: 'No Videos Found',
            description: isYouTubeNonShorts
              ? 'No full-length videos were found on this channel\'s Videos tab. If this channel only posts Shorts, try resubscribing with "/shorts" added to the URL.'
              : 'No videos were found for this channel. The channel may be empty or all videos may be private.',
            duration: 5000,
          });
        }
        if (!isManual && item.analysisVideos.length > 0) {
          try {
            await bridge.saveAnalysisVideos(
              channelIdForClosure,
              item.analysisVideos,
            );
          } catch (err) {
            console.error(
              '[SubscriptionQueue] Failed to save analysis videos:',
              err,
            );
          }
        }
        setTimeout(() => {
          useSkedulosaStore
            .getState()
            .removeChannelScraping(channelIdForClosure);
        }, 2000);
      })
      .catch((err: unknown) => {
        console.error(
          '[SubscriptionQueue] Failed to run initial scrape:',
          item.channelName,
          err,
        );
        const errorMsg = err instanceof Error ? err.message : String(err);
        showSkedulosaError(errorMsg);
        useSkedulosaStore.getState().removeChannelScraping(channelIdForClosure);
      });
  } else {
    console.warn(
      '[SubscriptionQueue] Skipping initial scrape — bridge or channel ID unavailable',
    );
  }
}

// ─── Context ────────────────────────────────────────────────────────────────

type SubscriptionQueueContextValue = {
  enqueue: (data: QueuedSubscriptionData) => void;
  /** Items waiting to be picked up by the next batch */
  pendingCount: number;
  /** Items currently being processed (0, 1, or 2) */
  processingCount: number;
};

const SubscriptionQueueContext = createContext<SubscriptionQueueContextValue>({
  enqueue: () => {},
  pendingCount: 0,
  processingCount: 0,
});

// ─── Provider ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 2;

export function SubscriptionQueueProvider({
  children,
}: {
  children: ReactNode;
}) {
  /** Source of truth for the queue — use a ref to avoid stale closures in async loops */
  const queueRef = useRef<QueuedSubscriptionData[]>([]);
  const isProcessingRef = useRef(false);

  /** Display-only state — drives the banner */
  const [pendingCount, setPendingCount] = useState(0);
  const [processingCount, setProcessingCount] = useState(0);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      while (queueRef.current.length > 0) {
        const batch = queueRef.current.splice(0, BATCH_SIZE);
        setPendingCount(queueRef.current.length);
        setProcessingCount(batch.length);

        await Promise.all(
          batch.map(async (item) => {
            try {
              await createSubscription(item);
            } catch (err) {
              console.error(
                '[SubscriptionQueue] Unexpected error processing item:',
                item.channelName,
                err,
              );
            }
          }),
        );

        setProcessingCount(0);

        // Restart the schedule loop once per batch (no-op if already running)
        const bridge =
          typeof window !== 'undefined' ? window.skedulosaBridge : undefined;
        if (bridge) {
          bridge.startScraper().catch((err: unknown) => {
            console.error(
              '[SubscriptionQueue] Failed to restart scraper loop:',
              err,
            );
          });
        }
      }
      setPendingCount(0);
    } finally {
      isProcessingRef.current = false;
    }
  }, []);

  const enqueue = useCallback(
    (data: QueuedSubscriptionData) => {
      queueRef.current = [...queueRef.current, data];
      setPendingCount(queueRef.current.length);
      processQueue();
    },
    [processQueue],
  );

  return (
    <SubscriptionQueueContext.Provider
      value={{ enqueue, pendingCount, processingCount }}
    >
      {children}
    </SubscriptionQueueContext.Provider>
  );
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

export function useSubscriptionQueue() {
  return useContext(SubscriptionQueueContext);
}
