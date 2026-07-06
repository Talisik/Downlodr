# Optional Add-ons — Real Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simulated add-on download flow with a real Google Drive HTTPS download + yauzl zip extraction, restore bridge wiring reverted by the linter, and wire conditional handler registration so AFDA/Skedulosa only load when their pack is present.

**Architecture:** `addonManager.ts` owns all detection, download, extraction, and IPC. `registerHandlers.ts` calls `detectAddon` at startup and only invokes `afdaHandler`/`skedulosaHandler` when their respective pack is `ready`, passing the resolved path. Both handlers accept an optional `addonPath` — present means load from the pack's `dist/`, absent means fall through to Vite-bundled dev imports. The lite installer build excludes backends entirely via `forge.config.ts` ignore rules.

**Tech Stack:** Electron (main process), Node.js `https` (streaming download), `yauzl ^3.2.0` (already installed — zip extraction), Zustand (addon state), React + shadcn `useToast` (UI), `electron-forge` + Vite (build).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `addons.config.json` | **Create** | Per-pack version, Google Drive file ID, download URL |
| `src/preload.ts` | **Modify** | Restore `addonHandler` import (was reverted by linter) |
| `src/global.d.ts` | **Modify** | Restore `addonBridge` Window type (was reverted by linter) |
| `src/skedulosa/pages/SkedulosaHome.tsx` | **Modify** | Restore gate check before early return (was reverted by linter) |
| `src/core-app/components/AddonGate.tsx` | **Modify** | Remove demo Reset button; add completion callback prop |
| `src/App.tsx` | **Modify** | Add `useAddonCompleteToast` hook for "Restart to activate" toast |
| `src/core-app/ipc/main/addonManager.ts` | **Modify** | Replace `simulateDownload` with real HTTPS stream + yauzl extraction; export `detectAddon` and `resolveAddonPath` |
| `src/core-app/ipc/main/registerHandlers.ts` | **Modify** | Detect addon state at startup; pass path to handlers conditionally |
| `src/core-app/ipc/main/afdaHandler.ts` | **Modify** | Accept optional `addonPath`; load from `dist/` via `createRequire` when set |
| `src/core-app/ipc/main/skedulosaHandler.ts` | **Modify** | Accept optional `addonPath`; load `registerVideoNemesisIpcHandlers` from pack `dist/` when set |
| `package.json` | **Modify** | Re-add `downlodrAddons` version map (was lost — linter cleaned it out) |
| `forge.config.ts` | **Modify** | Add `packagerConfig.ignore` for backend folders; remove backend copy from `postPackage` hook |

---

## Task 1: Restore `downlodrAddons` + `addons.config.json`

**Files:**
- Modify: `package.json`
- Create: `addons.config.json`

The linter removed `downlodrAddons` from `package.json`. Also create the separate config file (decided in design: file IDs live in `addons.config.json`, not `package.json`).

- [ ] **Step 1: Re-add `downlodrAddons` to `package.json`**

In `package.json`, add after `"main": ".vite/build/main.js",`:

```json
"downlodrAddons": {
  "afda-backend": "1.2.0",
  "video-nemesis-toolkit": "1.0.3"
},
```

- [ ] **Step 2: Create `addons.config.json` at project root**

```json
{
  "afda-backend": {
    "version": "1.2.0",
    "fileId": "PLACEHOLDER_AFDA_GDRIVE_ID",
    "downloadUrl": "https://drive.google.com/uc?export=download&id=PLACEHOLDER_AFDA_GDRIVE_ID&confirm=t"
  },
  "video-nemesis-toolkit": {
    "version": "1.0.3",
    "fileId": "PLACEHOLDER_VNT_GDRIVE_ID",
    "downloadUrl": "https://drive.google.com/uc?export=download&id=PLACEHOLDER_VNT_GDRIVE_ID&confirm=t"
  }
}
```

