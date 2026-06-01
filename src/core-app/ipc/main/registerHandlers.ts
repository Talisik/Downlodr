import { BrowserWindow } from 'electron';
import { appBehaviorHandler } from './appBehaviorHandler';
import { appInfoHandler } from './appInfoHandler';
import { appPerformanceHandler } from './appPerformanceHandler';
import { browserHandler } from './browserHandler';
import { clipboardHandler } from './clipboardHandler';
import { devHandler } from './devHandler';
import { fileHandler } from './fileHandler';
import { pluginFunctionsHandler } from './pluginFunctionsHandler';
import { pluginHandler } from './pluginHandler';
import { skedulosaHandler } from './skedulosaHandler';
import { telemetryHandler } from './telemetryHandler';
import { transcriptHandler } from './transcriptHandler';
import { trayHandler, TrayHandlerOptions } from './trayHandler';
import { videoHandler } from './videoHandler';
import { ytdlpHandler } from './ytdlpHandler';

let handlersRegistered = false;

export type RegisterHandlersOptions = {
  tray?: TrayHandlerOptions;
};

export interface AppCleanup {
  /** Run all registered cleanup functions. Call once in the app's before-quit handler. */
  cleanup(): void;
}

export function registerMainIpcHandlers(
  mainWindow: BrowserWindow,
  options?: RegisterHandlersOptions,
): AppCleanup {
  if (handlersRegistered) {
    return { cleanup: () => {} };
  }

  const cleanups: (() => void)[] = [];

  const collect = (fn: (() => void) | void) => {
    if (typeof fn === 'function') cleanups.push(fn);
  };

  collect(appInfoHandler());
  collect(appBehaviorHandler(mainWindow));
  collect(appPerformanceHandler(mainWindow));
  collect(browserHandler(mainWindow));
  collect(clipboardHandler(mainWindow));
  collect(devHandler(mainWindow));
  collect(fileHandler(mainWindow));
  collect(pluginFunctionsHandler(mainWindow));
  collect(pluginHandler(mainWindow));
  collect(skedulosaHandler(mainWindow));
  collect(telemetryHandler(mainWindow));
  collect(transcriptHandler(mainWindow));
  collect(trayHandler(mainWindow, options?.tray));
  collect(videoHandler(mainWindow));
  collect(ytdlpHandler(mainWindow));

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
