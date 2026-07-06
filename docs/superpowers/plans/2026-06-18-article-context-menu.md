# ArticleContextMenu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a right-click context menu for `ArticleDownload` entries, usable in both `AfdaDownloads.tsx` and `AfdaSelectedViewTable.tsx`.

**Architecture:** Direct port of `DownloadContextMenu.tsx` adapted for the `ArticleDownload` type. A single self-contained component owns its own positioning, submenu state, and click-outside handling. Tags and categories fields must first be added to the `ArticleDownload` store before the component can use them.

**Tech Stack:** React, TypeScript, Zustand, react-icons, Tailwind CSS, react-i18next

## Global Constraints

- Follow the exact same menu item pattern as `src/downlodr/components/contextMenu/DownloadContextMenu.tsx`
- All menu items use Tailwind class `w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover`
- Menu container uses `fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 z-50 dark:border-gray-700 min-w-[175px]`
- Submenus rendered as siblings (outside the menu div) in a React fragment to avoid clipping
- Only one submenu open at a time — opening one closes the other
- Status-based rendering: `for_download` → Remove only; `loading` → Remove only; `finished` → all options; `failed` → Retry, Open in Browser, Remove

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/afda/store/articleDownloadStore.ts` | Modify | Add `tags` and `category` fields + store actions |
| `src/afda/components/contextMenu/ArticleContextMenu.tsx` | Create | The context menu component |
| `src/afda/pages/selectedTabPages/AfdaDownloads.tsx` | Modify | Wire up context menu on article rows |

---

### Task 1: Add tags and categories to ArticleDownload store

**Files:**
- Modify: `src/afda/store/articleDownloadStore.ts`

**Interfaces:**
- Produces: `ArticleDownload.tags: string[]`, `ArticleDownload.category: string[]`, `addArticleTag(id, tag)`, `removeArticleTag(id, tag)`, `addArticleCategory(id, category)`, `removeArticleCategory(id, category)` — all on `useArticleDownloadStore`

- [ ] **Step 1: Add fields to the `ArticleDownload` interface**

In `src/afda/store/articleDownloadStore.ts`, update the `ArticleDownload` interface:

```typescript
export interface ArticleDownload {
  id: string;
  title: string;
  url: string;
  subscriptionId?: string;
  sectionId?: string;
  status: 'loading' | 'for_download' | 'finished' | 'failed';
  format: 'docx' | 'pdf';
  filePath: string | null;
  fileSize: number | null;
  dateAdded: string;
  published_at?: string | null;
  errorMessage?: string;
  articleData: ArticleModel | null;
  thumbnailDataUrl: string | null;
  tags: string[];
  category: string[];
}
```

- [ ] **Step 2: Add the four new actions to the store interface**

Update `ArticleDownloadStore` interface (add after `removeArticleDownload`):

```typescript
addArticleTag: (id: string, tag: string) => void;
removeArticleTag: (id: string, tag: string) => void;
addArticleCategory: (id: string, category: string) => void;
removeArticleCategory: (id: string, category: string) => void;
```

- [ ] **Step 3: Implement the four actions in the store**

Add inside the `create` call, after `removeArticleDownload`:

```typescript
addArticleTag: (id, tag) =>
  set((state) => ({
    articleDownloads: state.articleDownloads.map((d) =>
      d.id === id && !d.tags.includes(tag)
        ? { ...d, tags: [...d.tags, tag] }
        : d,
    ),
  })),

removeArticleTag: (id, tag) =>
  set((state) => ({
    articleDownloads: state.articleDownloads.map((d) =>
      d.id === id ? { ...d, tags: d.tags.filter((t) => t !== tag) } : d,
    ),
  })),

addArticleCategory: (id, category) =>
  set((state) => ({
    articleDownloads: state.articleDownloads.map((d) =>
      d.id === id && !d.category.includes(category)
        ? { ...d, category: [...d.category, category] }
        : d,
    ),
  })),

