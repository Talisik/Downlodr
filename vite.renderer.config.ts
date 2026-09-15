import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
      // Ensure a single React instance so Radix UI (e.g. Slider) hooks work correctly
      dedupe: ['react', 'react-dom'],
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    css: {
      postcss: {
        plugins: [require('tailwindcss'), require('autoprefixer')],
      },
    },
    // Make environment variables available to the renderer process
    define: {
      __TELEMETRY_ENDPOINT__: JSON.stringify(
        env.VITE_TELEMETRY_ENDPOINT || 'https://endpoint',
      ),
      __TELEMETRY_TIMEOUT__: JSON.stringify(
        env.VITE_TELEMETRY_TIMEOUT || '30000',
      ),
      __TELEMETRY_RETRY_ATTEMPTS__: JSON.stringify(
        env.VITE_TELEMETRY_RETRY_ATTEMPTS || '3',
      ),
      __TELEMETRY_SCHEMA_URL__: JSON.stringify(
        env.VITE_TELEMETRY_SCHEMA_URL || 'https://opentelemetry.io/schemas/1.9.0',
      ),
      // Empty by default: otel-logs.js and useSummarizeVideo.ts stay disabled
      // unless these are set in .env.
      __OTEL_LOGS_ENDPOINT__: JSON.stringify(env.VITE_OTEL_LOGS_ENDPOINT || ''),
      __SUMMARY_API_ENDPOINT__: JSON.stringify(
        env.VITE_SUMMARY_API_ENDPOINT || '',
      ),
      // __SHARE_API_ENDPOINT__/__SHARE_API_KEY__ are intentionally NOT
      // injected here — the share-record request runs in the main process
      // (shareHandler.ts) to avoid renderer-side CORS, so only
      // vite.main.config.ts needs these two.
    },
  };
});
