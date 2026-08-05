import { config } from '@/core-app/client/config';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { TelemetryService } from '@/core-app/telemetry/utils/telemetryService';
import { ytdlpRecoveryService } from '@/skedulosa/utils/ytdlpRecoveryService';

interface SkedulosaErrorEntry {
  pattern: string | RegExp;
  title: string;
  description: string;
  /** Set to false for local UI-only sentinels (no backend involved) so they don't get reported. */
  telemetry?: boolean;
}

/**
 * Fires a non-blocking telemetry report for a mapped Skedulosa/Nemesis error.
 * Reuses the download-error channel since it's the only telemetry sink today —
 * `title` stands in for a download name so reports stay identifiable in the backend.
 */
function reportSkedulosaError(rawError: string, title: string): void {
  setTimeout(async () => {
    try {
      const telemetryService = new TelemetryService({
        apiEndpoint: config.telemetry.endpoint,
      });
      await telemetryService.init();
      await telemetryService.sendDownloadError({
        error: new Error(rawError),
        logMessage: rawError,
        downloadContext: {
          downloadName: `[skedulosa] ${title}`,
          location: 'skedulosa',
        },
      });
    } catch (err) {
      console.error('Failed to send skedulosa telemetry:', err);
    }
  }, 0);
}

/**
 * Static map of raw Nemesis error substrings / RegExp patterns → user-friendly
 * toast content. Also includes UI-level sentinel keys for frontend errors.
 *
 * Order matters: more specific patterns must come before broader ones that
 * share a common prefix (e.g. ERR-009 before ERR-014).
 */
