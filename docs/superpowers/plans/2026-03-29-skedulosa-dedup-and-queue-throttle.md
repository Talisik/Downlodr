# Skedulosa Dedup & Queue Throttle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate duplicate scheduled downloads and prevent queue flooding when many channels fire at once, without touching the normal (non-skedulosa) download flow and without modifying any files inside `src/skedulosa/backend/`.

**Architecture:** All three fixes live inside one renderer-side hook (`useSkedulosaDownloadBridge.ts`). A `useRef<Set<number>>` tracks task IDs currently in-flight so a re-delivery from the backend is silently dropped. A URL check against live store state blocks already-queued URLs as defense-in-depth. A staggered batch loop dispatches at most 5 downloads every 2 seconds.

**Tech Stack:** TypeScript, React (`useRef`, `useEffect`), Zustand store selectors

---

## File Map

| File | Change type | What changes |
|------|-------------|--------------|
| `src/skedulosa/hooks/useSkedulosaDownloadBridge.ts` | Modify | Add `useRef` import, two batch constants, an in-flight task ID ref, URL dedup check, and staggered batch loop |

**One file. No backend package files touched. Normal download flow unchanged.**

---

## How the three fixes work together

The backend `onRunComplete` re-sends **all tasks still marked `pending`** on every scraper run. We cannot change this. The renderer defences are layered:

| Layer | What it catches |
|-------|----------------|
| **In-flight ref** (`useRef<Set<number>>`) | Same task ID delivered again while still being processed (race condition within a session) |
| **URL dedup check** (live store state) | Same video URL already present in `forDownloads`, `queuedDownloads`, or `downloading` |
| **Staggered batching** | Too many tasks at once flooding the UI and yt-dlp metadata fetches |

---

## Task 1: Add imports, constants, and the in-flight ref

**Files:**
- Modify: `src/skedulosa/hooks/useSkedulosaDownloadBridge.ts`

- [ ] **Step 1.1 — Update the React import to include `useRef`**

  Current line 14:
  ```typescript
  import { useEffect } from 'react';
  ```

  Replace with:
  ```typescript
  import { useEffect, useRef } from 'react';
  ```

- [ ] **Step 1.2 — Add batch constants after the import block (after line 14, before the function)**

  ```typescript
  /** Max downloads dispatched per batch before pausing. */
  const SKEDULOSA_BATCH_SIZE = 5;
  /** Milliseconds to wait between batches. */
  const SKEDULOSA_BATCH_DELAY_MS = 2000;
  ```

- [ ] **Step 1.3 — Add the in-flight ref as the first line inside the function body**

  Current:
  ```typescript
  export function useSkedulosaDownloadBridge() {
    useEffect(() => {
  ```

  Replace with:
  ```typescript
  export function useSkedulosaDownloadBridge() {
    /**
     * Tracks task IDs currently being processed so that a re-delivery from the
     * backend (which re-sends all 'pending' tasks on every run) is silently
     * ignored for tasks already in flight.
     */
    const inFlightTaskIds = useRef<Set<number>>(new Set());

    useEffect(() => {
  ```

- [ ] **Step 1.4 — Commit**

  ```bash
  git add src/skedulosa/hooks/useSkedulosaDownloadBridge.ts
  git commit -m "feat(skedulosa): add in-flight task ref and batch constants to download bridge"
  ```

---

## Task 2: Replace the processing loop

**Files:**
- Modify: `src/skedulosa/hooks/useSkedulosaDownloadBridge.ts`

