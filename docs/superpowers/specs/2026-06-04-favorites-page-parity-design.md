# Favorites Page Parity Design

**Date:** 2026-06-04
**Goal:** Bring `FavoritesPage` to feature parity with `StatusPage` — context menu, checkboxes with select-all, status column, and matching spacing/padding.

---

## 1. Data Layer — `favoritesStore.ts`

Add two new methods to `FavoritesState`:

```ts
updateFavoriteTags(downloadId: string, tags: string[]): void
updateFavoriteCategories(downloadId: string, categories: string[]): void
```

Each replaces the respective array on the matching `FavoriteItem` (matched by `downloadId`).

Available tags and categories for the context menu submenus are sourced from `useDownloadStore` (`availableTags`, `availableCategories`) — not duplicated in the favorites store.

---

## 2. New Component — `FavoritesContextMenu`

**Path:** `src/downlodr/components/contextMenu/FavoritesContextMenu.tsx`

### Props

| Prop | Type | Description |
|------|------|-------------|
| `favorite` | `FavoriteItem` | The favorited item being acted on |
| `position` | `{ x: number, y: number }` | Screen position for the menu |
| `onClose` | `() => void` | Close the menu |
| `onViewFolder` | `(location: string, name: string) => void` | Open containing folder |
| `onViewDownload` | `(location: string, downloadId: string) => void` | Open in external player |
| `onViewEmbed` | `(fav: FavoriteItem) => void` | Open in-app video player |
| `onRemoveFavorite` | `(downloadId: string) => void` | Remove from favorites |
| `onAddTag` | `(downloadId: string, tag: string) => void` | Add a tag |
| `onRemoveTag` | `(downloadId: string, tag: string) => void` | Remove a tag |
| `currentTags` | `string[]` | Tags currently on this favorite |
| `availableTags` | `string[]` | All available tags (from downloadStore) |
| `onAddCategory` | `(downloadId: string, category: string) => void` | Add a category |
| `onRemoveCategory` | `(downloadId: string, category: string) => void` | Remove a category |
| `currentCategories` | `string[]` | Categories currently on this favorite |
| `availableCategories` | `string[]` | All available categories (from downloadStore) |

### Menu Items (always shown — no status-gating)

1. View Folder
2. Open with External Player
3. View Embedded (in-app player)
4. Remove from Favorites
5. Tags → submenu (input + list, same pattern as `DownloadContextMenu`)
6. Categories → submenu (same pattern)

### Behavior

- Positioning, viewport overflow adjustment, submenu flip logic — identical to `DownloadContextMenu`
- Click-outside and Escape key close the menu and all submenus
- Submenus for Tags and Categories use the same `TagContextMenu`/`CategoryContextMenu` submenu rendering pattern

---

## 3. `FavoritesPage.tsx` Changes

### 3a. Checkboxes + Select All

- Add local state: `selectedFavoriteIds: string[]` (no global `useSelectedDownloadStore` — favorites are independent of the download queue)
- Insert `checkbox` as the first column in `initialColumns` (width ~32px, minWidth 32px)
- Table `<thead>` first `<th>`: select-all checkbox — checked when all favorites are selected, indeterminate when some are
- Each `<tr>` first `<td>`: individual checkbox; `e.stopPropagation()` so checking does not toggle the video player
- Select-all logic: if all selected → clear; otherwise → select all IDs

### 3b. Status Column

- Add `status` to `initialColumns` (width 80px, minWidth 60px)
- Render `fav.status` as a capitalized, colored pill badge matching `StatusPageTableRow` color classes:
  - `finished` → green
  - `failed` → red
  - `paused` → yellow
  - `downloading` → blue
  - default → gray

### 3c. Context Menu

- Add state: `contextMenu: { favId: string | null, x: number, y: number }`
- `onContextMenu` on each `<tr>` → `e.preventDefault()`, capture `clientX/clientY`, set `contextMenu`
- Render `<FavoritesContextMenu>` when `contextMenu.favId !== null`
- Click-outside closes it via `useEffect` with `mousedown` listener (same pattern as StatusPage)
- Handlers wire up to: `window.downlodrFunctions.openFolder`, `window.downlodrFunctions.openFile`, `openPlayer`, `removeFavorite`, `updateFavoriteTags`, `updateFavoriteCategories`

### 3d. Column Order

`checkbox | name | size | format | status | dateAdded | source | action`

---

## 4. Spacing & Padding

| Element | Before | After |
|---------|--------|-------|
| Outer wrapper background | `bg-white dark:bg-darkMode` | `bg-[#F9F9F9] dark:bg-darkMode` |
| Outer flex gap | none | `gap-2` |
| `<thead>` background | `bg-white dark:bg-alternateBlack` | unchanged |
| Row cell padding | `p-2` | unchanged (already matches) |
| Header bar | `px-4 py-3` | unchanged |
| Scrollbar styling | present | unchanged |

---

## Out of Scope

- Bulk actions toolbar for selected favorites (e.g. "remove N selected") — not requested
- Persist selected favorites across navigation — local state only
- Plugin menu items in favorites context menu — favorites are snapshots, not live downloads
