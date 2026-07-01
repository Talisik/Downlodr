# Addon Background Download + Cancel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users close the addon manager modal while a download runs in the background, show a persistent progress toast, and cancel an in-progress download from both the modal and the toast.

**Architecture:** Cancel support is wired all the way from a new `addon:cancel` IPC handler (which destroys the active HTTP `ClientRequest`) through the preload bridge and into a new `cancelDownload` store action. A new `GlobalAddonDownloadToast` component mirrors the existing `GlobalScanningModal` pattern — it watches the `addonStore` and shows a live-updating persistent toast whenever a pack is downloading and the modal is closed.

**Tech Stack:** Electron IPC (Node `http`/`https`), React, Zustand, Shadcn Toast

---

## File Map

| File | Action | Change |
|---|---|---|
| `src/core-app/ipc/main/addonManager.ts` | Modify | Add `activeDownloads` map + `cancelledPacks` set; refactor `downloadToFile` to capture `ClientRequest`; add `addon:cancel` handler |
| `src/core-app/ipc/renderer/addonHandler.ts` | Modify | Expose `cancel(pack)` on `addonBridge` |
| `src/global.d.ts` | Modify | Add `cancel` to `addonBridge` type |
| `src/core-app/store/addonStore.ts` | Modify | Add `isAddonManagerOpen`, `setAddonManagerOpen`, `cancelDownload` |
| `src/downlodr/components/base/Taskbar.tsx` | Modify | Sync `showAddonModal` → `isAddonManagerOpen` in store |
| `src/downlodr/components/modal/custom/AddonManagerModal.tsx` | Modify | Add `onRunInBackground` prop to `AddonCard`; add Cancel + Run in background buttons |
| `src/core-app/components/GlobalAddonDownloadToast.tsx` | Create | Persistent toast with live progress + Cancel; only shown when modal is closed |
| `src/App.tsx` | Modify | Mount `GlobalAddonDownloadToast` |

---

## Task 1: Main process — cancel support

**Files:**
- Modify: `src/core-app/ipc/main/addonManager.ts`

- [ ] **Step 1: Add module-level cancel state**

After the `EXPECTED_VERSIONS` constant (around line 18), add:

```typescript
// Maps pack → a function that destroys its current HTTP request
const activeDownloads = new Map<PackName, () => void>();
// Tracks packs that were explicitly cancelled (so realDownload's catch doesn't re-send complete)
const cancelledPacks = new Set<PackName>();
```

- [ ] **Step 2: Refactor `downloadToFile` to accept `onRequestReady`**

Replace the existing `downloadToFile` function entirely with this version (the only structural change is capturing the `ClientRequest` returned by `client.get` and calling `onRequestReady` with a cancel function):

