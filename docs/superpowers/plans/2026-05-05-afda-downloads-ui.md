# AfdaDownloads Three-Level Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `AfdaDownloads.tsx` to render a three-column section → article → preview navigation driven by the `afdaSections` dummy data.

**Architecture:** Single-file change to `AfdaDownloads.tsx`. Local TypeScript interfaces define the richer data shape. Three columns rendered with a horizontal flex layout; article preview is conditionally shown only when an article is selected. All data stays local (no store changes).

**Tech Stack:** React, TypeScript, Tailwind CSS, `react-icons`, existing `formatRelativeTime` util.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/afda/pages/selectedTabPages/AfdaDownloads.tsx` | Full redesign — types, dummy data, layout, column components |

---

### Task 1: Define local types and update dummy data

**Files:**
- Modify: `src/afda/pages/selectedTabPages/AfdaDownloads.tsx`

- [ ] **Step 1: Replace the `afdaSections` constant and add types**

Replace everything between the imports and the `AfdaDownloadsProps` interface (lines 1–21 currently) with the following. Keep the existing imports, add `formatRelativeTime` import if not present (it already is).

At the top of the file, after all imports, add the local types and updated dummy data:

```tsx
interface AfdaArticle {
  title: string;
  content: string;
  author: string;
  upload_date: string;
  word_count: number;
  link: string;
}

interface AfdaSectionEntry {
  last_checked: string;
  link: string;
  articles: AfdaArticle[];
}

type AfdaSections = Record<string, AfdaSectionEntry>;

const AFDA_SECTIONS: AfdaSections = {
  Economics: {
    last_checked: new Date(Date.now() - 3600 * 1000).toISOString(),
    link: 'https://example.com/economics',
    articles: [
      {
        title: 'Global Markets Rally Amid Economic Recovery Hopes',
        content:
          'Stock markets worldwide are experiencing a surge as investors grow optimistic about the pace of economic recovery following recent positive data on employment and consumer spending.',
        author: 'Jane Doe',
        upload_date: new Date(Date.now() - 86400 * 1000).toISOString(),
        word_count: 820,
        link: 'https://example.com/economics/global-markets-rally',
      },
      {
        title: 'Central Bank Signals Potential Interest Rate Hike',
        content:
          'The central bank has indicated that it may raise interest rates sooner than expected due to rising inflationary pressures, sparking discussions among economists and investors.',
        author: 'John Smith',
        upload_date: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
        word_count: 610,
        link: 'https://example.com/economics/central-bank-rate-hike',
      },
    ],
  },
  Technology: {
    last_checked: new Date(Date.now() - 7200 * 1000).toISOString(),
    link: 'https://example.com/technology',
    articles: [
      {
        title: 'Tech Giant Unveils Revolutionary AI Chip',
        content:
          'A leading technology company has announced the release of a new artificial intelligence chip that promises to significantly enhance the performance of AI applications.',
        author: 'Alice Chen',
        upload_date: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
        word_count: 950,
        link: 'https://example.com/technology/ai-chip',
      },
      {
        title: 'Breakthrough in Quantum Computing Achieved',
        content:
          'Researchers have made a significant breakthrough in quantum computing, successfully demonstrating a new method for error correction that could pave the way for more stable quantum systems.',
        author: 'Bob Lee',
        upload_date: new Date(Date.now() - 4 * 86400 * 1000).toISOString(),
        word_count: 740,
        link: 'https://example.com/technology/quantum-computing',
      },
    ],
  },
  Science: {
    last_checked: new Date(Date.now() - 10800 * 1000).toISOString(),
    link: 'https://example.com/science',
    articles: [
      {
        title: 'New Study Reveals Link Between Diet and Heart Disease',
        content:
          'A comprehensive study has found a strong correlation between certain dietary habits and the risk of developing heart disease, highlighting the importance of a balanced diet.',
        author: 'Dr. Mary Fields',
        upload_date: new Date(Date.now() - 5 * 86400 * 1000).toISOString(),
        word_count: 1100,
        link: 'https://example.com/science/diet-heart-disease',
      },
    ],
  },
  Arts: {
    last_checked: new Date(Date.now() - 14400 * 1000).toISOString(),
    link: 'https://example.com/arts',
    articles: [
      {
        title: 'Local Artist Wins National Award',
        content:
          'A local artist has been recognized with a national award for their outstanding contribution to the arts, bringing pride to the community and inspiring emerging creators.',
        author: 'Carlos Rivera',
        upload_date: new Date(Date.now() - 6 * 86400 * 1000).toISOString(),
        word_count: 430,
        link: 'https://example.com/arts/local-artist-award',
      },
    ],
  },
  Sports: {
    last_checked: new Date(Date.now() - 1800 * 1000).toISOString(),
    link: 'https://example.com/sports',
    articles: [
      {
        title: 'Team Wins Championship Title',
        content:
          'The local team has clinched the championship title after an intense final match, celebrating a historic victory that fans have waited over a decade to witness.',
        author: 'Sam Torres',
        upload_date: new Date(Date.now() - 86400 * 1000).toISOString(),
        word_count: 560,
        link: 'https://example.com/sports/championship-title',
      },
    ],
  },
};
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run: `yarn lint`
Expected: no errors related to `AfdaArticle`, `AfdaSectionEntry`, or `AFDA_SECTIONS`.

- [ ] **Step 3: Commit**

```
git add src/afda/pages/selectedTabPages/AfdaDownloads.tsx
git commit -m "feat: add AfdaArticle/AfdaSectionEntry types and rich dummy data"
```

---

### Task 2: Replace component body with three-column layout

**Files:**
- Modify: `src/afda/pages/selectedTabPages/AfdaDownloads.tsx`

