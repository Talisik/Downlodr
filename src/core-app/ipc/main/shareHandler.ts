/**
 * Records share-link metadata with the backend.
 *
 * Runs in the main process specifically so the request never goes through a
 * browser `fetch` — a renderer-side call to this endpoint hits CORS, since
 * the server doesn't (and, for an API-key-gated write endpoint, likely never
 * will) send back Access-Control-Allow-Origin for the app's origin. Node's
 * network stack has no concept of CORS, so the identical request from here
 * just works. Same reasoning `otel-logs.js` already relies on for telemetry.
 *
 * Reads its own two globals directly rather than importing
 * `core-app/client/config` — that module also evaluates the telemetry
 * globals at load time, which are only ever injected into the *renderer*
 * bundle (vite.renderer.config.ts); pulling it into main would require
 * main.js to carry telemetry's config too, for no reason this file needs.
 */

import axios from 'axios';
import { randomUUID } from 'crypto';
import { ipcMain } from 'electron';

export interface RecordShareRequest {
  senderUserId: string;
  longUrl: string;
  title?: string;
  /**
   * Local shared-list id, when the share is of a list. Rides inside
   * `short_url` — see the note on that field below.
   */
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
            // Placeholder until a real shortener exists — nothing in the
            // app currently produces a short link distinct from this one.
            // The backend enforces short_url uniqueness, so this mints its
            // own random id rather than echoing longUrl. (longUrl is now
            // unique per share in its own right, since shareLink.ts mints a
            // fresh id each time, but keeping the two independent means a
            // change to the link format can't start causing 409s here.)
            //
            // When the share is of a shared list, the list's local id is
            // prefixed onto the path so every row for one list is groupable
            // by that segment. It goes here rather than in `metadata`
            // because the API's metadata is NOT free-form: it maps only
            // `title` and `description` onto the row and silently drops
            // unknown keys, so a `metadata.listId` would never survive the
            // write. The trailing uuid keeps uniqueness intact either way.
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
        // Success is otherwise totally silent — this call runs in the main
        // process, so it never appears in the renderer's DevTools Network
        // tab no matter what happens, and without this there is no way to
        // tell "recorded fine" apart from "never ran" while testing.
        console.log('Recorded share:', response.status, senderUserId);
        return { success: true };
      } catch (error) {
        // Best-effort only — the share link itself was already handed to
        // the user before this ever runs; a failed record shouldn't fail
        // the caller, just report it didn't happen so the UI can skip its
        // success toast.
        console.warn('Failed to record share:', error);
        return { success: false };
      }
    },
  );
};
