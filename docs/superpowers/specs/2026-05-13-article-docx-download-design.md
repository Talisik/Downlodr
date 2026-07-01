# Article DOCX Download — Design Spec
**Date:** 2026-05-13
**Branch:** feat/afda-ui

---

## Overview

When a user pastes an article URL into the taskbar and clicks the download icon, two things happen in parallel:
1. The article side panel opens (existing behaviour).
2. A `.docx` file is generated from the fetched article data and saved to disk. The download entry appears as a row in `StatusPageTable` and persists across sessions via IndexedDB.

---

## 1. Data Shape

### `ArticleDownload`

```typescript
interface ArticleDownload {
  id: string;                        // nanoid()
  title: string;                     // article_title (updated after fetch)
  url: string;                       // source article URL
  status: 'loading' | 'finished' | 'failed';
  filePath: string | null;           // absolute path to saved .docx
  fileSize: number | null;           // bytes, set on finish
  dateAdded: string;                 // ISO string, set on creation
  errorMessage?: string;
  articleData: ArticleModel | null;  // full parsed article content
  thumbnailDataUrl: string | null;   // base64 of article_images[0]
}
```

---

## 2. Store — `articleDownloadStore`

**File:** `src/afda/store/articleDownloadStore.ts`

- State: `articleDownloads: ArticleDownload[]`
- Actions:
  - `addArticleDownload(id, url)` — creates entry with `status: 'loading'`, `title: ''`
  - `updateArticleDownload(id, patch: Partial<ArticleDownload>)` — merges patch into matching entry
  - `removeArticleDownload(id)` — removes entry by id
- Persistence: IndexedDB (same debounced-write pattern as `downloadStore`)

---

## 3. Docx Generation Utility

**File:** `src/afda/utils/articleDocxGenerator.ts`

Uses the `docx` npm package. Document layout mirrors the article side panel:

| Order | Element | Docx construct |
|-------|---------|----------------|
| 1 | Article title | `Heading1` |
| 2 | Publish date + authors | Single `Paragraph` |
| 3 | Thumbnail image | `ImageRun` (fetched, converted to buffer) |
| 4 | Content sections | `Heading2` per section heading + `Paragraph` per body chunk |

Content source follows the same priority as the side panel: `article_content` → `raw_html` (stripped) → `article_sections`.

**Signature:**
```typescript
export async function generateArticleDocx(article: ArticleModel): Promise<Uint8Array>
```

**File save:**
- Filename: `<(article_title ?? 'article').slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')>.docx` — falls back to `'article'` if `article_title` is null
- Location: `<downloadFolder>/` (user's configured default from `taskbarDownloadStore`)
- IPC call: `window.downlodrFunctions.saveFile(buffer, filePath)` (new IPC, to be added)

---

## 4. TaskbarInputField Changes

**File:** `src/downlodr/components/base/InputField/TaskbarInputField.tsx`

In `handleDownload()` when `isArticle`:

```
1. Generate id = nanoid()
2. Store id in pendingArticleIdRef (useRef)
3. addArticleDownload(id, url)   ← creates 'loading' row immediately
4. fetchAndOpenArticle(url)      ← opens side panel (existing)
5. resetModal()
```

New `useEffect` watches `afdaStore.fetchState` + `afdaStore.articleData`:

- `fetchState === 'success'` and `pendingArticleIdRef.current`:
  1. Fetch thumbnail → base64 data URL
  2. Call `generateArticleDocx(articleData)`
  3. Call `window.downlodrFunctions.saveFile(buffer, filePath)`
  4. `updateArticleDownload(id, { status: 'finished', filePath, fileSize, articleData, thumbnailDataUrl, title })`
  5. Clear `pendingArticleIdRef`

- `fetchState === 'error'` and `pendingArticleIdRef.current`:
  1. `updateArticleDownload(id, { status: 'failed', errorMessage })`
  2. Clear `pendingArticleIdRef`

---

## 5. StatusPage Integration

### 5a. Extend `SearchableDownload` union

**File:** `src/downlodr/store/taskbarDownloadStore.tsx`

`SearchableDownload` is currently a union of five video download types. Add a new member:

```typescript
export interface ArticleSearchableDownload {
  type: 'article';
  id: string;
  name: string;           // = ArticleDownload.title
  status: string;         // = ArticleDownload.status
  size: number;           // = ArticleDownload.fileSize ?? 0
  DateAdded: string;      // = ArticleDownload.dateAdded
  location: string;       // = ArticleDownload.filePath ?? ''
  videoUrl: string;       // = ArticleDownload.url
  // all other SearchableDownload fields set to sensible no-op defaults
}

export type SearchableDownload =
  | ForDownload
  | Downloading
  | FinishedDownloads
  | HistoryDownloads
  | QueuedDownload
  | ArticleSearchableDownload;
```

### 5b. Merge in StatusPage

**File:** `src/downlodr/pages/StatusPage.tsx`

In the `allDownloads` `useMemo`, pull `articleDownloads` from `articleDownloadStore` and map each to `ArticleSearchableDownload`, then append to the merged list before sort/filter.

### 5c. Render in StatusPageTable

**File:** `src/downlodr/pages/status/StatusPageTable.tsx`

In `renderItems`, when `download.type === 'article'`, render `ArticleDownloadTableRow` instead of `StatusPageTableRow`.

---

## 6. ArticleDownloadTableRow Component

**File:** `src/afda/components/ArticleDownloadTableRow.tsx`

Same `<tr>` structure as `StatusPageTableRow`, iterating `displayColumns`:

| Column | Renders |
|--------|---------|
| `name` | Document icon + article title |
| `status` | `loading` → spinner · `finished` → folder-open icon · `failed` → error icon |
| `size` | File size when finished, `—` otherwise |
| `format` | Static `docx` text badge |
| `dateAdded` | `formatRelativeTime(dateAdded)` |
| `speed` | `—` |
| `transcript` | `—` |
| `source` | `—` |
| `action` | Open-in-folder button only |

---

## 7. New IPC — `saveFile`

**Main process:** Add `saveFile(buffer: Uint8Array, filePath: string): Promise<void>` IPC handler that writes the buffer to disk using `fs.writeFile`.

**Preload:** Expose as `window.downlodrFunctions.saveFile`.

---

## 8. Dependencies

- `docx` npm package (for `.docx` generation) — add to `package.json` if not present

---

## Out of Scope

- Retry logic for failed article downloads
- Editing/renaming article download entries
- Article downloads appearing in search results (can be added later)
