# VideoPlayerPanel — Sidebar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the video player from a centred `BaseModal` into a right-side sidebar panel that pushes `StatusPageTable` content, with drag-to-resize support.

**Architecture:** A new `VideoPlayerPanel` component replaces `VideoPlayerModal`, using a self-contained flex-col div styled after `ArticleSidePanel`. `StatusPage` wraps `StatusPageTable` and the panel in a `flex-row` container; width is stored as a percentage in `StatusPage` state and passed down as a prop. Resizing is handled via `mousedown`/`mousemove`/`mouseup` on `window`, computing new percentage from the panel's parent bounding rect.

**Tech Stack:** React, TypeScript, Tailwind CSS, Electron (window.ytdlp IPC)

> **Note:** This project has no configured test commands. TDD steps are omitted. Verify behaviour manually by running `yarn start`.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/downlodr/components/panel/VideoPlayerPanel.tsx` | Self-contained panel: header, drag handle, video area, all player states |
| Modify | `src/downlodr/pages/StatusPage.tsx` | Add `panelWidth` state, flex-row wrapper, swap import |
| Delete | `src/downlodr/components/modal/custom/VideoPlayerModal.tsx` | Remove old modal after usages are updated |

---

## Task 1: Create `VideoPlayerPanel` component

**Files:**
- Create: `src/downlodr/components/panel/VideoPlayerPanel.tsx`

- [ ] **Step 1: Create the panel directory and file**

Create `src/downlodr/components/panel/VideoPlayerPanel.tsx` with the full content below. This replaces `VideoPlayerModal` entirely — no `BaseModal` dependency, self-contained styling matching `ArticleSidePanel`.

```tsx
import React, { useEffect, useRef, useState } from 'react';

type PlayerState = 'loading' | 'ready' | 'buffering' | 'error';

interface VideoPlayerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
  autoCaptionLocation?: string;
  transcriptLocation?: string;
  width: number;
  onWidthChange: (w: number) => void;
}

