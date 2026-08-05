import path from 'node:path';
import { pathToFileURL } from 'url';
import { FakeWindow } from './fakeWindow';
import type { AfdaWorkerInbound, AfdaWorkerOutbound } from './protocol';

function post(msg: AfdaWorkerOutbound): void {
  process.parentPort.postMessage(msg);
}

type ChannelHandler = (event: null, ...args: unknown[]) => unknown | Promise<unknown>;
const channelHandlers = new Map<string, ChannelHandler>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let services: Record<string, any> = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let buildHydratedWebsitesFn: ((storage: any) => unknown) | null = null;

async function initAfda(init: Extract<AfdaWorkerInbound, { type: 'init' }>): Promise<void> {
  // global.__electronPaths is already populated by this point — see the
  // worker build's own output.banner (vite.afda-worker.config.ts), which
  // reads it from env vars utilityProcess.fork() passes at process start,
  // synchronously, before any bundled module code runs. Rollup's CJS output
  // hoists every externalized require() (better-sqlite3, afda-backend deps)
  // into one preamble at the top of the emitted chunk, ahead of ANY internal
  // module code — including this function, which only runs once an 'init'
  // message arrives, long after that preamble already executed. A
  // setElectronPaths() call here would be exactly as late as the one Task 1
  // proved doesn't work in main.ts's body — see task-1-report.md.

  const fakeWindow = new FakeWindow(init.initialWindowState, post);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    SocialFeedService: any,
    SocialSchedulerService: any,
    registerIpcHandlers: any,
    buildHydratedWebsites: any,
    closeBrowserFn: any;

  if (init.addonPath) {
    const indexUrl = pathToFileURL(path.join(init.addonPath, 'dist', 'index.js')).href;
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
    SocialFeedService = mod.SocialFeedService;
    SocialSchedulerService = mod.SocialSchedulerService;
    registerIpcHandlers = mod.registerIpcHandlers;
    buildHydratedWebsites = mod.buildHydratedWebsites;
    closeBrowserFn = mod.closeBrowser;
  } else if (process.env.NODE_ENV !== 'production') {
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
      import('@/afda/backend/afda-backend__hidden/src/auth/auth-session-service'),
      import('@/afda/backend/afda-backend__hidden/src/social-feed-service'),
      import('@/afda/backend/afda-backend__hidden/src/social-scheduler-service'),
      import('@/afda/backend/afda-backend__hidden/src/ipc-handlers'),
      import('@/afda/backend/afda-backend__hidden/src/hydrate'),
      import('@/afda/backend/afda-backend__hidden/resources/mapper/src/local_runner/browser_fetcher'),
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
      { SocialFeedService },
      { SocialSchedulerService },
      { registerIpcHandlers },
      { buildHydratedWebsites },
      { closeBrowser: closeBrowserFn },
    ] = modules as any[];
  }

  const initialMax = 1;
  const storage = new StorageService(init.dbPath);
  const paginationService = new PaginationService();
  const mapperService = new MapperService(paginationService);
  const temporalService = new TemporalAnalyzerService(storage);
  const loadControl = new LoadControlService(initialMax);
  const scrapeEngine = new ScrapeEngine(storage, loadControl);
  const scheduler = new SchedulerService(storage, scrapeEngine);
  const memoryMonitor = new MemoryMonitorService();
  const notificationService = new NotificationService();
  const batchRunner = new BatchRunner(mapperService, temporalService, loadControl, () => fakeWindow);
  const authSession = new AuthSessionService(storage);
  const socialFeed = typeof SocialFeedService === 'function' ? new SocialFeedService(storage) : undefined;
  const socialScheduler =
    socialFeed && typeof SocialSchedulerService === 'function'
      ? new SocialSchedulerService(storage, socialFeed)
      : undefined;
  if (!socialFeed) {
    console.warn(
      '[AFDA worker] SocialFeedService unavailable in the loaded afda-backend addon — social sources disabled.',
    );
  }

  scrapeEngine.setAuthSession(authSession);
  scrapeEngine.setNotificationHook((payload: unknown) => notificationService.notify(payload));
  scrapeEngine.setJobUpdateHook((job: unknown) => memoryMonitor.addPhaseEvent(job));

  mapperService.setMainWindow(fakeWindow);
  paginationService.setMainWindow(fakeWindow);
  temporalService.setMainWindow(fakeWindow);
  scrapeEngine.setMainWindow(fakeWindow);
  memoryMonitor?.start(fakeWindow);
  notificationService.setMainWindow(fakeWindow);
  notificationService.setOnShow(() => {
    if (fakeWindow.isMinimized()) fakeWindow.restore();
    fakeWindow.show();
    fakeWindow.focus();
  });

  services = {
    storage,
    scrapeEngine,
    scheduler,
    mapper: mapperService,
    temporal: temporalService,
    socialFeed,
    socialScheduler,
  };
  buildHydratedWebsitesFn = (s: unknown) => buildHydratedWebsites(s);

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
      socialFeed,
      socialScheduler,
      getMainWindow: () => fakeWindow,
    },
    {
      register: (channel: string, listener: ChannelHandler) => {
        channelHandlers.set(channel, listener);
      },
      sendToRenderer: (channel: string, payload: unknown) => {
        post({ type: 'push', channel, payload });
      },
    },
  );

  const hydrateRenderer = () => {
    post({ type: 'push', channel: 'store:hydrate', payload: { websites: buildHydratedWebsites(storage) } });
  };
  if (fakeWindow.webContents.isLoading()) {
    fakeWindow.webContents.on('did-finish-load', hydrateRenderer);
  } else {
    hydrateRenderer();
  }

  scheduler.start();
  socialScheduler?.start();

  console.log('[AFDA worker] All services and IPC handlers registered');
  post({ type: 'ready', channels: [...channelHandlers.keys()] });

  process.parentPort.on('message', (e) => handleMessage(e.data as AfdaWorkerInbound, fakeWindow, closeBrowserFn, storage, scheduler, socialScheduler, memoryMonitor));
}

