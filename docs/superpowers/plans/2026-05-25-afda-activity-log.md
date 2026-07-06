# AfdaActivityLog Real-time Backend Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken subscription-store read in `AfdaActivityLog.tsx` with real scrape job events from the backend, scoped to the specific website being viewed.

**Architecture:** The backend `ScrapeEngine` already emits `scrape:job_update` (a full `ScrapeJobRow` snapshot on every status transition) to the renderer via IPC. We wire that event into the preload bridge, type it in `global.d.ts`, then rewrite the component to maintain a `Map<jobId, ScrapeJobRow>` seeded from a historical `listJobs` call and kept live by the event subscription.

**Tech Stack:** React, Zustand, Electron contextBridge / ipcRenderer, TypeScript

---

## File map

| File | Change |
|---|---|
| `src/core-app/ipc/renderer/afdaHandler.ts` | Add `scrapeJobUpdate` to existing `afdaBridge.on` block |
| `src/global.d.ts` | Add `on: { ... }` property to `afdaBridge` Window type |
| `src/afda/pages/selectedTabPages/AfdaActivityLog.tsx` | Full rewrite — remove subscription store, add IPC-driven jobs map |

---

## Task 1: Add `scrapeJobUpdate` to the preload bridge

**Files:**
- Modify: `src/core-app/ipc/renderer/afdaHandler.ts`

### Context

`afdaBridge.on` already has `scrapeArticleSaved`. Add `scrapeJobUpdate` alongside it.  
The channel name the backend emits on is `'scrape:job_update'` (see `ScrapeEngine.emit`).  
The listener must return an unsubscribe function (matching the pattern every other `on.*` listener uses).

- [ ] **Step 1: Open the file and locate the `on` block**

Open `src/core-app/ipc/renderer/afdaHandler.ts`. Find this block (around line 124–151):

```ts
on: {
  mapperProgress: (cb: (data: any) => void) => {
    ...
  },
  ...
  scrapeArticleSaved: (cb: (data: { job_id: number; article_id: number; section_id: number; url: string }) => void) => {
    const wrapped = (_: any, data: any) => cb(data);
    ipcRenderer.on('scrape:article_saved', wrapped);
    return () => ipcRenderer.removeListener('scrape:article_saved', wrapped);
  },
},
```

- [ ] **Step 2: Add `scrapeJobUpdate` after `scrapeArticleSaved`**

Replace:
```ts
    scrapeArticleSaved: (cb: (data: { job_id: number; article_id: number; section_id: number; url: string }) => void) => {
      const wrapped = (_: any, data: any) => cb(data);
      ipcRenderer.on('scrape:article_saved', wrapped);
      return () => ipcRenderer.removeListener('scrape:article_saved', wrapped);
    },
  },
```

With:
```ts
    scrapeArticleSaved: (cb: (data: { job_id: number; article_id: number; section_id: number; url: string }) => void) => {
      const wrapped = (_: any, data: any) => cb(data);
      ipcRenderer.on('scrape:article_saved', wrapped);
      return () => ipcRenderer.removeListener('scrape:article_saved', wrapped);
    },
    scrapeJobUpdate: (cb: (data: any) => void) => {
      const wrapped = (_: any, data: any) => cb(data);
      ipcRenderer.on('scrape:job_update', wrapped);
      return () => ipcRenderer.removeListener('scrape:job_update', wrapped);
    },
  },
```

- [ ] **Step 3: Verify with lint**

```bash
npx eslint --ext .ts src/core-app/ipc/renderer/afdaHandler.ts
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/core-app/ipc/renderer/afdaHandler.ts
git commit -m "feat(afda): expose scrape:job_update via afdaBridge.on.scrapeJobUpdate"
```

---

## Task 2: Type `afdaBridge.on` in `global.d.ts`

**Files:**
- Modify: `src/global.d.ts`

### Context

`global.d.ts` declares `Window.afdaBridge` but has no `on` property at all — it only types the invokeable channels. Add the `on` block with precise types for all existing listeners plus the new one.

- [ ] **Step 1: Find the insertion point**

Open `src/global.d.ts`. Find the end of the `afdaBridge` block — it closes with:

