# VideoPlayerPanel — Sidebar Redesign

**Date:** 2026-04-23
**Branch:** feat/video-player-embed
**Scope:** Convert `VideoPlayerModal` from a centred modal into a right-side panel that pushes the `StatusPage` content area, with drag-to-resize support.

---

## Overview

Replace the `BaseModal`-based video player with a self-contained sidebar panel styled after `ArticleSidePanel`. The panel slides in from the right, pushes `StatusPageTable` to the left via a flex layout, and is resizable via a drag handle.

---

## Section 1: Component

### Rename & relocate
- **Old:** `src/downlodr/components/modal/custom/VideoPlayerModal.tsx`
- **New:** `src/downlodr/components/panel/VideoPlayerPanel.tsx`
- Export name: `VideoPlayerPanel`
- Props interface: `VideoPlayerPanelProps` (same shape as current `VideoPlayerModalProps`)

### Structure
`BaseModal` is removed. The panel is a self-contained `<div>` with:

```
<div>                          ← outer wrapper (handles visibility-hidden for PiP)
  <div>                        ← panel root: flex col, full height, fixed bg, border-left, shadow
    [Header bar]               ← title left, close button right — matches ArticleSidePanel style
    [Drag handle]              ← 4px-wide div on left edge, cursor-col-resize
    [Video area]               ← flex-1, 16/9 aspect ratio block
      [Loading overlay]
      [Buffering overlay]
      [Error overlay + Retry]
      [Float button]           ← top-right of video area, visible when ready & PiP supported
      <video>                  ← with <track> for captions
  </div>
</div>
```

### Styling
Matches `ArticleSidePanel`:
- Header: `bg-titleBar dark:bg-darkModeDropdown`, semibold title, close SVG button
- Body: `bg-white dark:bg-darkMode`, `shadow-lg`, `border-l-2 border-[#F3F3F3] dark:border-darkModeCompliment`
- Full height: `flex flex-col h-full`

### Preserved behaviour
All existing logic is kept unchanged:
- Generation counter for cancel-on-new URL fetch
- Caption blob URL lifecycle (create / revoke)
- PiP float + visibility-hidden wrapper
- Loading / buffering / error / retry states

---

## Section 2: Layout integration in StatusPage

### Wrapper change
The StatusPage root `<div className="flex flex-col h-full ...">` gets an inner flex-row container:

```tsx
<div className="flex flex-row flex-1 min-h-0 overflow-hidden">
  <StatusPageTable ... className="flex-1 min-w-0" />
  {videoPlayerState.isOpen && (
    <VideoPlayerPanel
      isOpen={videoPlayerState.isOpen}
      onClose={...}
      videoUrl={videoPlayerState.videoUrl}
      title={videoPlayerState.title}
      autoCaptionLocation={videoPlayerState.autoCaptionLocation}
      transcriptLocation={videoPlayerState.transcriptLocation}
      width={panelWidth}
      onWidthChange={setPanelWidth}
    />
  )}
</div>
```

Context menus, `ColumnHeaderContextMenu`, `StatusPageModals`, and other overlays stay **outside** this wrapper — they are portals/overlays and must not be constrained by it.

### Import update
`import VideoPlayerModal from '...'` → `import VideoPlayerPanel from '@/downlodr/components/panel/VideoPlayerPanel'`

---

## Section 3: Resize behaviour

### State
```ts
const [panelWidth, setPanelWidth] = useState(50); // percentage, default 50%
```
Lives in `StatusPage` alongside `videoPlayerState`. Resets to `50` when panel closes (optional — can preserve last width).

### Drag handle
- A `<div>` with `width: 4px`, `cursor: col-resize`, positioned on the left edge of the panel
- On `mousedown`: attaches `mousemove` + `mouseup` to `window`, sets an `isResizing` ref to `true`
- `mousemove` handler:
  ```ts
  const containerRect = containerRef.current.getBoundingClientRect();
  const newWidth = ((containerRect.right - e.clientX) / containerRect.width) * 100;
  setPanelWidth(Math.min(70, Math.max(40, newWidth)));
  ```
- `mouseup` handler: removes both listeners, sets `isResizing` to `false`
- `containerRef` is a `useRef` on the flex-row wrapper div

### Transition
- Panel `style`: `width: \`${panelWidth}%\``
- CSS transition `width 200ms ease` applied **only when not resizing** (controlled via `isResizing` ref / state to suppress transition during live drag for instant feedback)

### Constraints
| Property | Value |
|----------|-------|
| Default width | 50% of parent |
| Minimum width | 40% of parent |
| Maximum width | 70% of parent |

---

## Files Changed


| Action | File |
|--------|------|
| Create | `src/downlodr/components/panel/VideoPlayerPanel.tsx` |
| Modify | `src/downlodr/pages/StatusPage.tsx` |
| Delete (optional) | `src/downlodr/components/modal/custom/VideoPlayerModal.tsx` — only after all usages updated |

---

## Out of Scope
- No changes to IPC layer, `window.ytdlp`, or caption logic
- No changes to `DownloadContextMenu` — `onViewEmbed` callback is unchanged
- No other pages use `VideoPlayerModal` (confirmed by grep)
