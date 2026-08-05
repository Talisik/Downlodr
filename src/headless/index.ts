#!/usr/bin/env node
/**
 * Downlodr Headless Server
 *
 * Starts the MCP bridge (HTTP + WebSocket on 127.0.0.1:7185) without
 * launching the Electron UI. Claude can use all MCP tools as long as
 * this process is running.
 *
 * IMPORTANT: Cannot run at the same time as the Downlodr Electron app —
 * both would compete for port 7185 and the same token file.
 *
 * Usage:
 *   yarn headless
 *   node dist/headless.js
 */

import * as net from 'net';
import * as path from 'path';
import { getUserDataPath } from '../core-app/utils/platformPaths';

// ─── Port conflict guard ─────────────────────────────────────────────────────

function checkPort(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const probe = net.createConnection({ port, host: '127.0.0.1' });
    probe.on('connect', () => {
      probe.destroy();
      reject(
        new Error(
          `Port ${port} is already in use.\n` +
            'The Downlodr Electron app may be running. Stop it before starting headless mode.',
        ),
      );
    });
    probe.on('error', () => {
      // Connection refused means the port is free — good.
      resolve();
    });
  });
}

// ─── Service initialisation ──────────────────────────────────────────────────

async function startServices() {
  const [
    { StorageService },
    { ScrapeEngine },
    { SchedulerService },
    { LoadControlService },
    { AuthSessionService },
    { buildHydratedWebsites },
  ] = await Promise.all([
    import('@/afda/backend/afda-backend/src/storage'),
    import('@/afda/backend/afda-backend/src/scrape-engine'),
    import('@/afda/backend/afda-backend/src/scheduler-service'),
    import('@/afda/backend/afda-backend/src/load-control'),
    import('@/afda/backend/afda-backend/src/auth/auth-session-service'),
    import('@/afda/backend/afda-backend/src/hydrate'),
  ]);

  const userData = getUserDataPath();
  const dbPath = path.join(userData, 'afda.db');
  const skedulosaDbPath = path.join(userData, 'skedulosa.db');

  const storage = new StorageService(dbPath);
  const loadControl = new LoadControlService(6);
  const scrapeEngine = new ScrapeEngine(storage, loadControl);
  const scheduler = new SchedulerService(storage, scrapeEngine);
  const authSession = new AuthSessionService(storage);

  scrapeEngine.setAuthSession(authSession);

  // Wire the bridge's broadcastEvent as the event sink so scrape progress
  // events flow to connected WebSocket clients even in headless mode.
  const { registerAfdaServiceProxy, registerSkedulosaServices, broadcastEvent } =
    await import('../core-app/ipc/main/mcpBridgeServer');

  scrapeEngine.setEventSink((channel, payload) => broadcastEvent(channel, payload));

  // Headless mode has no utility-process worker — the AFDA services below
  // are constructed directly in this process. Plug them into the bridge's
  // callService/isReady hook the same way afdaWorkerProxy.ts does for
  // Electron mode (registerAfdaServiceProxy), dispatching service calls the
  // same way afda-worker/entry.ts's handleServiceCall does: special-cased
  // 'meta' methods (hasService / buildHydratedWebsites), then a plain
  // services[service][method](...args) lookup for everything else.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const services: Record<string, any> = { storage, scrapeEngine, scheduler };
  registerAfdaServiceProxy({
    callService: async <T = unknown>(
      service: string,
      method: string,
      args: unknown[] = [],
    ): Promise<T> => {
      if (service === 'meta' && method === 'hasService') {
        return Boolean(services[args[0] as string]) as unknown as T;
      }
      if (service === 'meta' && method === 'buildHydratedWebsites') {
        return buildHydratedWebsites(storage) as T;
      }
      const svc = services[service];
      if (!svc) throw new Error(`AFDA service not available: ${service}`);
      const fn = svc[method];
      if (typeof fn !== 'function')
        throw new Error(`AFDA service "${service}" has no method "${method}"`);
      return fn.apply(svc, args) as Promise<T>;
    },
    // No async worker boot in headless mode — services above are ready as
    // soon as they're constructed, synchronously.
    isReady: () => true,
  });
  registerSkedulosaServices({ dbPath: skedulosaDbPath });

  scheduler.start();

  return { scheduler };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { MCP_BRIDGE_PORT, startMcpBridgeServer, stopMcpBridgeServer } =
    await import('../core-app/ipc/main/mcpBridgeServer');

  process.stderr.write('[downlodr-headless] Checking port availability...\n');

  try {
    await checkPort(MCP_BRIDGE_PORT);
  } catch (err) {
    process.stderr.write(`[downlodr-headless] ERROR: ${(err as Error).message}\n`);
    process.exit(1);
  }

  process.stderr.write('[downlodr-headless] Initialising services...\n');
  const { scheduler } = await startServices();

  startMcpBridgeServer();
  process.stderr.write('[downlodr-headless] Bridge running on 127.0.0.1:7185. Press Ctrl+C to stop.\n');

  const shutdown = () => {
    process.stderr.write('\n[downlodr-headless] Shutting down...\n');
    try { scheduler.stop(); } catch { /* ignore */ }
    stopMcpBridgeServer();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  process.stderr.write(`[downlodr-headless] Fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