const VideoPlayerPanel: React.FC<VideoPlayerPanelProps> = ({
  isOpen,
  onClose,
  videoUrl,
  title,
  autoCaptionLocation,
  transcriptLocation,
  width,
  onWidthChange,
}) => {
  const [playerState, setPlayerState] = useState<PlayerState>('loading');
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [captionBlobUrl, setCaptionBlobUrl] = useState<string | null>(null);
  const [isFloating, setIsFloating] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const generationRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !videoUrl) return;

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

    return () => {
      generationRef.current += 1;
    };
  }, [isOpen, videoUrl]);

  useEffect(() => {
    const captionPath = transcriptLocation ?? autoCaptionLocation ?? null;
    if (!isOpen || !captionPath) {
      setCaptionBlobUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    window.ytdlp
      .readCaptionFile(captionPath)
      .then((content) => {
        if (cancelled) return;
        const vttContent = captionPath.endsWith('.srt')
          ? `WEBVTT\n\n${content.replace(
              /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
              '$1.$2',
            )}`
          : content;
        const blob = new Blob([vttContent], { type: 'text/vtt' });
        objectUrl = URL.createObjectURL(blob);
        setCaptionBlobUrl(objectUrl);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setCaptionBlobUrl(null);
    };
  }, [isOpen, autoCaptionLocation, transcriptLocation]);

  useEffect(() => {
    if (!isOpen) setIsFloating(false);
  }, [isOpen]);

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

  const handleFloat = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      try {
        videoRef.current.addEventListener(
          'leavepictureinpicture',
          () => setIsFloating(false),
          { once: true },
        );
        await videoRef.current.requestPictureInPicture();
        setIsFloating(true);
      } catch {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const onMouseMove = (ev: MouseEvent) => {
      const panel = panelRef.current;
      if (!panel || !panel.parentElement) return;
      const parentRect = panel.parentElement.getBoundingClientRect();
      const newWidth = ((parentRect.right - ev.clientX) / parentRect.width) * 100;
      onWidthChange(Math.min(70, Math.max(40, newWidth)));
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  if (!isOpen) return null;

  return (
    <div
      style={
        isFloating ? { visibility: 'hidden', pointerEvents: 'none' } : undefined
      }
    >
      <div
        ref={panelRef}
        className="relative flex-shrink-0 bg-white dark:bg-darkMode shadow-lg flex flex-col border-l-2 border-[#F3F3F3] dark:border-darkModeCompliment h-full"
        style={{
          width: `${width}%`,
          transition: isResizing ? 'none' : 'width 200ms ease',
        }}
      >
        {/* Drag handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-primary/30"
          onMouseDown={handleDragStart}
        />

        {/* Header */}
        <div className="bg-titleBar dark:bg-darkModeDropdown px-2 py-1 pt-[11px] flex items-center justify-between flex-shrink-0">
          <span className="text-black dark:text-white font-semibold text-md leading-6 truncate">
            {title || 'Video Preview'}
          </span>
          <button
            onClick={onClose}
            className="text-black dark:text-white hover:text-red-500 ml-2 p-1 flex-shrink-0"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m18 6-12 12M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video area */}
        <div className="flex-1 flex items-start justify-center bg-black overflow-hidden">
          <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
            {document.pictureInPictureEnabled && playerState === 'ready' && (
              <button
                onClick={handleFloat}
                className="absolute top-2 right-2 z-20 px-3 py-1 bg-black/60 text-white text-xs rounded hover:bg-black/80"
                title="Float window"
              >
                Float
              </button>
            )}

            {playerState === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-white text-sm">Fetching stream URL…</p>
              </div>
            )}

            {playerState === 'buffering' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}

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
              >
                {captionBlobUrl && (
                  <track
                    key={captionBlobUrl}
                    kind="subtitles"
                    src={captionBlobUrl}
                    srcLang="en"
                    label="Captions"
                    default
                  />
                )}
              </video>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerPanel;
```

---

## Task 2: Update `StatusPage` to use `VideoPlayerPanel`

**Files:**
- Modify: `src/downlodr/pages/StatusPage.tsx`

- [ ] **Step 1: Replace the import**

Find line 16 in `src/downlodr/pages/StatusPage.tsx`:
```tsx
import VideoPlayerModal from '@/downlodr/components/modal/custom/VideoPlayerModal';
```
Replace with:
```tsx
import VideoPlayerPanel from '@/downlodr/components/panel/VideoPlayerPanel';
```

- [ ] **Step 2: Add `panelWidth` state**

Find the `videoPlayerState` declaration (around line 66):
```tsx
  const [videoPlayerState, setVideoPlayerState] = useState<{
    isOpen: boolean;
    videoUrl: string;
    title: string;
    autoCaptionLocation?: string;
    transcriptLocation?: string;
  }>({ isOpen: false, videoUrl: '', title: '' });
```
Add the `panelWidth` state directly after it:
```tsx
  const [videoPlayerState, setVideoPlayerState] = useState<{
    isOpen: boolean;
    videoUrl: string;
    title: string;
    autoCaptionLocation?: string;
    transcriptLocation?: string;
  }>({ isOpen: false, videoUrl: '', title: '' });
  const [panelWidth, setPanelWidth] = useState(50);
```

- [ ] **Step 3: Wrap `StatusPageTable` in a flex-row container**

Find the return statement (around line 629). The outer div currently is:
```tsx
  return (
    <div className="flex flex-col h-full bg-[#F9F9F9] dark:bg-darkMode">
      <StatusPageTable
```
Wrap `StatusPageTable` in a new flex-row div. Replace:
```tsx
  return (
    <div className="flex flex-col h-full bg-[#F9F9F9] dark:bg-darkMode">
      <StatusPageTable
        allDownloads={allDownloads}
        displayColumns={displayColumns}
        columns={columns}
        thumbnailDataUrls={thumbnailDataUrls}
        selectedRowIds={selectedRowIds}
        selectedDownloadId={selectedDownloadId}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        dragging={dragging}
        dragOverIndex={dragOverIndex}
        getSelectedWithStatusCount={getSelectedWithStatusCount}
        onColumnHeaderContextMenu={handleColumnHeaderContextMenu}
        onSelectAll={handleSelectAll}
        onSortClick={handleSortClick}
        onResizeStart={startResizing}
        startDragging={startDragging}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        cancelDrag={cancelDrag}
        onContextMenu={statusHandlers.handleContextMenu}
        onRowClick={handleRowClick}
        onCheckboxChange={handleCheckboxChange}
        onViewFile={statusHandlers.handleViewFile}
        onViewDownload={statusHandlers.handleViewDownload}
        onViewFolder={statusHandlers.handleViewFolder}
        onRetry={statusHandlers.handleRetry}
        onPause={statusHandlers.handlePause}
        onRedownloadTranscript={statusHandlers.handleRedownloadTranscript}
        onFormatSelect={noopFormatSelect}
        onClosePluginSidebar={() => updateIsOpenPluginSidebar(false)}
        onGroupCheckboxChange={handleGroupCheckboxChange}
      />
```
With:
```tsx
  return (
    <div className="flex flex-col h-full bg-[#F9F9F9] dark:bg-darkMode">
      <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-hidden">
          <StatusPageTable
            allDownloads={allDownloads}
            displayColumns={displayColumns}
            columns={columns}
            thumbnailDataUrls={thumbnailDataUrls}
            selectedRowIds={selectedRowIds}
            selectedDownloadId={selectedDownloadId}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            dragging={dragging}
            dragOverIndex={dragOverIndex}
            getSelectedWithStatusCount={getSelectedWithStatusCount}
            onColumnHeaderContextMenu={handleColumnHeaderContextMenu}
            onSelectAll={handleSelectAll}
            onSortClick={handleSortClick}
            onResizeStart={startResizing}
            startDragging={startDragging}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            cancelDrag={cancelDrag}
            onContextMenu={statusHandlers.handleContextMenu}
            onRowClick={handleRowClick}
            onCheckboxChange={handleCheckboxChange}
            onViewFile={statusHandlers.handleViewFile}
            onViewDownload={statusHandlers.handleViewDownload}
            onViewFolder={statusHandlers.handleViewFolder}
            onRetry={statusHandlers.handleRetry}
            onPause={statusHandlers.handlePause}
            onRedownloadTranscript={statusHandlers.handleRedownloadTranscript}
            onFormatSelect={noopFormatSelect}
            onClosePluginSidebar={() => updateIsOpenPluginSidebar(false)}
            onGroupCheckboxChange={handleGroupCheckboxChange}
          />
        </div>
        <VideoPlayerPanel
          isOpen={videoPlayerState.isOpen}
          onClose={() =>
            setVideoPlayerState({
              isOpen: false,
              videoUrl: '',
              title: '',
              autoCaptionLocation: undefined,
              transcriptLocation: undefined,
            })
          }
          videoUrl={videoPlayerState.videoUrl}
          title={videoPlayerState.title}
          autoCaptionLocation={videoPlayerState.autoCaptionLocation}
          transcriptLocation={videoPlayerState.transcriptLocation}
          width={panelWidth}
          onWidthChange={setPanelWidth}
        />
      </div>
```

- [ ] **Step 4: Remove the old `<VideoPlayerModal>` JSX block**

Find and delete lines 716–731 (the old `<VideoPlayerModal ... />` block):
```tsx
      <VideoPlayerModal
        isOpen={videoPlayerState.isOpen}
        onClose={() =>
          setVideoPlayerState({
            isOpen: false,
            videoUrl: '',
            title: '',
            autoCaptionLocation: undefined,
            transcriptLocation: undefined,
          })
        }
        videoUrl={videoPlayerState.videoUrl}
        title={videoPlayerState.title}
        autoCaptionLocation={videoPlayerState.autoCaptionLocation}
        transcriptLocation={videoPlayerState.transcriptLocation}
      />
```
Delete this block entirely — `VideoPlayerPanel` is now rendered inside the flex-row wrapper in Step 3.

---

## Task 3: Delete old `VideoPlayerModal`

**Files:**
- Delete: `src/downlodr/components/modal/custom/VideoPlayerModal.tsx`

- [ ] **Step 1: Verify no remaining usages**

Run a search to confirm nothing still imports `VideoPlayerModal`:
```
grep -r "VideoPlayerModal" src/
```
Expected: no results.

- [ ] **Step 2: Delete the file**

Delete `src/downlodr/components/modal/custom/VideoPlayerModal.tsx`.

---

## Manual Verification Checklist

After completing all tasks, run `yarn start` and verify:

- [ ] Right-clicking a completed download and choosing "View Embed" opens the panel on the right side
- [ ] The download table shrinks to fill remaining space (does not overflow)
- [ ] The drag handle (left edge of panel) lets you resize between 40%–70% of the window width
- [ ] Releasing the mouse stops resizing
- [ ] The close button (×) in the panel header closes the panel and the table expands back
- [ ] PiP Float button appears when video is playing and works correctly
- [ ] Captions appear when `autoCaptionLocation` or `transcriptLocation` is set
- [ ] Loading spinner shows while fetching the stream URL
- [ ] Error state + Retry button appears when fetch fails
- [ ] Dark mode styling matches `ArticleSidePanel` header
