/**
 * tagHandler.ts  (main process IPC)
 *
 * Registers the auto-tag IPC handler. One channel, request/response:
 *   auto-tag:run  (handle) — tag a batch of downloads, returns TagResult[]
 *
 * Returns a cleanup function that removes the handler.
 */

import { ipcMain } from 'electron';
import { runAutoTag, type TagJobInput } from '../../service/tagService';
import type { TagResult } from '../../types';

export type { TagJobInput };

export const AUTO_TAG_CHANNEL = 'auto-tag:run';

export type AutoTagResponse =
  | { ok: true; results: TagResult[] }
  | { ok: false; message: string };

export function autoTagHandler(): () => void {
  ipcMain.handle(
    AUTO_TAG_CHANNEL,
    async (_event, inputs: TagJobInput[]): Promise<AutoTagResponse> => {
      try {
        return { ok: true, results: runAutoTag(inputs ?? []) };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[auto-tag] run failed:', err);
        return { ok: false, message };
      }
    },
  );

  return () => ipcMain.removeHandler(AUTO_TAG_CHANNEL);
}
