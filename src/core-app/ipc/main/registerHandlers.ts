import { app, BrowserWindow } from 'electron';
import path from 'path';
import { appBehaviorHandler } from './appBehaviorHandler';
import { appInfoHandler } from './appInfoHandler';
import { appPerformanceHandler } from './appPerformanceHandler';
import { browserHandler } from './browserHandler';
import { clipboardHandler } from './clipboardHandler';
import { devHandler } from './devHandler';
import { fileHandler } from './fileHandler';
import { pluginFunctionsHandler } from './pluginFunctionsHandler';
import { pluginHandler } from './pluginHandler';
import { startAfdaWorker } from './afdaWorkerProxy';
import { coreDownloadBridgeHandler } from './coreDownloadBridgeHandler';
import { skedulosaHandler } from './skedulosaHandler';
import {
  addonManagerHandler,
  applyPendingDeletes,
  detectAddon,
  resolveAddonPath,
  seedBuiltInPacks,
  type SeedProgress,
} from './addonManager';
import { telemetryHandler } from './telemetryHandler';
import { transcriptHandler } from './transcriptHandler';
import { trayHandler, TrayHandlerOptions } from './trayHandler';
import { vadHandler } from './vadHandler';
import { videoHandler } from './videoHandler';
import { ytdlpHandler, runYtdlpCheckAndUpdate } from './ytdlpHandler';
import { autoTagHandler } from '../../../auto-tag/ipc/main/tagHandler';

let handlersRegistered = false;

export type RegisterHandlersOptions = {
  tray?: TrayHandlerOptions;
};

export interface AppCleanup {
  /** Run all registered cleanup functions. Call once in the app's before-quit handler. */
  cleanup(): void;
}

/** User-facing names for the built-in packs, shown on the boot splash. */
const PACK_LABELS: Record<string, string> = {
  'afda-backend': 'Installing article services…',
  'video-nemesis-toolkit': 'Installing channel scheduler…',
};

