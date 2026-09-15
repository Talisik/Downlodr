import type { Subscription } from '@/skedulosa/store/skedulosaStore';

/**
 * Formats a byte count as human-readable string (e.g. "1.2 GB", "500 MB").
 */
export function formatBytesToHuman(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, i);
  const rounded =
    value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[i]}`;
}

/** Parses size strings like "100.5 MB" or "1.2 GB" to bytes. Returns 0 if unparseable. */
function parseSizeToBytes(sizeStr: string): number {
  if (!sizeStr || typeof sizeStr !== 'string') return 0;
  const trimmed = sizeStr.trim();
  const match = trimmed.match(/^([\d.]+)\s*(MB|GB|KB|B)?$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  if (Number.isNaN(value) || value < 0) return 0;
  const unit = (match[2] ?? 'B').toUpperCase();
  switch (unit) {
    case 'KB':
      return value * 1024;
    case 'MB':
      return value * 1024 * 1024;
    case 'GB':
      return value * 1024 * 1024 * 1024;
    default:
      return value;
  }
}

/**
 * Returns total storage used (in bytes) for all downloads listed inside all subscriptions.
 */
export function getTotalStorageUsedBytes(
  subscriptions: Subscription[],
): number {
  let total = 0;
  for (const sub of subscriptions) {
    for (const d of sub.downloads) {
      total += parseSizeToBytes(d.size);
    }
  }
  return total;
}

/**
 * Returns total storage (in bytes) per subscription, keyed by subscription id.
 */
export function getTotalStoragePerSubscription(
  subscriptions: Subscription[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const sub of subscriptions) {
    out[sub.id] = getTotalStorageForDownloads(sub.downloads);
  }
  return out;
}

/**
 * Returns total storage (in bytes) for a flat list of downloads.
 * Useful when you already have the downloads for a single subscription/channel.
 */
export function getTotalStorageForDownloads(
  downloads: Subscription['downloads'],
): number {
  let sum = 0;
  for (const d of downloads) {
    sum += parseSizeToBytes(d.size);
  }
  return sum;
}

/**
 * Returns download count per subscription, keyed by subscription id.
 */
export function getDownloadCountPerSubscription(
  subscriptions: Subscription[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const sub of subscriptions) {
    out[sub.id] = sub.downloads.length;
  }
  return out;
}

/**
 * Formats a past date as "X time ago" (e.g. "2 hours ago", "3 days ago").
 */
function formatTimeAgo(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'just now';
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  if (diffWeek < 4) return `${diffWeek} week${diffWeek !== 1 ? 's' : ''} ago`;
  if (diffMonth < 12)
    return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`;
  return `${diffYear} year${diffYear !== 1 ? 's' : ''} ago`;
}

/**
 * Returns the last downloaded video's date_added as "X time ago" per subscription.
 * Uses the most recent date_added in each subscription's download list.
 * Returns null for a subscription if it has no downloads.
 */
export function getLastDownloadedTimeAgoPerSubscription(
  subscriptions: Subscription[],
  now: Date = new Date(),
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const sub of subscriptions) {
    if (sub.downloads.length === 0) {
      out[sub.id] = null;
      continue;
    }
    let latest: Date | null = null;
    for (const d of sub.downloads) {
      const added = new Date(d.date_added);
      if (!latest || added > latest) latest = added;
    }
    out[sub.id] = latest ? formatTimeAgo(latest, now) : null;
  }
  return out;
}

/** Status considered "finished" for percent-complete calculation. */
const FINISHED_STATUS = 'completed';

/**
 * Returns the percent (0–100) of downloads that are finished (completed) per subscription.
 * Total count = all downloads in that subscription; finished = status === 'completed'.
 */
export function getFinishedDownloadPercentPerSubscription(
  subscriptions: Subscription[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const sub of subscriptions) {
    const total = sub.downloads.length;
    if (total === 0) {
      out[sub.id] = 0;
      continue;
    }
    const finished = sub.downloads.filter(
      (d) => d.status.toLowerCase() === FINISHED_STATUS.toLowerCase(),
    ).length;
    out[sub.id] = Math.round((finished / total) * 100);
  }
  return out;
}

/**
 * Returns average size (in bytes) per subscription, based on each subscription's download list.
 * Returns 0 for subscriptions with no downloads.
 */
