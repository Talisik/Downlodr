# Transcript Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared module-level transcript queue (max 2 concurrent) so both the single-row `TranscrptButton` and the batch toolbar action serialize transcript jobs instead of running unbounded parallel Whisper processes.

**Architecture:** A new `transcriptQueue.ts` module holds `pendingJobs[]` and a `running` counter. `enqueueTranscript(job)` sets the download's `transcriptionStatus` to `'queued'` and calls `drain()`, which starts up to 2 jobs concurrently. All store status transitions (queued → transcribing → completed/failed) are owned by the queue. Both callers are simplified to a single `enqueueTranscript(...)` call.

**Tech Stack:** TypeScript, Zustand (via `useDownloadStore.setState`), React, `redownloadTranscript` (existing), `transcriptActions` (existing)

---

## File Map

| File | Action |
|------|--------|
| `src/downlodr/utils/transcription/transcriptQueue.ts` | **Create** — queue singleton |
| `src/downlodr/store/download/types.ts` | **Modify** — add `'queued'` to `transcriptionStatus` union |
| `src/downlodr/components/download/TranscrptButton.tsx` | **Modify** — use queue, add queued UI state, remove local helpers |
| `src/downlodr/components/base/Toolbar.tsx` | **Modify** — use queue in `handleBatchTranscript`, remove local helpers |
| `src/transcript/store/transcriptStore.ts` | **Modify** — clear `'queued'` in `clearStuckTranscriptionStatus` |

---

## Task 1: Extend `transcriptionStatus` type to include `'queued'`

**Files:**
- Modify: `src/downlodr/store/download/types.ts`

- [ ] **Step 1: Open types.ts and find the transcriptionStatus field**

  It is at line 60 and currently reads:
  ```ts
  transcriptionStatus?: 'transcribing' | 'completed' | 'failed';
  ```

- [ ] **Step 2: Add `'queued'` to the union**

  Change line 60 to:
  ```ts
  transcriptionStatus?: 'queued' | 'transcribing' | 'completed' | 'failed';
  ```

- [ ] **Step 3: Verify TypeScript still compiles**

  ```powershell
  npx tsc --noEmit
  ```
  Expected: no new errors from this change (existing code that checks `=== 'transcribing'` etc. is unaffected by widening the union).

- [ ] **Step 4: Commit**

  ```powershell
  git add src/downlodr/store/download/types.ts
  git commit -m "feat: add 'queued' to transcriptionStatus type union"
  ```

---

## Task 2: Create the transcript queue module

**Files:**
- Create: `src/downlodr/utils/transcription/transcriptQueue.ts`

