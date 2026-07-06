# Skedulosa: Duplicate Downloads & Queue Flooding — Research Findings

**Date:** 2026-03-29
**Branch:** dev/front-end
**Reporter:** User (confirmed in testing)

---

## Executive Summary

Two related problems were found in the Skedulosa → Downlodr integration:

1. **Bug: Duplicate queued downloads** — the same video URL gets added to the download queue twice (or more), with the same `channel_id` but different `downloadId` UUIDs, making it look like separate downloads.
2. **Flow problem: Queue flooding** — when many scheduled channels fire at once, all their pending downloads are pushed into the queue simultaneously, with no throttling or staggering.

Both issues share the same entry point: `useSkedulosaDownloadBridge.ts` and the `onRunComplete` callback in `register.ts`.

---

## System Architecture (Quick Reference)

```
Scraper (main process)
  └── runOnce(channelId?) scrapes either:
        - a specific channel when channelId is provided, or
        - all due channels in schedule-driven mode when channelId is omitted
  └── addDownloadTaskIfNotExists() → writes to download_task table (status="pending")
  └── onRunComplete callback fires
        └── when channelId is provided: queries listDownloadTasks(db, { status: "pending", channelId })   ← sends only that channel's pending tasks
        └── when channelId is omitted:  queries listDownloadTasks(db, "pending")                          ← sends ALL pending
        └── sendToRenderer("toolkit:downloadQueue:pushed", tasks)
              ↓ IPC to renderer
useSkedulosaDownloadBridge (React hook, renderer)
  └── for each task:
        └── setDownload(task.video_url, ...) → adds to forDownloads, calls getInfo()
        └── markDownloadTaskFinished(task.id) → IPC back to main → sets status="downloaded"
```

---

## Bug 1: Duplicate Downloads

### Root Cause — Race Condition in Task Status Transition

**File:** `src/skedulosa/backend/video-nemesis-toolkit/src/ipc/register.ts` (lines 53–58)

```typescript
onRunComplete: () => {
  setImmediate(() => {
    const tasks = downloadTasksData.listDownloadTasks(db, "pending");
    options.sendToRenderer!(channel, tasks);  // ← sends ALL still-pending tasks
  });
},
```

Every time a scraper run completes, it queries **all tasks that are still `pending`** in the SQLite `download_task` table and sends them to the renderer. This is by design — the intent is that the renderer will process and mark them finished.

The problem is that the status update is asynchronous and round-trips through IPC:

1. Scraper run completes → sends tasks `[A, B, C]` (all `pending`) to renderer
2. Bridge loop starts: `await setDownload(A)` → `await markDownloadTaskFinished(A.id)`
   ↳ This takes time: `setDownload` fetches metadata via `window.ytdlp.getInfo()` (network call)
3. **While A, B, C are still being processed**, a second scraper run fires and completes
4. `onRunComplete` fires again → queries DB → **A, B, C are still `pending`** (not yet marked finished)
5. Renderer receives `[A, B, C]` a second time → queues them again → **duplicates**

### Secondary Cause — No Deduplication in `setDownload` or `addQueue`

**File:** `src/downlodr/store/download/actions/downloadActions.ts` (line 443+)
**File:** `src/downlodr/store/download/actions/queueActions.ts` (line 35+)

Neither `setDownload` nor `addQueue` check whether a given `videoUrl` is already in `forDownloads`, `queuedDownloads`, or `downloading`. Every call unconditionally creates a new entry with a fresh UUID. So even without the race condition, a bug elsewhere can trivially create duplicates.

### Tertiary Cause — No DB-level Guard for Re-delivery

The `addDownloadTaskIfNotExists` function in the scraper correctly deduplicates at insert time (checks `download_task` and `download_history`). However, it only prevents **new** tasks from being created for the same URL. It does nothing to prevent an already-created `pending` task from being re-delivered to the renderer on the next `onRunComplete`.

