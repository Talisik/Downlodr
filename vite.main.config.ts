import { existsSync } from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

// Keep native and browser-driver modules out of the Rollup bundle.
// These packages include runtime-only assets and use dynamic require().
// Shared with vite.afda-worker.config.ts so the AFDA utilityProcess worker
// build resolves the same native/add-on deps the same way, without
// duplicating this list.
export const electronBuildExternal = [
  // video-nemesis-toolkit native module (rewritten by rewrite-better-sqlite3-path)
  'better-sqlite3',
  // afda-backend runtime dependencies (rewritten by rewrite-external-modules).
  // axios and ws are NOT listed here: core main-process code also imports them
  // (appInfoHandler/httpClient use axios, mcpBridgeServer uses ws), so they must
  // be bundled into main.js — the packaged app ships no node_modules copy and no
  // src/ tree, so an external bare require would crash at startup. The afda
  // backend's own copies still resolve to its nested node_modules and stay
  // external via the path regex below.
  '@mozilla/readability',
  'cheerio',
  'chrono-node',
  'commander',
  'date-fns-tz',
  'jsdom',
  'natural',
  'p-limit',
  'playwright',
  'puppeteer',
  'sql.js',
  'stopword',
  'tldts',
  'turndown',
  'unidecode',
  'zod',
  /src\/afda\/backend\/afda-backend__hidden\/node_modules\/.*/,
  // video-nemesis-toolkit runtime dependencies
  'date-fns',
  'simple-statistics',
  /src\/skedulosa\/backend\/video-nemesis-toolkit__hidden\/node_modules\/.*/,
];

// The scheduled-download backend (video-nemesis-toolkit) is a gitignored,
// externally-provided package. When it isn't present (clean checkouts /
// macOS CI), the dev-only dynamic import in skedulosaHandler.ts (guarded by
// NODE_ENV but still a static specifier Rollup resolves at build time) would
// otherwise fail to resolve. Stub it out so the build still succeeds and
// Skedulosa's DB backend simply degrades instead of breaking the main
// process build. Production builds never reach this: the addonPath-based
// import there is dead-code-eliminated by the NODE_ENV define below.
const toolkitAvailable =
  existsSync(
    path.resolve(
      __dirname,
      'src/skedulosa/backend/video-nemesis-toolkit__hidden/dist/index.ts',
    ),
  ) ||
  existsSync(
    path.resolve(
      __dirname,
      'src/skedulosa/backend/video-nemesis-toolkit__hidden/dist/index.js',
    ),
  );

const VNT_STUB_ID = '\0optional-video-nemesis-toolkit-stub';
const optionalVideoNemesisToolkitStub = {
  // Provide a no-op stub for the optional video-nemesis-toolkit when it is
  // not vendored, so Rollup doesn't fail resolving its `dist/index`. Must
  // intercept at resolveId — by the time load() sees an id, Rollup has
  // already tried (and, for a missing file, failed) to resolve it normally.
  name: 'optional-video-nemesis-toolkit',
  resolveId(source: string) {
    if (
      !toolkitAvailable &&
      source.replace(/\\/g, '/').includes('video-nemesis-toolkit__hidden/dist/index')
    ) {
      return VNT_STUB_ID;
    }
    return null;
  },
  load(id: string) {
    if (id !== VNT_STUB_ID) return null;
    return (
      `// stub: video-nemesis-toolkit not vendored — Skedulosa DB backend disabled\n` +
      `export const registerVideoNemesisIpcHandlers = () => {\n` +
      `  console.warn('[skedulosa] video-nemesis-toolkit not bundled — scheduled-download backend disabled.');\n` +
      `};\n`
    );
  },
};

