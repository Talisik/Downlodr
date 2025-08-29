import { POST } from '../Hooks/useAxios';
import { TelemetryPayload } from '../Utils/Telemetry/telemetryTypes';
import { config } from '../config';

const useSendErrorLog = async (payload: TelemetryPayload): Promise<boolean> => {
  console.log('useSendErrorLog', payload);
  console.log('config.telemetry.endpoint', config.telemetry.endpoint);

  try {
    const response = await POST({
      headers: {
        'Content-Type': 'application/json',
      },
      url: config.telemetry.endpoint,
      data: payload,
    });

    console.log('Telemetry data sent successfully:', response.status);
    return true; // Successfully sent telemetry data
  } catch (error) {
    console.error('Failed to send telemetry data:', error);
    return false;
  }
};

export default useSendErrorLog;
