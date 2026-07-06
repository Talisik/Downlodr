# Auto-Update Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a new Downlodr version is available, the user can click "Download Now" to stream the NSIS installer to a temp folder with a progress bar, then click "Install & Restart" to launch it and quit the app automatically.

**Architecture:** Three backend IPC handlers (`download-update`, `cancel-download`, `install-update`) stream the GitHub release asset to `os.tmpdir()` using axios, emit progress/complete/error events, and spawn the installer detached before quitting. The renderer bridge exposes six new methods. `UpdateNotification.tsx` (app-update variant only) replaces its hardcoded `openExternalLink` call with a 3-state UI: idle → downloading (progress bar + cancel) → ready (Install & Restart).

**Tech Stack:** Electron IPC, Node.js `child_process.spawn`, axios (already in `package.json`), React useState/useEffect, Tailwind CSS

---

## File Map

| File | Change |
|---|---|
| `src/core-app/ipc/main/appInfoHandler.ts` | Add `download-update`, `cancel-download`, `install-update` handlers + axios/spawn imports |
| `src/core-app/ipc/renderer/updateHandler.ts` | Add 6 new methods to the `updateFunctionsBridge` contextBridge object |
| `src/global.d.ts` | Add 6 new method signatures to the `updateFunctionsBridge` type block (line ~256) |
| `src/core-app/components/notification/UpdateNotification.tsx` | Add download state, progress listeners, progress bar UI, cancel, and Install & Restart |

> `src/core-app/components/updateNotification/UpdateNotifications.tsx` (plugin updates) is **not touched**.
> `src/core-app/ipc/composeWindowApi.ts` is **not touched** — `UpdateNotification.tsx` calls `window.updateFunctionsBridge` directly.

---

## Task 1: Main-process IPC handlers

**Files:**
- Modify: `src/core-app/ipc/main/appInfoHandler.ts`

### Background

`appInfoHandler.ts` already handles `check-for-updates` and `get-current-version`. We add three new handlers below the existing ones. A module-level `AbortController` variable lets the cancel handler abort an in-flight download.

`axios` is already in `package.json` but not imported here. `existsSync` is already imported from `fs`; we add `createWriteStream` to that same import. `unlink` comes from `fs/promises`. `spawn` comes from `child_process`.

- [ ] **Step 1: Update imports at top of `appInfoHandler.ts`**

Replace the existing import block (lines 1–5):

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn } from 'child_process';
import { createWriteStream, existsSync } from 'fs';
import { unlink } from 'fs/promises';
import os from 'os';
import path from 'path';
import axios from 'axios';
import { checkForUpdates } from '../../hook/updateCheckerHook';
```

- [ ] **Step 2: Add module-level AbortController variable**

Directly after the import block and before `export function getBundledBinaryPath`, add:

```typescript
let downloadAbortController: AbortController | null = null;
```

- [ ] **Step 3: Add the `download-update` handler inside `appInfoHandler()`**

Add after the `ipcMain.handle('get-current-version', ...)` block (around line 116), still inside the `appInfoHandler` function body:

```typescript
  ipcMain.handle('download-update', async (_event, downloadUrl: string) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    const destPath = path.join(os.tmpdir(), 'downlodr-update.exe');

    downloadAbortController = new AbortController();

    try {
      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
        signal: downloadAbortController.signal,
      });

      const total = parseInt(response.headers['content-length'] || '0', 10);
      let transferred = 0;

      await new Promise<void>((resolve, reject) => {
        const writer = createWriteStream(destPath);

        response.data.on('data', (chunk: Buffer) => {
          transferred += chunk.length;
          const percent = total > 0 ? Math.round((transferred / total) * 100) : 0;
          mainWindow?.webContents.send('download-progress', { percent, transferred, total });
        });

        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
        response.data.on('error', reject);
      });

      mainWindow?.webContents.send('download-complete', { filePath: destPath });
      return { success: true, filePath: destPath };
    } catch (error: any) {
      try { await unlink(destPath); } catch { /* partial file may not exist */ }

      const isCancelled =
        error.name === 'CanceledError' ||
        error.code === 'ERR_CANCELED' ||
        error.message?.includes('canceled');

      const message = isCancelled ? 'Download cancelled' : (error.message || 'Download failed');
      mainWindow?.webContents.send('download-error', { error: message });
      return { success: false, error: message };
    } finally {
      downloadAbortController = null;
    }
  });
```

- [ ] **Step 4: Add the `cancel-download` handler**

Immediately after the `download-update` block:

```typescript
  ipcMain.handle('cancel-download', async () => {
    downloadAbortController?.abort();
  });