const SKEDULOSA_ERROR_MAP: readonly SkedulosaErrorEntry[] = Object.freeze([
  // ── UI-level sentinels ────────────────────────────────────────────────────
  {
    pattern: 'missing-fields',
    title: 'Missing fields',
    description: 'Please enter a channel name and source URL.',
    telemetry: false,
  },
  {
    pattern: 'paste-failed',
    title: 'Paste failed',
    description: 'Could not read from clipboard. Try pasting manually.',
    telemetry: false,
  },
  {
    pattern: 'directory-failed',
    title: 'Could not open folder',
    description: 'Failed to select a download directory. Please try again.',
    telemetry: false,
  },
  {
    pattern: 'pause-resume-failed',
    title: 'Could not update subscription',
    description:
      'Something went wrong while pausing or resuming. Please try again.',
    telemetry: false,
  },

  // ── ERR-001: No Channel URL Entered ──────────────────────────────────────
  {
    pattern: 'No channel URL provided',
    title: 'No Channel URL Entered',
    description:
      'Enter a full YouTube channel URL (e.g. https://www.youtube.com/@ChannelName) and try again.',
  },
  {
    pattern: 'Missing channel URL',
    title: 'No Channel URL Entered',
    description:
      'Enter a full YouTube channel URL (e.g. https://www.youtube.com/@ChannelName) and try again.',
  },

  // ── ERR-002: Channel Analysis Failed ─────────────────────────────────────
  {
    pattern: 'Failed to analyze channel',
    title: 'Channel Analysis Failed',
    description:
      'Check that the channel is public, verify your internet connection, or that you are using the correct link for shorts and try again.',
  },

  // ── ERR-003: Could Not Load Channel Info ─────────────────────────────────
  {
    pattern: 'Failed to fetch channel details',
    title: 'Could Not Load Channel Info',
    description:
      'Double-check the channel URL is correct and the channel is publicly accessible. Try again after a moment.',
  },

  // ── ERR-004: Could Not Load Upload History ────────────────────────────────
  {
    pattern: 'Failed to fetch upload dates',
    title: 'Could Not Load Upload History',
    description:
      'Retry the operation. If this keeps happening, the channel may have upload history that is hidden or restricted.',
  },

  // ── ERR-005: Could Not Get Precise Upload Times ───────────────────────────
  {
    pattern: 'Failed to fetch accurate timestamps',
    title: 'Could Not Get Precise Upload Times',
    description:
      'Try again. If the error persists, Subscription will fall back to a less precise schedule automatically.',
  },

  // ── ERR-006: Invalid Video URL ────────────────────────────────────────────
  {
    pattern: 'Invalid video URL (missing or bad YouTube ID)',
    title: 'Invalid Video URL',
    description:
      'Make sure the URL is a standard YouTube video link (e.g. https://www.youtube.com/watch?v=...) and try again.',
  },

  // ── ERR-007: Could Not Read Video ID ─────────────────────────────────────
  {
    pattern: 'Could not extract video ID from URL',
    title: 'Could Not Read Video ID',
    description:
      'Copy the video URL directly from your browser address bar while on the YouTube page and try again.',
  },

  // ── ERR-008: Download Could Not Start ────────────────────────────────────
  // Must come before ERR-009 ("[download] yt-dlp exit") and ERR-014 ("yt-dlp exit")
  {
    pattern: '[download] spawn error for',
    title: 'Download Could Not Start',
    description:
      'Verify that yt-dlp is installed correctly and accessible. Restart the app and try again.',
  },

  // ── ERR-009: Download Failed — Tool Exited with an Error ─────────────────
  // "[download] yt-dlp exit" is more specific than plain "yt-dlp exit" (ERR-014)
  {
    pattern: '[download] yt-dlp exit',
    title: 'Download Failed — Tool Exited with an Error',
    description:
      'Check if the video is still publicly available on YouTube. Persistent failures may mean the video has restrictions Subscription cannot bypass.',
  },

  // ── ERR-012: Quick Playlist Scan Timed Out ───────────────────────────────
  // Must come before ERR-010/011/013 which share the "yt-dlp timed out after" prefix
  {
    pattern: 'yt-dlp timed out fetching upload dates (flat-playlist)',
    title: 'Quick Playlist Scan Timed Out',
    description: 'Check your internet connection and try again.',
  },

  // ── ERR-010 / ERR-011 / ERR-013: Various yt-dlp timeouts ────────────────
  {
    pattern: 'yt-dlp timed out after',
    title: 'Request Timed Out',
    description:
      'Subscription waited too long for a response. Try again later. Channels with large video libraries take longer to process.',
  },

  // ── ERR-014: Scraper Tool Returned an Error ───────────────────────────────
  // Broad "yt-dlp exit" — comes after ERR-009 which is more specific
  {
    pattern: 'yt-dlp exit',
    title: 'Scraper Tool Returned an Error',
    description:
      'Check the app logs for the specific error. If YouTube rate-limited the request, wait a while before trying again. Make sure yt-dlp is up to date.',
  },

  // ── ERR-015: Could Not Read Scraper Output ───────────────────────────────
  {
    pattern: 'Failed to parse yt-dlp JSON output',
    title: 'Could Not Read Scraper Output',
    description: 'Update yt-dlp to the latest version, then try again.',
  },

  // ── ERR-016: Channel Scrape Failed ───────────────────────────────────────
  {
    pattern: '[scraper] yt-dlp failed for channel',
    title: 'Channel Scrape Failed',
    description:
      'Check the app log for more details. Ensure the channel is still active and your internet is working.',
  },

  // ── ERR-017: Could Not Load Full Video Metadata ───────────────────────────
  {
    pattern: '[scraper] failed to fetch full metadata for channel',
    title: 'Could Not Load Full Video Metadata',
    description:
      'Try triggering a re-scrape of this channel. If the channel is very large, the full metadata pass may need more time.',
  },

  // ── ERR-018: Smart Schedule Analysis Failed ───────────────────────────────
  {
    pattern: '[intelligent-schedule] Error analyzing channel',
    title: 'Smart Schedule Analysis Failed',
    description:
      'Try re-adding or re-analyzing the channel. Subscription will fall back to a manual or default schedule.',
  },

  // ── ERR-019: Could Not Load Channels Due for Scraping ────────────────────
  {
    pattern: '[intelligent-schedule] Error getting due channels',
    title: 'Could Not Load Channels Due for Scraping',
    description:
      'This is usually a temporary issue. Restart the app if it keeps happening.',
  },

  // ── ERR-020: Could Not Find Next Scheduled Scrape ────────────────────────
  {
    pattern: '[intelligent-schedule] Error getting next schedule',
    title: 'Could Not Find Next Scheduled Scrape',
    description:
      'Open the schedule settings and verify the channel schedule is configured correctly. Restarting the app usually resolves this.',
  },

  // ── ERR-021: Offline Recovery Failed ─────────────────────────────────────
  {
    pattern: '[intelligent-schedule] Error handling offline scenario',
    title: 'Offline Recovery Failed',
    description:
      'Manually trigger a scrape for any channels that may have been missed. Restarting the app will reset the offline detection state.',
  },

  // ── ERR-022: Could Not Load Channel Schedule ──────────────────────────────
  {
    pattern: '[intelligent-schedule] Error getting channel schedule',
    title: 'Could Not Load Channel Schedule',
    description:
      'Check that the channel is still in your list and try refreshing. You may need to re-analyze the channel.',
  },

  // ── ERR-023: Schedule Refresh Failed ─────────────────────────────────────
  {
    pattern: '[intelligent-schedule] Error refreshing all schedules',
    title: 'Schedule Refresh Failed',
    description:
      'Try triggering a manual schedule refresh. Restarting the app will force a full schedule rebuild on startup.',
  },

  // ── ERR-024: Could Not Set Backup Schedule ────────────────────────────────
  {
    pattern: '[intelligent-schedule] Error setting fallback for channel',
    title: 'Could Not Set Backup Schedule',
    description:
      'Manually set a schedule for this channel. Check that the database is accessible and not corrupted.',
  },

  // ── ERR-025: No Active Schedules Found ───────────────────────────────────
  {
    pattern:
      '[scraper] no schedules (intelligent or slot-based); stopping schedule loop',
    title: 'No Active Schedules Found — Scraper Stopped',
    description:
      'Add at least one channel with an active schedule. The scheduler will automatically resume once a schedule exists.',
  },

  // ── ERR-026: Scheduler Loop Crashed ──────────────────────────────────────
  {
    pattern: '[scraper] runScheduleLoop error',
    title: 'Scheduler Loop Crashed',
    description:
      'Restart the app to restore the scheduling loop. Check the logs for more detail about what caused the crash.',
  },

  // ── ERR-027: Could Not Load Videos for Pattern Detection ─────────────────
  {
    pattern: 'Could not fetch channel videos',
    title: 'Could Not Load Videos for Pattern Detection',
    description:
      'Ensure the channel is public and your internet connection is working, then try again.',
  },

  // ── ERR-028: No Upload Times Available ───────────────────────────────────
  {
    pattern: 'No upload times found in the last videos',
    title: 'No Upload Times Available',
    description: 'Set the scrape times manually in the schedule settings.',
  },

  // ── ERR-029: Not Enough Videos to Detect an Upload Pattern ───────────────
  {
    pattern: 'video(s) with dates; need at least',
    title: 'Not Enough Videos to Detect an Upload Pattern',
    description:
      "Add this channel's scrape times manually. As the channel posts more videos, Subscription may eventually build a smart schedule automatically.",
  },

  // ── ERR-030: Irregular Upload Schedule Detected ───────────────────────────
  {
    pattern: 'Gaps between uploads varied a lot',
    title: 'Irregular Upload Schedule Detected',
    description:
      'Set the scrape schedule manually for a frequency that makes sense for this channel (e.g. daily). No reliable upload rhythm could be detected.',
  },

  // ── ERR-031: No Clear Upload Pattern Found ────────────────────────────────
  {
    pattern: "Gaps between uploads didn't match a clear pattern",
    title: 'No Clear Upload Pattern Found',
    description:
      "Manually configure the scrape frequency that best matches this channel's general posting cadence.",
  },

  // ── ERR-032: Too Few Uploads to Estimate Frequency ───────────────────────
  {
    pattern: 'Not enough uploads to detect interval',
    title: 'Too Few Uploads to Estimate Frequency',
    description:
      'Set a scrape interval manually. Check back after the channel has posted more videos.',
  },

  // ── ERR-033: Too Few Videos to Build a Schedule ──────────────────────────
  {
    pattern: 'Not enough videos to generate schedule',
    title: 'Too Few Videos to Build a Schedule',
    description: 'Create a schedule manually for this channel.',
  },

  // ── ERR-034: Database Read Failed — Channel Schedule ─────────────────────
  {
    pattern: '[intelligent-schedule-data] Error getting schedule for channel',
    title: 'Database Read Failed',
    description:
      'Restart the app. If the issue persists, the database file may be corrupted.',
  },

  // ── ERR-035: Database Read Failed — All Schedules ────────────────────────
  {
    pattern: '[intelligent-schedule-data] Error getting schedules',
    title: 'Database Read Failed — All Schedules',
    description:
      'Restart the app. Check for any disk space or permission issues with the app data directory.',
  },
  {
    pattern: 'Error getting all schedules',
    title: 'Database Read Failed — All Schedules',
    description:
      'Restart the app. Check for any disk space or permission issues with the app data directory.',
  },

  // ── ERR-036: Could Not Load Upcoming Scrapes ─────────────────────────────
  {
    pattern: '[intelligent-schedule-data] Error getting upcoming scrapes',
    title: 'Could Not Load Upcoming Scrapes',
    description:
      'Restart the app. This is typically a temporary database access issue.',
  },

  // ── ERR-037: Could Not Load Overdue Scrapes ──────────────────────────────
  {
    pattern: '[intelligent-schedule-data] Error getting overdue scrapes',
    title: 'Could Not Load Overdue Scrapes',
    description:
      'Restart the app. If channels seem stuck, try manually triggering a scrape.',
  },

  // ── ERR-038: Could Not Load Schedule Statistics ───────────────────────────
  {
    pattern: '[intelligent-schedule-data] Error getting stats',
    title: 'Could Not Load Schedule Statistics',
    description:
      'This is a display-only issue and does not affect scraping. Restart the app to restore the stats view.',
  },
]);

