# Favorites Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Favorites system — heart button in the video player and status page rows, snapshot-based Zustand store with IndexedDB persistence, and a dedicated Favorites page in the nav.

**Architecture:** A new `favoritesStore` stores self-contained snapshots of favorited downloads (survives download deletion). Heart buttons in `VideoPlayerPanel` and `StatusPageTableRow` toggle favorites. `FavoritesPage` renders the favorites list in a table mirroring StatusPage, with a side video player panel.

**Tech Stack:** React, Zustand + `persist` middleware, IndexedDB via `createIndexedDBStorageWithMigration`, React Router v6, Tailwind CSS, react-icons.

---

## File Map

| Action | File |
|--------|------|
| **Create** | `src/downlodr/store/favoritesStore.ts` |
| **Create** | `src/downlodr/pages/FavoritesPage.tsx` |
| **Modify** | `src/downlodr/components/panel/VideoPlayerPanel.tsx` |
| **Modify** | `src/downlodr/pages/StatusPage.tsx` |
| **Modify** | `src/downlodr/pages/status/StatusPageTableRow.tsx` |
| **Modify** | `src/downlodr/components/navigation/DownloadNavigationBar.tsx` |
| **Modify** | `src/App.tsx` |

---

## Task 1: Create favoritesStore

**Files:**
- Create: `src/downlodr/store/favoritesStore.ts`

- [ ] **Step 1: Create the store file**

Create `src/downlodr/store/favoritesStore.ts` with this exact content:

```ts
import { createIndexedDBStorageWithMigration } from '@/core-app/utils/indexedDBStorage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface FavoriteItem {
  id: string;
  downloadId: string;
  videoUrl: string;
  title: string;
  displayName?: string;
  downloadName: string;
  location: string;
  channelName: string;
  thumbnail?: string;
  ext: string;
  duration: number;
  size: number;
  extractorKey: string;
  tags: string[];
  category: string[];
  description?: string;
  status: string;
  autoCaptionLocation?: string;
  transcriptLocation?: string;
  dateAdded: string;
  favoritedAt: string;
}

interface FavoritesState {
  favorites: FavoriteItem[];
  addFavorite: (snapshot: Omit<FavoriteItem, 'id' | 'favoritedAt'>) => void;
  removeFavorite: (downloadId: string) => void;
  isFavorited: (downloadId: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],

      addFavorite: (snapshot) => {
        if (get().isFavorited(snapshot.downloadId)) return;
        set((state) => ({
          favorites: [
            ...state.favorites,
            {
              ...snapshot,
              id: crypto.randomUUID(),
              favoritedAt: new Date().toISOString(),
            },
          ],
        }));
      },

      removeFavorite: (downloadId) => {
        set((state) => ({
          favorites: state.favorites.filter((f) => f.downloadId !== downloadId),
        }));
      },

      isFavorited: (downloadId) => {
        return get().favorites.some((f) => f.downloadId === downloadId);
      },
    }),
    {
      name: 'favorites-store',
      storage: createJSONStorage(() =>
        createIndexedDBStorageWithMigration({
          dbName: 'downlodr-database',
          storeName: 'favorites-storage',
          version: 1,
        }),
      ),
    },
  ),
);
```

- [ ] **Step 2: Verify the file builds**

Run: `yarn lint`
Expected: No errors related to `favoritesStore.ts`. (Other pre-existing lint warnings are fine.)

- [ ] **Step 3: Commit**

```bash
git add src/downlodr/store/favoritesStore.ts
git commit -m "feat: add favoritesStore with IndexedDB persistence"
```

---

## Task 2: Add heart button to StatusPageTableRow action column

**Files:**
- Modify: `src/downlodr/pages/status/StatusPageTableRow.tsx`

The action column currently contains only `<ShareButton />`. Add a heart button before it that reads from `useFavoritesStore`.

- [ ] **Step 1: Add the import for FaHeart / FaRegHeart and useFavoritesStore**

At the top of `src/downlodr/pages/status/StatusPageTableRow.tsx`, after the existing imports, add:

```ts
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { useFavoritesStore } from '@/downlodr/store/favoritesStore';
```

- [ ] **Step 2: Add the FavoriteButton component inside the file**

After all imports but before `const THUMB_PLACEHOLDER_CLASS`, add:

```tsx
const FavoriteButton: React.FC<{ download: SearchableDownload }> = ({
  download,
}) => {
  const isFavorited = useFavoritesStore((s) => s.isFavorited(download.id));
  const addFavorite = useFavoritesStore((s) => s.addFavorite);
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFavorited) {
      removeFavorite(download.id);
    } else {
      addFavorite({
        downloadId: download.id,
        videoUrl: download.videoUrl ?? '',
        title: download.name ?? '',
        displayName: download.displayName,
        downloadName: download.downloadName ?? '',
        location: download.location ?? '',
        channelName: download.channelName ?? '',
        thumbnail:
          typeof download.thumbnails === 'string' &&
          download.thumbnails !== '—'
            ? download.thumbnails
            : undefined,
        ext: download.ext ?? '',
        duration: download.duration ?? 0,
        size: download.size ?? 0,
        extractorKey: download.extractorKey ?? '',
        tags: download.tags ?? [],
        category: download.category ?? [],
        description: download.description,
        status: download.status ?? '',
        autoCaptionLocation: download.autoCaptionLocation,
        transcriptLocation: download.transcriptLocation,
        dateAdded: download.DateAdded ?? '',
      });
    }
  };

  return (
    <button
      onClick={handleClick}
      className="p-1 hover:opacity-80 transition-opacity"
      title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      {isFavorited ? (
        <FaHeart size={14} className="text-red-400" />
      ) : (
        <FaRegHeart size={14} className="text-gray-400 dark:text-gray-500" />
      )}
    </button>
  );
};
```

- [ ] **Step 3: Replace the action column cell to include FavoriteButton**

Find the `case 'action':` block in `StatusPageTableRow.tsx` (around line 569). It currently renders:

```tsx
case 'action':
  return (
    <td
      key={column.id}
      style={{ width: column.width }}
      className="p-2 dark:text-gray-200 text-center"
    >
      <ShareButton
        videoUrl={download.videoUrl}
        name={download.name}
        status={download.status}
        thumbnailLocation={thumbnailDataUrls[download.id]}
        format={download.ext || download.audioExt}
        size={download.size}
      />
    </td>
  );
```

Replace it with:

```tsx
case 'action':
  return (
    <td
      key={column.id}
      style={{ width: column.width }}
      className="p-2 dark:text-gray-200 text-center"
    >
      <div className="flex items-center justify-center gap-1">
        <FavoriteButton download={download} />
        <ShareButton
          videoUrl={download.videoUrl}
          name={download.name}
          status={download.status}
          thumbnailLocation={thumbnailDataUrls[download.id]}
          format={download.ext || download.audioExt}
          size={download.size}
        />
      </div>
    </td>
  );
```

- [ ] **Step 4: Verify with lint**

