/**
 * Telemetry API service
 * Handles HTTP requests to the telemetry endpoint
 */

import { POST } from './httpClient';
import type { TelemetryPayload } from '@/Utils/Telemetry/telemetryTypes';
import { config } from '@/config';

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
