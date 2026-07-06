# Optional Add-ons Design: downlodr-add-ons

**Date:** 2026-05-20
**Status:** Draft — pending approval
**Scope:** Make `afda-backend` and `video-nemesis-toolkit` optional, downloadable in-app

---

## Problem

downlodr's installer is growing heavy. Both backend packages (`afda-backend` and `video-nemesis-toolkit`) are git submodules with large `node_modules/` trees (including native binaries like `better-sqlite3`, Playwright, Puppeteer). Not every user needs these features. They should be opt-in, not bundled by default.

---

## Goals

- Ship a smaller base installer by default
- Users who want AFDA or Skedulosa features download the add-on pack in-app
- No breaking changes for existing dev environments or full builds
- Easy to swap hosting from Google Drive to GitHub Releases later

---

## Non-Goals

- Automatic background updates (user-triggered only)
- Multiple versions of the same pack installed simultaneously
- Offline/sideload installation (out of scope for now)

---

## Architecture Overview

```
downlodr (base installer)
  └── src/core-app/ipc/main/
        ├── registerHandlers.ts     ← conditionally calls handlers
        ├── afdaHandler.ts          ← checks for pack before loading
        └── skedulosaHandler.ts     ← checks for pack before loading

userData/downlodr-add-ons/
  ├── afda-backend/
  │     ├── dist/
  │     ├── node_modules/
  │     └── package.json            ← version read on startup
  └── video-nemesis-toolkit/
        ├── dist/
        ├── node_modules/
        └── package.json            ← version read on startup
```

---

## Section 1: Add-on Storage & Detection

### Storage Location

Downloaded packs live in `{userData}/downlodr-add-ons/`. On Windows this resolves to:
```
C:\Users\<user>\AppData\Roaming\downlodr\downlodr-add-ons\
```

This location:
- Is always writable by the app (no admin privileges needed)
- Persists across downlodr updates
- Is isolated from the app's own ASAR resources

### Detection Logic

On startup, main process runs a pack detection pass before registering any IPC handlers:

```ts
function detectAddon(packName: string, expectedVersion: string): AddonState {
  const userDataPath = app.getPath('userData')
  const addonPath = path.join(userDataPath, 'downlodr-add-ons', packName)
  const pkgPath = path.join(addonPath, 'package.json')

  if (!fs.existsSync(pkgPath)) return { status: 'not-installed', path: null }

  const { version } = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  if (version !== expectedVersion) return { status: 'outdated', installedVersion: version, path: addonPath }

  return { status: 'ready', path: addonPath }
}
```

### Path Resolution Priority

For native module resolution (used by the updated Vite path-rewrite plugins):

| Priority | Location | When Used |
|---|---|---|
| 1 | `userData/downlodr-add-ons/<pack>/node_modules` | Downloaded add-on |
| 2 | `app.asar.unpacked/src/.../node_modules` | Full build (future) |
| 3 | `app.getAppPath()/src/.../node_modules` | Dev environment |

### No Breaking Changes

- **Dev environment:** submodules still in `src/` → path resolution falls through to priority 3
- **Full build:** re-adding submodules to forge config produces a full installer as before
- **Lite installer:** backends excluded; `downlodr-add-ons` lookup activates once user downloads

---

## Section 2: Version Contract

downlodr's `package.json` declares the exact pack versions it expects:

```json
"downlodrAddons": {
  "afda-backend": "1.2.0",
  "video-nemesis-toolkit": "1.0.3"
}
```

### Pack States on Startup

| State | Condition | UI Result |
|---|---|---|
| `not-installed` | `package.json` absent in `downlodr-add-ons/` | Locked, "Download Add-on" button |
| `ready` | Installed version matches expected | Features fully active |
| `outdated` | Installed version does not match expected | Locked, "Update Add-on" button |

### Update Flow

When a new downlodr release ships with a bug-fixed pack:
1. `downlodrAddons` version bumped in downlodr's `package.json`
2. New pack zip uploaded to Google Drive (new file ID)
3. On next app launch, version check detects mismatch → user sees "Update required"
4. User clicks "Update Add-on" → same flow as initial install (re-download, overwrite, restart)

This ensures the pack version is always in sync with the downlodr version that ships it.

---

## Section 3: Download Flow

### IPC Channels

