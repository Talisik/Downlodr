# yt-dlp Spawn Fix Plan

## Fix 1 — Route `addDownload` and `retryDownload` through the queue

**Root problem:** `downloadActions.ts:125` and `downloadActions.ts:339` both call `window.ytdlp.download` directly, bypassing the `DownloadController` concurrency cap entirely.

**What changes:** Both `addDownload` and `retryDownload` currently contain the full download-start logic inline (path resolution, folder creation, thumbnail/caption setup, the `window.ytdlp.download` call, and the `set()` to add to `downloading[]`). Instead, they'd be refactored to build a `QueuedDownload`-shaped object and call `addQueue`, so the `DownloadController` worker picks them up.

The key question is whether `addDownload` callers expect it to start *immediately* (bypassing the queue intentionally). Looking at the call sites — `FileNotExistModal`, `statusPageHandler`, `CategoryTagPage` — they all appear to be user-triggered restarts/retries. Routing them through the queue with `maxDownloadNum` enforcement is the right behavior.

**Actual code change — `downloadActions.ts`:**
- `addDownload`: instead of calling `window.ytdlp.download`, call `get().addQueue(payload)` (or the queue actions equivalent). The path-resolution and folder-creation logic would move into `controller.ts`'s `startDownloadDirectly` (it's already there — the controller already replicates this logic exactly). So `addDownload` becomes a thin wrapper that calls `addQueue`.
- `retryDownload`: same treatment — build the queue payload, call `addQueue`.

---

## Fix 2 — Throttle `setDownload` concurrent metadata fetches (playlist spawns)

**Root problem:** `TaskbarInputField.tsx:429-436` fires `setDownload` for every playlist video in a synchronous `for...of` loop. Each `setDownload` immediately calls `window.ytdlp.getInfo` (a yt-dlp spawn) in the background. With a 50-video playlist, 50 yt-dlp info fetches launch simultaneously.

**What changes:** In `downloadActions.ts` — `setDownload`, add a module-level concurrency semaphore (a simple counter + async queue pattern, no extra dependencies needed). Something like:

```ts
// top of downloadActions.ts
let activeInfoFetches = 0;
const MAX_CONCURRENT_INFO_FETCHES = 3;
const infoFetchQueue: Array<() => void> = [];
```

`setDownload` would check `activeInfoFetches` before calling `window.ytdlp.getInfo`, and if at cap, await a slot. This limits yt-dlp `--dump-json` spawns to 3 at a time regardless of playlist size.

---

## Fix 3 — Guard `runOnce` against overlapping invocations

**Root problem:** `handlers.js:399-404` calls `s.runOnce(channelId)` on every IPC call with no guard. If the renderer calls `bridge.runScraperOnce` twice in quick succession (which `SubscriptionQueueContext` does via `Promise.all`), two `runOnce` executions can run simultaneously, doubling the scraper spawns.

**What changes:** In the scraper class (`index.js:149`), add an `_isRunning` boolean guard at the top of `runOnce`:

```js
async runOnce(channelId) {
  if (this._isRunning) return { scrapedCount: 0, errors: [], message: 'Already running' };
  this._isRunning = true;
  try {
    // ... existing body
  } finally {
    this._isRunning = false;
  }
}
```

**However**, this file is in `dist/` (compiled output). The fix should go in the source files. You'd need to check if there's a `src/` directory in `video-nemesis-toolkit`.

---

## Fix 4 — Reduce `SubscriptionQueueContext` batch concurrency

**Root problem:** `SubscriptionQueueContext.tsx:264-276` uses `Promise.all` with `BATCH_SIZE = 2`. Each `createSubscription` call triggers `runScraperOnce`, which spawns up to 2 yt-dlp processes per channel = 4 total concurrent scraper spawns.

**What changes:** Change from `Promise.all` (concurrent) to sequential processing within each batch — drop `BATCH_SIZE` to `1` or replace `Promise.all` with a sequential `for...of`. This reduces max concurrent scraper yt-dlp spawns from 4 down to 2 (one channel, two passes).

**Single-line change in `SubscriptionQueueContext.tsx`:**
```ts
// Before:
const batch = queueRef.current.splice(0, BATCH_SIZE);
await Promise.all(batch.map(async (item) => { ... }));

// After:
const [item] = queueRef.current.splice(0, 1);
await createSubscription(item);
```

---

## Fix 5 — Recovery service is already safe

`ytdlpRecoveryService.ts` already has a `running` guard at line 76 (`if (running) return`), so multiple `start()` calls are no-ops. The 20-minute probe interval is also fine. **No change needed here.**

---

## Summary Table

| Fix | File(s) changed | Risk addressed |
|---|---|---|
| 1 | `src/downlodr/store/download/actions/downloadActions.ts` | `addDownload`/`retryDownload` bypassing queue |
| 2 | `src/downlodr/store/download/actions/downloadActions.ts` | Playlist bulk `getInfo` spawns |
| 3 | `dist/workers/scraper-worker/index.js` (or source equivalent) | Concurrent `runOnce` calls |
| 4 | `src/skedulosa/context/SubscriptionQueueContext.tsx` | Batch subscription `Promise.all` spawns |

Fix 1 is the highest priority — it's the main unbounded spawn path. Fix 2 is next since it affects every playlist download. Fixes 3 and 4 are lower risk since the scraper spawns are metadata-only (not full downloads), but still worth doing.
