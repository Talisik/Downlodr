/* eslint-disable prettier/prettier */
/* global __TELEMETRY_ENDPOINT__ */
// OpenTelemetry Logs Implementation
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

      // Test endpoint connectivity
      // this.testEndpointConnectivity();

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

  logInfo(message, attributes = {}) {
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
        // Let OpenTelemetry SDK handle timestamp automatically
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

  logWarning(message, attributes = {}) {
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
        // Let OpenTelemetry SDK handle timestamp automatically
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

  logError(message, error = null, attributes = {}) {
    if (!this.isEnabled()) return;
    const errorAttributes = { ...attributes };
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
        // Let OpenTelemetry SDK handle timestamp automatically
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

  // Add method to force flush logs (useful for debugging)
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

  // Test endpoint connectivity
  /*
    async testEndpointConnectivity() {
      console.log('🔍 [TELEMETRY] Testing endpoint connectivity...');
  
      try {
        const parsedUrl = url.parse(this.endpoint);
        const client = parsedUrl.protocol === 'https:' ? https : http;
  
        const testData = JSON.stringify({
          resourceLogs: [
            {
              resource: {
                attributes: [
                  { key: 'service.name', value: { stringValue: 'test' } },
                ],
              },
              scopeLogs: [
                {
                  logRecords: [
                    {
                      body: { stringValue: 'connectivity test' },
                      severityText: 'INFO',
                      timeUnixNano: String(Date.now() * 1000000),
                    },
                  ],
                },
              ],
            },
          ],
        });
  
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path: parsedUrl.path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(testData),
          },
        };
  
        const req = client.request(options, (res) => {
          console.log(
            `🌐 [TELEMETRY] Endpoint responded with status: ${res.statusCode}`,
          );
          console.log(`📋 [TELEMETRY] Response headers:`, res.headers);
  
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log(
                '✅ [TELEMETRY] Endpoint is reachable and accepting requests',
              );
            } else {
              console.log(
                '⚠️ [TELEMETRY] Endpoint reachable but returned error:',
                data,
              );
            }
          });
        });
  
        req.on('error', (error) => {
          console.error(
            '❌ [TELEMETRY] Endpoint connectivity test failed:',
            error.message,
          );
          console.error(
            '   This could indicate network issues or incorrect endpoint URL',
          );
        });
  
        req.on('timeout', () => {
          console.error('⏰ [TELEMETRY] Endpoint connectivity test timed out');
          req.destroy();
        });
  
        req.setTimeout(5000); // 5 second timeout
        req.write(testData);
        req.end();
      } catch (error) {
        console.error('❌ [TELEMETRY] Error during connectivity test:', error);
      }
    }
    */
}

// Create singleton instance
const otelLogs = new OpenTelemetryLogs();

// Export singleton instance methods
const logInfo = (message, attributes = {}) =>
  otelLogs.logInfo(message, attributes);
const logError = (message, error = null, attributes = {}) =>
  otelLogs.logError(message, error, attributes);
const logWarning = (message, attributes = {}) =>
  otelLogs.logWarning(message, attributes);
const forceFlush = () => otelLogs.forceFlush();

export {
    forceFlush,
    logError,
    logInfo,
    logWarning,
    OpenTelemetryLogs,
    otelLogs
};

