# Video Player Captions & PiP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add caption track support and a native Picture-in-Picture float button to `VideoPlayerModal`.

**Architecture:** A new `ytdlp:readCaptionFile` IPC channel reads local VTT/SRT files as UTF-8 text and returns the string to the renderer, which wraps it in a `blob:` URL to bypass `webSecurity: true`. The modal loads captions in a `useEffect` (one re-render, no lag), renders them as an HTML5 `<track>` on the `<video>`, and provides a Float button that calls `requestPictureInPicture()` then closes the modal.

**Tech Stack:** Electron IPC (`ipcMain`/`ipcRenderer`/`contextBridge`), React hooks, HTML5 Picture-in-Picture API, HTML5 `<track>` / VTT

---

## File Map

| File | Role |
|---|---|
| `src/core-app/ipc/main/ytdlpHandler.ts` | Add `ipcMain.handle('ytdlp:readCaptionFile')` |
| `src/core-app/ipc/renderer/downlodrHandler.ts` | Expose `readCaptionFile` on `ytdlpFunctionsBridge` |
| `src/global.d.ts` | Add `readCaptionFile` type to both `ytdlpFunctionsBridge` and `ytdlp` |
| `src/core-app/ipc/composeWindowApi.ts` | Wire `readCaptionFile` into composed `w.ytdlp` |
| `src/downlodr/components/contextMenu/DownloadContextMenu.tsx` | Extend `onViewEmbed` signature to pass caption paths |
| `src/downlodr/pages/StatusPage.tsx` | Update state type, `onViewEmbed` handler, and modal props |
| `src/downlodr/components/modal/custom/VideoPlayerModal.tsx` | Add props, caption effect, `<track>`, Float button |

---

### Task 1: Add `readCaptionFile` IPC handler (main process)

**Files:**
- Modify: `src/core-app/ipc/main/ytdlpHandler.ts`

- [ ] **Step 1: Add the handler inside `ytdlpHandler`**

  Open `src/core-app/ipc/main/ytdlpHandler.ts`. Add the following block immediately before the closing `};` of the `ytdlpHandler` function (after the `ytdlp:download` handler, around line 497):

  ```ts
  ipcMain.handle('ytdlp:readCaptionFile', async (_e, filePath: string) => {
    const { readFile } = await import('fs/promises');
    return await readFile(filePath, 'utf-8');
  });
  ```

- [ ] **Step 2: Verify no TypeScript errors**

  Run: `yarn lint`
  Expected: no new errors related to `ytdlpHandler.ts`

---

### Task 2: Expose `readCaptionFile` on the renderer bridge

**Files:**
- Modify: `src/core-app/ipc/renderer/downlodrHandler.ts`

- [ ] **Step 1: Add `readCaptionFile` to `ytdlpFunctionsBridge`**

  Open `src/core-app/ipc/renderer/downlodrHandler.ts`. Add the following entry at the end of the `contextBridge.exposeInMainWorld('ytdlpFunctionsBridge', { ... })` object, just before the closing `});` (after `getDirectUrl`, around line 94):

  ```ts
  readCaptionFile: async (filePath: string): Promise<string> => {
    return await ipcRenderer.invoke('ytdlp:readCaptionFile', filePath);
  },
  ```

- [ ] **Step 2: Verify no TypeScript errors**

  Run: `yarn lint`
  Expected: no new errors

---

### Task 3: Add `readCaptionFile` to global type declarations

**Files:**
- Modify: `src/global.d.ts`

- [ ] **Step 1: Add to `ytdlpFunctionsBridge` interface**

  Open `src/global.d.ts`. Locate the `ytdlpFunctionsBridge` interface (around line 188). Add the following line after the `getDirectUrl` entry (line 215):

  ```ts
  readCaptionFile: (filePath: string) => Promise<string>;
  ```

- [ ] **Step 2: Add to `ytdlp` composed interface**

  In the same file, locate the `ytdlp` interface (around line 326). Add the following line after the `getDirectUrl` entry (line 347):

  ```ts
  readCaptionFile: (filePath: string) => Promise<string>;
  ```

- [ ] **Step 3: Verify no TypeScript errors**

  Run: `yarn lint`
  Expected: no new errors

---

### Task 4: Wire `readCaptionFile` into the composed API

**Files:**
- Modify: `src/core-app/ipc/composeWindowApi.ts`

- [ ] **Step 1: Add to `w.ytdlp` object**

  Open `src/core-app/ipc/composeWindowApi.ts`. Locate the `w.ytdlp = { ... }` block (around line 58). Add `readCaptionFile` after the `getDirectUrl` line (line 69):

  ```ts
  readCaptionFile: ytdlpBridge.readCaptionFile,
  ```

  The block should now end:
  ```ts
  getDirectUrl: ytdlpBridge.getDirectUrl,
  readCaptionFile: ytdlpBridge.readCaptionFile,
  ```