- [ ] **Step 1: Create the file with the full queue implementation**

  ```ts
  import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
  import useDownloadStore from '@/downlodr/store/downloadStore';
  import { transcriptActions } from '@/transcript/store/transcriptStore';
  import { redownloadTranscript } from './ffmpegWhisperTranscriber';

  const MAX_CONCURRENT = 2;

  export interface TranscriptJob {
    downloadId: string;
    location: string;
    downloadName: string;
  }

  let running = 0;
  const pendingJobs: TranscriptJob[] = [];

  function setStatus(
    id: string,
    status: 'queued' | 'transcribing' | 'completed' | 'failed',
  ): void {
    useDownloadStore.setState((state) => {
      const update = <
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
        forDownloads: state.forDownloads.map(update),
        downloading: state.downloading.map(update),
        finishedDownloads: state.finishedDownloads.map(update),
        historyDownloads: state.historyDownloads.map(update),
        queuedDownloads: state.queuedDownloads.map(update),
      };
    });
  }

  function setProgress(id: string, percent: number): void {
    useDownloadStore.setState((state) => {
      const update = <T extends { id: string; transcriptionProgress?: number }>(
        d: T,
      ): T => (d.id === id ? { ...d, transcriptionProgress: percent } : d);
      return {
        forDownloads: state.forDownloads.map(update),
        downloading: state.downloading.map(update),
        finishedDownloads: state.finishedDownloads.map(update),
        historyDownloads: state.historyDownloads.map(update),
        queuedDownloads: state.queuedDownloads.map(update),
      };
    });
  }

  async function runJob(job: TranscriptJob): Promise<void> {
    const inputLocation = await window.downlodrFunctions.joinDownloadPath(
      job.location,
      job.downloadName,
    );
    const outputLocation = await window.downlodrFunctions.joinDownloadPath(
      job.location,
      job.downloadName.replace(/\.[^/.]+$/, '.srt'),
    );

    const result = await redownloadTranscript(
      {
        inputFile: inputLocation,
        outputFile: outputLocation,
        modelPath: 'ggml-base.bin',
        language: 'en',
        format: 'srt',
      },
      {
        onProgressPercent: (percent: number) =>
          setProgress(job.downloadId, percent),
      },
    );

    if (result.success && result.outputFile) {
      setStatus(job.downloadId, 'completed');
      const { updateDownloadTranscript } = transcriptActions(
        useDownloadStore.setState,
        useDownloadStore.getState,
      );
      updateDownloadTranscript(job.downloadId, result.outputFile);
    } else {
      setStatus(job.downloadId, 'failed');
      toast({
        variant: 'destructive',
        title: 'Transcription failed',
        description: result.error ?? 'Could not create transcript',
        duration: 5000,
      });
    }
  }

  function drain(): void {
    while (running < MAX_CONCURRENT && pendingJobs.length > 0) {
      const job = pendingJobs.shift()!;
      running++;
      setStatus(job.downloadId, 'transcribing');
      runJob(job).finally(() => {
        running--;
        drain();
      });
    }
  }

  export function enqueueTranscript(job: TranscriptJob): void {
    pendingJobs.push(job);
    setStatus(job.downloadId, 'queued');
    drain();
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```powershell
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```powershell
  git add src/downlodr/utils/transcription/transcriptQueue.ts
  git commit -m "feat: add shared transcript queue with max-2 concurrency"
  ```

---

## Task 3: Update `TranscrptButton` to use the queue and show queued state

**Files:**
- Modify: `src/downlodr/components/download/TranscrptButton.tsx`

