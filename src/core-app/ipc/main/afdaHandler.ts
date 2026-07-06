/**
 * AFDA (Article Fetcher & Detail Analyzer) IPC handler.
 * Registers all AFDA IPC handlers for direct integration (like Skedulosa).
 * This bridges AFDA services to Electron's IPC system.
 */

import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'url';

/**
 * Registers all AFDA IPC handlers.
 * @param mainWindow - The main window of the app (used to push events to the renderer)
 * @param addonPath - Optional path to the downloaded pack's root directory.
 *                    When set, loads services from dist/ via createRequire.
 *                    When undefined, falls through to Vite-bundled imports (dev/full build).
 * @returns cleanup function - stops AFDA services
 */
export const afdaHandler = async (
  mainWindow: BrowserWindow,
  addonPath?: string,
): Promise<() => void> => {
  const dbPath = path.join(app.getPath('userData'), 'afda.db');
  const initialMax = 6; // Default max concurrent scrapes

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
    // Production: load everything from the pack's single bundled dist/index.js
    const indexUrl = pathToFileURL(
      path.join(addonPath, 'dist', 'index.js'),
    ).href;
    const mod = await import(/* @vite-ignore */ indexUrl);
    StorageService = mod.StorageService;
    PaginationService = mod.PaginationService;
    MapperService = mod.MapperService;
    TemporalAnalyzerService = mod.TemporalAnalyzerService;
    ScrapeEngine = mod.ScrapeEngine;
    SchedulerService = mod.SchedulerService;
    MemoryMonitorService = mod.MemoryMonitorService;
    NotificationService = mod.NotificationService;
    BatchRunner = mod.BatchRunner;
    LoadControlService = mod.LoadControlService;
    AuthSessionService = mod.AuthSessionService;
    registerIpcHandlers = mod.registerIpcHandlers;
    buildHydratedWebsites = mod.buildHydratedWebsites;
    closeBrowser = mod.closeBrowser;
  } else if (process.env.NODE_ENV !== 'production') {
    // Dev only: Vite-bundled imports from source.
    // Guarded by NODE_ENV so Rollup eliminates this branch (and its require('axios') etc.)
    // from the production bundle entirely.
    const modules = await Promise.all([
      import('@/afda/backend/afda-backend__hidden/src/storage'),
      import('@/afda/backend/afda-backend__hidden/src/pagination-service'),
      import('@/afda/backend/afda-backend__hidden/src/mapper-service'),
      import('@/afda/backend/afda-backend__hidden/src/temporal-service'),
      import('@/afda/backend/afda-backend__hidden/src/scrape-engine'),
      import('@/afda/backend/afda-backend__hidden/src/scheduler-service'),
      import('@/afda/backend/afda-backend__hidden/src/memory-monitor'),
      import('@/afda/backend/afda-backend__hidden/src/notification-service'),
      import('@/afda/backend/afda-backend__hidden/src/batch-runner'),
      import('@/afda/backend/afda-backend__hidden/src/load-control'),
      import(
        '@/afda/backend/afda-backend__hidden/src/auth/auth-session-service'
      ),
      import('@/afda/backend/afda-backend__hidden/src/ipc-handlers'),
      import('@/afda/backend/afda-backend__hidden/src/hydrate'),
      import(
        '@/afda/backend/afda-backend__hidden/resources/mapper/src/local_runner/browser_fetcher'
      ),
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

  // Initialize AFDA services
  const storage = new StorageService(dbPath);
  const paginationService = new PaginationService();
  const mapperService = new MapperService(paginationService);
  const temporalService = new TemporalAnalyzerService(storage);
  const loadControl = new LoadControlService(initialMax);
  const scrapeEngine = new ScrapeEngine(storage, loadControl);
  const scheduler = new SchedulerService(storage, scrapeEngine);
  const memoryMonitor = new MemoryMonitorService();
  const notificationService = new NotificationService();
  const batchRunner = new BatchRunner(
    mapperService,
    temporalService,
    loadControl,
    () => mainWindow,
  );
  const authSession = new AuthSessionService(storage);

  // Configure services
  scrapeEngine.setAuthSession(authSession);
  scrapeEngine.setNotificationHook((payload) =>
    notificationService.notify(payload),
  );
  scrapeEngine.setJobUpdateHook((job) => memoryMonitor.addPhaseEvent(job));

  // Wire services to the window for push events
  mapperService.setMainWindow(mainWindow);
  paginationService.setMainWindow(mainWindow);
  temporalService.setMainWindow(mainWindow);
  scrapeEngine.setMainWindow(mainWindow);
  memoryMonitor?.start(mainWindow);
  notificationService.setMainWindow(mainWindow);
  notificationService.setOnShow(() => {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  // Register all AFDA IPC handlers
  registerIpcHandlers(
    {
      storage,
      mapper: mapperService,
      temporal: temporalService,
      scrapeEngine,
      scheduler,
      memoryMonitor,
      batchRunner,
      loadControl,
      authSession,
      getMainWindow: () => mainWindow,
    },
    {
      register: (channel, listener) => {
        ipcMain.handle(channel, listener);
      },
      sendToRenderer: (channel, payload) => {
        try {
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, payload);
          }
        } catch (err) {
          console.error(
            '[AFDA] sendToRenderer failed (renderer may be closing):',
            err,
          );
        }
      },
    },
  );

  // Hydrate renderer with data from SQLite once the page is ready
  const hydrateRenderer = () => {
    const websites = buildHydratedWebsites(storage);
    mainWindow.webContents.send('store:hydrate', { websites });
  };

  // Initial hydration if window is already loaded
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.on('did-finish-load', hydrateRenderer);
  } else {
    hydrateRenderer();
  }

  // Start scheduler
  scheduler.start();

  console.log('[AFDA] All services and IPC handlers registered');

  // Return cleanup function
  return () => {
    console.log('[AFDA] Cleaning up services...');
    scheduler.stop();
    memoryMonitor?.stop();
    closeBrowser().catch(console.error);
    storage.close();
    console.log('[AFDA] Cleanup complete');
  };
};