```typescript
function downloadToFile(
  url: string,
  destPath: string,
  onProgress: (percent: number) => void,
  onRequestReady: (cancelFn: () => void) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const attempt = (targetUrl: string) => {
      const client = targetUrl.startsWith('https') ? https : http;
      const req = client.get(targetUrl, (response) => {
        if (
          response.statusCode === 301 ||
          response.statusCode === 302 ||
          response.statusCode === 303 ||
          response.statusCode === 307 ||
          response.statusCode === 308
        ) {
          const location = response.headers.location;
          if (!location)
            return reject(new Error('Redirect with no Location header'));
          response.resume();
          return attempt(location);
        }
        if (response.statusCode !== 200) {
          response.resume();
          return reject(
            new Error(`HTTP ${response.statusCode} from ${targetUrl}`),
          );
        }

        const contentType = response.headers['content-type'] ?? '';

        if (contentType.includes('text/html')) {
          let html = '';
          response.on('data', (chunk: Buffer) => {
            html += chunk.toString();
          });
          response.on('end', () => {
            const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/);
            const idMatch = targetUrl.match(/[?&]id=([^&]+)/);
            if (uuidMatch && idMatch) {
              const confirmUrl = `https://drive.usercontent.google.com/download?id=${idMatch[1]}&export=download&confirm=t&uuid=${uuidMatch[1]}`;
              console.log(
                '[addonManager] Google Drive confirm page detected, retrying with uuid token',
              );
              attempt(confirmUrl);
            } else {
              reject(
                new Error(
                  'Google Drive returned an HTML page but could not find confirm token. Check that the file is shared publicly.',
                ),
              );
            }
          });
          return;
        }

        const total = parseInt(response.headers['content-length'] ?? '0', 10);
        const estimatedSize = 80 * 1024 * 1024;
        let downloaded = 0;

        const out = fs.createWriteStream(destPath);
        response.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          const percent =
            total > 0
              ? Math.round((downloaded / total) * 100)
              : Math.min(99, Math.round((downloaded / estimatedSize) * 100));
          onProgress(percent);
        });
        response.pipe(out);
        out.on('finish', () => {
          out.close();
          resolve();
        });
        out.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      });
      // Register the cancel function for the most recent request (updated on each redirect hop)
      onRequestReady(() => req.destroy(new Error('Cancelled')));
      req.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };
    attempt(url);
  });
}
```

- [ ] **Step 3: Update `realDownload` to register in `activeDownloads` and guard cancellation**

Replace the existing `realDownload` function with this version:

```typescript
async function realDownload(
  packName: PackName,
  mainWindow: BrowserWindow,
): Promise<void> {
  const config = loadAddonsConfig();
  const packConfig = config[packName];
  if (!packConfig) {
    mainWindow.webContents.send('addon:complete', {
      pack: packName,
      success: false,
      error: `No config found for ${packName}`,
    });
    return;
  }

  const userDataPath = app.getPath('userData');
  const tempDir = path.join(userDataPath, 'temp');
  const tempZip = path.join(tempDir, `${packName}.zip`);
  const destDir = path.join(userDataPath, 'downlodr-add-ons', packName);

  fs.mkdirSync(tempDir, { recursive: true });
  if (fs.existsSync(destDir))
    fs.rmSync(destDir, { recursive: true, force: true });

  // Placeholder; updated to the real cancel fn as soon as the first request is created
  activeDownloads.set(packName, () => {});

  try {
    await downloadToFile(
      packConfig.downloadUrl,
      tempZip,
      (percent) => {
        mainWindow.webContents.send('addon:progress', {
          pack: packName,
          percent,
        });
      },
      (cancelFn) => {
        activeDownloads.set(packName, cancelFn);
      },
    );

    await extractZip(tempZip, destDir);
    normalizeExtractedDir(destDir);
    patchNativeBinaries(destDir);

    fs.unlinkSync(tempZip);

    mainWindow.webContents.send('addon:complete', {
      pack: packName,
      success: true,
    });
  } catch (err) {
    if (cancelledPacks.has(packName)) {
      // Cancel handler already sent addon:complete — just clean up partial files
      cancelledPacks.delete(packName);
      try { fs.unlinkSync(tempZip); } catch { /* already gone */ }
      try { fs.rmSync(destDir, { recursive: true, force: true }); } catch { /* partial */ }
      return;
    }
    console.error(`[addonManager] download failed for ${packName}:`, err);
    try {
      fs.unlinkSync(tempZip);
    } catch {
      /* already gone */
    }
    try {
      fs.rmSync(destDir, { recursive: true, force: true });
    } catch {
      /* partial extraction */
    }
    mainWindow.webContents.send('addon:complete', {
      pack: packName,
      success: false,
      error: String(err),
    });
  } finally {
    activeDownloads.delete(packName);
  }
}
```

- [ ] **Step 4: Add the `addon:cancel` IPC handler inside `addonManagerHandler`**

Inside the `addonManagerHandler` function, after the `openFolderHandler` declaration and before the `void` lines, add:

```typescript
  const cancelHandler = ipcMain.handle(
    'addon:cancel',
    (_event, { pack }: { pack: PackName }) => {
      const cancelFn = activeDownloads.get(pack);
      if (cancelFn) {
        cancelledPacks.add(pack);
        cancelFn();
        mainWindow.webContents.send('addon:complete', {
          pack,
          success: false,
          error: 'Cancelled',
        });
      }
    },
  );
  void cancelHandler;
```

- [ ] **Step 5: Add `addon:cancel` to the cleanup in the return statement**

The existing return at the bottom of `addonManagerHandler` is:

```typescript
  return () => {
    ipcMain.removeHandler('addon:status');
    ipcMain.removeHandler('addon:download');
    ipcMain.removeHandler('addon:restart');
    ipcMain.removeHandler('addon:delete');
    ipcMain.removeHandler('addon:openFolder');
  };
```

Add one line so it becomes:

```typescript
  return () => {
    ipcMain.removeHandler('addon:status');
    ipcMain.removeHandler('addon:download');
    ipcMain.removeHandler('addon:restart');
    ipcMain.removeHandler('addon:delete');
    ipcMain.removeHandler('addon:openFolder');
    ipcMain.removeHandler('addon:cancel');
  };
