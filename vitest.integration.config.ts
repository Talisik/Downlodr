import path from 'path';
import { defineConfig } from 'vitest/config';

// Separate from vitest.config.ts on purpose: integration tests exercise the
// real packaged Electron app (via Playwright's Electron driver), not mocked
// IPC globals, so they need a Node environment (no jsdom), a much longer
// per-test timeout (launching Electron and waiting for it to boot is slow),
// and must never run as part of the fast `yarn test` unit suite.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/integration/**/*.integration.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
