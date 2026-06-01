import { toast } from '@/core-app/components/shadcn/hooks/use-toast';

/**
 * ytdlpRecoveryService
 *
 * A plain module-level singleton that owns a 20-minute polling loop.
 * When yt-dlp errors are detected, callers invoke `start(bridge)` to begin
 * probing whether yt-dlp has recovered. Once a successful probe is observed,
 * the service fires a success toast and stops itself.
 *
 * Usage:
 *   ytdlpRecoveryService.start(bridge)   — no-op if already running
 *   ytdlpRecoveryService.stop()          — clears the timer, resets state
 *   ytdlpRecoveryService.isRunning()     — returns current running state
 */

const PROBE_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes
const PROBE_URL = 'https://www.youtube.com/@YouTube';

type Bridge = typeof window.skedulosaBridge;

let running = false;
let timerId: ReturnType<typeof setTimeout> | null = null;

function stop(): void {
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
  running = false;
}

function scheduleNextProbe(bridge: Bridge): void {
  timerId = setTimeout(() => {
    void probe(bridge);
  }, PROBE_INTERVAL_MS);
}

async function probe(bridge: Bridge): Promise<void> {
  try {
    const raw = await bridge.analyzeChannelSchedule(PROBE_URL);
    const result =
      raw !== null && typeof raw === 'object'
        ? (raw as { videoCount?: number; error?: string })
        : null;

    if (
      result &&
      result.videoCount !== undefined &&
      result.videoCount > 0 &&
      !result.error
    ) {
      // yt-dlp is working again
      stop();
      toast({
        title: 'Scraping is back',
        description:
          'yt-dlp is working again. Skedulosa will resume scraping normally.',
        duration: 5000,
      });
      return;
    }
  } catch (err) {
    console.warn('[ytdlpRecoveryService] probe failed:', err);
    // Treat thrown exceptions the same as a failed probe — reschedule
  }

  // Failed probe: only reschedule if still running (stop() may have been
  // called externally between when the probe started and when it resolved)
  if (running) {
    scheduleNextProbe(bridge);
  }
}

function start(bridge: Bridge): void {
  if (running) return; // no-op if already running
  running = true;
  scheduleNextProbe(bridge);
}

function isRunning(): boolean {
  return running;
}

export const ytdlpRecoveryService = {
  start,
  stop,
  isRunning,
} as const;
