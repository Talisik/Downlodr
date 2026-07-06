# Auto-Update Installer Design

**Date:** 2026-06-03  
**Status:** Approved

## Summary

Replace the current "Download Now" button in `UpdateNotification.tsx` (app updates) with an in-app download + install flow. When a new version is available, the user clicks "Download Now", watches a progress bar, then clicks "Install & Restart" to close the app and launch the NSIS installer automatically.

---

## Architecture

### Data Flow

```
User clicks "Download Now"
  → renderer: window.updateFunctionsBridge.downloadUpdate(downloadUrl)
  → main: 'download-update' IPC handler streams .exe to os.tmpdir()
  → main emits 'download-progress' { percent, transferred, total }
  → renderer: shows progress bar
  → main emits 'download-complete' { filePath }
  → renderer: shows "Install & Restart" button
  → user clicks "Install & Restart"
  → renderer: window.updateFunctionsBridge.installUpdate(filePath)
  → main: 'install-update' IPC handler spawns .exe (detached) then app.quit()
  → Windows runs the NSIS installer, Downlodr closes
```

### Files Changed

| File | Change |
|---|---|
| `src/core-app/ipc/main/appInfoHandler.ts` | Add `download-update`, `cancel-download`, and `install-update` IPC handlers |
| `src/core-app/ipc/renderer/updateHandler.ts` | Add `downloadUpdate`, `cancelDownload`, `onDownloadProgress`, `onDownloadComplete`, `onDownloadError`, `installUpdate` to the bridge |
| `src/global.d.ts` | Add types for the 6 new bridge methods on `updateFunctionsBridge` |
| `src/core-app/components/notification/UpdateNotification.tsx` | Replace "Download Now" button with 3-state download flow UI |

`src/core-app/components/updateNotification/UpdateNotifications.tsx` (plugin updates) is **not changed**.

---

## Main Process — `appInfoHandler.ts`

### `download-update` handler

- **Note:** `axios` must be imported at the top of `appInfoHandler.ts` — it is not currently imported there (`axios` is already in `package.json` as a dependency, just not imported in this file).
- Accepts `downloadUrl: string`
- Downloads to `path.join(os.tmpdir(), 'downlodr-update.exe')` using `axios` with `responseType: 'stream'`
- Reads `Content-Length` response header for total size
- Emits `download-progress` events to the main window on each data chunk: `{ percent: number, transferred: number, total: number }`
- On stream finish: emits `download-complete` with `{ filePath: string }`
- On stream error or cancellation: emits `download-error` with `{ error: string }` and deletes the partial file
- Uses an `AbortController` stored in module scope so `cancel-download` can abort it

### `cancel-download` handler

- Calls `abort()` on the active `AbortController`
- Deletes the partial temp file if it exists

### `install-update` handler

- Accepts `filePath: string`
- Validates the file exists before proceeding
- Runs: `child_process.spawn(filePath, [], { detached: true, stdio: 'ignore' }).unref()`
- Calls `app.quit()` immediately after spawning

---

## Renderer Bridge — `updateHandler.ts`

Six new methods added to `contextBridge.exposeInMainWorld('updateFunctionsBridge', {...})`:

```ts
downloadUpdate: (url: string) => ipcRenderer.invoke('download-update', url)
cancelDownload: () => ipcRenderer.invoke('cancel-download')
onDownloadProgress: (callback) => { /* ipcRenderer.on('download-progress', ...) */ }
onDownloadComplete: (callback) => { /* ipcRenderer.on('download-complete', ...) */ }
onDownloadError: (callback) => { /* ipcRenderer.on('download-error', ...) */ }
installUpdate: (filePath: string) => ipcRenderer.invoke('install-update', filePath)
```

Each `on*` method follows the existing pattern: wraps callback, registers listener, returns a cleanup function.

---

## UI — `UpdateNotification.tsx` (app updates only)

### New State

```ts
type DownloadState = 'idle' | 'downloading' | 'ready' | 'error';

downloadState: DownloadState            // default: 'idle'
downloadProgress: {
  percent: number,
  transferred: number,
  total: number
} | null
downloadedFilePath: string | null
downloadError: string | null
```

### State 1 — Idle (default)

Footer shows:
```
[ Later ]   [ Download Now ]
```

### State 2 — Downloading

Footer shows:
```
Downloading update...  47%
[████████████░░░░░░░░░░░░░]  23.4 MB / 49.8 MB
                             [ Cancel ]
```
- Progress bar uses a standard HTML range or a simple div with width % 
- Shows `percent%` and `transferred MB / total MB`
- Cancel button calls `cancelDownload()` and resets `downloadState` to `'idle'`

### State 3 — Ready

Footer shows:
```
Update downloaded and ready to install.
[ Later ]   [ Install & Restart ]
```
- "Install & Restart" uses primary/green styling
- "Later" closes the dialog; `downloadedFilePath` is retained in component state so re-opening the dialog skips straight to State 3

### Error State

Shown inline below the progress bar area:
```
Download failed: <error message>. 
[ Try Again ]
```
- "Try Again" resets to State 1 (idle)

### Replacing the existing download action

The current `handleDownload` function calls `window.downlodrFunctions.openExternalLink('https://downlodr.com/downloads/')` — a hardcoded URL that bypasses `updateInfo.downloadUrl` entirely. This call is removed and replaced with `window.updateFunctionsBridge.downloadUpdate(updateInfo.downloadUrl)`. The "Download Now" button is disabled when `updateInfo.downloadUrl` is falsy.

### useEffect wiring

```ts
useEffect(() => {
  const removeProgress = window.updateFunctionsBridge.onDownloadProgress(...)
  const removeComplete = window.updateFunctionsBridge.onDownloadComplete(...)
  const removeError = window.updateFunctionsBridge.onDownloadError(...)
  return () => { removeProgress(); removeComplete(); removeError(); }
}, [])
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Network drops mid-download | `download-error` event fires, partial file deleted, UI shows "Try Again" |
| User cancels | `cancel-download` aborts stream, partial file deleted, UI resets to idle |
| File not found at install time | `install-update` handler returns error, UI shows message |
| Download URL is missing | "Download Now" button is disabled if `updateInfo.downloadUrl` is falsy |

---

## Out of Scope

- Delta/differential updates (full installer only)
- macOS / Linux support (Windows NSIS only for now)
- Auto-download without user action
- Persisting the downloaded file across app restarts