- [ ] **Step 1: Replace the entire file contents**

  The new version removes the three local helpers (`setDownloadTranscriptionStatus`, `setDownloadTranscriptionProgress`, `handleRedownloadTranscript`) and replaces the `enqueueTranscript` call inline. It also adds the `isQueued` render branch before `isTranscribing`.

  ```tsx
  import { Skeleton } from '@/core-app/components/shadcn/components/ui/skeleton';
  import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
  import type { FinishedDownloads } from '@/downlodr/store/download/types';
  import { enqueueTranscript } from '@/downlodr/utils/transcription/transcriptQueue';
  import React from 'react';
  import { AiOutlineStop } from 'react-icons/ai';
  import { FaRegClock, FaRegClosedCaptioning } from 'react-icons/fa';
  import { MdOutlineFileDownload } from 'react-icons/md';
  import { AnimatedLinearProgressBar } from './LinearProgress';

  interface StatusTableColumn {
    id: string;
    width: number;
  }

  interface TranscrptButtonProps {
    download: FinishedDownloads;
    column: StatusTableColumn;
    onViewFile: (location?: string, downloadId?: string) => void;
  }

  const TranscrptButton: React.FC<TranscrptButtonProps> = ({
    download,
    onViewFile,
  }) => {
    return (
      <div>
        {(() => {
          const BLOCKED_STATUSES = new Set([
            'downloading',
            'queued',
            'initializing',
            'paused',
            'failed',
            'cancelled',
            'to download',
          ]);

          if (download.status === 'fetching metadata') {
            return (
              <div className="flex justify-center items-center">
                <Skeleton className="h-8 w-[50px] rounded-[3px]" />
              </div>
            );
          }

          if (BLOCKED_STATUSES.has(download.status)) {
            return (
              <TooltipWrapper
                content={`${
                  download.status.charAt(0).toUpperCase() +
                  download.status.slice(1)
                } video`}
                side="bottom"
              >
                <span className="text-notAvailableStatus dark:text-darkModeNotAvailableStatus flex justify-center items-center w-full">
                  —
                </span>
              </TooltipWrapper>
            );
          }

          const transcriptLocation =
            typeof download.transcriptLocation === 'string'
              ? download.transcriptLocation
              : download.autoCaptionLocation;

          const isValidLocation =
            !!transcriptLocation &&
            transcriptLocation.trim() !== '' &&
            transcriptLocation !== 'iu' &&
            transcriptLocation !== 'fu';

          const isQueued = download.transcriptionStatus === 'queued';
          const isTranscribing =
            download.getTranscript &&
            download.transcriptionStatus === 'transcribing';
          const progress = download.transcriptionProgress ?? 0;

          if (isQueued) {
            return (
              <TooltipWrapper content="Queued" side="bottom">
                <span className="flex justify-center items-center w-full">
                  <FaRegClock
                    size={18}
                    className="text-amber-500 dark:text-amber-400"
                  />
                </span>
              </TooltipWrapper>
            );
          }

          if (isTranscribing) {
            return (
              <TooltipWrapper
                content={`Transcribing... ${Math.round(progress)}%`}
                side="bottom"
              >
                <span className="flex justify-center items-center w-full min-w-[60px]">
                  <AnimatedLinearProgressBar
                    status="transcribing"
                    value={progress}
                    min={0}
                    max={100}
                    gaugePrimaryColor="#f59e0b"
                    gaugeSecondaryColor="#fef3c7"
                    width={80}
                  />
                </span>
              </TooltipWrapper>
            );
          }

          if (!isValidLocation) {
            if (transcriptLocation === undefined) {
              return (
                <TooltipWrapper content="Transcript not available" side="bottom">
                  <span className="flex justify-center items-center w-full">
                    <AiOutlineStop
                      size={20}
                      className="text-red-500 hover:text-red-400 transition-colors duration-200"
                    />
                  </span>
                </TooltipWrapper>
              );
            }

            return (
              <TooltipWrapper content="Generate Caption" side="bottom">
                <button
                  onClick={() =>
                    enqueueTranscript({
                      downloadId: download.id,
                      location: download.location,
                      downloadName: download.downloadName,
                    })
                  }
                >
                  <MdOutlineFileDownload
                    size={18}
                    className="mt-2 text-green-600 hover:text-green-400 transition-colors duration-200"
                  />
                </button>
              </TooltipWrapper>
            );
          }

          return (
            <TooltipWrapper content="View transcript" side="bottom">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewFile(transcriptLocation, download.id);
                }}
                className="flex justify-center items-center w-full hover:text-green-400 transition-colors duration-200"
              >
                {download.getTranscript ? (
                  <FaRegClosedCaptioning
                    size={20}
                    className="text-green-600 hover:text-green-400 transition-colors duration-200"
                  />
                ) : (
                  '—'
                )}
              </button>
            </TooltipWrapper>
          );
        })()}
      </div>
    );
  };

  export default TranscrptButton;
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```powershell
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```powershell
  git add src/downlodr/components/download/TranscrptButton.tsx
  git commit -m "feat: use transcript queue in TranscrptButton, add queued state UI"
  ```

---

## Task 4: Simplify `handleBatchTranscript` in Toolbar to use the queue

**Files:**
- Modify: `src/downlodr/components/base/Toolbar.tsx`