In the current design, once a task is written as `pending`, it will be re-sent on every subsequent `onRunComplete` until `markDownloadTaskFinished` (which sets status to `downloaded`) resolves — but that can take several seconds.

---

## Flow Problem: Queue Flooding

### Root Cause — Unbounded Concurrent `setDownload` Calls

**File:** `src/skedulosa/hooks/useSkedulosaDownloadBridge.ts` (lines 34–77)

```typescript
for (const task of tasks) {
  try {
    await setDownload(task.video_url, resolvedLocation, limitRate, {...}, subscription?.id);
    await bridge.markDownloadTaskFinished(task.id);
  } catch (err) { ... }
}
```

The loop is sequential (`await` per task), but `setDownload` itself does two things immediately:

1. **Synchronously** adds the item to `forDownloads` with status `"fetching metadata"` — the user sees this instantly in the UI
2. **Asynchronously** fires `window.ytdlp.getInfo(videoUrl)` — a network call to yt-dlp

If 15 channels each have 3 new videos, the loop fires 45 `setDownload` calls back-to-back. Even though each `await` waits for the previous one, all 45 are processed in rapid succession (the only delay is the getInfo network latency for each). The result:

- **45 items appear in the UI simultaneously** — overwhelming the user visually
- **45 concurrent yt-dlp metadata queries** hit the network at once
- **45 items are added to the queue** with no delay — the download controller then begins processing them all immediately

There is currently no:
- Maximum batch size per trigger event
- Delay or stagger between queuing individual downloads
- Concurrency cap on metadata fetches from the bridge

The download controller (`DownloadController`) does enforce a `maxDownloadNum` concurrent limit when *starting* downloads — but items can still pile up in `queuedDownloads` and `forDownloads` without limit.

---

## Affected Files Summary

| File | Role | Problem |
|------|------|---------|
| `src/skedulosa/backend/video-nemesis-toolkit/src/ipc/register.ts:53-58` | Sends pending tasks to renderer | Re-sends all `pending` tasks every run — no status transition before delivery |
| `src/skedulosa/hooks/useSkedulosaDownloadBridge.ts:34-77` | Processes tasks in renderer | Sequential loop with no rate-limiting; no guard against re-delivered tasks |
| `src/downlodr/store/download/actions/downloadActions.ts:443+` | `setDownload` | No URL deduplication check |
| `src/downlodr/store/download/actions/queueActions.ts:35+` | `addQueue` | No URL deduplication check |
| `src/skedulosa/backend/video-nemesis-toolkit/src/data/downloadTasks.ts` | SQLite task data | `hasTaskForVideoUrl` prevents duplicate inserts, but doesn't block re-delivery of existing pending tasks |

---

## Proposed Fix Approaches

### Fix 1 — Mark Tasks as "Queued" Before Delivery (Recommended for Bug 1)

Change the `onRunComplete` callback to transition tasks from `pending` → `queued_externally` (a new status) **before** sending them to the renderer. This way, subsequent `onRunComplete` calls will not re-deliver the same tasks, regardless of how long the bridge takes to process them.

```
pending → queued_externally (set atomically before delivery)
queued_externally → downloaded (set after bridge confirms success)
queued_externally → pending (retry: set back if bridge fails/app restarts)
```

**Pros:** Eliminates the race condition at the source. No changes needed in the renderer.
**Cons:** Requires adding a new status value to the `download_task` schema and migration.

---

### Fix 2 — URL Deduplication Guard in the Bridge Hook (Defense-in-depth for Bug 1)

Before calling `setDownload`, the bridge should check whether the URL is already present in `forDownloads`, `queuedDownloads`, or `downloading`. If found, skip the task and still call `markDownloadTaskFinished` to clean it up.

