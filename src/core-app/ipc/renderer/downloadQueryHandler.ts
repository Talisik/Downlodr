import { contextBridge, ipcRenderer } from 'electron';

/**
 * Renderer-side bridge for the core download list round-trip.
 *
 * The main process (chat bridge) cannot read the download Zustand store, which
 * lives here in the renderer. Main sends `downloads:query` / `downloads:command`
 * events; this bridge forwards them to a handler the renderer registers, and
 * sends the handler's result back on the per-request reply channel.
 *
 * Wiring lives in the renderer (see registerDownloadQueryBridge), which has
 * access to useDownloadStore. This file only exposes the transport.
 */

interface DownloadQueryEvent {
  requestId: string;
  replyChannel: string;
  payload: unknown;
}

contextBridge.exposeInMainWorld('downloadQueryBridge', {
  /**
   * Register the handler that answers list/read queries from the main process.
   * The callback receives the query payload and returns the result (or throws).
   */
  onQuery: (handler: (payload: unknown) => Promise<unknown> | unknown) => {
    const listener = async (
      _e: Electron.IpcRendererEvent,
      evt: DownloadQueryEvent,
    ) => {
      try {
        const result = await handler(evt.payload);
        ipcRenderer.send(evt.replyChannel, { ok: true, result });
      } catch (err) {
        ipcRenderer.send(evt.replyChannel, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };
    ipcRenderer.on('downloads:query', listener);
    return () => ipcRenderer.removeListener('downloads:query', listener);
  },

  /**
   * Register the handler that performs mutating commands (rename/delete/etc.)
   * from the main process. Same reply contract as onQuery.
   */
  onCommand: (handler: (payload: unknown) => Promise<unknown> | unknown) => {
    const listener = async (
      _e: Electron.IpcRendererEvent,
      evt: DownloadQueryEvent,
    ) => {
      try {
        const result = await handler(evt.payload);
        ipcRenderer.send(evt.replyChannel, { ok: true, result });
      } catch (err) {
        ipcRenderer.send(evt.replyChannel, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };
    ipcRenderer.on('downloads:command', listener);
    return () => ipcRenderer.removeListener('downloads:command', listener);
  },
});
