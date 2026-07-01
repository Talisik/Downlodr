# Favorites Feature — Design Spec

**Date:** 2026-04-28  
**Status:** Approved

---

## Overview

Add a Favorites system that lets users heart-favorite any video from the VideoPlayerPanel or the StatusPage action column. Favorites are stored as persistent snapshots (independent of the download store) and are viewable on a dedicated Favorites page accessible from the navigation sidebar.

---

## Store

**File:** `src/downlodr/store/favoritesStore.ts`

Zustand store with IndexedDB persistence using `createIndexedDBStorageWithMigration` (same pattern as the download store).

### FavoriteItem shape

```ts
interface FavoriteItem {
  id: string               // crypto.randomUUID() — unique fav record ID
  downloadId: string       // source download ID, used for dedup
  videoUrl: string
  title: string
  displayName?: string
  downloadName: string
  location: string
  channelName: string
  thumbnail?: string
  ext: string
  duration: number
  size: number
  extractorKey: string
  tags: string[]
  category: string[]
  description?: string
  status: string
  autoCaptionLocation?: string
  transcriptLocation?: string
  dateAdded: string        // original download date
  favoritedAt: string      // ISO timestamp when favorited
}
```

### Actions

- `addFavorite(snapshot: Omit<FavoriteItem, 'id' | 'favoritedAt'>): void` — creates a new favorite; no-ops if `downloadId` already exists
- `removeFavorite(downloadId: string): void` — removes by `downloadId`
- `isFavorited(downloadId: string): boolean` — selector for toggle state
- `favorites: FavoriteItem[]` — the full list

### Persistence

- DB name: `downlodr-database` (same DB, different store name)
- Store name: `favorites-storage`
- Key: `favorites-store`

---

## Heart Button — VideoPlayerPanel

**File:** `src/downlodr/components/panel/VideoPlayerPanel.tsx`

- Add `downloadId: string` to `VideoPlayerPanelProps` (threaded from StatusPage which has the download object)
- Wire the existing `FaRegHeart` button: import `useFavoritesStore`, read `isFavorited(downloadId)`, call `addFavorite` / `removeFavorite` on click
- Swap icon: `FaRegHeart` (outline) when not favorited → `FaHeart` (filled, `text-red-400`) when favorited
- The `addFavorite` call packages all the props already available in the panel (title, videoUrl, location, etc.) into a snapshot

---

## Heart Button — StatusPage Actions Column

**File:** `src/downlodr/pages/status/StatusPageTable.tsx`

- In the `action` column cell, add a small heart icon button alongside the existing share button
- Reads `isFavorited(download.id)` — filled red when favorited, outline otherwise
- Clicking toggles the favorite, building the snapshot from the `download` object in scope
- Button is `size={14}`, subtle hover style consistent with the share button

---

## Favorites Page

**File:** `src/downlodr/pages/FavoritesPage.tsx`

Mirrors `StatusPage` in structure:

- Data source: `useFavoritesStore(state => state.favorites)` instead of `useDownloadStore`
- Same resizable/draggable columns: title, size, format, status, dateAdded, source, action
- Action column: heart button (clicking removes from favorites), share button
- Video player panel integration: same `videoPlayerState` + `VideoPlayerPanel` side panel pattern as StatusPage
- Sorting: same `sortColumn` / `sortDirection` state
- Empty state: a centered message "No favorites yet — heart a video in the player to save it here"
- No context menu needed (simpler read-only list; only removal action is the heart button)

The `FavoriteItem` shape carries all the data needed to open the VideoPlayerPanel (location, videoUrl, autoCaptionLocation, etc.), so playback works even if the original download is gone.

---

## Navigation

**File:** `src/downlodr/components/navigation/DownloadNavigationBar.tsx`

- Add a `NavItem` for Favorites after the "Finished" item in the Status section
- Icon: `FaHeart` from `react-icons/fa`, `text-red-400`
- Route: `/favorites`
- Label: `"Favorites"`

---

## Routing

**File:** `src/App.tsx`

Add inside the `MainLayout` route group:

```tsx
<Route path="/favorites" element={<FavoritesPage />} />
```

---

## Data flow summary

```
User clicks heart in VideoPlayerPanel or StatusPage action column
  → useFavoritesStore.addFavorite(snapshot)
  → IndexedDB persists snapshot

User navigates to /favorites
  → FavoritesPage reads useFavoritesStore.favorites
  → Renders same table as StatusPage
  → Clicking heart on a row calls removeFavorite(downloadId)

Heart icon state in VideoPlayerPanel / StatusPage action column
  → useFavoritesStore.isFavorited(downloadId) → filled / outline
```

---

## Files to create

- `src/downlodr/store/favoritesStore.ts`
- `src/downlodr/pages/FavoritesPage.tsx`

## Files to modify

- `src/downlodr/components/panel/VideoPlayerPanel.tsx` — add `downloadId` prop, wire heart button
- `src/downlodr/pages/StatusPage.tsx` — pass `downloadId` to VideoPlayerPanel
- `src/downlodr/pages/status/StatusPageTable.tsx` — add heart button to action column
- `src/downlodr/components/navigation/DownloadNavigationBar.tsx` — add Favorites nav item
- `src/App.tsx` — add `/favorites` route
