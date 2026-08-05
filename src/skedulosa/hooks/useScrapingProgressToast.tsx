/**
 * Hook to manage the aggregated scraping progress toast.
 * Shows a single toast when scraping starts/updates, auto-dismisses after 5s when done.
 * Only creates new toasts when state transitions (start/done), not on every status change.
 * On completion, verifies that at least one new item was added to forDownloads before
 * showing success — otherwise shows an error toast.
 */
import { Check } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';

let scrapesCompletedThisSession = 0;
let totalScrapesInitiatedThisSession = 0;
let isScrapingActive = false;
/** Snapshot of forDownloads.length taken when scraping starts. */
let forDownloadsCountAtStart = 0;

/**
 * How long to wait after scrapingChannels drops to 0 before checking forDownloads.
 * The bridge processes tasks asynchronously after runScraperOnce resolves, so we
 * give it a short window to finish adding items before we decide success/failure.
 */
const QUEUE_SETTLE_DELAY_MS = 1500;

export function useScrapingProgressToast() {
  const scrapingChannels = useSkedulosaStore((s) => s.scrapingChannels);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scrapingCount = scrapingChannels.size;
    const wasScrapingActive = isScrapingActive;
    isScrapingActive = scrapingCount > 0;

    // Scraping just started (transition from 0 to N)
    if (!wasScrapingActive && isScrapingActive) {
      totalScrapesInitiatedThisSession = scrapingCount;
      scrapesCompletedThisSession = 0;
      forDownloadsCountAtStart =
        useDownloadStore.getState().forDownloads.length;

      // Clear any pending timers
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }

      toast({
        title: `Upload Queue Updated`,
        description: 'New uploads will follow your selected schedule.',
        duration: 0, // Don't auto-dismiss while scraping
      });
    }
    // Scraping just completed (transition from N to 0)
    else if (wasScrapingActive && !isScrapingActive) {
      scrapesCompletedThisSession = totalScrapesInitiatedThisSession;
      const count = totalScrapesInitiatedThisSession;

      // Wait for the bridge to finish processing any in-flight download tasks
      // before we decide whether any new videos were actually queued.
      settleTimerRef.current = setTimeout(() => {
        const currentCount = useDownloadStore.getState().forDownloads.length;
        const newItemsQueued = currentCount > forDownloadsCountAtStart;

        if (newItemsQueued) {
          const queued = currentCount - forDownloadsCountAtStart;
          toast({
            title: (
              <span className="flex items-center gap-2">Sync Complete</span>
            ),
            description: (
              <span className="block">
                New videos are now available in your downloads tab.
              </span>
            ),
            duration: 5000, // Auto-dismiss after 5 seconds
            variant: 'success',
          });
        } else {
          toast({
            title: 'Subscription Scraping',
            description: `Scraping completed but no new videos were added to the Downloads tab. Will try again on the next scheduled run.`,
            duration: 5000,
          });
        }

        // Reset counters after toast lifetime
        dismissTimerRef.current = setTimeout(() => {
          scrapesCompletedThisSession = 0;
          totalScrapesInitiatedThisSession = 0;
          forDownloadsCountAtStart = 0;
        }, 7000);
      }, QUEUE_SETTLE_DELAY_MS);
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
      }
    };
  }, [scrapingChannels.size]);
}
