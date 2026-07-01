# Recommendations

Improvements identified during code review sessions. Each entry notes its status, the file it applies to, and a full explanation.

---

## `src/core-app/ipc/main/ytdlpHandler.ts`

### ✅ IPC send fires on every progress chunk with no throttling
**Status:** Implemented (2026-04-16)

yt-dlp emits progress updates many times per second. Every one triggered an IPC round-trip from the main process to the renderer, which carries serialization overhead. For multiple concurrent downloads this was the most likely source of UI lag and frame drops. Fixed by adding a `lastProgressSentTime` timestamp check with a 150ms window — pure progress chunks are skipped if one was already sent recently. Status-change and completion chunks always bypass the throttle.

---

### ✅ `completeLog` grows unbounded and is sent on every chunk
**Status:** Implemented (2026-04-16)

`completeLog` was appended to on every chunk for the entire duration of a download with no upper bound. For long downloads this string could reach several MB in memory. Worse, it was attached to every single `enhancedChunk` sent to the renderer via IPC, meaning the same growing string was serialized and transmitted repeatedly. Fixed by: (1) capping the buffer at 50KB (trimming oldest content), and (2) only including `completeLog` in the final completion event where it is actually needed — not on every progress chunk.

---

### ✅ Fallback `setTimeout` never cancelled on normal completion
**Status:** Implemented (2026-04-16)

A 2-second fallback timeout was created on every download but never stored or cancelled. For normal completions the callback was a no-op due to the `processCompletionHandled` flag — but the timer still ran and held a closure over `e`, `controller`, and `completeLog` for those 2 seconds. With many concurrent downloads these accumulated. Fixed by storing the timer reference in `fallbackTimeout` and calling `clearTimeout` inside `handleProcessCompletion`.

---

### ✅ `exit` and `close` listeners on `controller.process` never removed
**Status:** Implemented (2026-04-16)

Both `exit` and `close` were registered with `.on()`, which means the listeners remained attached to the process object after firing. If the controller object persists in memory, this is a memory leak. Fixed by switching to `.once()` — listeners auto-remove themselves after the first call.

---

### ✅ `YTDLP.Config.log = true` set on every `ytdlp:info` call
**Status:** Implemented (2026-04-16)

`YTDLP.Config.log = true` was inside the `ytdlp:info` IPC handler, mutating global config on every metadata fetch. This is a side effect with no benefit since the value never changes. Moved to the top of `ytdlpHandler()` so it is set exactly once at initialisation.

---

## `src/downlodr/store/download/controller.ts`

### ⚠️ `thumbnailPath` initialised to a space character instead of empty string
**Status:** Not yet implemented

Line 261: `let thumbnailPath = ' ';` — the initial value is a single space, not `''`. When no thumbnail is requested and `isCreateFolder` is false, `thumnailsLocation` gets stored as `' '` (a space) in the downloading entry. A space is truthy, so UI components that check `download.thumnailsLocation` will think a thumbnail path exists when it doesn't, potentially showing the wrong placeholder state.

**Recommended fix:** Change the initialisation to `let thumbnailPath = '';`.

---

### ⚠️ `captionsPath` path join runs before the `isCreateFolder` check
**Status:** Not yet implemented

Lines 251–259 compute a `captionsPath` by joining paths unconditionally on every download start, then the value is thrown away and recomputed again inside `if (download.isCreateFolder)`. This is unnecessary async file-system work on every single queued download regardless of whether a folder or transcript is involved.

**Recommended fix:** Remove the early computation of `captionsPath` before the `if (download.isCreateFolder)` block and only compute it inside the block where it is actually used.

---

### ⚠️ No retry limit on failed queue items
**Status:** Not yet implemented

When `startDownloadDirectly` throws, the download is put back at the front of the queue with no attempt counter or backoff delay. A consistently broken download (bad path, missing file, malformed URL) will be retried every 500ms indefinitely, spinning the worker loop and logging errors continuously.

**Recommended fix:** Add a `retryCount` field to `QueuedDownload`. Increment it on each failure. After a configurable threshold (e.g. 3 attempts), move the download to `failedDownloads` instead of re-queuing it, and show a toast.

---

### ⚠️ `subscriptionDownloadSync.onDownloadStarted` fires before state is updated
**Status:** Not yet implemented

