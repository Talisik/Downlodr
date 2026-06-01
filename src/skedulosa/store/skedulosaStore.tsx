import { createIndexedDBStorageWithMigration } from '@/core-app/utils/indexedDBStorage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// ----- New subscription schema -----

export type ScheduleDay =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface Download {
  id: string;
  status: string;
  name: string;
  thumbnail_location: string;
  size: string;
  speed: string;
  date_added: string;
  video_location?: string;
}

/**
 * Minimal payload when adding a download initiated by a subscription.
 * Used to record the download in the subscription's list; status can be updated later.
 */
export interface SubscriptionDownloadInput {
  id: string;
  name: string;
  thumbnail_location?: string;
  size?: string;
  speed?: string;
  /** Initial status, e.g. 'queued' or 'pending'. Defaults to 'queued'. */
  status?: string;
  video_location?: string;
}

export interface ScheduleTime {
  day: ScheduleDay;
  /** Time of day in minutes from midnight (e.g. 360 = 6:00 AM). */
  time_minutes?: number;
}

export interface SubscriptionSettings {
  frequency: string;
  download_quality: string;
  save_location: string;
  download_priority: string;
  lookback_period: string;
  file_naming_format: string;
}

export interface SubscriptionChannelDetails {
  avatarUrl: string;
  subscriberCount: number;
  videoCount: string;
  site: string;
}

export interface SubscriptionAnalysis {
  pattern: string;
  confidence: number;
  nextScrapeTime: string;
  isErratic: boolean;
}

export type ActivityLogType =
  | 'check'
  | 'download'
  | 'retry'
  | 'error'
  | 'subscribe';

export interface ActivityLogEntry {
  id: string;
  type: ActivityLogType;
  /** Short action label, e.g. "Check completed", "Download failed" */
  action: string;
  /** Optional detail line, e.g. video name or error message */
  detail?: string;
  /** ISO timestamp */
  timestamp: string;
}

export interface Subscription {
  id: string;
  downloads: Download[];
  schedule_time: ScheduleTime[];
  last_checked_time: string;
  /** Display name (e.g. channel or source name). */
  source: string;
  /** Source URL (channel, playlist, or feed URL) used for "Check now" / scheduler. */
  sourceUrl: string;
  recurring: boolean;
  status: string;
  date_created: string;
  upload_cadence: string;
  settings: SubscriptionSettings[];
  /** ID of the corresponding schedule row in the toolkit SQLite DB. */
  toolkit_schedule_id?: number;
  /** ID of the corresponding channel row in the toolkit SQLite DB. */
  toolkit_channel_id?: number;
  /** Channel metadata fetched at subscribe time (avatar, subscribers, site). */
  channel_details?: SubscriptionChannelDetails;
  /** Upload pattern inferred from channel analysis at subscribe time. */
  channel_analysis?: SubscriptionAnalysis;
  /** Chronological log of events for this subscription. */
  activity_log?: ActivityLogEntry[];
}

// ----- Legacy types (kept for migration; map from Subscription where needed) -----

export interface ScheduleEntry {
  scheduleId: string;
  timezone: string;
  daysTocheck: string[];
  timeToCheck: string;
  qualityPreset: string;
  lookbackPeriod: string;
  saveLocation: string;
}

export interface ScheduledChannel {
  channelId: string;
  channelName: string;
  channelUrl: string;
  schedule: ScheduleEntry[];
  status: string;
  /** Optional category for filtering (e.g. 'youtube'). */
  category?: string;
  id: string;
  downloads: Download[];
  schedule_time: ScheduleTime[];
  last_checked_time: string;
  /** Display name (e.g. channel or source name). */
  source: string;
  /** Source URL (channel, playlist, or feed URL) used for "Check now" / scheduler. */
  sourceUrl: string;
  recurring: boolean;
  date_created: string;
  upload_cadence: string;
  settings: SubscriptionSettings[];
}

/** Status filter slugs used in nav; maps to Subscription.status. */
export type StatusFilterSlug =
  | 'all'
  | 'active'
  | 'paused'
  | 'needs-attention'
  | 'error';

