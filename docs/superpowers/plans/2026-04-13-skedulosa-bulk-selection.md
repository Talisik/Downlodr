# Skedulosa Bulk Row Selection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-row checkboxes and a select-all to the Skedulosa schedule table, with bulk Delete / Pause / Resume actions shown in the taskbar when rows are selected.

**Architecture:** Selection state (`selectedChannelIds: string[]`) lives in `useSkedulosaStore` so `SkedulosaSchedulePage` (table) and `SkedulosaTableTaskbar` (actions) can both read it without prop drilling. The checkbox column is a fixed `<th>`/`<td>` rendered before the resizable column loop. The taskbar conditionally replaces its left stats with a bulk-action bar.

**Tech Stack:** React, Zustand, Tailwind CSS, `react-icons`

---

## File Map

| File | Change |
|---|---|
| `src/skedulosa/store/skedulosaStore.tsx` | Add `selectedChannelIds`, `toggleChannelSelection`, `selectAllChannels`, `clearSelection`, `bulkDeleteSubscriptions`, `bulkPauseSubscriptions`, `bulkResumeSubscriptions` to state interface + implementation |
| `src/skedulosa/pages/SkedulosaSchedulePage.tsx` | Add fixed checkbox `<th>` in header, fixed checkbox `<td>` in each row, wire to store selection actions |
| `src/skedulosa/components/table/SkedulosaTableTaskbar.tsx` | Read `selectedChannelIds` from store; conditionally replace left stats with bulk action bar |

---

## Task 1: Add selection state and bulk actions to the store

**Files:**
- Modify: `src/skedulosa/store/skedulosaStore.tsx`

### Step 1.1 — Add fields and action signatures to `SkedulosaStoreState`

In `skedulosaStore.tsx`, find the `interface SkedulosaStoreState` block (around line 281). Add these entries after the `stopScheduleTicker` line and before the `scrapingChannels` line:

```typescript
  /** IDs of channels currently selected in the table. Not persisted. */
  selectedChannelIds: string[];
  toggleChannelSelection: (id: string) => void;
  selectAllChannels: (ids: string[]) => void;
  clearSelection: () => void;
  /** Delete subscriptions by ID, including bridge cleanup. */
  bulkDeleteSubscriptions: (ids: string[]) => Promise<void>;
  /** Pause subscriptions by ID (sets status to 'Paused' + bridge call). */
  bulkPauseSubscriptions: (ids: string[]) => Promise<void>;
  /** Resume subscriptions by ID (sets status to 'Active' + bridge call). */
  bulkResumeSubscriptions: (ids: string[]) => Promise<void>;
```

- [ ] Add the above signatures to the interface.

---

### Step 1.2 — Implement the new actions in the store

Find the `create<SkedulosaStoreState>()(` block (around line 531). After the `removeChannelScraping` implementation and before the closing `})`, add:

```typescript
      selectedChannelIds: [],
      toggleChannelSelection: (id: string) => {
        set((state) => {
          const exists = state.selectedChannelIds.includes(id);
          return {
            selectedChannelIds: exists
              ? state.selectedChannelIds.filter((x) => x !== id)
              : [...state.selectedChannelIds, id],
          };
        });
      },
      selectAllChannels: (ids: string[]) => set({ selectedChannelIds: ids }),
      clearSelection: () => set({ selectedChannelIds: [] }),
      bulkDeleteSubscriptions: async (ids: string[]) => {
        const bridge = window.skedulosaBridge;
        for (const id of ids) {
          const sub = get().getSubscription(id);
          get().removeSubscription(id);
          if (bridge && sub) {
            const calls: Promise<unknown>[] = [];
            if (sub.toolkit_channel_id != null)
              calls.push(bridge.deleteChannel(sub.toolkit_channel_id));
            if (sub.toolkit_schedule_id != null)
              calls.push(bridge.deleteSchedule(sub.toolkit_schedule_id));
            if (calls.length > 0) {
              await Promise.all(calls).catch((err) =>
                console.error('[skedulosaStore] bulkDelete bridge failed:', err),
              );
            }
          }
        }
        set({ selectedChannelIds: [] });
      },
      bulkPauseSubscriptions: async (ids: string[]) => {
        const bridge = window.skedulosaBridge;
        for (const id of ids) {
          const sub = get().getSubscription(id);
          if (!sub) continue;
          if (sub.toolkit_channel_id != null) {
            await bridge
              ?.setChannelActive(sub.toolkit_channel_id, false)
              .catch((err) =>
                console.error('[skedulosaStore] bulkPause bridge failed:', err),
              );
          }
          get().updateSubscription(id, { ...sub, status: 'Paused' });
        }
        set({ selectedChannelIds: [] });
      },
      bulkResumeSubscriptions: async (ids: string[]) => {
        const bridge = window.skedulosaBridge;
        for (const id of ids) {
          const sub = get().getSubscription(id);
          if (!sub) continue;
          if (sub.toolkit_channel_id != null) {
            await bridge
              ?.setChannelActive(sub.toolkit_channel_id, true)
              .catch((err) =>
                console.error('[skedulosaStore] bulkResume bridge failed:', err),
              );
          }
          get().updateSubscription(id, { ...sub, status: 'Active' });
        }
        set({ selectedChannelIds: [] });
      },
```

- [ ] Add the above implementations into the store's `create` call body.

> **Note:** `selectedChannelIds` is not added to `partialize` — selection is intentionally transient and should not survive a page reload.

---

### Step 1.3 — Verify TypeScript compiles

Run:
```bash
yarn tsc --noEmit
```
Expected: no new errors related to `selectedChannelIds`, `toggleChannelSelection`, `selectAllChannels`, `clearSelection`, `bulkDeleteSubscriptions`, `bulkPauseSubscriptions`, or `bulkResumeSubscriptions`.

- [ ] Run type check and confirm no new errors.

---

## Task 2: Add checkbox column to the schedule table

**Files:**
- Modify: `src/skedulosa/pages/SkedulosaSchedulePage.tsx`

### Step 2.1 — Read selection state from the store

In `SkedulosaSchedulePage`, find the block of `useSkedulosaStore` calls near the top of the component (around line 155). Add these after the `sortDirection` line:

```typescript
  const selectedChannelIds = useSkedulosaStore((s) => s.selectedChannelIds);
  const toggleChannelSelection = useSkedulosaStore((s) => s.toggleChannelSelection);
  const selectAllChannels = useSkedulosaStore((s) => s.selectAllChannels);
  const clearSelection = useSkedulosaStore((s) => s.clearSelection);
```

Also add a `useMemo` for O(1) lookup after those lines:

```typescript
  const selectedSet = useMemo(
    () => new Set(selectedChannelIds),
    [selectedChannelIds],
  );
```

- [ ] Add the four store selectors and the `selectedSet` memo.

---

### Step 2.2 — Derive select-all checkbox state

Add this `useMemo` after `selectedSet`, before the `if (filteredChannels.length === 0)` guard:

```typescript
  const visibleIds = useMemo(() => rows.map((r) => r.channel.id), [rows]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const someSelected = !allSelected && visibleIds.some((id) => selectedSet.has(id));
```

- [ ] Add the three derived values.

---

### Step 2.3 — Add select-all checkbox ref

Add a ref at the top of the component (alongside other `useState`/`useRef` calls):

```typescript
  const selectAllRef = useRef<HTMLInputElement>(null);
```

Add a `useEffect` to sync the indeterminate state:

```typescript
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);
```

- [ ] Add the ref and effect.

---

### Step 2.4 — Add the header checkbox `<th>`

Find the `<thead>` block (around line 264). The `<tr>` currently opens and immediately begins the `columns.map(...)`. Add a fixed `<th>` as the first child of `<tr>`, before `{columns.map(...)}`:

