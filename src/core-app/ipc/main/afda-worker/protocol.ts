// src/core-app/ipc/main/afda-worker/protocol.ts

/**
 * Message protocol between the main process (afdaWorkerProxy.ts) and the
 * AFDA utilityProcess worker (entry.ts). Type-only module — no Electron or
 * Node imports, safe to import from both sides.
 */

export interface AfdaWorkerInitMessage {
  type: 'init';
  dbPath: string;
  addonPath?: string;
  // isPackaged/resourcesPath/appPath are intentionally NOT here: the worker
  // needs those before this message could possibly arrive (Rollup's hoisted
  // external-require preamble runs before any message-handler code), so
  // they're passed as env vars at fork time instead (see afdaWorkerProxy.ts,
  // Task 3, and vite.afda-worker.config.ts's banner, Task 2 Step 5).
  initialWindowState: {
    isDestroyed: boolean;
    isMinimized: boolean;
    isLoading: boolean;
    isVisible: boolean;
  };
}

export type AfdaWorkerInbound =
  | AfdaWorkerInitMessage
  | { type: 'call'; callId: string; channel: string; args: unknown[] }
  | {
      type: 'service-call';
      callId: string;
      service: string;
      method: string;
      args: unknown[];
    }
  | { type: 'window-reply'; callId: string; result?: unknown; error?: string }
  | { type: 'window-state'; isDestroyed: boolean; isMinimized: boolean; isLoading: boolean; isVisible: boolean }
  | { type: 'shutdown' };

export type AfdaWorkerOutbound =
  | { type: 'ready'; channels: string[] }
  | { type: 'reply'; callId: string; result?: unknown; error?: string }
  | { type: 'push'; channel: string; payload: unknown }
  | { type: 'window-call'; callId: string; method: string; args: unknown[] }
  | { type: 'init-error'; error: string }
  | { type: 'shutdown-complete' };
