import { create } from 'zustand';
import type { Website } from '@/afda/backend/afda-backend/src/types';
import type { ScheduledChannel } from '@/skedulosa/store/skedulosaStore';

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
  websites: Website[];
  hydrate: (websites: Website[]) => void;
  addWebsite: (website: Website) => void;
  updateWebsite: (website: Website) => void;
  removeWebsite: (id: string) => void;
}

export const useAfdaWebsitesStore = create<AfdaWebsitesStore>((set) => ({
  websites: [],

  hydrate: (websites) => set({ websites }),

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
