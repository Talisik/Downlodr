# AFDA Flow Documentation

## Overview

AFDA (Article Feed Download Aggregator) lets users subscribe to websites, scrape article sections on a schedule, and browse downloaded articles. The flow has three stages: **subscription**, **scraping**, and **browsing**.

---

## 1. Subscription Flow

### Entry Point — `SkedulosaSubscribeModal`
`src/skedulosa/components/SkedulosaSubscribeModal.tsx`

- User types a URL into the modal
- If the URL is **non-YouTube**, `urlType` is set to `'website'` and `isValidUrl` becomes `true`
- On Subscribe click → `websiteModalUrl` is set, the subscribe modal closes, and `AfdaAddWebsiteModal` opens

### Website Setup — `AfdaAddWebsiteModal`
`src/afda/components/AfdaAddWebsiteModal.tsx`

**Phase: `running`**
- On open, immediately calls `bridge.mapper.run({ website_url, fqdn, ... })`
- `startChannelAnalysis` fires to show the global scanning overlay
- Completion events are **not** handled here: `GlobalAfdaMapperListener`
  (`src/afda/components/GlobalAfdaMapperListener.tsx`, mounted app-wide in
  `App.tsx`) owns `bridge.on.mapperComplete`/`mapperError`, calls
  `finishChannelAnalysis()`, and stashes the result in `afdaMapperStore`. This
  survives the modal unmounting when the user clicks "Run in background" on the
  scanning overlay and leaves `/skedulosa` — the modal consumes the stashed
  result whenever it is (re)mounted with a matching fqdn

**Phase: `sections`** (on `mapperComplete`)
- `MapperResult` contains `section_links[]` and optional `section_analyses` (frequency suggestions per section)
- User sees a list of sections — each with an Auto/Manual frequency toggle
- All sections are pre-selected by default
- User can deselect, reorder, or override intervals

**On Subscribe (`handleSave`)**
1. Calls `bridge.websites.save(...)` with selected sections and their schedule configs
2. Calls `bridge.scrape.runNow({ section_id })` for every enabled section (parallel)
3. Sets up `bridge.on.scrapeArticleSaved` listener — collects first 5 articles and stores them via `addAfdaArticle` into `articleDownloadStore`
4. The 60-second listener timeout auto-cleans up
5. Calls `addWebsite(result.website)` to sync `afdaWebsitesStore`
6. Modal closes

> `AfdaDownloads` also registers a `scrapeArticleSaved` listener to re-fetch the selected section
> live as articles arrive, keeping the Downloads tab in sync without a manual refresh.

---

## 2. Data Stores

### `afdaWebsitesStore`
`src/afda/store/afdaWebsitesStore.ts`

- Source of truth for the website list (name, URL, sections, status, timestamps)
- Populated on save, updated on pause/resume/delete
- Read by `AfdaSelectedViewTable` and `AfdaDownloads`

### `articleDownloadStore`
`src/afda/store/articleDownloadStore.ts`

- Accumulates articles via `addAfdaArticle` during the post-save scrape listener
- **Currently orphaned** — no component reads from it in the Downloads view
- Intended as a cache layer but superseded by direct bridge calls in `AfdaDownloads`

---

## 3. Detail View

### `AfdaSelectedViewTable`
`src/afda/pages/AfdaSelectedViewTable.tsx`

- Route: `/skedulosa/subscription/:channelId` (channelId = website id)
- Reads the website from `afdaWebsitesStore` by `channelId`
- Header shows: name, status, section count, article count (hardcoded `0`), created date, last checked date
- Action buttons: Edit (disabled), Delete, Pause/Resume all sections, Run Now all sections
- Tabs: **Downloads**, **Activity Log**, **Settings**

### Downloads Tab — `AfdaDownloads`
`src/afda/pages/selectedTabPages/AfdaDownloads.tsx`

**On mount / website change:**
- Calls `bridge.articles.listFiltered({ section_ids: [id], limit: 100 })` for **every section** in parallel to populate sidebar article count badges
- Auto-selects the first section

**On section click:**
- Calls `bridge.articles.listFiltered({ section_ids: [id], sort_key: 'published_at', sort_dir: 'desc', limit: 100 })`
- `listFiltered` returns articles **without `body_text`** (stripped server-side)

**On article click:**
- Optimistically shows the partial article (no body)
- Calls `bridge.articles.get({ article_id })` to fetch full content including `body_text`
- Preview panel renders paragraphs via `splitIntoParagraphs(body_text)`

**Per-section actions (sidebar):**
- Toggle (pause/resume): `bridge.schedule.pause/resume({ section_id })` → re-fetches hydrated website to sync store
- Run now: `bridge.scrape.runNow({ section_id })`

---

## 4. Bridge API Surface (AFDA)

| Call | Purpose |
|------|---------|
| `bridge.mapper.run({ website_url, fqdn, website_name, website_category })` | Discover sections and analyse frequency |
| `bridge.on.mapperComplete(cb)` | Event: mapper finished successfully |
| `bridge.on.mapperError(cb)` | Event: mapper failed |
| `bridge.websites.save({ fqdn, website_url, ... selected_sections })` | Persist website + sections |
| `bridge.websites.update({ id, patch })` | Patch and re-hydrate a website |
| `bridge.websites.delete({ id })` | Delete a website |
| `bridge.scrape.runNow({ section_id })` | Trigger immediate scrape for a section |
| `bridge.on.scrapeArticleSaved(cb)` | Event: a new article was saved during a scrape |
| `bridge.articles.listFiltered({ section_ids, sort_key, sort_dir, limit })` | List articles (no `body_text`) |
| `bridge.articles.get({ article_id })` | Fetch single article with full `body_text` |
| `bridge.schedule.pause({ section_id })` | Pause scheduled scraping for a section |
| `bridge.schedule.resume({ section_id })` | Resume scheduled scraping for a section |

---

## 5. Full Flow Diagram

```
User types URL
      │
      ▼
SkedulosaSubscribeModal
  isYouTube? ──yes──▶ YouTube subscription flow
      │ no
      ▼
  urlType = 'website', isValidUrl = true
      │
  [Subscribe clicked]
      │
      ▼
AfdaAddWebsiteModal (phase: running)
  bridge.mapper.run(url)
      │
      ├── mapperError ──▶ phase: error → Retry button
      │
      └── mapperComplete
            │
            ▼
        phase: sections
        User selects/configures sections
            │
        [Subscribe clicked]
            │
            ▼
        bridge.websites.save(...)
            │
            ▼
        bridge.scrape.runNow(section_id) × N  (parallel)
            │
            ▼
        bridge.on.scrapeArticleSaved listener (60s window)
        → addAfdaArticle into articleDownloadStore (first 5)  ⚠️ not read by AfdaDownloads
            │
        addWebsite → afdaWebsitesStore
        handleClose()
            │
            ▼
AfdaSelectedViewTable (/skedulosa/subscription/:id)
  reads afdaWebsitesStore
      │
      ▼
AfdaDownloads
  bridge.articles.listFiltered × sections (count badges)
      │
  [Section clicked]
      │
      ▼
  bridge.articles.listFiltered (article list, no body_text)
      │
  [Article clicked]
      │
      ▼
  bridge.articles.get (full article with body_text)
  → Article preview panel
```
