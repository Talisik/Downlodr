import { existsSync } from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

// The scheduled-download backend (video-nemesis-toolkit) is a gitignored,
// externally-provided package. When it isn't present (clean checkouts / macOS
// CI), bundle a no-op stub so the build still succeeds and Skedulosa's DB
// backend simply degrades instead of breaking the whole main process.
const toolkitAvailable =
  existsSync(
    path.resolve(
      __dirname,
      'src/skedulosa/backend/video-nemesis-toolkit/dist/index.ts',
    ),
  ) ||
  existsSync(
    path.resolve(
      __dirname,
      'src/skedulosa/backend/video-nemesis-toolkit/dist/index.js',
    ),
  );

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      // Keep better-sqlite3 out of the Rollup bundle — its bindings package
      // uses dynamic require() to load a native .node binary which Rollup
      // cannot process statically.
      external: ['better-sqlite3'],

      plugins: [
        {
          // Provide a no-op stub for the optional video-nemesis-toolkit when it
          // is not vendored, so Rollup doesn't fail resolving its `dist/index`.
          name: 'optional-video-nemesis-toolkit',
          load(id: string) {
            if (
              !toolkitAvailable &&
              id
                .replace(/\\/g, '/')
                .includes('video-nemesis-toolkit/dist/index')
            ) {
              return (
                `// stub: video-nemesis-toolkit not vendored — Skedulosa DB backend disabled\n` +
                `export const registerVideoNemesisIpcHandlers = () => {\n` +
                `  console.warn('[skedulosa] video-nemesis-toolkit not bundled — scheduled-download backend disabled.');\n` +
                `};\n`
              );
            }
            return null;
          },
        },
        {
          // After Rollup emits the bundle, rewrite the bare require string to
          // a runtime expression so Electron can find the module on any machine,
          // both in dev and when packaged.
          name: 'rewrite-better-sqlite3-path',
          renderChunk(code: string) {
            const relPath =
              'src/skedulosa/backend/video-nemesis-toolkit/node_modules/better-sqlite3';
            const runtimeExpr =
              `(function(){` +
              `var _e=require('electron'),_p=require('path');` +
              `return _e.app.isPackaged` +
              ` ? _p.join(process.resourcesPath,'app.asar.unpacked/${relPath}')` +
              ` : _p.join(_e.app.getAppPath(),'${relPath}');` +
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
});