Replace `PLACEHOLDER_*` with real Google Drive file IDs once packs are uploaded.

- [ ] **Step 3: Commit**

```bash
git add package.json addons.config.json
git commit -m "feat: add downlodrAddons version map and addons.config.json"
```

---

## Task 2: Restore bridge wiring (preload + global.d.ts)

**Files:**
- Modify: `src/preload.ts`
- Modify: `src/global.d.ts`

Both were reverted by the linter after the dummy-flow session.

- [ ] **Step 1: Add `addonHandler` import to `src/preload.ts`**

Add after the `afdaHandler` import line:

```ts
import './core-app/ipc/renderer/afdaHandler';
import './core-app/ipc/renderer/addonHandler';   // ← add this
import './core-app/ipc/renderer/updateHandler';
```

- [ ] **Step 2: Add `addonBridge` type to `src/global.d.ts`**

Locate the `// ─── AFDA` comment block in the `Window` interface and insert above it:

```ts
// ─── Add-on Manager bridge ────────────────────────────────────────────
addonBridge: {
  getStatus: () => Promise<{
    afda: { status: string; installedVersion?: string; path: string | null };
    skedulosa: { status: string; installedVersion?: string; path: string | null };
  }>;
  download: (pack: 'afda-backend' | 'video-nemesis-toolkit') => Promise<{ started: boolean }>;
  on: {
    progress: (cb: (data: { pack: 'afda-backend' | 'video-nemesis-toolkit'; percent: number }) => void) => () => void;
    complete: (cb: (data: { pack: 'afda-backend' | 'video-nemesis-toolkit'; success: boolean; error?: string }) => void) => () => void;
  };
};
```

Note: `reset` is intentionally removed — that was a demo-only helper.

- [ ] **Step 3: Remove `addon:reset` handler from `src/core-app/ipc/renderer/addonHandler.ts`**

The renderer bridge should no longer expose `reset`. Open the file and remove the `reset` line:

```ts
// Remove this line:
reset: (pack: PackName) => ipcRenderer.invoke('addon:reset', { pack }),
```

- [ ] **Step 4: Commit**

```bash
git add src/preload.ts src/global.d.ts src/core-app/ipc/renderer/addonHandler.ts
git commit -m "feat: restore addonBridge preload wiring and Window types"
```

---

## Task 3: Restore SkedulosaHome gate + cleanup AddonGate

**Files:**
- Modify: `src/skedulosa/pages/SkedulosaHome.tsx`
- Modify: `src/core-app/components/AddonGate.tsx`

The gate check in `SkedulosaHome` was reverted. Also remove the "Reset" demo button from `AddonGate`.

- [ ] **Step 1: Add imports to `SkedulosaHome.tsx`**

After the last import in the file (`import AfdaAddedSubscriptionModal ...`):

```ts
import AddonGate from '@/core-app/components/AddonGate';
import { useAddonStore } from '@/core-app/store/addonStore';
```

- [ ] **Step 2: Add gate check in `SkedulosaHome` after all hooks**

The hooks section ends with the `afdaWebsiteSaved` state declaration. Add the gate check immediately after it, before any `const handle*` functions:

```ts
const [afdaWebsiteSaved, setAfdaWebsiteSaved] = useState<{
  name: string;
  id: string;
} | null>(null);

// ↓ Add this block
const skedulosaAddonState = useAddonStore((s) => s.skedulosa);

if (skedulosaAddonState.status !== 'ready') {
  return (
    <div className="h-full">
      <AddonGate packName="video-nemesis-toolkit">
        <div className="flex flex-col gap-3 p-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 rounded bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      </AddonGate>
    </div>
  );
}
// ↑ End of added block

const handleSubscriptionCreated = (
```

- [ ] **Step 3: Remove Reset button from `AddonGate.tsx`**

In `src/core-app/components/AddonGate.tsx`, remove the `handleReset` function and the Reset button from `NotInstalledState`:

```tsx
// Remove this function entirely:
const handleReset = () => {
  window.addonBridge?.reset(packName);
  useAddonStore.getState().setPackState(packName, { status: 'not-installed', progress: undefined });
};

// In NotInstalledState props, remove onReset param and its button:
// Remove: onReset: () => void  from the interface
// Remove: <button onClick={onReset} ...>Reset</button>

// Also update the call site in AddonGate — remove onReset={handleReset} from <NotInstalledState>
```

The final `NotInstalledState` signature should be:
```tsx
function NotInstalledState({ label, onDownload }: { label: string; onDownload: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">🔒</span>
        <div>
          <p className="text-sm font-semibold text-[#e2e8f0]">Add-on not installed</p>
          <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
            This feature requires the {label} add-on to be downloaded.
          </p>
        </div>
      </div>
      <button
        onClick={onDownload}
        className="self-start px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-indigo-100 text-xs font-semibold transition-colors"
      >
        Download Add-on
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/skedulosa/pages/SkedulosaHome.tsx src/core-app/components/AddonGate.tsx
git commit -m "feat: restore SkedulosaHome gate check; remove demo Reset button"
```

---

## Task 4: Add "Restart to activate" toast

**Files:**
- Modify: `src/App.tsx`

When a download completes successfully, show a non-blocking toast. Because `addonStore` is not a React component, the toast is triggered from a hook in `App.tsx` that watches the store.

- [ ] **Step 1: Add `useAddonCompleteToast` hook inline in `App.tsx`**

Add this import at the top of `App.tsx`:

```ts
import { useToast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useAddonStore } from '@/core-app/store/addonStore';
```

Then add this hook inside the `App` component, after the existing `useEffect` blocks:

```ts
const { toast } = useToast();
const afdaStatus = useAddonStore((s) => s.afda.status);
const skedulosaStatus = useAddonStore((s) => s.skedulosa.status);
const prevAfdaStatus = useRef(afdaStatus);
const prevSkedulosaStatus = useRef(skedulosaStatus);

useEffect(() => {
  if (prevAfdaStatus.current === 'downloading' && afdaStatus === 'ready') {
    toast({ title: 'AFDA add-on installed', description: 'Restart downlodr to activate.' });
  }
  prevAfdaStatus.current = afdaStatus;
}, [afdaStatus]);

useEffect(() => {
  if (prevSkedulosaStatus.current === 'downloading' && skedulosaStatus === 'ready') {
    toast({ title: 'Skedulosa add-on installed', description: 'Restart downlodr to activate.' });
  }
  prevSkedulosaStatus.current = skedulosaStatus;
}, [skedulosaStatus]);
```

Also add `useRef` to the existing React import:
```ts
import { useEffect, useRef, useState } from 'react';
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: show restart toast when add-on download completes"
```

---

## Task 5: Real HTTPS download with progress

**Files:**
- Modify: `src/core-app/ipc/main/addonManager.ts`

Replace `simulateDownload` with a real streaming HTTPS download. Google Drive's export URL redirects once (302) to the actual file — the downloader must follow that redirect.

- [ ] **Step 1: Add `downloadToFile` helper in `addonManager.ts`**

Add this function to the file (after the imports, before `detectAddon`):

```ts
import * as https from 'https';
import * as http from 'http';

function downloadToFile(
  url: string,
  destPath: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const attempt = (targetUrl: string) => {
      const client = targetUrl.startsWith('https') ? https : http;
      client
        .get(targetUrl, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            // Follow single redirect (Google Drive does this)
            const location = response.headers.location;
            if (!location) return reject(new Error('Redirect with no Location header'));
            response.resume();
            return attempt(location);
          }
          if (response.statusCode !== 200) {
            response.resume();
            return reject(new Error(`HTTP ${response.statusCode}`));
          }

          const total = parseInt(response.headers['content-length'] ?? '0', 10);
          let downloaded = 0;

          const out = fs.createWriteStream(destPath);
          response.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
            if (total > 0) onProgress(Math.round((downloaded / total) * 100));
          });
          response.pipe(out);
          out.on('finish', () => { out.close(); resolve(); });
          out.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
        })
        .on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
    };
    attempt(url);
  });
}
```

