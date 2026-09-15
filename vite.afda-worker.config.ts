import path from 'path';
import { defineConfig } from 'vite';
import { electronBuildExternal, electronBuildRewritePlugins } from './vite.main.config';

// Build config for the AFDA utilityProcess worker entry (afda-worker/entry.ts).
// Reuses main.js's external/rewrite-plugin setup (same native/add-on deps need
// the same path resolution) but CANNOT reuse vite.main.config.ts's banner: that
// banner calls require('electron'), which utilityProcess-forked scripts do not
// have access to. This banner instead reads global.__electronPaths from
// environment variables afdaWorkerProxy.ts sets when it forks this process
// (utilityProcess.fork(entryPath, [], { env: {...} })) — those env vars are
// available synchronously at process start, before Rollup's hoisted external-
// require preamble runs, same guarantee the main.js banner provides via
// require('electron') instead.
export default defineConfig(({ mode }) => ({
  define: {
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
        banner:
          "global.__electronPaths={isPackaged:process.env.DOWNLODR_IS_PACKAGED==='1'," +
          "resourcesPath:process.env.DOWNLODR_RESOURCES_PATH||''," +
          "appPath:process.env.DOWNLODR_APP_PATH||''};",
      },
      external: electronBuildExternal,
      plugins: electronBuildRewritePlugins,
    },
  },
}));
