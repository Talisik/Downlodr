import type {
  Download,
  ScheduledChannel,
  ScheduleEntry,
  Subscription,
  SubscriptionDownloadInput,
} from '@/skedulosa/store/skedulosaStore';

const DAY_ABBREV_TO_LABEL: Record<string, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

const DAY_ORDER = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Shape of a download payload when it was initiated (e.g. from AddDownload).
 * Used to build SubscriptionDownloadInput without depending on downlodr schema.
 */
export interface SubscriptionDownloadPayload {
  id: string;
  name: string;
  displayName?: string;
  size?: number | string;
  speed?: string;
  thumbnails?: string;
  status?: string;
}

/**
 * Builds SubscriptionDownloadInput from a subscription-initiated download payload.
 * Use this when a subscription triggers a download so you can pass the result to
 * addDownloadToSubscription(subscriptionId, input).
 */
export function createSubscriptionDownloadInput(
  payload: SubscriptionDownloadPayload,
  overrides?: Partial<SubscriptionDownloadInput>,
): SubscriptionDownloadInput {
  const size =
    payload.size !== undefined
      ? typeof payload.size === 'number'
        ? String(payload.size)
        : payload.size
      : undefined;
  return {
    id: payload.id,
    name: payload.displayName ?? payload.name,
    thumbnail_location: payload.thumbnails,
    size,
    speed: payload.speed,
    status: payload.status ?? overrides?.status ?? 'queued',
    ...overrides,
  };
}

/**
 * Returns how many channels (subscriptions) had at least one download today.
 * Counts subscriptions with at least one download whose `date_added` falls on the current local date.
 */
export function getScheduledDownloadsCountToday(
  subscriptions: Subscription[],
): number {
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  let count = 0;
  for (const sub of subscriptions) {
    const hasDownloadToday = sub.downloads.some((download) => {
      const added = new Date(download.date_added);
      return added >= todayStart && added < todayEnd;
    });
    if (hasDownloadToday) count += 1;
  }
  return count;
}

/**
 * Parses timeToCheck (hour string, e.g. "6" or "14") and returns formatted time "6:00 AM" / "2:00 PM".
 */
function formatTimeFromHour(hourStr: string): string {
  const hour = Math.min(23, Math.max(0, parseInt(hourStr, 10) || 0));
  const isPM = hour >= 12;
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = isPM ? 'PM' : 'AM';
  return `${displayHour}:00 ${ampm}`;
}

/**
 * Formats a schedule entry as "(type) (time)", e.g. "every Monday 6:00 AM", "daily 6:00 AM".
 */
export function formatSchedule(entry: ScheduleEntry): string {
  const time = formatTimeFromHour(entry.timeToCheck);
  const days = (entry.daysTocheck ?? []).map((d) => d.toLowerCase());
  const uniqueDays = [...new Set(days)].filter((d) => DAY_ABBREV_TO_LABEL[d]);

  if (uniqueDays.length === 0) {
    return time;
  }
  if (uniqueDays.length === 7) {
    return `Daily ${time}`;
  }
  if (uniqueDays.length === 1) {
    const dayLabel = DAY_ABBREV_TO_LABEL[uniqueDays[0]] ?? uniqueDays[0];
    return `Every ${dayLabel} ${time}`;
  }
  const sortedLabels = DAY_ORDER.filter((abbrev) =>
    uniqueDays.includes(abbrev),
  ).map((abbrev) => DAY_ABBREV_TO_LABEL[abbrev] ?? abbrev);
  return `Every ${sortedLabels.join(', ')} ${time}`;
}

/**
 * Gets the next run date for a schedule entry: next occurrence of any scheduled day at the given hour.
 */
