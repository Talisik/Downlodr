# Favorites Page Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `FavoritesPage` to feature parity with `StatusPage` — right-click context menu, checkboxes with select-all, status column, and matching spacing/padding.

**Architecture:** Three files change: `favoritesStore.ts` gains tag/category mutation methods; a new `FavoritesContextMenu.tsx` mirrors `DownloadContextMenu` for favorite-specific actions; `FavoritesPage.tsx` is updated to wire everything together with local checkbox state, context menu state, a status column, and StatusPage-matching spacing.

**Tech Stack:** React, Zustand, Tailwind CSS, react-icons, `window.downlodrFunctions` (Electron IPC)

---

## File Map

| Action | Path |
|--------|------|
| Modify | `src/downlodr/store/favoritesStore.ts` |
| Create | `src/downlodr/components/contextMenu/FavoritesContextMenu.tsx` |
| Modify | `src/downlodr/pages/FavoritesPage.tsx` |

---

## Task 1: Extend `favoritesStore` with tag and category update methods

**Files:**
- Modify: `src/downlodr/store/favoritesStore.ts`

- [ ] **Step 1: Add the new method signatures to `FavoritesState`**

Open `src/downlodr/store/favoritesStore.ts`. The `FavoritesState` interface currently has `favorites`, `addFavorite`, `removeFavorite`, `isFavorited`. Add two new methods:

```ts
interface FavoritesState {
  favorites: FavoriteItem[];
  addFavorite: (snapshot: Omit<FavoriteItem, 'id' | 'favoritedAt'>) => void;
  removeFavorite: (downloadId: string) => void;
  isFavorited: (downloadId: string) => boolean;
  updateFavoriteTags: (downloadId: string, tags: string[]) => void;
  updateFavoriteCategories: (downloadId: string, categories: string[]) => void;
}
```

- [ ] **Step 2: Implement the methods in the store**

Inside the `create` call, add the two implementations after `isFavorited`:

```ts
updateFavoriteTags: (downloadId, tags) => {
  set((state) => ({
    favorites: state.favorites.map((f) =>
      f.downloadId === downloadId ? { ...f, tags } : f,
    ),
  }));
},

updateFavoriteCategories: (downloadId, categories) => {
  set((state) => ({
    favorites: state.favorites.map((f) =>
      f.downloadId === downloadId ? { ...f, category: categories } : f,
    ),
  }));
},
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `favoritesStore.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/downlodr/store/favoritesStore.ts
git commit -m "feat: add updateFavoriteTags and updateFavoriteCategories to favoritesStore"
```

---

## Task 2: Create `FavoritesContextMenu` component

**Files:**
- Create: `src/downlodr/components/contextMenu/FavoritesContextMenu.tsx`

This component follows the same positioning, overflow, click-outside, and submenu pattern as `DownloadContextMenu`, but shows only the actions relevant to favorites.

- [ ] **Step 1: Create the file with full implementation**

Create `src/downlodr/components/contextMenu/FavoritesContextMenu.tsx` with this content:

```tsx
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { FavoriteItem } from '@/downlodr/store/favoritesStore';
import React, { useEffect, useRef, useState } from 'react';
import { FaHeart } from 'react-icons/fa';
import { GoChevronRight, GoPlus } from 'react-icons/go';
import { LiaFileVideoSolid, LiaTagsSolid } from 'react-icons/lia';
import { LuFolderOpen } from 'react-icons/lu';
import { MdOutlinePlayCircle } from 'react-icons/md';

interface FavoritesContextMenuProps {
  favorite: FavoriteItem;
  position: { x: number; y: number };
  onClose: () => void;
  onViewFolder: (location: string, name: string) => void;
  onViewDownload: (location: string, downloadId: string) => void;
  onViewEmbed: (fav: FavoriteItem) => void;
  onRemoveFavorite: (downloadId: string) => void;
  onAddTag: (downloadId: string, tag: string) => void;
  onRemoveTag: (downloadId: string, tag: string) => void;
  currentTags: string[];
  availableTags: string[];
  onAddCategory: (downloadId: string, category: string) => void;
  onRemoveCategory: (downloadId: string, category: string) => void;
  currentCategories: string[];
  availableCategories: string[];
}

