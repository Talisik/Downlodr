/**
 * tagBridge.ts  (renderer preload bridge)
 *
 * Exposes window.autoTagBridge.run(inputs) to the renderer.
 * Imported for side-effect by src/preload.ts.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { AutoTagResponse, TagJobInput } from '../main/tagHandler';

export const AUTO_TAG_CHANNEL = 'auto-tag:run';

contextBridge.exposeInMainWorld('autoTagBridge', {
  run: (inputs: TagJobInput[]): Promise<AutoTagResponse> =>
    ipcRenderer.invoke(AUTO_TAG_CHANNEL, inputs),
});