Run: `yarn lint`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add src/downlodr/pages/status/StatusPageTableRow.tsx
git commit -m "feat: add heart/favorite button to status page action column"
```

---

## Task 3: Wire the heart button in VideoPlayerPanel

**Files:**
- Modify: `src/downlodr/components/panel/VideoPlayerPanel.tsx`

The panel already renders `<FaRegHeart />` but the button does nothing. We add `downloadId` as a prop and wire the button to `useFavoritesStore`.

- [ ] **Step 1: Add downloadId to the props interface**

In `src/downlodr/components/panel/VideoPlayerPanel.tsx`, find the `VideoPlayerPanelProps` interface and add `downloadId` as an optional prop right after `extractorKey`:

```ts
interface VideoPlayerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
  autoCaptionLocation?: string;
  transcriptLocation?: string;
  width: number;
  onWidthChange: (w: number) => void;
  status?: string;
  downloadName?: string;
  displayName?: string;
  dateAdded?: string;
  location?: string;
  tags?: string[];
  category?: string[];
  description?: string;
  channelName?: string;
  thumbnail?: string;
  ext?: string;
  duration?: number;
  size?: number;
  extractorKey?: string;
  downloadId?: string;           // ← add this
}
```

- [ ] **Step 2: Destructure downloadId in the component**

In the component function signature, add `downloadId` to the destructured props:

```tsx
const VideoPlayerPanel: React.FC<VideoPlayerPanelProps> = ({
  isOpen,
  onClose,
  videoUrl,
  title,
  autoCaptionLocation,
  transcriptLocation,
  width,
  onWidthChange,
  status,
  downloadName,
  displayName,
  dateAdded,
  location,
  tags,
  category,
  description,
  channelName,
  thumbnail,
  ext,
  duration,
  size,
  extractorKey,
  downloadId,       // ← add this
}) => {
```

- [ ] **Step 3: Add imports for FaHeart, FaRegHeart, and useFavoritesStore**

At the top of `VideoPlayerPanel.tsx`, replace the existing `FaRegHeart` import line:

```ts
import { FaRegHeart } from 'react-icons/fa6';
```

With:

```ts
import { FaHeart, FaRegHeart } from 'react-icons/fa6';
import { useFavoritesStore } from '@/downlodr/store/favoritesStore';
```

- [ ] **Step 4: Add favorite state and handler inside the component**

Add these lines right after the existing state declarations (after the `containerRef` line, before `revokeLocalBlob`):

```ts
const isFavorited = useFavoritesStore((s) =>
  downloadId ? s.isFavorited(downloadId) : false,
);
const addFavorite = useFavoritesStore((s) => s.addFavorite);
const removeFavorite = useFavoritesStore((s) => s.removeFavorite);

const handleToggleFavorite = () => {
  if (!downloadId) return;
  if (isFavorited) {
    removeFavorite(downloadId);
  } else {
    addFavorite({
      downloadId,
      videoUrl: videoUrl ?? '',
      title: title ?? '',
      displayName,
      downloadName: downloadName ?? '',
      location: location ?? '',
      channelName: channelName ?? '',
      thumbnail,
      ext: ext ?? '',
      duration: duration ?? 0,
      size: size ?? 0,
      extractorKey: extractorKey ?? '',
      tags: tags ?? [],
      category: category ?? [],
      description,
      status: status ?? '',
      autoCaptionLocation,
      transcriptLocation,
      dateAdded: dateAdded ?? '',
    });
  }
};
```

- [ ] **Step 5: Replace the static FaRegHeart button with the wired toggle**

Find the existing heart button in the JSX. It looks like:

```tsx
<button>
  <FaRegHeart />
</button>
```

Replace it with:

```tsx
<button
  onClick={handleToggleFavorite}
  className={`transition-colors ${downloadId ? 'hover:opacity-80' : 'opacity-30 cursor-default'}`}
  title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
>
  {isFavorited ? (
    <FaHeart className="text-red-400" />
  ) : (
    <FaRegHeart />
  )}
</button>
```

- [ ] **Step 6: Verify with lint**

Run: `yarn lint`
Expected: No new errors.

- [ ] **Step 7: Commit**

```bash
git add src/downlodr/components/panel/VideoPlayerPanel.tsx
git commit -m "feat: wire heart button in VideoPlayerPanel to favoritesStore"
```

---

## Task 4: Thread downloadId through StatusPage to VideoPlayerPanel

**Files:**
- Modify: `src/downlodr/pages/StatusPage.tsx`

`videoPlayerState` currently lacks `downloadId`. We add it so VideoPlayerPanel knows which download it's showing.

- [ ] **Step 1: Add downloadId to videoPlayerState type in StatusPage**

In `src/downlodr/pages/StatusPage.tsx`, find the `videoPlayerState` useState declaration. Its type object currently ends with `extractorKey`. Add `downloadId` to the type:

```tsx
const [videoPlayerState, setVideoPlayerState] = useState<{
  isOpen: boolean;
  videoUrl: string;
  title: string;
  autoCaptionLocation?: string;
  transcriptLocation?: string;
  displayName?: string;
  dateAdded?: string;
  location?: string;
  tags?: string[];
  category?: string[];
  status?: string;
  downloadName?: string;
  description?: string;
  channelName?: string;
  thumbnail?: string;
  ext?: string;
  duration?: number;
  size?: number;
  extractorKey?: string;
  downloadId?: string;           // ← add this
}>({ isOpen: false, videoUrl: '', title: '' });
```

- [ ] **Step 2: Pass downloadId in the onViewEmbed handler**

Find the `onViewEmbed` prop in the `StatusPageTable` JSX (around line 681 in StatusPage.tsx). It currently calls `setVideoPlayerState` with a spread of download fields. Add `downloadId: download.id` to that object:

```tsx
onViewEmbed={(download) => {
  setVideoPlayerState({
    isOpen: true,
    videoUrl: download.videoUrl ?? '',
    title: download.displayName ?? download.name ?? '',
    autoCaptionLocation: download.autoCaptionLocation,
    transcriptLocation: download.transcriptLocation,
    displayName: download.displayName,
    dateAdded: download.DateAdded,
    location: download.location,
    tags: download.tags,
    category: download.category,
    status: download.status,
    downloadName: download.name,
    description: download.description,
    channelName: download.channelName,
    thumbnail: typeof download.thumbnails === 'string' && download.thumbnails !== '—' ? download.thumbnails : undefined,
    ext: download.ext,
    duration: download.duration,
    size: download.size,
    extractorKey: download.extractorKey,
    downloadId: download.id,     // ← add this
  });
}}
```

- [ ] **Step 3: Pass downloadId to the VideoPlayerPanel JSX**

Find the `<VideoPlayerPanel ... />` in StatusPage.tsx and add the `downloadId` prop:

```tsx
<VideoPlayerPanel
  isOpen={videoPlayerState.isOpen}
  onClose={() =>
    setVideoPlayerState({
      isOpen: false,
      videoUrl: '',
      title: '',
      autoCaptionLocation: undefined,
      transcriptLocation: undefined,
      displayName: undefined,
      dateAdded: undefined,
      location: undefined,
      tags: undefined,
      category: undefined,
      description: undefined,
      channelName: undefined,
      thumbnail: undefined,
      ext: undefined,
      duration: undefined,
      size: undefined,
      extractorKey: undefined,
      downloadId: undefined,     // ← add this
    })
  }
  videoUrl={videoPlayerState.videoUrl}
  title={videoPlayerState.title}
  autoCaptionLocation={videoPlayerState.autoCaptionLocation}
  transcriptLocation={videoPlayerState.transcriptLocation}
  displayName={videoPlayerState.displayName}
  dateAdded={videoPlayerState.dateAdded}
  location={videoPlayerState.location}
  tags={videoPlayerState.tags}
  category={videoPlayerState.category}
  status={videoPlayerState.status}
  downloadName={videoPlayerState.downloadName}
  description={videoPlayerState.description}
  channelName={videoPlayerState.channelName}
  thumbnail={videoPlayerState.thumbnail}
  ext={videoPlayerState.ext}
  duration={videoPlayerState.duration}
  size={videoPlayerState.size}
  extractorKey={videoPlayerState.extractorKey}
  downloadId={videoPlayerState.downloadId}               // ← add this
  width={panelWidth}
  onWidthChange={setPanelWidth}
/>
```

- [ ] **Step 4: Verify with lint**

Run: `yarn lint`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add src/downlodr/pages/StatusPage.tsx
git commit -m "feat: thread downloadId through StatusPage into VideoPlayerPanel"
```

---

## Task 5: Create FavoritesPage

**Files:**
- Create: `src/downlodr/pages/FavoritesPage.tsx`

This page mirrors StatusPage: same resizable columns, same video player side panel. Data comes from `useFavoritesStore` instead of the download store.

- [ ] **Step 1: Create FavoritesPage.tsx**

Create `src/downlodr/pages/FavoritesPage.tsx` with this content:

```tsx
import { useMainStore } from '@/core-app/store/mainStore';
import { useResizableColumns } from '@/downlodr/components/download/resizableColumns/useResizableColumns';
import VideoPlayerPanel from '@/downlodr/components/panel/VideoPlayerPanel';
import ResizableHeader from '@/downlodr/components/download/resizableColumns/ResizableHeader';
import ShareButton from '@/downlodr/components/download/ShareButton';
import {
  FavoriteItem,
  useFavoritesStore,
} from '@/downlodr/store/favoritesStore';
import { getExtractorIcon } from '@/downlodr/utils/icons/iconMapper';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import React, { useMemo, useState } from 'react';
import { FaHeart } from 'react-icons/fa';

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  if (diffWeeks < 4) return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
  if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
  return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
};

const formatFileSize = (bytes: number): string => {
  if (!bytes) return '—';
  const GB = 1073741824;
  const MB = 1048576;
  const KB = 1024;
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(2)} KB`;
  return `${bytes} bytes`;
};