- [ ] **Step 2: Verify no TypeScript errors**

  Run: `yarn lint`
  Expected: no new errors

---

### Task 5: Extend `onViewEmbed` to pass caption paths

**Files:**
- Modify: `src/downlodr/components/contextMenu/DownloadContextMenu.tsx`

- [ ] **Step 1: Update the prop type signature**

  Open `src/downlodr/components/contextMenu/DownloadContextMenu.tsx`. Find the `onViewEmbed` prop in the interface (around line 104):

  ```ts
  onViewEmbed: (videoUrl: string, title: string) => void;
  ```

  Replace it with:

  ```ts
  onViewEmbed: (videoUrl: string, title: string, autoCaptionLocation?: string, transcriptLocation?: string) => void;
  ```

- [ ] **Step 2: Update the call site inside the component**

  Find the `onViewEmbed(...)` call (around line 630):

  ```ts
  onViewEmbed(download.videoUrl ?? '', download.displayName ?? download.name ?? '');
  ```

  Replace it with:

  ```ts
  onViewEmbed(
    download.videoUrl ?? '',
    download.displayName ?? download.name ?? '',
    download.autoCaptionLocation,
    download.transcriptLocation,
  );
  ```

- [ ] **Step 3: Verify no TypeScript errors**

  Run: `yarn lint`
  Expected: no new errors

---

### Task 6: Update StatusPage to pass caption props to the modal

**Files:**
- Modify: `src/downlodr/pages/StatusPage.tsx`

- [ ] **Step 1: Extend `videoPlayerState` type**

  Open `src/downlodr/pages/StatusPage.tsx`. Find the `videoPlayerState` useState declaration (around line 66):

  ```ts
  const [videoPlayerState, setVideoPlayerState] = useState<{
    isOpen: boolean;
    videoUrl: string;
    title: string;
  }>({ isOpen: false, videoUrl: '', title: '' });
  ```

  Replace with:

  ```ts
  const [videoPlayerState, setVideoPlayerState] = useState<{
    isOpen: boolean;
    videoUrl: string;
    title: string;
    autoCaptionLocation?: string;
    transcriptLocation?: string;
  }>({ isOpen: false, videoUrl: '', title: '' });
  ```

- [ ] **Step 2: Update `onViewEmbed` handler to forward caption paths**

  Find the `onViewEmbed` handler passed to `DownloadContextMenu` (around line 695):

  ```ts
  onViewEmbed={(videoUrl, title) => {
    if (!videoUrl) return;
    setVideoPlayerState({ isOpen: true, videoUrl, title });
  }}
  ```

  Replace with:

  ```ts
  onViewEmbed={(videoUrl, title, autoCaptionLocation, transcriptLocation) => {
    if (!videoUrl) return;
    setVideoPlayerState({ isOpen: true, videoUrl, title, autoCaptionLocation, transcriptLocation });
  }}
  ```

- [ ] **Step 3: Pass caption props to `VideoPlayerModal`**

  Find the `<VideoPlayerModal ... />` usage (around line 714):

  ```tsx
  <VideoPlayerModal
    isOpen={videoPlayerState.isOpen}
    onClose={() => setVideoPlayerState({ isOpen: false, videoUrl: '', title: '' })}
    videoUrl={videoPlayerState.videoUrl}
    title={videoPlayerState.title}
  />
  ```

  Replace with:

  ```tsx
  <VideoPlayerModal
    isOpen={videoPlayerState.isOpen}
    onClose={() => setVideoPlayerState({ isOpen: false, videoUrl: '', title: '' })}
    videoUrl={videoPlayerState.videoUrl}
    title={videoPlayerState.title}
    autoCaptionLocation={videoPlayerState.autoCaptionLocation}
    transcriptLocation={videoPlayerState.transcriptLocation}
  />
  ```

- [ ] **Step 4: Verify no TypeScript errors**

  Run: `yarn lint`
  Expected: no new errors

---

### Task 7: Implement captions and PiP in VideoPlayerModal

**Files:**
- Modify: `src/downlodr/components/modal/custom/VideoPlayerModal.tsx`

- [ ] **Step 1: Add new props to the interface**

  Open `src/downlodr/components/modal/custom/VideoPlayerModal.tsx`. Find the `VideoPlayerModalProps` interface (line 11):

  ```ts
  interface VideoPlayerModalProps {
    isOpen: boolean;
    onClose: () => void;
    videoUrl: string;
    title: string;
  }
  ```

  Replace with:

  ```ts
  interface VideoPlayerModalProps {
    isOpen: boolean;
    onClose: () => void;
    videoUrl: string;
    title: string;
    autoCaptionLocation?: string;
    transcriptLocation?: string;
  }
  ```

