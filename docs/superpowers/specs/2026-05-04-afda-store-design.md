# AFDA Store Design

**Date:** 2026-05-04  
**Feature:** AFDA — Article downloading, parallel to the skedulosa video download system  
**Status:** Approved

---

## Overview

AFDA is a new feature for downloading articles. It mirrors the skedulosa feature but operates on article content instead of video content. The mapping is:

| Skedulosa | AFDA |
|-----------|------|
| Video download link | Single article link |
| YouTube channel subscription | Section/URL subscription |
| `channel_details` | `section_details` |

AFDA data lives in its own Zustand store under `src/afda/` and is merged into existing skedulosa pages for display in the same tables, distinguished by a `source_type` discriminator and a category filter.

---

## Data Shape

### `AfdaSubscription`

Mirrors the skedulosa `Subscription` type exactly, with two differences:

```ts
source_type: 'afda'  // fixed discriminator

section_details?: {
  sectionName: string
  sectionUrl: string
  articleCount?: number
  site?: string
}
```

The skedulosa `Subscription` type gets `source_type: 'youtube'` added (defaults to `'youtube'` — existing data is unaffected).

Both types share the same `Download` shape with no changes.

---

## File Structure

```
src/afda/
  store/
    afdaStore.tsx      — Zustand store with IndexedDB persistence
  types/
    afdaTypes.ts       — AfdaSubscription, SectionDetails types
```

---

## AFDA Store (`src/afda/store/afdaStore.tsx`)

Mirrors skedulosaStore's structure, scoped to articles only.

**Persistence:** Zustand + IndexedDB, persisting `afdaSubscriptions` + `nextId`.

**Actions:**
- CRUD: `addAfdaSubscription`, `removeAfdaSubscription`, `updateAfdaSubscription`, `getAfdaSubscription`
- Downloads: `addDownloadToAfdaSubscription`, `updateAfdaSubscriptionDownload`, `removeAfdaSubscriptionDownload`
- Activity log: `addActivityLogEntry`, `clearActivityLog`
- UI filter state: `statusFilter`, `searchQuery`, `sortField`, `sortDirection`, `selectedChannelIds`

**Out of scope for now (easy to add later):**
- Schedule ticker (`startScheduleTicker` / `stopScheduleTicker`)
- Toolkit bridge calls (`bridge.registerChannel()`, `bridge.deleteChannel()`, etc.)

---

## Page Integration

Affected pages: `SkedulosaSubscriptionPage`, `SkedulosaSchedulePage`, `SkedulosaHistoryPage`.

Each page adds a merge step at the top:

```ts
const skedulosaSubscriptions = useSkedulosaStore(s => s.subscriptions)
const afdaSubscriptions = useAfdaStore(s => s.afdaSubscriptions)

const allSubscriptions = useMemo(() => [
  ...skedulosaSubscriptions.map(s => ({ ...s, source_type: 'youtube' as const })),
  ...afdaSubscriptions.map(s => ({ ...s, source_type: 'afda' as const })),
], [skedulosaSubscriptions, afdaSubscriptions])
```

The merged array feeds into existing filter/sort logic unchanged. Table rows show a small type badge driven by `source_type` (e.g. "YT" vs "Article").

---

## Category Filter Changes

1. `CategoryFilterSlug` in `skedulosaStore.tsx`: `'all' | 'youtube'` → `'all' | 'youtube' | 'afda'`
2. `SkedulosaNavigation.tsx`: add "Articles" filter option wired to `setCategoryFilter('afda')`
3. `filterSubscriptionsByStatusAndCategory` utility: add `'afda'` branch checking `source_type === 'afda'`

---

## What Is Not Changing

- Skedulosa store internals — no changes beyond adding `source_type: 'youtube'` to the `Subscription` type
- Download shape — identical between skedulosa and AFDA
- Routing — no new routes; AFDA items live within existing skedulosa pages
- Backend/toolkit bridge — AFDA store is frontend-only for now

---

## Future Extension Points

- Add `startScheduleTicker` to afdaStore when scheduling is needed
- Wire toolkit bridge calls when backend supports article sources
- Add article-specific fields to `Download` (author, publication date, content format) when needed
- Add `SelectedSubscriptionView` support for AFDA subscriptions (detail panel)
