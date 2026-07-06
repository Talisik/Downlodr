# CategoryTagPage Search Bar — Design Spec

**Date:** 2026-04-21
**Branch:** fix/add-skedulosa-queue

---

## Overview

Add a search bar above the download table in `CategoryTagPage` that lets users filter visible rows by text query across one or more selectable fields. Visually mirrors `TaskbarInputField` by reusing the same `Input` component with icon slots.

---

## Component: `CategorySearchBar`

**Location:** `src/downlodr/components/base/InputField/CategorySearchBar.tsx`

### Props

```ts
interface CategorySearchBarProps {
  onSearch: (query: string, fields: SearchField[]) => void;
}

type SearchField = 'title' | 'tags' | 'categories' | 'status' | 'source';
```

### Layout

Uses the existing `Input` component (`src/core-app/components/shadcn/components/ui/input.tsx`) with:

- **Left icon:** `HiMagnifyingGlass` (react-icons/hi2) — non-clickable, decorative
- **Right icon:** `HiAdjustmentsHorizontal` (react-icons/hi2) — clickable, toggles the field-selector dropdown
- **Action icon:** `HiXMark` (react-icons/hi2) — visible only when query is non-empty, clears the input

Below the input a small dropdown panel appears (toggled by the filter icon) with a checkbox list:

| Field       | Default |
|-------------|---------|
| Title       | ✅ checked |
| Tags        | ☐ |
| Categories  | ☐ |
| Status      | ☐ |
| Source      | ☐ |

At least one field must remain checked at all times (disable unchecking the last selected field).

### Internal state

- `query: string` — current text input
- `selectedFields: SearchField[]` — defaults to `['title']`
- `dropdownOpen: boolean` — controls field-selector visibility
- Debounce: calls `onSearch` 300 ms after query or fields change (via `useEffect` + `setTimeout`)

### Dropdown styling

- Appears directly below the input, same width
- `bg-white dark:bg-darkModeDropdown border border-[#D1D5DB] dark:border-none rounded-md shadow-sm`
- Each row: checkbox + label, `text-xs`, `py-1 px-2`, `hover:bg-gray-50 dark:hover:bg-gray-700`
- Closes when clicking outside (document click listener, same pattern as context menus in the codebase)

---

## Integration in `CategoryTagPage`

### New state

```ts
const [searchQuery, setSearchQuery] = useState('');
const [searchFields, setSearchFields] = useState<SearchField[]>(['title']);
```

### `handleSearch` callback

```ts
const handleSearch = (query: string, fields: SearchField[]) => {
  setSearchQuery(query);
  setSearchFields(fields);
};
```

### Filtered downloads

Replace the existing `allDownloads` memo with a filtered version:

```ts
const filteredDownloads = React.useMemo(() => {
  if (!searchQuery.trim()) return sortedDownloads;
  const q = searchQuery.toLowerCase();
  return sortedDownloads.filter((d) => {
    return searchFields.some((field) => {
      switch (field) {
        case 'title':    return (d.displayName || d.name).toLowerCase().includes(q);
        case 'tags':     return d.tags?.some((t) => t.toLowerCase().includes(q));
        case 'categories': return d.category?.some((c) => c.toLowerCase().includes(q));
        case 'status':   return d.status?.toLowerCase().includes(q);
        case 'source':   return d.extractorKey?.toLowerCase().includes(q);
        default:         return false;
      }
    });
  });
}, [sortedDownloads, searchQuery, searchFields]);
```

The table and select-all logic use `filteredDownloads` instead of `allDownloads`.

### Render placement

`<CategorySearchBar>` is placed inside the outer `<div className="w-full">`, directly above the `<table>`, with `mb-2` spacing.

---

## File Changes

| File | Action |
|------|--------|
| `src/downlodr/components/base/InputField/CategorySearchBar.tsx` | Create |
| `src/downlodr/pages/CategoryTagPage.tsx` | Modify — add search state, filtered memo, render `<CategorySearchBar>` |

---

## Out of Scope

- Persisting selected fields across navigation (page-local state only)
- Highlighting matched text in results
- Sorting interaction with search (sort applies to filtered set, no change needed)
