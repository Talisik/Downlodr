# yt-dlp Recovery Service — Design Spec

**Date:** 2026-04-08
**Status:** Approved

---

## Problem

When yt-dlp fails to scrape a channel (timeout, bad exit code, spawn error), the user sees an error toast but has no way to know when yt-dlp is working again. The scraper silently stays broken until the user manually retries.

---

## Goal

When any yt-dlp error is detected, automatically start a background health-check loop that polls every 20 minutes. When yt-dlp is confirmed working again, stop the loop and notify the user with a success toast.

---

## Probe Strategy

The health check uses `bridge.analyzeChannelSchedule('https://www.youtube.com/@YouTube')` as its probe.

**Why this call:**
- Calls `listChannelVideos` internally — the same yt-dlp binary and code path where all the errors originate
- Writes nothing to SQLite — no download tasks, no channels, no schedules created
- Returns `{ videoCount: number, error?: string }` — simple success/fail signal

**Success condition:** `result.videoCount > 0` with no `result.error`

**Canary URL:** `https://www.youtube.com/@YouTube` — YouTube's official channel, always public, always has videos

---

## Architecture

### New file: `src/skedulosa/utils/ytdlpRecoveryService.ts`

A module-level singleton (plain TypeScript, no React). Owns the polling timer and all probe logic.

**Interface:**
```
start(bridge): void   — no-op if already running; begins the 20-min loop
stop(): void          — clears the timer, resets running state
isRunning(): boolean  — current state
```

**Loop behaviour:**
- On `start()`: schedules the first probe after 20 minutes (using `setTimeout`)
- After each failed probe: schedules the next probe 20 minutes later
- After a successful probe: calls `stop()`, fires the success toast, does not reschedule
- If `start()` is called while already running: no-op (prevents duplicate loops)

**Each probe (in order):**
1. Call `bridge.analyzeChannelSchedule('https://www.youtube.com/@YouTube')`
2. If `result.videoCount > 0` and no `result.error` → success path
3. Success path: call `stop()`, show toast `{ title: 'Scraping is back', description: 'yt-dlp is working again. Skedulosa will resume scraping normally.' }`
4. Failure path: schedule next probe in 20 minutes

**Error safety:** The probe call is wrapped in try/catch. A thrown exception is treated the same as a failed probe — schedule next retry, do not crash the loop.

---

### Modified file: `src/skedulosa/error-mapping/skedulosaErrors.ts`

`showScrapeErrors` already detects yt-dlp errors and fires toasts. After firing the toast for a yt-dlp error, it calls:

```ts
ytdlpRecoveryService.start(window.skedulosaBridge)
```

Only called when a yt-dlp error is present (the existing loop in `showScrapeErrors` already filters for this). Non-yt-dlp errors (DB errors, internal errors) do not trigger recovery.

**Which errors trigger recovery:** Any error whose message matches an entry in `SKEDULOSA_ERROR_MAP` that is yt-dlp-related:
- `yt-dlp timed out after`
- `yt-dlp spawn error`
- `yt-dlp exit`
- `Failed to parse yt-dlp JSON output`
- `yt-dlp timed out fetching`

To keep this simple: the recovery service starts on **any** error surfaced by `showScrapeErrors`. Since `showScrapeErrors` is only called with `ScrapeRunResult.errors[]`, which only contains yt-dlp or internal scraper errors, false positives are acceptable — the probe is cheap.

---

### New file: `src/skedulosa/hooks/useYtdlpRecovery.ts`

A minimal React hook mounted once at the Skedulosa section root.

**Responsibility:** Call `ytdlpRecoveryService.stop()` on unmount so the timer is cleared if the Skedulosa section unmounts.

**Does not:** manage state, render anything, or expose values. It is purely a lifecycle cleanup hook.

**Mount location:** The existing Skedulosa layout or App.tsx where `useSkedulosaDownloadBridge` is already mounted.

---

## Data flow

```
yt-dlp error occurs
  → showScrapeErrors() fires toast
  → ytdlpRecoveryService.start(bridge)
      [no-op if already running]

Every 20 minutes:
  → bridge.analyzeChannelSchedule('@YouTube')
      ├── videoCount > 0, no error
      │     → stop()
      │     → toast: "Scraping is back"
      └── error or videoCount === 0
            → schedule next check in 20 min
```

---

## What this does NOT do

- Does not retry failed scrapes for the user's actual subscriptions — it only confirms yt-dlp is functional again
- Does not write any data to SQLite during probing
- Does not block the UI or any existing scraper loop
- Does not expose a "checking..." status indicator in the UI (out of scope for this iteration)

---

## Files changed

| File | Change |
|---|---|
| `src/skedulosa/utils/ytdlpRecoveryService.ts` | New — singleton service |
| `src/skedulosa/hooks/useYtdlpRecovery.ts` | New — cleanup hook |
| `src/skedulosa/error-mapping/skedulosaErrors.ts` | Modified — `showScrapeErrors` starts recovery on yt-dlp error |
| `src/App.tsx` or Skedulosa layout | Modified — mount `useYtdlpRecovery` hook |
