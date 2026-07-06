# CategoryTagPage Search Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable `CategorySearchBar` component above the download table in `CategoryTagPage` that filters rows by text query across user-selectable fields.

**Architecture:** A new controlled component `CategorySearchBar` handles its own query/field/dropdown state and fires an `onSearch` callback on change (debounced 300 ms). `CategoryTagPage` owns `searchQuery` + `searchFields` state, passes a `handleSearch` callback down, and derives `filteredDownloads` from `sortedDownloads` before passing to the table.

**Tech Stack:** React, TypeScript, Tailwind CSS, react-icons/hi2, existing `Input` shadcn component (`src/core-app/components/shadcn/components/ui/input.tsx`)

---

### Task 1: Create `CategorySearchBar` component

**Files:**
- Create: `src/downlodr/components/base/InputField/CategorySearchBar.tsx`

- [ ] **Step 1: Create the file with full implementation**

Create `src/downlodr/components/base/InputField/CategorySearchBar.tsx` with the following content:

```tsx
import Input from '@/core-app/components/shadcn/components/ui/input';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import { useEffect, useRef, useState } from 'react';
import {
  HiAdjustmentsHorizontal,
  HiMagnifyingGlass,
  HiXMark,
} from 'react-icons/hi2';

export type SearchField =
  | 'title'
  | 'tags'
  | 'categories'
  | 'status'
  | 'source';

const FIELD_OPTIONS: { id: SearchField; label: string }[] = [
  { id: 'title', label: 'Title' },
  { id: 'tags', label: 'Tags' },
  { id: 'categories', label: 'Categories' },
  { id: 'status', label: 'Status' },
  { id: 'source', label: 'Source' },
];

interface CategorySearchBarProps {
  onSearch: (query: string, fields: SearchField[]) => void;
}

const CategorySearchBar = ({ onSearch }: CategorySearchBarProps) => {
  const [query, setQuery] = useState('');
  const [selectedFields, setSelectedFields] = useState<SearchField[]>([
    'title',
  ]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced onSearch
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query, selectedFields);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selectedFields, onSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const toggleField = (field: SearchField) => {
    setSelectedFields((prev) => {
      if (prev.includes(field)) {
        // Prevent unchecking the last selected field
        if (prev.length === 1) return prev;
        return prev.filter((f) => f !== field);
      }
      return [...prev, field];
    });
  };

  const activeFieldLabels = FIELD_OPTIONS.filter((o) =>
    selectedFields.includes(o.id),
  )
    .map((o) => o.label)
    .join(', ');

  return (
    <div ref={containerRef} className="relative w-full mb-2">
      <Input
        placeholder={`Search by ${activeFieldLabels}...`}
        className="text-xs py-4"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        leftIcons={[
          <HiMagnifyingGlass
            key="search"
            className="text-darkModeHover dark:text-darkModeLight"
          />,
        ]}
        rightIcons={[
          {
            icon: (
              <HiAdjustmentsHorizontal
                className={cn(
                  'text-darkModeHover dark:text-darkModeLight',
                  dropdownOpen && 'text-primary',
                )}
              />
            ),
            onClick: () => setDropdownOpen((prev) => !prev),
            tooltip: 'Filter fields',
          },
        ]}
        actionIcon={
          query
            ? {
                icon: (
                  <HiXMark className="text-darkModeHover dark:text-darkModeLight" />
                ),
                onClick: () => setQuery(''),
                tooltip: 'Clear',
              }
            : undefined
        }
        onContextMenu={(e) => {
          e.preventDefault();
          window.downlodrFunctions.showInputContextMenu();
        }}
      />

      {dropdownOpen && (
        <div className="absolute z-30 top-full left-0 w-full mt-1 bg-white dark:bg-darkModeDropdown border border-[#D1D5DB] dark:border-none rounded-md shadow-sm py-1">
          {FIELD_OPTIONS.map((option) => {
            const isChecked = selectedFields.includes(option.id);
            const isDisabled = isChecked && selectedFields.length === 1;
            return (
              <label
                key={option.id}
                className={cn(
                  'flex items-center gap-2 px-3 py-1 text-xs cursor-pointer',
                  'hover:bg-gray-50 dark:hover:bg-gray-700',
                  isDisabled && 'opacity-50 cursor-not-allowed',
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isDisabled}
                  onChange={() => toggleField(option.id)}
                  className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
                />
                <span className="dark:text-gray-200">{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CategorySearchBar;
```