```

- [ ] **Step 6: Commit**

```bash
git add src/core-app/ipc/main/addonManager.ts
git commit -m "feat: add cancel support to addon download (main process)"
```

---

## Task 2: Preload bridge + TypeScript types

**Files:**
- Modify: `src/core-app/ipc/renderer/addonHandler.ts`
- Modify: `src/global.d.ts`

- [ ] **Step 1: Expose `cancel` on the preload bridge**

In `src/core-app/ipc/renderer/addonHandler.ts`, the current `contextBridge.exposeInMainWorld` call ends with:

```typescript
  openFolder: (pack: PackName) => ipcRenderer.invoke('addon:openFolder', { pack }),
```

Add `cancel` immediately after it (before the closing `}`):

```typescript
  cancel: (pack: PackName) => ipcRenderer.invoke('addon:cancel', { pack }),
```

- [ ] **Step 2: Add `cancel` to the `addonBridge` type in `global.d.ts`**

Find the `addonBridge` block in `src/global.d.ts` (around line 433). The current `openFolder` line is:

```typescript
      openFolder: (pack: 'afda-backend' | 'video-nemesis-toolkit') => Promise<{ success: boolean }>;
```

Add `cancel` on the next line:

```typescript
      cancel: (pack: 'afda-backend' | 'video-nemesis-toolkit') => Promise<void>;
