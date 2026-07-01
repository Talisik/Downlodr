# Fix: Skedulosa DB Crash on App Close

**Date:** 2026-03-26
**Error:** `TypeError: The database connection is not open` at `Database.prepare`
**Affected file:** `src/skedulosa/backend/video-nemesis-toolkit/dist/ipc/register.js`

---

## What the Error Looked Like

```
Uncaught Exception:
TypeError: The database connection is not open
  at Database.prepare
  (src/skedulosa/backend/video-nemesis-toolkit/dist/...:21)
  at listDownloadTasks (.vite/build/main.js:25299)
  at Immediate.<anonymous> (.vite/build/main.js:27784)
  at process.processImmediate (node:internal/timers:483:21)
```

Only appeared when closing the app. Only started surfacing after the skedulosa UI pages were built out and the scraper was actively running.

---

## Root Cause

In `register.js`, the scraper's `onRunComplete` callback schedules a `setImmediate` to push pending tasks to the renderer:

```js
onRunComplete: () => {
    setImmediate(() => {
        const tasks = downloadTasksData.listDownloadTasks(db, "pending"); // line 39
        options.sendToRenderer(channel, tasks);
    });
},
```

The `cleanup()` function (called on `before-quit`) does this:

```js
cleanup: () => {
    downloadWorker.stop();
    scraper.stop();
    db.close(); // closes the SQLite connection synchronously
},
```

**The race condition:**

1. Scraper finishes a channel check → `onRunComplete` fires → `setImmediate` is queued
2. User closes app → `before-quit` fires → `cleanup()` runs → `db.close()` is called
3. Node processes the event loop → the pending `setImmediate` runs
4. `listDownloadTasks(db)` calls `db.prepare(...)` on an already-closed DB → **crash**

`setImmediate` callbacks always run after the current synchronous code finishes. So even though `scraper.stop()` is called before `db.close()`, the queued `setImmediate` still fires afterward.

---

## Why It Only Appeared After UI Changes

The user's edits (new analytics, activity log, and downloads tabs) did **not** cause this bug. They exposed it.

- **Before:** Skedulosa pages were placeholder stubs. The scraper was not being tested or actively used, so `onRunComplete` never fired near app close.
- **After:** Pages were built out with real data. The user started testing the skedulosa feature, subscriptions were set up, and the scraper was actively running. Closing the app while the scraper had just completed a run hit the race condition.

---

## The Fix

Added a `db.open` guard (a built-in `better-sqlite3` property) inside the `setImmediate` callback:

```js
// register.js — inside onRunComplete
setImmediate(() => {
    if (!db.open) return;  // <-- guard added here
    const tasks = downloadTasksData.listDownloadTasks(db, "pending");
    options.sendToRenderer(channel, tasks);
});
```

`db.open` returns `false` after `db.close()` is called. If the DB is already closed when the `setImmediate` fires, we bail out safely instead of crashing.

---

## Files Changed

| File | Change |
|------|--------|
| `src/skedulosa/backend/video-nemesis-toolkit/dist/ipc/register.js` | Added `if (!db.open) return;` guard on line 39 |

---

## Notes

- This is a compiled dist file (the toolkit's `src/` directory is empty). The fix must be applied directly to the dist.
- If the toolkit is ever rebuilt from source, this guard needs to be re-applied to the source TypeScript before building.
- The `db.open` property is part of the `better-sqlite3` API and is always reliable.