- [ ] **Step 2: Verify the file was created at the correct path**

Check that `src/downlodr/components/base/InputField/CategorySearchBar.tsx` exists and is non-empty.

---

### Task 2: Integrate `CategorySearchBar` into `CategoryTagPage`

**Files:**
- Modify: `src/downlodr/pages/CategoryTagPage.tsx`

- [ ] **Step 1: Add the import for `CategorySearchBar` and `SearchField` type**

In `src/downlodr/pages/CategoryTagPage.tsx`, add this import after the existing local imports (around line 34, after the react-icons imports):

```tsx
import CategorySearchBar, {
  SearchField,
} from '@/downlodr/components/base/InputField/CategorySearchBar';
```

- [ ] **Step 2: Add search state inside the component**

In `CategoryTagPage`, directly after the `sortConfig` state declaration (around line 113), add:

```tsx
const [searchQuery, setSearchQuery] = useState('');
const [searchFields, setSearchFields] = useState<SearchField[]>(['title']);

const handleSearch = (query: string, fields: SearchField[]) => {
  setSearchQuery(query);
  setSearchFields(fields);
};
```

- [ ] **Step 3: Replace the `allDownloads` memo with a filtered version**

Find the existing `allDownloads` memo (around line 254):

```tsx
// All downloads for display, filtered by uniqueness
const allDownloads = React.useMemo(() => {
  return sortedDownloads;
}, [sortedDownloads]);
```

Replace it with:

```tsx
const allDownloads = React.useMemo(() => {
  if (!searchQuery.trim()) return sortedDownloads;
  const q = searchQuery.toLowerCase();
  return sortedDownloads.filter((d) =>
    searchFields.some((field) => {
      switch (field) {
        case 'title':
          return (d.displayName || d.name).toLowerCase().includes(q);
        case 'tags':
          return d.tags?.some((t) => t.toLowerCase().includes(q));
        case 'categories':
          return d.category?.some((c) => c.toLowerCase().includes(q));
        case 'status':
          return d.status?.toLowerCase().includes(q);
        case 'source':
          return d.extractorKey?.toLowerCase().includes(q);
        default:
          return false;
      }
    }),
  );
}, [sortedDownloads, searchQuery, searchFields]);
```

- [ ] **Step 4: Place `<CategorySearchBar>` above the table**

Find the return JSX in `CategoryTagPage` (around line 822):

```tsx
return (
  <div className="w-full">
    <table className="w-full">
```

Replace with:

```tsx
return (
  <div className="w-full">
    <CategorySearchBar onSearch={handleSearch} />
    <table className="w-full">
```

- [ ] **Step 5: Verify TypeScript compiles without errors**

Run: `yarn lint`

Expected: no type errors related to `CategorySearchBar`, `SearchField`, `searchQuery`, or `searchFields`.

---

### Task 3: Manual smoke test

- [ ] **Step 1: Start the app**

Run: `yarn start`

- [ ] **Step 2: Navigate to a tag or category page**

Open a tag or category that has at least a few downloads listed.

- [ ] **Step 3: Verify search bar appears above the table**

The search bar should be visible above the column headers with a magnifying glass icon on the left and a filter icon on the right.

- [ ] **Step 4: Type a partial title**

Type part of a known download name. The table should filter to matching rows within ~300 ms. Rows that don't match should disappear.

- [ ] **Step 5: Test the clear button**

With text in the input, an X action icon should appear on the right. Clicking it clears the input and restores all rows.

- [ ] **Step 6: Test the field dropdown**

Click the filter (sliders) icon. A dropdown should appear with five checkboxes: Title (checked), Tags, Categories, Status, Source (all unchecked). Clicking outside the dropdown should close it.

- [ ] **Step 7: Test multi-field search**

Check "Tags" in the dropdown. Type a tag name. Rows with a matching tag (even if the title doesn't match) should now appear.

- [ ] **Step 8: Test the "at least one field" guard**

With only "Title" selected, try to uncheck "Title" — the checkbox should be disabled (greyed out) and not respond to clicks.

- [ ] **Step 9: Test dark mode**

Toggle dark mode. The search bar and dropdown should use dark background colors matching the rest of the UI.
