# Skedulosa Bulk Row Selection — Design Spec

**Date:** 2026-04-13
**Status:** Approved

---

## Overview

Add per-row checkboxes and a select-all header checkbox to the Skedulosa schedule table. When one or more rows are selected, the left stats area of `SkedulosaTableTaskbar` is replaced with bulk action buttons: **Delete**, **Pause**, and **Resume**.

---

## Architecture

Selection state lives in `useSkedulosaStore` (Zustand). Both `SkedulosaSchedulePage` and `SkedulosaTableTaskbar` are siblings rendered via `<Outlet>` in `SkedulosaHome` and already share state through this store — no prop drilling or new context is needed.

---

## Components & Changes

### 1. `skedulosaStore.tsx` — selection state

Add the following to the store slice:

| Field / Action | Type | Description |
|---|---|---|
| `selectedChannelIds` | `string[]` | IDs of currently selected channels |
| `toggleChannelSelection(id)` | `(id: string) => void` | Add if absent, remove if present |
| `selectAllChannels(ids)` | `(ids: string[]) => void` | Replace array with given IDs |
| `clearSelection()` | `() => void` | Reset to empty array |

Store as `string[]` (not `Set`) — Zustand's persist middleware uses `JSON.stringify` which cannot serialise `Set`. Derive a `Set` at call sites via `useMemo` for O(1) lookup: `const selectedSet = useMemo(() => new Set(selectedChannelIds), [selectedChannelIds])`.

---

### 2. `SkedulosaSchedulePage.tsx` — checkbox column

**Column definition:**
- Do NOT add to `INITIAL_COLUMNS` — that array feeds `useResizableColumns` which makes columns draggable and resizable. The checkbox column is fixed.
- Render a standalone `<th>` with `width: 36px` as the first cell in the header row, before the `columns.map(...)` loop.
- Render a standalone `<td>` as the first cell in each body row, before the `columns.map(...)` switch.

**Header cell:**
- Rendered outside `ResizableHeader` — a plain `<th>` with fixed `36px` width.
- Contains a native `<input type="checkbox">` with three states:
  - **Checked** — all visible rows selected (`selectedChannelIds` contains every row's `channel.id`)
  - **Indeterminate** — some but not all selected (set via `ref.indeterminate = true`)
  - **Unchecked** — none selected
- On change: calls `selectAllChannels(visibleIds)` or `clearSelection()`.

**Row cell:**
- First `<td>` in each row contains a native `<input type="checkbox">`.
- `checked` = `selectedChannelIds.has(channel.id)`
- `onChange` / `onClick`: calls `toggleChannelSelection(channel.id)` and calls `e.stopPropagation()` to prevent the row's navigate handler from firing.

**Row click:**
- Existing `onClick` on `<tr>` continues to navigate. Checkbox cell's `stopPropagation` prevents conflict.

---

### 3. `SkedulosaTableTaskbar.tsx` — bulk action bar

**Condition:** `selectedChannelIds.size > 0`

**When active — replace left stats with:**
```
[X selected]  [Delete]  [Pause]  [Resume]
```

- **X selected** — plain text label, e.g. `"3 selected"`.
- **Delete** — calls `removeSubscription(id)` + bridge `deleteChannel` / `deleteSchedule` for each selected ID, then `clearSelection()`. Reuses the same delete logic already in `SkedulosaSchedulePage.handleDelete`.
- **Pause** — calls `updateSubscription(id, { ...sub, status: 'Paused' })` for each selected ID, then `clearSelection()`.
- **Resume** — calls `updateSubscription(id, { ...sub, status: 'Active' })` for each selected ID, then `clearSelection()`.

**When inactive:** renders existing stats (downloads today, storage used, next check).

**Delete logic extraction:**
The delete logic currently lives in `SkedulosaSchedulePage.handleDelete`. Extract it into a store action `bulkDeleteSubscriptions(ids: string[])` that loops over each ID, calls `removeSubscription(id)`, and fires the bridge `deleteChannel` / `deleteSchedule` calls. Both the page and taskbar import from the store — no cross-component imports needed.

---

## Data Flow

```
User clicks checkbox
  → toggleChannelSelection / selectAllChannels / clearSelection (store)
    → SkedulosaTableTaskbar reads selectedChannelIds
      → shows bulk bar
        → user clicks Delete / Pause / Resume
          → store + bridge mutations
            → clearSelection()
```

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Filtered results change while rows are selected | Selection persists; `selectAll` indeterminate state recalculates from visible rows only |
| All selected rows deleted | `clearSelection()` called after delete; table re-renders empty or with remaining rows |
| Row navigated away mid-selection | Selection state persists in store; visible on return |
| Single-item select + bulk Pause when already Paused | `updateSubscription` sets status to `'Paused'` — idempotent, no error |

---

## Files Changed

| File | Change |
|---|---|
| `src/skedulosa/store/skedulosaStore.tsx` | Add `selectedChannelIds`, `toggleChannelSelection`, `selectAllChannels`, `clearSelection` |
| `src/skedulosa/pages/SkedulosaSchedulePage.tsx` | Add checkbox column header + row cells; extract delete logic |
| `src/skedulosa/components/table/SkedulosaTableTaskbar.tsx` | Conditionally render bulk action bar in left stats area |
