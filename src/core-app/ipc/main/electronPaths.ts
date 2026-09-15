/**
 * Rollup-rewritten require() calls (see vite.main.config.ts) need
 * {isPackaged, resourcesPath, appPath} to resolve native/add-on dependency
 * paths at runtime. main.js has real Electron access and can read these from
 * `app`/`process`. utilityProcess-forked scripts (e.g. afda-worker/entry.ts)
 * do NOT have access to the `electron` module, so they receive these values
 * via an init message from main and store them here the same way.
 */
export interface ElectronPaths {
  isPackaged: boolean;
  resourcesPath: string;
  appPath: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __electronPaths: ElectronPaths | undefined;
}

export function setElectronPaths(paths: ElectronPaths): void {
  globalThis.__electronPaths = paths;
}

export function getElectronPaths(): ElectronPaths {
  if (!globalThis.__electronPaths) {
    throw new Error(
      'electronPaths not initialized — call setElectronPaths() before any ' +
        'code that resolves native/add-on dependency paths.',
    );
  }
  return globalThis.__electronPaths;
}
