# AFDA Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a separate `src/afda/` Zustand store for article subscriptions and merge its data into existing skedulosa pages so YouTube and article items appear in the same tables, filtered by a new `'afda'` category.

**Architecture:** AFDA lives entirely in `src/afda/` (types + store). The skedulosa pages pull from both stores and merge in `useMemo`. The legacy `ScheduledChannel` adapter pattern used by the subscription and schedule pages is reused for AFDA by providing an `afdaSubscriptionToScheduledChannel` helper. The history page merges at the `Subscription[]` level. The only skedulosa store change is expanding `CategoryFilterSlug` and `CATEGORY_FILTER_OPTIONS` to include `'afda'`.

**Tech Stack:** Zustand with `persist` + `createJSONStorage`, IndexedDB via `createIndexedDBStorageWithMigration`, React `useMemo`, TypeScript, Tailwind CSS.

> **Note:** This project has no test runner configured (`CLAUDE.md`). Test steps are omitted; manually verify by running `yarn start` and checking the skedulosa pages render correctly with and without AFDA subscriptions in the store.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/afda/types/afdaTypes.ts` | `AfdaSectionDetails`, `AfdaSubscription` types |
| Create | `src/afda/store/afdaStore.tsx` | Zustand store + `afdaSubscriptionToScheduledChannel` helper |
| Modify | `src/skedulosa/store/skedulosaStore.tsx` | Add `'afda'` to `CategoryFilterSlug` + `CATEGORY_FILTER_OPTIONS` |
| Modify | `src/skedulosa/pages/SkedulosaSubscriptionPage.tsx` | Merge AFDA channels; add Article badge |
| Modify | `src/skedulosa/pages/SkedulosaSchedulePage.tsx` | Merge AFDA channels; add Article badge |
| Modify | `src/skedulosa/pages/SkedulosaHistoryPage.tsx` | Merge AFDA downloads |

---

## Task 1: Create AFDA types

**Files:**
- Create: `src/afda/types/afdaTypes.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/afda/types/afdaTypes.ts
import type {
  ActivityLogEntry,
  Download,
  ScheduleTime,
  SubscriptionSettings,
} from '@/skedulosa/store/skedulosaStore';

export interface AfdaSectionDetails {
  sectionName: string;
  sectionUrl: string;
  articleCount?: number;
  site?: string;
}