const FavoritesPage: React.FC = () => {
  const favorites = useFavoritesStore((s) => s.favorites);
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite);
  const visibleColumns = useMainStore((state) => state.visibleColumns);

  const initialColumns = useMemo(
    () => [
      { id: 'name', width: Math.max(Math.floor(window.innerWidth * 0.3), 180), minWidth: 180 },
      { id: 'size', width: 70, minWidth: 50 },
      { id: 'format', width: 90, minWidth: 70 },
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
  } = useResizableColumns(initialColumns, visibleColumns);

  const displayColumns = useMemo(
    () => columns.filter((col) => ['name', 'size', 'format', 'dateAdded', 'source', 'action'].includes(col.id)),
    [columns],
  );

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
  };

  return (
    <div className="flex flex-col h-full bg-[#F9F9F9] dark:bg-darkMode">
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div
          className="flex flex-row h-full overflow-hidden"
          style={{ minHeight: 0 }}
        >
          {/* Table area */}
          <div
            className="flex flex-col flex-1 min-w-0 overflow-auto"
            style={{
              width: videoPlayerState.isOpen ? `${100 - panelWidth}%` : '100%',
              transition: 'width 200ms ease',
            }}
          >
            <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <FaHeart className="text-red-400" size={16} />
              <span className="font-semibold text-sm dark:text-gray-200">
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
                <p className="text-sm">
                  Heart a video in the player to save it here
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 z-20 bg-white dark:bg-alternateBlack">
                  <tr className="text-left">
                    {displayColumns.map((column, displayIndex) => (
                      <ResizableHeader
                        key={column.id}
                        width={column.width}
                        onResizeStart={(e) => startResizing(column.id, e.clientX)}
                        index={columns.findIndex((c) => c.id === column.id)}
                        onDragStart={startDragging}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onDragEnd={cancelDrag}
                        isDragging={dragging?.columnId === column.id}
                        isDragOver={
                          dragOverIndex ===
                          columns.findIndex((c) => c.id === column.id)
                        }
                        columnId={column.id}
                        isLastColumn={displayIndex === displayColumns.length - 1}
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {column.id === 'name'
                            ? 'Title'
                            : column.id === 'dateAdded'
                            ? 'Date Added'
                            : column.id === 'source'
                            ? 'Source'
                            : column.id === 'format'
                            ? 'Format'
                            : column.id.charAt(0).toUpperCase() +
                              column.id.slice(1)}
                        </span>
                      </ResizableHeader>
                    ))}
                  </tr>
                  <tr className="pointer-events-none">
                    <th
                      colSpan={999}
                      className="p-0 h-[1px] bg-gray-200 dark:bg-darkModeCompliment"
                    />
                  </tr>
                </thead>
                <tbody>
                  {favorites.map((fav) => (
                    <tr
                      key={fav.id}
                      className={`border-b-2 hover:bg-gray-50 dark:border-[#27272ACC] dark:hover:bg-darkModeHover cursor-pointer ${
                        selectedId === fav.id
                          ? 'bg-blue-50 dark:bg-gray-600'
                          : 'dark:bg-darkMode'
                      }`}
                      onClick={() => {
                        setSelectedId(fav.id === selectedId ? null : fav.id);
                        openPlayer(fav);
                      }}
                    >
                      {displayColumns.map((column) => {
                        switch (column.id) {
                          case 'name':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200 flex items-center gap-3"
                              >
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
                                  <span className="line-clamp-2 break-words text-sm">
                                    {fav.displayName ?? fav.title}
                                  </span>
                                </TooltipWrapper>
                              </td>
                            );
                          case 'size':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200 text-sm"
                              >
                                {formatFileSize(fav.size)}
                              </td>
                            );
                          case 'format':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200 text-sm"
                              >
                                {fav.ext ? fav.ext.toUpperCase() : '—'}
                              </td>
                            );
                          case 'dateAdded':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200 text-sm"
                              >
                                {fav.dateAdded
                                  ? formatRelativeTime(fav.dateAdded)
                                  : '—'}
                              </td>
                            );
                          case 'source':
                            return (
                              <td
                                key={column.id}
                                style={{ width: column.width }}
                                className="p-2 dark:text-gray-200 text-center"
                              >
                                <TooltipWrapper
                                  content={fav.extractorKey}
                                  side="bottom"
                                >
                                  <a
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.downlodrFunctions.openExternalLink(
                                        fav.videoUrl,
                                      );
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
                                    <FaHeart
                                      size={14}
                                      className="text-red-400"
                                    />
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
    </div>
  );
};

export default FavoritesPage;
```

- [ ] **Step 2: Verify with lint**

Run: `yarn lint`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/downlodr/pages/FavoritesPage.tsx
git commit -m "feat: add FavoritesPage with table and video player panel"
```

---

## Task 6: Add nav item and route

**Files:**
- Modify: `src/downlodr/components/navigation/DownloadNavigationBar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add FaHeart import to the nav bar**

In `src/downlodr/components/navigation/DownloadNavigationBar.tsx`, add to the react-icons imports:

```ts
import { FaHeart } from 'react-icons/fa';
```

- [ ] **Step 2: Add the Favorites NavItem after "Finished" in the Status section**

In `DownloadNavigationBar.tsx`, find the `NavItem` for `/status/finished`:

```tsx
<NavItem
  to="/status/finished"
  label="Finished"
  icon={
    <MdPlayArrow
      size={18}
      className="text-green-500 flex-shrink-0"
    />
  }
  collapsed={isCollapsed}
/>
```

Add the Favorites `NavItem` immediately after it:

```tsx
<NavItem
  to="/favorites"
  label="Favorites"
  icon={
    <FaHeart
      size={15}
      className="text-red-400 flex-shrink-0"
    />
  }
  collapsed={isCollapsed}
  activeClass="bg-titleBar dark:bg-darkModeNavigation"
  hoverClass="hover:bg-titleBar dark:hover:bg-darkModeNavigation"
/>
```

- [ ] **Step 3: Add the /favorites route in App.tsx**

In `src/App.tsx`, find the `MainLayout` route group:

```tsx
<Route path="/" element={<MainLayout />}>
  <Route index element={<Navigate to="/status/all" replace />} />
  <Route path="/history" element={<History />} />
  <Route path="/status/:status" element={<StatusSpecificDownloads />} />
  <Route path="*" element={<NotFound />} />
  <Route path="/tags/:tagId" element={<TagPage />} />
  <Route path="/category/:categoryId" element={<CategoryPage />} />
</Route>
```

Add the favorites route (import `FavoritesPage` at the top first):

```tsx
import FavoritesPage from './downlodr/pages/FavoritesPage';
```

Then add the route:

```tsx
<Route path="/favorites" element={<FavoritesPage />} />
```

So the group becomes:

```tsx
<Route path="/" element={<MainLayout />}>
  <Route index element={<Navigate to="/status/all" replace />} />
  <Route path="/history" element={<History />} />
  <Route path="/status/:status" element={<StatusSpecificDownloads />} />
  <Route path="*" element={<NotFound />} />
  <Route path="/tags/:tagId" element={<TagPage />} />
  <Route path="/category/:categoryId" element={<CategoryPage />} />
  <Route path="/favorites" element={<FavoritesPage />} />
</Route>
```

- [ ] **Step 4: Verify with lint**

Run: `yarn lint`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add src/downlodr/components/navigation/DownloadNavigationBar.tsx src/App.tsx
git commit -m "feat: add Favorites nav item and /favorites route"
```

---

## Spec Coverage Check

| Spec requirement | Covered by |
|-----------------|------------|
| Snapshot-based FavoriteItem store | Task 1 |
| IndexedDB persistence | Task 1 |
| `addFavorite`, `removeFavorite`, `isFavorited` actions | Task 1 |
| Heart button in StatusPageTableRow action column | Task 2 |
| Heart wired in VideoPlayerPanel | Task 3 |
| `downloadId` prop on VideoPlayerPanel | Task 3 |
| `downloadId` threaded from StatusPage | Task 4 |
| FavoritesPage mirroring StatusPage layout | Task 5 |
| Video player side panel in FavoritesPage | Task 5 |
| Empty state message | Task 5 |
| Heart in action column removes from favorites | Task 5 |
| Favorites nav item with FaHeart icon | Task 6 |
| `/favorites` route under MainLayout | Task 6 |
