/**
 * Backward compatibility wrapper for TelemetryService
 *
 * DEPRECATED: Use @/services/telemetry/telemetryService instead
 *
 * This file re-exports the new service to maintain backward compatibility.
 */

export {
  default, getTelemetry, initializeTelemetry, TelemetryService
} from '@/services/telemetry/telemetryService';