```typescript
const existingUrls = new Set([
  ...forDownloads.map(d => d.videoUrl),
  ...queuedDownloads.map(d => d.videoUrl),
  ...downloading.map(d => d.videoUrl),
]);
if (existingUrls.has(task.video_url)) {
  await bridge.markDownloadTaskFinished(task.id);
  continue;
}
```

**Pros:** Quick to implement. Works as a safety net even if Fix 1 is also applied.
**Cons:** Does not protect against duplicates that are in `finishedDownloads` (re-downloading already completed videos). Does not fix the root race condition — just filters its effect.

---

### Fix 3 — Staggered Queue Dispatch (For Flow Problem)

Add a configurable delay between each `setDownload` call in the bridge loop so that downloads are introduced to the UI one at a time (or in small batches) rather than all at once.

```typescript
const BATCH_SIZE = 3;      // queue up to 3 at a time
const BATCH_DELAY_MS = 2000; // wait 2s between batches

for (let i = 0; i < tasks.length; i++) {
  if (i > 0 && i % BATCH_SIZE === 0) {
    await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }
  // ... process task
}
```

**Pros:** Prevents overwhelming the UI and yt-dlp metadata service. User sees downloads trickle in instead of exploding.
**Cons:** Delays the start of downloads for large batches. The delay must be tuned — too short and flooding returns, too long and the user waits.

---

### Fix 4 — Queue Pending Tasks Through a Separate "Pending Queue" Store State (Alternative for Flow Problem)

Instead of calling `setDownload` immediately for all tasks, store the incoming tasks in a separate "pending from skedulosa" queue in the Zustand store, then have a controller that introduces them at a rate matching `maxDownloadNum`. This gives the user full visibility and control (they could pause/resume this queue separately).

**Pros:** Most user-friendly — follows the same pattern as the existing download queue.
**Cons:** Larger implementation surface. Requires new UI for the pending skedulosa queue.

---

## Recommended Plan

Apply all three in sequence:

| Priority | Fix | Addresses |
|----------|-----|-----------|
| 1 (highest) | Fix 1 — pre-mark tasks as `queued_externally` before delivery | Bug 1 root cause |
| 2 | Fix 2 — URL dedup guard in bridge hook | Bug 1 defense-in-depth |
| 3 | Fix 3 — staggered batch dispatch | Flow problem |

Fix 4 is a nice-to-have for a future iteration.

---

## Questions for Review Before Implementation

1. Should the new `queued_externally` status in `download_task` reset to `pending` on app restart (so downloads are retried if the app closed mid-bridge)? Or should it stay as `queued_externally` so they don't get re-queued?
2. What batch size and delay feels right for Fix 3? (e.g., 1 download every 2 seconds? 3 at a time every 5 seconds?)
3. Should duplicates that are re-delivered be silently skipped, or should they show a toast/warning to the user?

### My Adjustments
1) Fix 1 — Mark Tasks as "Queued" Before Delivery (Recommended for Bug 1)
- The new status doesnt have to be show externally to the user and should only be applied to the skedulosa downloads, and should not affect the usual download flow. 
- but you can proceed with adding it the schema and migration

2) Apply the deduplication only to the Skedulosa downloads, not the usual setDownload or queue in the usual process

3) Add the fix to only the skedulosa downloads

4) If i implemented it right now and it only affected the skedulosa flow would it still be a major impact??

### Answer your questions
1. Should the new `queued_externally` status in `download_task` reset to `pending` on app restart (so downloads are retried if the app closed mid-bridge)? Or should it stay as `queued_externally` so they don't get re-queued?
- they should stay queued as 'queued_externally' if they werent passed to the other queue in time

2. What batch size and delay feels right for Fix 3? (e.g., 1 download every 2 seconds? 3 at a time every 5 seconds?)
- they should be 5 downloads for every 2 seconds (5 is the maximum but it could adjust to the lowest if only 3 downloads have to be queued)

3. Should duplicates that are re-delivered be silently skipped, or should they show a toast/warning to the user?
- they should be skipped silents

Do you any more queustions?
