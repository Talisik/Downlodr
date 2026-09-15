// src/afda/store/afdaStore.tsx
import { createIndexedDBStorageWithMigration } from '@/core-app/utils/indexedDBStorage';
import {
  ActivityLogEntry,
  Download,
  ScheduleDay,
  ScheduleEntry,
  ScheduledChannel,
  StatusFilterSlug,
  SubscriptionDownloadInput,
} from '@/skedulosa/store/skedulosaStore';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AfdaSubscription } from '../types/afdaTypes';

const DAY_TO_ABBREV: Record<ScheduleDay, string> = {
  Sunday: 'sun',
  Monday: 'mon',
  Tuesday: 'tue',
  Wednesday: 'wed',
  Thursday: 'thu',
  Friday: 'fri',
  Saturday: 'sat',
};

/** Convert an AfdaSubscription to the legacy ScheduledChannel shape so it
 *  can be merged into skedulosa pages that still use ScheduledChannel[].
 *  Note: ScheduleEntry has a single timeToCheck string, so only the first
 *  schedule slot's time is used — multi-slot times on different days are
 *  represented by day abbreviations but share the same time value. */
export function afdaSubscriptionToScheduledChannel(
  afda: AfdaSubscription,
): ScheduledChannel {
  const firstSlotMinutes = afda.schedule_time?.[0]?.time_minutes;
  const timeToCheck =
    firstSlotMinutes !== undefined
      ? String(Math.floor(firstSlotMinutes / 60) % 24)
      : '0';

  const daysTocheck =
    afda.schedule_time?.map((t) => DAY_TO_ABBREV[t.day]) ?? [];

  const scheduleEntry: ScheduleEntry = {
    scheduleId: afda.id,
    timezone: 'UTC',
    daysTocheck,
    timeToCheck,
    qualityPreset: afda.settings[0]?.download_quality ?? '',
    lookbackPeriod: afda.settings[0]?.lookback_period ?? '',
    saveLocation: afda.settings[0]?.save_location ?? '',
  };

  return {
    channelId: afda.id,
    channelName: afda.source,
    channelUrl: afda.sourceUrl,
    schedule: [scheduleEntry],
    status: afda.status,
    category: 'afda',
    id: afda.id,
    downloads: afda.downloads,
    schedule_time: afda.schedule_time,
    last_checked_time: afda.last_checked_time,
    source: afda.source,
    sourceUrl: afda.sourceUrl,
    recurring: afda.recurring,
    date_created: afda.date_created,
    upload_cadence: afda.upload_cadence,
    settings: afda.settings,
  };
}

interface AfdaStoreState {
  afdaSubscriptions: AfdaSubscription[];
  nextId: number;
  statusFilter: StatusFilterSlug;
  searchQuery: string;
  selectedChannelIds: string[];

  getNextId: () => string;
  setStatusFilter: (slug: StatusFilterSlug) => void;
  setSearchQuery: (q: string) => void;

  addAfdaSubscription: (sub: AfdaSubscription) => void;
  removeAfdaSubscription: (id: string) => void;
  updateAfdaSubscription: (id: string, sub: AfdaSubscription) => void;
  getAfdaSubscription: (id: string) => AfdaSubscription | undefined;

  addDownloadToAfdaSubscription: (
    subscriptionId: string,
    input: SubscriptionDownloadInput,
  ) => void;
  updateAfdaSubscriptionDownload: (
    subscriptionId: string,
    downloadId: string,
    updates: Partial<Download>,
  ) => void;
  removeAfdaSubscriptionDownload: (
    subscriptionId: string,
    downloadId: string,
  ) => void;

  addActivityLogEntry: (
    subscriptionId: string,
    entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>,
  ) => void;
  clearActivityLog: (subscriptionId: string) => void;

  toggleChannelSelection: (id: string) => void;
  selectAllChannels: (ids: string[]) => void;
  clearSelection: () => void;

  bulkDeleteAfdaSubscriptions: (ids: string[]) => void;
  bulkPauseAfdaSubscriptions: (ids: string[]) => void;
  bulkResumeAfdaSubscriptions: (ids: string[]) => void;
}