const FavoritesContextMenu: React.FC<FavoritesContextMenuProps> = ({
  favorite,
  position,
  onClose,
  onViewFolder,
  onViewDownload,
  onViewEmbed,
  onRemoveFavorite,
  onAddTag,
  onRemoveTag,
  currentTags = [],
  availableTags = [],
  onAddCategory,
  onRemoveCategory,
  currentCategories = [],
  availableCategories = [],
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const tagButtonRef = useRef<HTMLButtonElement>(null);
  const categoryButtonRef = useRef<HTMLButtonElement>(null);
  const tagSubmenuRef = useRef<HTMLDivElement>(null);
  const categorySubmenuRef = useRef<HTMLDivElement>(null);

  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState({ x: 0, y: 0 });

  // Close on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inside =
        menuRef.current?.contains(target) ||
        tagSubmenuRef.current?.contains(target) ||
        categorySubmenuRef.current?.contains(target);
      if (!inside) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Adjust menu position to avoid viewport overflow
  useEffect(() => {
    if (!menuRef.current) return;
    requestAnimationFrame(() => {
      if (!menuRef.current) return;
      const rect = menuRef.current.getBoundingClientRect();
      const margin = 10;
      let x = position.x;
      let y = position.y;
      if (rect.bottom > window.innerHeight - margin)
        y = Math.max(margin, window.innerHeight - rect.height - margin);
      if (rect.right > window.innerWidth - margin)
        x = Math.max(margin, window.innerWidth - rect.width - margin);
      if (rect.left < margin) x = margin;
      if (rect.top < margin) y = margin;
      menuRef.current.style.left = `${x}px`;
      menuRef.current.style.top = `${y}px`;
    });
  }, [position]);

  const recalculateSubmenuPosition = (
    buttonRef: React.RefObject<HTMLButtonElement>,
    itemCount: number,
  ) => {
    if (!buttonRef.current || !menuRef.current) return;
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const inputAreaHeight = 80;
    const maxListHeight = 192;
    const submenuHeight = inputAreaHeight + Math.min(itemCount * 40, maxListHeight);
    const submenuWidth = 200;

    let x = menuRect.right + 1;
    let y = buttonRect.top;

    if (y + submenuHeight > window.innerHeight - 10)
      y = Math.max(10, window.innerHeight - submenuHeight - 10);
    if (y < 10) y = 10;
    if (x + submenuWidth > window.innerWidth) x = menuRect.left - submenuWidth - 1;

    setSubmenuPosition({ x, y });
  };

  useEffect(() => {
    if (showTagMenu) recalculateSubmenuPosition(tagButtonRef, availableTags.length);
  }, [availableTags.length, showTagMenu]);

  useEffect(() => {
    if (showCategoryMenu)
      recalculateSubmenuPosition(categoryButtonRef, availableCategories.length);
  }, [availableCategories.length, showCategoryMenu]);

  const handleTagMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCategoryMenu(false);
    const next = !showTagMenu;
    setShowTagMenu(next);
    if (next) recalculateSubmenuPosition(tagButtonRef, availableTags.length);
  };

  const handleCategoryMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTagMenu(false);
    const next = !showCategoryMenu;
    setShowCategoryMenu(next);
    if (next) recalculateSubmenuPosition(categoryButtonRef, availableCategories.length);
  };

  return (
    <>
      <div
        ref={menuRef}
        className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 z-50 dark:border-gray-700 min-w-[175px]"
        style={{ left: `${position.x}px`, top: `${position.y}px`, maxHeight: '80vh', overflowY: 'auto' }}
      >
        {/* View Folder */}
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover dark:text-gray-200"
          onClick={() => { onViewFolder(favorite.location, favorite.downloadName); onClose(); }}
        >
          <LuFolderOpen size={18} />
          View Folder
        </button>

        {/* Open with External Player */}
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover dark:text-gray-200"
          onClick={() => { onViewDownload(favorite.location, favorite.downloadId); onClose(); }}
        >
          <LiaFileVideoSolid size={20} />
          Open with External Player
        </button>

        {/* View Embedded */}
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover dark:text-gray-200"
          onClick={() => { onViewEmbed(favorite); onClose(); }}
        >
          <MdOutlinePlayCircle size={18} />
          View Embedded
        </button>

        {/* Remove from Favorites */}
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover dark:text-gray-200"
          onClick={() => { onRemoveFavorite(favorite.downloadId); onClose(); }}
        >
          <FaHeart size={14} className="text-red-400" />
          Remove from Favorites
        </button>

        {/* Tags submenu trigger */}
        <button
          ref={tagButtonRef}
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover dark:text-gray-200"
          onClick={handleTagMenuClick}
        >
          <LiaTagsSolid size={18} />
          Tags
          <span className="ml-auto"><GoChevronRight size={18} /></span>
        </button>

        {/* Categories submenu trigger */}
        <button
          ref={categoryButtonRef}
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover dark:text-gray-200"
          onClick={handleCategoryMenuClick}
        >
          <LiaTagsSolid size={18} />
          Categories
          <span className="ml-auto"><GoChevronRight size={18} /></span>
        </button>
      </div>

      {/* Tags submenu */}
      {showTagMenu && (
        <div
          ref={tagSubmenuRef}
          className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 min-w-[180px] z-50 dark:border-gray-700"
          style={{ left: `${submenuPosition.x}px`, top: `${submenuPosition.y}px`, maxHeight: '80vh', overflowY: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="m-2 px-3 py-2 flex flex-row border rounded dark:border-gray-700">
            <GoPlus size={22} className="ml-[-10px] mr-2 dark:text-gray-200" />
            <div className="flex-1">
              <input
                type="text"
                placeholder="Add new tag..."
                maxLength={10}
                onKeyDown={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (e.key === 'Enter' && target.value.trim()) {
                    const newTag = target.value.trim();
                    const isDuplicate = availableTags.some(
                      (t) => t.toLowerCase() === newTag.toLowerCase(),
                    );
                    if (isDuplicate) {
                      toast({ variant: 'destructive', title: 'Duplicate Tag', description: `Tag "${newTag}" already exists.`, duration: 2000 });
                    } else {
                      onAddTag(favorite.downloadId, newTag);
                      toast({ title: 'Tag Added', description: `Tag "${newTag}" has been added.`, duration: 2000 });
                    }
                    target.value = '';
                  }
                }}
                className="w-full outline-none dark:bg-darkMode dark:text-gray-200"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Max 10 characters</div>
            </div>
          </div>
          <hr className="solid mt-2 mb-1 mx-2 w-[calc(100%-20px)] border-t-2 border-divider dark:border-gray-700" />
          <div className="max-h-48 overflow-y-auto">
            {availableTags.map((tag) => (
              <button
                key={tag}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2 dark:text-gray-200"
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentTags.includes(tag)) {
                    onRemoveTag(favorite.downloadId, tag);
                  } else {
                    onAddTag(favorite.downloadId, tag);
                  }
                }}
              >
                <span>{currentTags.includes(tag) ? '✓' : ''}</span>
                <span>{tag}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Categories submenu */}
      {showCategoryMenu && (
        <div
          ref={categorySubmenuRef}
          className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 min-w-[185px] z-50 dark:border-gray-700"
          style={{ left: `${submenuPosition.x}px`, top: `${submenuPosition.y}px`, maxHeight: '80vh', overflowY: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="m-2 px-3 py-2 flex flex-row border rounded dark:border-gray-700">
            <GoPlus size={22} className="ml-[-10px] mr-2 dark:text-gray-200" />
            <div className="flex-1">
              <input
                type="text"
                placeholder="Add new category..."
                maxLength={10}
                onKeyDown={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (e.key === 'Enter' && target.value.trim()) {
                    const newCategory = target.value.trim();
                    const isDuplicate = availableCategories.some(
                      (c) => c.toLowerCase() === newCategory.toLowerCase(),
                    );
                    if (isDuplicate) {
                      toast({ variant: 'destructive', title: 'Duplicate Category', description: `Category "${newCategory}" already exists.`, duration: 2000 });
                    } else {
                      if (currentCategories.length > 0) {
                        onRemoveCategory(favorite.downloadId, currentCategories[0]);
                      }
                      onAddCategory(favorite.downloadId, newCategory);
                      toast({ title: 'Category Added', description: `Category "${newCategory}" has been added.`, duration: 2000 });
                    }
                    target.value = '';
                  }
                }}
                className="w-full outline-none dark:bg-darkMode dark:text-gray-200"
              />
            </div>
          </div>
          <hr className="solid mt-2 mb-1 mx-2 w-[calc(100%-20px)] border-t-2 border-divider dark:border-gray-700" />
          <div className="max-h-48 overflow-y-auto">
            {availableCategories.map((category) => (
              <button
                key={category}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2 dark:text-gray-200"
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentCategories.includes(category)) {
                    onRemoveCategory(favorite.downloadId, category);
                  } else {
                    if (currentCategories.length > 0) {
                      onRemoveCategory(favorite.downloadId, currentCategories[0]);
                    }
                    onAddCategory(favorite.downloadId, category);
                  }
                }}
              >
                <span>{currentCategories.includes(category) ? '✓' : ''}</span>
                <span>{category}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default FavoritesContextMenu;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in `FavoritesContextMenu.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/downlodr/components/contextMenu/FavoritesContextMenu.tsx
git commit -m "feat: add FavoritesContextMenu component"
```

---

## Task 3: Rewrite `FavoritesPage.tsx` with checkboxes, status column, context menu, and matching spacing

**Files:**
- Modify: `src/downlodr/pages/FavoritesPage.tsx`

- [ ] **Step 1: Replace the entire file with the updated implementation**

Replace `src/downlodr/pages/FavoritesPage.tsx` with:

```tsx
import { useResizableColumns } from '@/downlodr/components/download/resizableColumns/useResizableColumns';
import VideoPlayerPanel from '@/downlodr/components/panel/VideoPlayerPanel';
import ResizableHeader from '@/downlodr/components/download/resizableColumns/ResizableHeader';
import ShareButton from '@/downlodr/components/download/ShareButton';
import FavoritesContextMenu from '@/downlodr/components/contextMenu/FavoritesContextMenu';
import {
  FavoriteItem,
  useFavoritesStore,
} from '@/downlodr/store/favoritesStore';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { getExtractorIcon, getStatusIcon } from '@/downlodr/utils/icons/iconMapper';
import { getStatusColor } from '@/downlodr/pages/status/statusPageUtils';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import {
  formatRelativeTime,
  formatFileSize,
  getColumnDisplayName,
} from '@/downlodr/pages/status/statusPageUtils';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaHeart } from 'react-icons/fa';
import { HiChevronUpDown } from 'react-icons/hi2';

const renderSortIndicator = (
  sortColumn: string,
  sortDirection: 'asc' | 'desc',
  columnId: string,
) => {
  if (sortColumn !== columnId) {
    return <HiChevronUpDown size={14} className="flex-shrink-0 dark:text-gray-400" />;
  }
  if (sortDirection === 'asc') {
    return <HiChevronUpDown size={14} className="flex-shrink-0 rotate-180" />;
  }
  return <HiChevronUpDown size={14} className="flex-shrink-0" />;
};

const FavoritesPage: React.FC = () => {
  const favorites = useFavoritesStore((s) => s.favorites);
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite);
  const updateFavoriteTags = useFavoritesStore((s) => s.updateFavoriteTags);
  const updateFavoriteCategories = useFavoritesStore((s) => s.updateFavoriteCategories);

  const availableTags = useDownloadStore((s) => s.availableTags);
  const availableCategories = useDownloadStore((s) => s.availableCategories);

  // Checkbox state (local — favorites are independent of the download queue)
  const [selectedFavoriteIds, setSelectedFavoriteIds] = useState<string[]>([]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    favId: string | null;
    x: number;
    y: number;
  }>({ favId: null, x: 0, y: 0 });

  const initialColumns = useMemo(
    () => [
      { id: 'checkbox', width: 36, minWidth: 36 },
      {
        id: 'name',
        width: Math.max(Math.floor(window.innerWidth * 0.3), 180),
        minWidth: 180,
      },
      { id: 'size', width: 70, minWidth: 50 },
      { id: 'format', width: 90, minWidth: 70 },
      { id: 'status', width: 90, minWidth: 60 },
      { id: 'dateAdded', width: 100, minWidth: 80 },
      { id: 'source', width: 60, minWidth: 40 },
      { id: 'action', width: 80, minWidth: 60 },
    ],
    [],
  );

  const {
    columns,
    startResizing,
    startDragging,
    handleDragOver,
    handleDrop,
    cancelDrag,
    dragging,
    dragOverIndex,
  } = useResizableColumns(initialColumns);

  const displayColumns = useMemo(
    () =>
      columns.filter((col) =>
        ['checkbox', 'name', 'size', 'format', 'status', 'dateAdded', 'source', 'action'].includes(col.id),
      ),
    [columns],
  );

  const [sortColumn, setSortColumn] = useState<string>('dateAdded');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const sortedFavorites = useMemo(() => {
    return [...favorites].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sortColumn) {
        case 'name':
          aVal = (a.displayName ?? a.title).toLowerCase();
          bVal = (b.displayName ?? b.title).toLowerCase();
          break;
        case 'size':
          aVal = a.size ?? 0;
          bVal = b.size ?? 0;
          break;
        case 'format':
          aVal = a.ext?.toLowerCase() ?? '';
          bVal = b.ext?.toLowerCase() ?? '';
          break;
        case 'status':
          aVal = a.status?.toLowerCase() ?? '';
          bVal = b.status?.toLowerCase() ?? '';
          break;
        case 'dateAdded':
          aVal = a.dateAdded ?? '';
          bVal = b.dateAdded ?? '';
          break;
        default:
          aVal = a.dateAdded ?? '';
          bVal = b.dateAdded ?? '';
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [favorites, sortColumn, sortDirection]);

  const handleSortClick = useCallback(
    (column: string) => {
      if (column === 'checkbox' || column === 'action') return;
      if (sortColumn === column) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSortColumn(column);
        setSortDirection('desc');
      }
    },
    [sortColumn, sortDirection],
  );

  // Scroll fade
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScroll = useCallback(() => {
    setIsScrolling(true);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => setIsScrolling(false), 800);
  }, []);

  // Video player state
  const [videoPlayerState, setVideoPlayerState] = useState<{
    isOpen: boolean;
    fav: FavoriteItem | null;
  }>({ isOpen: false, fav: null });
  const [panelWidth, setPanelWidth] = useState(75);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openPlayer = (fav: FavoriteItem) => {
    setVideoPlayerState({ isOpen: true, fav });
  };

  const closePlayer = () => {
    setVideoPlayerState({ isOpen: false, fav: null });
    setSelectedId(null);
  };

  // Checkbox handlers
  const handleSelectAll = useCallback(() => {
    setSelectedFavoriteIds(
      selectedFavoriteIds.length === sortedFavorites.length
        ? []
        : sortedFavorites.map((f) => f.id),
    );
  }, [selectedFavoriteIds.length, sortedFavorites]);

  const handleCheckboxChange = useCallback((id: string) => {
    setSelectedFavoriteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, fav: FavoriteItem) => {
    e.preventDefault();
    setContextMenu({ favId: fav.id, x: e.clientX, y: e.clientY });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ favId: null, x: 0, y: 0 });
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu.favId) return;
    const handleClick = () => handleCloseContextMenu();
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu.favId, handleCloseContextMenu]);

  // Tag / category handlers for favorites
  const handleFavAddTag = useCallback(
    (downloadId: string, tag: string) => {
      const fav = favorites.find((f) => f.downloadId === downloadId);
      if (!fav) return;
      if (fav.tags.includes(tag)) return;
      updateFavoriteTags(downloadId, [...fav.tags, tag]);
    },
    [favorites, updateFavoriteTags],
  );

  const handleFavRemoveTag = useCallback(
    (downloadId: string, tag: string) => {
      const fav = favorites.find((f) => f.downloadId === downloadId);
      if (!fav) return;
      updateFavoriteTags(downloadId, fav.tags.filter((t) => t !== tag));
    },
    [favorites, updateFavoriteTags],
  );

  const handleFavAddCategory = useCallback(
    (downloadId: string, category: string) => {
      const fav = favorites.find((f) => f.downloadId === downloadId);
      if (!fav) return;
      if (fav.category.includes(category)) return;
      // single category per item — replace
      updateFavoriteCategories(downloadId, [category]);
    },
    [favorites, updateFavoriteCategories],
  );

  const handleFavRemoveCategory = useCallback(
    (downloadId: string, category: string) => {
      const fav = favorites.find((f) => f.downloadId === downloadId);
      if (!fav) return;
      updateFavoriteCategories(
        downloadId,
        fav.category.filter((c) => c !== category),
      );
    },
    [favorites, updateFavoriteCategories],
  );

  // View folder handler
  const handleViewFolder = useCallback(async (location: string, name: string) => {
    if (!location) {
      toast({ variant: 'destructive', title: 'No location', description: 'File location is not available.', duration: 3000 });
      return;
    }
    try {
      const fullPath = await window.downlodrFunctions.joinDownloadPath(location, name);
      const exists = await window.downlodrFunctions.fileExists(fullPath);
      if (exists) {
        await window.downlodrFunctions.openFolder(location, fullPath);
      } else {
        const folderExists = await window.downlodrFunctions.fileExists(location);
        if (folderExists) {
          await window.downlodrFunctions.openFolder(location, null);
        } else {
          toast({ variant: 'destructive', title: 'Folder not found', description: 'The download folder could not be found.', duration: 3000 });
        }
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to open folder.', duration: 3000 });
    }
  }, []);

  // View download handler (open in external player)
  const handleViewDownload = useCallback(async (location: string, _downloadId: string) => {
    if (!location) {
      toast({ variant: 'destructive', title: 'No location', description: 'File location is not available.', duration: 3000 });
      return;
    }
    try {
      const exists = await window.downlodrFunctions.fileExists(location);
      if (exists) {
        window.downlodrFunctions.openVideo(location);
      } else {
        toast({ variant: 'destructive', title: 'File not found', description: 'The file could not be found at the saved location.', duration: 3000 });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to open file.', duration: 3000 });
    }
  }, []);

  const activeFav = contextMenu.favId
    ? favorites.find((f) => f.id === contextMenu.favId)
    : null;

  const allChecked =
    sortedFavorites.length > 0 &&
    selectedFavoriteIds.length === sortedFavorites.length;
  const someChecked =
    selectedFavoriteIds.length > 0 &&
    selectedFavoriteIds.length < sortedFavorites.length;

  return (
    <div className="flex flex-col h-full bg-[#F9F9F9] dark:bg-darkMode gap-2">
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div
          className="flex flex-row h-full overflow-hidden"
          style={{ minHeight: 0 }}
        >
          {/* Table area */}
          <div
            className={`flex flex-col flex-1 min-w-0 overflow-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:transition-colors [&::-webkit-scrollbar-thumb]:duration-200 group-hover/scrollarea:[&::-webkit-scrollbar-thumb]:bg-gray-300 dark:group-hover/scrollarea:[&::-webkit-scrollbar-thumb]:bg-gray-600 ${
              isScrolling
                ? '[&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600'
                : '[&::-webkit-scrollbar-thumb]:bg-transparent'
            }`}
            style={{
              width: videoPlayerState.isOpen ? `${100 - panelWidth}%` : '100%',
              transition: 'width 200ms ease',
            }}
            onScroll={handleScroll}
          >
            <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <FaHeart className="text-red-400" size={16} />
              <span className="font-semibold text-xs dark:text-gray-200">
                Favorites
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                ({favorites.length})
              </span>
            </div>

            {favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400 dark:text-gray-500">
                <FaHeart size={40} className="opacity-20" />
                <p className="text-base font-medium">No favorites yet</p>
                <p className="text-xs">Heart a video in the player to save it here</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 z-20 bg-white dark:bg-alternateBlack">
                  <tr className="text-left">
                    {displayColumns.map((column, displayIndex) => {
                      const originalIndex = columns.findIndex(
                        (col) => col.id === column.id,
                      );

                      if (column.id === 'checkbox') {
                        return (
                          <th
                            key="checkbox"
                            style={{ width: column.width }}
                            className="p-2 text-center"
                          >
                            <input
                              type="checkbox"
                              checked={allChecked}
                              ref={(el) => {
                                if (el) el.indeterminate = someChecked;
                              }}
                              onChange={handleSelectAll}
                              className="cursor-pointer"
                            />
                          </th>
                        );
                      }

                      return (
                        <ResizableHeader
                          key={column.id}
                          width={column.width}
                          onResizeStart={(e) =>
                            startResizing(column.id, e.clientX)
                          }
                          index={originalIndex}
                          onDragStart={startDragging}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onDragEnd={cancelDrag}
                          isDragging={dragging?.columnId === column.id}
                          isDragOver={dragOverIndex === originalIndex}
                          columnId={column.id}
                          isLastColumn={displayIndex === displayColumns.length - 1}
                        >
                          <div
                            className="flex items-center cursor-pointer whitespace-nowrap"
                            onClick={() => handleSortClick(column.id)}
                          >
                            <span className="flex items-center gap-[0.5px]">
                              {getColumnDisplayName(column.id)}
                              {column.id !== 'action' &&
                                column.id !== 'source' &&
                                renderSortIndicator(sortColumn, sortDirection, column.id)}
                            </span>
                          </div>
                        </ResizableHeader>
                      );
                    })}
                  </tr>
                  <tr className="pointer-events-none">
                    <th
                      colSpan={999}
                      className="p-0 h-[1px] bg-gray-200 dark:bg-darkModeCompliment"
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedFavorites.map((fav) => (
                    <tr
                      key={fav.id}
                      className={`border-b-2 hover:bg-gray-50 dark:border-[#27272ACC] dark:hover:bg-darkModeHover cursor-pointer ${
                        selectedId === fav.id
                          ? 'bg-blue-50 dark:bg-gray-600'
                          : 'dark:bg-darkMode'
                      }`}
                      onClick={() => {
                        if (fav.id === selectedId) {
                          setSelectedId(null);
                          closePlayer();
                        } else {
                          setSelectedId(fav.id);
                          openPlayer(fav);
                        }
                      }}
                      onContextMenu={(e) => handleContextMenu(e, fav)}
                    >
                      {displayColumns.map((column) => {
                        switch (column.id) {
                          case 'checkbox':
                            return (
                              <td
                                key="checkbox"
                                style={{ width: column.width }}
                                className="p-2 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedFavoriteIds.includes(fav.id)}
                                  onChange={() => handleCheckboxChange(fav.id)}
                                  className="cursor-pointer"
                                />
                              </td>
                            );
                          case 'name':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200"
                              >
                                <div className="flex items-center gap-3">
                                  {fav.thumbnail && fav.thumbnail !== '—' && (
                                    <img
                                      src={fav.thumbnail}
                                      alt="thumbnail"
                                      className="h-9 w-16 object-cover rounded flex-shrink-0 bg-black"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  )}
                                  <TooltipWrapper
                                    content={fav.displayName ?? fav.title}
                                    side="bottom"
                                  >
                                    <span className="line-clamp-2 text-xxs break-words">
                                      {fav.displayName ?? fav.title}
                                    </span>
                                  </TooltipWrapper>
                                </div>
                              </td>
                            );
                          case 'size':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200 text-xs"
                              >
                                {formatFileSize(fav.size)}
                              </td>
                            );
                          case 'format':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200 text-xs"
                              >
                                {fav.ext ? fav.ext.toUpperCase() : '—'}
                              </td>
                            );
                          case 'status':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2"
                              >
                                <TooltipWrapper
                                  content={
                                    fav.status
                                      ? fav.status.charAt(0).toUpperCase() + fav.status.slice(1)
                                      : '—'
                                  }
                                  side="bottom"
                                >
                                  <div className="flex items-center justify-center">
                                    {fav.status
                                      ? getStatusIcon(fav.status, 20)
                                      : <span className="text-xs text-gray-400">—</span>}
                                  </div>
                                </TooltipWrapper>
                              </td>
                            );
                          case 'dateAdded':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200 text-xs"
                              >
                                {fav.dateAdded ? formatRelativeTime(fav.dateAdded) : '—'}
                              </td>
                            );
                          case 'source':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200 text-center"
                              >
                                <TooltipWrapper content={fav.extractorKey} side="bottom">
                                  <a
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.downlodrFunctions.openExternalLink(fav.videoUrl);
                                    }}
                                    className="hover:underline cursor-pointer hover:opacity-80 transition-opacity flex justify-center text-lg"
                                  >
                                    {getExtractorIcon(fav.extractorKey)}
                                  </a>
                                </TooltipWrapper>
                              </td>
                            );
                          case 'action':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200 text-center"
                              >
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeFavorite(fav.downloadId);
                                      if (videoPlayerState.fav?.downloadId === fav.downloadId) {
                                        closePlayer();
                                      }
                                    }}
                                    title="Remove from favorites"
                                    className="p-1 hover:opacity-80 transition-opacity"
                                  >
                                    <FaHeart size={14} className="text-red-400" />
                                  </button>
                                  <ShareButton
                                    videoUrl={fav.videoUrl}
                                    name={fav.title}
                                    status={fav.status}
                                    thumbnailLocation={fav.thumbnail}
                                    format={fav.ext}
                                    size={fav.size}
                                  />
                                </div>
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Video player side panel */}
          {videoPlayerState.isOpen && videoPlayerState.fav && (
            <VideoPlayerPanel
              isOpen={videoPlayerState.isOpen}
              onClose={closePlayer}
              videoUrl={videoPlayerState.fav.videoUrl}
              title={videoPlayerState.fav.displayName ?? videoPlayerState.fav.title}
              autoCaptionLocation={videoPlayerState.fav.autoCaptionLocation}
              transcriptLocation={videoPlayerState.fav.transcriptLocation}
              displayName={videoPlayerState.fav.displayName}
              dateAdded={videoPlayerState.fav.dateAdded}
              location={videoPlayerState.fav.location}
              tags={videoPlayerState.fav.tags}
              category={videoPlayerState.fav.category}
              status={videoPlayerState.fav.status}
              downloadName={videoPlayerState.fav.downloadName}
              description={videoPlayerState.fav.description}
              chapters={videoPlayerState.fav.chapters}
              channelName={videoPlayerState.fav.channelName}
              thumbnail={videoPlayerState.fav.thumbnail}
              ext={videoPlayerState.fav.ext}
              duration={videoPlayerState.fav.duration}
              size={videoPlayerState.fav.size}
              extractorKey={videoPlayerState.fav.extractorKey}
              downloadId={videoPlayerState.fav.downloadId}
              width={panelWidth}
              onWidthChange={setPanelWidth}
            />
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu.favId && activeFav && (
        <div onMouseDown={(e) => e.stopPropagation()}>
          <FavoritesContextMenu
            favorite={activeFav}
            position={{ x: contextMenu.x, y: contextMenu.y }}
            onClose={handleCloseContextMenu}
            onViewFolder={handleViewFolder}
            onViewDownload={handleViewDownload}
            onViewEmbed={(fav) => {
              openPlayer(fav);
              setSelectedId(fav.id);
              handleCloseContextMenu();
            }}
            onRemoveFavorite={(downloadId) => {
              removeFavorite(downloadId);
              if (videoPlayerState.fav?.downloadId === downloadId) closePlayer();
              handleCloseContextMenu();
            }}
            onAddTag={handleFavAddTag}
            onRemoveTag={handleFavRemoveTag}
            currentTags={activeFav.tags}
            availableTags={availableTags}
            onAddCategory={handleFavAddCategory}
            onRemoveCategory={handleFavRemoveCategory}
            currentCategories={activeFav.category}
            availableCategories={availableCategories}
          />
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```bash
npx tsc --noEmit
```

Expected: clean output with no errors.

- [ ] **Step 3: Manual smoke test**

Start the app and navigate to the Favorites page. Verify:
- Background is `#F9F9F9` (light gray, matching StatusPage)
- A checkbox column appears as the first column
- The select-all checkbox in the header selects/deselects all rows
- Individual checkboxes work without toggling the video player
- The `Status` column shows status icons with tooltips
- Sorting works for all sortable columns (name, size, format, status, dateAdded)
- Right-clicking a row opens the context menu with: View Folder, Open with External Player, View Embedded, Remove from Favorites, Tags, Categories
- Tags and Categories submenus open and close correctly
- Click outside the context menu closes it
- Escape key closes the context menu

- [ ] **Step 4: Commit**

```bash
git add src/downlodr/pages/FavoritesPage.tsx
git commit -m "feat: add checkboxes, status column, context menu and StatusPage spacing to FavoritesPage"
```