```ts
      auth: {
        openLogin: () => Promise<unknown>;
        getStatus: () => Promise<unknown>;
        clear: () => Promise<unknown>;
      };
    };
```

- [ ] **Step 2: Add the `on` property before the closing `};`**

Replace:
```ts
      auth: {
        openLogin: () => Promise<unknown>;
        getStatus: () => Promise<unknown>;
        clear: () => Promise<unknown>;
      };
    };
```

With:
```ts
      auth: {
        openLogin: () => Promise<unknown>;
        getStatus: () => Promise<unknown>;
        clear: () => Promise<unknown>;
      };

      on: {
        scrapeJobUpdate: (cb: (job: {
          id: number;
          section_id: number;
          fqdn: string;
          section_url: string;
          status: string;
          triggered_by: string;
          discovered_urls: number;
          scraped_count: number;
          parsed_count: number;
          failed_count: number;
          error_message: string | null;
          started_at: string | null;
          finished_at: string | null;
          created_at: string;
        }) => void) => () => void;
        scrapeArticleSaved: (cb: (data: {
          job_id: number;
          article_id: number;
          section_id: number;
          url: string;
        }) => void) => () => void;
        mapperProgress: (cb: (data: unknown) => void) => () => void;
        mapperComplete: (cb: (data: unknown) => void) => () => void;
        mapperError: (cb: (data: { fqdn: string; message: string }) => void) => () => void;
        mapperAuthRequired: (cb: (data: unknown) => void) => () => void;
      };
    };
```

- [ ] **Step 3: Verify with lint**

```bash
npx eslint --ext .ts src/global.d.ts
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/global.d.ts
git commit -m "feat(afda): type afdaBridge.on including scrapeJobUpdate in global.d.ts"
```

---

## Task 3: Rewrite `AfdaActivityLog.tsx`

**Files:**
- Modify: `src/afda/pages/selectedTabPages/AfdaActivityLog.tsx`

### Context

The current file reads from `useAfdaSubscriptionsStore` — wrong store for this page. Replace entirely.

Key facts:
- `AfdaSelectedViewTable` passes `channelId` which is a `Website.id` (string UUID from SQLite, e.g. `"1"` or a UUID).
- `useAfdaWebsitesStore` holds `Website[]`; each has `sections: WebsiteSection[]` where `section.id = String(numericSqliteId)`.
- `ScrapeJobRow.section_id` is that same numeric ID.
- `afdaBridge.scrape.listJobs({ limit: 50 })` returns `ScrapeJobRow[]` (untyped `unknown` from the bridge — cast it).
- `afdaBridge.on.scrapeJobUpdate(cb)` returns an unsubscribe function.
- The existing `ActivityLogEntry`, `ActivityLogType` types are imported from `@/skedulosa/store/skedulosaStore` — keep those imports.
- The existing `matchesFilter`, `EntryIcon`, filter UI, and `formatRelativeTime` usage should stay — only the data source changes.

### ScrapeJobRow shape (local type — do NOT import from backend)

```ts
interface ScrapeJobRow {
  id: number;
  section_id: number;
  fqdn: string;
  section_url: string;
  status: string;
  triggered_by: string;
  discovered_urls: number;
  scraped_count: number;
  parsed_count: number;
  failed_count: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}
```

### Job → ActivityLogEntry mapping

```ts
function jobToEntry(job: ScrapeJobRow): ActivityLogEntry | null {
  const ts = job.finished_at ?? job.started_at ?? job.created_at;
  const id = `job-${job.id}`;
  switch (job.status) {
    case 'running':
      return { id: `${id}-running`, type: 'check', action: 'Scrape running', detail: job.section_url, timestamp: job.started_at ?? job.created_at };
    case 'done':
      return job.scraped_count > 0
        ? { id, type: 'download', action: `${job.scraped_count} articles found`, detail: job.fqdn, timestamp: ts }
        : { id, type: 'check', action: 'No new articles', detail: job.fqdn, timestamp: ts };
    case 'error':
      return { id, type: 'error', action: 'Scrape failed', detail: job.error_message ?? job.fqdn, timestamp: ts };
    default:
      return null;
  }
}
```

