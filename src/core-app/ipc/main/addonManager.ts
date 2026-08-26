import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import * as path from 'path';
import yauzl from 'yauzl';

export type PackName = 'afda-backend' | 'video-nemesis-toolkit';

// How often download progress is forwarded to the renderer (ms).
// HTTP response 'data' events can fire hundreds of times per second for a
// large pack, and each send is a synchronous main->renderer IPC call, so
// this must be throttled to avoid flooding the renderer and causing lag.
const PROGRESS_THROTTLE_MS = 150;

export type AddonStatus =
 | { status: 'not-installed'; path: null }
 | { status: 'ready'; path: string }
 | { status: 'outdated'; installedVersion: string; path: string };

/**
 * Compares two semver-ish versions, returning <0, 0 or >0 like a sort
 * comparator. Only the numeric release segments are considered — a prerelease
 * or build suffix (`1.2.0-beta.1`, `1.2.0+abc`) compares equal to its release,
 * which is what we want here: a prerelease pack shouldn't nag as outdated.
 *
 * Returns null if either side isn't parseable, so callers can decline to judge
 * rather than guess.
 */
function compareVersions(a: string, b: string): number | null {
 const parse = (v: string): number[] | null => {
  if (typeof v !== 'string') return null;
  const release = v.trim().split(/[-+]/)[0];
  const parts = release.split('.');
  if (parts.length === 0 || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.map(Number);
 };

 const left = parse(a);
 const right = parse(b);
 if (!left || !right) return null;

 const len = Math.max(left.length, right.length);
 for (let i = 0; i < len; i += 1) {
  const diff = (left[i] ?? 0) - (right[i] ?? 0);
  if (diff !== 0) return diff;
 }
 return 0;
}

// Maps pack → a function that destroys its current HTTP request
const activeDownloads = new Map<PackName, () => void>();
// Tracks packs that were explicitly cancelled (so realDownload's catch doesn't re-send complete)
const cancelledPacks = new Set<PackName>();

function pendingDeleteMarkerPath(): string {
 return path.join(app.getPath('userData'), 'downlodr-add-ons', '.pending-delete.json');
}

function readPendingDeletes(): PackName[] {
 try {
  const raw = fs.readFileSync(pendingDeleteMarkerPath(), 'utf-8');
  return JSON.parse(raw);
 } catch {
  return [];
 }
}

function writePendingDeletes(packs: PackName[]): void {
 const markerPath = pendingDeleteMarkerPath();
 if (packs.length === 0) {
  fs.rm(markerPath, { force: true }, () => { });
  return;
 }
 fs.mkdirSync(path.dirname(markerPath), { recursive: true });
 fs.writeFileSync(markerPath, JSON.stringify(packs));
}

function markPendingDelete(packName: PackName): void {
 const pending = new Set(readPendingDeletes());
 pending.add(packName);
 writePendingDeletes([...pending]);
}

/**
 * Removes any addon directories that failed to delete last session (e.g. their
 * native module DLL was still locked by the running process on Windows). Must
 * run before any addon module is loaded, so the files are no longer in use.
 */
export async function applyPendingDeletes(): Promise<void> {
 const pending = readPendingDeletes();
 if (pending.length === 0) return;

 const stillPending: PackName[] = [];
 for (const packName of pending) {
  const addonPath = path.join(app.getPath('userData'), 'downlodr-add-ons', packName);
  try {
   // rm with force ignores missing paths, so no existsSync guard needed
   await fs.promises.rm(addonPath, { recursive: true, force: true });
  } catch (err) {
   console.error(`[addonManager] deferred delete failed for ${packName}:`, err);
   stillPending.push(packName);
  }
 }
 writePendingDeletes(stillPending);
}

export type SeedProgress = {
 packName: PackName;
 copiedBytes: number;
 totalBytes: number;
 /** 1-based index of the pack currently being seeded. */
 step: number;
 /** Number of packs actually being seeded this run (not always 2). */
 totalSteps: number;
};

/**
 * Recursively lists every file under `dir` that passes `filter`, with its
 * size. Used to compute an accurate byte total before copying, so the boot
 * splash can show a real percentage instead of an estimate.
 */
async function walkFiles(
 dir: string,
 filter: (absPath: string) => boolean,
): Promise<{ files: { src: string; size: number }[]; totalBytes: number }> {
 const files: { src: string; size: number }[] = [];
 let totalBytes = 0;

 const visit = async (current: string): Promise<void> => {
  const entries = await fs.promises.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
   const abs = path.join(current, entry.name);
   if (!filter(abs)) continue;
   if (entry.isDirectory()) {
    await visit(abs);
   } else if (entry.isFile()) {
    const stat = await fs.promises.stat(abs);
    files.push({ src: abs, size: stat.size });
    totalBytes += stat.size;
   }
   // Symlinks and other non-regular entries are skipped: these packs are
   // plain npm trees, and fs.promises.cp did not preserve them meaningfully
   // on Windows either.
  }
 };

 await visit(dir);
 return { files, totalBytes };
}

