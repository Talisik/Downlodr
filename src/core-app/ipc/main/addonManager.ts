import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import * as path from 'path';
import yauzl from 'yauzl';

export type PackName = 'afda-backend' | 'video-nemesis-toolkit' | 'smart-organize-backend';

const PROGRESS_THROTTLE_MS = 150;

export type AddonStatus =
  | { status: 'not-installed'; path: null }
  | { status: 'ready'; path: string }
  | { status: 'outdated'; installedVersion: string; path: string };

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

const activeDownloads = new Map<PackName, () => void>();
const cancelledPacks = new Set<PackName>();

let addonMainWindow: BrowserWindow | null = null;

export function registerAddonMainWindow(win: BrowserWindow | null): void {
  addonMainWindow = win;
}

export function isAddonDownloading(packName: PackName): boolean {
  return activeDownloads.has(packName);
}

export function startAddonDownload(packName: PackName): { started: boolean } {
  if (activeDownloads.has(packName)) return { started: false };
  if (!addonMainWindow || addonMainWindow.isDestroyed())
    return { started: false };
  activeDownloads.set(packName, () => {});
  realDownload(packName, addonMainWindow)
    .catch((err) =>
      console.error('[addonManager] realDownload error:', err),
    )
    .finally(() => activeDownloads.delete(packName));
  return { started: true };
}

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

export async function applyPendingDeletes(): Promise<void> {
  const pending = readPendingDeletes();
  if (pending.length === 0) return;

  const stillPending: PackName[] = [];
  for (const packName of pending) {
    const addonPath = path.join(app.getPath('userData'), 'downlodr-add-ons', packName);
    try {
      await fs.promises.rm(addonPath, { recursive: true, force: true });
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

  const expected = loadAddonsConfig()[packName]?.version;
  const comparison =
    expected === undefined ? null : compareVersions(version, expected);
  console.log(
    `[detectAddon] ${packName} — installed: ${version}, expected: ${expected}`,
  );

  if (comparison !== null && comparison < 0) {
    return { status: 'outdated', installedVersion: version, path: addonPath };
  }

  return { status: 'ready', path: addonPath };
}

export function resolveAddonPath(packName: PackName): string {
  const SRC_SUBPATHS: Record<PackName, string> = {
    'afda-backend': path.join('src', 'afda', 'backend', 'afda-backend'),
    'video-nemesis-toolkit': path.join('src', 'skedulosa', 'backend', 'video-nemesis-toolkit'),
    'smart-organize-backend': path.join('src', 'smart-organize', 'backend', 'smart-organize-backend__hidden'),
  };
  const srcSubpath = SRC_SUBPATHS[packName];

  const userDataPack = path.join(
    app.getPath('userData'),
    'downlodr-add-ons',
    packName,
  );
  if (fs.existsSync(path.join(userDataPack, 'package.json')))
    return userDataPack;

  if (process.resourcesPath) {
    const unpackedPack = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      srcSubpath,
    );
    if (fs.existsSync(path.join(unpackedPack, 'package.json')))
      return unpackedPack;
  }

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
  if (!packConfig?.downloadUrl) {
    mainWindow.webContents.send('addon:complete', {
      pack: packName,
      success: false,
      error: `No download URL configured for ${packName} in addons.config.json`,
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
      cancelledPacks.delete(packName);
      try { fs.unlinkSync(tempZip); } catch { }
      try { fs.rmSync(destDir, { recursive: true, force: true }); } catch { }
      return;
    }
    console.error(`[addonManager] download failed for ${packName}:`, err);
    try {
      fs.unlinkSync(tempZip);
    } catch {
    }
    try {
      fs.rmSync(destDir, { recursive: true, force: true });
    } catch {
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
  registerAddonMainWindow(mainWindow);
  const statusHandler = ipcMain.handle('addon:status', () => {
    return {
      afda: detectAddon('afda-backend'),
      skedulosa: detectAddon('video-nemesis-toolkit'),
      smartOrganize: detectAddon('smart-organize-backend'),
    };
  });

  const downloadHandler = ipcMain.handle(
    'addon:download',
    (_event, { pack }: { pack: PackName }) => startAddonDownload(pack),
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