/** Category filter slugs; 'all' shows every subscription (by source). */
export type CategoryFilterSlug = 'all' | 'youtube';

export interface StatusFilterOption {
  id: string;
  label: string;
  slug: StatusFilterSlug;
  iconClassName?: string;
}

export interface CategoryFilterOption {
  id: string;
  label: string;
  slug: CategoryFilterSlug;
  iconClassName?: string;
}

/** Status filter options for the nav (from store logic). */
export const STATUS_FILTER_OPTIONS: StatusFilterOption[] = [
  {
    id: 'all',
    label: 'All',
    slug: 'all',
    iconClassName: 'text-primary text-sm',
  },
  {
    id: 'active',
    label: 'Active',
    slug: 'active',
    iconClassName: 'text-emerald-500',
  },
  {
    id: 'paused',
    label: 'Paused',
    slug: 'paused',
    iconClassName: 'text-amber-500',
  },
  {
    id: 'needs-attention',
    label: 'Needs Attention',
    slug: 'needs-attention',
    iconClassName: 'text-amber-600',
  },
  {
    id: 'error',
    label: 'Has Error',
    slug: 'error',
    iconClassName: 'text-red-500',
  },
];

/** Category filter options for the nav (from store logic). */
export const CATEGORY_FILTER_OPTIONS: CategoryFilterOption[] = [
  { id: 'all', label: 'All', slug: 'all' },
  {
    id: 'youtube',
    label: 'Youtube',
    slug: 'youtube',
    iconClassName: 'text-green-500',
  },
];

const STATUS_SLUG_TO_STATUS: Record<
  Exclude<StatusFilterSlug, 'all'>,
  string
> = {
  active: 'Active',
  paused: 'Paused',
  'needs-attention': 'Needs Attention',
  error: 'Error',
};

/** Pure filter for subscriptions by status and category (source). */
export function filterSubscriptionsByStatusAndCategory(
  subscriptions: Subscription[],
  statusFilter: StatusFilterSlug,
  categoryFilter: CategoryFilterSlug,
): Subscription[] {
  let result = subscriptions;
  if (statusFilter !== 'all') {
    const status = STATUS_SLUG_TO_STATUS[statusFilter];
    result = result.filter((sub) =>
      statusFilter === 'error'
        ? sub.status === 'Error' ||
          sub.status === 'Failed' ||
          sub.downloads.some((d) => d.status === 'failed')
        : sub.status === status,
    );
  }
  if (categoryFilter !== 'all') {
    result = result.filter(
      (sub) => sub.source.toLowerCase() === categoryFilter,
    );
  }
  return result;
}

/** @deprecated Use filterSubscriptionsByStatusAndCategory. Kept for migration. */
export function filterChannelsByStatusAndCategory(
  channels: ScheduledChannel[],
  statusFilter: StatusFilterSlug,
  categoryFilter: CategoryFilterSlug,
): ScheduledChannel[] {
  let result = channels;
  if (statusFilter !== 'all') {
    const status = STATUS_SLUG_TO_STATUS[statusFilter];
    result = result.filter((ch) =>
      statusFilter === 'error'
        ? ch.status === 'Error' ||
          ch.status === 'Failed' ||
          ch.downloads.some((d) => d.status === 'failed')
        : ch.status === status,
    );
  }
  if (categoryFilter !== 'all') {
    result = result.filter(
      (ch) => (ch.category ?? 'youtube').toLowerCase() === categoryFilter,
    );
  }
  return result;
}

export type SortField =
  | 'name'
  | 'date'
  | 'downloads'
  | 'type'
  | 'schedule'
  | 'nextrun'
  | 'source'
  | 'status'
  | 'storage'
  | 'subscription'
  | 'speed';
export type SortDirection = 'asc' | 'desc';

