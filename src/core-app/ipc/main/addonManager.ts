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

const EXPECTED_VERSIONS: Record<PackName, string> = {
  'afda-backend': '1.2.0',
  'video-nemesis-toolkit': '1.0.0',
};

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
    fs.rm(markerPath, { force: true }, () => {});
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
export function applyPendingDeletes(): void {
  const pending = readPendingDeletes();
  if (pending.length === 0) return;

  const stillPending: PackName[] = [];
  for (const packName of pending) {
    const addonPath = path.join(app.getPath('userData'), 'downlodr-add-ons', packName);
    try {
      if (fs.existsSync(addonPath)) {
        fs.rmSync(addonPath, { recursive: true, force: true });
      }
    } catch (err) {
      console.error(`[addonManager] deferred delete failed for ${packName}:`, err);
      stillPending.push(packName);
    }
  }
  writePendingDeletes(stillPending);
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

  const expected = EXPECTED_VERSIONS[packName];
  console.log(
    `[detectAddon] ${packName} — installed: ${version}, expected: ${expected}`,
  );

  if (version !== expected) {
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
  const srcSubpath =
    packName === 'afda-backend'
      ? path.join('src', 'afda', 'backend', 'afda-backend')
      : path.join('src', 'skedulosa', 'backend', 'video-nemesis-toolkit');

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
