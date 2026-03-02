/**
 * Backward compatibility wrapper for sendErrorLog
 *
 * DEPRECATED: Use @/services/api/telemetryApiService instead
 *
 * This file re-exports the new service to maintain backward compatibility.
 */

export { sendTelemetryData as default } from '@/services/api/telemetryApiService';
