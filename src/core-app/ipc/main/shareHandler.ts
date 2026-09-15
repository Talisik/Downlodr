import axios from 'axios';
import { randomUUID } from 'crypto';
import { ipcMain } from 'electron';

export interface RecordShareRequest {
  senderUserId: string;
  longUrl: string;
  title?: string;
  listId?: string;
}

export const shareHandler = () => {
  ipcMain.handle(
    'share:record',
    async (_event, payload: RecordShareRequest) => {
      const { senderUserId, longUrl, title, listId } = payload;

      try {
        const response = await axios.post(
          __SHARE_API_ENDPOINT__,
          {
            sender_user_id: senderUserId,
            short_url: listId
              ? `https://downlodr.com/s/${listId}/${randomUUID()}`
              : `https://downlodr.com/s/${randomUUID()}`,
            long_url: longUrl,
            ...(title ? { metadata: { title } } : {}),
          },
          {
            headers: {
              'content-type': 'application/json',
              'x-api-key': __SHARE_API_KEY__,
            },
            timeout: 4000,
          },
        );
        console.log('Recorded share:', response.status, senderUserId);
        return { success: true };
      } catch (error) {
        console.warn('Failed to record share:', error);
        return { success: false };
      }
    },
  );
};