export function getNextRunDate(entry: ScheduleEntry, now: Date): Date {
  const hour = Math.min(23, Math.max(0, parseInt(entry.timeToCheck, 10) || 0));
  const days = (entry.daysTocheck ?? []).map((d) => d.toLowerCase());
  const dayIndices = new Set(
    days
      .map((abbrev) => DAY_ORDER.indexOf(abbrev as (typeof DAY_ORDER)[number]))
      .filter((i) => i >= 0),
  );
  if (dayIndices.size === 0) {
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const candidates: Date[] = [];

  for (let offset = 0; offset <= 7; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const dayIndex = d.getDay();
    if (!dayIndices.has(dayIndex)) continue;
    d.setHours(hour, 0, 0, 0);
    if (d > now) candidates.push(d);
  }

  if (candidates.length === 0) {
    const fallback = new Date(today);
    fallback.setDate(fallback.getDate() + 7);
    fallback.setHours(hour, 0, 0, 0);
    return fallback;
  }
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0];
}

/**
 * Formats when the next run will occur, e.g. "in 2 hours", "Tomorrow 6:00 AM", "Mon 6:00 AM".
 */
export function formatNextRun(
  entry: ScheduleEntry,
  now: Date = new Date(),
): string {
  const next = getNextRunDate(entry, now);
  const timeStr = formatTimeFromHour(entry.timeToCheck);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextDay = new Date(next.getFullYear(), next.getMonth(), next.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (nextDay.getTime() === tomorrow.getTime()) {
    return `Tomorrow ${timeStr}`;
  }
  const sameDay =
    next.getDate() === now.getDate() &&
    next.getMonth() === now.getMonth() &&
    next.getFullYear() === now.getFullYear();
  if (sameDay) {
    const diffMs = next.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffMins = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
    if (diffHours > 0)
      return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    if (diffMins > 0)
      return `in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    return `in less than a minute`;
  }
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${dayNames[next.getDay()]} ${timeStr}`;
}

/** Download statuses that are considered "in progress" for progress formatting. */
const IN_PROGRESS_STATUSES = new Set(['downloading', 'pending']);

/**
 * Progress of subscription downloads: "current / total" text and percentage.
 * Treats "downloading" and "pending" as in-progress; "completed" as done.
 * Total = in-progress + completed; current = completed. Percentage = completed / total (0 if total 0).
 */
export function formatProgress(downloads: Download[]): {
  text: string;
  percentage: number;
} {
  const completed = downloads.filter((d) => d.status === 'completed').length;
  const inProgress = downloads.filter((d) =>
    IN_PROGRESS_STATUSES.has(d.status),
  ).length;
  const total = completed + inProgress;

  if (total === 0) {
    return { text: '0 / 0', percentage: 0 };
  }
  const current = completed;
  const percentage = Math.round((current / total) * 100);
  return {
    text: `${current} / ${total}`,
    percentage,
  };
}

/** Display label for schedule/subscription status. */
export type ScheduleStatusDisplay = 'Running' | 'Pending' | 'Missed' | string;

const STATUS_TO_DISPLAY: Record<string, ScheduleStatusDisplay> = {
  active: 'Running',
  Active: 'Running',
  pending: 'Pending',
  Pending: 'Pending',
  paused: 'Pending',
  Paused: 'Pending',
  error: 'Missed',
  Error: 'Missed',
  'needs-attention': 'Pending',
  'Needs Attention': 'Pending',
};

/**
 * Formats status for display: Active -> Running, Pending/Paused -> Pending, Error -> Missed.
 */
export function formatStatus(status: string): ScheduleStatusDisplay {
  const normalized = status?.trim() ?? '';
  if (status=='active' || status=='Active') {
    return 'Pending';
  }
  return STATUS_TO_DISPLAY[normalized] ?? (normalized || 'Pending');
}

/**
 * Finds the soonest next run across all scheduled channels and returns a
 * human-readable label (e.g. "in 2 hours", "Tomorrow 6:00 AM").
 * Returns '—' when there are no channels or schedule entries.
 */
export function getSoonestNextRunLabel(
  channels: ScheduledChannel[],
  now: Date = new Date(),
): string {
  let soonest: Date | null = null;
  let soonestEntry: ScheduleEntry | null = null;

  for (const channel of channels) {
    for (const entry of channel.schedule ?? []) {
      const next = getNextRunDate(entry, now);
      if (soonest === null || next.getTime() < soonest.getTime()) {
        soonest = next;
        soonestEntry = entry;
      }
    }
  }

  if (soonest === null || soonestEntry === null) return '—';
  return formatNextRun(soonestEntry, now);
}
