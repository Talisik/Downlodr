# Video Player Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "View via Embed" right-click menu option that opens a modal playing the video via a native `<video>` element using a direct stream URL fetched through `window.ytdlp.getDirectUrl`.

**Architecture:** Three-file change — new `VideoPlayerModal` component handles all fetch + playback state internally using a generation counter for cancel-on-new; `DownloadContextMenu` gains an `onViewEmbed` prop and a new menu button; `StatusPage` owns the modal open/close state and wires everything together.

**Tech Stack:** React, TypeScript, Tailwind CSS, native HTML5 `<video>`, Electron IPC (`window.ytdlp.getDirectUrl`)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/downlodr/components/modal/custom/VideoPlayerModal.tsx` | Fetch direct URL, manage player state, render modal with video |
| Modify | `src/downlodr/components/contextMenu/DownloadContextMenu.tsx` | Add `onViewEmbed` prop + menu item |
| Modify | `src/downlodr/pages/StatusPage.tsx` | Own modal state, pass `onViewEmbed` to context menu, render modal |

---

## Task 1: Create `VideoPlayerModal` component

**Files:**
- Create: `src/downlodr/components/modal/custom/VideoPlayerModal.tsx`

- [ ] **Step 1: Create the file with full implementation**

```tsx
import BaseModal from '@/downlodr/components/modal/BaseModal';
import React, { useEffect, useRef, useState } from 'react';

type PlayerState = 'loading' | 'ready' | 'buffering' | 'error';

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
}

const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  isOpen,
  onClose,
  videoUrl,
  title,
}) => {
  const [playerState, setPlayerState] = useState<PlayerState>('loading');
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const generationRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isOpen || !videoUrl) return;

    // Increment generation — any in-flight request from a previous video
    // will see a mismatched generation and discard its result.
    generationRef.current += 1;
    const gen = generationRef.current;

    setPlayerState('loading');
    setDirectUrl(null);

    window.ytdlp
      .getDirectUrl(videoUrl)
      .then((url) => {
        if (gen !== generationRef.current) return; // stale — discard
        setDirectUrl(url);
        setPlayerState('ready');
      })
      .catch(() => {
        if (gen !== generationRef.current) return;
        setPlayerState('error');
      });

    // On cleanup (modal closes or videoUrl changes) bump generation
    // so any still-running fetch is ignored when it resolves.
    return () => {
      generationRef.current += 1;
    };
  }, [isOpen, videoUrl]);

  const handleRetry = () => {
    if (!videoUrl) return;
    generationRef.current += 1;
    const gen = generationRef.current;

    setPlayerState('loading');
    setDirectUrl(null);

    window.ytdlp
      .getDirectUrl(videoUrl)
      .then((url) => {
        if (gen !== generationRef.current) return;
        setDirectUrl(url);
        setPlayerState('ready');
      })
      .catch(() => {
        if (gen !== generationRef.current) return;
        setPlayerState('error');
      });
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title || 'Video Preview'}
      width="max-w-4xl"
      contentClassName="p-0"
      showCloseButton
    >
      <div className="relative w-full bg-black" style={{ aspectRatio: '16/9' }}>
        {/* Loading overlay */}
        {playerState === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white text-sm">Fetching stream URL…</p>
          </div>
        )}

        {/* Buffering overlay */}
        {playerState === 'buffering' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error overlay */}
        {playerState === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 gap-3">
            <p className="text-white text-sm">Could not load video stream.</p>
            <button
              onClick={handleRetry}
              className="px-4 py-1.5 bg-primary text-white text-sm rounded-md hover:opacity-90"
            >
              Retry
            </button>
          </div>
        )}

        {/* Video element */}
        {directUrl && (
          <video
            ref={videoRef}
            src={directUrl}
            controls
            autoPlay
            className="w-full h-full"
            onWaiting={() => setPlayerState('buffering')}
            onPlaying={() => setPlayerState('ready')}
            onCanPlay={() => setPlayerState('ready')}
            onError={() => setPlayerState('error')}
          />
        )}
      </div>
    </BaseModal>
  );
};