- [ ] **Step 1: Replace the entire `AfdaDownloads` component body**

Remove all existing state, sort logic, `downloads` memo, and the current `return` block. Replace with the following complete component:

```tsx
const AfdaDownloads = ({ channelId }: AfdaDownloadsProps) => {
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<AfdaArticle | null>(null);

  const sectionNames = Object.keys(AFDA_SECTIONS);

  if (sectionNames.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400 text-sm">
        No articles downloaded yet.
      </div>
    );
  }

  const handleSectionClick = (name: string) => {
    setSelectedSection(name);
    setSelectedArticle(null);
  };

  return (
    <div className="flex flex-row h-full overflow-hidden">
      {/* ── Sections Sidebar ── */}
      <div className="w-1/4 min-w-[160px] border-r border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0">
        {sectionNames.map((name) => {
          const section = AFDA_SECTIONS[name];
          const isActive = selectedSection === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => handleSectionClick(name)}
              className={`w-full text-left px-3 py-3 border-l-2 transition-colors ${
                isActive
                  ? 'border-primary bg-orange-50 dark:bg-orange-900/10'
                  : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                {name}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                {section.articles.length} article{section.articles.length !== 1 ? 's' : ''}
              </div>
              <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                {formatRelativeTime(section.last_checked)}
              </div>
              <a
                href={section.link}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-block mt-1 text-[10px] text-blue-500 hover:underline truncate max-w-full"
              >
                {section.link}
              </a>
            </button>
          );
        })}
      </div>

      {/* ── Article List ── */}
      <div
        className={`overflow-y-auto flex-shrink-0 border-r border-gray-200 dark:border-gray-700 transition-all ${
          selectedArticle ? 'w-[35%]' : selectedSection ? 'flex-1' : 'flex-1'
        }`}
      >
        {!selectedSection ? (
          <div className="flex items-center justify-center h-full py-12 text-gray-400 dark:text-gray-500 text-sm">
            Select a section to view articles.
          </div>
        ) : (
          AFDA_SECTIONS[selectedSection].articles.map((article, idx) => {
            const isActive = selectedArticle?.link === article.link;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedArticle(article)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 transition-colors ${
                  isActive
                    ? 'bg-orange-50 dark:bg-orange-900/10'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
                  {article.title}
                </div>
                <div className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                  {article.content}
                </div>
                <div className="flex gap-2 mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                  <span>{article.author}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(article.upload_date)}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* ── Article Preview ── */}
      {selectedArticle && (
        <div className="w-[40%] flex-shrink-0 overflow-y-auto px-5 py-4">
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100 leading-snug">
            {selectedArticle.title}
          </h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[12px] text-gray-500 dark:text-gray-400">
            <span>{selectedArticle.author}</span>
            <span>·</span>
            <span>{new Date(selectedArticle.upload_date).toLocaleDateString()}</span>
            <span>·</span>
            <span>{selectedArticle.word_count.toLocaleString()} words</span>
          </div>
          <p className="mt-4 text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
            {selectedArticle.content}
          </p>
          <a
            href={selectedArticle.link}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-3 text-[12px] text-blue-500 hover:underline break-all"
          >
            {selectedArticle.link}
          </a>
          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(selectedArticle.link)}
              className="px-3 py-1.5 text-[12px] rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Share
            </button>
            <button
              type="button"
              onClick={() => window.open(selectedArticle.link, '_blank')}
              className="px-3 py-1.5 text-[12px] rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Open in Browser
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Remove now-unused imports and dead code**

The following are no longer used after the rewrite — remove them:
- `LuTrash2`, `LuPlay` from `react-icons/lu`
- `HiChevronUpDown` from `react-icons/hi2`
- `useAfdaSubscriptionsStore` (if the subscription lookup is no longer needed — verify first)
- `Download` type from `@/skedulosa/store/skedulosaStore`
- `formatBytesToHuman` from `@/skedulosa/utils/subscriptionDownloadUtils`
- The old `StatusBadge` component
- `SORT_MAP`, `sortField`, `sortDirection`, `handleSortClick`, `downloads` memo, `COLS`, `COL_LABELS`

Keep: `useState`, `useMemo` (remove `useMemo` too if no longer used), `formatRelativeTime`.

- [ ] **Step 3: Run lint to confirm no TypeScript errors**

Run: `yarn lint`
Expected: clean output, no errors.

- [ ] **Step 4: Start dev server and manually verify**

Run: `yarn start`

Open the app, navigate to any AFDA subscription's Downloads tab and verify:
1. Left sidebar lists all 5 sections with article count, relative time, and link.
2. Clicking a section populates the middle column with articles.
3. Clicking an article shows the preview panel on the right.
4. Preview shows title, content, author, date, word count, link.
5. Share button copies the link to clipboard (check with Ctrl+V in another field).
6. Open in Browser button opens the link in a new tab.
7. Clicking a different section clears the article selection and preview.

- [ ] **Step 5: Commit**

```
git add src/afda/pages/selectedTabPages/AfdaDownloads.tsx
git commit -m "feat: implement three-column section > article > preview navigation in AfdaDownloads"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Layout (3 columns) ✓, data model (AfdaArticle + AfdaSectionEntry) ✓, sections sidebar fields (name, count, last_checked, link) ✓, article list fields (title, content, author, date) ✓, article preview fields (title, content, author, date, word count, link) ✓, Share + Open in Browser buttons ✓, empty states ✓
- [x] **Placeholders:** None — all code is complete.
- [x] **Type consistency:** `AfdaArticle` defined in Task 1, used in Task 2 component state and JSX — consistent throughout.
