# Transcript Queue Design

**Date:** 2026-06-02  
**Status:** Approved

## Problem

`TranscrptButton` (single-row) fires `redownloadTranscript` immediately with no concurrency awareness. Two clicks on two rows launches two simultaneous Whisper processes. `handleBatchTranscript` in `Toolbar.tsx` serialises jobs with a `for...of` loop but does not share that constraint with the per-row button — they can still collide.

## Goal

A shared queue that caps transcript jobs at **2 concurrent**. Both the single-row button and the batch toolbar action enqueue jobs into it. The queue manages all status transitions and store updates.

## Architecture

### New file: `src/downlodr/utils/transcription/transcriptQueue.ts`

Module-level singleton — no React, no Zustand store, just plain state.

```
pendingJobs: TranscriptJob[]   // waiting to run
running: number                // currently active (max MAX_CONCURRENT = 2)
```

**`TranscriptJob` shape:**
```ts
{
  downloadId: string;
  location: string;
  downloadName: string;
}
```

**`enqueueTranscript(job)`**
1. Pushes job onto `pendingJobs`
2. Sets `transcriptionStatus: 'queued'` in download store for that id
3. Calls `drain()`

**`drain()`**
While `running < MAX_CONCURRENT` and `pendingJobs.length > 0`:
1. Shift the next job off the front of `pendingJobs`
2. Increment `running`
3. Set `transcriptionStatus: 'transcribing'`, `transcriptionProgress: 0` in store
4. Resolve `inputLocation` and `outputLocation` via `window.downlodrFunctions.joinDownloadPath`
5. Call `redownloadTranscript(...)` with `onProgressPercent` callback
6. On success: set `'completed'`, call `updateDownloadTranscript`, decrement `running`, call `drain()`
7. On failure: set `'failed'`, show error toast, decrement `running`, call `drain()`

The queue owns all store status updates. Callers just call `enqueueTranscript`.

### Type change: `src/downlodr/store/download/types.ts`

```ts
transcriptionStatus?: 'queued' | 'transcribing' | 'completed' | 'failed';
```

### `TranscrptButton` changes

- Replace `handleRedownloadTranscript` direct call with `enqueueTranscript({ downloadId: download.id, location: download.location, downloadName: download.downloadName })`
- Remove internal `setDownloadTranscriptionStatus` / `setDownloadTranscriptionProgress` helpers (queue owns these)
- Add new render branch before the `isTranscribing` check:
  - Condition: `download.transcriptionStatus === 'queued'`
  - UI: `FaRegClock` icon, tooltip `"Queued"`
  - Button is non-interactive while queued or transcribing (prevents double-enqueue)

### `Toolbar.tsx` / `handleBatchTranscript` changes

- Remove the `for...of` loop that calls `redownloadTranscript` sequentially
- Replace with: call `enqueueTranscript(job)` for each eligible download
- Remove the local `setDownloadTranscriptionStatus` and `setDownloadTranscriptionProgress` helpers from `Toolbar.tsx` (now owned by queue)
- Batch toast changes to: `"X transcripts queued"`

### `transcriptStore.ts` / `clearStuckTranscriptionStatus`

Add `'queued'` to the stuck-status clear condition so queued jobs from a previous session are not left frozen on app start:
```ts
d.transcriptionStatus === 'transcribing' || d.transcriptionStatus === 'queued'
```

## What Does Not Change

- `transcriptActions.updateDownloadTranscript` — still used by the queue on success
- `AnimatedLinearProgressBar` — still renders for `'transcribing'` state
- `redownloadTranscript` utility — called by the queue, unchanged

## Files Touched

| File | Change |
|------|--------|
| `src/downlodr/utils/transcription/transcriptQueue.ts` | **Create** — queue singleton |
| `src/downlodr/store/download/types.ts` | Add `'queued'` to `transcriptionStatus` union |
| `src/downlodr/components/download/TranscrptButton.tsx` | Use queue, add queued UI state |
| `src/downlodr/components/base/Toolbar.tsx` | Use queue, simplify `handleBatchTranscript` |
| `src/transcript/store/transcriptStore.ts` | Clear `'queued'` in `clearStuckTranscriptionStatus` |
