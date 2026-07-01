# Selection Scoped to Filter Context — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make multi-select checkboxes in the Downloads list automatically clear when the filter context changes, remove silent persistence across restarts, and add a persistent "N selected · Clear" bar so users always know what's selected.

**Architecture:** Selection state lives in `selectedDownloadStore` (Zustand). Today it is persisted to IndexedDB — we remove that so selection is ephemeral in-memory only. Filter-context change detection is done via `useEffect` hooks in each page component that watches the active filter values. A new `SelectionBar` component is rendered above the table whenever `selectedRowIds.length > 0`.

**Tech Stack:** React, Zustand, React Router v6 (`useLocation`, `useParams`), Tailwind CSS, TypeScript. No test framework is installed — verification is manual in the running app.

## Global Constraints

- Do not add IndexedDB or localStorage persistence anywhere for selection state.
- Do not clear selection on sort-column / sort-direction change (keep selection on sort, clear on filter).
- `selectedDownloadStore` interface must not change — same public methods, same call sites.
- All Tailwind classes must match existing patterns (dark mode via `dark:` prefix, same orange `#E8622A` for primary buttons).
- No new npm dependencies.

---

### Task 1: Remove IndexedDB Persistence from selectedDownloadStore

**Files:**
- Modify: `src/core-app/store/selectedDownloadStore.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: same `useSelectedDownloadStore` hook, same public API — `selectedRowIds`, `selectedDownloads`, `setSelectedRowIds`, `setSelectedDownloads`, `clearAllSelections`, `clearSelectedDownloads`, `clearSelectedRows`, `getSelectedWithStatusCount`. Removing persistence does not change any call site.

The store currently wraps its state in `persist(...)` with an IndexedDB adapter. Remove the entire `persist` wrapper and its imports so the store is plain in-memory Zustand.

- [ ] **Step 1: Open the file and locate the persist wrapper**

  File: `src/core-app/store/selectedDownloadStore.tsx`

  Lines 13–15 import `createIndexedDBStorageWithMigration`, `createJSONStorage`, and `persist`.
  Lines 47–103 wrap the store in `persist(...)`.

- [ ] **Step 2: Replace the file content**

  Replace the entire store definition (lines 47–103) with a plain `create` call:

  ```typescript
  // src/core-app/store/selectedDownloadStore.tsx

  import { create } from 'zustand';

  interface SelectedDownload {
    id: string;
    controllerId?: string;
    location?: string;
    videoUrl?: string;
    downloadName?: string;
    status?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    download?: any;
  }

  interface SelectedDownloadStore {
    getSelectedWithStatusCount: () => number;
    selectedDownloads: SelectedDownload[];
    setSelectedDownloads: (downloads: SelectedDownload[]) => void;
    clearSelectedDownloads: () => void;
    selectedRows: string[];
    setSelectedRows: (rows: string[]) => void;
    clearSelectedRows: () => void;
    selectedRowIds: string[];
    setSelectedRowIds: (rows: string[]) => void;
    clearAllSelections: () => void;
  }

  export const useSelectedDownloadStore = create<SelectedDownloadStore>()(
    (set, get) => ({
      selectedDownloads: [] as SelectedDownload[],
      setSelectedDownloads: (downloads) => set({ selectedDownloads: downloads }),
      clearSelectedDownloads: () => set({ selectedDownloads: [] }),

      selectedRows: [] as string[],
      setSelectedRows: (rows) => set({ selectedRows: rows }),
      clearSelectedRows: () => set({ selectedRows: [] }),

      getSelectedWithStatusCount: () =>
        get().selectedRowIds.filter((id) =>
          get().selectedDownloads.some((d) => d.id === id && d.status),
        ).length,

      selectedRowIds: [] as string[],
      setSelectedRowIds: (rows) =>
        set(() => {
          const selectedDownloadsData: SelectedDownload[] = rows.map((id) => ({
            id,
            controllerId: undefined as string | undefined,
            location: undefined as string | undefined,
            videoUrl: undefined as string | undefined,
            downloadName: undefined as string | undefined,
            status: undefined as string | undefined,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            download: undefined as any | undefined,
          }));
          return { selectedRowIds: rows, selectedDownloads: selectedDownloadsData };
        }),

      clearAllSelections: () =>
        set({ selectedDownloads: [], selectedRowIds: [] }),
    }),
  );
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`

  Expected: no errors related to `selectedDownloadStore`.

- [ ] **Step 4: Manual verify — selection does not survive app restart**

  Start the app, select 2 rows, quit, relaunch.
  Expected: no rows selected on relaunch.

- [ ] **Step 5: Commit**

  ```bash
  git add src/core-app/store/selectedDownloadStore.tsx
  git commit -m "fix: make download selection ephemeral — remove IndexedDB persistence"
  ```

---

### Task 2: Clear Selection on Filter Change in StatusPage

**Files:**
- Modify: `src/downlodr/pages/StatusPage.tsx`

**Interfaces:**
- Consumes: `clearAllSelections` from `useSelectedDownloadStore` (already imported line 12), `currentStatus` from `useParams` (line 54–55), `isSearchActive`/`searchQuery` from `taskbarDownloadStore` (line 145–146).
- Produces: no new exports; adds two `useEffect` hooks inside `StatusSpecificDownloads`.

- [ ] **Step 1: Find where to add the effect**

  Open `src/downlodr/pages/StatusPage.tsx`. Locate the block starting at line 145:
  ```typescript
  const searchState = useTaskbarDownloadStore((state) => state.searchState);
  const { isSearchActive, searchQuery, searchResults } = searchState;
  ```
  The `clearAllSelections` selector is NOT currently wired in this component — it's only in the store. You need to add it.

- [ ] **Step 2: Add clearAllSelections selector**

  Below the existing selection selectors (around line 126), add:
  ```typescript
  const clearAllSelections = useSelectedDownloadStore(
    (state) => state.clearAllSelections,
  );
  ```

- [ ] **Step 3: Add the filter-change clear effect**

  After the `transitionTimeoutRef` line (line 148), add:

  ```typescript
  // Clear selection when the filter context changes (different status or search query).
  useEffect(() => {
    clearAllSelections();
  }, [currentStatus, isSearchActive, searchQuery]);
  ```

  Do NOT include `clearAllSelections` in the dependency array — it is a stable Zustand action reference and adding it causes an infinite loop.

- [ ] **Step 4: Manual verify — status change clears selection**

  Run the app. Navigate to Downloads > All. Select 3 rows. Click "Downloading" in the sidebar.
  Expected: selection is cleared (no checkboxes checked, "N selected" bar disappears if it already exists).

  Then try: select rows → run a search → expected: selection clears.

- [ ] **Step 5: Commit**

  ```bash
  git add src/downlodr/pages/StatusPage.tsx
  git commit -m "fix: clear download selection when status or search filter changes"
  ```

---

### Task 3: Clear Selection on Filter Change in CategoryTagPage

**Files:**
- Modify: `src/downlodr/pages/CategoryTagPage.tsx`

**Interfaces:**
- Consumes: `clearAllSelections` from `useSelectedDownloadStore` (must be imported), `categoryId` prop (string | undefined), `isSearchActive`/`taskbarQuery` already accessed at line 76–79.
- Produces: no new exports.

- [ ] **Step 1: Add clearAllSelections to CategoryTagPage**

  Open `src/downlodr/pages/CategoryTagPage.tsx`. The file imports `useSelectedDownloadStore` at line ~16. Add the selector inside the component body, after the existing `useSelectedDownloadStore` selectors:

  ```typescript
  const clearAllSelections = useSelectedDownloadStore(
    (state) => state.clearAllSelections,
  );
  ```

- [ ] **Step 2: Add a useEffect import if not present**

  The file imports `useEffect` from React (line 36 already includes it — verify).

- [ ] **Step 3: Add the filter-change clear effect**

  After the `clearSearch` selector (line 80), add:

  ```typescript
  useEffect(() => {
    clearAllSelections();
  }, [categoryId, isSearchActive, taskbarQuery]);
  ```

- [ ] **Step 4: Manual verify**

  Run the app. Navigate to a category (e.g., "Work"). Select 2 rows. Click a different category ("Personal").
  Expected: selection clears.

  Also test: select rows in a category → activate search → expected: selection clears.

- [ ] **Step 5: Commit**

  ```bash
  git add src/downlodr/pages/CategoryTagPage.tsx
  git commit -m "fix: clear download selection when category/tag filter changes"
  ```

---

### Task 4: Clear Selection on Top-Level Tab Switch and Esc Key

**Files:**
- Modify: `src/core-app/layout/DownloadLayout.tsx`

**Interfaces:**
- Consumes: `clearAllSelections` from `useSelectedDownloadStore` (already imported at line 51–53), `location` from `useLocation` (already at line 57).
- Produces: no new exports.

The layout already imports `clearAllSelections` and `useLocation` but never calls `clearAllSelections`. We wire it up to top-level path changes and the Esc key.

- [ ] **Step 1: Add the tab-switch clear effect**

  Open `src/core-app/layout/DownloadLayout.tsx`. After the existing declarations (around line 58), add:

  ```typescript
  // Extract the top-level route segment (e.g. "downloads", "plugins", "subscriptions").
  const topSegment = location.pathname.split('/')[1] ?? '';

  useEffect(() => {
    clearAllSelections();
  }, [topSegment]);
  ```

  You need to import `useEffect` from React if not already imported — check the existing imports at the top of the file and add `useEffect` to the React import if missing.

- [ ] **Step 2: Add the Esc key clear effect**

  In the same component body, add:

  ```typescript
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearAllSelections();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearAllSelections]);
  ```

  Here `clearAllSelections` IS stable (Zustand action), but including it satisfies the linter without causing re-runs.

- [ ] **Step 3: Manual verify — tab switch**

  Select 3 rows in Downloads. Click "Plugins" in the nav.
  Expected: selection clears.

  Navigate back to Downloads — expected: still no selection.

- [ ] **Step 4: Manual verify — Esc key**

  Select 3 rows. Press Esc.
  Expected: selection clears.

- [ ] **Step 5: Commit**

  ```bash
  git add src/core-app/layout/DownloadLayout.tsx
  git commit -m "fix: clear selection on top-level tab switch and Esc key"
  ```

---

### Task 5: Prune Stale Items from Selection When allDownloads Changes

**Files:**
- Modify: `src/downlodr/pages/StatusPage.tsx`
- Modify: `src/downlodr/pages/CategoryTagPage.tsx`

**Interfaces:**
- Consumes: `selectedRowIds` (already in both components), `setSelectedRowIds` (already in both), `allDownloads` memoized list (already in both).
- Produces: no new exports.

When a download finishes and the current filter hides it (e.g., "Downloading" filter, item completes), it should be removed from selection automatically. This effect fires when `allDownloads` changes and removes any selected ID not present in the new list.

- [ ] **Step 1: Add the stale-item pruning effect to StatusPage**

  Open `src/downlodr/pages/StatusPage.tsx`. After the filter-change effect added in Task 2, add:

  ```typescript
  useEffect(() => {
    if (selectedRowIds.length === 0) return;
    const visibleIds = new Set(allDownloads.map((d) => d.id));
    const still = selectedRowIds.filter((id) => visibleIds.has(id));
    if (still.length !== selectedRowIds.length) {
      setSelectedRowIds(still);
    }
  }, [allDownloads]);
  ```

  Do NOT add `selectedRowIds` or `setSelectedRowIds` to the dependency array — the effect only needs to fire when the list changes, not when selection changes (that would create a loop).

- [ ] **Step 2: Add the same effect to CategoryTagPage**

  Open `src/downlodr/pages/CategoryTagPage.tsx`. Identify where `allDownloads` and `selectedRowIds` are available in the component. The filtered `downloads` prop is the equivalent — call it `downloads` for the effect:

  ```typescript
  useEffect(() => {
    if (selectedRowIds.length === 0) return;
    const visibleIds = new Set(downloads.map((d) => d.id));
    const still = selectedRowIds.filter((id) => visibleIds.has(id));
    if (still.length !== selectedRowIds.length) {
      setSelectedRowIds(still);
    }
  }, [downloads]);
  ```

  Verify `selectedRowIds` and `setSelectedRowIds` are already pulled from the store in this component. If not, add:
  ```typescript
  const selectedRowIds = useSelectedDownloadStore((s) => s.selectedRowIds);
  const setSelectedRowIds = useSelectedDownloadStore((s) => s.setSelectedRowIds);
  ```

- [ ] **Step 3: Manual verify**

  Start a download. Switch to the "Downloading" filter. Select the active download row. Let it finish (or mark it finished manually via context menu → the row will disappear from "Downloading").
  Expected: the count in the "N selected" bar drops by 1 (or clears if it was the only item).

- [ ] **Step 4: Commit**

  ```bash
  git add src/downlodr/pages/StatusPage.tsx src/downlodr/pages/CategoryTagPage.tsx
  git commit -m "fix: prune stale items from selection when downloads leave the current filter"
  ```

---

### Task 6: Create the SelectionBar Component

**Files:**
- Create: `src/downlodr/components/base/SelectionBar.tsx`

**Interfaces:**
- Consumes: nothing from app stores — props only.
- Produces: `SelectionBar` — a React FC with props:
  ```typescript
  interface SelectionBarProps {
    count: number;       // number of selected items
    onClear: () => void; // called when × is clicked
  }
  ```

- [ ] **Step 1: Create the file**

  ```typescript
  // src/downlodr/components/base/SelectionBar.tsx
  import React from 'react';
  import { LuX } from 'react-icons/lu';

  interface SelectionBarProps {
    count: number;
    onClear: () => void;
  }

  const SelectionBar: React.FC<SelectionBarProps> = ({ count, onClear }) => {
    if (count === 0) return null;
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-sm text-gray-700 dark:text-gray-200 flex-shrink-0">
        <span className="font-medium text-orange-700 dark:text-orange-400">
          {count} {count === 1 ? 'item' : 'items'} selected
        </span>
        <button
          onClick={onClear}
          className="ml-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
          aria-label="Clear selection"
        >
          <LuX size={13} />
          Clear
        </button>
      </div>
    );
  };

  export default SelectionBar;
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/downlodr/components/base/SelectionBar.tsx
  git commit -m "feat: add SelectionBar component for persistent selection count + clear"
  ```

---

### Task 7: Integrate SelectionBar and Fix Header Checkbox in StatusPageTable

**Files:**
- Modify: `src/downlodr/pages/status/StatusPageTable.tsx`
- Modify: `src/downlodr/pages/status/StatusPageTableHeader.tsx`
- Modify: `src/downlodr/pages/StatusPage.tsx`

**Interfaces:**
- `StatusPageTable` gains one new required prop: `onClearSelection: () => void`
- `StatusPageTableHeader` gains two new required props: `pageRowIds: string[]`, `onClearSelection: () => void` (used internally to tell header to render the new indeterminate logic)
- `StatusPage.tsx` passes `clearAllSelections` as `onClearSelection` to `StatusPageTable`
- `onSelectAll` in `StatusPage.tsx` is updated to toggle only the current page's IDs

**Sub-task A: Update StatusPageTableHeader to use page-scoped checkbox**

The header currently checks `selectedRowIdsLength === allDownloadsLength`. This compares selection against ALL downloads across all pages, which is wrong. Change it to compare against `pageRowIds` (the IDs visible on the current page).

- [ ] **Step A1: Add `pageRowIds` and `onClearSelection` to the header's props interface**

  Open `src/downlodr/pages/status/StatusPageTableHeader.tsx`. In the `StatusPageTableHeaderProps` interface (line 10), add:

  ```typescript
  pageRowIds: string[];
  onClearSelection: () => void;
  ```

  Also update the destructure at line 50:
  ```typescript
  export const StatusPageTableHeader: React.FC<StatusPageTableHeaderProps> = ({
    // ...existing props...
    pageRowIds,
    onClearSelection,
  }) => (
  ```

- [ ] **Step A2: Update the header checkbox to use pageRowIds**

  Replace lines 85–90 (the `checked` and `onChange` on the header `<input>`):

  ```tsx
  <input
    type="checkbox"
    className="mt-2 ml-2 rounded custom-white-checkmark"
    style={{
      ...(document.documentElement.classList.contains('dark') && {
        backgroundColor: '#272727',
        borderColor: '#6b7280',
      }),
    }}
    checked={
      pageRowIds.length > 0 &&
      pageRowIds.every((id) => selectedRowIds.includes(id))
    }
    ref={(el) => {
      if (el) {
        el.indeterminate =
          pageRowIds.some((id) => selectedRowIds.includes(id)) &&
          !pageRowIds.every((id) => selectedRowIds.includes(id));
      }
    }}
    onChange={onSelectAll}
  />
  ```

  This requires `selectedRowIds: string[]` to be added to the props interface too:
  ```typescript
  selectedRowIds: string[];
  ```
  And remove `selectedRowIdsLength: number` (no longer needed — the length was only used for the old `checked` check).

  Update the destructure to remove `selectedRowIdsLength` and add `selectedRowIds`:
  ```typescript
  selectedRowIds,
  pageRowIds,
  onClearSelection,
  ```

- [ ] **Step A3: Remove the old inline "(N items selected)" text from the header**

  In `StatusPageTableHeader.tsx`, find lines 119–125:
  ```tsx
  {column.id === 'name' && getSelectedWithStatusCount() > 0 && (
    <span className="text-xs">
      ({getSelectedWithStatusCount()}{' '}
      {getSelectedWithStatusCount() === 1 ? 'item' : 'items'}{' '}
      selected)
    </span>
  )}
  ```
  Delete these lines. The `SelectionBar` replaces this indicator. Also remove `getSelectedWithStatusCount` from the props interface and destructure.

**Sub-task B: Update StatusPageTable to pass pageRowIds and render SelectionBar**

- [ ] **Step B1: Import SelectionBar in StatusPageTable**

  At the top of `src/downlodr/pages/status/StatusPageTable.tsx`, add:
  ```typescript
  import SelectionBar from '@/downlodr/components/base/SelectionBar';
  ```

- [ ] **Step B2: Add onClearSelection to StatusPageTable's props interface**

  In the `StatusPageTableProps` interface (line 30), add:
  ```typescript
  onClearSelection: () => void;
  ```
  And add it to the destructure at line 72.

- [ ] **Step B3: Derive pageRowIds from renderItems**

  In the component body, after the `renderItems` memo (line 217), add:
  ```typescript
  const pageRowIds = useMemo(() => {
    const ids: string[] = [];
    for (const item of renderItems) {
      if (item.type === 'ungrouped') {
        ids.push(item.download.id);
      } else if (item.type === 'group') {
        ids.push(...item.downloads.map((d) => d.id));
      } else if (item.type === 'afda-group') {
        ids.push(...item.downloads.map((d) => d.id));
      }
    }
    return ids;
  }, [renderItems]);
  ```

- [ ] **Step B4: Render SelectionBar above the table**

  In the JSX, find the `<div className="flex-1 flex flex-row overflow-hidden min-w-0">` (line 234). Just above it (between the Toolbar and this div), add:

  ```tsx
  <SelectionBar count={selectedRowIds.length} onClear={onClearSelection} />
  ```

- [ ] **Step B5: Update StatusPageTableHeader call to pass new props**

  Find the `<StatusPageTableHeader .../>` call (line 250). Remove `selectedRowIdsLength={selectedRowIds.length}` and `getSelectedWithStatusCount={getSelectedWithStatusCount}`. Add:

  ```tsx
  selectedRowIds={selectedRowIds}
  pageRowIds={pageRowIds}
  onClearSelection={onClearSelection}
  ```

**Sub-task C: Update onSelectAll in StatusPage to be page-scoped**

The current `handleSelectAll` in `StatusPage.tsx` (line 482) toggles ALL downloads. We need it to toggle only the current page's items. But `StatusPage.tsx` doesn't know the current page — that lives in `StatusPageTable.tsx`.

The fix: change `onSelectAll` to accept the page IDs by adding a prop to `StatusPageTable` that calls back with the page IDs.

- [ ] **Step C1: Add onSelectPage prop to StatusPageTable**

  In `StatusPageTableProps`, add:
  ```typescript
  onSelectPage: (pageIds: string[], allPageSelected: boolean) => void;
  ```

  In the destructure, add `onSelectPage`.

- [ ] **Step C2: Replace the onSelectAll call in StatusPageTableHeader with a local handler**

  In `StatusPageTable.tsx`, change the `onSelectAll` prop passed to `StatusPageTableHeader` to a local handler:

  ```typescript
  const handleSelectAll = useCallback(() => {
    const allPageSelected = pageRowIds.every((id) =>
      selectedRowIds.includes(id),
    );
    onSelectPage(pageRowIds, allPageSelected);
  }, [pageRowIds, selectedRowIds, onSelectPage]);
  ```

  Then pass `handleSelectAll` as `onSelectAll` to `StatusPageTableHeader`:
  ```tsx
  onSelectAll={handleSelectAll}
  ```

  Remove the `onSelectAll` prop from `StatusPageTableProps` (or keep it as optional if other callers use it — check; it is currently required, so either keep as required and rename the page-scoped one, or replace entirely).

  **Simplest approach:** keep `onSelectAll` in the interface (so `StatusPage.tsx` doesn't break) but have `StatusPageTable` override it with `handleSelectAll` when passing to the header.

  Actually the cleanest is: `StatusPageTable` does NOT forward `onSelectAll` from its props to the header at all. Instead it creates its own `handleSelectAll` internally and passes that. Remove `onSelectAll` from `StatusPageTableProps` and replace with `onSelectPage`.

- [ ] **Step C3: Update handleSelectAll in StatusPage.tsx**

  Replace the old `handleSelectAll` (line 482–520) with one that handles the page-scoped toggle:

  ```typescript
  const handleSelectPage = useCallback(
    async (pageIds: string[], allPageSelected: boolean) => {
      let newSelected: string[];
      if (allPageSelected) {
        // Deselect page items, keep others
        newSelected = selectedRowIds.filter((id) => !pageIds.includes(id));
      } else {
        // Add page items to selection, preserve other pages
        const existing = new Set(selectedRowIds);
        pageIds.forEach((id) => existing.add(id));
        newSelected = Array.from(existing);
      }
      setSelectedRowIds(newSelected);

      const promises = newSelected.map(async (id) => {
        const download = allDownloads.find((d) => d.id === id);
        return {
          id,
          controllerId: download?.controllerId,
          videoUrl: download?.videoUrl,
          downloadName: download?.displayName,
          status: download?.status,
          download: download,
          location: download?.location
            ? await window.downlodrFunctions.joinDownloadPath(
                download.location,
                download.name,
              )
            : undefined,
        };
      });
      const resolvedDownloads = await Promise.all(promises);
      setSelectedDownloads(resolvedDownloads);
    },
    [selectedRowIds, allDownloads, setSelectedRowIds, setSelectedDownloads],
  );
  ```

  Then in the JSX (line ~878) replace `onSelectAll={handleSelectAll}` with `onSelectPage={handleSelectPage}` and remove `onSelectAll` from the props.

- [ ] **Step D: Pass onClearSelection from StatusPage to StatusPageTable**

  In the `StatusPageTable` JSX call (line ~870), add:
  ```tsx
  onClearSelection={clearAllSelections}
  ```

  `clearAllSelections` is already available (added in Task 2, Step 2).

- [ ] **Step E: Manual verify**

  1. Run the app. Select 3 rows on page 1. Navigate to page 2.
     Expected: the "3 items selected" bar is visible; the rows on page 2 are not checked.
  2. Tick the header checkbox on page 2.
     Expected: page 2 rows are added to selection. Count increases.
  3. Tick header checkbox again on page 2.
     Expected: page 2 rows deselected. Count returns to 3.
  4. Click "Clear" in the SelectionBar.
     Expected: all selection cleared, bar disappears.
  5. Select all → header checkbox checked.
     Expected: all page rows checked; header checkbox in checked (not indeterminate) state.
  6. Select partial page rows.
     Expected: header checkbox is in indeterminate state.

- [ ] **Step F: Commit**

  ```bash
  git add \
    src/downlodr/pages/status/StatusPageTable.tsx \
    src/downlodr/pages/status/StatusPageTableHeader.tsx \
    src/downlodr/pages/StatusPage.tsx \
    src/downlodr/components/base/SelectionBar.tsx
  git commit -m "feat: add persistent SelectionBar and fix header checkbox to page scope"
  ```

---

### Task 8: Integrate SelectionBar into CategoryTagPage

**Files:**
- Modify: `src/downlodr/pages/CategoryTagPage.tsx`

**Interfaces:**
- Consumes: `SelectionBar` from Task 6, `selectedRowIds` and `clearAllSelections` from `useSelectedDownloadStore`.
- Produces: no new exports.

`CategoryTagPage` manages its own table rendering (not via `StatusPageTable`). It needs the same SelectionBar treatment.

- [ ] **Step 1: Import SelectionBar**

  At the top of `src/downlodr/pages/CategoryTagPage.tsx`, add:
  ```typescript
  import SelectionBar from '@/downlodr/components/base/SelectionBar';
  ```

- [ ] **Step 2: Find where the table is rendered in CategoryTagPage**

  The component renders a `<StatusPageTableHeader>` and rows directly. Find the outer container that wraps the table and add `SelectionBar` between the toolbar and the table area.

  Locate the `<Toolbar>` render in the JSX. Immediately after it, add:
  ```tsx
  <SelectionBar count={selectedRowIds.length} onClear={clearAllSelections} />
  ```

- [ ] **Step 3: Fix header checkbox in CategoryTagPage to be page-scoped**

  `CategoryTagPage` renders `StatusPageTableHeader` directly. Find the call and:
  - Add `selectedRowIds={selectedRowIds}` prop
  - Add `pageRowIds={visiblePageIds}` where `visiblePageIds` is the IDs of rows on the current page
  - Add `onClearSelection={clearAllSelections}` prop
  - Remove `selectedRowIdsLength` and `getSelectedWithStatusCount` (removed in Task 7)

  Derive `visiblePageIds` in the CategoryTagPage component body:
  ```typescript
  const visiblePageIds = useMemo(
    () =>
      downloads
        .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
        .map((d) => d.id),
    [downloads, currentPage],
  );
  ```

  Update `onSelectAll` in CategoryTagPage to toggle the current page's items (same pattern as Task 7 Step C3, adapted for CategoryTagPage):
  ```typescript
  const handleSelectPage = useCallback(
    (pageIds: string[], allPageSelected: boolean) => {
      if (allPageSelected) {
        setSelectedRowIds(selectedRowIds.filter((id) => !pageIds.includes(id)));
      } else {
        const existing = new Set(selectedRowIds);
        pageIds.forEach((id) => existing.add(id));
        setSelectedRowIds(Array.from(existing));
      }
    },
    [selectedRowIds, setSelectedRowIds],
  );
  ```

  The CategoryTagPage does not resolve full download objects like StatusPage does (it has no async `joinDownloadPath` call in its selectAll), so the simpler version above is fine.

- [ ] **Step 4: Manual verify**

  Navigate to a Category page. Select some rows. Verify the SelectionBar appears with count. Click Clear — bar disappears. Select a mix of rows, tick the header — page rows added. Navigate to page 2 of the same category — count is preserved. Navigate to a different category — count clears.

- [ ] **Step 5: Commit**

  ```bash
  git add src/downlodr/pages/CategoryTagPage.tsx
  git commit -m "feat: add SelectionBar and page-scoped header checkbox to CategoryTagPage"
  ```

---

## Acceptance Criteria Checklist

After all tasks:

- [ ] Paging within the same filter preserves selection across pages (Task 7 — `onSelectPage` adds to existing selection).
- [ ] Changing Status filter clears selection (Task 2).
- [ ] Changing Category or Tag clears selection (Task 3).
- [ ] Running or changing a search query clears selection (Task 2 + 3).
- [ ] Switching top-level tab clears selection (Task 4).
- [ ] Completing any bulk action clears selection (already implemented in Toolbar.tsx — verify `clearAllSelections()` is called after delete, stop, play, convert actions).
- [ ] An item that leaves the current set is removed from the selection and the count updates (Task 5).
- [ ] Selection never survives an app restart (Task 1).
- [ ] A persistent "N selected · Clear" chip is shown whenever selection > 0 (Tasks 6, 7, 8).
- [ ] Esc clears selection (Task 4).
- [ ] Header checkbox is scoped to the current page — ticking it selects/deselects the visible page rows while preserving selection on other pages (Tasks 7, 8).
- [ ] Indeterminate state on header checkbox when some but not all page rows are selected (Task 7 Step A2).
- [ ] Sort-column change does NOT clear selection (no effect added for sort — verify sort works without clearing).
