// vitest.setup.ts
// Registers jest-dom matchers (toBeInTheDocument, etc.) on Vitest's `expect`.
import '@testing-library/jest-dom/vitest';

// Define global variables for telemetry config
declare global {
  const __TELEMETRY_ENDPOINT__: string;
  const __TELEMETRY_TIMEOUT__: string;
  const __TELEMETRY_RETRY_ATTEMPTS__: string;
  const __TELEMETRY_SCHEMA_URL__: string;
  const __SHARE_API_ENDPOINT__: string;
  const __SHARE_API_KEY__: string;
}

if (typeof (globalThis as any).__TELEMETRY_ENDPOINT__ === 'undefined') {
  (globalThis as any).__TELEMETRY_ENDPOINT__ = 'https://endpoint';
  (globalThis as any).__TELEMETRY_TIMEOUT__ = '30000';
  (globalThis as any).__TELEMETRY_RETRY_ATTEMPTS__ = '3';
  (globalThis as any).__TELEMETRY_SCHEMA_URL__ =
    'https://opentelemetry.io/schemas/1.9.0';
}

if (typeof (globalThis as any).__SHARE_API_ENDPOINT__ === 'undefined') {
  (globalThis as any).__SHARE_API_ENDPOINT__ = 'https://downlodr.com/api/share';
  (globalThis as any).__SHARE_API_KEY__ = '';
}
