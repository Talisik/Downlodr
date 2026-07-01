# Add-on Manager Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add delete, re-download, and open-folder icon buttons to installed add-on cards in the Add-on Manager modal.

**Architecture:** Two new IPC channels (`addon:delete`, `addon:openFolder`) are added to the main process and exposed via the renderer bridge. Re-download reuses the existing `addon:download` channel. The UI adds a row of three `TooltipWrapper`-wrapped icon buttons (Trash2, RefreshCw, FolderOpen) to `AddonCard` when the add-on is `ready` or `outdated`.

**Tech Stack:** Electron (ipcMain, shell), React, Zustand, lucide-react, TooltipWrapper (shadcn/radix)

---

## File Map

| File | Change |
|------|--------|
| `src/core-app/ipc/main/addonManager.ts` | Add `addon:delete` + `addon:openFolder` handlers and teardown |
| `src/core-app/ipc/renderer/addonHandler.ts` | Expose `delete` + `openFolder` on `addonBridge` |
| `src/global.d.ts` | Add type signatures for the two new bridge methods |
| `src/downlodr/components/modal/custom/AddonManagerModal.tsx` | Add icon button row to `AddonCard` |

---

### Task 1: Add `addon:delete` and `addon:openFolder` IPC handlers

**Files:**
- Modify: `src/core-app/ipc/main/addonManager.ts`

- [ ] **Step 1: Add `shell` to the electron import**

  At line 1, the current import is:
  ```ts
  import { app, BrowserWindow, ipcMain } from 'electron';
  ```
  Change it to:
  ```ts
  import { app, BrowserWindow, ipcMain, shell } from 'electron';
  ```

- [ ] **Step 2: Add `addon:delete` handler inside `addonManagerHandler()`**

  Inside `addonManagerHandler()`, after the `restartHandler` block (around line 376), add:

  ```ts
  const deleteHandler = ipcMain.handle(
    'addon:delete',
    (_event, { pack }: { pack: PackName }) => {
      const userDataPath = app.getPath('userData');
      const addonPath = path.join(userDataPath, 'downlodr-add-ons', pack);
      try {
        if (fs.existsSync(addonPath)) {
          fs.rmSync(addonPath, { recursive: true, force: true });
        }
        return { success: true };
      } catch (err) {
        console.error(`[addonManager] delete failed for ${pack}:`, err);
        return { success: false, error: String(err) };
      }
    },
  );
  ```

- [ ] **Step 3: Add `addon:openFolder` handler inside `addonManagerHandler()`**

  Directly after the `deleteHandler` block, add:

  ```ts
  const openFolderHandler = ipcMain.handle(
    'addon:openFolder',
    async (_event, { pack }: { pack: PackName }) => {
      const userDataPath = app.getPath('userData');
      const addonPath = path.join(userDataPath, 'downlodr-add-ons', pack);
      if (!fs.existsSync(addonPath)) {
        return { success: false };
      }
      const result = await shell.openPath(addonPath);
      return { success: result === '' };
    },
  );
  ```

- [ ] **Step 4: Suppress unused-variable lint warnings**

  After the existing `void statusHandler; void downloadHandler; void restartHandler;` lines, add:

  ```ts
  void deleteHandler;
  void openFolderHandler;
  ```

- [ ] **Step 5: Add teardown for the two new handlers**

  The `addonManagerHandler` function returns a cleanup arrow function. Find the return block:
  ```ts
  return () => {
    ipcMain.removeHandler('addon:status');
    ipcMain.removeHandler('addon:download');
    ipcMain.removeHandler('addon:restart');
  };
  ```
  Update it to:
  ```ts
  return () => {
    ipcMain.removeHandler('addon:status');
    ipcMain.removeHandler('addon:download');
    ipcMain.removeHandler('addon:restart');
    ipcMain.removeHandler('addon:delete');
    ipcMain.removeHandler('addon:openFolder');
  };
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/core-app/ipc/main/addonManager.ts
  git commit -m "feat: add addon:delete and addon:openFolder IPC handlers"
  ```

---

### Task 2: Expose new methods on the renderer bridge

**Files:**
- Modify: `src/core-app/ipc/renderer/addonHandler.ts`

- [ ] **Step 1: Add `delete` and `openFolder` to the `addonBridge` exposure**

  The current file exposes:
  ```ts
  contextBridge.exposeInMainWorld('addonBridge', {
    getStatus: () => ipcRenderer.invoke('addon:status'),
    download: (pack: PackName) => ipcRenderer.invoke('addon:download', { pack }),
    restart: () => ipcRenderer.invoke('addon:restart'),
    on: { ... },
  });
  ```
  Add `delete` and `openFolder` after `restart`:
  ```ts
  contextBridge.exposeInMainWorld('addonBridge', {
    getStatus: () => ipcRenderer.invoke('addon:status'),
    download: (pack: PackName) => ipcRenderer.invoke('addon:download', { pack }),
    restart: () => ipcRenderer.invoke('addon:restart'),
    delete: (pack: PackName) => ipcRenderer.invoke('addon:delete', { pack }),
    openFolder: (pack: PackName) => ipcRenderer.invoke('addon:openFolder', { pack }),
    on: { ... },
  });
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/core-app/ipc/renderer/addonHandler.ts
  git commit -m "feat: expose delete and openFolder on addonBridge"
  ```