removeArticleCategory: (id, category) =>
  set((state) => ({
    articleDownloads: state.articleDownloads.map((d) =>
      d.id === id
        ? { ...d, category: d.category.filter((c) => c !== category) }
        : d,
    ),
  })),
```

- [ ] **Step 4: Add default values for `tags` and `category` in all three `addArticle*` helpers**

In `addArticleDownload`, `addAfdaArticle`, and `addAfdaArticlesBatch`, add `tags: []` and `category: []` to each new article object so existing entries without these fields don't break at runtime.

For `addArticleDownload`:
```typescript
{
  id,
  title: '',
  url,
  status: 'for_download',
  format: 'docx',
  filePath: null,
  fileSize: null,
  dateAdded: new Date().toISOString(),
  articleData: null,
  thumbnailDataUrl: null,
  tags: [],
  category: [],
},
```

For `addAfdaArticle` and `addAfdaArticlesBatch`, add `tags: []` and `category: []` to the new item objects in the same way.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to `ArticleDownload`.

- [ ] **Step 6: Commit**

```bash
git add src/afda/store/articleDownloadStore.ts
git commit -m "feat(afda): add tags and category fields to ArticleDownload store"
```

---

### Task 2: Create ArticleContextMenu component

**Files:**
- Create: `src/afda/components/contextMenu/ArticleContextMenu.tsx`

**Interfaces:**
- Consumes: `ArticleDownload` from `src/afda/store/articleDownloadStore.ts` (including `tags`, `category`, `status`, `filePath`, `url`, `id`)
- Produces: `ArticleContextMenu` default export — props interface below

```typescript
interface ArticleContextMenuProps {
  article: ArticleDownload;
  position: { x: number; y: number };
  onClose: () => void;
  onViewArticle: (articleId: string) => void;
  onOpenInBrowser: (url: string) => void;
  onOpenFolder: (filePath: string) => void;
  onRemove: (articleId: string) => void;
  onRetry: (articleId: string) => void;
  onToggleFavorite: (articleId: string) => void;
  isFavorited: boolean;
  onAddTag: (articleId: string, tag: string) => void;
  onRemoveTag: (articleId: string, tag: string) => void;
  currentTags: string[];
  availableTags: string[];
  onAddCategory: (articleId: string, category: string) => void;
  onRemoveCategory: (articleId: string, category: string) => void;
  currentCategories: string[];
  availableCategories: string[];
}
```

- [ ] **Step 1: Create the file with imports, interface, and component shell**

Create `src/afda/components/contextMenu/ArticleContextMenu.tsx`:

```typescript
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { ArticleDownload } from '@/afda/store/articleDownloadStore';
import React, { useEffect, useState } from 'react';
import { BsArrowCounterclockwise } from 'react-icons/bs';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { GoChevronRight, GoPlus } from 'react-icons/go';
import { LiaTagsSolid } from 'react-icons/lia';
import { LuEye, LuExternalLink, LuFolderOpen, LuTrash } from 'react-icons/lu';

interface ArticleContextMenuProps {
  article: ArticleDownload;
  position: { x: number; y: number };
  onClose: () => void;
  onViewArticle: (articleId: string) => void;
  onOpenInBrowser: (url: string) => void;
  onOpenFolder: (filePath: string) => void;
  onRemove: (articleId: string) => void;
  onRetry: (articleId: string) => void;
  onToggleFavorite: (articleId: string) => void;
  isFavorited: boolean;
  onAddTag: (articleId: string, tag: string) => void;
  onRemoveTag: (articleId: string, tag: string) => void;
  currentTags: string[];
  availableTags: string[];
  onAddCategory: (articleId: string, category: string) => void;
  onRemoveCategory: (articleId: string, category: string) => void;
  currentCategories: string[];
  availableCategories: string[];
}