interface SkedulosaStoreState {
  subscriptions: Subscription[];
  /** Derived from subscriptions for backward-compat; kept in sync on every mutation. */
  scheduledChannels: ScheduledChannel[];
  statusFilter: StatusFilterSlug;
  categoryFilter: CategoryFilterSlug;
  searchQuery: string;
  sortField: SortField;
  sortDirection: SortDirection;
  setSearchQuery: (q: string) => void;
  setSortField: (field: SortField) => void;
  setSortDirection: (dir: SortDirection) => void;
  /** Auto-incrementing counter for generating sequential subscription/channel IDs. */
  nextId: number;
  /** Returns the current nextId as a string and increments the counter. */
  getNextId: () => string;
  setStatusFilter: (slug: StatusFilterSlug) => void;
  setCategoryFilter: (slug: CategoryFilterSlug) => void;
  addSubscription: (subscription: Subscription) => void;
  removeSubscription: (subscriptionId: string) => void;
  updateSubscription: (
    subscriptionId: string,
    subscription: Subscription,
  ) => void;
  getSubscription: (subscriptionId: string) => Subscription | undefined;
  getSubscriptions: () => Subscription[];
  getFilteredSubscriptions: () => Subscription[];
  addScheduledChannel: (channel: ScheduledChannel) => void;
  removeScheduledChannel: (channelId: string) => void;
  updateScheduledChannel: (
    channelId: string,
    channel: ScheduledChannel,
  ) => void;
  getScheduledChannel: (channelId: string) => ScheduledChannel | undefined;
  getScheduledChannels: () => ScheduledChannel[];
  getFilteredScheduledChannels: () => ScheduledChannel[];
  /** Add a download to a subscription's list (when the subscription initiated it). */
  addDownloadToSubscription: (
    subscriptionId: string,
    input: SubscriptionDownloadInput,
  ) => void;
  /** Update an existing download in a subscription's list (e.g. status, speed). */
  updateSubscriptionDownload: (
    subscriptionId: string,
    downloadId: string,
    updates: Partial<Download>,
  ) => void;
  /** Remove a single download from a subscription's list. */
  removeSubscriptionDownload: (
    subscriptionId: string,
    downloadId: string,
  ) => void;
  /** Remove all subscriptions and their derived scheduledChannels. */
  clearSubscriptions: () => void;
  /** Append an entry to a subscription's activity log. */
  addActivityLogEntry: (
    subscriptionId: string,
    entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>,
  ) => void;
  /** Clear all activity log entries for a subscription. */
  clearActivityLog: (subscriptionId: string) => void;
  /**
   * Advances last_checked_time for every subscription whose most recent
   * schedule slot has already passed but whose stored value is still behind.
   * Safe to call frequently — only writes when something actually changed.
   */
  tickScheduleChecks: () => void;
  /** Start a 60-second interval that calls tickScheduleChecks automatically. */
  startScheduleTicker: () => void;
  /** Stop the schedule ticker started by startScheduleTicker. */
  stopScheduleTicker: () => void;
  /** IDs of channels currently selected in the table. Not persisted. */
  selectedChannelIds: string[];
  toggleChannelSelection: (id: string) => void;
  selectAllChannels: (ids: string[]) => void;
  clearSelection: () => void;
  /** Delete subscriptions by ID, including bridge cleanup. */
  bulkDeleteSubscriptions: (ids: string[]) => Promise<void>;
  /** Pause subscriptions by ID (sets status to 'Paused' + bridge call). */
  bulkPauseSubscriptions: (ids: string[]) => Promise<void>;
  /** Resume subscriptions by ID (sets status to 'Active' + bridge call). */
  bulkResumeSubscriptions: (ids: string[]) => Promise<void>;
  /** IDs of history downloads currently selected. Composite key `${subscriptionId}:${downloadId}`. Not persisted. */
  selectedHistoryIds: string[];
  toggleHistorySelection: (id: string) => void;
  selectAllHistory: (ids: string[]) => void;
  clearHistorySelection: () => void;
  /** Delete history downloads by composite ID (`${subscriptionId}:${downloadId}`). */
  bulkDeleteHistoryDownloads: (ids: string[]) => void;
  /** Track channels currently scraping. Map<channelId, {name, status, error?}>. Not persisted. */
  scrapingChannels: Map<
    number,
    { name: string; status: string; error?: string }
  >;
  /** Channel URL to pre-fill in SkedulosaSubscribeModal. Set from taskbar when a channel link is detected. Not persisted. */
  pendingSubscribeUrl: string | null;
  setPendingSubscribeUrl: (url: string | null) => void;
  /** Set a channel as scraping. */
  setChannelScraping: (channelId: number, name: string) => void;
  /** Update scraping channel status. */
  updateChannelScrapingStatus: (channelId: number, status: string) => void;
  /** Remove a channel from scraping. */
  removeChannelScraping: (channelId: number) => void;
  /** Channel currently being analyzed in the Subscribe modal. Not persisted. */
  analyzingChannel: { url: string; isYouTube: boolean } | null;
  analyzingStatus: 'idle' | 'analyzing' | 'done';
  isAnalyzingDismissed: boolean;
  startChannelAnalysis: (url: string, isYouTube: boolean) => void;
  finishChannelAnalysis: () => void;
  clearChannelAnalysis: () => void;
  setAnalyzingDismissed: (val: boolean) => void;
  /** Stores analysis result while navigating away so the modal can restore it on re-open. Not persisted. */
  pendingAnalysisData: {
    url: string;
    channelAnalysis: unknown;
    channelDetails: unknown | null;
    channelName: string;
  } | null;
  setPendingAnalysisData: (
    data: {
      url: string;
      channelAnalysis: unknown;
      channelDetails: unknown | null;
      channelName: string;
    } | null,
  ) => void;
}

