# Bug Report: Uncaught Exception on Shorts-Only Channel Subscription

**Date:** 2026-04-13  
**Affected file:** `src/skedulosa/backend/video-nemesis-toolkit/src/workers/scraper-worker/scrape.ts`  
**Function:** `fetchChannelDetails`  
**Severity:** High — crashes the Node.js/Electron main process with an uncaught exception

---

## Summary

When a user tries to subscribe to a YouTube channel that **only posts Shorts** (e.g. `https://www.youtube.com/@Ca7club`), the app throws an uncaught exception:

```
Uncaught exception: Cannot read properties of null (reading 'channel')
```

This crash cannot be caught by any `try/catch` in the calling code because it originates inside a Node.js event callback, bypassing the Promise rejection mechanism entirely.

---

## Root Cause

### The problematic code path

`fetchChannelDetails` in `scrape.ts` appends `/videos` to the channel URL before passing it to yt-dlp:

```ts
const videosUrl = channelUrl.trim().endsWith("/videos")
  ? channelUrl
  : `${channelUrl.replace(/\/$/, "")}/videos`;
```

For a shorts-only channel, the `/videos` tab is **empty**. When yt-dlp is run with `--dump-single-json --flat-playlist` against an empty tab, it outputs the JSON literal `null` on stdout (rather than a JSON object or an error).

The code then does:

```ts
let json: Record<string, unknown>;
try {
  json = JSON.parse(stdout); // Returns null — valid JSON, no exception thrown
} catch {
  reject(...);
  return;
}

// CRASH: null.channel throws here
const channelName =
  (json.channel as string | undefined) ?? ...
```

`JSON.parse("null")` is **valid** — it returns JavaScript `null` without throwing. The `catch` block is never entered. TypeScript's type annotation `Record<string, unknown>` is a compile-time assertion only; at runtime `json` is `null`. Accessing `json.channel` then throws a `TypeError`.

### Why it becomes an uncaught exception

The crash does **not** happen inside the `Promise` constructor. It happens inside a `proc.on("close", callback)` event listener, which is registered asynchronously after the Promise is created:

```
new Promise((resolve, reject) => {
  const proc = spawn(...);
  proc.on("close", (code, signal) => {
    // ← crash happens here, inside an async event callback
    // Node.js cannot associate this throw with the Promise's reject()
  });
});
```

Because the throw occurs inside a Node.js EventEmitter callback that is not within the original Promise executor, Node.js has no way to route the error to `.catch()`. The exception propagates to the top-level uncaught exception handler instead — crashing the Electron main process visibly to the user.

The IPC handler wrapping this call does have a `try/catch`:

```ts
try {
  return await fetchChannelDetails(ytDlpPath, channelUrl, ...);
} catch (err) {
  return { error: `Failed to fetch channel details: ...` };
}
```

But this `try/catch` **never fires** because the Promise is never rejected — the crash escapes the async chain entirely.

---

## Fix Applied (Frontend Workaround)

Two changes were made on the frontend side to prevent the crash and improve the user experience:

### 1. `scrape.ts` — Null/non-object guard after `JSON.parse`

After parsing, check that the result is actually a plain object before accessing any properties. If not, call `reject()` explicitly so the error travels through the normal Promise rejection path:

```ts
try {
  const parsed: unknown = JSON.parse(stdout);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    reject(new Error('yt-dlp returned no channel data. If this is a Shorts-only channel, try appending /shorts to the URL.'));
    return;
  }
  json = parsed as Record<string, unknown>;
} catch {
  reject(new Error(`Failed to parse yt-dlp JSON output: ${stdout.slice(0, 200)}`));
  return;
}
```

Additionally, the entire `proc.on("close", ...)` callback was wrapped in a `try/catch` as a defense-in-depth measure:

```ts
proc.on("close", (code, signal) => {
  try {
    // ... all existing logic ...
  } catch (err) {
    reject(err instanceof Error ? err : new Error(String(err)));
  }
});
```

This ensures any future uncaught throws inside the callback are routed to `reject()` instead of crashing the process.

### 2. `SkedulosaSubscribeModal.tsx` — 0-video case handled with user hint

When `analyzeChannelSchedule` returns `videoCount === 0` (which also happens for shorts-only channels, since `CHANNEL_ANALYZE_SCHEDULE` appends `/videos` too), the modal now blocks subscription and shows a hint:

> "No videos found on this channel's Videos tab. If it only posts Shorts, try adding /shorts to the URL (e.g. https://www.youtube.com/@channel/shorts)."

---

## Recommended Backend Fix

The core issue is that **yt-dlp legitimately outputs `null` for empty/shorts-only channel tabs**, and the code does not account for this. The backend team should:

1. **Apply the same null/non-object guard** to `fetchChannelDetails` (already done in this fix, but should be reviewed and confirmed in the canonical backend build).

2. **Apply a similar guard to any other function that calls `JSON.parse` on yt-dlp stdout and then accesses object properties** — particularly any code that uses `--dump-single-json`.

3. **Wrap all `proc.on("close", ...)` and `proc.on("data", ...)` callbacks in `try/catch`** throughout `scrape.ts` and any other files that use `child_process.spawn`. A thrown error inside a Node.js EventEmitter callback is always an uncaught exception if not caught locally — it cannot be intercepted by the Promise chain above it.

4. **Consider a `/shorts` fallback strategy**: if `listChannelVideos` or `fetchChannelDetails` returns empty results for a `@channel/videos` URL, automatically retry with `@channel/shorts` before surfacing an error to the user.

---

## Reproduction Steps

1. Open Skedulosa and click "Add Subscription".
2. Enter a YouTube channel URL whose channel has no regular videos, only Shorts (e.g. `https://www.youtube.com/@Ca7club`).
3. Wait for the analysis debounce (~800ms).
4. Observe: "Uncaught exception: Cannot read properties of null (reading 'channel')" in the Electron main process log / DevTools console.

---

## Affected yt-dlp Command

```bash
yt-dlp --dump-single-json --flat-playlist --playlist-end 101 --no-warnings --quiet --ignore-errors \
  "https://www.youtube.com/@Ca7club/videos"
# stdout: null
```