/**
 * Looks up `key` in SKEDULOSA_ERROR_MAP and fires a destructive shadcn toast
 * with the matching user-friendly title and description.
 *
 * Pass a raw Nemesis/bridge error message OR a UI sentinel string:
 *   showSkedulosaError(err.message)         // backend error
 *   showSkedulosaError('paste-failed')      // UI sentinel
 *
 * Falls back to a generic error toast that surfaces the raw key as the
 * description if nothing matches — so callers never need to guard against
 * an unrecognized error.
 */
export function showSkedulosaError(key: string): void {
  for (const entry of SKEDULOSA_ERROR_MAP) {
    const matched =
      typeof entry.pattern === 'string'
        ? key.includes(entry.pattern)
        : entry.pattern.test(key);

    if (matched) {
      toast({
        variant: 'destructive',
        title: entry.title,
        description: entry.description,
        duration: 5000,
      });
      if (entry.telemetry !== false) {
        reportSkedulosaError(key, entry.title);
      }
      return;
    }
  }

  // No match — surface the raw error so the user sees something meaningful
  toast({
    variant: 'destructive',
    title: 'Something went wrong',
    description: key || 'An unexpected error occurred. Please try again.',
    duration: 5000,
  });
  if (key) {
    reportSkedulosaError(key, 'Unmapped error');
  }
}

/**
 * Surfaces each unique yt-dlp error from a ScrapeRunResult as a toast.
 * Deduplicates by message so a single channel failure never fires more than one
 * identical notification. Safe to call with any value — no-ops on null/void/empty.
 *
 * Also arms the yt-dlp recovery service on first call with errors present —
 * this starts a background health-check loop that notifies the user when
 * yt-dlp is working again.
 */
export function showScrapeErrors(result: unknown): void {
  if (!result || typeof result !== 'object') return;
  const errors = (result as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || errors.length === 0) return;

  const seen = new Set<string>();
  for (const err of errors) {
    if (!err || typeof err !== 'object') continue;
    const msg = (err as { message?: unknown }).message;
    if (typeof msg !== 'string' || !msg || seen.has(msg)) continue;
    seen.add(msg);
    showSkedulosaError(msg);
  }
  if (window.skedulosaBridge) {
    ytdlpRecoveryService.start(window.skedulosaBridge);
  }
}