export default VideoPlayerModal;
```

- [ ] **Step 2: Verify TypeScript sees no errors**

Open the file in the IDE and confirm no red underlines. `window.ytdlp.getDirectUrl` is typed in `src/global.d.ts` — if it shows an error, confirm `getDirectUrl: (url: string) => Promise<string>` is present in the `ytdlp` block of that file.

- [ ] **Step 3: Commit**

```bash
git add src/downlodr/components/modal/custom/VideoPlayerModal.tsx
git commit -m "feat: add VideoPlayerModal with native video and cancel-on-new fetch"
```

---

## Task 2: Add `onViewEmbed` to `DownloadContextMenu`

**Files:**
- Modify: `src/downlodr/components/contextMenu/DownloadContextMenu.tsx`

- [ ] **Step 1: Add `onViewEmbed` to the props interface**

Find the `DownloadContextMenuProps` interface (around line 54). Add one line after `onShowStopModal`:

```ts
onViewEmbed: (videoUrl: string, title: string) => void;
```

- [ ] **Step 2: Destructure the new prop**

Find the destructured props in the component function signature (around line 106). Add `onViewEmbed` to the destructuring list:

```ts
const DownloadContextMenu: React.FC<DownloadContextMenuProps> = ({
  download,
  position,
  onClose,
  onPause,
  onRetry,
  onShowLog,
  onShowActivityTracker,
  onViewDownload,
  onAddTag,
  onRemoveTag,
  currentTags = [],
  availableTags = [],
  onAddCategory,
  onRemoveCategory,
  currentCategories = [],
  availableCategories = [],
  onViewFolder,
  onRename,
  onShowRemoveModal,
  onShowStopModal,
  onViewEmbed,         // ← add this
}) => {
```

- [ ] **Step 3: Add the "View via Embed" menu button**

`MdOutlinePlayCircle` is already imported. Add the button JSX as a reusable const inside `renderMenuOptions`, before the `if (download.status === 'failed')` block:

```tsx
const viewViaEmbedOption = download.videoUrl ? (
  <button
    className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
    onClick={() => {
      onViewEmbed(download.videoUrl ?? '', download.displayName ?? download.name ?? '');
      onClose();
    }}
  >
    <span className="flex items-center space-x-1">
      <MdOutlinePlayCircle size={20} />
      <span>View via Embed</span>
    </span>
  </button>
) : null;
```

- [ ] **Step 4: Add the button to the `finished` and `to download` status branches**

In the `finished` block (around line 647), add `{viewViaEmbedOption}` after `{viewFolderOption}`:

```tsx
if (download.status === 'finished') {
  return (
    <>
      {viewFolderOption}
      {viewViaEmbedOption}
      <button ... > {/* Play Download */} </button>
      {removeOptions}
      {showLogOption}
      {activityTrackerOption}
      {commonOptions}
      {renderPluginMenuItems()}
    </>
  );
}
```

In the `to download` block (around line 696), add `{viewViaEmbedOption}` after `{viewFolderOption}`:

```tsx
if (download.status === 'to download') {
  return (
    <>
      {viewFolderOption}
      {viewViaEmbedOption}
      {startOption}
      <button ... > {/* Rename */} </button>
      {removeOptions}
      {activityTrackerOption}
    </>
  );
}
```

- [ ] **Step 5: Confirm no TypeScript errors, then commit**

```bash
git add src/downlodr/components/contextMenu/DownloadContextMenu.tsx
git commit -m "feat: add View via Embed option to download context menu"
```

---

## Task 3: Wire modal state in `StatusPage`

**Files:**
- Modify: `src/downlodr/pages/StatusPage.tsx`

- [ ] **Step 1: Import `VideoPlayerModal`**

Add this import near the other modal imports (around line 16):

```ts
import VideoPlayerModal from '@/downlodr/components/modal/custom/VideoPlayerModal';
```

- [ ] **Step 2: Add modal state**

Inside `StatusSpecificDownloads`, add state after the existing `useState` declarations (around line 62):

```ts
const [videoPlayerState, setVideoPlayerState] = useState<{
  isOpen: boolean;
  videoUrl: string;
  title: string;
}>({ isOpen: false, videoUrl: '', title: '' });
```

- [ ] **Step 3: Pass `onViewEmbed` to `DownloadContextMenu`**

Find the `<DownloadContextMenu` usage (around line 664). Add the new prop after `onShowStopModal`:

```tsx
onShowStopModal={handleShowStopModal}
onViewEmbed={(videoUrl, title) => {
  if (!videoUrl) return;
  setVideoPlayerState({ isOpen: true, videoUrl, title });
}}
```

- [ ] **Step 4: Render `VideoPlayerModal` in the JSX**

Find where other modals are rendered (around line 703, near `<StatusPageModals`). Add the player modal just before or after it:

```tsx
<VideoPlayerModal
  isOpen={videoPlayerState.isOpen}
  onClose={() => setVideoPlayerState({ isOpen: false, videoUrl: '', title: '' })}
  videoUrl={videoPlayerState.videoUrl}
  title={videoPlayerState.title}
/>
```

- [ ] **Step 5: Confirm no TypeScript errors, then commit**

```bash
git add src/downlodr/pages/StatusPage.tsx
git commit -m "feat: wire VideoPlayerModal into StatusPage"
```

---

## Task 4: Manual smoke test

- [ ] **Step 1: Start the app**

```bash
yarn start
```

- [ ] **Step 2: Test loading state**

Right-click any row with status `finished` or `to download`. Confirm "View via Embed" appears in the menu. Click it. Confirm the modal opens and shows the spinning loader + "Fetching stream URL…" text.

- [ ] **Step 3: Test successful playback**

Wait for the fetch to complete (2–5 seconds). Confirm the video begins playing with browser-native controls visible.

- [ ] **Step 4: Test buffering overlay**

On a slow connection, or by throttling DevTools network, confirm the buffering spinner appears over the video while it buffers.

- [ ] **Step 5: Test cancel-on-new**

Open the modal on one video. While it is still loading, close and immediately open it on a different video. Confirm only the second video plays — the first URL never appears.

- [ ] **Step 6: Test error state**

Temporarily break the URL by disconnecting from the internet after the modal opens but before the fetch completes (or use a private/invalid URL). Confirm the error message and Retry button appear. Click Retry and confirm it attempts to fetch again.

- [ ] **Step 7: Test ESC / overlay close**

Confirm pressing ESC or clicking the backdrop closes the modal and stops the video.