```tsx
<th
  className="bg-toggleGroupBaseColor dark:bg-darkModeCompliment rounded-tl-lg"
  style={{ width: 36, minWidth: 36 }}
>
  <div className="flex items-center justify-center">
    <input
      ref={selectAllRef}
      type="checkbox"
      checked={allSelected}
      onChange={() => {
        if (allSelected) {
          clearSelection();
        } else {
          selectAllChannels(visibleIds);
        }
      }}
      className="w-3.5 h-3.5 accent-primary cursor-pointer"
    />
  </div>
</th>
```

Also update the existing first `ResizableHeader` (the one with `i === 0`) to remove `rounded-tl-lg` from its className since the new `<th>` now owns that corner. The `className` prop on `ResizableHeader` currently reads:

```tsx
className={`bg-toggleGroupBaseColor dark:bg-darkModeCompliment ${
  i === 0 ? 'rounded-tl-lg' : ''
} ${i === columns.length - 1 ? 'rounded-tr-lg' : ''}`}
```

Change it to:

```tsx
className={`bg-toggleGroupBaseColor dark:bg-darkModeCompliment ${
  i === columns.length - 1 ? 'rounded-tr-lg' : ''
}`}
```

- [ ] Add the `<th>` and remove `rounded-tl-lg` from the `ResizableHeader` className expression.

---

### Step 2.5 — Add the per-row checkbox `<td>`

Find the `<tr>` for each row in `<tbody>` (around line 315). Add a `<td>` as the first child of `<tr>`, before `{columns.map(...)}`:

```tsx
<td
  style={{ width: 36, minWidth: 36 }}
  onClick={(e) => {
    e.stopPropagation();
    toggleChannelSelection(channel.id);
  }}
  className="px-0 py-3"
>
  <div className="flex items-center justify-center">
    <input
      type="checkbox"
      checked={selectedSet.has(channel.id)}
      onChange={() => toggleChannelSelection(channel.id)}
      onClick={(e) => e.stopPropagation()}
      className="w-3.5 h-3.5 accent-primary cursor-pointer"
    />
  </div>
</td>
```

> **Why two `stopPropagation` calls?** The `<td>` onClick stops the `<tr>` navigate handler. The `<input>` onClick stops the `<td>` from double-firing.

- [ ] Add the checkbox `<td>` as the first cell in each body row.

---

### Step 2.6 — Add `useRef` to imports

Confirm `useRef` is imported in the file. The current import line is:

```typescript
import { useMemo, useState, useCallback } from 'react';
```

Update to:

```typescript
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
```

- [ ] Update the React import.

---

### Step 2.7 — Verify TypeScript compiles

```bash
yarn tsc --noEmit
```

- [ ] Confirm no new errors.

---

## Task 3: Add bulk action bar to the taskbar

**Files:**
- Modify: `src/skedulosa/components/table/SkedulosaTableTaskbar.tsx`

### Step 3.1 — Read selection state and bulk actions from the store

In `SkedulosaTableTaskbar`, find the block of `useSkedulosaStore` calls (around line 55). Add after `setSortDirection`:

```typescript
  const selectedChannelIds = useSkedulosaStore((s) => s.selectedChannelIds);
  const clearSelection = useSkedulosaStore((s) => s.clearSelection);
  const bulkDeleteSubscriptions = useSkedulosaStore((s) => s.bulkDeleteSubscriptions);
  const bulkPauseSubscriptions = useSkedulosaStore((s) => s.bulkPauseSubscriptions);
  const bulkResumeSubscriptions = useSkedulosaStore((s) => s.bulkResumeSubscriptions);
```

- [ ] Add the five store selectors.

---

### Step 3.2 — Add bulk action icons to imports

Add `FiTrash2`, `FiPause`, `FiPlay`, and `FiX` to the react-icons import. The current import is:

```typescript
import { FiSearch, FiX } from 'react-icons/fi';
```

Update to:

```typescript
import { FiSearch, FiX, FiTrash2, FiPause, FiPlay } from 'react-icons/fi';
```

- [ ] Update the `react-icons/fi` import.

---

### Step 3.3 — Replace left stats with bulk action bar when rows are selected

Find the `{/* Left: stats */}` comment block (around line 131). It currently renders unconditionally. Replace the entire left stats `<div>` with a conditional:

```tsx
{/* Left: stats or bulk actions */}
{selectedChannelIds.length > 0 ? (
  <div className="flex flex-row gap-3 items-center px-2 text-[12px]">
    <span className="text-gray-500 font-medium">
      {selectedChannelIds.length} selected
    </span>
    <button
      onClick={() => bulkDeleteSubscriptions(selectedChannelIds)}
      className="flex items-center gap-1 px-3 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
    >
      <FiTrash2 size={13} />
      Delete
    </button>
    <button
      onClick={() => bulkPauseSubscriptions(selectedChannelIds)}
      className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-darkModeCompliment dark:text-gray-300 dark:hover:bg-darkModeCompliment/80 transition-colors"
    >
      <FiPause size={13} />
      Pause
    </button>
    <button
      onClick={() => bulkResumeSubscriptions(selectedChannelIds)}
      className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-darkModeCompliment dark:text-gray-300 dark:hover:bg-darkModeCompliment/80 transition-colors"
    >
      <FiPlay size={13} />
      Resume
    </button>
    <button
      onClick={clearSelection}
      className="flex items-center gap-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors ml-1"
      title="Clear selection"
    >
      <FiX size={14} />
    </button>
  </div>
) : (
  <div className="flex flex-row gap-4 text-[12px] px-2">
    {/* existing stats content unchanged */}
    <div className="flex flex-row gap-1 items-center justify-center">
      <span className="text-gray-500">
        <LuDownload className="text-gray-500" />
      </span>
      <span className="font-bold">
        {getScheduledDownloadsCountToday(subscriptions)}
      </span>{' '}
      <span className="text-gray-500">today</span> /{' '}
      <span className="font-bold">{subscriptions.length}</span>{' '}
      <span className="text-gray-500">this week</span>
    </div>

    <div className="flex flex-row gap-1 items-center justify-center">
      <span className="text-gray-500">
        <LuHardDrive className="text-gray-500" />
      </span>
      <span className="font-bold">
        {formatBytesToHuman(getTotalStorageUsedBytes(subscriptions))}
      </span>{' '}
      <span className="text-gray-500">used</span>
    </div>

    <div className="flex flex-row gap-1 items-center justify-center">
      <span className="text-gray-500">
        <LuClock4 className="text-gray-500" />
      </span>
      <span className="text-gray-500">Next check in</span>
      <span className="font-bold">{soonestNextRun}</span>
    </div>
  </div>
)}
```

- [ ] Replace the left stats `<div>` with the conditional above.

---

### Step 3.4 — Verify TypeScript compiles

```bash
yarn tsc --noEmit
```

- [ ] Confirm no new errors.

---

## Task 4: Manual smoke test

Start the app and verify end-to-end:

```bash
yarn start
```

- [ ] Navigate to the Skedulosa schedule page — confirm a checkbox column appears as the first column with no label.
- [ ] Click one row checkbox — confirm it checks, the taskbar left area switches to `"1 selected  Delete  Pause  Resume  ✕"`.
- [ ] Click the header checkbox — confirm all visible rows check and the count updates.
- [ ] Click the header checkbox again — confirm all rows deselect and stats return.
- [ ] Select two rows and click **Pause** — confirm both rows show `Paused` status, selection clears.
- [ ] Select those same rows and click **Resume** — confirm both rows show `Active` status.
- [ ] Select a row and click **Delete** — confirm the row disappears and selection clears.
- [ ] Click the `✕` button in the bulk bar — confirm it clears selection without deleting.
- [ ] Click a row body (not the checkbox) — confirm navigation to the subscription detail page still works.
