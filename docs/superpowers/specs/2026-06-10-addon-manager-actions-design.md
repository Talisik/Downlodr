# Add-on Manager Actions — Design Spec

**Date:** 2026-06-10  
**Status:** Approved

## Overview

Add three contextual actions to the Add-on Manager modal for installed add-ons: delete, re-download, and open folder. These appear as an icon button row at the bottom of each `AddonCard` when the add-on status is `ready` or `outdated`.

---

## Architecture

### Main Process — `addonManager.ts`

Two new IPC handlers added inside `addonManagerHandler()`:

**`addon:delete`**
- Payload in: `{ pack: PackName }`
- Deletes `{userData}/downlodr-add-ons/{packName}` via `fs.rmSync(..., { recursive: true, force: true })`
- Returns `{ success: boolean, error?: string }`
- Cleanup only; does not restart the app or notify via event — the renderer handles state reset directly from the return value.

**`addon:openFolder`**
- Payload in: `{ pack: PackName }`
- Calls `shell.openPath(addonPath)` where `addonPath = {userData}/downlodr-add-ons/{packName}`
- Returns `{ success: boolean }` (shell.openPath returns empty string on success, error string on failure)
- No-op if the folder does not exist (guard with `fs.existsSync`).

**Re-download** reuses the existing `addon:download` IPC channel — `realDownload()` already removes the destination directory before extracting, making it a clean re-download with no changes required.

Also add cleanup of the two new handlers in the teardown function returned by `addonManagerHandler()`.

---

### Renderer Bridge — `addonHandler.ts`

Two new methods added to the `addonBridge` context bridge exposure:

```ts
delete: (pack: PackName) => ipcRenderer.invoke('addon:delete', { pack }),
openFolder: (pack: PackName) => ipcRenderer.invoke('addon:openFolder', { pack }),
```

---

### Global Types — `global.d.ts`

Add the two new method signatures to the `addonBridge` interface:

```ts
delete: (pack: PackName) => Promise<{ success: boolean; error?: string }>;
openFolder: (pack: PackName) => Promise<{ success: boolean }>;
```

---

### State — `addonStore.ts`

No new store actions needed. After a successful delete, the UI calls `setPackState(packName, { status: 'not-installed' })` directly, which already handles the UI reset. After re-download, the existing `addon:complete` event flow handles state update.

---

### UI — `AddonManagerModal.tsx`

Inside `AddonCard`, when `status === 'ready' || status === 'outdated'`, render a row of three icon buttons below the existing header row:

| Button | Icon | Tooltip | Action |
|--------|------|---------|--------|
| Delete | Trash icon | "Delete add-on" | Calls `addonBridge.delete(packName)`, then `setPackState(packName, { status: 'not-installed' })` |
| Re-download | Refresh/rotate icon | "Re-download add-on" | Calls `addonBridge.download(packName)` + sets state to `downloading` (same as existing download flow) |
| Open folder | Folder icon | "Open folder" | Calls `addonBridge.openFolder(packName)` |

**Tooltip implementation:** Wrap each icon button with the existing `TooltipWrapper` component (`src/core-app/components/wrapper/TooltipWrapper.tsx`), passing the action label as `content` and `side="top"`. This is consistent with how tooltips are used elsewhere in the app (e.g. `Toolbar.tsx`, `FolderDirectory.tsx`).

**Styling:** Small icon-only buttons (`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-600`). Grouped in a `flex gap-1` row aligned to the left. Icons sourced from `lucide-react` (`Trash2`, `RefreshCw`, `FolderOpen`) to match the existing icon library.

**Delete UX:** No confirmation dialog — the button is small and the action is reversible (re-download restores it). State resets immediately on success.

---

## Error Handling

- `addon:delete` failure: log to console, do not reset store state (folder may still exist).
- `addon:openFolder` failure: silent (shell.openPath error is non-critical).
- Re-download failure: handled by the existing `addon:complete` error path.

---

## Files Changed

| File | Change |
|------|--------|
| `src/core-app/ipc/main/addonManager.ts` | Add `addon:delete`, `addon:openFolder` handlers + teardown |
| `src/core-app/ipc/renderer/addonHandler.ts` | Expose `delete`, `openFolder` on `addonBridge` |
| `src/global.d.ts` | Add type signatures for new bridge methods |
| `src/downlodr/components/modal/custom/AddonManagerModal.tsx` | Add icon button row to `AddonCard` |

No changes to `addonStore.ts` — existing `setPackState` is called directly from the component.