- [ ] **Step 2: Add config loader helper**

```ts
function loadAddonsConfig(): Record<string, { version: string; fileId: string; downloadUrl: string }> {
  const configPath = path.join(app.getAppPath(), 'addons.config.json');
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}
```

- [ ] **Step 3: Replace `simulateDownload` with `realDownload`**

Remove the entire `simulateDownload` function and replace the call inside `addonManagerHandler` with:

```ts
async function realDownload(packName: PackName, mainWindow: BrowserWindow): Promise<void> {
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

  try {
    await downloadToFile(packConfig.downloadUrl, tempZip, (percent) => {
      mainWindow.webContents.send('addon:progress', { pack: packName, percent });
    });

    await extractZip(tempZip, destDir);

    fs.unlinkSync(tempZip);

    mainWindow.webContents.send('addon:complete', { pack: packName, success: true });
  } catch (err) {
    try { fs.unlinkSync(tempZip); } catch { /* already gone */ }
    try { fs.rmSync(destDir, { recursive: true, force: true }); } catch { /* partial extraction */ }
    mainWindow.webContents.send('addon:complete', {
      pack: packName,
      success: false,
      error: String(err),
    });
  }
}
```

- [ ] **Step 4: Update the `addon:download` handler to call `realDownload`**

In `addonManagerHandler`, change the download handler body:

```ts
const downloadHandler = ipcMain.handle(
  'addon:download',
  (_event, { pack }: { pack: PackName }) => {
    realDownload(pack, mainWindow).catch((err) =>
      console.error('[addonManager] realDownload error:', err),
    );
    return { started: true };
  },
);
```

- [ ] **Step 5: Commit (download only — extraction added in Task 6)**

```bash
git add src/core-app/ipc/main/addonManager.ts
git commit -m "feat: replace simulated download with real HTTPS streaming"
```

---

## Task 6: Zip extraction with yauzl

**Files:**
- Modify: `src/core-app/ipc/main/addonManager.ts`

`yauzl ^3.2.0` is already in `package.json`. Add an `extractZip` helper called by `realDownload`.

- [ ] **Step 1: Add yauzl import at top of `addonManager.ts`**

```ts
import yauzl from 'yauzl';
```

- [ ] **Step 2: Add `extractZip` helper**

Add this function after `downloadToFile`:

```ts
function extractZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        const entryPath = path.join(destDir, entry.fileName);

        if (/\/$/.test(entry.fileName)) {
          // Directory entry
          fs.mkdirSync(entryPath, { recursive: true });
          zipfile.readEntry();
        } else {
          fs.mkdirSync(path.dirname(entryPath), { recursive: true });
          zipfile.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr) return reject(streamErr);
            const out = fs.createWriteStream(entryPath);
            readStream.pipe(out);
            out.on('close', () => zipfile.readEntry());
            out.on('error', reject);
          });
        }
      });

      zipfile.on('end', resolve);
      zipfile.on('error', reject);
    });
  });
}
```

- [ ] **Step 3: Verify `realDownload` already calls `extractZip`**

Confirm `realDownload` (added in Task 5) has this line:
```ts
await extractZip(tempZip, destDir);
```

- [ ] **Step 4: Commit**

```bash
git add src/core-app/ipc/main/addonManager.ts
git commit -m "feat: add yauzl zip extraction to addonManager"
```

---

## Task 7: Export `detectAddon` and `resolveAddonPath`

**Files:**
- Modify: `src/core-app/ipc/main/addonManager.ts`

