# ArticleContextMenu Design

**Date:** 2026-06-18  
**Status:** Approved

## Overview

A right-click context menu for `ArticleDownload` entries, used in two places:
- The AFDA downloads table (`AfdaDownloads.tsx`)
- The subscription article view (`AfdaSelectedViewTable.tsx`)

Modeled directly after `DownloadContextMenu.tsx` — same self-contained structure, positioning logic, and submenu pattern.

---

## File Location

```
src/afda/components/contextMenu/ArticleContextMenu.tsx
```

---

## Component Interface

```ts
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

---

## Status-Based Menu Rendering

| Status | Menu Items |
|---|---|
| `for_download` | Remove |
| `loading` | Remove |
| `finished` | View Article, Open in Browser, Open Folder, Favorites toggle, Tags submenu, Categories submenu, Remove |
| `failed` | Retry, Open in Browser, Remove |

---

## Internal Structure

### Positioning
- Menu `div` is `position: fixed`, initially placed at `position.x / position.y`
- A `useEffect` runs after mount via `requestAnimationFrame` to clamp the menu within the viewport (same pattern as `DownloadContextMenu`)
- Margin of 10px from all viewport edges

### Submenus (Tags & Categories)
- State: `showTagMenu`, `showCategoryMenu` (boolean)
- Only one submenu open at a time — opening one closes the other
- Submenu position calculated via `recalculateSubmenuPosition()`:
  - Anchored to the right of the main menu (`menuRect.right + 1`)
  - Vertically aligned to the trigger button
  - Flips left if it would overflow the right edge
  - Shifts up if it would overflow the bottom
- Submenus rendered outside the main menu `div` (siblings in the fragment) so they aren't clipped

### Tag Submenu
- Input to add new tag (max 10 chars, Enter to confirm)
- Duplicate check (case-insensitive) with destructive toast on duplicate
- Scrollable list of `availableTags` with checkmark on currently applied tags
- Click toggles add/remove

### Category Submenu
- Same structure as tag submenu
- Single-category constraint: adding a new category removes the existing one first

### Click-Outside & Escape
- `mousedown` listener checks if click is outside all open menus/submenus
- `keydown` listener closes on `Escape`
- Both cleaned up on unmount

---

## Icons

| Action | Icon |
|---|---|
| View Article | `LuEye` |
| Open in Browser | `LuExternalLink` |
| Open Folder | `LuFolderOpen` |
| Favorites (add) | `FaRegHeart` |
| Favorites (remove) | `FaHeart` (red) |
| Tags | `LiaTagsSolid` |
| Categories | `LiaTagsSolid` |
| Remove | `LuTrash` |
| Retry | `BsArrowCounterclockwise` |

---

## Usage Pattern

Both consumers wire up the component the same way — on right-click, set `contextMenu: { article, position }` in local state; pass `onClose={() => setContextMenu(null)}` to dismiss.

```tsx
{contextMenu && (
  <ArticleContextMenu
    article={contextMenu.article}
    position={contextMenu.position}
    onClose={() => setContextMenu(null)}
    onViewArticle={...}
    onOpenInBrowser={...}
    // ...etc
  />
)}
```