/**
 * Copies a pre-walked file list from `srcDir` to `destDir`, creating parent
 * directories as needed and reporting cumulative bytes copied. Progress is
 * throttled to PROGRESS_THROTTLE_MS, with a guaranteed final report, because
 * these packs contain tens of thousands of files and each report is a
 * synchronous main->renderer IPC send.
 */
async function copyFilesWithProgress(
 files: { src: string; size: number }[],
 srcDir: string,
 destDir: string,
 totalBytes: number,
 onBytes?: (copiedBytes: number, totalBytes: number) => void,
): Promise<void> {
 let copiedBytes = 0;
 let lastReport = 0;
 const madeDirs = new Set<string>();

 for (const file of files) {
  const rel = path.relative(srcDir, file.src);
  const dest = path.join(destDir, rel);
  const destParent = path.dirname(dest);
  if (!madeDirs.has(destParent)) {
   await fs.promises.mkdir(destParent, { recursive: true });
   madeDirs.add(destParent);
  }
  await fs.promises.copyFile(file.src, dest);
  copiedBytes += file.size;

  const now = Date.now();
  if (onBytes && now - lastReport >= PROGRESS_THROTTLE_MS) {
   lastReport = now;
   onBytes(copiedBytes, totalBytes);
  }
 }

 // Always emit a final 100% report, even if the last throttle window swallowed it.
 onBytes?.(copiedBytes, totalBytes);
}

// afda-backend and video-nemesis-toolkit ship as extraResource (plain
// folders outside the asar — see forge.config.ts) instead of being
// downloaded post-install. seedBuiltInPacks() below copies each one into
// userData/downlodr-add-ons/<pack> on first launch so it's found by the
// exact same detectAddon()/resolveAddonPath() check a downloaded add-on
// goes through — a package living partially inside an asar breaks
// directory-listing-based node_modules resolution for its non-native deps,
// so it can't just be pointed at directly the way this used to work.
const BUILT_IN_PACKS: Partial<Record<PackName, string>> = {
 'afda-backend': 'afda-backend__hidden',
 'video-nemesis-toolkit': 'video-nemesis-toolkit__hidden',
};

/**
 * Copies each built-in pack from its bundled extraResource location into
 * userData/downlodr-add-ons/<pack>, if it isn't already there at the
 * expected version. No-op in dev (resolveAddonPath's dev fallback already
 * reads straight from the source tree) and no-op once already seeded, so
 * this doesn't re-copy ~700MB on every launch.
 *
 * Copies file-by-file rather than via fs.promises.cp so the total byte count
 * is known up front and `onProgress` can drive a real determinate progress
 * bar on the boot splash — this copy is the entire reason a cold first launch
 * takes as long as it does.
 */
export async function seedBuiltInPacks(
 onProgress?: (p: SeedProgress) => void,
): Promise<void> {
 if (!app.isPackaged) return;
 const entries = Object.entries(BUILT_IN_PACKS) as [PackName, string][];
 // Decide the full work list first so `totalSteps` reflects the packs
 // actually being seeded — a run that seeds one pack reports "1 of 1".
 const pending = entries.filter(
  ([packName]) => detectAddon(packName).status !== 'ready',
 );
 const totalSteps = pending.length;
 if (totalSteps === 0) return;

 let step = 0;
 for (const [packName, resourceDirName] of pending) {
  step += 1;
  const srcDir = path.join(process.resourcesPath, resourceDirName);
  const destDir = path.join(
   app.getPath('userData'),
   'downlodr-add-ons',
   packName,
  );
  // node_modules/electron is a leftover devDependency (used only to
  // run the pack standalone during its own development) — it ships
  // its own default_app.asar, and Electron's global fs patch throws
  // "Invalid package" the moment an lstat touches an .asar path
  // that isn't the host app's own, aborting the whole copy partway
  // through. Not needed at runtime anyway: code running inside an
  // already-loaded Electron process resolves require('electron') to
  // the built-in module regardless of node_modules contents.
  const marker = `${path.sep}node_modules${path.sep}electron`;
  const filter = (src: string) =>
   src !== srcDir + marker && !src.includes(marker + path.sep);

  try {
   await fs.promises.rm(destDir, { recursive: true, force: true });
   await fs.promises.mkdir(path.dirname(destDir), { recursive: true });

   const { files, totalBytes } = await walkFiles(srcDir, filter);
   // Report 0% up front so the bar appears immediately, before the first
   // throttle window elapses.
   onProgress?.({ packName, copiedBytes: 0, totalBytes, step, totalSteps });
   await copyFilesWithProgress(
    files,
    srcDir,
    destDir,
    totalBytes,
    (copiedBytes, total) =>
     onProgress?.({
      packName,
      copiedBytes,
      totalBytes: total,
      step,
      totalSteps,
     }),
   );

   // The pack's own better-sqlite3.node was compiled during its
   // standalone `npm install`, against plain Node's ABI — not
   // Electron's. Swap in the host app's own copy (already correctly
   // rebuilt for Electron and unpacked via forge.config.ts's
   // asar.unpack), same as the downloaded-pack flow below already does.
   patchNativeBinaries(destDir);
   console.log(
    `[addonManager] seeded built-in pack ${packName} into userData`,
   );
  } catch (err) {
   console.error(
    `[addonManager] failed to seed built-in pack ${packName}:`,
    err,
   );
  }
 }
}