function handleMessage(
  msg: AfdaWorkerInbound,
  fakeWindow: FakeWindow,
  closeBrowserFn: (() => Promise<void>) | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storage: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scheduler: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socialScheduler: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  memoryMonitor: any,
): void {
  if (msg.type === 'window-state') {
    fakeWindow.updateState({
      isDestroyed: msg.isDestroyed,
      isMinimized: msg.isMinimized,
      isLoading: msg.isLoading,
      isVisible: msg.isVisible,
    });
    return;
  }

  if (msg.type === 'call') {
    const handler = channelHandlers.get(msg.channel);
    if (!handler) {
      post({ type: 'reply', callId: msg.callId, error: `No handler for channel: ${msg.channel}` });
      return;
    }
    Promise.resolve(handler(null, ...msg.args))
      .then((result) => post({ type: 'reply', callId: msg.callId, result }))
      .catch((err) => post({ type: 'reply', callId: msg.callId, error: String(err?.message ?? err) }));
    return;
  }

  if (msg.type === 'service-call') {
    void handleServiceCall(msg.callId, msg.service, msg.method, msg.args);
    return;
  }

  if (msg.type === 'shutdown') {
    console.log('[AFDA worker] Shutting down...');
    scheduler.stop();
    socialScheduler?.stop();
    memoryMonitor?.stop();
    Promise.resolve(closeBrowserFn?.())
      .catch(console.error)
      .finally(() => {
        storage.close();
        post({ type: 'shutdown-complete' });
        process.exit(0);
      });
  }
}

async function handleServiceCall(
  callId: string,
  service: string,
  method: string,
  args: unknown[],
): Promise<void> {
  try {
    if (service === 'meta' && method === 'hasService') {
      post({ type: 'reply', callId, result: Boolean(services[args[0] as string]) });
      return;
    }
    if (service === 'meta' && method === 'buildHydratedWebsites') {
      post({ type: 'reply', callId, result: buildHydratedWebsitesFn?.(services.storage) });
      return;
    }
    const svc = services[service];
    if (!svc) throw new Error(`AFDA service not available: ${service}`);
    const fn = svc[method];
    if (typeof fn !== 'function') throw new Error(`AFDA service "${service}" has no method "${method}"`);
    const result = await fn.apply(svc, args);
    post({ type: 'reply', callId, result });
  } catch (err) {
    post({ type: 'reply', callId, error: err instanceof Error ? err.message : String(err) });
  }
}

process.parentPort.once('message', (e) => {
  const msg = e.data as AfdaWorkerInbound;
  if (msg.type !== 'init') {
    post({ type: 'init-error', error: `Expected init message, got: ${msg.type}` });
    return;
  }
  initAfda(msg).catch((err) => {
    console.error('[AFDA worker] init failed:', err);
    post({ type: 'init-error', error: err instanceof Error ? err.message : String(err) });
  });
});