export async function registerMainIpcHandlers(
  mainWindow: BrowserWindow,
  options?: RegisterHandlersOptions,
): Promise<AppCleanup> {
  if (handlersRegistered) {
    return { cleanup: () => { } };
  }
  handlersRegistered = true;

  const cleanups: (() => void)[] = [];

  const collect = (fn: (() => void) | void) => {
    if (typeof fn === 'function') cleanups.push(fn);
  };

  // ── Phase 1: cheap synchronous registrations ──────────────────────────
  // These are plain ipcMain.handle calls (microseconds each) and MUST all be
  // registered before the renderer runs so core bridges never hit
  // "No handler registered".
  collect(addonManagerHandler(mainWindow));
  collect(appInfoHandler());
  collect(appBehaviorHandler(mainWindow));
  collect(appPerformanceHandler(mainWindow));
  collect(browserHandler(mainWindow));
  collect(clipboardHandler(mainWindow));
  collect(devHandler(mainWindow));
  collect(fileHandler(mainWindow));
  collect(pluginFunctionsHandler(mainWindow));
  collect(pluginHandler(mainWindow));
  collect(telemetryHandler(mainWindow));
  collect(transcriptHandler(mainWindow));
  collect(vadHandler(mainWindow));
  collect(trayHandler(mainWindow, options?.tray));
  collect(videoHandler(mainWindow));
  collect(ytdlpHandler(mainWindow));
  collect(autoTagHandler());
  // Core download list bridge (list_downloads/stop_download/etc. via the chat
  // CLI) — must run unconditionally, NOT gated behind the Subscriptions
  // add-on the way skedulosaHandler() below is. It has no relation to it.
  coreDownloadBridgeHandler(mainWindow);

  // Fork the AFDA worker immediately, in parallel with window load — this
  // is what actually removes the "not responding" freeze for AFDA: nothing
  // heavy runs on the main thread, so the window stays responsive no matter
  // how long the worker's init takes.
  // Stale add-on dirs must be gone before detectAddon inspects them — this
  // is cheap fs I/O (no-op when nothing is pending), unlike the heavy
  // imports Phase 2 defers, so awaiting it here doesn't reintroduce a
  // startup freeze. Without this, a pending afda-backend delete/update
  // (from the addon manager) would let the worker fork against the stale
  // directory and then lock its files, breaking Phase 2's later cleanup.
  await applyPendingDeletes();

  // Seeds afda-backend/video-nemesis-toolkit into userData on first launch
  // of a packaged build (no-op in dev, no-op once already seeded) — see
  // seedBuiltInPacks()'s own comment for why they can't just be required
  // directly from the asar-bundled extraResource location.
  const sendSeedProgress = (p: SeedProgress) => {
    if (mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('boot:progress', {
      label: PACK_LABELS[p.packName] ?? 'Installing add-ons…',
      copiedBytes: p.copiedBytes,
      totalBytes: p.totalBytes,
      step: p.step,
      totalSteps: p.totalSteps,
    });
  };
  try {
    await seedBuiltInPacks(sendSeedProgress);
  } finally {
    // Always tear the bar down, even if seeding threw, so the splash falls
    // back to the spinner + boot:status text and boot continues.
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('boot:progress-done');
    }
  }
  const afdaState = detectAddon('afda-backend');
  const addonPathAfda = afdaState.status === 'ready' ? resolveAddonPath('afda-backend') : undefined;
  if (addonPathAfda || !app.isPackaged) {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('boot:status', 'Loading article services…');
    }
    const afdaDbPath = path.join(app.getPath('userData'), 'afda.db');
    collect(startAfdaWorker(mainWindow, afdaDbPath, addonPathAfda));
  } else {
    console.log(`[addons] afda-backend not ready (${afdaState.status}) — skipping worker start`);
  }

  // ── Phase 2: heavy add-on init, deferred until after first paint ──────
  // skedulosaHandler dynamically imports multi-MB add-on
  // bundles and open SQLite synchronously (better-sqlite3). Running them
  // before loadFile left the window white and unpumped ("Not responding"),
  // so they wait for did-finish-load — the splash in index.html is on
  // screen first. AFDA no longer participates in this deferred path — it
  // now forks into a utilityProcess worker in Phase 1 above (startAfdaWorker),
  // so nothing about its init can block the main thread at all.
  // The renderer keeps its boot splash up until this event arrives, so it
  // must be (re)sent on every page load once services are up — a reload
  // would otherwise wait on an event that already fired.
  let servicesReady = false;
  const announceServicesReady = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('addons:services-ready');
    }
  };
  mainWindow.webContents.on('did-finish-load', () => {
    if (servicesReady) announceServicesReady();
  });

  // Push a boot-stage message to the splash, then yield one tick so the IPC
  // message flushes to the renderer before the caller blocks the main
  // process on a heavy synchronous chunk (bundle import / SQLite open).
  const sendBootStatus = async (message: string) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('boot:status', message);
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  };

  const registerAddonHandlers = async () => {
    await sendBootStatus('Preparing add-ons…');
    // Stale add-on dirs must be gone before detectAddon inspects them.
    await applyPendingDeletes();

    await sendBootStatus('Loading channel scheduler…');
    const skedulosaState = detectAddon('video-nemesis-toolkit');
    const addonPathSkedulosa = skedulosaState.status === 'ready' ? resolveAddonPath('video-nemesis-toolkit') : undefined;
    if (addonPathSkedulosa || !app.isPackaged) {
      try {
        collect(await skedulosaHandler(mainWindow, addonPathSkedulosa));
      } catch (err) {
        console.error(`[addons] skedulosaHandler failed (addonPath: ${addonPathSkedulosa ?? 'undefined'}):`, err);
      }
    } else {
      console.log(`[addons] video-nemesis-toolkit not ready (${skedulosaState.status}) — skipping handler registration`);
    }

    await sendBootStatus('Finishing up…');
    // Renderer hooks that raced ahead of this registration re-run on this
    // event (scraper start, AFDA website/social-source loads).
    servicesReady = true;
    announceServicesReady();
    console.log('[addons] deferred add-on registration complete');
  };

  // Trigger on first paint (ready-to-show), not did-finish-load: the add-on
  // import blocks the main process ~1.3s+ in one atomic module evaluation, and
  // did-finish-load fires right when the renderer becomes interactive — the
  // worst moment to freeze. At ready-to-show the splash is painted but the
  // renderer is still parsing its own bundle, so the block overlaps time the
  // user is already waiting anyway. did-finish-load stays as a fallback in
  // case ready-to-show never fires (already-shown window edge cases).
  let phase2Started = false;
  const startPhase2 = () => {
    if (phase2Started) return;
    phase2Started = true;
    registerAddonHandlers().catch((err) =>
      console.error('[addons] deferred registration failed:', err),
    );
  };
  mainWindow.once('ready-to-show', startPhase2);
  mainWindow.webContents.once('did-finish-load', startPhase2);

  setTimeout(() => {
    void runYtdlpCheckAndUpdate();
  }, 5000);

  return {
    cleanup() {
      for (const fn of cleanups) {
        try {
          fn();
        } catch (err) {
          console.error('[cleanup] handler cleanup failed:', err);
        }
      }
    },
  };
}