export function detectAddon(packName: PackName): AddonStatus {
 const userDataPath = app.getPath('userData');
 const addonPath = path.join(userDataPath, 'downlodr-add-ons', packName);
 const pkgPath = path.join(addonPath, 'package.json');

 console.log(
  `[detectAddon] ${packName} — looking for package.json at: ${pkgPath}`,
 );
 console.log(`[detectAddon] ${packName} — exists: ${fs.existsSync(pkgPath)}`);

 if (!fs.existsSync(pkgPath)) return { status: 'not-installed', path: null };

 let version: string;
 try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  version = pkg.version;
 } catch {
  console.log(`[detectAddon] ${packName} — failed to parse package.json`);
  return { status: 'not-installed', path: null };
 }

 // addons.config.json is the single source of truth: the same entry carries
 // the version and the downloadUrl, so bumping a pack is one edit and the two
 // can't drift apart.
 const expected = loadAddonsConfig()[packName]?.version;
 const comparison =
  expected === undefined ? null : compareVersions(version, expected);
 console.log(
  `[detectAddon] ${packName} — installed: ${version}, expected: ${expected}`,
 );

 // Only an installed version strictly *older* than the config is outdated.
 // An unknown or unparseable version is left alone rather than flagged, so a
 // pack that runs ahead of the config never nags for an update that would
 // re-install the exact same build.
 if (comparison !== null && comparison < 0) {
  return { status: 'outdated', installedVersion: version, path: addonPath };
 }

 return { status: 'ready', path: addonPath };
}

/**
 * Returns the base directory for a pack, checked in priority order:
 *  1. userData/downlodr-add-ons/<pack>        (downloaded add-on)
 *  2. app.asar.unpacked/src/.../              (full packaged build)
 *  3. app.getAppPath()/src/.../               (dev environment)
 *
 * Returns the first path that contains a package.json, or the dev path as fallback.
 */
export function resolveAddonPath(packName: PackName): string {
 const SRC_SUBPATHS: Record<PackName, string> = {
  'afda-backend': path.join('src', 'afda', 'backend', 'afda-backend'),
  'video-nemesis-toolkit': path.join('src', 'skedulosa', 'backend', 'video-nemesis-toolkit'),
 };
 const srcSubpath = SRC_SUBPATHS[packName];

 // Priority 1: userData downloaded pack
 const userDataPack = path.join(
  app.getPath('userData'),
  'downlodr-add-ons',
  packName,
 );
 if (fs.existsSync(path.join(userDataPack, 'package.json')))
  return userDataPack;

 // Priority 2: app.asar.unpacked (packaged full build)
 if (process.resourcesPath) {
  const unpackedPack = path.join(
   process.resourcesPath,
   'app.asar.unpacked',
   srcSubpath,
  );
  if (fs.existsSync(path.join(unpackedPack, 'package.json')))
   return unpackedPack;
 }

 // Priority 3: dev environment
 return path.join(app.getAppPath(), srcSubpath);
}

function loadAddonsConfig(): Record<
 string,
 { version: string; fileId: string; downloadUrl: string }
> {
 const configPath = path.join(app.getAppPath(), 'addons.config.json');
 try {
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
 } catch {
  return {};
 }
}

function downloadToFile(
 url: string,
 destPath: string,
 onProgress: (percent: number) => void,
 onRequestReady: (cancelFn: () => void) => void,
 isCancelled: () => boolean,
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
       if (isCancelled()) return reject(new Error('Cancelled'));
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
    let lastProgressSentTime = 0;

    const out = fs.createWriteStream(destPath);
    response.on('data', (chunk: Buffer) => {
     downloaded += chunk.length;
     const percent =
      total > 0
       ? Math.round((downloaded / total) * 100)
       : Math.min(99, Math.round((downloaded / estimatedSize) * 100));
     const now = Date.now();
     if (now - lastProgressSentTime < PROGRESS_THROTTLE_MS) return;
     lastProgressSentTime = now;
     onProgress(percent);
    });
    response.pipe(out);
    out.on('finish', () => {
     out.close();
     resolve();
    });
    out.on('error', (err) => {
     fs.unlink(destPath, () => { });
     reject(err);
    });
   });
   // Register the cancel function for the most recent request (updated on each redirect hop)
   onRequestReady(() => req.destroy(new Error('Cancelled')));
   req.on('error', (err) => {
    fs.unlink(destPath, () => { });
    reject(err);
   });
  };
  attempt(url);
 });
}

