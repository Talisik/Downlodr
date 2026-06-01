/**
 * Telemetry API service
 * Handles HTTP requests to the telemetry endpoint
 */

import { config } from '@/core-app/client/config';
import { POST } from '@/core-app/client/httpClient';
import type { TelemetryPayload } from '@/core-app/telemetry/schema/telemetryTypes';

/**
 * Sends telemetry data to the configured endpoint
 */
export async function sendTelemetryData(
  payload: TelemetryPayload,
): Promise<boolean> {
  try {
    await POST(config.telemetry.endpoint, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return true;
  } catch (error) {
    console.error('Failed to send telemetry data:', error);
    return false;
  }
}
