# Video Description in VideoPlayerPanel

**Date:** 2026-04-28
**Branch:** feat/video-player-embed

## Problem

`VideoPlayerPanel` has a placeholder "Description" section but no data behind it. yt-dlp already returns description in the `getInfo` response called during `setDownload`, but it is never extracted or stored.

## Approach

Capture description during the existing `getInfo` call in `setDownload` — zero extra yt-dlp invocations. Store it on the download entry and pass it as a prop to `VideoPlayerPanel`.

## Data Model

Add `description?: string` to `BaseDownload` in `src/downlodr/store/download/types.ts`. Optional so existing persisted entries without it remain valid.

Add `description?: string` to `VideoInfo.data` in `src/downlodr/schema/metadataSchema.ts` so the type accurately reflects the yt-dlp response.

## Capture Point

In `src/downlodr/store/download/actions/downloadActions.ts`, inside `setDownload`, after the existing `channelName` extraction (line ~172):

```ts
const description = info.data?.description ?? '';
```

Include `description` in the `set()` call that creates the `ForDownload` entry so it persists with the download through the queue and into finished/history.

## VideoPlayerPanel

- Add `description?: string` to `VideoPlayerPanelProps` in `src/downlodr/components/panel/VideoPlayerPanel.tsx`
- Replace the placeholder `<div>Description</div>` with a scrollable `<p className="whitespace-pre-wrap text-sm ...">` rendering the value
- If empty, render nothing or a subtle "No description available" fallback

## Call Sites

Pass `description` from the download entry wherever `VideoPlayerPanel` is opened. The prop is optional so existing call sites without it compile and render gracefully.

## Constraints

- No new yt-dlp calls
- No new IPC handlers
- Backward compatible with existing persisted download entries
