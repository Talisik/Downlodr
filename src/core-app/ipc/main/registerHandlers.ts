import { app, BrowserWindow } from 'electron';
import { appBehaviorHandler } from './appBehaviorHandler';
import { appInfoHandler } from './appInfoHandler';
import { appPerformanceHandler } from './appPerformanceHandler';
import { browserHandler } from './browserHandler';
import { clipboardHandler } from './clipboardHandler';
import { devHandler } from './devHandler';
import { fileHandler } from './fileHandler';
import { pluginFunctionsHandler } from './pluginFunctionsHandler';
import { pluginHandler } from './pluginHandler';
import { afdaHandler } from './afdaHandler';
import { skedulosaHandler } from './skedulosaHandler';
import { addonManagerHandler, detectAddon, resolveAddonPath } from './addonManager';
import { telemetryHandler } from './telemetryHandler';
import { transcriptHandler } from './transcriptHandler';
import { trayHandler, TrayHandlerOptions } from './trayHandler';
import { videoHandler } from './videoHandler';
import { ytdlpHandler, runYtdlpCheckAndUpdate } from './ytdlpHandler';

let handlersRegistered = false;

export type RegisterHandlersOptions = {
  tray?: TrayHandlerOptions;
};

export interface AppCleanup {
  /** Run all registered cleanup functions. Call once in the app's before-quit handler. */
  cleanup(): void;
}

export async function registerMainIpcHandlers(
  mainWindow: BrowserWindow,
  options?: RegisterHandlersOptions,
): Promise<AppCleanup> {
  if (handlersRegistered) {
    return { cleanup: () => {} };
  }

  const cleanups: (() => void)[] = [];

  const collect = (fn: (() => void) | void) => {
    if (typeof fn === 'function') cleanups.push(fn);
  };

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
  const afdaState = detectAddon('afda-backend');
  const addonPathAfda = afdaState.status === 'ready' ? resolveAddonPath('afda-backend') : undefined;
  if (addonPathAfda || !app.isPackaged) {
    try {
      collect(await afdaHandler(mainWindow, addonPathAfda));
    } catch (err) {
      console.error(`[addons] afdaHandler failed (addonPath: ${addonPathAfda ?? 'undefined'}):`, err);
    }
  } else {
    console.log(`[addons] afda-backend not ready (${afdaState.status}) — skipping handler registration`);
  }

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
  collect(telemetryHandler(mainWindow));
  collect(transcriptHandler(mainWindow));
  collect(trayHandler(mainWindow, options?.tray));
  collect(videoHandler(mainWindow));
  collect(ytdlpHandler(mainWindow));

  setTimeout(() => {
    void runYtdlpCheckAndUpdate();
  }, 5000);

  handlersRegistered = true;

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
