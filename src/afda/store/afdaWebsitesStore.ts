import { create } from 'zustand';
import type { Website } from '@/afda/backend/afda-backend/src/types';
import type { ScheduledChannel } from '@/skedulosa/store/skedulosaStore';

// ─── Social source support ─────────────────────────────────────────────────
// Social sources (X / Reddit / Facebook / YouTube) live in a separate backend
// table and have no sections/mapper. To show them in the same subscriptions
// list we map each into a synthetic Website carrying an app-only discriminator
// (`kind`/`socialId`). Row-action code branches on `kind === 'social'`.
export type WebsiteListItem = Website & {
  kind?: 'website' | 'social';
  /** Numeric social_sources.id (only set when kind === 'social'). */
  socialId?: number;
  /** Platform key for social rows: x | reddit | youtube | fb. */
  socialPlatform?: string;
  /** accounts.json username, if any (social rows only). */
  socialAccount?: string | null;
  /** schedule_value preset for social rows, e.g. "every_1h". */
  socialPreset?: string | null;
};

interface SocialSourceRow {
  id: number;
  url: string;
  handle: string;
  platform: string;
  label: string;
  account: string | null;
  enabled: number;
  schedule_type: string | null;
  schedule_value: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

const SOCIAL_PLATFORM_DOMAIN: Record<string, string> = {
  x: 'x.com',
  reddit: 'reddit.com',
  youtube: 'youtube.com',
  fb: 'facebook.com',
};

/** Map a raw social_sources row into a synthetic Website for the list. */
export function socialSourceToWebsite(row: SocialSourceRow): WebsiteListItem {
  let preset: string | null = null;
  if (row.schedule_value) {
    try {
      const cfg = JSON.parse(row.schedule_value) as { preset?: string };
      preset = cfg?.preset ?? null;
    } catch {
      preset = null;
    }
  }
  return {
    // Synthetic Website fields
    id: `social-${row.id}`,
    name: row.label || row.handle,
    url: row.url,
    domain: SOCIAL_PLATFORM_DOMAIN[row.platform] ?? row.platform,
    favicon: null,
    logoPath: null,
    description: '',
    type: 'free',
    status: row.enabled === 1 ? 'active' : 'paused',
    isScrapingNow: false,
    sections: [],
    // auth is required by the type; social uses its own account field instead.
    auth: {
      source: 'none',
      partition: null,
      status: 'none',
      lastLoginAt: null,
      lastValidatedAt: null,
      validateUrl: null,
      replayMode: 'disabled',
      hasRecording: false,
      recordingStepCount: null,
      recordingRecordedAt: null,
      lastReplayAt: null,
      lastReplayOk: null,
    } as Website['auth'],
    createdAt: row.created_at,
    lastScrapedAt: row.last_run_at,
    nextScrapeAt: row.next_run_at,
    paginationMethod: null,
    paginationDetails: null,
    lookbackMode: null,
    lookbackValue: null,
    ignorePatterns: [],
    storageMb: null,
    mapperMetadata: null,
    // App-only discriminator
    kind: 'social',
    socialId: row.id,
    socialPlatform: row.platform,
    socialAccount: row.account,
    socialPreset: preset,
  };
}

const STATUS_MAP: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  error: 'Error',
  idle: 'Active',
};

const DAY_NUM_TO_ABBREV: Record<number, string> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
};

export function websiteToScheduledChannel(website: Website): ScheduledChannel {
  // Derive a representative cadence from sections' frequencyInterval
  const intervals = website.sections
    .map((s) => s.frequencyInterval)
    .filter(Boolean);
  const uploadCadence = intervals[0] ?? 'Daily';

  // Build one schedule entry per enabled section that has scheduled days
  const scheduleEntries = website.sections
    .filter((s) => s.enabled && s.scheduledDays.length > 0)
    .map((s) => ({
      scheduleId: s.id,
      timezone: s.scheduleIntervals[0]?.timezone ?? 'UTC',
      daysTocheck: s.scheduledDays.map((d) => DAY_NUM_TO_ABBREV[d] ?? ''),
      timeToCheck: String(s.scheduleIntervals[0]?.from ?? 0),
      qualityPreset: '',
      lookbackPeriod: '',
      saveLocation: '',
    }));

  // Fallback: at least one entry so the row renders
  if (scheduleEntries.length === 0) {
    scheduleEntries.push({
      scheduleId: website.id,
      timezone: 'UTC',
      daysTocheck: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      timeToCheck: '0',
      qualityPreset: '',
      lookbackPeriod: '',
      saveLocation: '',
    });
  }

  return {
    channelId: website.id,
    channelName: website.name,
    channelUrl: website.url,
    schedule: scheduleEntries,
    status: STATUS_MAP[website.status] ?? 'Active',
    category: 'afda-website',
    id: website.id,
    downloads: [],
    schedule_time: [],
    last_checked_time: website.lastScrapedAt ?? website.createdAt,
    source: website.domain,
    sourceUrl: website.url,
    recurring: true,
    date_created: website.createdAt,
    upload_cadence: uploadCadence,
    settings: [],
  };
}

interface AfdaWebsitesStore {
  websites: WebsiteListItem[];
  /** Replace only the article-website rows; preserve any social rows. */
  hydrate: (websites: WebsiteListItem[]) => void;
  /** Replace only the social rows; preserve any article-website rows. */
  hydrateSocial: (social: WebsiteListItem[]) => void;
  addWebsite: (website: WebsiteListItem) => void;
  updateWebsite: (website: WebsiteListItem) => void;
  removeWebsite: (id: string) => void;
}

export const useAfdaWebsitesStore = create<AfdaWebsitesStore>((set) => ({
  websites: [],

  // Hydration of article websites must not drop social rows (they come from a
  // separate backend call), so merge by kind rather than blindly replacing.
  hydrate: (websites) =>
    set((s) => ({
      websites: [
        ...websites,
        ...s.websites.filter((w) => w.kind === 'social'),
      ],
    })),

  hydrateSocial: (social) =>
    set((s) => ({
      websites: [
        ...s.websites.filter((w) => w.kind !== 'social'),
        ...social,
      ],
    })),

  addWebsite: (website) =>
    set((s) => ({
      websites: s.websites.some((w) => w.id === website.id)
        ? s.websites.map((w) => (w.id === website.id ? website : w))
        : [...s.websites, website],
    })),

  updateWebsite: (website) =>
    set((s) => ({
      websites: s.websites.map((w) => (w.id === website.id ? website : w)),
    })),

  removeWebsite: (id) =>
    set((s) => ({ websites: s.websites.filter((w) => w.id !== id) })),
}));
