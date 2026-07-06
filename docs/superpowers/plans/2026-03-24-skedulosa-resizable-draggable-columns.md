# Skedulosa Resizable & Draggable Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add column resizing and drag-to-reorder to the Skedulosa subscription table by wiring in the existing `ResizableHeader` component and `useResizableColumns` hook.

**Architecture:** Single-file change to `SkedulosaSubscriptionPage.tsx`. Import two already-existing utilities (`ResizableHeader`, `useResizableColumns`), define pixel-based column configs, remove the `<colgroup>`, and replace the six static `<th>` elements with `<ResizableHeader>` instances. State is ephemeral (resets on page reload). No store, IPC, or other module changes.

**Tech Stack:** React, TypeScript, Tailwind CSS, existing `useResizableColumns` hook (HTML5 drag API + mousemove resize), existing `ResizableHeader` component.

---

## File Map

| Action | Path | Change |
|--------|------|--------|
| Modify | `src/skedulosa/pages/SkedulosaSubscriptionPage.tsx` | Add imports, add column config, remove colgroup, replace thead |

No other files are created or modified.

---

### Task 1: Add imports and column configuration

**Files:**
- Modify: `src/skedulosa/pages/SkedulosaSubscriptionPage.tsx`

- [ ] **Step 1: Add the two new imports at the top of the file**

Open `src/skedulosa/pages/SkedulosaSubscriptionPage.tsx`. After the existing import block, add:

```tsx
import ResizableHeader from '@/downlodr/components/download/resizableColumns/ResizableHeader';
import { useResizableColumns } from '@/downlodr/components/download/resizableColumns/useResizableColumns';
```

- [ ] **Step 2: Add the INITIAL_COLUMNS constant after the imports, before the component**

Place this constant after all import statements and before `type ScheduleRow`:

```tsx
const INITIAL_COLUMNS = [
  { id: 'subscription', width: 220, minWidth: 120 },
  { id: 'status',       width: 100, minWidth: 70  },
  { id: 'checked',      width: 120, minWidth: 80  },
  { id: 'downloads',    width: 110, minWidth: 70  },
  { id: 'source',       width: 110, minWidth: 70  },
  { id: 'storage',      width: 110, minWidth: 70  },
];
```

- [ ] **Step 3: Call the hook inside the component**

Inside `SkedulosaSubscriptionPage`, add this line after the existing `useMemo` / store selectors block (before the early return):

```tsx
const {
  columns,
  startResizing,
  startDragging,
  handleDragOver,
  handleDrop,
  cancelDrag,
  dragging,
  dragOverIndex,
} = useResizableColumns(INITIAL_COLUMNS);
```

- [ ] **Step 4: Verify the file still compiles**

Run the dev server to confirm no TypeScript errors at this point:
```bash
yarn start
```
Expected: app starts without errors. The table still renders with the old static headers (hook is wired but not yet used in JSX).

---

### Task 2: Replace `<colgroup>` and static `<thead>`

**Files:**
- Modify: `src/skedulosa/pages/SkedulosaSubscriptionPage.tsx`

- [ ] **Step 1: Remove the entire `<colgroup>` block**

Delete these lines (currently lines 119–126):

```tsx
<colgroup>
  <col style={{ width: '33%' }} />
  <col style={{ width: '13.4%' }} />
  <col style={{ width: '13.4%' }} />
  <col style={{ width: '13.4%' }} />
  <col style={{ width: '13.4%' }} />
  <col style={{ width: '13.4%' }} />
</colgroup>
```

`ResizableHeader` sets `width` and `min-width` on each `<th>` via inline styles — the `<colgroup>` is no longer needed and would conflict.

- [ ] **Step 2: Replace the static `<thead>` with ResizableHeader columns**

Delete the entire existing `<thead>` block (currently lines 127–165) and replace it with:

```tsx
<thead className="border-b border-gray-200 dark:border-darkModeCompliment">
  <tr className="sticky top-0 bg-white dark:bg-darkMode">
    {columns.map((col, i) => (
      <ResizableHeader
        key={col.id}
        width={col.width}
        onResizeStart={(e) => startResizing(col.id, e.clientX)}
        index={i}
        onDragStart={startDragging}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={cancelDrag}
        isDragging={dragging?.columnId === col.id}
        isDragOver={dragOverIndex === i}
        columnId={col.id}
        isLastColumn={i === columns.length - 1}
      >
        <div className="flex flex-row gap-1 items-center justify-start font-semibold text-[13.5px]">
          <span className="capitalize">{col.id === 'subscription' ? 'Subscription' : col.id.charAt(0).toUpperCase() + col.id.slice(1)}</span>
          <TbArrowsSort className="text-xs" />
        </div>
      </ResizableHeader>
    ))}
  </tr>
</thead>
```

> **Note:** The existing column labels map directly to the `col.id` values. `capitalize` CSS handles simple cases; the explicit check for `'subscription'` ensures correct casing. If you prefer explicit labels, replace the `<span>` content with a lookup object:
> ```tsx
> const COLUMN_LABELS: Record<string, string> = {
>   subscription: 'Subscription',
>   status: 'Status',
>   checked: 'Checked',
>   downloads: 'Downloads',
>   source: 'Source',
>   storage: 'Storage',
> };
> // then: {COLUMN_LABELS[col.id]}
> ```

- [ ] **Step 3: Verify in the browser**

Run `yarn start` and navigate to `/skedulosa`. Confirm:
- All 6 column headers render with their original labels
- Dragging a column header reorders the columns visually
- Dragging the right edge of a column header resizes it
- The rest of the table (rows, data, sorting, search) is unaffected
- No other pages (Status, Downloads, etc.) are affected

- [ ] **Step 4: Commit**

```bash
git add src/skedulosa/pages/SkedulosaSubscriptionPage.tsx
git commit -m "feat(skedulosa): add resizable and draggable columns to subscription table"
```
