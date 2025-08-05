import { POST } from '@/Hooks/useAxios';
import { TelemetryPayload } from '@/Utils/Telemetry/telemetryTypes';
import { config } from '../config';

const useSendErrorLog = async (payload: TelemetryPayload): Promise<boolean> => {
  // console.log(payload);

  const response = await POST({
    headers: {
      'Content-Type': 'application/json',
    },
    url: config.telemetry.endpoint,
    data: payload,
  });
  return true;

  // return true;
};

export default useSendErrorLog;