`subscriptionDownloadSync.onDownloadStarted(downloadId, download)` is called on line 248, before `this.store.setState(...)` runs later in the same function. If the sync service reads from the store immediately after being notified, the new download entry won't exist in `downloading` yet, leading to a missed or stale sync.

**Recommended fix:** Move the `subscriptionDownloadSync.onDownloadStarted` call to after `this.store.setState(...)` so the download is in the store before the sync service is notified.

---

## `src/downlodr/store/download/downloadStore.ts`

### ✅ Downloads stuck in `fetching metadata` persist across restarts
**Status:** Implemented (2026-04-16)

`forDownloads` is persisted to IndexedDB via `partialize`. When the app closes while a download is in `fetching metadata` status, that entry is saved with that status. On the next startup, Zustand rehydrates `forDownloads` from IndexedDB and the entry comes back — but the metadata fetch process that was running it is gone. Nothing will ever move it out of that status, so it sits in the table forever showing skeletons. Fixed by adding a filter in `onRehydrateStorage` that removes all `forDownloads` entries with `status === 'fetching metadata'` after rehydration completes.

---

## `src/downlodr/pages/status/statusPageHandler.ts`

### ✅ Pause broken: wrong return type assumption on `killController`
**Status:** Implemented (2026-04-16)

`killController` returns a plain `boolean` at the IPC layer, but `handlePause` typed the `.then()` callback value as `{ success: boolean }` and checked `response.success`. Since accessing `.success` on a boolean always returns `undefined`, the success branch never executed. The kill might have worked, but the code had no idea. Fixed by replacing the fire-and-forget `.then()` with `await` and reading the result as a boolean directly.

---

### ✅ No status rollback when pause fails
**Status:** Implemented (2026-04-16)

`updateDownloadStatus(downloadId, 'paused')` was called optimistically before `killController` completed. If the kill returned `false` (controller already gone, download still initializing, etc.), the status stayed `paused` while the yt-dlp process kept running. When the process finished on its own, the download would unexpectedly transition to `finished` — explaining reports of downloads "outright stopping" after a pause attempt. Fixed by reverting status back to `'downloading'` when the kill returns false or throws.

---

### ✅ `controllerId` guard incomplete — empty string passed to `killController`
**Status:** Implemented (2026-04-16)

The pause condition only checked `controllerId !== '---'` but not whether `controllerId` was truthy. During `initializing` status, no controller is assigned yet so `controllerId` is `undefined`. `undefined !== '---'` is true, so `killController('')` was being called. The IPC handler returns `false` for an empty ID, but by then the status was already set to `paused`. Fixed by adding a truthy check to the condition so `initializing` downloads receive a "Cannot Pause Yet" toast instead.

---

### ✅ Resume wipes thumbnail and transcript paths
**Status:** Implemented (2026-04-16)

When resuming a paused download, `addDownload` was called with `isCreateFolder: false` (correct — the folder already exists) but without `autoCaptionLocation` or `thumnailsLocation`. Inside `addDownload`, thumbnail and transcript downloads are gated on `if (isCreateFolder)`, so they are skipped on resume. The path variables default to `''` and `'hhh'` respectively, and those placeholder values get stored on the new downloading entry — wiping the real paths that were captured during the original download. Fixed by forwarding both fields from `currentDownload` in the resume `addDownload` call.

---

## `src/downlodr/components/navigation/PageNavigation.tsx`

### ✅ TypeScript error: `error` is of type `unknown` (ts18046)
**Status:** Implemented (2026-04-16)

In the plugin install catch block, `error` was used directly as `error.message` without narrowing. TypeScript 4+ types caught values as `unknown`, making property access a type error. Fixed by casting to `Error` via `const err = error as Error` and replacing all `error.message` references.

---

## `src/downlodr/components/base/InputField/TaskbarInputField.tsx`

### ✅ Channel link reroute to Skedulosa active in UX build
**Status:** Implemented (2026-04-16)

The block that navigated users to Skedulosa when a YouTube channel URL was detected was active while Skedulosa is intentionally hidden from users for the UX improvement release. Commented out with a `[SKEDULOSA]` restoration marker. Replaced with a destructive toast and input clear so the user still gets meaningful feedback.
