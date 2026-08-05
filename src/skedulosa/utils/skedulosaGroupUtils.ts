import { formatRelativeTime } from '@/downlodr/pages/status/statusPageUtils';
import type { SearchableDownload } from '@/downlodr/store/taskbarDownloadStore';

/**
 * Splits a flat downloads array into:
 * - grouped: Record<subscriptionId, downloads[]> for downloads that have a subscriptionId
 * - groupOrder: subscriptionIds in first-seen order (preserves original list position)
 * - ungrouped: downloads with no subscriptionId
 */
export function splitBySubscription(downloads: SearchableDownload[]): {
  grouped: Record<string, SearchableDownload[]>;
  groupOrder: string[];
  ungrouped: SearchableDownload[];
} {
  const grouped: Record<string, SearchableDownload[]> = {};
  const groupOrder: string[] = [];
  const ungrouped: SearchableDownload[] = [];

  for (const download of downloads) {
    const subId = download.subscriptionId;
    if (subId) {
      if (!grouped[subId]) {
        grouped[subId] = [];
        groupOrder.push(subId);
      }
      grouped[subId].push(download);
    } else {
      ungrouped.push(download);
    }
  }

  return { grouped, groupOrder, ungrouped };
}

/** Sum of all download sizes in bytes. */
export function aggregateGroupSize(downloads: SearchableDownload[]): number {
  return downloads.reduce(
    (sum, d) => sum + (d.size ?? 0),
    0,
  );
}

/** Number of downloads in the group. */
export function getGroupVideoCount(downloads: SearchableDownload[]): number {
  return downloads.length;
}

/**
 * Human-readable "last updated" label from a subscription's last_checked_time.
 * Returns "never checked" if the field is empty.
 */
export function getGroupLastUpdated(lastCheckedTime: string): string {
  if (!lastCheckedTime) return 'never checked';
  return formatRelativeTime(lastCheckedTime);
}