`registerHandlers.ts` needs to call `detectAddon` at startup to decide which handlers to load. `afdaHandler` and `skedulosaHandler` need `resolveAddonPath` to find their pack at runtime.

- [ ] **Step 1: Make `detectAddon` exported**

Change the function signature from:
```ts
function detectAddon(packName: PackName): AddonStatus {
```
to:
```ts
export function detectAddon(packName: PackName): AddonStatus {
```

- [ ] **Step 2: Add exported `resolveAddonPath`**

Add this function after `detectAddon`:

```ts
/**
 * Returns the base directory for a pack, checked in priority order:
 *  1. userData/downlodr-add-ons/<pack>        (downloaded add-on)
 *  2. app.asar.unpacked/src/.../              (full packaged build)
 *  3. app.getAppPath()/src/.../               (dev environment)
 *
 * Returns the first path that contains a package.json, or the dev path as fallback.
 */
export function resolveAddonPath(packName: PackName): string {
  const srcSubpath =
    packName === 'afda-backend'
      ? path.join('src', 'afda', 'backend', 'afda-backend')
      : path.join('src', 'skedulosa', 'backend', 'video-nemesis-toolkit');

  // Priority 1: userData downloaded pack
  const userDataPack = path.join(app.getPath('userData'), 'downlodr-add-ons', packName);
  if (fs.existsSync(path.join(userDataPack, 'package.json'))) return userDataPack;

  // Priority 2: app.asar.unpacked (packaged full build)
  if (process.resourcesPath) {
    const unpackedPack = path.join(process.resourcesPath, 'app.asar.unpacked', srcSubpath);
    if (fs.existsSync(path.join(unpackedPack, 'package.json'))) return unpackedPack;
  }

  // Priority 3: dev environment
  return path.join(app.getAppPath(), srcSubpath);
}
```

- [ ] **Step 3: Remove `addon:reset` handler from `addonManagerHandler`**

Remove these lines from the function (it was demo-only):
```ts
const resetHandler = ipcMain.handle(
  'addon:reset',
  ...
);
void resetHandler;
ipcMain.removeHandler('addon:reset');
```

- [ ] **Step 4: Commit**

```bash
git add src/core-app/ipc/main/addonManager.ts
git commit -m "feat: export detectAddon and resolveAddonPath from addonManager"
```

---

## Task 8: Conditional handler registration

**Files:**
- Modify: `src/core-app/ipc/main/registerHandlers.ts`

Run addon detection before registering AFDA and Skedulosa handlers. Only register if the pack is `ready`, and pass the resolved path so the handler can load from the correct location.

- [ ] **Step 1: Add imports**

```ts
import { detectAddon, resolveAddonPath } from './addonManager';
```

- [ ] **Step 2: Replace unconditional AFDA/Skedulosa registration**

Replace:
```ts
collect(await afdaHandler(mainWindow));
collect(skedulosaHandler(mainWindow));
```

With:
```ts
const afdaState = detectAddon('afda-backend');
if (afdaState.status === 'ready') {
  const addonPath = resolveAddonPath('afda-backend');
  collect(await afdaHandler(mainWindow, addonPath));
} else {
  console.log(`[addons] afda-backend not ready (${afdaState.status}) — skipping handler registration`);
}

const skedulosaState = detectAddon('video-nemesis-toolkit');
if (skedulosaState.status === 'ready' || skedulosaState.status === 'not-installed') {
  // Skedulosa falls through to Vite-bundled path in dev; only skip if truly outdated
  const addonPath = afdaState.status === 'ready' ? resolveAddonPath('video-nemesis-toolkit') : undefined;
  collect(skedulosaHandler(mainWindow, addonPath));
}
```

> **Note:** During development, both `afdaState` and `skedulosaState` will return `not-installed` (no pack in userData), so the handlers fall through to their Vite-bundled imports via the `addonPath = undefined` path added in Tasks 9 and 10. This means dev mode is unaffected.

- [ ] **Step 3: Correct Skedulosa condition**