```

- [ ] **Step 5: Add the `install-update` handler**

Immediately after the `cancel-download` block:

```typescript
  ipcMain.handle('install-update', async (_event, filePath: string) => {
    if (!existsSync(filePath)) {
      return { success: false, error: 'Installer file not found' };
    }

    const child = spawn(filePath, [], { detached: true, stdio: 'ignore' });
    child.unref();
    app.quit();
    return { success: true };
  });
```

- [ ] **Step 6: Commit**

```bash
git add src/core-app/ipc/main/appInfoHandler.ts
git commit -m "feat: add download-update, cancel-download, install-update IPC handlers"
```

---

## Task 2: Renderer bridge methods

**Files:**
- Modify: `src/core-app/ipc/renderer/updateHandler.ts`

### Background

The bridge follows the same pattern as existing listeners: wrap the callback with a `_event` prefix param, register with `ipcRenderer.on`, return a cleanup function. Invoke-style methods just call `ipcRenderer.invoke`.

- [ ] **Step 1: Replace the full file contents**

`src/core-app/ipc/renderer/updateHandler.ts` — full replacement:

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('updateFunctionsBridge', {
  onUpdateAvailable: (callback: any) => {
    const wrappedCallback = (_: any, updateInfo: any) => callback(updateInfo);
    ipcRenderer.on('update-available', wrappedCallback);
    return () => ipcRenderer.removeListener('update-available', wrappedCallback);
  },
  onYtdlpAutoUpdated: (callback: any) => {
    const wrappedCallback = (_: any, updateInfo: any) => callback(updateInfo);
    ipcRenderer.on('ytdlp-auto-updated', wrappedCallback);
    return () => ipcRenderer.removeListener('ytdlp-auto-updated', wrappedCallback);
  },
  onYtdlpAutoInstalled: (callback: any) => {
    const wrappedCallback = (_: any, installInfo: any) => callback(installInfo);
    ipcRenderer.on('ytdlp-auto-installed', wrappedCallback);
    return () => ipcRenderer.removeListener('ytdlp-auto-installed', wrappedCallback);
  },
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getCurrentVersion: () => ipcRenderer.invoke('get-current-version'),

  // --- Auto-update download/install ---
  downloadUpdate: (url: string) => ipcRenderer.invoke('download-update', url),
  cancelDownload: () => ipcRenderer.invoke('cancel-download'),
  onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => {
    const wrapped = (_: any, progress: any) => callback(progress);
    ipcRenderer.on('download-progress', wrapped);
    return () => ipcRenderer.removeListener('download-progress', wrapped);
  },
  onDownloadComplete: (callback: (info: { filePath: string }) => void) => {
    const wrapped = (_: any, info: any) => callback(info);
    ipcRenderer.on('download-complete', wrapped);
    return () => ipcRenderer.removeListener('download-complete', wrapped);
  },
  onDownloadError: (callback: (info: { error: string }) => void) => {
    const wrapped = (_: any, info: any) => callback(info);
    ipcRenderer.on('download-error', wrapped);
    return () => ipcRenderer.removeListener('download-error', wrapped);
  },
  installUpdate: (filePath: string) => ipcRenderer.invoke('install-update', filePath),
});
```

- [ ] **Step 2: Commit**

```bash
git add src/core-app/ipc/renderer/updateHandler.ts
git commit -m "feat: expose download/install update methods on updateFunctionsBridge"
```

---

## Task 3: Type declarations

**Files:**
- Modify: `src/global.d.ts` (around line 256)

### Background

The `updateFunctionsBridge` block currently ends at `getCurrentVersion`. Extend it with the 6 new method signatures. The `updateAPI` alias block (around line 358) is left as-is since the component uses `updateFunctionsBridge` directly.

- [ ] **Step 1: Extend the `updateFunctionsBridge` type**

Find this block in `src/global.d.ts` (around line 255–262):

```typescript
    /** App/YT-DLP updates (updateHandler) */
    updateFunctionsBridge: {
      onUpdateAvailable: (callback: (updateInfo: UpdateInfo) => void) => () => void;
      onYtdlpAutoUpdated: (callback: (updateInfo: { fromVersion: string; toVersion: string; message: string }) => void) => () => void;
      onYtdlpAutoInstalled: (callback: (installInfo: { version: string; message: string }) => void) => () => void;
      checkForUpdates: () => Promise<UpdateInfo>;
      getCurrentVersion: () => Promise<string>;
    };
```

Replace it with:

```typescript
    /** App/YT-DLP updates (updateHandler) */
    updateFunctionsBridge: {
      onUpdateAvailable: (callback: (updateInfo: UpdateInfo) => void) => () => void;
      onYtdlpAutoUpdated: (callback: (updateInfo: { fromVersion: string; toVersion: string; message: string }) => void) => () => void;
      onYtdlpAutoInstalled: (callback: (installInfo: { version: string; message: string }) => void) => () => void;
      checkForUpdates: () => Promise<UpdateInfo>;
      getCurrentVersion: () => Promise<string>;
      downloadUpdate: (url: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      cancelDownload: () => Promise<void>;
      onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => () => void;
      onDownloadComplete: (callback: (info: { filePath: string }) => void) => () => void;
      onDownloadError: (callback: (info: { error: string }) => void) => () => void;
      installUpdate: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    };
```

