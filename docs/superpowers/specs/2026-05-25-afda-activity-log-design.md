# AfdaActivityLog — Real-time Backend Integration

**Date:** 2026-05-25  
**Status:** Approved

---

## Problem

`AfdaActivityLog.tsx` reads from `useAfdaSubscriptionsStore` using a website ID. But the page that renders it (`AfdaSelectedViewTable`) uses `useAfdaWebsitesStore`. Those two stores have different ID schemes, so `subscription` is always `undefined` and the log shows nothing.

---

## Goal

Drive the activity log from real backend scrape events, scoped strictly to the specific website being viewed.

---

## Architecture

### Data sources

The backend `ScrapeEngine` already emits two IPC push events to the renderer:

| Channel | Payload | When |
|---|---|---|
| `scrape:job_update` | `ScrapeJobRow` | On every status transition (queued → running → done/error) |
| `scrape:article_saved` | `{ job_id, article_id, section_id, url }` | Per article saved |

Neither is consumed yet — `afdaBridge.on` is defined in the preload but not typed in `global.d.ts` and never read in the renderer.

### Isolation guarantee

Each `Website` in `useAfdaWebsitesStore` has `sections: WebsiteSection[]`. Each section's `id` is `String(numericSqliteId)`. `ScrapeJobRow.section_id` is that same numeric SQLite ID. Filtering by `sectionIds.has(job.section_id)` ensures events from other websites never leak into this log.

---

## Component design

### `AfdaActivityLog.tsx`

**State:**
- `jobsMap: Map<number, ScrapeJobRow>` — keyed by job ID; upserted on every `scrape:job_update` event
- `loading: boolean` — true until the initial `listJobs` fetch resolves

**On mount (keyed to `channelId`):**
1. Look up `website` from `useAfdaWebsitesStore`
2. Build `sectionIds: Set<number>` from `website.sections.map(s => Number(s.id))`
3. Call `afdaBridge.scrape.listJobs({ limit: 50 })` — returns all recent jobs, filter to this website's section IDs, hydrate `jobsMap`
4. Subscribe to `afdaBridge.on.scrapeJobUpdate(cb)` — if `job.section_id ∈ sectionIds`, upsert into `jobsMap`
5. Return unsubscribe cleanup

**Entry derivation (memoized from `jobsMap` + `filter`):**

| Job status | `ActivityLogType` | Action | Detail |
|---|---|---|---|
| `running` | `check` | "Scrape running" | `job.section_url` |
| `done`, `scraped_count > 0` | `download` | `"N articles found"` | `job.fqdn` |
| `done`, `scraped_count = 0` | `check` | "No new articles" | `job.fqdn` |
| `error` | `error` | "Scrape failed" | `job.error_message ?? job.fqdn` |
| `queued` / `cancelled` | skipped | — | — |

Entries are sorted descending by timestamp. The existing filter buttons (`all` / `downloads` / `checks` / `errors`) continue to work unchanged.

---

## Files changed

### 1. `src/core-app/ipc/renderer/afdaHandler.ts`
Add `scrapeJobUpdate` to `afdaBridge.on`:

```ts
scrapeJobUpdate: (cb: (data: unknown) => void) => {
  const wrapped = (_: unknown, data: unknown) => cb(data);
  ipcRenderer.on('scrape:job_update', wrapped);
  return () => ipcRenderer.removeListener('scrape:job_update', wrapped);
},
```

### 2. `src/global.d.ts`
Add `on` block to `afdaBridge` type:

```ts
on: {
  scrapeJobUpdate: (cb: (job: {
    id: number; section_id: number; fqdn: string; section_url: string;
    status: string; scraped_count: number; error_message: string | null;
    started_at: string | null; finished_at: string | null; created_at: string;
  }) => void) => () => void;
  scrapeArticleSaved: (cb: (data: {
    job_id: number; article_id: number; section_id: number; url: string;
  }) => void) => () => void;
  mapperProgress: (cb: (data: unknown) => void) => () => void;
  mapperComplete: (cb: (data: unknown) => void) => () => void;
  mapperError: (cb: (data: { fqdn: string; message: string }) => void) => () => void;
  mapperAuthRequired: (cb: (data: unknown) => void) => () => void;
};
```

### 3. `src/afda/pages/selectedTabPages/AfdaActivityLog.tsx`
Full rewrite: remove `useAfdaSubscriptionsStore`, replace with `useAfdaWebsitesStore` + IPC-driven `jobsMap`.

---

## Out of scope

- `scrape:article_saved` per-article entries (too noisy; Approach B, not selected)
- Persisting the activity log across sessions (SQLite historical load covers this)
- Changes to the job-status display UI or filter labels
