# Skedulosa — Resizable & Draggable Columns

**Date:** 2026-03-24
**Status:** Approved
**Scope:** `src/skedulosa/pages/SkedulosaSubscriptionPage.tsx` only

---

## Summary

Add column resizing and drag-to-reorder to the Skedulosa subscription table, reusing the existing `ResizableHeader` component and `useResizableColumns` hook already used by the Status page. State is ephemeral (resets on page reload). No other modules are affected.

---

## Architecture

Single-file change. No new files, no store changes, no IPC changes.

**Imports added to `SkedulosaSubscriptionPage.tsx`:**
- `ResizableHeader` from `@/downlodr/components/download/resizableColumns/ResizableHeader`
- `useResizableColumns` from `@/downlodr/components/download/resizableColumns/useResizableColumns`

---

## Column Configuration

Six columns with pixel widths and minimum widths:

| id           | width | minWidth |
|--------------|-------|----------|
| subscription | 220   | 120      |
| status       | 100   | 70       |
| checked      | 120   | 80       |
| downloads    | 110   | 70       |
| source       | 110   | 70       |
| storage      | 110   | 70       |

> **Note:** `minWidth` in the column config is used only by `useResizableColumns` internally for resize-clamping logic. `ResizableHeader` has no `minWidth` prop — it always sets CSS `min-width` equal to the current `width` prop. The CSS `min-width` on the `<th>` will track the live `width` value, not the static config `minWidth`.

---

## Data Flow

1. `useResizableColumns(INITIAL_COLUMNS)` returns `{ columns, startResizing, startDragging, handleDragOver, handleDrop, cancelDrag, dragging, dragOverIndex }`
2. The `<colgroup>` block is **removed entirely** — `ResizableHeader` manages `<th>` width via inline styles (`width` + `minWidth`) so `<colgroup>` is redundant and creates a conflicting source of truth.
3. Static `<th>` elements in `<thead>` are replaced with `<ResizableHeader>` — each receives:
   - `width={col.width}`
   - `onResizeStart={(e) => startResizing(col.id, e.clientX)}` ← inline wrapper, not raw `startResizing`
   - `index={i}`
   - `onDragStart={startDragging}`
   - `onDragOver={handleDragOver}`
   - `onDrop={handleDrop}`
   - `onDragEnd={cancelDrag}` ← required to clear drag visual state after drop
   - `isDragging={dragging?.columnId === col.id}`
   - `isDragOver={dragOverIndex === i}`
   - `columnId={col.id}`
   - `isLastColumn={i === columns.length - 1}`
4. Existing sort icon (`TbArrowsSort`) stays inside the `ResizableHeader` children
5. `table-fixed` stays; `<th>` inline styles from `ResizableHeader` drive column widths

---

## What Is Not Changed

- All `<tbody>` row rendering
- Sorting, filtering, search logic
- Skedulosa store
- Any other page or module
