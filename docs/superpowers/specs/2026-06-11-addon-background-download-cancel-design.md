# Add-on Background Download + Cancel — Design Spec

**Date:** 2026-06-11  
**Status:** Approved

---

## Problem

The `AddonManagerModal` currently requires the user to keep it open to see download progress. There is no way to cancel an in-progress download.

---

## Goals

1. Allow the user to close the modal while a download runs in the background.
2. Show a persistent toast with live progress % when the modal is dismissed.
3. Let the user cancel a download from **both** the modal and the toast.

---

## Architecture

### Layers changed

| Layer | File | Change |
|---|---|---|
| Main process | `src/core-app/ipc/main/addonManager.ts` | Store active `ClientRequest` per pack; add `addon:cancel` IPC handler |
| Preload | `src/core-app/ipc/renderer/addonHandler.ts` | Expose `cancel(pack)` on `addonBridge` |
| Types | `src/global.d.ts` | Add `cancel` to `addonBridge` type |
| Store | `src/core-app/store/addonStore.ts` | Add `cancelDownload(pack)` action |
| Modal | `src/downlodr/components/modal/custom/AddonManagerModal.tsx` | Add Cancel button + Run in background button during downloading |
| New component | `src/core-app/components/GlobalAddonDownloadToast.tsx` | Persistent toast with progress + cancel; mirrors `GlobalScanningModal` pattern |
| Mount point | wherever `GlobalScanningModal` is mounted | Mount `GlobalAddonDownloadToast` alongside it |

---

## Data Flow

```
User clicks Download
  → bridge.download(pack)           [preload → main: starts HTTP stream]
  → addonStore.setPackState(downloading, 0)
  → modal shows Cancel + Run in background buttons

User clicks "Run in background"
  → modal closes (onClose)
  → GlobalAddonDownloadToast detects isDownloading via addonStore
  → toast fires with live progress updates + Cancel button

Meanwhile main process:
  → stores ClientRequest in activeRequests Map<PackName, ClientRequest>
  → streams data, sends addon:progress events

User clicks Cancel (modal or toast)
  → bridge.cancel(pack)             [preload → main: req.destroy()]
  → main sends addon:complete { success: false, error: 'Cancelled' }
  → addonStore sets status back to not-installed
  → toast/modal both reset
```

---

## Main Process Changes (`addonManager.ts`)

- Add `const activeRequests = new Map<PackName, import('http').ClientRequest>()`.
- In `downloadToFile`, return the `ClientRequest` from `attempt()` and store it in `activeRequests` before awaiting.
- On request finish/error, remove from `activeRequests`.
- Add `addon:cancel` IPC handler: calls `activeRequests.get(pack)?.destroy(new Error('Cancelled'))`, removes from map, sends `addon:complete { success: false, error: 'Cancelled' }` if not already sent.
- Register and clean up `cancelHandler` alongside the other handlers.

---

## Preload Changes (`addonHandler.ts`)

Add:
```ts
cancel: (pack: PackName) => ipcRenderer.invoke('addon:cancel', { pack }),
```

---

## Type Changes (`global.d.ts`)

Add to `addonBridge`:
```ts
cancel: (pack: 'afda-backend' | 'video-nemesis-toolkit') => Promise<void>;
```

---

## Store Changes (`addonStore.ts`)

Add action:
```ts
cancelDownload: (pack: PackName) => void
```
Implementation: calls `window.addonBridge?.cancel(pack)` then immediately sets the pack's status back to `not-installed` optimistically (main will confirm via `addon:complete`).

---

## Modal UI Changes (`AddonManagerModal.tsx`)

When `isDownloading`, the `AddonCard` footer (currently just the progress bar) becomes:

```
[progress bar]
[45% — Downloading Subscription…]

[Cancel]   [Run in background →]
```

- **Cancel**: calls `handleCancel()` → `bridge.cancel(pack)` (via store action)
- **Run in background**: calls `onClose()` on the modal — the toast picks it up automatically because `isDownloading` remains true in the store

---

## GlobalAddonDownloadToast Component

New file: `src/core-app/components/GlobalAddonDownloadToast.tsx`

Watches `useAddonStore` for any pack with `status === 'downloading'`. When detected, fires a persistent toast:

```
[spinner] Downloading Subscription (45%)…    [Cancel]  [View]
```

- **Cancel**: calls `useAddonStore.getState().cancelDownload(pack)`
- **View**: re-opens the addon manager modal (needs a store flag or callback — see below)
- Toast auto-dismisses on `addon:complete` success; on failure shows a brief error variant

To trigger re-open from the toast, add `isAddonManagerOpen: boolean` + `setAddonManagerOpen(v)` to the store (or a simple Zustand flag). The mount point already controls `isOpen` for the modal — pass `setAddonManagerOpen` down or use the store flag.

The toast is only shown while the modal is **not** open (avoids duplicate UI). It can check `isAddonManagerOpen` from the store.

---

## Mount Point

Find where `GlobalScanningModal` is rendered (likely `App.tsx` or a layout component) and render `<GlobalAddonDownloadToast />` alongside it.

---

## Error Handling

- If cancel arrives after download already completed: no-op (request no longer in `activeRequests`).
- If the HTTP request is mid-redirect when cancelled: `req.destroy()` on the current request; the partial zip is deleted in the existing `catch` block.
- `addon:complete { success: false }` always resets the store to `not-installed`.

---

## Out of Scope

- Pause/resume (not requested)
- Queue of multiple simultaneous downloads (both packs could theoretically download at once — current code already supports this via separate keys in `activeRequests`)
