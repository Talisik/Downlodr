# Scraper Live Log in ToolkitTestPage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forward `[scraper]` console.log messages from the Electron main process to a new Section 14 in ToolkitTestPage via IPC.

**Architecture:** Intercept `console.log` in `skedulosaHandler.ts` (main process) — messages starting with `[scraper]` are forwarded to the renderer via `webContents.send('toolkit:scraper:channelLog', msg)`. The renderer bridge exposes `onScraperChannelLog` / `removeScraperChannelLogListener` on `window.skedulosaBridge`. ToolkitTestPage subscribes and renders a capped rolling log.

**Tech Stack:** Electron IPC (contextBridge / ipcRenderer), TypeScript, React + Zustand, Tailwind CSS

---

## File Map

| File | Change |
|---|---|
| `src/core-app/ipc/main/skedulosaHandler.ts` | Add `console.log` intercept before `registerVideoNemesisIpcHandlers` |
| `src/core-app/ipc/renderer/skedulosaHandler.ts` | Add `onScraperChannelLog` + `removeScraperChannelLogListener` to `contextBridge.exposeInMainWorld` |
| `src/global.d.ts` | Add two new method signatures to `skedulosaBridge` interface |
| `src/skedulosa/pages/ToolkitTestPage.tsx` | Add Section 14 — Scraper Live Log |

---

## Task 1: Main process — intercept `[scraper]` console.log messages

**Files:**
- Modify: `src/core-app/ipc/main/skedulosaHandler.ts:37-41`

### Context

`skedulosaHandler.ts` currently looks like this at lines 37–56:

```ts
export const skedulosaHandler = (mainWindow: BrowserWindow): (() => void) => {
  const ytDlpPath = resolveYtDlpPath();
  const dbPath = path.join(app.getPath('userData'), 'skedulosa.db');

  const { cleanup } = registerVideoNemesisIpcHandlers(ipcMain, {
    dbPath,
    ytDlpPath,
    sendToRenderer: (channel, payload) => {
      ...
    },
  });
```

- [ ] **Step 1: Add the console.log intercept**

Insert the following block between line 39 (`const dbPath = ...`) and line 41 (`const { cleanup } = ...`):

```ts
  const _origLog = console.log;
  console.log = (...args: unknown[]) => {
    _origLog(...args);
    const msg = args[0];
    if (typeof msg === 'string' && msg.startsWith('[scraper]')) {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('toolkit:scraper:channelLog', msg);
      }
    }
  };
```

The result should be:

```ts
export const skedulosaHandler = (mainWindow: BrowserWindow): (() => void) => {
  const ytDlpPath = resolveYtDlpPath();
  const dbPath = path.join(app.getPath('userData'), 'skedulosa.db');

  const _origLog = console.log;
  console.log = (...args: unknown[]) => {
    _origLog(...args);
    const msg = args[0];
    if (typeof msg === 'string' && msg.startsWith('[scraper]')) {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('toolkit:scraper:channelLog', msg);
      }
    }
  };

  const { cleanup } = registerVideoNemesisIpcHandlers(ipcMain, {
    dbPath,
    ytDlpPath,
    sendToRenderer: (channel, payload) => {
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `yarn tsc --noEmit`
Expected: No new errors related to `skedulosaHandler.ts`

---

## Task 2: Renderer bridge — expose `onScraperChannelLog` on `window.skedulosaBridge`

**Files:**
- Modify: `src/core-app/ipc/renderer/skedulosaHandler.ts:230-238`
- Modify: `src/global.d.ts:494-497`

### Context

The renderer bridge currently ends at lines 230–238:

```ts
  /** Remove push event listeners (call on component unmount) */
  removeDownloadQueueListener: () => {
    ipcRenderer.removeAllListeners('toolkit:downloadQueue:pushed');
  },

  removeScraperStatusListener: () => {
    ipcRenderer.removeAllListeners('toolkit:scraper:status');
  },
});
```

The `global.d.ts` push events section currently ends at lines 492–497:

```ts
      // Push Events
      onDownloadQueuePushed: (callback: (tasks: unknown[]) => void) => void;
      onScraperStatus: (callback: (status: { phase: string; nextRunAt?: string }) => void) => void;
      removeDownloadQueueListener: () => void;
      removeScraperStatusListener: () => void;
    };
```

- [ ] **Step 3: Add the two new methods to the renderer bridge**

Replace lines 230–238 of `src/core-app/ipc/renderer/skedulosaHandler.ts` with:

```ts
  /** Remove push event listeners (call on component unmount) */
  removeDownloadQueueListener: () => {
    ipcRenderer.removeAllListeners('toolkit:downloadQueue:pushed');
  },

  removeScraperStatusListener: () => {
    ipcRenderer.removeAllListeners('toolkit:scraper:status');
  },

  /** Called for each [scraper] console.log message from the main process */
  onScraperChannelLog: (callback: (message: string) => void) => {
    ipcRenderer.on('toolkit:scraper:channelLog', (_event, message) =>
      callback(message),
    );
  },

  removeScraperChannelLogListener: () => {
    ipcRenderer.removeAllListeners('toolkit:scraper:channelLog');
  },
});
```

- [ ] **Step 4: Add the two new method signatures to `global.d.ts`**

Replace lines 492–497 of `src/global.d.ts` with:

```ts
      // Push Events
      onDownloadQueuePushed: (callback: (tasks: unknown[]) => void) => void;
      onScraperStatus: (callback: (status: { phase: string; nextRunAt?: string }) => void) => void;
      removeDownloadQueueListener: () => void;
      removeScraperStatusListener: () => void;
      onScraperChannelLog: (callback: (message: string) => void) => void;
      removeScraperChannelLogListener: () => void;
    };
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `yarn tsc --noEmit`
Expected: No new errors