const ArticleContextMenu: React.FC<ArticleContextMenuProps> = ({
  article,
  position,
  onClose,
  onViewArticle,
  onOpenInBrowser,
  onOpenFolder,
  onRemove,
  onRetry,
  onToggleFavorite,
  isFavorited,
  onAddTag,
  onRemoveTag,
  currentTags = [],
  availableTags = [],
  onAddCategory,
  onRemoveCategory,
  currentCategories = [],
  availableCategories = [],
}) => {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const tagButtonRef = React.useRef<HTMLButtonElement>(null);
  const categoryButtonRef = React.useRef<HTMLButtonElement>(null);
  const tagSubmenuRef = React.useRef<HTMLDivElement>(null);
  const categorySubmenuRef = React.useRef<HTMLDivElement>(null);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState({ x: 0, y: 0 });

  return <></>;
};

export default ArticleContextMenu;
```

- [ ] **Step 2: Add viewport clamping `useEffect`**

Inside the component, before `return`, add:

```typescript
useEffect(() => {
  if (menuRef.current) {
    const checkAndAdjustPosition = () => {
      if (menuRef.current) {
        const menuRect = menuRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const margin = 10;
        let needsAdjustment = false;
        let newX = position.x;
        let newY = position.y;

        if (menuRect.bottom > viewportHeight - margin) {
          newY = Math.max(margin, viewportHeight - menuRect.height - margin);
          needsAdjustment = true;
        }
        if (menuRect.right > viewportWidth - margin) {
          newX = Math.max(margin, viewportWidth - menuRect.width - margin);
          needsAdjustment = true;
        }
        if (menuRect.left < margin) {
          newX = margin;
          needsAdjustment = true;
        }
        if (menuRect.top < margin) {
          newY = margin;
          needsAdjustment = true;
        }

        if (needsAdjustment) {
          menuRef.current.style.left = `${newX}px`;
          menuRef.current.style.top = `${newY}px`;
        }
      }
    };
    requestAnimationFrame(checkAndAdjustPosition);
  }
}, [position, article.status]);
```

- [ ] **Step 3: Add click-outside and Escape key `useEffect`**

```typescript
useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as Node;
    const insideMenu = menuRef.current?.contains(target);
    const insideTagSubmenu = tagSubmenuRef.current?.contains(target);
    const insideCategorySubmenu = categorySubmenuRef.current?.contains(target);
    if (!insideMenu && !insideTagSubmenu && !insideCategorySubmenu) {
      onClose();
    }
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
```

- [ ] **Step 4: Add `recalculateSubmenuPosition` helper and submenu click handlers**

```typescript
const recalculateSubmenuPosition = (
  buttonRef: React.RefObject<HTMLButtonElement>,
  itemCount: number,
) => {
  if (buttonRef.current && menuRef.current) {
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();

    const inputAreaHeight = 80;
    const maxListHeight = 192;
    const actualListHeight = Math.min(itemCount * 40, maxListHeight);
    const submenuHeight = inputAreaHeight + actualListHeight;

    let submenuX = menuRect.right + 1;
    let submenuY = buttonRect.top;

    if (submenuY + submenuHeight > window.innerHeight - 10) {
      submenuY = Math.max(10, window.innerHeight - submenuHeight - 10);
    }
    if (submenuY < 10) submenuY = 10;

    const submenuWidth = 200;
    if (submenuX + submenuWidth > window.innerWidth) {
      submenuX = menuRect.left - submenuWidth - 1;
    }

    setSubmenuPosition({ x: submenuX, y: submenuY });
  }
};

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
```

Also add reactive position recalculation effects:

```typescript
useEffect(() => {
  if (showTagMenu) recalculateSubmenuPosition(tagButtonRef, availableTags.length);
}, [availableTags.length, showTagMenu]);