- [ ] **Step 1: Remove the two local status/progress helpers**

  Find and delete `setDownloadTranscriptionStatus` (lines ~649–682) and `setDownloadTranscriptionProgress` (lines ~700–714). Both are now owned by the queue.

  Delete this block entirely:
  ```ts
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
  ```

  And delete this block entirely:
  ```ts
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

- [ ] **Step 2: Replace `handleBatchTranscript` with the simplified queue version**

  Find the existing `handleBatchTranscript` function (lines ~717–805) and replace the entire function body:

  ```ts
  const handleBatchTranscript = async () => {
    if (eligibleSelectedDownloads.length === 0) {
      toast({
        variant: 'destructive',
        title: t('toolbar.toast.noEligibleTitle'),
        description: t('toolbar.toast.noEligibleDesc'),
        duration: 3000,
      });
      return;
    }

    const downloadsToProcess = [...eligibleSelectedDownloads];
    clearAllSelections();

    for (const download of downloadsToProcess) {
      enqueueTranscript({
        downloadId: download.id,
        location: download.location,
        downloadName: download.downloadName,
      });
    }

    toast({
      title: t('toolbar.toast.batchStartedTitle'),
      description: t('toolbar.toast.batchStartedDesc', {
        count: downloadsToProcess.length,
      }),
      duration: 4000,
    });
  };
  ```

- [ ] **Step 3: Update imports — remove old, add new**

  Remove these two imports:
  ```ts
  import { redownloadTranscript } from '@/downlodr/utils/transcription/ffmpegWhisperTranscriber';
  import { transcriptActions } from '@/transcript/store/transcriptStore';
  ```

  Add this import (with the other `@/downlodr/utils/...` imports):
  ```ts
  import { enqueueTranscript } from '@/downlodr/utils/transcription/transcriptQueue';
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```powershell
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 5: Commit**

  ```powershell
  git add src/downlodr/components/base/Toolbar.tsx
  git commit -m "feat: use transcript queue in handleBatchTranscript, remove local helpers"
  ```

---

## Task 5: Clear `'queued'` status in `clearStuckTranscriptionStatus`

**Files:**
- Modify: `src/transcript/store/transcriptStore.ts`

- [ ] **Step 1: Find the `clearStuckTranscriptionStatus` function**

  It is at lines ~46–68 and currently clears only `'transcribing'` status:
  ```ts
  d.transcriptionStatus === 'transcribing'
    ? { ...d, transcriptionStatus: undefined, transcriptionProgress: undefined }
    : d;
  ```

- [ ] **Step 2: Extend the condition to also clear `'queued'`**

  Change the condition to:
  ```ts
  d.transcriptionStatus === 'transcribing' || d.transcriptionStatus === 'queued'
    ? { ...d, transcriptionStatus: undefined, transcriptionProgress: undefined }
    : d;
  ```

  The full updated helper looks like:
  ```ts
  const clearIfTranscribing = <
    T extends {
      id: string;
      transcriptionStatus?: string;
      transcriptionProgress?: number;
    },
  >(
    d: T,
  ): T =>
    d.transcriptionStatus === 'transcribing' ||
    d.transcriptionStatus === 'queued'
      ? { ...d, transcriptionStatus: undefined, transcriptionProgress: undefined }
      : d;
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```powershell
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```powershell
  git add src/transcript/store/transcriptStore.ts
  git commit -m "fix: clear 'queued' transcription status on app start alongside 'transcribing'"
  ```

---

## Manual Verification Checklist

After all tasks complete, run the app and verify:

- [ ] Single row: clicking "Generate Caption" on a finished download shows clock icon with "Queued" tooltip immediately, then switches to amber progress bar when it starts running
- [ ] Single row: clicking on 3 downloads in quick succession — only 2 show progress bars simultaneously; the third shows the clock icon until one finishes
- [ ] Batch: selecting 4 finished downloads and clicking the batch transcript button — all 4 show clock icons, then 2 switch to progress bars; remaining 2 switch one at a time as slots free up
- [ ] Completed jobs show the captions icon as before
- [ ] Failed jobs show the red stop icon as before
- [ ] After restarting the app, no rows are stuck in `'queued'` state