- [ ] **Step 1: Write the new file**

Replace the entire contents of `src/afda/pages/selectedTabPages/AfdaActivityLog.tsx` with:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LuDownload,
  LuRefreshCw,
  LuLoaderCircle,
  LuCircle,
} from 'react-icons/lu';
import type {
  ActivityLogEntry,
  ActivityLogType,
} from '@/skedulosa/store/skedulosaStore';
import { formatRelativeTime } from '@/downlodr/pages/status/statusPageUtils';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';

interface AfdaActivityLogProps {
  channelId: string | undefined;
}

type FilterSlug = 'all' | 'checks' | 'downloads' | 'errors';

const FILTER_SLUGS: FilterSlug[] = ['all', 'downloads', 'checks', 'errors'];

interface ScrapeJobRow {
  id: number;
  section_id: number;
  fqdn: string;
  section_url: string;
  status: string;
  triggered_by: string;
  discovered_urls: number;
  scraped_count: number;
  parsed_count: number;
  failed_count: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

function jobToEntry(job: ScrapeJobRow): ActivityLogEntry | null {
  const ts = job.finished_at ?? job.started_at ?? job.created_at;
  const id = `job-${job.id}`;
  switch (job.status) {
    case 'running':
      return {
        id: `${id}-running`,
        type: 'check',
        action: 'Scrape running',
        detail: job.section_url,
        timestamp: job.started_at ?? job.created_at,
      };
    case 'done':
      return job.scraped_count > 0
        ? { id, type: 'download', action: `${job.scraped_count} articles found`, detail: job.fqdn, timestamp: ts }
        : { id, type: 'check', action: 'No new articles', detail: job.fqdn, timestamp: ts };
    case 'error':
      return { id, type: 'error', action: 'Scrape failed', detail: job.error_message ?? job.fqdn, timestamp: ts };
    default:
      return null;
  }
}

function matchesFilter(entry: ActivityLogEntry, filter: FilterSlug): boolean {
  if (filter === 'all') return true;
  if (filter === 'checks') return entry.type === 'check';
  if (filter === 'downloads') return entry.type === 'download' || entry.type === 'retry' || entry.type === 'subscribe';
  if (filter === 'errors') return entry.type === 'error';
  return true;
}

function EntryIcon({ type }: { type: ActivityLogType }) {
  const base = 'flex-shrink-0 rounded-full p-1';
  switch (type) {
    case 'check':
      return (
        <span className={`${base} bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400`}>
          <LuCircle size={14} />
        </span>
      );
    case 'download':
      return (
        <span className={`${base} bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400`}>
          <LuDownload size={14} />
        </span>
      );
    case 'retry':
      return (
        <span className={`${base} bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400`}>
          <LuRefreshCw size={14} />
        </span>
      );
    case 'error':
      return (
        <span className={`${base} bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400`}>
          <LuLoaderCircle size={14} />
        </span>
      );
    case 'subscribe':
      return (
        <span className={`${base} bg-primary/10 text-primary`}>
          <LuCircle size={14} />
        </span>
      );
  }
}

const AfdaActivityLog = ({ channelId }: AfdaActivityLogProps) => {
  const { t } = useTranslation('skedulosa');

  const website = useAfdaWebsitesStore((s) =>
    s.websites.find((w) => w.id === channelId),
  );

  const sectionIds = useMemo(
    () => new Set((website?.sections ?? []).map((s) => Number(s.id))),
    [website],
  );

  const [jobsMap, setJobsMap] = useState<Map<number, ScrapeJobRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterSlug>('all');

  // Load historical jobs on mount
  useEffect(() => {
    if (!channelId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setJobsMap(new Map());

    window.afdaBridge?.scrape
      .listJobs({ limit: 50 })
      .then((raw) => {
        const jobs = (raw as ScrapeJobRow[]).filter(
          (j) => sectionIds.has(j.section_id),
        );
        setJobsMap(new Map(jobs.map((j) => [j.id, j])));
      })
      .catch(() => {/* bridge unavailable in non-Electron dev */})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Subscribe to live job updates
  useEffect(() => {
    if (!window.afdaBridge?.on?.scrapeJobUpdate) return;
    const unsub = window.afdaBridge.on.scrapeJobUpdate((job) => {
      if (!sectionIds.has(job.section_id)) return;
      setJobsMap((prev) => new Map(prev).set(job.id, job));
    });
    return unsub;
  }, [sectionIds]);

  const entries = useMemo(() => {
    const result: ActivityLogEntry[] = [];
    for (const job of jobsMap.values()) {
      const entry = jobToEntry(job);
      if (entry && matchesFilter(entry, filter)) result.push(entry);
    }
    return result.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [jobsMap, filter]);

  return (
    <div className="py-4 pl-6 pr-10 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {t('activityLog.showingResults')}
        </span>
        <div className="flex items-center gap-1">
          {FILTER_SLUGS.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => setFilter(slug)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filter === slug
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {t(`activityLog.filters.${slug}`)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500 text-sm">
          <LuLoaderCircle size={16} className="animate-spin mr-2" />
          Loading…
        </div>
      ) : entries.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500 text-sm">
          {t('activityLog.noActivity')}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 py-2.5 hover:bg-gray-50 dark:hover:bg-darkModeCompliment/20 px-1 rounded"
            >
              <EntryIcon type={entry.type} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {entry.action}
                </span>
                {entry.detail && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    · {entry.detail}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
                {formatRelativeTime(entry.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AfdaActivityLog;
```

- [ ] **Step 2: Verify with lint**

```bash
npx eslint --ext .ts,.tsx src/afda/pages/selectedTabPages/AfdaActivityLog.tsx
```

Expected: no errors (the `react-hooks/exhaustive-deps` disable comment is intentional — `sectionIds` is a Set derived from `channelId` and we only want to reload on website change, not on every Set identity change).

- [ ] **Step 3: Commit**

```bash
git add src/afda/pages/selectedTabPages/AfdaActivityLog.tsx
git commit -m "feat(afda): rewrite AfdaActivityLog to use real scrape job events from backend"
```

---

## Task 4: Manual smoke test

No automated renderer test runner exists in this project. Verify manually.

- [ ] **Step 1: Start the app**

```bash
npm start
```

- [ ] **Step 2: Navigate to an AFDA website detail page**

Go to any tracked website in the AFDA section → open the **Activity Log** tab.

Expected: the tab shows "No activity" if no scrape jobs have run, or shows historical jobs if any exist in the DB.

- [ ] **Step 3: Trigger a scrape**

Click **Run now** (or whatever the scrape trigger is on that page).

Expected: while the job is running, a "Scrape running" entry with `check` icon appears. When it finishes, it transitions to either "N articles found" (download icon) or "No new articles" (check icon).

- [ ] **Step 4: Verify isolation**

Open the Activity Log for a *different* website. Confirm it shows only that website's jobs — not the one you just ran.

- [ ] **Step 5: Verify filters**

Click each filter button (Downloads, Checks, Errors). Confirm the entries shown match the filter type.

---

## Self-review

**Spec coverage:**
- ✅ Replace subscription-store read with website-store lookup → Task 3
- ✅ `sectionIds` filter for isolation → Task 3 (`sectionIds.has(job.section_id)`)
- ✅ Add `scrapeJobUpdate` to preload bridge → Task 1
- ✅ Type `afdaBridge.on` in `global.d.ts` → Task 2
- ✅ Historical load via `listJobs` on mount → Task 3 (`useEffect` with `listJobs`)
- ✅ Live subscription via `scrapeJobUpdate` → Task 3 (second `useEffect`)
- ✅ Job → entry mapping table from spec → Task 3 (`jobToEntry`)
- ✅ Existing filter/sort/display UI preserved → Task 3 (UI block unchanged)

**Placeholder scan:** None found.

**Type consistency:**
- `ScrapeJobRow` defined in Task 3, used only in Task 3 ✅
- `jobToEntry` defined and used in Task 3 ✅
- `afdaBridge.on.scrapeJobUpdate` added in Task 1, typed in Task 2, consumed in Task 3 ✅
- `ActivityLogEntry`, `ActivityLogType` imported from `@/skedulosa/store/skedulosaStore` in Task 3 (same as original file) ✅