const DAY_TO_ABBREV: Record<ScheduleDay, string> = {
  Sunday: 'sun',
  Monday: 'mon',
  Tuesday: 'tue',
  Wednesday: 'wed',
  Thursday: 'thu',
  Friday: 'fri',
  Saturday: 'sat',
};

/** Map a Subscription to legacy ScheduledChannel for backward compatibility. */
function subscriptionToChannel(sub: Subscription): ScheduledChannel {
  const firstSettings = sub.settings[0];

  // Legacy schedule uses day abbreviations and a single ScheduleEntry array.
  const daysTocheck = sub.schedule_time?.map((t) => DAY_TO_ABBREV[t.day]) ?? [
    'sun',
  ];

  const firstSlotMinutes = sub.schedule_time?.[0]?.time_minutes;
  const timeToCheck =
    firstSlotMinutes !== undefined
      ? String(Math.floor(firstSlotMinutes / 60) % 24)
      : '0';

  const scheduleEntry: ScheduleEntry = {
    scheduleId: sub.id,
    timezone: 'UTC',
    daysTocheck: daysTocheck,
    timeToCheck,
    qualityPreset: firstSettings?.download_quality ?? '',
    lookbackPeriod: firstSettings?.lookback_period ?? '',
    saveLocation: firstSettings?.save_location ?? '',
  };

  return {
    channelId: sub.id,
    channelName: sub.source,
    channelUrl: sub.sourceUrl,
    schedule: [scheduleEntry],
    status: sub.status,
    category: 'youtube',
    id: sub.id,
    downloads: sub.downloads,
    schedule_time: sub.schedule_time,
    last_checked_time: sub.last_checked_time,
    source: sub.source,
    sourceUrl: sub.sourceUrl,
    recurring: sub.recurring,
    date_created: sub.date_created,
    upload_cadence: sub.upload_cadence,
    settings: sub.settings,
  };
}

const ABBREV_TO_DAY: Record<string, ScheduleDay> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

/** Map a legacy ScheduledChannel to Subscription. */
export function channelToSubscription(channel: ScheduledChannel): Subscription {
  const firstSchedule = channel.schedule[0];
  const days = (firstSchedule?.daysTocheck ?? []).map((abbrev) => {
    const day: ScheduleDay = ABBREV_TO_DAY[abbrev.toLowerCase()] ?? 'Monday';
    return { day } as ScheduleTime;
  });
  const createdAt = new Date().toISOString();
  return {
    id: channel.channelId,
    downloads: [],
    schedule_time: days.length > 0 ? days : [{ day: 'Sunday' }],
    last_checked_time: '',
    source: channel.channelName,
    sourceUrl: channel.channelUrl ?? '',
    recurring: true,
    status: channel.status,
    date_created: createdAt,
    upload_cadence: '',
    settings: channel.schedule.map((s) => ({
      frequency: '',
      download_quality: s.qualityPreset,
      save_location: s.saveLocation,
      download_priority: '',
      lookback_period: s.lookbackPeriod,
      file_naming_format: '',
    })),
    activity_log: [
      {
        id: `${Date.now()}-init`,
        type: 'subscribe',
        action: 'Subscription created',
        detail: 'Initial setup complete',
        timestamp: createdAt,
      },
    ],
  };
}