The logic above needs clarifying. Replace with the clean version:

```ts
const afdaState = detectAddon('afda-backend');
const addonPathAfda = afdaState.status === 'ready' ? resolveAddonPath('afda-backend') : undefined;
if (addonPathAfda || !app.isPackaged) {
  // In dev (not packaged): always load via Vite-bundled imports (addonPath = undefined)
  // In production: only load if pack is ready
  collect(await afdaHandler(mainWindow, addonPathAfda));
}

const skedulosaState = detectAddon('video-nemesis-toolkit');
const addonPathSkedulosa = skedulosaState.status === 'ready' ? resolveAddonPath('video-nemesis-toolkit') : undefined;
if (addonPathSkedulosa || !app.isPackaged) {
  collect(skedulosaHandler(mainWindow, addonPathSkedulosa));
}
```

- [ ] **Step 4: Commit**

```bash
git add src/core-app/ipc/main/registerHandlers.ts
git commit -m "feat: conditional AFDA/Skedulosa handler registration based on addon state"
```

---

## Task 9: Dynamic module loading in `afdaHandler.ts`

**Files:**
- Modify: `src/core-app/ipc/main/afdaHandler.ts`

When `addonPath` is provided (production with downloaded pack), load services from the pack's compiled `dist/` using `createRequire`. When `addonPath` is `undefined` (dev / full build), use the existing Vite-bundled `import()` calls unchanged.

- [ ] **Step 1: Add `createRequire` import at top of `afdaHandler.ts`**

```ts
import { createRequire } from 'module';
```

- [ ] **Step 2: Update function signature**

Change:
```ts
export const afdaHandler = async (mainWindow: BrowserWindow): Promise<(() => void)> => {
```
To:
```ts
export const afdaHandler = async (
  mainWindow: BrowserWindow,
  addonPath?: string,
): Promise<(() => void)> => {
```

- [ ] **Step 3: Replace the `Promise.all` import block with a branching loader**

Replace the entire `const [...] = await Promise.all([...])` block with:

```ts
let StorageService: any,
    PaginationService: any,
    MapperService: any,
    TemporalAnalyzerService: any,
    ScrapeEngine: any,
    SchedulerService: any,
    MemoryMonitorService: any,
    NotificationService: any,
    BatchRunner: any,
    LoadControlService: any,
    AuthSessionService: any,
    registerIpcHandlers: any,
    buildHydratedWebsites: any,
    closeBrowser: any;

if (addonPath) {
  // Production: load compiled dist/ from the downloaded pack
  const nativeRequire = createRequire(import.meta.url);
  const dist = (rel: string) => nativeRequire(path.join(addonPath, 'dist', rel));
  StorageService          = dist('storage').StorageService;
  PaginationService       = dist('pagination-service').PaginationService;
  MapperService           = dist('mapper-service').MapperService;
  TemporalAnalyzerService = dist('temporal-service').TemporalAnalyzerService;
  ScrapeEngine            = dist('scrape-engine').ScrapeEngine;
  SchedulerService        = dist('scheduler-service').SchedulerService;
  MemoryMonitorService    = dist('memory-monitor').MemoryMonitorService;
  NotificationService     = dist('notification-service').NotificationService;
  BatchRunner             = dist('batch-runner').BatchRunner;
  LoadControlService      = dist('load-control').LoadControlService;
  AuthSessionService      = dist('auth/auth-session-service').AuthSessionService;
  registerIpcHandlers     = dist('ipc-handlers').registerIpcHandlers;
  buildHydratedWebsites   = dist('hydrate').buildHydratedWebsites;
  closeBrowser            = dist('resources/mapper/src/local_runner/browser_fetcher').closeBrowser;
} else {
  // Dev / full build: Vite-bundled imports
  const modules = await Promise.all([
    import('@/afda/backend/afda-backend/src/storage'),
    import('@/afda/backend/afda-backend/src/pagination-service'),
    import('@/afda/backend/afda-backend/src/mapper-service'),
    import('@/afda/backend/afda-backend/src/temporal-service'),
    import('@/afda/backend/afda-backend/src/scrape-engine'),
    import('@/afda/backend/afda-backend/src/scheduler-service'),
    import('@/afda/backend/afda-backend/src/memory-monitor'),
    import('@/afda/backend/afda-backend/src/notification-service'),
    import('@/afda/backend/afda-backend/src/batch-runner'),
    import('@/afda/backend/afda-backend/src/load-control'),
    import('@/afda/backend/afda-backend/src/auth/auth-session-service'),
    import('@/afda/backend/afda-backend/src/ipc-handlers'),
    import('@/afda/backend/afda-backend/src/hydrate'),
    import('@/afda/backend/afda-backend/resources/mapper/src/local_runner/browser_fetcher'),
  ]);
  [
    { StorageService },
    { PaginationService },
    { MapperService },
    { TemporalAnalyzerService },
    { ScrapeEngine },
    { SchedulerService },
    { MemoryMonitorService },
    { NotificationService },
    { BatchRunner },
    { LoadControlService },
    { AuthSessionService },
    { registerIpcHandlers },
    { buildHydratedWebsites },
    { closeBrowser },
  ] = modules as any[];
}
```