| Channel | Direction | Payload |
|---|---|---|
| `addon:status` | renderer → main → renderer | `{ afda: AddonState, skedulosa: AddonState }` |
| `addon:download` | renderer → main | `{ pack: 'afda-backend' \| 'video-nemesis-toolkit' }` |
| `addon:progress` | main → renderer | `{ pack, percent: number }` |
| `addon:complete` | main → renderer | `{ pack, success: boolean, error?: string }` |

### Download Sequence

```
Renderer                        Main Process
   |                                 |
   |--- addon:download { pack } ---->|
   |                                 |-- resolve Google Drive URL for pack
   |                                 |-- stream download to userData/temp/<pack>.zip
   |<-- addon:progress { %, pack } --|-- emit progress as bytes arrive
   |                                 |-- extract zip to downlodr-add-ons/<pack>/
   |                                 |-- delete temp file
   |<-- addon:complete { success } --|
   |                                 |
   | [toast: "Restart to activate"]  |
```

### Google Drive URL

Uses the bypass pattern to avoid the virus-scan warning page for large files:
```
https://drive.google.com/uc?export=download&id=<FILE_ID>&confirm=t
```

File IDs are stored in downlodr's config alongside the expected version. Swapping to GitHub Releases later is a one-line change per pack.

### Error Handling

- If download fails: temp file deleted, `addon:complete { success: false, error }` sent, `downlodr-add-ons/<pack>/` not created
- If extraction fails: partial folder deleted, same error event sent
- On restart: detection runs fresh — partial installs are treated as `not-installed`

---

## Section 4: UI — AddonGate Component

A single reusable `<AddonGate packName="afda-backend">` component wraps any feature area. It reads from the global addon status store (Zustand) and renders one of three overlays:

### Not Installed
```
┌─────────────────────────────────────────────┐
│  🔒 Add-on not installed                    │
│  This feature requires the AFDA add-on.     │
│                                             │
│  [Download Add-on]                          │
└─────────────────────────────────────────────┘
```

### Downloading
```
┌─────────────────────────────────────────────┐
│  ⬇ Downloading... 47%                      │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
└─────────────────────────────────────────────┘
```

### Update Required
```
┌─────────────────────────────────────────────┐
│  ⚠ Update required (v1.1.0 → v1.2.0)       │
│  A new version is needed for this release.  │
│                                             │
│  [Update Add-on]                            │
└─────────────────────────────────────────────┘
```

After download completes, a non-blocking toast appears: *"Add-on installed — restart downlodr to activate."* No forced dialog.

---

## Section 5: Build Config Changes

### `forge.config.ts`

Add to `packagerConfig.ignore`:
```ts
ignore: [
  /src\/afda\/backend\/afda-backend/,
  /src\/skedulosa\/backend\/video-nemesis-toolkit/,
]
```

Remove the `extraResources` entries that unpack their `node_modules` into `app.asar.unpacked` — the backends won't be in the app bundle.

### `vite.main.config.ts`

The existing `rewrite-external-modules` and `rewrite-better-sqlite3-path` plugins stay as-is for dev. A new `resolveAddonPath(packName)` runtime helper is added to `afdaHandler.ts` and `skedulosaHandler.ts` to check the three-priority path order before loading.

---

## Files to Create / Modify

| File | Change |
|---|---|
| `src/core-app/ipc/main/addonManager.ts` | New — detection, download, extraction logic |
| `src/core-app/ipc/main/registerHandlers.ts` | Conditional handler registration based on addon state |
| `src/core-app/ipc/main/afdaHandler.ts` | Add `resolveAddonPath()`, guard with addon state |
| `src/core-app/ipc/main/skedulosaHandler.ts` | Add `resolveAddonPath()`, guard with addon state |
| `src/DataStores/addonStore.ts` | New Zustand store for addon status |
| `src/components/AddonGate.tsx` | New reusable locked-state wrapper component |
| `forge.config.ts` | Add ignore rules for backend submodule folders |
| `package.json` | Add `downlodrAddons` version map |

---

## Open Questions

- Should both packs be bundled in a single zip or separate zips? (Separate recommended — users only download what they need)
- Should the Google Drive file IDs live in `package.json` or a separate `addons.config.json`? (Separate config is cleaner and avoids cluttering `package.json`)
