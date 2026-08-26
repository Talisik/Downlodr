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
    // Make environment variables available to the renderer process.
    // Service endpoints and credentials default to empty: the features that
    // use them degrade to a clear "not configured" error rather than shipping
    // a hostname or key in the bundle. See .env.example.
    define: {
      __TELEMETRY_ENDPOINT__: JSON.stringify(env.VITE_TELEMETRY_ENDPOINT || ''),
      __TELEMETRY_TIMEOUT__: JSON.stringify(
        env.VITE_TELEMETRY_TIMEOUT || '30000',
      ),
      __TELEMETRY_RETRY_ATTEMPTS__: JSON.stringify(
        env.VITE_TELEMETRY_RETRY_ATTEMPTS || '3',
      ),
      __TELEMETRY_SCHEMA_URL__: JSON.stringify(
        env.VITE_TELEMETRY_SCHEMA_URL || 'https://opentelemetry.io/schemas/1.9.0',
      ),
    },
  };
});