> **Important:** The rest of `afdaHandler` (service initialization, IPC registration, cleanup) is unchanged — all variables are now in scope regardless of which branch ran.

- [ ] **Step 4: Commit**

```bash
git add src/core-app/ipc/main/afdaHandler.ts
git commit -m "feat: afdaHandler accepts addonPath for production pack loading"
```

---

## Task 10: Dynamic module loading in `skedulosaHandler.ts`

**Files:**
- Modify: `src/core-app/ipc/main/skedulosaHandler.ts`

`skedulosaHandler` imports `registerVideoNemesisIpcHandlers` from a static path. When `addonPath` is provided, load from the pack's `dist/index` instead.

- [ ] **Step 1: Add `createRequire` import**

```ts
import { createRequire } from 'module';
```

- [ ] **Step 2: Change static import to a conditional dynamic load**

Remove the static import at the top:
```ts
// Remove:
import { registerVideoNemesisIpcHandlers } from '@/skedulosa/backend/video-nemesis-toolkit/dist/index';
```

- [ ] **Step 3: Update function signature**

```ts
export const skedulosaHandler = (
  mainWindow: BrowserWindow,
  addonPath?: string,
): (() => void) => {
```

- [ ] **Step 4: Add loader at top of function body (before `resolveYtDlpPath` call)**

```ts
let registerVideoNemesisIpcHandlers: any;

if (addonPath) {
  const nativeRequire = createRequire(import.meta.url);
  registerVideoNemesisIpcHandlers = nativeRequire(
    path.join(addonPath, 'dist', 'index'),
  ).registerVideoNemesisIpcHandlers;
} else {
  // Dev / full build path — import is hoisted at module level via Vite
  ({ registerVideoNemesisIpcHandlers } = await import(
    /* @vite-ignore */ '@/skedulosa/backend/video-nemesis-toolkit/dist/index'
  ) as any);
}
```

> **Note:** The `skedulosaHandler` function is currently synchronous (returns `() => void`, not `Promise`). Adding `await import(...)` makes it async. Update the return type to `Promise<() => void>` and update `registerHandlers.ts` to `await skedulosaHandler(...)`.

- [ ] **Step 5: Update `registerHandlers.ts` to await skedulosaHandler**

In `registerHandlers.ts`, change:
```ts
collect(skedulosaHandler(mainWindow, addonPathSkedulosa));
```
To:
```ts
collect(await skedulosaHandler(mainWindow, addonPathSkedulosa));
```

- [ ] **Step 6: Commit**