// Rewrite plugins that patch up require() calls for the externalized modules
// above so they resolve correctly both in dev and in the packaged app (where
// they live in app.asar.unpacked). Shared with vite.afda-worker.config.ts.
export const electronBuildRewritePlugins = [
  {
    // After Rollup emits the bundle, rewrite require() calls for afda-backend
    // dependencies to runtime expressions so Electron can find them both in
    // dev and in the packaged app (where they live in app.asar.unpacked).
    name: 'rewrite-external-modules',
    renderChunk(code: string) {
      const afdaBasePath = 'src/afda/backend/afda-backend__hidden/node_modules';
      const runtimeExpr =
        `(function(){` +
        `var _p=require('path'),_g=global.__electronPaths;` +
        `return _g.isPackaged` +
        ` ? _p.join(_g.resourcesPath,'app.asar.unpacked/${afdaBasePath}')` +
        ` : _p.join(_g.appPath,'${afdaBasePath}');` +
        `}())`;

      // Rewrite path-form requires (already have full afda-backend path).
      let result = code.replace(
        /require\(["']src\/afda\/backend\/afda-backend__hidden\/node_modules\/([^"']+)["']\)/g,
        `require((function(){var _b=${runtimeExpr};return require('path').join(_b,'$1');}()))`,
      );

      // Rewrite bare module requires for afda-backend dependencies.
      // These appear as require('axios') etc. after Rollup externalises them
      // and won't resolve in the packaged ASAR without this rewrite.
      // axios and ws are intentionally absent — they're bundled (core app
      // imports them), so a bare require() for them never reaches the output.
      const afdaModules = [
        '@mozilla/readability',
        'cheerio',
        'chrono-node',
        'commander',
        'date-fns-tz',
        'jsdom',
        'natural',
        'p-limit',
        'playwright',
        'puppeteer',
        'sql.js',
        'stopword',
        'tldts',
        'turndown',
        'unidecode',
        'zod',
      ];
      for (const mod of afdaModules) {
        const escaped = mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '\\/');
        result = result.replace(
          new RegExp(`require\\(["']${escaped}["']\\)`, 'g'),
          `require((function(){var _b=${runtimeExpr};return require('path').join(_b,'${mod}');}()))`,
        );
      }

      return result;
    },
  },
  {
    // Rewrite better-sqlite3 to load from app.asar.unpacked/node_modules (native
    // .node binaries cannot be loaded from inside an ASAR archive).
    name: 'rewrite-better-sqlite3-path',
    renderChunk(code: string) {
      const runtimeExpr =
        `(function(){` +
        `var _p=require('path'),_g=global.__electronPaths;` +
        `return _g.isPackaged` +
        ` ? _p.join(_g.resourcesPath,'app.asar.unpacked/node_modules/better-sqlite3')` +
        ` : _p.join(_g.appPath,'node_modules/better-sqlite3');` +
        `}())`;
      return code.replace(
        /require\(["']better-sqlite3["']\)/g,
        `require(${runtimeExpr})`,
      );
    },
  },
];

// https://vitejs.dev/config
export default defineConfig(({ mode }) => ({
  define: {
    // Explicit replacement lets Rollup statically evaluate `process.env.NODE_ENV !== 'production'`
    // as `false` in production builds, which eliminates the dev-only dynamic import branches in
    // afdaHandler.ts and skedulosaHandler.ts from the production bundle entirely.
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Rollup's CJS output hoists every `require()` call for an
        // externalized module (see the `external` list below — this
        // includes the rewritten better-sqlite3 require) into one
        // preamble block at the very top of the emitted chunk, executed
        // before ANY internal module's own top-level code — regardless of
        // where that module is imported from in main.ts's import order.
        // So `global.__electronPaths` must be populated even earlier than
        // that preamble; `banner` is prepended before it entirely. (This
        // banner is main-process-only — the AFDA utilityProcess worker
        // bundle, without Electron module access, populates the global via
        // its own env-var-based banner in vite.afda-worker.config.ts instead.)
        banner:
          "global.__electronPaths=(function(){var _e=require('electron');" +
          "return {isPackaged:_e.app.isPackaged,resourcesPath:process.resourcesPath," +
          "appPath:_e.app.getAppPath()};}());",
      },
      external: electronBuildExternal,
      plugins: [optionalVideoNemesisToolkitStub, ...electronBuildRewritePlugins],
    },
  },
}));
