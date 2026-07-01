# Skedulosa Subscription Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate all subscription creation behind an in-memory queue that processes entries in batches of 2, preventing simultaneous yt-dlp instances from spiking memory.

**Architecture:** When the user clicks Subscribe, the modal enqueues the raw form data (nothing is registered yet) and closes immediately. A queue processor inside a React context drains the queue in batches of 2, running the full toolkit registration + scraper for each item serially within each batch. A banner inside `SkedulosaLayout` shows live queue progress.

**Tech Stack:** React context, `useRef`/`useState` for queue state, existing bridge APIs, existing Zustand store

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/skedulosa/types/subscriptionQueue.ts` | `QueuedSubscriptionData` type — the shape of data stored in the queue |
| Create | `src/skedulosa/context/SubscriptionQueueContext.tsx` | Context, `SubscriptionQueueProvider`, `useSubscriptionQueue` hook, `createSubscription` processor |
| Create | `src/skedulosa/components/SubscriptionQueueBanner.tsx` | Thin banner rendered in the layout showing queue status |
| Modify | `src/skedulosa/components/SkedulosaSubscribeModal.tsx` | Replace `handleSubscribe` body with `enqueue()` call; remove maps that move to context |
| Modify | `src/skedulosa/layout/SkedulosaLayout.tsx` | Wrap tree with `SubscriptionQueueProvider`; render `SubscriptionQueueBanner` above `<Outlet />` |

---

## Task 1 — Create the `QueuedSubscriptionData` type

**Files:**
- Create: `src/skedulosa/types/subscriptionQueue.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/skedulosa/types/subscriptionQueue.ts

import type {
  SubscriptionChannelDetails,
} from '@/skedulosa/store/skedulosaStore';

/**
 * All form data captured at the moment the user clicks "Subscribe".
 * Nothing from the toolkit DB — those IDs are assigned during queue processing.
 */
