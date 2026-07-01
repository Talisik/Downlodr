# yt-dlp Startup Auto-Update + AboutModal Version Display

**Date:** 2026-05-25
**Status:** Approved

---

## Problem

`ytdlp:checkAndUpdate` IPC handler exists and is fully wired through the bridge, but nothing ever calls it. yt-dlp never updates. The AboutModal shows the app version but not the yt-dlp version.

---

## Goal

1. Silently check and update yt-dlp once per app launch, in the background, without blocking the UI.
2. Display the current yt-dlp version in the AboutModal alongside the app version.

---

## Architecture

### 1. Extract reusable function — `ytdlpHandler.ts`

Pull the body of the `ytdlp:checkAndUpdate` IPC handler into an exported async function:

```ts
export async function runYtdlpCheckAndUpdate(): Promise<void>
```

The existing IPC handler delegates to this function. The startup trigger also calls it directly — no IPC round-trip, no duplication.

All errors are caught inside the function and logged to console. Nothing surfaces to the renderer.

### 2. Startup trigger — `registerHandlers.ts`

After `collect(ytdlpHandler(mainWindow))`, add one fire-and-forget call:

```ts
setTimeout(() => {
  runYtdlpCheckAndUpdate().catch(() => {});
}, 5000);
```

- **5-second delay** — lets the main window fully paint before any network activity starts.
- **Fire-and-forget** — the `Promise` is not awaited; startup is never blocked.
- **Runs once per launch** — no polling, no intervals.

### 3. AboutModal version display — `AboutModal.tsx`

Add `ytdlpVersion` state (defaults to `null`). In the existing `useEffect`, call `window.ytdlp.getCurrentVersion()` alongside the app version fetch. Display the yt-dlp version below the app version line.

If the call fails or returns no version, the yt-dlp version line is omitted silently — no error state shown to the user.

---

## Resource Impact

| Concern | Mitigation |
|---|---|
| GitHub API spam on fast relaunches | Existing 5-min cooldown + 30-min version cache in `githubHandler.ts` |
| Slow startup | 5-second deferred call; runs after window is visible |
| `getCurrentVersion()` cost | Runs `yt-dlp --version` locally once on modal open; near-instant |
| Memory | No intervals, no persistent state added |

---

## Error Handling

- **Startup update:** All errors caught inside `runYtdlpCheckAndUpdate()`, logged to console, never surfaced to renderer.
- **AboutModal version fetch:** Wrapped in try/catch; on failure, `ytdlpVersion` stays `null` and the line is not rendered.

---

## Files Changed

| File | Change |
|---|---|
| `src/core-app/ipc/main/ytdlpHandler.ts` | Extract `runYtdlpCheckAndUpdate()` as exported function; IPC handler delegates to it |
| `src/core-app/ipc/main/registerHandlers.ts` | Add deferred startup call after `ytdlpHandler` is registered |
| `src/downlodr/components/modal/custom/AboutModal.tsx` | Add `ytdlpVersion` state + `getCurrentVersion()` fetch + display |

---

## Out of Scope

- Toast or any visible notification when yt-dlp updates (user requested silent)
- Periodic background polling after startup
- Manual "check for updates" button
