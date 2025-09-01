import { POST } from '../Hooks/useAxios';
import { TelemetryPayload } from '../Utils/Telemetry/telemetryTypes';
import { config } from '../config';

const useSendErrorLog = async (payload: TelemetryPayload): Promise<boolean> => {
  console.log('useSendErrorLog', payload);
  console.log('config.telemetry.endpoint', config.telemetry.endpoint);
  
  // COMMENTED OUT - Not actually sending data
  /*
  const response = await POST({
    headers: {
      'Content-Type': 'application/json',
    },
    url: config.telemetry.endpoint,
    data: payload,
  });

  return response.data;
  */
  
  return true;
};

export default useSendErrorLog;
