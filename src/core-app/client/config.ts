/**
 * Application configuration using environment variables
 * Environment variables are injected at build time via Vite
 */
function getTelemetrySchemaUrl(): string {
  try {
    return __TELEMETRY_SCHEMA_URL__;
  } catch {
    return 'https://opentelemetry.io/schemas/1.9.0';
  }
}

export const config = {
  telemetry: {
    endpoint: __TELEMETRY_ENDPOINT__,
    timeout: parseInt(__TELEMETRY_TIMEOUT__, 10),
    retryAttempts: parseInt(__TELEMETRY_RETRY_ATTEMPTS__, 10),
    schemaUrl: getTelemetrySchemaUrl(),
  },
} as const;
