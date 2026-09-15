export interface AfdaWorkerInitMessage {
  type: 'init';
  dbPath: string;
  addonPath?: string;
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