---

## Task 3: ToolkitTestPage — add Section 14 (Scraper Live Log)

**Files:**
- Modify: `src/skedulosa/pages/ToolkitTestPage.tsx`

### Context

The page currently has a `useEffect` cleanup at lines 452–460 and then the main return JSX. The last `</Section>` closes at line 902 before `</div>` at line 903 and `);` at line 904.

- [ ] **Step 6: Add state for the scraper channel log**

In `ToolkitTestPage`, after the existing `const [scraperEvents, setScraperEvents] = useState<string[]>([]);` state (around line 417), add:

```ts
  const [channelLogEntries, setChannelLogEntries] = useState<string[]>([]);
  const [channelLogListening, setChannelLogListening] = useState(false);
  const channelLogListenedRef = useRef(false);
```

- [ ] **Step 7: Add start/stop handlers for the channel log**

After the existing `stopListening` function (around line 449), add:

```ts
  function startChannelLogListening() {
    if (channelLogListenedRef.current || !bridge) return;
    channelLogListenedRef.current = true;
    setChannelLogListening(true);

    bridge.onScraperChannelLog((message) => {
      const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
      setChannelLogEntries((prev) => {
        const next = [`[${ts}] ${message}`, ...prev];
        return next.length > 100 ? next.slice(0, 100) : next;
      });
    });
  }

  function stopChannelLogListening() {
    bridge?.removeScraperChannelLogListener();
    channelLogListenedRef.current = false;
    setChannelLogListening(false);
  }
```

- [ ] **Step 8: Add cleanup to the existing useEffect**

The existing `useEffect` at lines 452–460 currently cleans up push event listeners on unmount:

```ts
  useEffect(() => {
    return () => {
      if (listenedRef.current && bridge) {
        bridge.removeDownloadQueueListener();
        bridge.removeScraperStatusListener();
      }
    };
  }, []);
```

Replace it with:

```ts
  useEffect(() => {
    return () => {
      if (listenedRef.current && bridge) {
        bridge.removeDownloadQueueListener();
        bridge.removeScraperStatusListener();
      }
      if (channelLogListenedRef.current && bridge) {
        bridge.removeScraperChannelLogListener();
      }
    };
  }, []);
```

- [ ] **Step 9: Add Section 14 JSX**

Just before the closing `</div>` of the page's return (after the last `</Section>` around line 902), add:

```tsx
      {/* ── 14. scraper live log ── */}
      <Section
        title="14. Scraper Live Log"
        description="Forwards every [scraper] console.log from the main process in real time. Start listening, then trigger a scraper run from Section 8 or 12."
      >
        <div className="flex gap-2 items-center">
          {!channelLogListening ? (
            <RunBtn onClick={startChannelLogListening} label="Start listening" />
          ) : (
            <RunBtn
              onClick={stopChannelLogListening}
              label="Stop listening"
              variant="danger"
            />
          )}
          {channelLogEntries.length > 0 && (
            <RunBtn
              onClick={() => setChannelLogEntries([])}
              label="Clear"
              variant="neutral"
            />
          )}
          <span
            className={`self-center text-xs ${
              channelLogListening
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-gray-400'
            }`}
          >
            {channelLogListening ? 'Listening…' : 'Not listening'}
          </span>
        </div>

        <div className="mt-3 rounded border border-gray-200 dark:border-darkModeCompliment bg-white dark:bg-darkMode p-2 min-h-[72px] max-h-72 overflow-auto space-y-0.5">
          {channelLogEntries.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No messages yet</p>
          ) : (
            channelLogEntries.map((entry, i) => {
              const isNemesis = entry.includes('Nemesis is scraping');
              return (
                <p
                  key={i}
                  className={`text-xs font-mono ${
                    isNemesis
                      ? 'text-orange-500 dark:text-orange-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {entry}
                </p>
              );
            })
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Buffer capped at 100 entries. Newest entries appear at the top.
        </p>
      </Section>
```

- [ ] **Step 10: Verify TypeScript compiles**

Run: `yarn tsc --noEmit`
Expected: No new errors

- [ ] **Step 11: Start the app and verify manually**

Run: `yarn start`

Checklist:
1. Navigate to `/skedulosa/toolkit-test`
2. Section 14 appears at the bottom with "Start listening" button
3. Click "Start listening" — button switches to "Stop listening", status shows "Listening…"
4. In Section 8, click "Scraper: run once (all)"
5. Within a few seconds, orange `[scraper] Nemesis is scraping "X"...` lines appear in Section 14
6. Terminal output still shows the same `[scraper]` messages (unchanged)
7. Click "Stop listening" — button reverts, no new entries appear
8. Click "Clear" — log empties
9. Navigating away and back does not leave zombie listeners

---

## Self-Review

**Spec coverage:**
- ✅ console.log intercept in skedulosaHandler.ts → Task 1
- ✅ renderer bridge onScraperChannelLog / removeScraperChannelLogListener → Task 2
- ✅ global.d.ts type declarations → Task 2
- ✅ ToolkitTestPage Section 14 with start/stop, cap at 100, timestamps, orange highlight → Task 3
- ✅ Cleanup on Stop + component unmount → Steps 7, 8
- ✅ Terminal output preserved → Step 1 (`_origLog` called first)
- ✅ No dist patching, no yt-dlp processes → confirmed by approach

**No placeholders or TBDs found.**

**Type consistency:** `onScraperChannelLog(callback: (message: string) => void)` defined in Task 2 (renderer bridge + global.d.ts), used identically in Task 3 (ToolkitTestPage). `removeScraperChannelLogListener()` consistent across all three usages. ✅
