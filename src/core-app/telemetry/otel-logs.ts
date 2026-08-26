/* eslint-disable @typescript-eslint/no-explicit-any */
/* global __TELEMETRY_ENDPOINT__ */
// OpenTelemetry Logs Implementation
// Ported from the macOS-stable branch to complete feat/module's telemetry,
// which imports `otelLogs` / `logInfo` / `logWarning` / `logError` from here.
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from '@opentelemetry/sdk-logs';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

// Resolve the OTLP collector endpoint. Bundlers replace __TELEMETRY_ENDPOINT__
// at build time (see vite.main.config.ts / vite.renderer.config.ts); the
// process.env fallback covers non-bundled contexts such as the headless entry.
// Empty is the default and means "telemetry disabled" — never hardcode a
// collector URL here, it would silently ship every user's logs to it.
function resolveTelemetryEndpoint() {
  if (typeof __TELEMETRY_ENDPOINT__ !== 'undefined' && __TELEMETRY_ENDPOINT__) {
    return __TELEMETRY_ENDPOINT__;
  }
  if (typeof process !== 'undefined') {
    return process.env?.VITE_TELEMETRY_ENDPOINT || '';
  }
  return '';
}

class OpenTelemetryLogs {
  endpoint: string;
  serviceName: string;
  serviceVersion: string;
  logger: any = null;
  loggerProvider: any = null;
  initialized = false;

  constructor() {
    this.endpoint = resolveTelemetryEndpoint();
    this.serviceName = 'downlodr-electron-desktop-app';
    this.serviceVersion = '1.0.0';
    this.logger = null;
    this.loggerProvider = null;
    this.initialized = false;
  }

  initialize() {
    try {
      // No collector configured: stay uninitialized. Every log* method already
      // no-ops while `initialized` is false, so this cleanly disables export.
      if (!this.endpoint) {
        console.log(
          'OpenTelemetry Logs disabled (no VITE_TELEMETRY_ENDPOINT configured)',
        );
        return;
      }

      // Create resource
      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.serviceName,
        [ATTR_SERVICE_VERSION]: this.serviceVersion,
        'process.type': typeof process !== 'undefined' ? (process.type || 'renderer') : 'renderer',
        platform: typeof process !== 'undefined' ? process.platform : navigator?.platform || 'unknown',
        'telemetry.sdk.name': 'opentelemetry',
        'telemetry.sdk.language': 'javascript',
        'telemetry.sdk.version': '1.0.0',
      });

      // Create OTLP log exporter with better configuration
      const logExporter = new OTLPLogExporter({
        url: this.endpoint,
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout and retry configuration
        timeoutMillis: 10000,
      });

      // Use BatchLogRecordProcessor for better performance
      const logProcessor = new BatchLogRecordProcessor(logExporter, {
        maxQueueSize: 2048,
        scheduledDelayMillis: 1000,
        exportTimeoutMillis: 30000,
        maxExportBatchSize: 512,
      });

      // Create logger provider with correct configuration
      this.loggerProvider = new LoggerProvider({
        resource,
        processors: [logProcessor],
      });

      // Get logger instance directly from provider
      this.logger = this.loggerProvider.getLogger(
        this.serviceName,
        this.serviceVersion,
      );

      this.initialized = true;
      console.log('✅ OpenTelemetry Logs initialized successfully');

      // Send initialization log
      this.logInfo('OpenTelemetry Logs initialized', {
        service: this.serviceName,
        version: this.serviceVersion,
        endpoint: this.endpoint,
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize OpenTelemetry Logs:', error);
      return false;
    }
  }

  isEnabled() {
    try {
      const settings = JSON.parse(
        localStorage.getItem('download-settings-storage') || '{}',
      );
      return settings?.state?.settings?.telemetryEnabled === true;
    } catch {
      return false;
    }
  }

  logInfo(message: string, attributes: Record<string, any> = {}) {
    if (!this.isEnabled()) return;
    if (!this.initialized || !this.logger) {
      console.log(`[INFO] ${message}`, attributes);
      return;
    }

    try {
      this.logger.emit({
        severityText: 'INFO',
        severityNumber: 9,
        body: message,
        attributes: {
          timestamp: Date.now(),
          source: 'electron-app',
          ...attributes,
        },
      });

      console.log(`[INFO] ${message} - Sent to OpenTelemetry`, attributes);
    } catch (error) {
      console.error('Failed to send INFO log to OpenTelemetry:', error);
      console.log(`[INFO] ${message}`, attributes);
    }
  }

  logWarning(message: string, attributes: Record<string, any> = {}) {
    if (!this.isEnabled()) return;
    if (!this.initialized || !this.logger) {
      console.warn(`[WARN] ${message}`, attributes);
      return;
    }

    try {
      this.logger.emit({
        severityText: 'WARN',
        severityNumber: 13,
        body: message,
        attributes: {
          timestamp: Date.now(),
          source: 'electron-app',
          ...attributes,
        },
      });

      console.warn(`[WARN] ${message} - Sent to OpenTelemetry`, attributes);
    } catch (error) {
      console.error('Failed to send WARN log to OpenTelemetry:', error);
      console.warn(`[WARN] ${message}`, attributes);
    }
  }

  logError(
    message: string,
    error: any = null,
    attributes: Record<string, any> = {},
  ) {
    if (!this.isEnabled()) return;
    const errorAttributes: Record<string, any> = { ...attributes };
    if (error) {
      errorAttributes.error_name = error.name;
      errorAttributes.error_message = error.message;
      errorAttributes.error_stack = error.stack;
    }

    if (!this.initialized || !this.logger) {
      console.error(`[ERROR] ${message}`, errorAttributes);
      return;
    }

    try {
      this.logger.emit({
        severityText: 'ERROR',
        severityNumber: 17,
        body: message,
        attributes: {
          timestamp: Date.now(),
          source: 'electron-app',
          ...errorAttributes,
        },
      });

      console.error(
        `[ERROR] ${message} - Sent to OpenTelemetry`,
        errorAttributes,
      );
    } catch (err) {
      console.error('Failed to send ERROR log to OpenTelemetry:', err);
      console.error(`[ERROR] ${message}`, errorAttributes);
    }
  }

  async shutdown() {
    if (this.loggerProvider) {
      try {
        // Force flush any pending logs before shutdown
        await this.loggerProvider.forceFlush();
        await this.loggerProvider.shutdown();
        console.log('OpenTelemetry Logs shutdown completed');
      } catch (error) {
        console.error('Error during OpenTelemetry Logs shutdown:', error);
      }
    }
  }

  // Force flush logs (useful for debugging)
  async forceFlush() {
    if (this.loggerProvider) {
      try {
        await this.loggerProvider.forceFlush();
        console.log('OpenTelemetry Logs force flush completed');
      } catch (error) {
        console.error('Error during OpenTelemetry Logs force flush:', error);
      }
    }
  }
}

// Create singleton instance
const otelLogs = new OpenTelemetryLogs();

// Export singleton instance methods
const logInfo = (message: string, attributes: Record<string, any> = {}) =>
  otelLogs.logInfo(message, attributes);
const logError = (
  message: string,
  error: any = null,
  attributes: Record<string, any> = {},
) => otelLogs.logError(message, error, attributes);
const logWarning = (message: string, attributes: Record<string, any> = {}) =>
  otelLogs.logWarning(message, attributes);
const forceFlush = () => otelLogs.forceFlush();

export { forceFlush, logError, logInfo, logWarning, OpenTelemetryLogs, otelLogs };
