# AfdaDownloads UI — Three-Level Navigation Design

**Date:** 2026-05-05  
**File:** `src/afda/pages/selectedTabPages/AfdaDownloads.tsx`  
**Scope:** Redesign the Downloads tab of the AFDA selected-subscription view to support website → section → article navigation.

---

## Overview

The Downloads tab renders inside `AfdaSelectedViewTable`, which already establishes the **website** level (subscription source). `AfdaDownloads` is responsible for the **section → article** drill-down within that website.

---

## Layout

Three-column horizontal flex container:

```
[ Sections Sidebar (25%) ] [ Article List (35%) ] [ Article Preview (40%) ]
```

- Sections sidebar is always visible.
- Article list appears when a section is selected.
- Article preview panel appears when an article is selected; before that, the left two columns fill the available width.

---

## Data Model

All data is local to the component (dummy data standing in for the real package response). No store changes.

```ts
interface AfdaArticle {
  title: string;
  content: string;
  author: string;
  upload_date: string;   // ISO string
  word_count: number;
  link: string;
}

interface AfdaSectionEntry {
  last_checked: string;  // ISO string
  link: string;
  articles: AfdaArticle[];
}

type AfdaSections = Record<string, AfdaSectionEntry>;
```

The existing `afdaSections` constant is updated to match this shape with realistic placeholder values covering: Economics, Technology, Science, Arts, Sports.

---

## Component State

```ts
const [selectedSection, setSelectedSection] = useState<string | null>(null);
const [selectedArticle, setSelectedArticle] = useState<AfdaArticle | null>(null);
```

Selecting a new section resets `selectedArticle` to `null`.

---

## Column Details

### Sections Sidebar
Each row displays:
- Section name (bold)
- Article count (`articles.length` + "articles" label)
- Last checked (formatted relative time via `formatRelativeTime`)
- External link icon (opens `link` in browser)

Active section: highlighted with primary-color left border + subtle background tint.

### Article List
Rendered when `selectedSection !== null`. Each row displays:
- Title (bold)
- Truncated content preview (1–2 lines, muted)
- Author + upload date (small, muted row)

Clicking a row sets `selectedArticle`.

### Article Preview Panel
Rendered when `selectedArticle !== null`. Displays:
- Title (heading)
- Full content
- Author
- Upload date (formatted)
- Word count
- Link (as clickable text)
- Two action buttons:
  - **Share** — copies `link` to clipboard
  - **Open in Browser** — calls `window.open(link, '_blank')`

---

## Empty States

- No section selected: article list area shows "Select a section to view articles."
- No article selected: preview panel is hidden (columns expand to fill).
- No sections available: full-width message "No articles downloaded yet."

---

## Out of Scope

- Fetching live article data (`fetchArticle()`) — not used here.
- Connecting to the Zustand store for article/section data — remains local dummy data.
- Download action from the preview panel — deferred to a future task.