export const useAfdaSubscriptionsStore = create<AfdaStoreState>()(
  persist(
    (set, get) => ({
      afdaSubscriptions: [],
      nextId: 1,
      statusFilter: 'all',
      searchQuery: '',
      selectedChannelIds: [],

      getNextId: () => {
        const id = get().nextId;
        set((state) => ({ nextId: state.nextId + 1 }));
        return `afda-${id}`;
      },

      setStatusFilter: (slug) => set({ statusFilter: slug }),
      setSearchQuery: (q) => set({ searchQuery: q }),

      addAfdaSubscription: (sub) => {
        const now = new Date().toISOString();
        const initialLog: ActivityLogEntry[] =
          sub.activity_log && sub.activity_log.length > 0
            ? sub.activity_log
            : [
                {
                  id: `${Date.now()}-subscribe`,
                  type: 'subscribe',
                  action: 'Subscription created',
                  detail: sub.source,
                  timestamp: now,
                },
              ];
        set((state) => ({
          afdaSubscriptions: [
            ...state.afdaSubscriptions,
            { ...sub, activity_log: initialLog },
          ],
        }));
      },

      removeAfdaSubscription: (id) =>
        set((state) => ({
          afdaSubscriptions: state.afdaSubscriptions.filter((s) => s.id !== id),
        })),

      updateAfdaSubscription: (id, sub) =>
        set((state) => ({
          afdaSubscriptions: state.afdaSubscriptions.map((s) =>
            s.id === id ? sub : s,
          ),
        })),

      getAfdaSubscription: (id) =>
        get().afdaSubscriptions.find((s) => s.id === id),

      addDownloadToAfdaSubscription: (subscriptionId, input) => {
        const now = new Date().toISOString();
        const download: Download = {
          id: input.id,
          name: input.name,
          thumbnail_location: input.thumbnail_location ?? '',
          size: input.size ?? '',
          speed: input.speed ?? '',
          status: input.status ?? 'queued',
          date_added: now,
          video_location: input.video_location,
        };
        set((state) => ({
          afdaSubscriptions: state.afdaSubscriptions.map((s) =>
            s.id === subscriptionId
              ? { ...s, downloads: [...s.downloads, download] }
              : s,
          ),
        }));
      },

      updateAfdaSubscriptionDownload: (subscriptionId, downloadId, updates) =>
        set((state) => ({
          afdaSubscriptions: state.afdaSubscriptions.map((s) =>
            s.id === subscriptionId
              ? {
                  ...s,
                  downloads: s.downloads.map((d) =>
                    d.id === downloadId ? { ...d, ...updates } : d,
                  ),
                }
              : s,
          ),
        })),

      removeAfdaSubscriptionDownload: (subscriptionId, downloadId) =>
        set((state) => ({
          afdaSubscriptions: state.afdaSubscriptions.map((s) =>
            s.id === subscriptionId
              ? {
                  ...s,
                  downloads: s.downloads.filter((d) => d.id !== downloadId),
                }
              : s,
          ),
        })),

      addActivityLogEntry: (subscriptionId, entry) => {
        const full: ActivityLogEntry = {
          ...entry,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          afdaSubscriptions: state.afdaSubscriptions.map((s) =>
            s.id === subscriptionId
              ? {
                  ...s,
                  activity_log: [...(s.activity_log ?? []), full],
                }
              : s,
          ),
        }));
      },

      clearActivityLog: (subscriptionId) =>
        set((state) => ({
          afdaSubscriptions: state.afdaSubscriptions.map((s) =>
            s.id === subscriptionId ? { ...s, activity_log: [] } : s,
          ),
        })),

      toggleChannelSelection: (id) =>
        set((state) => {
          const exists = state.selectedChannelIds.includes(id);
          return {
            selectedChannelIds: exists
              ? state.selectedChannelIds.filter((x) => x !== id)
              : [...state.selectedChannelIds, id],
          };
        }),

      selectAllChannels: (ids) => set({ selectedChannelIds: ids }),
      clearSelection: () => set({ selectedChannelIds: [] }),

      bulkDeleteAfdaSubscriptions: (ids) => {
        const idSet = new Set(ids);
        set((state) => ({
          afdaSubscriptions: state.afdaSubscriptions.filter(
            (s) => !idSet.has(s.id),
          ),
          selectedChannelIds: [],
        }));
      },

      bulkPauseAfdaSubscriptions: (ids) => {
        const idSet = new Set(ids);
        set((state) => ({
          afdaSubscriptions: state.afdaSubscriptions.map((s) =>
            idSet.has(s.id) ? { ...s, status: 'Paused' } : s,
          ),
          selectedChannelIds: [],
        }));
      },

      bulkResumeAfdaSubscriptions: (ids) => {
        const idSet = new Set(ids);
        set((state) => ({
          afdaSubscriptions: state.afdaSubscriptions.map((s) =>
            idSet.has(s.id) ? { ...s, status: 'Active' } : s,
          ),
          selectedChannelIds: [],
        }));
      },
    }),
    {
      name: 'afda-storage',
      storage: createJSONStorage(() =>
        createIndexedDBStorageWithMigration({
          dbName: 'downlodr-database',
          storeName: 'zustand-storage',
          version: 1,
          localStorageKey: 'afda-storage',
        }),
      ),
      partialize: (state) => ({
        afdaSubscriptions: state.afdaSubscriptions,
        nextId: state.nextId,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) console.error('[afda] Error rehydrating store:', error);
      },
    },
  ),
);