useEffect(() => {
  if (showCategoryMenu) recalculateSubmenuPosition(categoryButtonRef, availableCategories.length);
}, [availableCategories.length, showCategoryMenu]);
```

- [ ] **Step 5: Add `renderMenuOptions` function**

```typescript
const renderMenuOptions = () => {
  const viewArticleOption = (
    <button
      className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
      onClick={() => { onViewArticle(article.id); onClose(); }}
    >
      <span className="flex items-center gap-1">
        <LuEye size={16} />
        View Article
      </span>
    </button>
  );

  const openInBrowserOption = (
    <button
      className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
      onClick={() => { onOpenInBrowser(article.url); onClose(); }}
    >
      <span className="flex items-center gap-1">
        <LuExternalLink size={16} />
        Open in Browser
      </span>
    </button>
  );

  const openFolderOption = article.filePath ? (
    <button
      className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
      onClick={() => { onOpenFolder(article.filePath!); onClose(); }}
    >
      <span className="flex items-center gap-1">
        <LuFolderOpen size={18} />
        Open Folder
      </span>
    </button>
  ) : null;

  const favoritesOption = (
    <button
      className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
      onClick={() => { onToggleFavorite(article.id); onClose(); }}
    >
      <span className="flex items-center gap-1">
        {isFavorited
          ? <FaHeart size={14} className="text-red-400" />
          : <FaRegHeart size={14} />}
        {isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
      </span>
    </button>
  );

  const tagsOption = (
    <button
      ref={tagButtonRef}
      className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
      onClick={handleTagMenuClick}
    >
      <span className="flex items-center gap-1">
        <LiaTagsSolid size={18} />
        Tags
      </span>
      <span className="ml-auto"><GoChevronRight size={18} /></span>
    </button>
  );

  const categoriesOption = (
    <button
      ref={categoryButtonRef}
      className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
      onClick={handleCategoryMenuClick}
    >
      <span className="flex items-center gap-1">
        <LiaTagsSolid size={18} />
        Categories
      </span>
      <span className="ml-auto"><GoChevronRight size={18} /></span>
    </button>
  );

  const removeOption = (
    <button
      className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
      onClick={(e) => { e.stopPropagation(); onRemove(article.id); onClose(); }}
    >
      <span className="flex items-center gap-1">
        <LuTrash size={16} />
        Remove
      </span>
    </button>
  );

  const retryOption = (
    <button
      className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
      onClick={() => { onRetry(article.id); onClose(); }}
    >
      <span className="flex items-center space-x-2">
        <BsArrowCounterclockwise size={20} />
        Retry
      </span>
    </button>
  );

  if (article.status === 'finished') {
    return (
      <>
        {viewArticleOption}
        {openInBrowserOption}
        {openFolderOption}
        {favoritesOption}
        {tagsOption}
        {categoriesOption}
        {removeOption}
      </>
    );
  }

  if (article.status === 'failed') {
    return (
      <>
        {retryOption}
        {openInBrowserOption}
        {removeOption}
      </>
    );
  }

  // for_download | loading
  return <>{removeOption}</>;
};
```

- [ ] **Step 6: Replace the `return` with the full JSX**

```typescript
return (
  <>
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 z-50 dark:border-gray-700 min-w-[175px]"
      style={{ left: `${position.x}px`, top: `${position.y}px`, maxHeight: '80vh', overflowY: 'auto' }}
    >
      {renderMenuOptions()}
    </div>

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
                if (e.key === 'Enter' && target.value.trim() && target.value.trim().length <= 10) {
                  const newTag = target.value.trim();
                  const isDuplicate = availableTags.some(
                    (t) => t.toLowerCase() === newTag.toLowerCase(),
                  );
                  if (isDuplicate) {
                    toast({ variant: 'destructive', title: 'Duplicate Tag', description: `Tag "${newTag}" already exists.`, duration: 2000 });
                  } else {
                    onAddTag(article.id, newTag);
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
                  onRemoveTag(article.id, tag);
                } else {
                  onAddTag(article.id, tag);
                }
              }}
            >
              <span className="dark:text-gray-200">{currentTags.includes(tag) ? '✓' : ''}</span>
              <span>{tag}</span>
            </button>
          ))}
        </div>
      </div>
    )}

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
                if (e.key === 'Enter' && target.value.trim() && target.value.trim().length <= 10) {
                  const newCategory = target.value.trim();
                  const isDuplicate = availableCategories.some(
                    (c) => c.toLowerCase() === newCategory.toLowerCase(),
                  );
                  if (isDuplicate) {
                    toast({ variant: 'destructive', title: 'Duplicate Category', description: `Category "${newCategory}" already exists.`, duration: 2000 });
                  } else {
                    if (currentCategories.length > 0) {
                      onRemoveCategory(article.id, currentCategories[0]);
                    }
                    onAddCategory(article.id, newCategory);
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
                  onRemoveCategory(article.id, category);
                } else {
                  if (currentCategories.length > 0) {
                    onRemoveCategory(article.id, currentCategories[0]);
                  }
                  onAddCategory(article.id, category);
                }
              }}
            >
              <span className="dark:text-gray-200">{currentCategories.includes(category) ? '✓' : ''}</span>
              <span>{category}</span>
            </button>
          ))}
        </div>
      </div>
    )}
  </>
);
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors in `ArticleContextMenu.tsx`.

