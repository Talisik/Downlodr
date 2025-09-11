/**
 * Application configuration using environment variables
 * Environment variables are injected at build time via Vite
 */
export const config = {
  telemetry: {
    endpoint: __TELEMETRY_ENDPOINT__,
    timeout: parseInt(__TELEMETRY_TIMEOUT__, 10),
    retryAttempts: parseInt(__TELEMETRY_RETRY_ATTEMPTS__, 10),
  },
} as const;
