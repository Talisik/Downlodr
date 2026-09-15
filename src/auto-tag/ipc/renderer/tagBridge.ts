/** Preload bridge exposing window.autoTagBridge. */

import { contextBridge, ipcRenderer } from 'electron';
import type { AutoTagResponse, TagJobInput } from '../main/tagHandler';

export const AUTO_TAG_CHANNEL = 'auto-tag:run';

contextBridge.exposeInMainWorld('autoTagBridge', {
  run: (inputs: TagJobInput[]): Promise<AutoTagResponse> =>
    ipcRenderer.invoke(AUTO_TAG_CHANNEL, inputs),
});