export function getAverageSizeBytesPerSubscription(
  subscriptions: Subscription[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const sub of subscriptions) {
    if (sub.downloads.length === 0) {
      out[sub.id] = 0;
      continue;
    }
    let sum = 0;
    for (const d of sub.downloads) {
      sum += parseSizeToBytes(d.size);
    }
    out[sub.id] = Math.round(sum / sub.downloads.length);
  }
  return out;
}

/** Time-of-day buckets for heat map rows. */
export type TimeOfDayBucket = 'morning' | 'afternoon' | 'night';

/** Day-of-week indices: 0 = Monday, 6 = Sunday (ISO weekday for columns). */
export type DayOfWeekIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Heat map cell: row = time of day, column = day of week (Mon=0 .. Sun=6). */
export interface HeatMapCell {
  dayOfWeek: DayOfWeekIndex;
  timeOfDay: TimeOfDayBucket;
  count: number;
}

/** Heat map result: counts per (timeOfDay, dayOfWeek). Rows = time of day, columns = day of week. */
export interface HeatMapData {
  /** Row labels in order: morning, afternoon, night. */
  rows: readonly [TimeOfDayBucket, TimeOfDayBucket, TimeOfDayBucket];
  /** Column labels in order: Mon .. Sun. */
  columns: readonly ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  /** Grid[rowIndex][colIndex]. row 0 = morning, 1 = afternoon, 2 = night; col 0 = Mon ... 6 = Sun. */
  grid: ReadonlyArray<ReadonlyArray<number>>;
  /** Flat list of cells with counts (for iteration). */
  cells: ReadonlyArray<HeatMapCell>;
}

const HEATMAP_ROWS: readonly TimeOfDayBucket[] = [
  'morning',
  'afternoon',
  'night',
];
const HEATMAP_COLUMNS = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
] as const;

/**
 * Maps hour (0–23) to time-of-day bucket.
 * Morning: 6–11, Afternoon: 12–17, Night: 18–23 and 0–5.
 */
function getTimeOfDayBucket(hour: number): TimeOfDayBucket {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'night';
}

/**
 * JS getDay(): 0 = Sun, 1 = Mon, ... 6 = Sat.
 * We want columns Mon=0 .. Sun=6, so ISO weekday: Mon=1 .. Sun=7 -> subtract 1 and wrap Sun to 6.
 * Actually: Mon=0, Tue=1, ..., Sun=6. So getDay() 0 (Sun) -> 6, 1 (Mon) -> 0, 2 (Tue) -> 1, etc.
 */
function getDayOfWeekIndex(jsDay: number): DayOfWeekIndex {
  const iso = jsDay === 0 ? 7 : jsDay; // Sun=7, Mon=1..Sat=6
  return ((iso - 1) % 7) as DayOfWeekIndex; // Mon=0 .. Sun=6
}

/**
 * Heat map logic: buckets a list of upload/occurrence dates by day of week (columns Mon–Sun)
 * and time of day (rows: morning, afternoon, night).
 * Returns a grid and flat list of cells with counts.
 */
export function buildHeatMapFromDates(
  dates: ReadonlyArray<Date | string>,
  now: Date = new Date(),
): HeatMapData {
  const grid: number[][] = [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ];
  const rowIndex = (bucket: TimeOfDayBucket): number => {
    const i = HEATMAP_ROWS.indexOf(bucket);
    return i >= 0 ? i : 0;
  };

  for (const d of dates) {
    const date = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(date.getTime())) continue;
    const hour = date.getHours();
    const dayJs = date.getDay();
    const col = getDayOfWeekIndex(dayJs);
    const bucket = getTimeOfDayBucket(hour);
    const row = rowIndex(bucket);
    grid[row][col] += 1;
  }

  const cells: HeatMapCell[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 7; c++) {
      cells.push({
        dayOfWeek: c as DayOfWeekIndex,
        timeOfDay: HEATMAP_ROWS[r],
        count: grid[r][c],
      });
    }
  }

  return {
    rows: HEATMAP_ROWS as readonly [
      TimeOfDayBucket,
      TimeOfDayBucket,
      TimeOfDayBucket,
    ],
    columns: HEATMAP_COLUMNS,
    grid,
    cells,
  };
}

/**
 * Builds a heat map from all subscription downloads' date_added values.
 */
export function buildHeatMapFromSubscriptionDownloads(
  subscriptions: Subscription[],
): HeatMapData {
  const dates: string[] = [];
  for (const sub of subscriptions) {
    for (const d of sub.downloads) {
      if (d.date_added) dates.push(d.date_added);
    }
  }
  return buildHeatMapFromDates(dates);
}