- [ ] **Step 8: Commit**

```bash
git add src/afda/components/contextMenu/ArticleContextMenu.tsx
git commit -m "feat(afda): add ArticleContextMenu component"
```

---

### Task 3: Wire up ArticleContextMenu in AfdaDownloads

**Files:**
- Modify: `src/afda/pages/selectedTabPages/AfdaDownloads.tsx`

**Interfaces:**
- Consumes: `ArticleContextMenu` default export from `@/afda/components/contextMenu/ArticleContextMenu`
- Consumes: `addArticleTag`, `removeArticleTag`, `addArticleCategory`, `removeArticleCategory` from `useArticleDownloadStore`
- Consumes: `isFavorited`, `addFavorite`, `removeFavorite` from `useFavoritesStore` at `@/downlodr/store/favoritesStore`
- Consumes: `removeArticleDownload` from `useArticleDownloadStore`

- [ ] **Step 1: Add imports to `AfdaDownloads.tsx`**

Add at the top of the file with the other imports:

```typescript
import ArticleContextMenu from '@/afda/components/contextMenu/ArticleContextMenu';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import { useFavoritesStore } from '@/downlodr/store/favoritesStore';
import type { ArticleDownload } from '@/afda/store/articleDownloadStore';
```

Note: `useArticleDownloadStore` is already imported. Only add the new ones.

- [ ] **Step 2: Add context menu state and store actions**

Inside `AfdaDownloads`, after the existing `useState` declarations, add:

```typescript
const [contextMenu, setContextMenu] = useState<{
  article: ArticleDownload;
  position: { x: number; y: number };
} | null>(null);

const removeArticleDownload = useArticleDownloadStore((s) => s.removeArticleDownload);
const addArticleTag = useArticleDownloadStore((s) => s.addArticleTag);
const removeArticleTag = useArticleDownloadStore((s) => s.removeArticleTag);
const addArticleCategory = useArticleDownloadStore((s) => s.addArticleCategory);
const removeArticleCategory = useArticleDownloadStore((s) => s.removeArticleCategory);

const isFavorited = useFavoritesStore((s) => s.isFavorited);
const addFavorite = useFavoritesStore((s) => s.addFavorite);
const removeFavorite = useFavoritesStore((s) => s.removeFavorite);
```

- [ ] **Step 3: Derive all available tags and categories across all articles**

After the `contextMenu` state declaration:

```typescript
const allAvailableTags = useMemo(
  () => [...new Set(allArticleDownloads.flatMap((a) => a.tags))],
  [allArticleDownloads],
);

const allAvailableCategories = useMemo(
  () => [...new Set(allArticleDownloads.flatMap((a) => a.category))],
  [allArticleDownloads],
);
```

