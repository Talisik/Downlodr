import { config } from '@/core-app/client/config';
import { TelemetryService } from '@/core-app/telemetry/utils/telemetryService';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  SmartOrganizeDownloadInput,
  SmartOrganizeHandlerResult,
  SmartOrganizeProgress,
  SmartOrganizeResult,
} from '../../schema/smartOrganizeTypes';

// ─── State machine ────────────────────────────────────────────────────────────

export type SmartOrganizeState = 'idle' | 'running' | 'done' | 'error';

export interface UseSmartOrganizeReturn {
  state: SmartOrganizeState;
  progress: SmartOrganizeProgress | null;
  result: SmartOrganizeResult | null;
  error: string | null;
  /** Start the pipeline with the given eligible downloads. */
  start: (downloads: SmartOrganizeDownloadInput[]) => void;
  /** Abort the running job and return to idle. */
  cancel: () => void;
  /** Reset to idle after done/error. */
  reset: () => void;
  /**
   * Write the result's categories back to the download store.
   * Normalizes category names and merges with existing ones (no duplicates).
   * Only callable when state === 'done'.
   */
  applyCategories: () => void;
}

// ─── Category merge helpers ───────────────────────────────────────────────────

/** Normalize a category name for duplicate detection. */
function normalize(name: string): string {
  return name.trim().toLowerCase();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSmartOrganize(): UseSmartOrganizeReturn {
  const [state, setState] = useState<SmartOrganizeState>('idle');
  const [progress, setProgress] = useState<SmartOrganizeProgress | null>(null);
  const [result, setResult] = useState<SmartOrganizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep an unsubscribe ref so we can clean up the progress listener
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to progress events on mount, unsubscribe on unmount
  useEffect(() => {
    const unsub = window.smartOrganizeBridge.onProgress((p) => {
      setProgress(p);
    });
    unsubscribeRef.current = unsub;
    return () => unsub();
  }, []);

  const start = useCallback(
    (downloads: SmartOrganizeDownloadInput[]) => {
      if (state === 'running') return;

      setState('running');
      setProgress(null);
      setResult(null);
      setError(null);

      window.smartOrganizeBridge.start(downloads).then((handlerResult) => {
        if (handlerResult.ok) {
          setResult(handlerResult.result);
          setState('done');
        } else {
          const fail = handlerResult as Extract<
            SmartOrganizeHandlerResult,
            { ok: false }
          >;
          if (fail.reason === 'cancelled') {
            setState('idle');
            setProgress(null);
          } else {
            setError(fail.message);
            setState('error');

            // Non-blocking telemetry report — mirrors the pattern in lifecycleActions.ts
            setTimeout(async () => {
              try {
                const telemetryService = new TelemetryService({
                  apiEndpoint: config.telemetry.endpoint,
                });
                await telemetryService.init();
                await telemetryService.sendDownloadError({
                  error: new Error(fail.message),
                  logMessage: `Smart Organize failed for ${downloads.length} video(s): ${fail.message}`,
                  downloadContext: {
                    downloadName: '[smart-organize] pipeline',
                    location: 'smart-organize',
                  },
                });
              } catch (telemetryError) {
                console.error(
                  'Failed to send smart-organize telemetry:',
                  telemetryError,
                );
              }
            }, 0);
          }
        }
      });
    },
    [state],
  );

  const cancel = useCallback(() => {
    window.smartOrganizeBridge.cancel();
    // State transitions to idle once the handler resolves with reason: 'cancelled'
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(null);
    setResult(null);
    setError(null);
  }, []);

  const applyCategories = useCallback(() => {
    if (!result) return;

    const { addCategory } = useDownloadStore.getState();

    for (const cluster of result.clusters) {
      const categoryTag = cluster.category_tag;
      const normalizedNew = normalize(categoryTag);

      for (const videoId of cluster.video_ids) {
        // Look up existing categories for this download across all lists
        const store = useDownloadStore.getState();
        const allLists = [
          ...store.finishedDownloads,
          ...store.historyDownloads,
          ...store.downloading,
          ...store.forDownloads,
        ];
        const download = allLists.find((d) => d.id === videoId);
        if (!download) continue;

        const alreadyExists = (download.category ?? []).some(
          (existing) => normalize(existing) === normalizedNew,
        );

        if (!alreadyExists) {
          addCategory(videoId, categoryTag);
        }
      }
    }
  }, [result]);

  return {
    state,
    progress,
    result,
    error,
    start,
    cancel,
    reset,
    applyCategories,
  };
}