- [ ] **Step 2.1 — Replace the entire `onDownloadQueuePushed` callback**

  Find and replace the current callback (lines 22–78):

  ```typescript
  bridge.onDownloadQueuePushed(async (tasks) => {
    // Read settings at call-time to avoid stale closure
    const { settings } = useSettingStore.getState();
    const { setDownload } = useDownloadStore.getState();
    const { subscriptions } = useSkedulosaStore.getState();

    const location = settings.defaultLocation;
    const limitRate =
      settings.defaultDownloadSpeed > 0
        ? `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`
        : '';

    for (const task of tasks as {
      id: number;
      video_url: string;
      channel_id: number;
    }[]) {
      try {
        const subscription = subscriptions.find(
          (s) => s.toolkit_channel_id === task.channel_id,
        );
        console.log(
          '[SkedulosaBridge] Task received — task.id:',
          task.id,
          '| channel_id:',
          task.channel_id,
          '| matched subscription id:',
          subscription?.id ?? 'NONE',
          '| toolkit_channel_id on match:',
          subscription?.toolkit_channel_id ?? 'NONE',
        );
        const subscriptionLocation =
          subscription?.settings?.[0]?.save_location;
        const resolvedLocation =
          subscriptionLocation && subscriptionLocation.trim()
            ? subscriptionLocation
            : location;
        await setDownload(
          task.video_url,
          resolvedLocation,
          limitRate,
          {
            getTranscript: false,
            getThumbnail: true,
          },
          subscription?.id,
        );
        await bridge.markDownloadTaskFinished(task.id);
      } catch (err) {
        console.error(
          '[skedulosa] Failed to queue download:',
          task.video_url,
          err,
        );
      }
    }
  });
  ```

  Replace with:

  ```typescript
  bridge.onDownloadQueuePushed(async (tasks) => {
    // Read settings at call-time to avoid stale closure
    const { settings } = useSettingStore.getState();
    const { setDownload } = useDownloadStore.getState();
    const { subscriptions } = useSkedulosaStore.getState();

    const location = settings.defaultLocation;
    const limitRate =
      settings.defaultDownloadSpeed > 0
        ? `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`
        : '';

    const typedTasks = tasks as {
      id: number;
      video_url: string;
      channel_id: number;
    }[];

    for (let i = 0; i < typedTasks.length; i++) {
      // Staggered batch: pause before each new batch after the first
      if (i > 0 && i % SKEDULOSA_BATCH_SIZE === 0) {
        await new Promise<void>((r) => setTimeout(r, SKEDULOSA_BATCH_DELAY_MS));
      }

      const task = typedTasks[i];

      // Layer 1 — In-flight dedup: skip if this task ID is already being processed
      // in this session. The backend re-sends all 'pending' tasks on every run,
      // so the same task can arrive again before markDownloadTaskFinished completes.
      if (inFlightTaskIds.current.has(task.id)) {
        continue;
      }
      inFlightTaskIds.current.add(task.id);

      try {
        // Layer 2 — URL dedup: read fresh store state each iteration so that
        // tasks processed earlier in this same batch are included in the check.
        // Silently skip and mark finished if the URL is already queued/downloading.
        const { forDownloads, queuedDownloads, downloading } =
          useDownloadStore.getState();
        const existingUrls = new Set([
          ...forDownloads.map((d) => d.videoUrl),
          ...queuedDownloads.map((d) => d.videoUrl),
          ...downloading.map((d) => d.videoUrl),
        ]);

        if (existingUrls.has(task.video_url)) {
          await bridge.markDownloadTaskFinished(task.id);
          continue;
        }

        const subscription = subscriptions.find(
          (s) => s.toolkit_channel_id === task.channel_id,
        );
        console.log(
          '[SkedulosaBridge] Task received — task.id:',
          task.id,
          '| channel_id:',
          task.channel_id,
          '| matched subscription id:',
          subscription?.id ?? 'NONE',
          '| toolkit_channel_id on match:',
          subscription?.toolkit_channel_id ?? 'NONE',
        );

        const subscriptionLocation =
          subscription?.settings?.[0]?.save_location;
        const resolvedLocation =
          subscriptionLocation && subscriptionLocation.trim()
            ? subscriptionLocation
            : location;

        await setDownload(
          task.video_url,
          resolvedLocation,
          limitRate,
          {
            getTranscript: false,
            getThumbnail: true,
          },
          subscription?.id,
        );
        await bridge.markDownloadTaskFinished(task.id);
      } catch (err) {
        console.error(
          '[skedulosa] Failed to queue download:',
          task.video_url,
          err,
        );
      } finally {
        // Always release the lock so a legitimate retry on the next run can proceed
        inFlightTaskIds.current.delete(task.id);
      }
    }
  });
  ```

  > **Why `finally` deletes the ID:** If `setDownload` throws, the task stays `pending` in the backend and will be re-delivered on the next scraper run. Deleting from the ref lets that retry proceed. If everything succeeds, `markDownloadTaskFinished` advances the backend status to `downloaded` so it won't be re-sent anyway — deleting from the ref is just cleanup.