- [ ] **Step 4: Add `onContextMenu` handler to each article row button**

In the `filteredArticles.map` render block, update the article `<button>` element to add `onContextMenu`:

```typescript
<button
  key={article.id}
  type="button"
  onClick={() =>
    handleSelectStoreArticle(article.id, article.url, article.title)
  }
  onContextMenu={(e) => {
    e.preventDefault();
    setContextMenu({ article, position: { x: e.clientX, y: e.clientY } });
  }}
  className={`w-full text-left px-3 py-3 transition-colors ${
    isActive
      ? 'bg-[#F3F3F3] dark:bg-darkModeTable'
      : 'hover:bg-gray-50 dark:hover:bg-zinc-700'
  }`}
>
```

- [ ] **Step 5: Render the context menu at the bottom of the component return**

Inside the `return (...)` of `AfdaDownloads`, before the closing `</div>`, add:

```typescript
{contextMenu && (
  <ArticleContextMenu
    article={contextMenu.article}
    position={contextMenu.position}
    onClose={() => setContextMenu(null)}
    onViewArticle={(id) => {
      const a = allArticleDownloads.find((d) => d.id === id);
      if (a) handleSelectStoreArticle(a.id, a.url, a.title);
    }}
    onOpenInBrowser={(url) => window.open(url, '_blank')}
    onOpenFolder={(filePath) => {
      (window as any).downlodrFunctions?.openFolder?.(filePath);
    }}
    onRemove={(id) => removeArticleDownload(id)}
    onRetry={(id) => {
      const a = allArticleDownloads.find((d) => d.id === id);
      if (a) {
        useArticleDownloadStore.getState().updateArticleDownload(id, { status: 'for_download' });
      }
    }}
    onToggleFavorite={(id) => {
      const a = allArticleDownloads.find((d) => d.id === id);
      if (!a) return;
      if (isFavorited(id)) {
        removeFavorite(id);
      } else {
        addFavorite({
          downloadId: a.id,
          videoUrl: a.url,
          title: a.title,
          displayName: a.title,
          downloadName: a.title,
          location: a.filePath ?? '',
          channelName: '',
          thumbnail: undefined,
          ext: '',
          duration: 0,
          size: a.fileSize ?? 0,
          extractorKey: '',
          tags: a.tags,
          category: a.category,
          description: undefined,
          chapters: undefined,
          status: a.status,
          autoCaptionLocation: undefined,
          transcriptLocation: undefined,
          dateAdded: a.dateAdded,
        });
      }
    }}
    isFavorited={contextMenu ? isFavorited(contextMenu.article.id) : false}
    onAddTag={addArticleTag}
    onRemoveTag={removeArticleTag}
    currentTags={contextMenu?.article.tags ?? []}
    availableTags={allAvailableTags}
    onAddCategory={addArticleCategory}
    onRemoveCategory={removeArticleCategory}
    currentCategories={contextMenu?.article.category ?? []}
    availableCategories={allAvailableCategories}
  />
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Manual smoke test**

1. Run the app
2. Navigate to AFDA → select a website → Downloads tab
3. Right-click an article row — context menu should appear near the cursor
4. For a `finished` article: verify all 7 options appear (View Article, Open in Browser, Open Folder, Favorites, Tags, Categories, Remove)
5. For a `failed` article: verify only Retry, Open in Browser, Remove appear
6. For a `for_download` article: verify only Remove appears
7. Click Tags → submenu opens to the right; type a tag and press Enter → tag appears in list
8. Click outside the menu → menu closes
9. Press Escape → menu closes

- [ ] **Step 8: Commit**

```bash
git add src/afda/pages/selectedTabPages/AfdaDownloads.tsx
git commit -m "feat(afda): wire up ArticleContextMenu in AfdaDownloads"
```