function extractZip(zipPath: string, destDir: string): Promise<void> {
 return new Promise((resolve, reject) => {
  yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
   if (err) return reject(err);

   zipfile.readEntry();

   zipfile.on('entry', (entry) => {
    // Skip .asar files — Electron intercepts fs writes to these paths
    if (entry.fileName.endsWith('.asar')) {
     zipfile.readEntry();
     return;
    }

    const entryPath = path.join(destDir, entry.fileName);

    if (/\/$/.test(entry.fileName)) {
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

function patchNativeBinaries(destDir: string): void {
 // Native .node binaries in the pack may be compiled for a different Electron/Node version.
 // Replace them with the app's own binaries which are already compiled for the correct ABI.
 const appRoot = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked')
  : app.getAppPath();

 const natives = [
  path.join(
   'node_modules',
   'better-sqlite3',
   'build',
   'Release',
   'better_sqlite3.node',
  ),
 ];

 for (const rel of natives) {
  const src = path.join(appRoot, rel);
  const dest = path.join(destDir, rel);
  if (fs.existsSync(src) && fs.existsSync(path.dirname(dest))) {
   fs.copyFileSync(src, dest);
   console.log(`[addonManager] patched native binary: ${rel}`);
  }
 }
}

function normalizeExtractedDir(destDir: string): void {
 if (fs.existsSync(path.join(destDir, 'package.json'))) {
  console.log(
   `[normalizeExtractedDir] package.json found at root — no normalization needed`,
  );
  return;
 }

 // Zip had a wrapping folder — find it and hoist its contents up one level
 const entries = fs.readdirSync(destDir);
 for (const entry of entries) {
  const subDir = path.join(destDir, entry);
  if (
   fs.statSync(subDir).isDirectory() &&
   fs.existsSync(path.join(subDir, 'package.json'))
  ) {
   console.log(
    `[normalizeExtractedDir] hoisting contents from wrapping folder: ${entry}`,
   );
   for (const item of fs.readdirSync(subDir)) {
    fs.renameSync(path.join(subDir, item), path.join(destDir, item));
   }
   fs.rmSync(subDir, { recursive: true, force: true });
   console.log(`[normalizeExtractedDir] done`);
   return;
  }
 }

 console.log(
  `[normalizeExtractedDir] WARNING: could not find package.json in extracted dir`,
 );
}

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
 activeDownloads.set(packName, () => { });

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
   () => cancelledPacks.has(packName),
  );

  await extractZip(tempZip, destDir);
  normalizeExtractedDir(destDir);
  patchNativeBinaries(destDir);

  fs.unlinkSync(tempZip);

  if (!cancelledPacks.has(packName)) {
   mainWindow.webContents.send('addon:complete', {
    pack: packName,
    success: true,
   });
  }
  cancelledPacks.delete(packName);
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

export function addonManagerHandler(mainWindow: BrowserWindow): () => void {
 const statusHandler = ipcMain.handle('addon:status', () => {
  return {
   afda: detectAddon('afda-backend'),
   skedulosa: detectAddon('video-nemesis-toolkit'),
  };
 });

 const downloadHandler = ipcMain.handle(
  'addon:download',
  (_event, { pack }: { pack: PackName }) => {
   realDownload(pack, mainWindow).catch((err) =>
    console.error('[addonManager] realDownload error:', err),
   );
   return { started: true };
  },
 );

 const restartHandler = ipcMain.handle('addon:restart', () => {
  app.relaunch();
  app.quit();
 });

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
    // Most likely cause on Windows: the addon's native module is still
    // loaded in this process and has a file lock on it. Defer the actual
    // removal to next launch, before the addon is loaded again.
    markPendingDelete(pack);
    return { success: false, deferred: true, error: String(err) };
   }
  },
 );

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

 void statusHandler;
 void downloadHandler;
 void restartHandler;
 void deleteHandler;
 void openFolderHandler;

 return () => {
  ipcMain.removeHandler('addon:status');
  ipcMain.removeHandler('addon:download');
  ipcMain.removeHandler('addon:restart');
  ipcMain.removeHandler('addon:delete');
  ipcMain.removeHandler('addon:openFolder');
  ipcMain.removeHandler('addon:cancel');
 };
}
