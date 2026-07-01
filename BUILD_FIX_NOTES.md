# Build Fix Notes — `feat/modular-install`

## Problem Summary

Running `yarn electron-forge make` (or `package`) produced a chain of errors that prevented a working installer from being produced. Each error was resolved in sequence.

---

## Error 1 — `main.js` not found

```
Error: The main entry point to your app was not found.
Make sure ".vite/build/main.js" exists...
```

### Root Cause

The Vite build for the main process was failing silently. `@electron-forge/plugin-vite` wraps each build in a Promise that resolves via `closeBundle()` — which fires even on a failed build — so the error was swallowed and packaging continued without `main.js`.

Running the Vite build in isolation revealed the real error:

```
[vite:load-fallback] Could not load .../src/skedulosa/backend/video-nemesis-toolkit/dist/index
(imported by src/core-app/ipc/main/skedulosaHandler.ts): ENOENT
```

`skedulosaHandler.ts` had a **static top-level import** of a module whose path didn't exist:

```ts
// BEFORE (broken)
import { registerVideoNemesisIpcHandlers as registerVideoNemesisIpcHandlersBundled }
  from '@/skedulosa/backend/video-nemesis-toolkit/dist/index';
```

The actual source lives at `video-nemesis-toolkit__hidden/` (not `video-nemesis-toolkit/`). After fixing that, the next error was the same pattern for `afdaHandler.ts`:

```
[vite:load-fallback] Could not load .../src/afda/backend/afda-backend/src/storage
(imported by src/core-app/ipc/main/afdaHandler.ts): ENOENT
```

Same issue — the source lives at `afda-backend__hidden/`.

### Files Changed

**`src/core-app/ipc/main/skedulosaHandler.ts`**
- Removed the static top-level import entirely
- Replaced the `else` branch (which used the bundled import) with `else if (process.env.NODE_ENV !== 'production')` containing a guarded dynamic import pointing to the correct `__hidden` path
- This matches the pattern already used in `afdaHandler.ts`

```ts
// AFTER
// (no top-level import)

if (addonPath) {
  const mod = await import(/* @vite-ignore */ pathToFileURL(...).href);
  registerVideoNemesisIpcHandlers = mod.registerVideoNemesisIpcHandlers;
} else if (process.env.NODE_ENV !== 'production') {
  // Dev only — Rollup eliminates this branch from the production bundle
  const mod = await import('@/skedulosa/backend/video-nemesis-toolkit__hidden/dist/index');
  registerVideoNemesisIpcHandlers = mod.registerVideoNemesisIpcHandlers;
}
```

**`src/core-app/ipc/main/afdaHandler.ts`**
- All import paths updated from `afda-backend/` → `afda-backend__hidden/`
- Applies to both `src/` imports and `resources/mapper/` imports

**`vite.main.config.ts`**
- Updated all references from `afda-backend/node_modules` → `afda-backend__hidden/node_modules`
- Updated regex external pattern and `rewrite-external-modules` base path accordingly

---

## Error 2 — `Cannot find module '...axios'` at runtime

```
Error: Cannot find module
'C:\...\resources\app.asar.unpacked\src\afda\backend\afda-backend__hidden\node_modules\axios'
```

### Root Cause

Two problems combined:

**Problem A — Dead code not eliminated.**
The `else if (process.env.NODE_ENV !== 'production')` branch in `afdaHandler.ts` was NOT being removed from the production bundle. Rollup requires `process.env.NODE_ENV` to be statically replaced at build time to evaluate the condition. `vite.main.config.ts` was a static config object with no `define` — so `process.env.NODE_ENV` was never replaced and the condition was never evaluated as `false`.

Result: the entire `afda-backend__hidden` source tree was bundled into production `main.js` as a dynamic chunk.

**Problem B — Blind rewrite of `require('axios')`.**
The `rewrite-external-modules` Rollup plugin rewrote every `require('axios')` in every chunk to point to:
```
app.asar.unpacked/src/afda/backend/afda-backend__hidden/node_modules/axios
```
This broke `src/core-app/client/httpClient.ts`, which imports axios directly and legitimately (used by `githubService.ts` and `telemetryAPIService.ts`). That path does not exist in the packaged app because `src/` is excluded by `packagerConfig.ignore`.

### Files Changed

**`vite.main.config.ts`**

1. Converted from static `defineConfig({})` to function form `defineConfig(({ mode }) => ({}))` and added explicit `define`:

```ts
define: {
  // Enables Rollup to statically evaluate `process.env.NODE_ENV !== 'production'`
  // as `false` in production, eliminating the dev-only import branches entirely.
  'process.env.NODE_ENV': JSON.stringify(mode),
},
```

2. Removed `'axios'` from the `external` list — let Rollup bundle it inline for `httpClient.ts`.

3. Removed `'axios'` from the `afdaModules` list in `rewrite-external-modules` — no rewrite needed since it's now bundled, not external.

---

## Error 3 — `Cannot find module '...better-sqlite3'` at runtime

```
Error: Cannot find module
'C:\...\resources\app.asar.unpacked\src\skedulosa\backend\video-nemesis-toolkit__hidden\node_modules\better-sqlite3'
```

### Root Cause

`skedulosaHandler.ts` uses `better-sqlite3` directly (outside any dead-code branch) for the `toolkit:downloadTasks:delete` and `toolkit:downloadTasks:clearPending` IPC handlers. The `rewrite-better-sqlite3-path` plugin was pointing `require('better-sqlite3')` to the toolkit's local node_modules inside `src/`, which is excluded from the package.

Additionally, `better-sqlite3` is a native module (`.node` binary). Native modules **cannot be loaded from inside an ASAR archive** — they must exist as actual files on disk.

