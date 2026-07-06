# Updates to Backend Integration

## Background scrape → download store sync

**File:** `src/afda/pages/AfdaSelectedViewTable.tsx`

### Problem

When a website's sections are scraped on schedule (without the user having the tab open or during a background run), the newly saved articles were never added to `useArticleDownloadStore`. Only articles fetched during the initial website-add flow (`AfdaAddWebsiteModal`) were pushed into the store via `addAfdaArticle`. This meant:

- The "Downloaded" stat card was hardcoded to `"10"` and never reflected real data.
- Background-scraped articles were invisible to the store entirely.

### What changed

**1. `scrapeArticleSaved` listener added to `AfdaSelectedViewTable`**

A new `useEffect` subscribes to `bridge.on.scrapeArticleSaved` whenever the component is mounted with a valid website. When the event fires:

- The `section_id` in the payload is checked against the current website's sections.
- If it matches, `bridge.articles.get({ article_id })` is called to fetch the full article record (title, published date, hero image).
- `addAfdaArticle` is called with the article data and the website's `id` as the `subscriptionId`, adding it to the persisted download store.

This means any article scraped while the website view is open (including scheduled and manual "run now" triggers) is automatically registered in the store.

**2. `downloadedCount` filter updated**

The `downloadedCount` memo previously filtered for `status === 'finished'`, which excluded all AFDA articles since `addAfdaArticle` sets `status: 'for_download'`. The filter now counts all store entries with a matching `subscriptionId`, regardless of status.

**3. Stat card wired to real count**

The "Downloaded" `StatCard` was hardcoded to `String(10)`. It now uses `String(downloadedCount)`.

### Bridge calls used

| Call | Payload |
|---|---|
| `bridge.on.scrapeArticleSaved(cb)` | fires `{ job_id, article_id, section_id, url }` |
| `bridge.articles.get(...)` | `{ article_id: number }` (not bare `id`) |

> Note: `bridge.articles.get` bridge type annotation says `(id: number)` but the IPC handler expects `{ article_id: number }`. Always pass the object form. See `docs/` bridge mismatch notes.

### Limitation

The listener only runs while `AfdaSelectedViewTable` is mounted (i.e., the user has a specific website selected). Articles scraped when the view is not open are not added to the store during that session, though they still appear in the `AfdaDownloads` article list (which reads directly from the database).