- [ ] **Step 2: Destructure new props in the component**

  Find the component function signature (line 18):

  ```ts
  const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
    isOpen,
    onClose,
    videoUrl,
    title,
  }) => {
  ```

  Replace with:

  ```ts
  const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
    isOpen,
    onClose,
    videoUrl,
    title,
    autoCaptionLocation,
    transcriptLocation,
  }) => {
  ```

- [ ] **Step 3: Add `captionBlobUrl` state**

  Find the existing state declarations (around line 24):

  ```ts
  const [playerState, setPlayerState] = useState<PlayerState>('loading');
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  ```

  Add `captionBlobUrl` state after them:

  ```ts
  const [playerState, setPlayerState] = useState<PlayerState>('loading');
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [captionBlobUrl, setCaptionBlobUrl] = useState<string | null>(null);
  ```

- [ ] **Step 4: Add caption loading `useEffect`**

  Find the existing `useEffect` (line 29). Add a second `useEffect` immediately after the first one (after its closing `}, [isOpen, videoUrl]);` line):

  ```ts
  useEffect(() => {
    const captionPath = autoCaptionLocation ?? transcriptLocation ?? null;
    if (!isOpen || !captionPath) {
      setCaptionBlobUrl(null);
      return;
    }

    let objectUrl: string | null = null;

    window.ytdlp
      .readCaptionFile(captionPath)
      .then((content) => {
        const blob = new Blob([content], { type: 'text/vtt' });
        objectUrl = URL.createObjectURL(blob);
        setCaptionBlobUrl(objectUrl);
      })
      .catch(() => {
        // captions are optional — silently skip on error
      });

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setCaptionBlobUrl(null);
    };
  }, [isOpen, autoCaptionLocation, transcriptLocation]);
  ```

- [ ] **Step 5: Add `handleFloat` function**

  Find the existing `handleRetry` function (line 55). Add `handleFloat` immediately after it:

  ```ts
  const handleFloat = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      await videoRef.current.requestPictureInPicture();
    }
    onClose();
  };
  ```

- [ ] **Step 6: Add `<track>` to the `<video>` element**

  Find the `<video>` element (around line 112):

  ```tsx
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
  ```

  Replace with:

  ```tsx
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
  ```

- [ ] **Step 7: Add Float button overlay**

  Find the outermost `<div className="relative w-full bg-black" ...>` (line 85). Add the Float button as the first child inside it, before the loading spinner block:

  ```tsx
  {document.pictureInPictureEnabled && (
    <button
      onClick={handleFloat}
      className="absolute top-2 right-2 z-20 px-3 py-1 bg-black/60 text-white text-xs rounded hover:bg-black/80"
      title="Float window"
    >
      Float
    </button>
  )}
  ```

- [ ] **Step 8: Verify no TypeScript errors**

  Run: `yarn lint`
  Expected: no new errors

- [ ] **Step 9: Manual smoke test**

  Run: `yarn start`

  Test steps:
  1. Right-click a finished download that has `autoCaptionLocation` set → click "View via Embed"
  2. Confirm video loads and caption text appears as a subtitle overlay during playback
  3. Click "Float" — confirm modal closes and video continues in the OS PiP overlay with captions visible
  4. Right-click a download with no caption files → confirm video loads normally with no errors in console
  5. Open PiP, then close PiP from the OS controls — confirm no crashes

---

## Self-Review

**Spec coverage:**
- ✅ `autoCaptionLocation` / `transcriptLocation` as props — Task 7 Step 1–2
- ✅ `readCaptionFile` IPC across all 4 touch points — Tasks 1–4
- ✅ `blob:` URL to bypass `webSecurity: true` — Task 7 Step 4
- ✅ Caption priority (auto > transcript) — Task 7 Step 4 (`autoCaptionLocation ?? transcriptLocation`)
- ✅ `<track>` element with `default` attribute — Task 7 Step 6
- ✅ One re-render, no lag — single `setCaptionBlobUrl` call in effect
- ✅ Blob URL revoked on close — cleanup in `useEffect` return
- ✅ Float button hidden if PiP unavailable — `document.pictureInPictureEnabled` guard
- ✅ Modal closes on float — `onClose()` called after `requestPictureInPicture()`
- ✅ Caption data flows from context menu through StatusPage to modal — Tasks 5–6

**Placeholder scan:** No TBDs, no vague steps — all steps include exact code.

**Type consistency:** `readCaptionFile(filePath: string): Promise<string>` is consistent across Tasks 1, 2, 3, 4. `autoCaptionLocation?: string` and `transcriptLocation?: string` are consistent across Tasks 5, 6, 7.