function syncScheduledChannels(
  subscriptions: Subscription[],
): ScheduledChannel[] {
  return subscriptions.map(subscriptionToChannel);
}

/** Maps ScheduleDay name to JS Date.getDay() index (0 = Sunday). */
const DAY_NAME_TO_INDEX: Record<ScheduleDay, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Finds the most recent past occurrence of any schedule slot for a subscription,
 * clamped to not go before notBefore (typically the subscription's date_created).
 * Returns null when no slot has occurred after notBefore.
 */
function getMostRecentPassedSlotTime(
  sub: Subscription,
  now: Date,
  notBefore: Date,
): Date | null {
  if (!sub.schedule_time || sub.schedule_time.length === 0) return null;

  let mostRecent: Date | null = null;

  for (const slot of sub.schedule_time) {
    const targetDayIndex = DAY_NAME_TO_INDEX[slot.day];
    const timeMinutes = slot.time_minutes ?? 0;
    const currentDayIndex = now.getDay();

    // How many days ago was the target day (0 = today, 1 = yesterday, …)
    const daysAgo = (currentDayIndex - targetDayIndex + 7) % 7;

    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() - daysAgo);
    candidate.setHours(Math.floor(timeMinutes / 60), timeMinutes % 60, 0, 0);

    // If the slot time hasn't arrived yet today, step back a full week
    if (candidate > now) {
      candidate.setDate(candidate.getDate() - 7);
    }

    // Ignore slots that occurred before the subscription was created
    if (candidate <= notBefore) continue;

    if (mostRecent === null || candidate > mostRecent) {
      mostRecent = candidate;
    }
  }

  return mostRecent;
}

/** Module-level handle for the schedule-tick interval (not stored in Zustand state). */
let _scheduleTicker: ReturnType<typeof setInterval> | null = null;

