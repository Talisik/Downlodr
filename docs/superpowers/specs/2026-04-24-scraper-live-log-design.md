# Design: Scraper Live Log in ToolkitTestPage

**Date:** 2026-04-24  
**Branch:** fix/minor-bug-ui-fixes  
**Scope:** Surface `[scraper]` terminal log messages to the renderer inside a new Section 14 of ToolkitTestPage. No dist patching, no new yt-dlp processes.

---

## Problem

The scraper worker emits `console.log("[scraper] Nemesis is scraping ...")` messages that are visible in the Electron main process terminal but not in the frontend. Developers have no way to see per-channel scrape progress from the UI.

---

## Approach

Intercept `console.log` in the main process (`skedulosaHandler.ts`). Any message starting with `[scraper]` is forwarded to the renderer via `mainWindow.webContents.send('toolkit:scraper:channelLog', message)` in addition to being printed normally. No dist files are patched; no new yt-dlp processes are spawned.

---

## Architecture

```
Main process console.log (already running)
  └─ patched in skedulosaHandler.ts
       ├─ _origLog(...args)           ← terminal output preserved
       └─ if msg.startsWith('[scraper]')
            └─ webContents.send('toolkit:scraper:channelLog', msg)
                 └─ ipcRenderer.on('toolkit:scraper:channelLog', cb)
                      └─ window.skedulosaBridge.onScraperChannelLog(cb)
                           └─ ToolkitTestPage Section 14
```

---

## Files to Change

### 1. `src/core-app/ipc/main/skedulosaHandler.ts`

After the `mainWindow` reference is in scope, before `registerVideoNemesisIpcHandlers`, patch `console.log` once:

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

No cleanup needed — the override lasts for the lifetime of the app window, which matches the scraper's lifetime.

### 2. `src/core-app/ipc/renderer/skedulosaHandler.ts`

Add two entries alongside the existing `onScraperStatus` / `removeScraperStatusListener` pair:

```ts
onScraperChannelLog: (callback: (message: string) => void) => {
  ipcRenderer.on('toolkit:scraper:channelLog', (_event, message) => callback(message));
},
removeScraperChannelLogListener: () => {
  ipcRenderer.removeAllListeners('toolkit:scraper:channelLog');
},
```

### 3. Window global type (`src/core-app/ipc/renderer/skedulosaHandler.ts` or `global.d.ts`)

Add to the `skedulosaBridge` interface:

```ts
onScraperChannelLog: (callback: (message: string) => void) => void;
removeScraperChannelLogListener: () => void;
```

### 4. `src/core-app/ipc/composeWindowApi.ts`

Wire the two new methods into `window.skedulosaBridge` exactly as the other listener methods are wired.

### 5. `src/skedulosa/pages/ToolkitTestPage.tsx`

Add **Section 14 — Scraper Live Log** at the bottom of the page:

- Start / Stop listening buttons (same pattern as Section 9)
- Rolling log array, capped at **100 entries** to prevent unbounded memory growth
- Each entry timestamped `[HH:MM:SS.mmm]` on arrival
- `[scraper] Nemesis is scraping` lines highlighted orange; all other `[scraper]` lines in grey
- `removeScraperChannelLogListener()` called on Stop and on component unmount

---

## Performance

| Concern | Impact |
|---|---|
| `console.log` override cost | One `typeof` + one `startsWith` check per call — nanosecond cost |
| `webContents.send` | Fire-and-forget async; does not block main process or scraper |
| yt-dlp processes | Zero — this only forwards a string that was already being printed |
| Frontend memory | Capped at 100 log entries; oldest entries dropped |
| Terminal output | Unchanged — `_origLog` is always called first |

---

## Out of Scope

- Showing scraper logs outside ToolkitTestPage (e.g. production UI, toasts)
- Structured parsing of the log message (channel name, cutoff date extraction)
- Persisting the log to disk
- Filtering / searching the log

---

## Success Criteria

1. Running a scraper from ToolkitTestPage causes `[scraper] Nemesis is scraping "X"...` to appear in Section 14 with a timestamp
2. Terminal output is identical to before
3. No new yt-dlp processes appear in Task Manager
4. Stop button and component unmount both clean up the IPC listener
5. Log buffer never exceeds 100 entries
