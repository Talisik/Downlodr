/**
 * Backward compatibility wrapper for TelemetryService
 *
 * DEPRECATED: Use @/services/telemetry/telemetryService instead
 *
 * This file re-exports the new service to maintain backward compatibility.
 */

export {
  TelemetryService,
  initializeTelemetry,
  getTelemetry,
  default,
} from '@/services/telemetry/telemetryService';