```

- [ ] **Step 3: Commit**

```bash
git add src/core-app/ipc/renderer/addonHandler.ts src/global.d.ts
git commit -m "feat: expose cancel on addonBridge preload and types"
```

---

## Task 3: Store additions

**Files:**
- Modify: `src/core-app/store/addonStore.ts`

- [ ] **Step 1: Extend the `AddonStore` interface**

The current `interface AddonStore` block is:

```typescript
interface AddonStore {
  afda: AddonPackState;
  skedulosa: AddonPackState;
  needsRestart: boolean;
  setPackState: (pack: PackName, state: Partial<AddonPackState>) => void;
  initFromMain: () => Promise<void>;
}
```

Replace it with:

```typescript
interface AddonStore {
  afda: AddonPackState;
  skedulosa: AddonPackState;
  needsRestart: boolean;
  isAddonManagerOpen: boolean;
  setPackState: (pack: PackName, state: Partial<AddonPackState>) => void;
  setAddonManagerOpen: (open: boolean) => void;
  cancelDownload: (pack: PackName) => void;
  initFromMain: () => Promise<void>;
}
```

- [ ] **Step 2: Add implementations inside `create<AddonStore>`**

Replace the exact block below (from the `export const` line through the closing `}),` of `setPackState`):

```typescript
export const useAddonStore = create<AddonStore>((set) => ({
  afda: DEFAULT_STATE,
  skedulosa: DEFAULT_STATE,
  needsRestart: false,

  setPackState: (pack, state) =>
    set((s) => {
      const key = pack === 'afda-backend' ? 'afda' : 'skedulosa';
      return { [key]: { ...s[key], ...state } };
    }),
```

With this (adds `isAddonManagerOpen`, new actions, keeps `setPackState`):

```typescript
export const useAddonStore = create<AddonStore>((set) => ({
  afda: DEFAULT_STATE,
  skedulosa: DEFAULT_STATE,
  needsRestart: false,
  isAddonManagerOpen: false,

  setPackState: (pack, state) =>
    set((s) => {
      const key = pack === 'afda-backend' ? 'afda' : 'skedulosa';
      return { [key]: { ...s[key], ...state } };
    }),

  setAddonManagerOpen: (open) => set({ isAddonManagerOpen: open }),

  cancelDownload: (pack) => {
    window.addonBridge?.cancel(pack);
    const key = pack === 'afda-backend' ? 'afda' : 'skedulosa';
    set((s) => ({
      [key]: { ...s[key], status: 'not-installed', progress: undefined },
    }));
  },
```

The `initFromMain` method that follows is unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/core-app/store/addonStore.ts
git commit -m "feat: add isAddonManagerOpen, setAddonManagerOpen, cancelDownload to addonStore"
```

---

## Task 4: Sync modal open state from Taskbar

**Files:**
- Modify: `src/downlodr/components/base/Taskbar.tsx`

- [ ] **Step 1: Import `useAddonStore`**

In `src/downlodr/components/base/Taskbar.tsx`, add this import after the existing store imports (e.g. after the `useSettingStore` import on line 19):

```typescript
import { useAddonStore } from '@/core-app/store/addonStore';
```

- [ ] **Step 2: Read `setAddonManagerOpen` from the store inside `TaskBar`**

Inside the `TaskBar` component body, after the existing state declarations, add:

```typescript
  const setAddonManagerOpen = useAddonStore((s) => s.setAddonManagerOpen);
```

- [ ] **Step 3: Sync `showAddonModal` to the store**

After reading `setAddonManagerOpen`, add:

```typescript
  useEffect(() => {
    setAddonManagerOpen(showAddonModal);
  }, [showAddonModal, setAddonManagerOpen]);
```

`useEffect` is already imported in Taskbar.tsx (line 32).

- [ ] **Step 4: Commit**

```bash
git add src/downlodr/components/base/Taskbar.tsx
git commit -m "feat: sync addon modal open state to addonStore"
```

---

## Task 5: AddonManagerModal — Cancel + Run in background buttons

**Files:**
- Modify: `src/downlodr/components/modal/custom/AddonManagerModal.tsx`

- [ ] **Step 1: Add `useAddonStore` import**

At the top of `AddonManagerModal.tsx`, add after the existing imports:

```typescript
import { useAddonStore } from '@/core-app/store/addonStore';
```

- [ ] **Step 2: Add `onRunInBackground` prop to the `AddonCard` function signature**

The current `AddonCard` signature is:

```typescript
function AddonCard({
  packName,
  label,
  description,
  size,
  state,
}: {
  packName: PackName;
  label: string;
  description: string;
  size: string;
  state: AddonPackState;
}) {
```

Replace it with:

```typescript
function AddonCard({
  packName,
  label,
  description,
  size,
  state,
  onRunInBackground,
}: {
  packName: PackName;
  label: string;
  description: string;
  size: string;
  state: AddonPackState;
  onRunInBackground: () => void;
}) {
```

- [ ] **Step 3: Replace the downloading section with Cancel + Run in background buttons**

The current `isDownloading` block at the bottom of `AddonCard` is:

```typescript
      {isDownloading && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-150"
              style={{ width: `${state.progress ?? 0}%` }}
            />
          </div>
          <span className="text-[11px] text-gray-400">
            {(state.progress ?? 0) >= 100
              ? 'Unzipping package…'
              : `${state.progress ?? 0}% — Downloading ${label}…`}
          </span>
        </div>
      )}
```

Replace it with:

```typescript
      {isDownloading && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-150"
              style={{ width: `${state.progress ?? 0}%` }}
            />
          </div>
          <span className="text-[11px] text-gray-400">
            {(state.progress ?? 0) >= 100
              ? 'Unzipping package…'
              : `${state.progress ?? 0}% — Downloading ${label}…`}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <button
              type="button"
              onClick={() =>
                useAddonStore.getState().cancelDownload(packName)
              }
              className="flex-1 px-2 py-1 rounded text-xs text-red-500 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onRunInBackground}
              className="flex-1 px-2 py-1 rounded text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              Run in background →
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Pass `onRunInBackground={onClose}` to both `AddonCard` instances**

In the `AddonManagerModal` render, the two `AddonCard` instances are:

```typescript
        <AddonCard
          packName="video-nemesis-toolkit"
          label="Subscription"
          description="YouTube channel scheduling and automated downloads."
          size="~78.6 MB"
          state={skedulosaState}
        />
        <AddonCard
          packName="afda-backend"
          label="AFDA"
          description="Article scraping and automated downloads for websites."
          size="~120 MB"
          state={afdaState}
        />
```

Replace them with:

```typescript
        <AddonCard
          packName="video-nemesis-toolkit"
          label="Subscription"
          description="YouTube channel scheduling and automated downloads."
          size="~78.6 MB"
          state={skedulosaState}
          onRunInBackground={onClose}
        />
        <AddonCard
          packName="afda-backend"
          label="AFDA"
          description="Article scraping and automated downloads for websites."
          size="~120 MB"
          state={afdaState}
          onRunInBackground={onClose}
        />
```

- [ ] **Step 5: Commit**

```bash
git add src/downlodr/components/modal/custom/AddonManagerModal.tsx
git commit -m "feat: add Cancel and Run in background buttons to AddonCard"
```

---

## Task 6: GlobalAddonDownloadToast component

**Files:**
- Create: `src/core-app/components/GlobalAddonDownloadToast.tsx`

- [ ] **Step 1: Create the file**

Create `src/core-app/components/GlobalAddonDownloadToast.tsx` with this content:

```typescript
import { useEffect, useRef } from 'react';
import { ToastAction } from '@/core-app/components/shadcn/components/ui/toast';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import {
  useAddonStore,
  type PackName,
  type AddonPackState,
} from '@/core-app/store/addonStore';

type ToastCtrl = ReturnType<typeof toast>;

function buildTitle(label: string, progress: number) {
  return (
    <span className="flex items-center gap-2 mr-3 mt-1 text-white font-normal">
      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0 inline-block" />
      Downloading {label} ({progress}%)…
    </span>
  );
}

function usePackDownloadToast(
  packName: PackName,
  label: string,
  state: AddonPackState,
  isAddonManagerOpen: boolean,
  cancelDownload: (pack: PackName) => void,
) {
  const toastCtrlRef = useRef<ToastCtrl | null>(null);

  useEffect(() => {
    const shouldShow = state.status === 'downloading' && !isAddonManagerOpen;
    const progress = state.progress ?? 0;

    if (shouldShow) {
      const action = (
        <ToastAction
          altText="Cancel"
          onClick={() => cancelDownload(packName)}
          className="shrink-0 rounded-md px-3 py-4 text-sm font-medium text-white bg-white/20 hover:bg-white/30 border-0 ring-0 focus:ring-0"
        >
          Cancel
        </ToastAction>
      );

      if (!toastCtrlRef.current) {
        toastCtrlRef.current = toast({
          variant: 'progress',
          title: buildTitle(label, progress),
          action,
          duration: Infinity,
          className: '[&>button]:text-white [&_[toast-close]]:hidden w-[377px]',
        });
      } else {
        toastCtrlRef.current.update({
          id: toastCtrlRef.current.id,
          variant: 'progress',
          title: buildTitle(label, progress),
          action,
          duration: Infinity,
          className: '[&>button]:text-white [&_[toast-close]]:hidden w-[377px]',
        });
      }
    } else {
      toastCtrlRef.current?.dismiss();
      toastCtrlRef.current = null;
    }
  }, [state.status, state.progress, isAddonManagerOpen]);
}

const GlobalAddonDownloadToast = () => {
  const afdaState = useAddonStore((s) => s.afda);
  const skedulosaState = useAddonStore((s) => s.skedulosa);
  const isAddonManagerOpen = useAddonStore((s) => s.isAddonManagerOpen);
  const cancelDownload = useAddonStore((s) => s.cancelDownload);

  usePackDownloadToast(
    'afda-backend',
    'AFDA',
    afdaState,
    isAddonManagerOpen,
    cancelDownload,
  );
  usePackDownloadToast(
    'video-nemesis-toolkit',
    'Subscription',
    skedulosaState,
    isAddonManagerOpen,
    cancelDownload,
  );

  return null;
};

export default GlobalAddonDownloadToast;
```

- [ ] **Step 2: Commit**

```bash
git add src/core-app/components/GlobalAddonDownloadToast.tsx
git commit -m "feat: add GlobalAddonDownloadToast component"
```

---

## Task 7: Mount GlobalAddonDownloadToast in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add import**

In `src/App.tsx`, add alongside the other global component imports (near `GlobalScanningModal`):

```typescript
import GlobalAddonDownloadToast from '@/core-app/components/GlobalAddonDownloadToast';
```

- [ ] **Step 2: Render the component**

Find the existing `<GlobalScanningModal />` line (line 334) and add `GlobalAddonDownloadToast` directly after it:

```tsx
          <GlobalScanningModal />
          <GlobalAddonDownloadToast />
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: mount GlobalAddonDownloadToast in App"
```

---

## Manual Testing Checklist

After all tasks are complete:

1. **Start a download** — open the addon manager, click Download on either pack. Verify the progress bar, Cancel button, and "Run in background →" button all appear.

2. **Cancel from modal** — click Cancel mid-download. The progress bar should disappear and the card should return to the "Download" button state.

3. **Run in background** — click "Run in background →". The modal closes. Verify a toast appears with the label, live progress %, and a Cancel button.

4. **Cancel from toast** — click Cancel in the toast. Toast should dismiss and re-opening the modal should show the pack in "not-installed" state.

5. **Download completes normally** — start a download, let it finish without cancelling. Toast should auto-dismiss on completion and the modal should show "✓ Installed" + the restart banner.

6. **Modal re-open hides toast** — while the toast is showing, re-open the addon manager. The toast should disappear while the modal is open. Closing the modal should not re-show the toast (download is still running — it should re-appear immediately).
