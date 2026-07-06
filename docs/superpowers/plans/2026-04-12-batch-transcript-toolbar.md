# Batch Transcript Toolbar Button — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Generate Captions" toolbar button that sequentially runs FFmpeg Whisper transcription on all eligible selected downloads, one at a time.

**Architecture:** All logic lives in `Toolbar.tsx`. Eligibility is computed by cross-referencing `selectedDownloads` (from `useSelectedDownloadStore`) with `finishedDownloads` (from `useDownloadStore`). The sequential processor mirrors the existing `handleStopSelected` / `handleRemoveSelected` pattern — `await` in a `for...of` loop. Per-row progress display is handled automatically by existing `TranscrptButton` store state reactions, so no extra UI is needed.

**Tech Stack:** React, Zustand (`useDownloadStore`, `useSelectedDownloadStore`), `redownloadTranscript` from `ffmpegWhisperTranscriber`, `window.downlodrFunctions.joinDownloadPath`, `FaRegClosedCaptioning` from `react-icons/fa`, `react-router-dom` `useLocation`

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/downlodr/components/base/Toolbar.tsx` | Modify | Add import, eligibility computation, `handleBatchTranscript`, toolbar button JSX |

No new files. No new stores.

---

### Task 1: Add the import for `redownloadTranscript` and `FaRegClosedCaptioning`

**Files:**
- Modify: `src/downlodr/components/base/Toolbar.tsx`

- [ ] **Step 1: Open `Toolbar.tsx` and locate the import block at the top of the file.**

The existing imports end around line 31. You need to add two imports:

1. `redownloadTranscript` from the transcription utility
2. `FaRegClosedCaptioning` icon

- [ ] **Step 2: Add the missing imports.**

Add after the existing `react-icons/lu` import:

```tsx
import { redownloadTranscript } from '@/downlodr/utils/transcription/ffmpegWhisperTranscriber';
import { transcriptActions } from '@/transcript/store/transcriptStore';
import { FaRegClosedCaptioning } from 'react-icons/fa';
```

> Note: `transcriptActions` is needed for `updateDownloadTranscript`. `FaRegClosedCaptioning` is the same icon used in `TranscrptButton` for visual consistency.

- [ ] **Step 3: Verify the file compiles with `yarn lint` — no import errors.**

Run: `yarn lint`  
Expected: No errors related to the new imports.

---

### Task 2: Add the eligibility helper and `eligibleSelectedDownloads` computation

**Files:**
- Modify: `src/downlodr/components/base/Toolbar.tsx`

- [ ] **Step 1: Read how `hasForDownloadStatus` is computed in Toolbar (around line 67–71) to understand the pattern to follow.**

```tsx
// Existing pattern — for reference only, do not change
const hasForDownloadStatus = selectedDownloads.some((download) =>
  forDownloads.some(
    (fd) => fd.id === download.id && fd.status === 'to download',
  ),
);
```

- [ ] **Step 2: Add a `finishedDownloads` subscription from `useDownloadStore` near the other store reads (around line 48).**

Locate this existing line:
```tsx
const { downloading, forDownloads } = useDownloadStore();
```

Replace it with:
```tsx
const { downloading, forDownloads, finishedDownloads } = useDownloadStore();
```

- [ ] **Step 3: Add the eligibility helper function and `eligibleSelectedDownloads` derivation below the existing `hasDownloadingStatus` computation (around line 93).**

The eligibility check mirrors `TranscrptButton` exactly — same invalid-location logic:

```tsx
// Helper: mirrors TranscrptButton invalid-location check
const isTranscriptMissing = (transcriptLocation: string | undefined, autoCaptionLocation: string | undefined): boolean => {
  const location =
    typeof transcriptLocation === 'string' ? transcriptLocation : autoCaptionLocation;
  const isValid =
    !!location &&
    location.trim() !== '' &&
    location !== 'iu' &&
    location !== 'fu';
  return !isValid;
};

