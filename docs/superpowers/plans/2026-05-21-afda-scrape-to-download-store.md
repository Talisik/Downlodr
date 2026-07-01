# AFDA Scrape-to-Download-Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically add newly scraped articles to the `articleDownloadStore` so they appear in `AfdaSelectedViewTable`'s Downloads count alongside the initial batch added during website creation.

**Architecture:** `AfdaSelectedViewTable` subscribes to `bridge.on.scrapeArticleSaved`; when an event fires for a section belonging to the current website, it fetches the full article via `bridge.articles.get({ article_id })` and calls `addAfdaArticle` on the store. The "Downloaded" stat card is updated to use the computed `downloadedCount` (all store entries with matching `subscriptionId`) instead of the hardcoded `"10"`.

**Tech Stack:** React hooks (`useEffect`, `useCallback`), Zustand (`useArticleDownloadStore`, `useAfdaWebsitesStore`), Electron IPC bridge (`window.afdaBridge`)

---

## Files

- **Modify:** `src/afda/pages/AfdaSelectedViewTable.tsx` — add scrape listener, fix stat card value
- **Create:** `updates-to-backend.md` — changelog for these changes

---

### Task 1: Add `scrapeArticleSaved` listener in `AfdaSelectedViewTable`

**Files:**
- Modify: `src/afda/pages/AfdaSelectedViewTable.tsx`

- [ ] **Step 1: Import `addAfdaArticle` from the download store**

At the top of `AfdaSelectedViewTable.tsx`, the store import is already present:
```tsx
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
```
Add `addAfdaArticle` to the destructured values from the store (line ~74):
```tsx
const articleDownloads = useArticleDownloadStore((s) => s.articleDownloads);
const addAfdaArticle = useArticleDownloadStore((s) => s.addAfdaArticle);
```

- [ ] **Step 2: Add the `useEffect` listener after the existing `bridge` declaration (around line 86)**

```tsx
// ── Listen for background scrapes and add to download store ──────────────
useEffect(() => {
  if (!bridge || !website) return;

  const sectionIds = new Set(website.sections.map((s) => parseInt(s.id)));

  const unsub = bridge.on.scrapeArticleSaved(
    async (data: { job_id: number; article_id: number; section_id: number; url: string }) => {
      if (!sectionIds.has(data.section_id)) return;

      try {
        const article = await bridge.articles.get({ article_id: data.article_id });
        if (!article) return;
        addAfdaArticle(
          `afda-article-${data.article_id}`,
          article.title ?? data.url,
          data.url,
          website.id,
          article.published_at ?? new Date().toISOString(),
          article.heroImage ?? null,
        );
      } catch {
        // silently skip — article will still appear in AfdaDownloads list
      }
    },
  );

  return () => unsub?.();
}, [bridge, website, addAfdaArticle]);
```

- [ ] **Step 3: Verify the file compiles — run the TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no new errors related to `AfdaSelectedViewTable.tsx`

- [ ] **Step 4: Commit**

```bash
git add src/afda/pages/AfdaSelectedViewTable.tsx
git commit -m "feat(afda): add scrapeArticleSaved listener to populate download store"
```

---

### Task 2: Fix `downloadedCount` and hardcoded stat card value

**Files:**
- Modify: `src/afda/pages/AfdaSelectedViewTable.tsx`

- [ ] **Step 1: Update the `downloadedCount` memo to count all store entries for this website**

The current filter (lines ~75–83) only counts `status === 'finished'`. Articles added via `addAfdaArticle` start as `'for_download'`, so they never appear. Change the filter to count all entries with a matching `subscriptionId`:

```tsx
const downloadedCount = useMemo(
  () =>
    website
      ? articleDownloads.filter((a) => a.subscriptionId === website.id).length
      : 0,
  [articleDownloads, website],
);
```

- [ ] **Step 2: Replace the hardcoded `"10"` in the stat card with `downloadedCount`**

Find the `StatCard` for "Downloaded" (around line 324):
```tsx
// Before:
<StatCard
  value={String(10)}
  label="Downloaded"
  icon={
    <IoDocumentTextOutline size={25} className="text-primary" />
  }
/>

// After:
<StatCard
  value={String(downloadedCount)}
  label="Downloaded"
  icon={
    <IoDocumentTextOutline size={25} className="text-primary" />
  }
/>
```

- [ ] **Step 3: Verify TypeScript still compiles cleanly**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/afda/pages/AfdaSelectedViewTable.tsx
git commit -m "fix(afda): wire downloadedCount to stat card, count all subscribed articles"
```

---

### Task 3: Create `updates-to-backend.md`

**Files:**
- Create: `updates-to-backend.md` (repo root)

- [ ] **Step 1: Create the file**

Content is documented in the separate `updates-to-backend.md` file created alongside this plan.

- [ ] **Step 2: Commit**

```bash
git add updates-to-backend.md
git commit -m "docs: add updates-to-backend changelog"
```