---

### Task 3: Update global type definitions

**Files:**
- Modify: `src/global.d.ts`

- [ ] **Step 1: Add `delete` and `openFolder` type signatures to `addonBridge`**

  Find the `addonBridge` block (around line 427):
  ```ts
  addonBridge: {
    getStatus: () => Promise<{ ... }>;
    download: (pack: 'afda-backend' | 'video-nemesis-toolkit') => Promise<{ started: boolean }>;
    on: { ... };
  };
  ```
  Add the two new methods after `download`:
  ```ts
  addonBridge: {
    getStatus: () => Promise<{
      afda: { status: string; installedVersion?: string; path: string | null };
      skedulosa: { status: string; installedVersion?: string; path: string | null };
    }>;
    download: (pack: 'afda-backend' | 'video-nemesis-toolkit') => Promise<{ started: boolean }>;
    delete: (pack: 'afda-backend' | 'video-nemesis-toolkit') => Promise<{ success: boolean; error?: string }>;
    openFolder: (pack: 'afda-backend' | 'video-nemesis-toolkit') => Promise<{ success: boolean }>;
    on: {
      progress: (cb: (data: { pack: 'afda-backend' | 'video-nemesis-toolkit'; percent: number }) => void) => () => void;
      complete: (cb: (data: { pack: 'afda-backend' | 'video-nemesis-toolkit'; success: boolean; error?: string }) => void) => () => void;
    };
  };
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/global.d.ts
  git commit -m "feat: add delete and openFolder types to addonBridge"
  ```

---

### Task 4: Add icon button row to AddonCard UI

**Files:**
- Modify: `src/downlodr/components/modal/custom/AddonManagerModal.tsx`

- [ ] **Step 1: Add imports**

  At the top of the file, add:
  ```tsx
  import { Trash2, RefreshCw, FolderOpen } from 'lucide-react';
  import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
  ```

- [ ] **Step 2: Add `handleDelete` and `handleOpenFolder` handlers inside `AddonCard`**

  The `AddonCard` function already has `handleDownload`. Add two more handlers alongside it:
  ```tsx
  const handleDelete = async () => {
    const result = await window.addonBridge?.delete(packName);
    if (result?.success) {
      useAddonStore
        .getState()
        .setPackState(packName, { status: 'not-installed' });
    }
  };

  const handleOpenFolder = () => {
    window.addonBridge?.openFolder(packName);
  };
  ```

- [ ] **Step 3: Add icon button row to the card JSX**

  Inside the `AddonCard` return, after the closing `</div>` of the header row (the `flex items-start justify-between` div) and before the `{isDownloading && ...}` block, add:

  ```tsx
  {(isReady || isOutdated) && (
    <div className="flex gap-1">
      <TooltipWrapper content="Delete add-on" side="top">
        <button
          type="button"
          onClick={handleDelete}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-red-500 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </TooltipWrapper>
      <TooltipWrapper content="Re-download add-on" side="top">
        <button
          type="button"
          onClick={handleDownload}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </TooltipWrapper>
      <TooltipWrapper content="Open folder" side="top">
        <button
          type="button"
          onClick={handleOpenFolder}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <FolderOpen size={14} />
        </button>
      </TooltipWrapper>
    </div>
  )}
  ```

- [ ] **Step 4: Verify the full updated `AddonCard` return JSX looks correct**

  The full card should now render:
  1. Header row (name + status badge + description + size + Download/Update button)
  2. Icon button row — only when `isReady || isOutdated`
  3. Progress bar — only when `isDownloading`

- [ ] **Step 5: Run TypeScript check**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors related to the new additions. Fix any type errors before committing.

- [ ] **Step 6: Commit**

  ```bash
  git add src/downlodr/components/modal/custom/AddonManagerModal.tsx
  git commit -m "feat: add delete, re-download, open-folder actions to AddonCard"
  ```

---

### Task 5: Manual verification

- [ ] **Step 1: Start the app in dev mode**

  ```bash
  npm run start
  ```

- [ ] **Step 2: Open the Add-on Manager modal**

  Open the modal from the navigation/help area. For an add-on with status `ready` or `outdated`, confirm:
  - Three icon buttons appear at the bottom of the card
  - Hovering each button shows the correct tooltip ("Delete add-on", "Re-download add-on", "Open folder")

- [ ] **Step 3: Test Open Folder**

  Click the folder icon — the OS file explorer should open to `{userData}/downlodr-add-ons/{packName}`. No crash, no console error.

- [ ] **Step 4: Test Re-download**

  Click the refresh icon — the card should switch to `downloading` state with a progress bar, identical to a first-time download.

- [ ] **Step 5: Test Delete**

  Click the trash icon — the card should immediately switch to `not-installed` state (green border and icon buttons disappear, Download button reappears). Verify the folder is gone from `{userData}/downlodr-add-ons/`.

- [ ] **Step 6: Test Delete on non-installed add-on (edge case)**

  If an add-on is `not-installed`, the icon row should not appear at all. Confirm no buttons are visible.
