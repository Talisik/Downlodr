# Fix: `registerIpcHandlers` Missing Cleanup Return

## Error

```
TypeError: Cannot destructure property 'cleanup' of 'registerIpcHandlers(...)' as it is undefined.
    at skedulosaHandler
    at registerMainIpcHandlers
```

## Root Cause

`registerIpcHandlers` in the `video-nemesis-toolkit` dist returns `void`. The app's
`skedulosaHandler.ts` destructures `{ cleanup }` from its return value, which crashes
because you can't destructure from `undefined`.

This fix **must be re-applied every time the `video-nemesis-toolkit` package is updated**,
since the update overwrites the patched dist files.

## Files to Patch

### 1. `src/skedulosa/backend/video-nemesis-toolkit/dist/ipc/register.js`

At the end of `registerIpcHandlers`, before the closing `}`, add the return value:

```js
    // ... existing handler registration loop above ...

    return {
        cleanup() {
            scraper.stop();
            downloadWorker.stop();
        },
    };
}
```

### 2. `src/skedulosa/backend/video-nemesis-toolkit/dist/ipc/register.d.ts`

Change the return type from `void` to `{ cleanup(): void }`:

```ts
// Before
export declare function registerIpcHandlers(ipcMain: IpcMain, options: IpcBridgeOptions, register?: RegisterIpcHandler): void;

// After
export declare function registerIpcHandlers(ipcMain: IpcMain, options: IpcBridgeOptions, register?: RegisterIpcHandler): { cleanup(): void };
```

## Why `scraper.stop()` and `downloadWorker.stop()`

Both `YouTubeChannelScraper` and `DownloadWorker` are created inside `registerIpcHandlers`
and each expose a `stop()` method. Both maintain an `activeProcesses` Set of live yt-dlp
child processes and call `proc.kill('SIGKILL')` on each when stopped. On Windows, child
processes are not automatically killed when the parent exits, so both are needed to prevent
orphaned yt-dlp instances in Task Manager after the app closes.

## Long-Term Fix

The correct fix is to update the `video-nemesis-toolkit` source to return `{ cleanup }` from
`registerIpcHandlers`, then rebuild the package so the patch survives future updates.