### Files Changed

**`vite.main.config.ts`** — updated `rewrite-better-sqlite3-path`:

```ts
// BEFORE
const relPath = 'src/skedulosa/backend/video-nemesis-toolkit__hidden/node_modules/better-sqlite3';
// points into src/ which is excluded from the package

// AFTER — points to root node_modules, which IS in the package
return _e.app.isPackaged
  ? _p.join(process.resourcesPath, 'app.asar.unpacked/node_modules/better-sqlite3')
  : _p.join(_e.app.getAppPath(), 'node_modules/better-sqlite3');
```

**`forge.config.ts`** — changed `asar: true` to an object with `unpack` so better-sqlite3 is placed in `app.asar.unpacked` instead of locked inside the archive:

```ts
// BEFORE
asar: true,

// AFTER
asar: {
  unpack: '**/better-sqlite3/**',
},
```

---

## Summary of All Changed Files

| File | Change |
|------|--------|
| `src/core-app/ipc/main/skedulosaHandler.ts` | Removed static import; converted to guarded dynamic import with `__hidden` path |
| `src/core-app/ipc/main/afdaHandler.ts` | All `afda-backend/` paths → `afda-backend__hidden/` |
| `vite.main.config.ts` | Function config + `define`, updated `__hidden` paths, removed `axios` from external and rewrite list, fixed better-sqlite3 rewrite path |
| `forge.config.ts` | `asar: true` → `asar: { unpack: '**/better-sqlite3/**' }` |

---

## Error 4 — Add-on IPC handlers not registered in packaged build

```
Error invoking remote method 'mapper:run': Error: No handler registered for 'mapper:run'
Error invoking remote method 'toolkit:channelAnalyze:schedule': Error: No handler registered for 'toolkit:channelAnalyze:schedule'
```

### Root Cause

In `registerHandlers.ts`, add-on handlers are only registered when:
- The add-on is installed in `userData/downlodr-add-ons/<pack>/` (`detectAddon` returns `ready`), **OR**
- The app is running in dev mode (`!app.isPackaged`)

On a fresh packaged install, neither condition is met, so both handlers are silently skipped. The app opens normally but all add-on IPC channels are missing.

### Fix

The add-on install flow was already wired up (`addonManager.ts` downloads from Google Drive, extracts, patches native binaries). The missing pieces were:

**1. No restart after install**

After downloading an add-on, the handlers were registered at startup and never re-registered mid-session. The user had no prompt to restart.

**`src/core-app/ipc/main/addonManager.ts`**
- Added `addon:restart` IPC handler that calls `app.relaunch()` + `app.quit()`

**`src/core-app/ipc/renderer/addonHandler.ts`**
- Exposed `restart()` on `window.addonBridge`

**`src/core-app/store/addonStore.ts`**
- Added `needsRestart: boolean` field
- Set `needsRestart: true` when any download completes successfully

**`src/downlodr/components/modal/custom/AddonManagerModal.tsx`**
- Added amber banner: *"Restart required to activate installed add-ons."* with a **Restart** button
- Banner appears after any successful download; one click relaunches the app

**2. Silent handler errors**

Add-on handler calls had no error handling. If `afdaHandler` or `skedulosaHandler` threw during startup, the error propagated and `createWindow` would fail — leaving the window blank with no indication of what went wrong.

**`src/core-app/ipc/main/registerHandlers.ts`**
- Wrapped both handler calls in `try/catch`
- Errors are logged to console rather than crashing the app

**3. Wrong `yt-dlp` path for Skedulosa in packaged build**

`resolveYtDlpPath()` in `skedulosaHandler.ts` looked for `yt-dlp.exe` in `process.resourcesPath`, but the `postPackage` hook copies it **next to the executable** (`path.dirname(process.execPath)`), not into resources.

**`src/core-app/ipc/main/skedulosaHandler.ts`**
- Updated `resolveYtDlpPath()` to check `path.dirname(process.execPath)` first in packaged mode, with `process.resourcesPath` as a fallback

---

## Design Notes

### Add-ons are wiped on uninstall

`forge.config.ts` sets `deleteAppDataOnUninstall: true` in the NSIS config. This means uninstalling the app deletes `%APPDATA%/Downlodr/` (userData), which includes `downlodr-add-ons/`. After reinstalling a new build, both add-ons must be re-downloaded via the Add-ons modal.

During development, set `deleteAppDataOnUninstall: false` temporarily to avoid re-downloading on every build iteration.

### The `__hidden` Convention

Both backend packages exist in two forms in the repo:
- `afda-backend__hidden/` / `video-nemesis-toolkit__hidden/` — the private source tree, tracked in git
- `afda-backend/` / `video-nemesis-toolkit/` — the installed add-on, extracted from a zip at runtime (not in git)

The handlers follow a three-branch loading strategy:
1. **Add-on installed** (`addonPath` provided): load from `addonPath/dist/index.js` via a file URL — fully dynamic, never bundled
2. **Dev mode** (`process.env.NODE_ENV !== 'production'`): load from `__hidden` source via dynamic import — bundled by Vite/Rollup in dev builds, eliminated in production
3. **Production without add-on**: handler is skipped entirely by `registerHandlers.ts` (`if (addonPath || !app.isPackaged)`)

### Why `process.env.NODE_ENV` Must Be Explicitly Defined

When `vite.build()` is called programmatically via `@electron-forge/plugin-vite` (with `configFile: false`), Vite's automatic `process.env.NODE_ENV` replacement may not propagate into all Rollup transforms in time to influence dynamic import graph resolution. Adding it explicitly to `define` guarantees Rollup sees a static string and can eliminate the dead branch before resolving its imports.