// Eligible = finished, no valid transcript, not currently transcribing
const eligibleSelectedDownloads = selectedDownloads
  .map((selected) =>
    finishedDownloads.find((fd) => fd.id === selected.id),
  )
  .filter(
    (fd): fd is (typeof finishedDownloads)[0] =>
      fd !== undefined &&
      fd.status === 'finished' &&
      fd.transcriptionStatus !== 'transcribing' &&
      isTranscriptMissing(fd.transcriptLocation, fd.autoCaptionLocation),
  );
```

- [ ] **Step 4: Verify with `yarn lint` — no TypeScript errors on the new computation.**

Run: `yarn lint`  
Expected: No errors.

---

### Task 3: Add the `handleBatchTranscript` handler

**Files:**
- Modify: `src/downlodr/components/base/Toolbar.tsx`

- [ ] **Step 1: Add the two state helper functions inside the `Toolbar` component body, after the existing handler functions (around line 350 — after `handleRemoveButtonClick`).**

These are identical to the helpers in `TranscrptButton.tsx`, scoped locally to the Toolbar component:

```tsx
const setDownloadTranscriptionStatus = (
  id: string,
  status: 'transcribing' | 'completed' | 'failed',
) => {
  useDownloadStore.setState((state) => {
    const withStatus = <
      T extends {
        id: string;
        transcriptionStatus?: string;
        transcriptionProgress?: number;
        getTranscript?: boolean;
      },
    >(
      d: T,
    ): T =>
      d.id === id
        ? {
            ...d,
            transcriptionStatus: status,
            ...(status === 'transcribing'
              ? { getTranscript: true, transcriptionProgress: 0 }
              : {}),
            ...(status === 'completed' ? { transcriptionProgress: 100 } : {}),
          }
        : d;
    return {
      forDownloads: state.forDownloads.map(withStatus),
      downloading: state.downloading.map(withStatus),
      finishedDownloads: state.finishedDownloads.map(withStatus),
      historyDownloads: state.historyDownloads.map(withStatus),
      queuedDownloads: state.queuedDownloads.map(withStatus),
    };
  });
};

const setDownloadTranscriptionProgress = (id: string, percent: number) => {
  useDownloadStore.setState((state) => {
    const withProgress = <
      T extends { id: string; transcriptionProgress?: number },
    >(
      d: T,
    ): T => (d.id === id ? { ...d, transcriptionProgress: percent } : d);
    return {
      forDownloads: state.forDownloads.map(withProgress),
      downloading: state.downloading.map(withProgress),
      finishedDownloads: state.finishedDownloads.map(withProgress),
      historyDownloads: state.historyDownloads.map(withProgress),
      queuedDownloads: state.queuedDownloads.map(withProgress),
    };
  });
};
```

- [ ] **Step 2: Add the `handleBatchTranscript` async function immediately after the two helpers above.**

```tsx
const handleBatchTranscript = async () => {
  if (eligibleSelectedDownloads.length === 0) {
    toast({
      variant: 'destructive',
      title: 'No Eligible Downloads',
      description:
        'Selected downloads either already have transcripts or are not finished.',
      duration: 3000,
    });
    return;
  }

  toast({
    title: 'Batch Transcription Started',
    description: `Generating captions for ${eligibleSelectedDownloads.length} download(s) sequentially.`,
    duration: 4000,
  });

  let successCount = 0;
  let failCount = 0;

  for (const download of eligibleSelectedDownloads) {
    const downloadId = download.id;

    setDownloadTranscriptionStatus(downloadId, 'transcribing');

    const inputLocation = await window.downlodrFunctions.joinDownloadPath(
      download.location,
      download.downloadName,
    );
    const outputLocation = await window.downlodrFunctions.joinDownloadPath(
      download.location,
      download.downloadName.replace(/\.[^/.]+$/, '.srt'),
    );

    const { updateDownloadTranscript } = transcriptActions(
      useDownloadStore.setState,
      useDownloadStore.getState,
    );

    const result = await redownloadTranscript.call(
      null,
      {
        inputFile: inputLocation,
        outputFile: outputLocation,
        modelPath: 'ggml-base.bin',
        language: 'en',
        format: 'srt',
      },
      {
        onProgressPercent: (percent: number) =>
          setDownloadTranscriptionProgress(downloadId, percent),
      },
    );

    if (result.success && result.outputFile) {
      setDownloadTranscriptionStatus(downloadId, 'completed');
      updateDownloadTranscript(downloadId, result.outputFile);
      successCount++;
    } else {
      setDownloadTranscriptionStatus(downloadId, 'failed');
      failCount++;
      toast({
        variant: 'destructive',
        title: 'Transcription Failed',
        description: result.error ?? 'Could not create transcript',
        duration: 5000,
      });
    }
  }

  toast({
    variant: successCount > 0 && failCount === 0 ? 'success' : 'default',
    title: 'Batch Transcription Complete',
    description: `${successCount} succeeded, ${failCount} failed.`,
    duration: 5000,
  });
};
```

> **Note on `redownloadTranscript.call(null, ...)`:** The exported `redownloadTranscript` convenience function is an unbound static method reference. Calling it via `.call(null, ...)` avoids `this` binding issues, consistent with how it's used as a static method internally.

- [ ] **Step 3: Verify with `yarn lint`.**

Run: `yarn lint`  
Expected: No errors.

---

### Task 4: Add the toolbar button JSX

**Files:**
- Modify: `src/downlodr/components/base/Toolbar.tsx`

- [ ] **Step 1: Locate the Remove button block in the JSX (around line 668–702). It looks like:**

```tsx
{selectedDownloads.length > 0 &&
  (location.pathname.includes('/status/') ||
    location.pathname.includes('/tags/') ||
    location.pathname.includes('/category/')) && (
    <TooltipWrapper content="Remove" side="bottom">
      <Button ... />
    </TooltipWrapper>
  )}
