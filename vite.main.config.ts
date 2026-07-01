import path from 'path';
import { defineConfig } from 'vite';

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
      // Keep native and browser-driver modules out of the Rollup bundle.
      // These packages include runtime-only assets and use dynamic require().
      external: [
        // video-nemesis-toolkit native module (rewritten by rewrite-better-sqlite3-path)
        'better-sqlite3',
        // afda-backend runtime dependencies (rewritten by rewrite-external-modules)
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
        'ws',
        'zod',
        /src\/afda\/backend\/afda-backend__hidden\/node_modules\/.*/,
        // video-nemesis-toolkit runtime dependencies
        'date-fns',
        'simple-statistics',
        /src\/skedulosa\/backend\/video-nemesis-toolkit__hidden\/node_modules\/.*/,
      ],

      plugins: [
        {
          // After Rollup emits the bundle, rewrite require() calls for afda-backend
          // dependencies to runtime expressions so Electron can find them both in
          // dev and in the packaged app (where they live in app.asar.unpacked).
          name: 'rewrite-external-modules',
          renderChunk(code: string) {
            const afdaBasePath = 'src/afda/backend/afda-backend__hidden/node_modules';
            const runtimeExpr =
              `(function(){` +
              `var _e=require('electron'),_p=require('path');` +
              `return _e.app.isPackaged` +
              ` ? _p.join(process.resourcesPath,'app.asar.unpacked/${afdaBasePath}')` +
              ` : _p.join(_e.app.getAppPath(),'${afdaBasePath}');` +
              `}())`;

            // Rewrite path-form requires (already have full afda-backend path).
            let result = code.replace(
              /require\(["']src\/afda\/backend\/afda-backend__hidden\/node_modules\/([^"']+)["']\)/g,
              `require((function(){var _b=${runtimeExpr};return require('path').join(_b,'$1');}()))`,
            );

            // Rewrite bare module requires for afda-backend dependencies.
            // These appear as require('axios') etc. after Rollup externalises them
            // and won't resolve in the packaged ASAR without this rewrite.
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
              'ws',
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
              `var _e=require('electron'),_p=require('path');` +
              `return _e.app.isPackaged` +
              ` ? _p.join(process.resourcesPath,'app.asar.unpacked/node_modules/better-sqlite3')` +
              ` : _p.join(_e.app.getAppPath(),'node_modules/better-sqlite3');` +
              `}())`;
            return code.replace(
              /require\(["']better-sqlite3["']\)/g,
              `require(${runtimeExpr})`,
            );
          },
        },
      ],
    },
  },
}));
