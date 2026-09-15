import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Default 5000ms is too tight on a heavily-loaded machine — too many
    // parallel worker threads can starve a thread of CPU time for seconds
    // at a stretch, timing out even fully-synchronous tests. Cap thread
    // count so each worker actually gets scheduled, and raise the timeout
    // as a safety net on top of that.
    testTimeout: 15000,
    // 'default' keeps the normal terminal output; the second entry writes
    // one markdown results file per test file into tests/fast-test/.
    reporters: ['default', './vitest.reporters/fastTestMarkdownReporter.ts'],
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 4,
      },
      forks: {
        minForks: 1,
        maxForks: 4,
      },
    },
    exclude: [
      'node_modules/**',
      '.worktrees/**',
      'src/**/afda-backend__hidden/**',
      'src/**/video-nemesis-toolkit__hidden/**',
      'src/**/smart-organize-backend__hidden/**',
      // Pre-existing manual scripts (not Vitest tests): self-invoke `main()`
      // and call `process.exit()` at import time, which would kill the
      // Vitest worker. They predate this test runner and run standalone via
      // ts-node — see the comment at the top of each file.
      'src/core-app/ipc/main/cookieAuth/browserDetection.test.ts',
      'src/core-app/ipc/main/cookieAuth/domain.test.ts',
      'src/core-app/ipc/main/cookieAuth/handler.test.ts',
      'src/core-app/ipc/main/cookieAuth/jarImport.test.ts',
      'src/core-app/ipc/main/cookieAuth/netscapeSerializer.test.ts',
      'src/core-app/ipc/main/cookieAuth/siteLogins.test.ts',
      'src/core-app/ipc/main/cookieAuth/state.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/**/afda-backend__hidden/**',
        'src/**/video-nemesis-toolkit__hidden/**',
        'src/**/smart-organize-backend__hidden/**',
      ],
    },
  },
});
