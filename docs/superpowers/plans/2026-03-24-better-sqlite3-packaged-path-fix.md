# better-sqlite3 Packaged Path Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix "Cannot find module better-sqlite3" crash on QA/end-user machines by replacing the build-time absolute path with a runtime-resolved path and enabling native binary unpacking from ASAR.

**Architecture:** The Vite main-process build externalizes `better-sqlite3` and rewrites its `require()` to a hardcoded absolute path at build time. That path is the developer's source tree, which does not exist on other machines. The fix replaces the hardcoded string with a runtime JS expression that branches on `app.isPackaged`, and adds `AutoUnpackNativesPlugin` so `better_sqlite3.node` is extracted from the ASAR into `app.asar.unpacked/` during packaging.

**Tech Stack:** Electron Forge, Vite, `@electron-forge/plugin-auto-unpack-natives` (already in devDependencies)

---

### Task 1: Wire up `AutoUnpackNativesPlugin` in forge.config.ts

**Files:**
- Modify: `forge.config.ts`

**Background:** `@electron-forge/plugin-auto-unpack-natives` is already installed but not used. It scans the packaged app for `.node` files and moves them into `app.asar.unpacked/` so Electron can load them. Without it, `better_sqlite3.node` ends up inside the ASAR where native binaries cannot be executed.

- [ ] **Step 1: Add the import**

In `forge.config.ts`, add this import near the top (after the existing imports):

```ts
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
```

- [ ] **Step 2: Add the plugin to the plugins array**

In the `plugins` array (currently has `VitePlugin` and `FusesPlugin`), prepend `AutoUnpackNativesPlugin`:

```ts
plugins: [
  new AutoUnpackNativesPlugin({}),   // <-- add this line
  new VitePlugin({
    // ... existing config unchanged ...
  }),
  new FusesPlugin({
    // ... existing config unchanged ...
  }),
],
```

- [ ] **Step 3: Verify the file compiles**

```bash
yarn lint
```

Expected: no new errors introduced.

---

### Task 2: Replace build-time absolute path with runtime expression in vite.main.config.ts

**Files:**
- Modify: `vite.main.config.ts`

**Background:** The `rewrite-better-sqlite3-path` Rollup plugin currently resolves the path to `better-sqlite3` at Vite build time using `path.resolve(__dirname, '...')`. The resulting absolute string (e.g. `C:\Users\Mika\Desktop\...`) is baked into the bundle. On any other machine the path doesn't exist, causing a "Cannot find module" crash at app startup.

The fix writes a **runtime JS expression** into the bundle instead of a static string. At runtime:
- **Dev** (`app.isPackaged === false`): resolves from `app.getAppPath()` — the project root in the source tree
- **Packaged** (`app.isPackaged === true`): resolves from `process.resourcesPath + '/app.asar.unpacked/'` — where `AutoUnpackNativesPlugin` places the extracted binary

- [ ] **Step 1: Replace the plugin body**

The current `renderChunk` body in `vite.main.config.ts` is:

```ts
renderChunk(code: string) {
  const escaped = JSON.stringify(betterSqlite3Path);
  return code.replace(
    /require\(["']better-sqlite3["']\)/g,
    `require(${escaped})`,
  );
},
```

Replace it with:

```ts
renderChunk(code: string) {
  const relPath =
    'src/skedulosa/backend/video-nemesis-toolkit/node_modules/better-sqlite3';
  const runtimeExpr =
    `(require('electron').app.isPackaged` +
    ` ? require('path').join(process.resourcesPath, 'app.asar.unpacked/${relPath}')` +
    ` : require('path').join(require('electron').app.getAppPath(), '${relPath}'))`;
  return code.replace(
    /require\(["']better-sqlite3["']\)/g,
    `require(${runtimeExpr})`,
  );
},
```

- [ ] **Step 2: Remove the now-unused `betterSqlite3Path` constant and `path` import**

Delete these lines near the top of `vite.main.config.ts`:

```ts
import path from 'path';   // <-- delete this line too, it becomes unused

const betterSqlite3Path = path.resolve(
  __dirname,
  'src/skedulosa/backend/video-nemesis-toolkit/node_modules/better-sqlite3',
);
```

- [ ] **Step 3: Verify the file compiles**

```bash
yarn lint
```

Expected: no errors.

---

### Task 3: Smoke-test in development mode

**Goal:** Confirm the app still launches correctly in dev mode (where `app.isPackaged` is false and the source tree path is used).

- [ ] **Step 1: Start the app**

```bash
yarn start
```

Expected: App launches without errors. The Skedulosa feature (scheduled downloads) should load without a crash in the main process.

- [ ] **Step 2: Check for module errors**

Watch the terminal output for any `Cannot find module` or `TypeError` from the main process. There should be none.

---

### Task 4: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add forge.config.ts vite.main.config.ts
git commit -m "fix: resolve better-sqlite3 path at runtime for packaged builds

Build-time absolute path baked by vite.main.config.ts did not exist
on machines other than the developer's. Replace with a runtime
expression that branches on app.isPackaged, and add
AutoUnpackNativesPlugin so better_sqlite3.node is extracted from
the ASAR into app.asar.unpacked/ during packaging."
```
