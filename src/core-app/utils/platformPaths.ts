/**
 * Platform-aware path helpers that work in both Electron and headless Node.js.
 *
 * In an Electron process the paths are the same ones Electron derives from
 * app.getPath('userData') / app.getAppPath(). In headless mode we replicate
 * Electron's own conventions so the token file, DB files, etc. land in the
 * same place whether the app or the headless server wrote them.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

const APP_NAME = 'Downlodr';

export function getUserDataPath(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
    case 'win32':
      return path.join(
        process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'),
        APP_NAME,
      );
    default:
      return path.join(
        process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'),
        APP_NAME,
      );
  }
}

export function getAppVersion(): string {
  // Walk up from __dirname to find package.json
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(candidate, 'utf-8')) as { version?: string; name?: string };
        if (pkg.name === 'downlodr' || pkg.version) return pkg.version ?? '0.0.0';
      } catch { /* continue */ }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '0.0.0';
}
