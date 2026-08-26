/**
 * Wires the MCP/chat bridge's request/response round-trip to the main
 * window's renderer for the CORE download list (see
 * src/downlodr/store/download/registerChatBridge.ts, registered
 * unconditionally in App.tsx — it has no dependency on any add-on).
 *
 * This used to be registered from inside skedulosaHandler.ts, which only
 * runs when the video-nemesis-toolkit (Subscriptions) add-on is installed —
 * so in a packaged build without that add-on, `list_downloads`/
 * `stop_download`/etc. failed with "the main window is not ready" even
 * though downloading a single video (which doesn't touch this bridge at
 * all) worked fine. Core download list querying has nothing to do with
 * Subscriptions, so this must run unconditionally alongside the other
 * always-on Phase 1 handlers in registerHandlers.ts.
 */
import { BrowserWindow, ipcMain } from 'electron';
import { registerRendererQuery } from './mcpBridgeServer';

export function coreDownloadBridgeHandler(mainWindow: BrowserWindow): void {
  let _rendererReqSeq = 0;
  registerRendererQuery((kind, payload, timeoutMs) => {
    return new Promise((resolve, reject) => {
      if (mainWindow.isDestroyed()) {
        reject(new Error('Main window is not available.'));
        return;
      }
      const requestId = `dlq_${Date.now()}_${_rendererReqSeq++}`;
      const replyChannel = `downloads:reply:${requestId}`;
      const timer = setTimeout(() => {
        ipcMain.removeAllListeners(replyChannel);
        reject(
          new Error(
            'The app did not respond in time (download list unavailable).',
          ),
        );
      }, timeoutMs);
      ipcMain.once(
        replyChannel,
        (_event, reply: { ok: boolean; result?: unknown; error?: string }) => {
          clearTimeout(timer);
          if (reply && reply.ok) resolve(reply.result);
          else reject(new Error(reply?.error || 'Download request failed.'));
        },
      );
      // kind === 'query' → downloads:query, kind === 'command' → downloads:command
      mainWindow.webContents.send(`downloads:${kind}`, {
        requestId,
        replyChannel,
        payload,
      });
    });
  });
}
