# Fix: Orphaned yt-dlp Processes on App Close

## Problem

On Windows, child processes spawned by the parent are **not automatically killed** when
the parent process exits. When the user closed the app mid-download, yt-dlp instances
stayed alive in Task Manager as orphaned processes.

## Root Cause

`ytdlpHandler` started yt-dlp downloads via `YTDLP.download()` but returned `void`,
giving the app's `before-quit` cleanup system nothing to call. Active controllers were
never explicitly killed on app close.

The `yt-dlp-helper` library tracks all live `Terminal` instances in an internal static
registry (`Terminal._all`), but exposes no public `killAll()` method — only
`getTerminalFromID(id)` for individual lookups.

## Fix (`src/core-app/ipc/main/ytdlpHandler.ts`)

- Changed return type from `void` to `() => void`.
- Added `activeControllerIds: Set<string>` to track in-flight downloads.
- On download start: `activeControllerIds.add(controller.id)`.
- On process completion (`handleProcessCompletion`): `activeControllerIds.delete(controller.id)`.
- Returned a cleanup function that iterates the set, calls `terminal.kill('SIGKILL')`
  on each, then clears the set.

The library's `kill()` uses `treeKill` on Windows, so this also catches any ffmpeg
sub-processes yt-dlp spawns during remux/conversion.

## How It Hooks In

`ytdlpHandler` is called by `registerMainIpcHandlers` via `collect()`, which pushes any
returned function into the `cleanups` array. `main.ts` calls `appCleanup.cleanup()` in
the Electron `before-quit` event, which runs all collected cleanup functions including
this one.

## Related

- `skedulosaHandler` has a similar gap for the toolkit's `DownloadWorker` and
  `YouTubeChannelScraper` — see `docs/video-nemesis-toolkit-cleanup-fix.md`.
  The skedulosa workers also use `SIGKILL` on their `activeProcesses` sets, but the
  cleanup is only wired up if the dist patch in that doc is applied.
