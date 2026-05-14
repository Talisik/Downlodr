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
/** Hard cap on total downloads dispatched per event delivery. */
const SKEDULOSA_MAX_TOTAL = 50;

export function useSkedulosaDownloadBridge() {
  /**
   * Tracks task IDs currently being processed so that a re-delivery from the
   * backend (which re-sends all 'pending' tasks on every run) is silently
   * ignored for tasks already in flight.
   */
  const inFlightTaskIds = useRef<Set<number>>(new Set());

  /**
   * Counts total downloads dispatched across ALL event deliveries in this
   * session. Once it reaches SKEDULOSA_MAX_TOTAL the loop stops regardless
   * of how many more times onDownloadQueuePushed fires.
   */
  const sessionDispatchCount = useRef(0);

  useEffect(() => {
    const bridge =
      typeof window !== 'undefined' ? window.skedulosaBridge : undefined;
    if (!bridge) return;

    bridge.onDownloadQueuePushed(async (tasks) => {
      if (!(tasks as unknown[]).length) return;

      console.log(
        '[SkedulosaBridge] ⬇ onDownloadQueuePushed fired — raw task count:',
        (tasks as unknown[]).length,
        '| tasks:',
        tasks,
      );

      // Read settings at call-time to avoid stale closure
      const { settings } = useSettingStore.getState();
      const { setDownload } = useDownloadStore.getState();
      const { subscriptions } = useSkedulosaStore.getState();

      const location = settings.defaultLocation;
      console.log(
        '[SkedulosaBridge] defaultLocation:',
        location || '(empty)',
        '| task count:',
        (tasks as unknown[]).length,
      );

      // If the store hasn't hydrated yet, defaultLocation will be empty.
      // Mark all tasks finished so the backend does not re-deliver them indefinitely.
      if (!location) {
        console.warn(
          '[SkedulosaBridge] Default download location not set — marking',
          (tasks as unknown[]).length,
          'task(s) finished without queuing to prevent re-delivery spam.',
        );
        const typedTasksNoLocation = tasks as { id: number }[];
        for (const t of typedTasksNoLocation) {
          try {
            await bridge.markDownloadTaskFinished(t.id);
          } catch (err) {
            console.error(
              '[SkedulosaBridge] Failed to mark task finished (no-location path):',
              t.id,
              err,
            );
          }
        }
        return;
      }

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
        // Hard session cap — stop dispatching once we've hit SKEDULOSA_MAX_TOTAL
        // across ALL event deliveries in this mount, not just this one batch.
        if (sessionDispatchCount.current >= SKEDULOSA_MAX_TOTAL) {
          console.log(
            `[SkedulosaBridge] Session cap of ${SKEDULOSA_MAX_TOTAL} reached — stopping. Remaining tasks will be picked up on the next run.`,
          );
          break;
        }

        // Staggered batch: pause before each new batch after the first
        if (i > 0 && i % SKEDULOSA_BATCH_SIZE === 0) {
          console.log(
            `[SkedulosaBridge] Batch limit reached — pausing for ${SKEDULOSA_BATCH_DELAY_MS}ms before processing next batch...`,
          );
          await new Promise<void>((r) =>
            setTimeout(r, SKEDULOSA_BATCH_DELAY_MS),
          );
        }
        console.log(
          `[SkedulosaBridge] Processing task ${i + 1} of ${
            typedTasks.length
          } (session total: ${sessionDispatchCount.current + 1}/${SKEDULOSA_MAX_TOTAL})...`,
        );

        const task = typedTasks[i];

        // Layer 1 — In-flight dedup: skip if this task ID is already being processed
        // in this session. The backend re-sends all 'pending' tasks on every run,
        // so the same task can arrive again before markDownloadTaskFinished completes.
        if (inFlightTaskIds.current.has(task.id)) {
          console.log(
            '[SkedulosaBridge] Task already in flight, skipping:',
            task.id,
            task.video_url,
            task.channel_id,
          );
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
            console.log(
              '[SkedulosaBridge] URL already queued or downloading, skipping:',
              task.video_url,
            );
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
          sessionDispatchCount.current++;
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
