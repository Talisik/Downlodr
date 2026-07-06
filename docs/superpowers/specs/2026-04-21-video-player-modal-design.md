# Video Player Modal — Design Spec

**Date:** 2026-04-21  
**Status:** Approved for implementation

---

## Overview

Add a "View via Embed" option to the download row right-click context menu. When clicked, it opens a modal that fetches the direct streaming URL via `getDirectUrl` (yt-dlp `-g -f best[ext=mp4]`) and plays it using a native HTML5 `<video>` element with a fully custom UI overlay.

---

## Scope

Three files change:

1. **New** — `src/downlodr/components/modal/custom/VideoPlayerModal.tsx`
2. **Modify** — `src/downlodr/components/contextMenu/DownloadContextMenu.tsx`
3. **Modify** — `src/downlodr/pages/StatusPage.tsx` (wire modal state + new prop)

---

## Architecture

### Data flow

```
User right-clicks row
  → DownloadContextMenu renders "View via Embed"
  → onClick calls onViewEmbed(download.videoUrl, download.name)
  → StatusPage sets videoPlayerState = { isOpen: true, videoUrl, title }
  → VideoPlayerModal mounts, calls window.ytdlp.getDirectUrl(videoUrl)
  → Shows loading skeleton while fetching (2–5s)
  → On success: sets src on <video> element, shows custom controls
  → On error: shows error message with retry button
  → User closes modal → videoPlayerState reset to closed
```

### Cancel-on-new (stale response prevention)

Since Electron IPC calls cannot be truly aborted, a **generation counter** ref is used:

- On each new video open, increment `generationRef.current`
- Capture the current generation in a local `const gen = generationRef.current`
- When `getDirectUrl` resolves, check `if (gen !== generationRef.current) return`
- Stale responses from previous videos are silently discarded

This means rapid switching only ever shows the last-requested video, never a stale one.

---

## Component Design

### `VideoPlayerModal`

**Props:**
```ts
interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;   // original YouTube/source URL passed to getDirectUrl
  title: string;      // download display name, shown in modal header
}
```

**Internal state:**
```ts
type PlayerState = 'loading' | 'ready' | 'buffering' | 'error';
```

- `playerState: PlayerState` — drives which overlay is shown
- `directUrl: string | null` — the resolved streaming URL, set after getDirectUrl resolves
- `generationRef: useRef<number>` — stale-response guard
- `videoRef: useRef<HTMLVideoElement>` — direct access to the video element for play/pause/seek

**Lifecycle:**
1. Modal opens → `playerState = 'loading'`, `directUrl = null`
2. `useEffect` fires on `[isOpen, videoUrl]` → increments generation, calls `getDirectUrl`
3. On resolve (if generation still current) → `directUrl = url`, `playerState = 'ready'`  
   (video element will trigger `onWaiting`/`onCanPlay` naturally from here)
4. On reject → `playerState = 'error'`
5. Modal closes → generation incremented again (cancels any in-flight fetch), state reset

**Video events wired:**
| Event | Action |
|---|---|
| `onWaiting` | `playerState = 'buffering'` |
| `onPlaying` | `playerState = 'ready'` |
| `onCanPlay` | `playerState = 'ready'` |
| `onError` | `playerState = 'error'` |

**UI layers (all Tailwind, user adjustable):**
- Loading overlay — spinner + "Fetching stream URL…" text, shown while `playerState === 'loading'`
- Buffering overlay — spinner overlay on top of video, shown while `playerState === 'buffering'`
- Error state — message + retry button (re-triggers the fetch)
- Native `<video>` element — `controls` attribute used initially; user can replace with custom controls later

**Modal wrapper:** Uses existing `BaseModal` with `width="max-w-4xl"` and no footer.

---

### `DownloadContextMenu` change

Add one new prop:
```ts
onViewEmbed: (videoUrl: string, title: string) => void;
```

Add "View via Embed" menu item. It appears in the `finished` and `to download` status branches (the two statuses where a `videoUrl` is confirmed present). Uses `MdOutlinePlayCircle` icon (already imported).

```tsx
<button onClick={() => { onViewEmbed(download.videoUrl, download.displayName ?? download.name); onClose(); }}>
  <MdOutlinePlayCircle size={20} />
  <span>View via Embed</span>
</button>
```

---

### `StatusPage` change

Add modal state:
```ts
const [videoPlayerState, setVideoPlayerState] = useState<{
  isOpen: boolean;
  videoUrl: string;
  title: string;
}>({ isOpen: false, videoUrl: '', title: '' });
```

Pass to `DownloadContextMenu`:
```ts
onViewEmbed={(videoUrl, title) =>
  setVideoPlayerState({ isOpen: true, videoUrl, title })
}
```

Render modal at the bottom of the page JSX:
```tsx
<VideoPlayerModal
  isOpen={videoPlayerState.isOpen}
  onClose={() => setVideoPlayerState({ isOpen: false, videoUrl: '', title: '' })}
  videoUrl={videoPlayerState.videoUrl}
  title={videoPlayerState.title}
/>
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `getDirectUrl` rejects (no network, private video) | `playerState = 'error'`, show message + retry button |
| Video element fires `onError` (codec, expired URL) | `playerState = 'error'`, same error UI |
| User switches video while loading | Generation counter discards stale response, new fetch starts |
| `videoUrl` is empty string | Modal should not open — `onViewEmbed` guard: skip if `!videoUrl` |

---

## What is NOT in scope

- Custom scrubber / volume slider (user adjusts UI themselves)
- Playlist / queue of videos
- Picture-in-picture
- Download-from-player button
- Caching of resolved direct URLs (they expire after ~6 hours anyway)