```

- [ ] **Step 2: Add the Batch Captions button immediately BEFORE the Remove button block, using the identical visibility condition.**

```tsx
{eligibleSelectedDownloads.length > 0 &&
  (location.pathname.includes('/status/') ||
    location.pathname.includes('/tags/') ||
    location.pathname.includes('/category/')) && (
    <TooltipWrapper content="Generate Captions" side="bottom">
      <Button
        variant="transparent"
        size="icon"
        className={cn(
          'px-[10px] py-4 rounded-md flex gap-2 text-sm h-7 items-center hover:bg-gray-100 dark:hover:bg-darkModeHover dark:text-gray-500',
        )}
        onClick={handleBatchTranscript}
        icon={
          <FaRegClosedCaptioning
            size={15}
            className="text-gray-700 dark:text-gray-300 hover:dark:text-gray-100"
          />
        }
      />
    </TooltipWrapper>
  )}
```

- [ ] **Step 3: Run `yarn lint` — verify no errors.**

Run: `yarn lint`  
Expected: No errors.

- [ ] **Step 4: Start the dev server and manually verify the button behavior.**

Run: `yarn start`

Verify:
1. Select a finished download that has no transcript → button appears next to Remove
2. Select only downloads with valid transcripts → button does NOT appear
3. Select a mix (some eligible, some not) → button appears
4. Click the button → start toast fires, eligible rows show progress bar, non-eligible rows are untouched
5. After completion → completion toast shows correct succeeded/failed counts
6. A row that was already transcribing should not appear in the batch

---

### Task 5: Final cleanup and commit

**Files:**
- Modify: `src/downlodr/components/base/Toolbar.tsx`

- [ ] **Step 1: Run `yarn lint` one final time and fix any remaining warnings.**

Run: `yarn lint`  
Expected: Clean output.

- [ ] **Step 2: Review the diff — confirm no unintended changes outside Toolbar.tsx.**

Run: `git diff --stat`  
Expected: Only `src/downlodr/components/base/Toolbar.tsx` and the new docs files.

- [ ] **Step 3: Confirm the feature works end-to-end one more time (see Task 4 Step 4 checklist).**

- [ ] **Step 4: Save a lessons entry if any corrections were needed during implementation.**

Append to `docs/lessons.md` (create if absent):
```
[2026-04-12] Batch transcript toolbar:
- redownloadTranscript is an unbound static method export — call via .call(null, ...) to avoid `this` errors
- selectedDownloads store holds minimal data; full transcript fields must be read from finishedDownloads by id
```