- [ ] **Step 2.2 — Verify the complete final file looks like this**

  ```typescript
  /**
   * useSkedulosaDownloadBridge
   *
   * Listens for toolkit:downloadQueue:pushed events from the scraper and routes
   * each scraped video URL through downlodr's own download system (setDownload),
   * then marks the toolkit task as finished so the built-in toolkit worker does
   * not also process it.
   *
   * Mount once at the App level — safe to call when skedulosaBridge is absent.
   */
  import { useSettingStore } from '@/core-app/store/settingsStore';
  import { useDownloadStore } from '@/downlodr/store/downloadStore';
  import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
  import { useEffect, useRef } from 'react';

  /** Max downloads dispatched per batch before pausing. */
  const SKEDULOSA_BATCH_SIZE = 5;
  /** Milliseconds to wait between batches. */
  const SKEDULOSA_BATCH_DELAY_MS = 2000;

  export function useSkedulosaDownloadBridge() {
    /**
     * Tracks task IDs currently being processed so that a re-delivery from the
     * backend (which re-sends all 'pending' tasks on every run) is silently
     * ignored for tasks already in flight.
     */
    const inFlightTaskIds = useRef<Set<number>>(new Set());

    useEffect(() => {
      const bridge =
        typeof window !== 'undefined' ? window.skedulosaBridge : undefined;
      if (!bridge) return;

      bridge.onDownloadQueuePushed(async (tasks) => {
        // Read settings at call-time to avoid stale closure
        const { settings } = useSettingStore.getState();
        const { setDownload } = useDownloadStore.getState();
        const { subscriptions } = useSkedulosaStore.getState();

        const location = settings.defaultLocation;
        const limitRate =
          settings.defaultDownloadSpeed > 0
            ? `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`
            : '';

        const typedTasks = tasks as {
          id: number;
          video_url: string;
          channel_id: number;
        }[];

        for (let i = 0; i < typedTasks.length; i++) {
          // Staggered batch: pause before each new batch after the first
          if (i > 0 && i % SKEDULOSA_BATCH_SIZE === 0) {
            await new Promise<void>((r) => setTimeout(r, SKEDULOSA_BATCH_DELAY_MS));
          }

          const task = typedTasks[i];

          // Layer 1 — In-flight dedup: skip if this task ID is already being processed
          // in this session. The backend re-sends all 'pending' tasks on every run,
          // so the same task can arrive again before markDownloadTaskFinished completes.
          if (inFlightTaskIds.current.has(task.id)) {
            continue;
          }
          inFlightTaskIds.current.add(task.id);

          try {
            // Layer 2 — URL dedup: read fresh store state each iteration so that
            // tasks processed earlier in this same batch are included in the check.
            // Silently skip and mark finished if the URL is already queued/downloading.
            const { forDownloads, queuedDownloads, downloading } =
              useDownloadStore.getState();
            const existingUrls = new Set([
              ...forDownloads.map((d) => d.videoUrl),
              ...queuedDownloads.map((d) => d.videoUrl),
              ...downloading.map((d) => d.videoUrl),
            ]);

            if (existingUrls.has(task.video_url)) {
              await bridge.markDownloadTaskFinished(task.id);
              continue;
            }

            const subscription = subscriptions.find(
              (s) => s.toolkit_channel_id === task.channel_id,
            );
            console.log(
              '[SkedulosaBridge] Task received — task.id:',
              task.id,
              '| channel_id:',
              task.channel_id,
              '| matched subscription id:',
              subscription?.id ?? 'NONE',
              '| toolkit_channel_id on match:',
              subscription?.toolkit_channel_id ?? 'NONE',
            );

            const subscriptionLocation =
              subscription?.settings?.[0]?.save_location;
            const resolvedLocation =
              subscriptionLocation && subscriptionLocation.trim()
                ? subscriptionLocation
                : location;

            await setDownload(
              task.video_url,
              resolvedLocation,
              limitRate,
              {
                getTranscript: false,
                getThumbnail: true,
              },
              subscription?.id,
            );
            await bridge.markDownloadTaskFinished(task.id);
          } catch (err) {
            console.error(
              '[skedulosa] Failed to queue download:',
              task.video_url,
              err,
            );
          } finally {
            // Always release the lock so a legitimate retry on the next run can proceed
            inFlightTaskIds.current.delete(task.id);
          }
        }
      });

      return () => {
        bridge.removeDownloadQueueListener();
      };
    }, []); // register listener once on mount
  }
  ```

- [ ] **Step 2.3 — Commit**

  ```bash
  git add src/skedulosa/hooks/useSkedulosaDownloadBridge.ts
  git commit -m "fix(skedulosa): add in-flight dedup, URL dedup, and staggered batch dispatch to bridge hook"
  ```

---

## Task 3: Manual Verification Checklist

Run `yarn start` and verify each fix.

- [ ] **Step 3.1 — Verify in-flight dedup (Layer 1)**

  1. Trigger a scraper run that produces at least 2 new videos.
  2. Open DevTools console — each `task.id` should appear in `[SkedulosaBridge] Task received` logs **exactly once**, even if the scraper fires again before the first batch finishes.
  3. Confirm each video URL appears only once in the download queue.

- [ ] **Step 3.2 — Verify URL dedup (Layer 2)**

  1. With videos already in the queue or actively downloading, trigger another scraper run.
  2. No new `[SkedulosaBridge] Task received` logs for those URLs.
  3. No duplicate rows appear in the download queue.

- [ ] **Step 3.3 — Verify staggered batching**

  1. Ensure 6+ channels have pending new videos and trigger a scraper run.
  2. Watch the queue: first 5 items appear immediately, then ~2 seconds later the next batch appears.
  3. The UI should not flood all items simultaneously.

- [ ] **Step 3.4 — Verify normal downloads are unaffected**

  1. Add a download manually via the normal URL input.
  2. Confirm it queues and downloads as expected with no behavior change.

---

## Summary

| Fix | Mechanism | File |
|-----|-----------|------|
| Race condition — task re-delivered while in flight | `useRef<Set<number>>` in-flight ID tracking + `finally` cleanup | `useSkedulosaDownloadBridge.ts` |
| URL already queued — duplicate entry | URL check against `forDownloads + queuedDownloads + downloading` | `useSkedulosaDownloadBridge.ts` |
| Queue flooding — all tasks dispatched at once | Batch of 5, 2 s pause between batches | `useSkedulosaDownloadBridge.ts` |

**No backend package files modified. Normal download flow unchanged.**
