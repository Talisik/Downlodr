import path from 'path';
import { defineConfig } from 'vite';

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