export type QueuedSubscriptionData = {
  channelName: string;
  sourceURL: string;
  /** 'auto-detect' | 'manual' */
  selectedFrequency: string;
  /** Day abbreviations e.g. ['mon', 'wed'] */
  selectedDays: string[];
  saveToPath: string;
  /** App-level default location snapshot — used when saveToPath is empty */
  defaultLocation: string;
  qualityPreset: string;
  /** Hour of day as a string e.g. '6' */
  checkAtHour: string;
  firstScrapeLimit: number;
  /** Raw video list from analyzeChannelSchedule — seeds the intelligent scheduler */
  analysisVideos: unknown[];
  /** Flattened from channelAnalysis.intelligentPrediction — null when not available */
  intelligentPrediction: {
    nextScrapeTime: string;
    pattern: string;
    confidence: number;
    expectedVideos: number;
    isErratic: boolean;
  } | null;
  /** Channel avatar/subscriber info — null if the details fetch failed (non-fatal) */
  channelDetails: SubscriptionChannelDetails | null;
  /** Callback the parent component passed to the modal — called after full registration */
  onSubscriptionCreated?: (channelName: string) => void;
};
```

---

## Task 2 — Create the queue context + processor

**Files:**
- Create: `src/skedulosa/context/SubscriptionQueueContext.tsx`

- [ ] **Step 1: Create the context file with all processor logic**

```typescript
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
      } else if (!isManual && item.analysisVideos.length > 0) {
        await bridge.saveAnalysisVideos(toolkitChannelId, item.analysisVideos);
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

  // ── Initial scrape ───────────────────────────────────────────────────────
  if (bridge && toolkitChannelId !== undefined) {
    const channelIdForClosure = toolkitChannelId;
    useSkedulosaStore
      .getState()
      .setChannelScraping(channelIdForClosure, item.channelName);

    (bridge.runScraperOnce(channelIdForClosure) as Promise<unknown>)
      .then((result) => {
        showScrapeErrors(result);
        const scrapeResult = result as {
          scrapedCount?: number;
          errors?: unknown[];
          message?: string;
        };
        const scraperRanCleanly =
          (scrapeResult.scrapedCount ?? 0) > 0 &&
          (!scrapeResult.errors || scrapeResult.errors.length === 0);
        if (scraperRanCleanly && scrapeResult.message === 'No new videos found') {
          const isYouTubeNonShorts =
            item.sourceURL.toLowerCase().includes('youtube') &&
            !item.sourceURL.toLowerCase().includes('/shorts');
          toast({
            variant: 'destructive',
            title: 'No Videos Found',
            description: isYouTubeNonShorts
              ? "No full-length videos were found on this channel's Videos tab. If this channel only posts Shorts, try resubscribing with \"/shorts\" added to the URL."
              : 'No videos were found for this channel. The channel may be empty or all videos may be private.',
            duration: 5000,
          });
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
        useSkedulosaStore
          .getState()
          .removeChannelScraping(channelIdForClosure);
      });

    bridge.startScraper().catch((err: unknown) => {
      console.error(
        '[SubscriptionQueue] Failed to restart scraper loop:',
        err,
      );
    });
  } else {
    console.warn(
      '[SubscriptionQueue] Skipping initial scrape — bridge or channel ID unavailable',
    );
  }

  item.onSubscriptionCreated?.(item.channelName);
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
    }

    setPendingCount(0);
    isProcessingRef.current = false;
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
```

---

## Task 3 — Create the queue banner component

**Files:**
- Create: `src/skedulosa/components/SubscriptionQueueBanner.tsx`

- [ ] **Step 1: Create the banner**

```tsx
// src/skedulosa/components/SubscriptionQueueBanner.tsx

import { useSubscriptionQueue } from '@/skedulosa/context/SubscriptionQueueContext';

/**
 * Renders a thin status bar at the top of the Skedulosa main content area
 * while subscriptions are being processed from the queue.
 * Returns null when the queue is idle.
 */
export function SubscriptionQueueBanner() {
  const { pendingCount, processingCount } = useSubscriptionQueue();
  const isActive = processingCount > 0 || pendingCount > 0;

  if (!isActive) return null;

  const parts: string[] = [];
  if (processingCount > 0)
    parts.push(
      `${processingCount} subscription${processingCount > 1 ? 's' : ''} processing`,
    );
  if (pendingCount > 0)
    parts.push(
      `${pendingCount} pending`,
    );

  return (
    <div className="flex items-center gap-2 bg-primary/10 dark:bg-primary/20 border-b border-primary/20 px-4 py-2 text-xs text-primary font-medium">
      <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
      <span>Setting up subscriptions — {parts.join(', ')}</span>
    </div>
  );
}
```

---

## Task 4 — Update `SkedulosaLayout` to mount the provider and banner

**Files:**
- Modify: `src/skedulosa/layout/SkedulosaLayout.tsx`

- [ ] **Step 1: Add two imports at the top of the file (after existing imports)**

In `src/skedulosa/layout/SkedulosaLayout.tsx`, after the existing imports add:

```typescript
import { SubscriptionQueueProvider } from '../context/SubscriptionQueueContext';
import { SubscriptionQueueBanner } from '../components/SubscriptionQueueBanner';
```

- [ ] **Step 2: Wrap the return with the provider and add the banner above `<Outlet />`**

Replace the entire `return` block of `SkedulosaLayout` (currently lines 51–71):

```tsx
return (
  <ErrorBoundary>
    <SubscriptionQueueProvider>
      <div className="h-screen flex flex-col bg-[#F9F9F9] dark:bg-darkMode text-gray-900 dark:text-gray-100 p-4 pt-3 gap-2">
        <TitleBar className="h-8 bg-[#F9F9F9] dark:bg-darkMode" />
        <TaskBar className="rounded-md w-full px-6 py-2 pl-[8px] bg-white dark:bg-darkMode" />
        <div className="flex flex-1 overflow-hidden h-[calc(100vh-120px)] gap-4">
          <SkedulosaNavigation
            className={`${
              isNavCollapsed ? 'w-[65px]' : 'w-[195px]'
            } rounded-md bg-white dark:bg-darkModeNavigation overflow-y-auto h-full transition-all duration-300`}
            collapsed={isNavCollapsed}
            toggleCollapse={toggleNavCollapse}
          />
          <main className="flex-1 overflow-auto bg-white dark:bg-darkMode rounded-md">
            <SubscriptionQueueBanner />
            <Outlet />
          </main>
        </div>
      </div>
    </SubscriptionQueueProvider>
  </ErrorBoundary>
);
```

---

## Task 5 — Update `SkedulosaSubscribeModal` to enqueue instead of create

**Files:**
- Modify: `src/skedulosa/components/SkedulosaSubscribeModal.tsx`

- [ ] **Step 1: Add the `useSubscriptionQueue` import**

After the existing `useSkedulosaStore` import line (line 18), add:

```typescript
import { useSubscriptionQueue } from '@/skedulosa/context/SubscriptionQueueContext';
import type { QueuedSubscriptionData } from '@/skedulosa/types/subscriptionQueue';
```

- [ ] **Step 2: Remove the two maps that move to the context**

Remove the module-level `ABBREV_TO_DAY` constant (lines 272–280) — it is no longer needed in the modal.

Remove the `DAY_ABBREV_TO_NUM` object that is currently declared inside `handleSubscribe` (lines 672–681) — it also moves to the context.

- [ ] **Step 3: Wire `useSubscriptionQueue` inside the component**

Inside `SkedulosaSubscribeModal` component body (after the existing `const navigate = useNavigate();` line), add:

```typescript
const { enqueue } = useSubscriptionQueue();
```

- [ ] **Step 4: Replace the entire `handleSubscribe` body**

Replace the full `handleSubscribe` `useCallback` (lines 682–919) with:

```typescript
const handleSubscribe = useCallback(() => {
  const name = channelName.trim();
  const url = sourceURL.trim();
  if (!name || !url) {
    showSkedulosaError('missing-fields');
    return;
  }

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
    title: 'Subscription queued',
    description:
      'Your subscription has been added to the queue and will be set up shortly.',
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
  enqueue,
  onSubscriptionCreated,
  resetForm,
  onClose,
  navigate,
]);
```

Note: `handleSubscribe` is now synchronous (no `async`) — it just enqueues and closes.

- [ ] **Step 5: Verify the dependency array of `resetForm`**

`resetForm` (line ~645) references `defaultLocation` in its body. Its `useCallback` dependency array must include `defaultLocation`. This was already correct before — no change needed, just confirm it still has `[defaultLocation]`.

---

## Self-Review Checklist

- [x] **Spec coverage** — queue is in-memory (no persistence), batches of 2, nothing registered before queue picks it up, banner shows status, discarded on close
- [x] **No placeholders** — all code blocks are complete and runnable
- [x] **Type consistency** — `QueuedSubscriptionData` defined in Task 1, referenced identically in Tasks 2 and 5; `ABBREV_TO_DAY`/`DAY_ABBREV_TO_NUM` removed from modal (Task 5 Step 2) and defined in context (Task 2)
- [x] **`handleSubscribe` is no longer `async`** — `enqueue` is synchronous, no awaits remain
- [x] **`onSubscriptionCreated` callback** — still called, but now from `createSubscription` inside the queue processor after full registration completes