- [ ] **Step 2: Commit**

```bash
git add src/global.d.ts
git commit -m "feat: add download/install update type declarations to updateFunctionsBridge"
```

---

## Task 4: Update notification UI

**Files:**
- Modify: `src/core-app/components/notification/UpdateNotification.tsx`

### Background

This component (`App.tsx` imports it) handles app-update notifications. Its `handleDownload` currently calls `window.downlodrFunctions.openExternalLink('https://downlodr.com/downloads/')` — a hardcoded URL that doesn't use `updateInfo.downloadUrl`. We replace this with the download flow and add 3 UI states.

The plugin-update component (`updateNotification/UpdateNotifications.tsx`) is identical but **not touched**.

- [ ] **Step 1: Add download state types and state variables**

After the existing `const [dontShowAgain, setDontShowAgain] = useState(false);` line (around line 40), add:

```typescript
  type DownloadState = 'idle' | 'downloading' | 'ready' | 'error';
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [downloadProgress, setDownloadProgress] = useState<{
    percent: number;
    transferred: number;
    total: number;
  } | null>(null);
  const [downloadedFilePath, setDownloadedFilePath] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
```

- [ ] **Step 2: Add download listener useEffect**

After the existing second `useEffect` block (the one that handles `externalIsOpen` changes, ending around line 81), add a new one:

```typescript
  useEffect(() => {
    if (updateType !== 'app') return;

    const removeProgress = window.updateFunctionsBridge.onDownloadProgress((progress) => {
      setDownloadProgress(progress);
      setDownloadState('downloading');
    });
    const removeComplete = window.updateFunctionsBridge.onDownloadComplete((info) => {
      setDownloadedFilePath(info.filePath);
      setDownloadState('ready');
    });
    const removeError = window.updateFunctionsBridge.onDownloadError((info) => {
      setDownloadError(info.error);
      setDownloadState('error');
    });

    return () => {
      removeProgress();
      removeComplete();
      removeError();
    };
  }, [updateType]);
```

- [ ] **Step 3: Replace `handleDownload` and add `handleCancel` / `handleInstall`**

Find the existing `handleDownload` function (around lines 100–111):

```typescript
  const handleDownload = async () => {
    if (updateType === 'plugin' && onUpdate) {
      // For plugin updates, call the provided update handler
      onUpdate();
    } else if (updateType === 'app' && updateInfo?.downloadUrl) {
      // For app updates, open the download link
      await window.downlodrFunctions.openExternalLink(
        'https://downlodr.com/downloads/',
      );
    }
    handleClose();
  };
```

Replace it with:

```typescript
  const handleDownload = async () => {
    if (updateType === 'plugin' && onUpdate) {
      onUpdate();
      handleClose();
    } else if (updateType === 'app' && updateInfo?.downloadUrl) {
      setDownloadState('downloading');
      setDownloadError(null);
      await window.updateFunctionsBridge.downloadUpdate(updateInfo.downloadUrl);
    }
  };

  const handleCancel = async () => {
    await window.updateFunctionsBridge.cancelDownload();
    setDownloadState('idle');
    setDownloadProgress(null);
  };

  const handleInstall = async () => {
    if (downloadedFilePath) {
      await window.updateFunctionsBridge.installUpdate(downloadedFilePath);
    }
  };
```

- [ ] **Step 4: Replace the `AlertDialogFooter` block**

Find the `<AlertDialogFooter ...>` block (lines 196–216):

```tsx
        <AlertDialogFooter className="flex items-center justify-end gap-2 py-1">
          <AlertDialogCancel asChild>
            <Button
              variant="default"
              size="sm"
              className="h-7 px-4 py-4.8 text-sm text-black dark:bg-darkModeDropdown text-sm dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
              onClick={handleClose}
            >
              Later
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              onClick={handleDownload}
              size="sm"
              className="h-7 px-4 py-4.8 text-sm dark:bg-primary dark:text-white bg-primary text-sm text-white hover:bg-primary/90 dark:hover:bg-primary/90 dark:hover:text-white"
            >
              {getDownloadButtonText()}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
```

Replace it with:

```tsx
        <AlertDialogFooter className="flex items-center justify-end gap-2 py-1 w-full">
          {/* State 1: idle — show Later + Download Now */}
          {downloadState === 'idle' && (
            <>
              <AlertDialogCancel asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 px-4 py-4.8 text-sm text-black dark:bg-darkModeDropdown dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
                  onClick={handleClose}
                >
                  Later
                </Button>
              </AlertDialogCancel>
              <Button
                onClick={handleDownload}
                size="sm"
                disabled={!updateInfo?.downloadUrl}
                className="h-7 px-4 py-4.8 text-sm dark:bg-primary dark:text-white bg-primary text-white hover:bg-primary/90 dark:hover:bg-primary/90 dark:hover:text-white disabled:opacity-50"
              >
                {getDownloadButtonText()}
              </Button>
            </>
          )}

          {/* State 2: downloading — show progress bar + cancel */}
          {downloadState === 'downloading' && (
            <div className="w-full flex flex-col gap-2">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Downloading update...</span>
                <span>{downloadProgress?.percent ?? 0}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-darkMode rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-200"
                  style={{ width: `${downloadProgress?.percent ?? 0}%` }}
                />
              </div>
              {downloadProgress && downloadProgress.total > 0 && (
                <span className="text-xs text-gray-400 text-right">
                  {(downloadProgress.transferred / 1024 / 1024).toFixed(1)} MB / {(downloadProgress.total / 1024 / 1024).toFixed(1)} MB
                </span>
              )}
              <div className="flex justify-end">
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 px-4 text-sm text-black dark:bg-darkModeDropdown dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* State 3: ready — show Later + Install & Restart */}
          {downloadState === 'ready' && (
            <>
              <span className="text-xs text-gray-500 dark:text-gray-400 mr-auto">
                Ready to install.
              </span>
              <AlertDialogCancel asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 px-4 py-4.8 text-sm text-black dark:bg-darkModeDropdown dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
                  onClick={handleClose}
                >
                  Later
                </Button>
              </AlertDialogCancel>
              <Button
                onClick={handleInstall}
                size="sm"
                className="h-7 px-4 py-4.8 text-sm bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white dark:hover:bg-primary/90"
              >
                Install &amp; Restart
              </Button>
            </>
          )}

          {/* State: error — show error message + Try Again */}
          {downloadState === 'error' && (
            <div className="w-full flex flex-col gap-2">
              <span className="text-xs text-red-500 dark:text-red-400">
                {downloadError || 'Download failed. Please try again.'}
              </span>
              <div className="flex justify-end gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 px-4 text-sm text-black dark:bg-darkModeDropdown dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
                  onClick={handleClose}
                >
                  Later
                </Button>
                <Button
                  onClick={handleDownload}
                  size="sm"
                  className="h-7 px-4 text-sm bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-white"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </AlertDialogFooter>
```

- [ ] **Step 5: Commit**

```bash
git add src/core-app/components/notification/UpdateNotification.tsx
git commit -m "feat: replace hardcoded download link with in-app auto-update flow"
```

---

## Manual Verification

No automated test suite exists in this project. Verify the feature manually:

**Setup:** You need a GitHub release asset URL to test with. You can temporarily hardcode any large `.exe` URL in `updateCheckerHook.ts` → `downloadUrl` to simulate a real update, or trigger the notification by temporarily lowering the `semver.gt` check.

1. Run `npm start` (or `electron-forge start`)
2. Trigger the update dialog (either wait for startup check or call `window.updateFunctionsBridge.checkForUpdates()` from DevTools)
3. **Idle state:** Dialog shows "Download Now" button — verify it's disabled if `downloadUrl` is empty
4. **Downloading state:** Click "Download Now" → progress bar appears, percentage increments, MB counter updates
5. **Cancel:** Click "Cancel" during download → bar disappears, UI resets to idle, no `.exe` left in `%TEMP%\downlodr-update.exe`
6. **Ready state:** Let download complete → "Ready to install." text appears with "Install & Restart"
7. **Install:** Click "Install & Restart" → app closes, NSIS installer launches
8. **Error state:** Temporarily pass an invalid URL to `downloadUpdate` → error message shown with "Try Again"
9. Confirm plugin update dialog (`PluginPage.tsx`) still works unchanged

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| `download-update` handler, axios stream, progress events | Task 1 step 3 |
| `cancel-download` aborts + deletes partial file | Task 1 steps 3–4 |
| `install-update` spawns detached + app.quit | Task 1 step 5 |
| 6 new bridge methods on `updateFunctionsBridge` | Task 2 |
| Type declarations for 6 new methods | Task 3 |
| Replace hardcoded `openExternalLink` with `downloadUpdate` | Task 4 step 3 |
| Idle / Downloading / Ready / Error UI states | Task 4 step 4 |
| Progress bar with % and MB counter | Task 4 step 4 |
| Cancel resets to idle | Task 4 steps 3–4 |
| "Install & Restart" calls `installUpdate` | Task 4 steps 3–4 |
| "Download Now" disabled when `downloadUrl` falsy | Task 4 step 4 |
| Plugin update component untouched | File map note |
