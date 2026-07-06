# Fix: Skedulosa — JavaScript Error in Main Process (Empty Channel Crash)

**Date:** 2026-04-15
**Branch:** merge/skedulosa-fix-diane-branch

---

## Problem

Subscribing to a YouTube channel URL that has **no full-length videos** (e.g. `https://www.youtube.com/@Lilssaintt` instead of `https://www.youtube.com/@Lilssaintt/shorts`) caused Electron to show a fatal popup:

```
A JavaScript error occurred in the main process
Uncaught Exception:
TypeError: Cannot read properties of null (reading 'channel')
  at ChildProcess.<anonymous>
  at ChildProcess.emit (node:events)
  at maybeClose (node:internal/child_process)
  at ChildProcess._handle.onexit (node:internal/child_process)
```

The app would crash and require a restart.

---

## Root Cause

### Bug 1 — `fetchChannelDetails` throws an uncaught exception inside an async event handler

**File:** `src/skedulosa/backend/video-nemesis-toolkit/src/workers/scraper-worker/scrape.ts`

When yt-dlp runs `--dump-single-json --flat-playlist` on a YouTube channel with **no videos on its Videos tab**, it can output the literal string `"null"` to stdout.

The existing code did:
```typescript
json = JSON.parse(stdout);   // succeeds — returns null (valid JSON)
// ...
const channelName = (json.channel as string | undefined) ?? ...
//                   ^^^^^^^^^^^^ TypeError: Cannot read properties of null
```

`JSON.parse("null")` is valid JavaScript — it returns `null`, not an object. The subsequent `json.channel` access then throws `TypeError: Cannot read properties of null (reading 'channel')`.

Because this throw happens inside a `proc.on("close", ...)` event handler registered **after** the Promise was constructed, it is **not caught by the Promise**. It propagates up through Node.js's event loop as an uncaught exception, crashing the Electron main process.

### Bug 2 — `sendToRenderer` throws inside `setImmediate` with no catch

**File:** `src/core-app/ipc/main/skedulosaHandler.ts`

After a scrape run completes, `onRunComplete` in `register.ts` calls `sendToRenderer` inside a `setImmediate` callback:

```typescript
setImmediate(() => {
  const tasks = downloadTasksData.listDownloadTasks(db, "pending");
  options.sendToRenderer!(channel, tasks);   // can throw
});
```

`sendToRenderer` calls `mainWindow.webContents.send(channel, payload)`. If the renderer's IPC channel is `null` at the moment of the call (e.g. the renderer is being torn down or crashed), Electron throws internally. Because the throw is inside `setImmediate` with no surrounding try-catch, it becomes an uncaught exception and crashes the main process.

---

## Fixes

### Fix 1 — Null-guard JSON parse result + wrap close handler in try-catch

**File:** `src/skedulosa/backend/video-nemesis-toolkit/src/workers/scraper-worker/scrape.ts`

Inside `fetchChannelDetails`, after the `JSON.parse` call:

```typescript
// BEFORE
let json: Record<string, unknown>;
try {
  json = JSON.parse(stdout);
} catch {
  reject(new Error(`Failed to parse yt-dlp JSON output: ...`));
  return;
}
const channelName = (json.channel as string | undefined) ?? ...  // crashes if json is null

// AFTER
try {
  const parsed: unknown = JSON.parse(stdout);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    reject(new Error(`yt-dlp returned no channel data (channel may have no videos).`));
    return;
  }
  json = parsed as Record<string, unknown>;
} catch {
  reject(new Error(`Failed to parse yt-dlp JSON output: ...`));
  return;
}
```

The entire `proc.on("close", ...)` callback is also wrapped in an outer `try-catch` that calls `reject(err)`, so any future unexpected throw is captured by the Promise instead of escaping to the event loop.

> **Note:** `fetchChannelDetails` is only used to display channel metadata (avatar, subscriber count) in the subscribe modal UI. It is completely separate from `listChannelVideos`, which handles the actual video scraping and download queue. This fix does not affect scraping or video delivery in any way.

### Fix 2 — Wrap `webContents.send` in try-catch

**File:** `src/core-app/ipc/main/skedulosaHandler.ts`

```typescript
// BEFORE
sendToRenderer: (channel, payload) => {
  if (!mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
},

// AFTER
sendToRenderer: (channel, payload) => {
  try {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  } catch (err) {
    console.error('[skedulosa] sendToRenderer failed (renderer may be closing):', err);
  }
},
```

The `isDestroyed()` check is a TOCTOU (time-of-check-time-of-use) guard — the renderer can be destroyed between the check and the send. The try-catch is the correct defense. Errors are logged and swallowed so the main process stays alive.

---

## Toast Added — Empty Channel Warning

**File:** `src/skedulosa/components/SkedulosaSubscribeModal.tsx`

After the initial scrape runs, the `.then()` handler now detects the specific case where yt-dlp ran cleanly but found zero new videos:

```
scrapedCount > 0   (yt-dlp ran and completed — not a scraper failure)
errors.length === 0  (no yt-dlp errors — not a partial failure)
message === 'No new videos found'  (set by runOnce when totalNewVideos === 0)
```

When all three conditions are true, a destructive toast is shown:

- **YouTube URL without `/shorts`:** "No full-length videos were found on this channel's Videos tab. If this channel only posts Shorts, try resubscribing with `/shorts` added to the URL."
- **Other URLs:** "No videos were found for this channel. The channel may be empty or all videos may be private."

Scraper failures (yt-dlp errors) are deliberately excluded — those are already surfaced by the existing `showScrapeErrors` call above.

---

## Files Changed

| File | Change |
|------|--------|
| `src/skedulosa/backend/video-nemesis-toolkit/src/workers/scraper-worker/scrape.ts` | Null-guard + try-catch in `fetchChannelDetails` close handler |
| `src/skedulosa/backend/video-nemesis-toolkit/dist/workers/scraper-worker/scrape.js` | Same fix applied to compiled dist (app imports from dist) |
| `src/core-app/ipc/main/skedulosaHandler.ts` | try-catch around `webContents.send` in `sendToRenderer` |
| `src/skedulosa/components/SkedulosaSubscribeModal.tsx` | Empty-channel toast in `runScraperOnce` `.then()` handler |