export interface AfdaSubscription {
  id: string;
  source_type: 'afda';
  downloads: Download[];
  schedule_time: ScheduleTime[];
  last_checked_time: string;
  /** Display name of the section or publication. */
  source: string;
  /** Section URL used for fetching articles. */
  sourceUrl: string;
  recurring: boolean;
  status: string;
  date_created: string;
  upload_cadence: string;
  settings: SubscriptionSettings[];
  /** Section metadata fetched at subscribe time. */
  section_details?: AfdaSectionDetails;
  /** Chronological log of events for this subscription. */
  activity_log?: ActivityLogEntry[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `yarn lint`
Expected: no new errors related to `src/afda/types/afdaTypes.ts`

- [ ] **Step 3: Commit**

```bash
git add src/afda/types/afdaTypes.ts
git commit -m "feat(afda): add AfdaSubscription and AfdaSectionDetails types"
```

---

## Task 2: Create AFDA store

**Files:**
- Create: `src/afda/store/afdaStore.tsx`

- [ ] **Step 1: Create the store file**

```tsx
// src/afda/store/afdaStore.tsx
import { createIndexedDBStorageWithMigration } from '@/core-app/utils/indexedDBStorage';
import {
  ActivityLogEntry,
  Download,
  ScheduleDay,
  ScheduleEntry,
  ScheduledChannel,
  ScheduleTime,
  StatusFilterSlug,
  SubscriptionDownloadInput,
} from '@/skedulosa/store/skedulosaStore';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AfdaSubscription } from '../types/afdaTypes';

/** Convert an AfdaSubscription to the legacy ScheduledChannel shape so it
 *  can be merged into skedulosa pages that still use ScheduledChannel[]. */
export function afdaSubscriptionToScheduledChannel(
  afda: AfdaSubscription,
): ScheduledChannel {
  const firstSlotMinutes = afda.schedule_time?.[0]?.time_minutes;
  const timeToCheck =
    firstSlotMinutes !== undefined
      ? String(Math.floor(firstSlotMinutes / 60) % 24)
      : '0';

  const DAY_TO_ABBREV: Record<ScheduleDay, string> = {
    Sunday: 'sun',
    Monday: 'mon',
    Tuesday: 'tue',
    Wednesday: 'wed',
    Thursday: 'thu',
    Friday: 'fri',
    Saturday: 'sat',
  };
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

export const useAfdaStore = create<AfdaStoreState>()(
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
        for (const id of ids) {
          get().removeAfdaSubscription(id);
        }
        set({ selectedChannelIds: [] });
      },

      bulkPauseAfdaSubscriptions: (ids) => {
        for (const id of ids) {
          const sub = get().getAfdaSubscription(id);
          if (sub) get().updateAfdaSubscription(id, { ...sub, status: 'Paused' });
        }
        set({ selectedChannelIds: [] });
      },

      bulkResumeAfdaSubscriptions: (ids) => {
        for (const id of ids) {
          const sub = get().getAfdaSubscription(id);
          if (sub) get().updateAfdaSubscription(id, { ...sub, status: 'Active' });
        }
        set({ selectedChannelIds: [] });
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
    },
  ),
);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `yarn lint`
Expected: no errors in `src/afda/`

- [ ] **Step 3: Commit**

```bash
git add src/afda/store/afdaStore.tsx
git commit -m "feat(afda): create AFDA Zustand store with IndexedDB persistence"
```

---

## Task 3: Extend skedulosa category filter to include 'afda'

**Files:**
- Modify: `src/skedulosa/store/skedulosaStore.tsx` (lines 158, 209–217)

- [ ] **Step 1: Update `CategoryFilterSlug` type**

In `src/skedulosa/store/skedulosaStore.tsx`, find:
```ts
export type CategoryFilterSlug = 'all' | 'youtube';
```
Replace with:
```ts
export type CategoryFilterSlug = 'all' | 'youtube' | 'afda';
```

- [ ] **Step 2: Add AFDA option to `CATEGORY_FILTER_OPTIONS`**

Find:
```ts
export const CATEGORY_FILTER_OPTIONS: CategoryFilterOption[] = [
  { id: 'all', label: 'All', slug: 'all' },
  {
    id: 'youtube',
    label: 'Youtube',
    slug: 'youtube',
    iconClassName: 'text-green-500',
  },
];
```
Replace with:
```ts
export const CATEGORY_FILTER_OPTIONS: CategoryFilterOption[] = [
  { id: 'all', label: 'All', slug: 'all' },
  {
    id: 'youtube',
    label: 'Youtube',
    slug: 'youtube',
    iconClassName: 'text-green-500',
  },
  {
    id: 'afda',
    label: 'Articles',
    slug: 'afda',
    iconClassName: 'text-blue-500',
  },
];
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `yarn lint`
Expected: no errors — the `filterChannelsByStatusAndCategory` function already handles the `'afda'` slug correctly because it checks `(ch.category ?? 'youtube').toLowerCase() === categoryFilter`, and AFDA channels will have `category: 'afda'` set by `afdaSubscriptionToScheduledChannel`.

- [ ] **Step 4: Commit**

```bash
git add src/skedulosa/store/skedulosaStore.tsx
git commit -m "feat(afda): add 'afda' category to skedulosa filter slug and options"
```

---

## Task 4: Merge AFDA into SkedulosaSubscriptionPage

**Files:**
- Modify: `src/skedulosa/pages/SkedulosaSubscriptionPage.tsx`

- [ ] **Step 1: Import the AFDA store**

At the top of `src/skedulosa/pages/SkedulosaSubscriptionPage.tsx`, after the existing imports, add:

```tsx
import {
  useAfdaStore,
  afdaSubscriptionToScheduledChannel,
} from '@/afda/store/afdaStore';
```

- [ ] **Step 2: Read AFDA subscriptions in the component**

Inside `SkedulosaSubscriptionPage`, after the line:
```tsx
const scheduledChannels = useSkedulosaStore((s) => s.scheduledChannels);
```
Add:
```tsx
const afdaSubscriptions = useAfdaStore((s) => s.afdaSubscriptions);
```

- [ ] **Step 3: Merge AFDA into allChannels**

After `const storageMap = useMemo(...)`, add:

```tsx
const allChannels = useMemo(
  () => [
    ...scheduledChannels,
    ...afdaSubscriptions.map(afdaSubscriptionToScheduledChannel),
  ],
  [scheduledChannels, afdaSubscriptions],
);
```

- [ ] **Step 4: Update filteredChannels to use allChannels**

Find:
```tsx
const filteredChannels = useMemo(() => {
    let channels = filterChannelsByStatusAndCategory(
      scheduledChannels,
      statusFilter,
      categoryFilter,
    );
```
Replace `scheduledChannels` (first argument only) with `allChannels`:
```tsx
const filteredChannels = useMemo(() => {
    let channels = filterChannelsByStatusAndCategory(
      allChannels,
      statusFilter,
      categoryFilter,
    );
```
Also update the `useMemo` dependency array — replace `scheduledChannels` with `allChannels`:
```tsx
  ], [
    allChannels,
    statusFilter,
    categoryFilter,
    searchQuery,
    sortField,
    sortDirection,
    storageMap,
  ]);
```

- [ ] **Step 5: Add a type badge to the subscription name cell**

Find the JSX that renders the channel name in the table row. It will contain `ch.channelName` (or similar). Add a badge after the channel name:

```tsx
{ch.category === 'afda' && (
  <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium flex-shrink-0">
    Article
  </span>
)}
```

- [ ] **Step 6: Verify TypeScript and run dev server**

Run: `yarn lint`
Run: `yarn start`
Open the skedulosa Subscription page. Confirm:
- Existing YouTube subscriptions still render
- The "Articles" category filter appears in the sidebar
- (No AFDA data yet — empty state is expected)

- [ ] **Step 7: Commit**

```bash
git add src/skedulosa/pages/SkedulosaSubscriptionPage.tsx
git commit -m "feat(afda): merge AFDA subscriptions into SkedulosaSubscriptionPage"
```

---

## Task 5: Merge AFDA into SkedulosaSchedulePage

**Files:**
- Modify: `src/skedulosa/pages/SkedulosaSchedulePage.tsx`

- [ ] **Step 1: Import the AFDA store**

At the top of `src/skedulosa/pages/SkedulosaSchedulePage.tsx`, after existing imports, add:

```tsx
import {
  useAfdaStore,
  afdaSubscriptionToScheduledChannel,
} from '@/afda/store/afdaStore';
```

- [ ] **Step 2: Read AFDA subscriptions**

Inside `SkedulosaSchedulePage`, after the line that reads `scheduledChannels` from store, add:

```tsx
const afdaSubscriptions = useAfdaStore((s) => s.afdaSubscriptions);
```

- [ ] **Step 3: Add allChannels merge useMemo**

Before the `filteredChannels` useMemo, add:

```tsx
const allChannels = useMemo(
  () => [
    ...scheduledChannels,
    ...afdaSubscriptions.map(afdaSubscriptionToScheduledChannel),
  ],
  [scheduledChannels, afdaSubscriptions],
);
```

- [ ] **Step 4: Update filteredChannels to use allChannels**

In the `filteredChannels` useMemo, replace `scheduledChannels` (first argument to `filterChannelsByStatusAndCategory`) with `allChannels`, and update the dependency array accordingly:

```tsx
const filteredChannels = useMemo(() => {
  let channels = filterChannelsByStatusAndCategory(
    allChannels,  // was: scheduledChannels
    statusFilter,
    categoryFilter,
  );
  // ... rest unchanged
}, [
  allChannels,   // was: scheduledChannels
  statusFilter,
  categoryFilter,
  searchQuery,
  sortField,
  sortDirection,
]);
```

- [ ] **Step 5: Add Article badge to channel name cell**

Find the JSX cell that renders `ch.channelName`. Add a badge after it:

```tsx
{ch.category === 'afda' && (
  <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium flex-shrink-0">
    Article
  </span>
)}
```

- [ ] **Step 6: Verify TypeScript and dev server**

Run: `yarn lint`
Run: `yarn start`
Navigate to the skedulosa Schedule page. Confirm existing items still render.

- [ ] **Step 7: Commit**

```bash
git add src/skedulosa/pages/SkedulosaSchedulePage.tsx
git commit -m "feat(afda): merge AFDA subscriptions into SkedulosaSchedulePage"
```

---

## Task 6: Merge AFDA into SkedulosaHistoryPage

**Files:**
- Modify: `src/skedulosa/pages/SkedulosaHistoryPage.tsx`

- [ ] **Step 1: Import the AFDA store and type**

At the top of `src/skedulosa/pages/SkedulosaHistoryPage.tsx`, after existing imports, add:

```tsx
import { useAfdaStore } from '@/afda/store/afdaStore';
import type { AfdaSubscription } from '@/afda/types/afdaTypes';
```

- [ ] **Step 2: Read AFDA subscriptions**

Inside `SkedulosaHistoryPage`, after the line:
```tsx
const subscriptions = useSkedulosaStore((s) => s.subscriptions);
```
Add:
```tsx
const afdaSubscriptions = useAfdaStore((s) => s.afdaSubscriptions);
```

- [ ] **Step 3: Update the rows useMemo to include AFDA downloads**

Find the `rows` useMemo that builds `DownloadRow[]`. It starts with:
```tsx
const rows: DownloadRow[] = useMemo(() => {
  const all: DownloadRow[] = [];
  for (const sub of subscriptions) {
```

Update it to include AFDA subscriptions. Replace the entire `rows` useMemo:

```tsx
const rows: DownloadRow[] = useMemo(() => {
  const all: DownloadRow[] = [];
  const allSubs = [
    ...subscriptions,
    ...(afdaSubscriptions as unknown as Subscription[]),
  ];
  for (const sub of allSubs) {
    for (const download of sub.downloads) {
      all.push({ subscription: sub, download });
    }
  }
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? all.filter(
        ({ subscription, download }) =>
          download.name.toLowerCase().includes(q) ||
          subscription.source?.toLowerCase().includes(q),
      )
    : all;
  // ... keep the rest of the sort logic unchanged
```

Also update the `useMemo` dependency array to include `afdaSubscriptions`:
```tsx
}, [subscriptions, afdaSubscriptions, searchQuery, sortField, sortDirection]);
```

- [ ] **Step 4: Add Article badge to subscription name cell in history**

Find the JSX that renders the subscription name (`sub.source` or similar) in a history row. Add a badge:

```tsx
{(row.subscription as unknown as { source_type?: string }).source_type === 'afda' && (
  <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium flex-shrink-0">
    Article
  </span>
)}
```

- [ ] **Step 5: Verify TypeScript and dev server**

Run: `yarn lint`
Run: `yarn start`
Navigate to the skedulosa History page. Confirm existing download history still renders.

- [ ] **Step 6: Commit**

```bash
git add src/skedulosa/pages/SkedulosaHistoryPage.tsx
git commit -m "feat(afda): merge AFDA download history into SkedulosaHistoryPage"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - `AfdaSubscription` type with `section_details` ✓ (Task 1)
  - Separate store in `src/afda/` ✓ (Task 2)
  - `source_type: 'afda'` discriminator on `AfdaSubscription` ✓ (Task 1)
  - `source_type: 'youtube'` is NOT added to existing `Subscription` — not needed since `ScheduledChannel.category` handles the filter and pages use `ch.category === 'afda'` for badge detection ✓
  - `CategoryFilterSlug` expanded ✓ (Task 3)
  - `CATEGORY_FILTER_OPTIONS` expanded ✓ (Task 3)
  - All 3 pages updated ✓ (Tasks 4–6)
  - Type badge in rows ✓ (Tasks 4–6)

- [x] **Placeholder scan:** No TBD/TODO present. All code blocks are complete.

- [x] **Type consistency:**
  - `afdaSubscriptionToScheduledChannel` defined in Task 2, imported in Tasks 4 and 5 ✓
  - `useAfdaStore` defined in Task 2, imported in Tasks 4–6 ✓
  - `AfdaSubscription` defined in Task 1, imported in Task 6 ✓
  - `allChannels` defined and used within same task ✓
  - `ScheduleDay`, `ScheduleEntry` imported from skedulosaStore in afdaStore ✓

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-04-afda-store.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
