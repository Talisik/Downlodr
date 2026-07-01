# Batch Transcript Download — Toolbar Feature

**Date:** 2026-04-12  
**Status:** Approved

---

## Overview

Add a "Batch Generate Captions" button to the Toolbar that generates transcripts for multiple selected downloads sequentially, without requiring the user to click each row individually.

---

## Scope

- **In scope:** Toolbar button, eligibility filtering, sequential processor, progress via existing per-row store state
- **Out of scope:** Parallel processing, configurable concurrency, language selection UI, format selection UI

---

## Eligibility Criteria

A selected download is eligible for batch transcription if **all** of the following are true (mirrors `TranscrptButton` logic exactly):

1. The download exists in `useDownloadStore.getState().finishedDownloads`
2. `transcriptLocation` is: `undefined`, empty string, `'iu'`, or `'fu'`  
   — same invalid-location check used in `TranscrptButton`
3. `transcriptionStatus !== 'transcribing'` (not already in progress)

`autoCaptionLocation` is also checked as a fallback (same as `TranscrptButton`):
```ts
const transcriptLocation =
  typeof download.transcriptLocation === 'string'
    ? download.transcriptLocation
    : download.autoCaptionLocation;
const isValidLocation =
  !!transcriptLocation &&
  transcriptLocation.trim() !== '' &&
  transcriptLocation !== 'iu' &&
  transcriptLocation !== 'fu';
```

---

## Button Visibility

Follows the exact same pattern as the existing **Remove** button in `Toolbar.tsx`:

- Rendered only when `eligibleSelectedDownloads.length > 0`
- AND current route includes `/status/`, `/tags/`, or `/category/`

`eligibleSelectedDownloads` is computed by cross-referencing `selectedDownloads` (from `useSelectedDownloadStore`) with `finishedDownloads` (from `useDownloadStore`) using the eligibility criteria above.

---

## Sequential Processor — `handleBatchTranscript`

Mirrors the structure of `handleStopSelected` / `handleRemoveSelected`.

```
1. Compute eligibleSelectedDownloads
2. If none → show destructive toast "No eligible downloads selected"
3. Show start toast: "Starting batch transcription for N download(s)"
4. Track successCount = 0, failCount = 0
5. For each eligible download (sequentially, await each):
   a. Look up full record from finishedDownloads by id
   b. Set transcriptionStatus → 'transcribing' (same setState as TranscrptButton)
   c. Build paths (identical to mono download):
      inputLocation  = joinDownloadPath(download.location, download.downloadName)
      outputLocation = joinDownloadPath(download.location,
                         download.downloadName.replace(/\.[^/.]+$/, '.srt'))
   d. Call redownloadTranscript({
        inputFile:  inputLocation,
        outputFile: outputLocation,
        modelPath:  'ggml-base.bin',
        language:   'en',
        format:     'srt',
      }, { onProgressPercent: (pct) => setDownloadTranscriptionProgress(id, pct) })
   e. On success → updateDownloadTranscript(id, result.outputFile)
                 → setDownloadTranscriptionStatus(id, 'completed')
                 → successCount++
   f. On failure → setDownloadTranscriptionStatus(id, 'failed')
                 → failCount++
                 → show per-item destructive toast with error message
6. Show completion toast: "Batch transcription complete: X succeeded, Y failed"
```

### State helpers

Reuse the same inline state updaters from `TranscrptButton` — `setDownloadTranscriptionStatus` and `setDownloadTranscriptionProgress` — defined locally in `Toolbar.tsx` or extracted into the handler closure. No new abstractions needed.

---

## Path Construction

Identical to mono download (`TranscrptButton`):

```ts
const inputLocation = await window.downlodrFunctions.joinDownloadPath(
  download.location,
  download.downloadName,
);
const outputLocation = await window.downlodrFunctions.joinDownloadPath(
  download.location,
  download.downloadName.replace(/\.[^/.]+$/, '.srt'),
);
```

No deviation from the single-download path-building logic.

---

## Toolbar Button

- **Icon:** `FaRegClosedCaptioning` (already imported in `TranscrptButton`, same icon for visual consistency)
- **Tooltip:** `"Generate Captions"`
- **Placement:** Adjacent to the Remove button in the right-side toolbar section
- **Disabled state:** Button is not rendered when `eligibleSelectedDownloads.length === 0` (same pattern as Remove button — conditional render, not disabled prop)

---

## Toast Notifications

| Trigger | Variant | Title | Description |
|---|---|---|---|
| No eligible selected | destructive | "No Eligible Downloads" | "Selected downloads either already have transcripts or are not finished" |
| Batch starts | default | "Batch Transcription Started" | "Generating captions for N download(s) sequentially" |
| Item fails | destructive | "Transcription Failed" | error message from result |
| All done | success | "Batch Transcription Complete" | "X succeeded, Y failed" |

---

## Files Changed

| File | Change |
|---|---|
| `src/downlodr/components/base/Toolbar.tsx` | Add eligibility computation, `handleBatchTranscript`, toolbar button |

No new files. No new stores. No new abstractions.

---

## Concurrency

Fully sequential — one FFmpeg + Whisper job at a time. FFmpeg Whisper (`ggml-base.bin`) is CPU-intensive; parallel execution causes CPU contention, slower total throughput, and UI lag. The "batch" benefit is automatic queue execution after one click, not parallel speedup.