export const useSkedulosaStore = create<SkedulosaStoreState>()(
  persist(
    (set, get) => ({
      subscriptions: [],
      scheduledChannels: [],
      statusFilter: 'all',
      categoryFilter: 'all',
      searchQuery: '',
      sortField: 'name',
      sortDirection: 'asc',
      setSearchQuery: (q) => set({ searchQuery: q }),
      setSortField: (field) => set({ sortField: field }),
      setSortDirection: (dir) => set({ sortDirection: dir }),
      nextId: 1,
      getNextId: () => {
        const id = get().nextId;
        set((state) => ({ nextId: state.nextId + 1 }));
        return String(id);
      },
      setStatusFilter: (slug: StatusFilterSlug) => set({ statusFilter: slug }),
      setCategoryFilter: (slug: CategoryFilterSlug) =>
        set({ categoryFilter: slug }),
      addSubscription: (subscription: Subscription) => {
        set((state) => {
          const now = new Date().toISOString();
          const initialLog: ActivityLogEntry[] =
            subscription.activity_log && subscription.activity_log.length > 0
              ? subscription.activity_log
              : [
                  {
                    id: `${Date.now()}-subscribe`,
                    type: 'subscribe',
                    action: 'Subscription created',
                    detail: subscription.source,
                    timestamp: now,
                  },
                  {
                    id: `${Date.now()}-check`,
                    type: 'check',
                    action: 'Initial scrape started',
                    detail: subscription.sourceUrl,
                    timestamp: now,
                  },
                ];
          const nextSubs = [
            ...state.subscriptions,
            { ...subscription, activity_log: initialLog },
          ];
          return {
            subscriptions: nextSubs,
            scheduledChannels: syncScheduledChannels(nextSubs),
          };
        });
      },
      removeSubscription: (subscriptionId: string) => {
        set((state) => {
          const nextSubs = state.subscriptions.filter(
            (sub) => sub.id !== subscriptionId,
          );
          return {
            subscriptions: nextSubs,
            scheduledChannels: syncScheduledChannels(nextSubs),
          };
        });
      },
      updateSubscription: (
        subscriptionId: string,
        subscription: Subscription,
      ) => {
        set((state) => {
          const nextSubs = state.subscriptions.map((sub) =>
            sub.id === subscriptionId ? subscription : sub,
          );
          return {
            subscriptions: nextSubs,
            scheduledChannels: syncScheduledChannels(nextSubs),
          };
        });
      },
      getSubscription: (subscriptionId: string) => {
        return get().subscriptions.find((sub) => sub.id === subscriptionId);
      },
      getSubscriptions: () => get().subscriptions,
      getFilteredSubscriptions: () => {
        const { subscriptions, statusFilter, categoryFilter } = get();
        return filterSubscriptionsByStatusAndCategory(
          subscriptions,
          statusFilter,
          categoryFilter,
        );
      },
      addScheduledChannel: (channel: ScheduledChannel) => {
        get().addSubscription(channelToSubscription(channel));
      },
      removeScheduledChannel: (channelId: string) => {
        get().removeSubscription(channelId);
      },
      updateScheduledChannel: (
        channelId: string,
        channel: ScheduledChannel,
      ) => {
        get().updateSubscription(channelId, channelToSubscription(channel));
      },
      getScheduledChannel: (channelId: string) => {
        const sub = get().getSubscription(channelId);
        return sub ? subscriptionToChannel(sub) : undefined;
      },
      getScheduledChannels: () => get().scheduledChannels,
      getFilteredScheduledChannels: () => {
        const { scheduledChannels, statusFilter, categoryFilter } = get();
        return filterChannelsByStatusAndCategory(
          scheduledChannels,
          statusFilter,
          categoryFilter,
        );
      },
      addDownloadToSubscription: (
        subscriptionId: string,
        input: SubscriptionDownloadInput,
      ) => {
        const sub = get().getSubscription(subscriptionId);
        if (!sub) return;
        const now = new Date().toISOString();
        const download: Download = {
          id: input.id,
          status: input.status ?? 'queued',
          name: input.name,
          thumbnail_location: input.thumbnail_location ?? '',
          size: input.size ?? '',
          speed: input.speed ?? '',
          date_added: now,
          video_location: input.video_location,
        };
        const logEntry: ActivityLogEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'download',
          action: 'Download queued',
          detail: input.name,
          timestamp: now,
        };
        const updated: Subscription = {
          ...sub,
          downloads: [...sub.downloads, download],
          activity_log: [...(sub.activity_log ?? []), logEntry],
        };
        get().updateSubscription(subscriptionId, updated);
      },
      updateSubscriptionDownload: (
        subscriptionId: string,
        downloadId: string,
        updates: Partial<Download>,
      ) => {
        const sub = get().getSubscription(subscriptionId);
        if (!sub) return;
        const downloads = sub.downloads.map((d) =>
          d.id === downloadId ? { ...d, ...updates } : d,
        );
        // Auto-log status transitions
        const newStatus = updates.status?.toLowerCase();
        let logEntry: ActivityLogEntry | null = null;
        if (newStatus) {
          const existing = sub.downloads.find((d) => d.id === downloadId);
          const now = new Date().toISOString();
          if (newStatus === 'completed') {
            logEntry = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              type: 'download',
              action: 'Download completed',
              detail: existing?.name,
              timestamp: now,
            };
          } else if (newStatus === 'error' || newStatus === 'failed') {
            logEntry = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              type: 'error',
              action: 'Download failed',
              detail: existing?.name,
              timestamp: now,
            };
          }
        }
        const activity_log = logEntry
          ? [...(sub.activity_log ?? []), logEntry]
          : sub.activity_log;
        get().updateSubscription(subscriptionId, {
          ...sub,
          downloads,
          activity_log,
        });
      },
      removeSubscriptionDownload: (
        subscriptionId: string,
        downloadId: string,
      ) => {
        const sub = get().getSubscription(subscriptionId);
        if (!sub) return;
        const downloads = sub.downloads.filter((d) => d.id !== downloadId);
        get().updateSubscription(subscriptionId, { ...sub, downloads });
      },
      clearSubscriptions: () => {
        set({ subscriptions: [], scheduledChannels: [] });
      },
      addActivityLogEntry: (
        subscriptionId: string,
        entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>,
      ) => {
        const sub = get().getSubscription(subscriptionId);
        if (!sub) return;
        const full: ActivityLogEntry = {
          ...entry,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toISOString(),
        };
        get().updateSubscription(subscriptionId, {
          ...sub,
          activity_log: [...(sub.activity_log ?? []), full],
        });
      },
      clearActivityLog: (subscriptionId: string) => {
        const sub = get().getSubscription(subscriptionId);
        if (!sub) return;
        get().updateSubscription(subscriptionId, {
          ...sub,
          activity_log: [],
        });
      },
      tickScheduleChecks: () => {
        const now = new Date();
        const state = get();
        let changed = false;
        const nextSubs = state.subscriptions.map((sub) => {
          const dateCreated = sub.date_created
            ? new Date(sub.date_created)
            : new Date(0);

          const mostRecent = getMostRecentPassedSlotTime(sub, now, dateCreated);
          if (!mostRecent) return sub;
          const currentLastChecked = sub.last_checked_time
            ? new Date(sub.last_checked_time)
            : new Date(0);
          if (mostRecent > currentLastChecked) {
            changed = true;
            return { ...sub, last_checked_time: mostRecent.toISOString() };
          }
          return sub;
        });
        if (changed) {
          set({
            subscriptions: nextSubs,
            scheduledChannels: syncScheduledChannels(nextSubs),
          });
        }
      },
      startScheduleTicker: () => {
        if (_scheduleTicker !== null) return;
        get().tickScheduleChecks();
        _scheduleTicker = setInterval(() => {
          get().tickScheduleChecks();
        }, 60 * 1000);
      },
      stopScheduleTicker: () => {
        if (_scheduleTicker !== null) {
          clearInterval(_scheduleTicker);
          _scheduleTicker = null;
        }
      },
      pendingSubscribeUrl: null,
      setPendingSubscribeUrl: (url) => set({ pendingSubscribeUrl: url }),
      scrapingChannels: new Map(),
      setChannelScraping: (channelId: number, name: string) => {
        set((state) => {
          const newMap = new Map(state.scrapingChannels);
          newMap.set(channelId, { name, status: 'Analyzing channel...' });
          return { scrapingChannels: newMap };
        });
      },
      updateChannelScrapingStatus: (channelId: number, status: string) => {
        set((state) => {
          const newMap = new Map(state.scrapingChannels);
          const current = newMap.get(channelId);
          if (current) {
            newMap.set(channelId, { ...current, status });
          }
          return { scrapingChannels: newMap };
        });
      },
      removeChannelScraping: (channelId: number) => {
        set((state) => {
          const newMap = new Map(state.scrapingChannels);
          newMap.delete(channelId);
          return { scrapingChannels: newMap };
        });
      },
      analyzingChannel: null,
      analyzingStatus: 'idle',
      isAnalyzingDismissed: false,
      startChannelAnalysis: (url, isYouTube) =>
        set({ analyzingChannel: { url, isYouTube }, analyzingStatus: 'analyzing', isAnalyzingDismissed: false }),
      finishChannelAnalysis: () => set({ analyzingStatus: 'done' }),
      clearChannelAnalysis: () => set({ analyzingChannel: null, analyzingStatus: 'idle', isAnalyzingDismissed: false }),
      setAnalyzingDismissed: (val) => set({ isAnalyzingDismissed: val }),
      pendingAnalysisData: null,
      setPendingAnalysisData: (data) => set({ pendingAnalysisData: data }),
      selectedChannelIds: [],
      toggleChannelSelection: (id: string) => {
        set((state) => {
          const exists = state.selectedChannelIds.includes(id);
          return {
            selectedChannelIds: exists
              ? state.selectedChannelIds.filter((x) => x !== id)
              : [...state.selectedChannelIds, id],
          };
        });
      },
      selectAllChannels: (ids: string[]) => set({ selectedChannelIds: ids }),
      clearSelection: () => set({ selectedChannelIds: [] }),
      bulkDeleteSubscriptions: async (ids: string[]) => {
        const bridge = window.skedulosaBridge;
        for (const id of ids) {
          const sub = get().getSubscription(id);
          get().removeSubscription(id);
          if (bridge && sub) {
            const calls: Promise<unknown>[] = [];
            if (sub.toolkit_channel_id != null)
              calls.push(bridge.deleteChannel(sub.toolkit_channel_id));
            if (sub.toolkit_schedule_id != null)
              calls.push(bridge.deleteSchedule(sub.toolkit_schedule_id));
            if (calls.length > 0) {
              await Promise.all(calls).catch((err) =>
                console.error('[skedulosaStore] bulkDelete bridge failed:', err),
              );
            }
          }
        }
        set({ selectedChannelIds: [] });
      },
      bulkPauseSubscriptions: async (ids: string[]) => {
        const bridge = window.skedulosaBridge;
        for (const id of ids) {
          const sub = get().getSubscription(id);
          if (!sub) continue;
          if (sub.toolkit_channel_id != null) {
            await bridge
              ?.setChannelActive(sub.toolkit_channel_id, false)
              .catch((err) =>
                console.error('[skedulosaStore] bulkPause bridge failed:', err),
              );
          }
          const freshSub = get().getSubscription(id);
          if (freshSub) get().updateSubscription(id, { ...freshSub, status: 'Paused' });
        }
        set({ selectedChannelIds: [] });
      },
      bulkResumeSubscriptions: async (ids: string[]) => {
        const bridge = window.skedulosaBridge;
        for (const id of ids) {
          const sub = get().getSubscription(id);
          if (!sub) continue;
          if (sub.toolkit_channel_id != null) {
            await bridge
              ?.setChannelActive(sub.toolkit_channel_id, true)
              .catch((err) =>
                console.error('[skedulosaStore] bulkResume bridge failed:', err),
              );
          }
          const freshSub = get().getSubscription(id);
          if (freshSub) get().updateSubscription(id, { ...freshSub, status: 'Active' });
        }
        set({ selectedChannelIds: [] });
      },
      selectedHistoryIds: [],
      toggleHistorySelection: (id: string) => {
        set((state) => {
          const exists = state.selectedHistoryIds.includes(id);
          return {
            selectedHistoryIds: exists
              ? state.selectedHistoryIds.filter((x) => x !== id)
              : [...state.selectedHistoryIds, id],
          };
        });
      },
      selectAllHistory: (ids: string[]) => set({ selectedHistoryIds: ids }),
      clearHistorySelection: () => set({ selectedHistoryIds: [] }),
      bulkDeleteHistoryDownloads: (ids: string[]) => {
        for (const compositeId of ids) {
          const colonIdx = compositeId.indexOf(':');
          const subscriptionId = compositeId.slice(0, colonIdx);
          const downloadId = compositeId.slice(colonIdx + 1);
          get().removeSubscriptionDownload(subscriptionId, downloadId);
        }
        set({ selectedHistoryIds: [] });
      },
    }),
    {
      name: 'skedulosa-storage',
      storage: createJSONStorage(() =>
        createIndexedDBStorageWithMigration({
          dbName: 'downlodr-database',
          storeName: 'zustand-storage',
          version: 1,
          localStorageKey: 'skedulosa-storage',
        }),
      ),
      partialize: (state) => ({
        subscriptions: state.subscriptions,
        nextId: state.nextId,
      }),
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.error('[skedulosa] Error rehydrating store:', error);
          } else {
            // Rebuild derived scheduledChannels from persisted subscriptions
            if (state && state.subscriptions.length > 0) {
              state.scheduledChannels = syncScheduledChannels(
                state.subscriptions,
              );
            }
            console.log('[skedulosa] Successfully rehydrated store');
            // Kick off the schedule ticker so last_checked_time stays current
            state?.startScheduleTicker();
          }
        };
      },
    },
  ),
);