```bash
git add src/core-app/ipc/main/skedulosaHandler.ts src/core-app/ipc/main/registerHandlers.ts
git commit -m "feat: skedulosaHandler accepts addonPath for production pack loading"
```

---

## Task 11: `forge.config.ts` — lite installer build

**Files:**
- Modify: `forge.config.ts`

Exclude both backend directories from the packaged app. Remove the `postPackage` copy hooks for backends (the lite installer doesn't bundle them at all).

- [ ] **Step 1: Add `packagerConfig.ignore` rules**

In `forge.config.ts`, add `ignore` to `packagerConfig`:

```ts
packagerConfig: {
  asar: true,
  icon: './src/assets/logo/downlodr_icon.png',
  name: 'Downlodr',
  executableName: 'Downlodr',
  extraResource: [
    './src/assets/logo',
    './ffmpeg.exe',
    './ggml-base.bin',
    './ffprobe.exe',
  ],
  ignore: [
    /src[/\\]afda[/\\]backend[/\\]afda-backend/,
    /src[/\\]skedulosa[/\\]backend[/\\]video-nemesis-toolkit/,
  ],
},
```

- [ ] **Step 2: Remove backend `postPackage` copy hooks**

In the `postPackage` hook, remove these two blocks:

```ts
// Block 1 — remove entirely:
const toolkitNodeModules = path.resolve(__dirname, 'src/skedulosa/backend/video-nemesis-toolkit/node_modules');
const unpackedNodeModules = ...;
for (const pkg of ['better-sqlite3', 'bindings', 'file-uri-to-path']) {
  // ...
}

// Block 2 — remove entirely:
const afdaNodeModules = path.resolve(__dirname, 'src/afda/backend/afda-backend/node_modules');
const unpackedAfdaNodeModules = ...;
// await fs.cp(afdaNodeModules, ...)
```

Keep only the `yt-dlp.exe` copy in `postPackage`:

```ts
postPackage: async (forgeConfig, packageResult) => {
  for (const outputPath of packageResult.outputPaths) {
    try {
      await fs.copyFile(
        path.resolve(__dirname, 'yt-dlp.exe'),
        path.join(outputPath, 'yt-dlp.exe'),
      );
      console.log(`✓ Copied yt-dlp.exe to ${outputPath}`);
    } catch (error) {
      console.error(`Failed to copy yt-dlp.exe for ${outputPath}:`, error);
    }
  }
},
```

- [ ] **Step 3: Commit**

```bash
git add forge.config.ts
git commit -m "build: exclude backend submodules from lite installer"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Storage location (`userData/downlodr-add-ons/`) — Task 5/6
- ✅ Detection logic (`detectAddon`) — Task 7
- ✅ Path resolution priority (3 levels) — Task 7
- ✅ Version contract (`downlodrAddons` in `package.json`) — Task 1
- ✅ Pack states (not-installed / ready / outdated) — existing `addonStore.ts`
- ✅ IPC channels (`addon:status`, `addon:download`, `addon:progress`, `addon:complete`) — existing `addonManager.ts`
- ✅ Google Drive bypass URL — Task 5
- ✅ Error handling (temp cleanup on failure) — Task 5
- ✅ UI `AddonGate` — existing + Task 3
- ✅ "Restart to activate" toast — Task 4
- ✅ Conditional handler registration — Task 8
- ✅ `resolveAddonPath` in handlers — Tasks 9/10
- ✅ `forge.config.ts` ignore rules — Task 11
- ✅ `addons.config.json` (separate from `package.json`) — Task 1
- ✅ Separate zips per pack — reflected in download logic (one pack at a time)

**Open items not in scope for this plan:**
- Uploading real pack zips to Google Drive and replacing `PLACEHOLDER_*` file IDs in `addons.config.json`
- Testing the full lite installer build end-to-end (requires a packaged build)
- The `outdated` update flow (same code path as initial install — already handled by `AddonGate`)
