/**
 * Thin IPC wrappers for local ffmpeg conversion jobs (formatConversionHandler
 * in the main process), plus the check for "is this row a conversion".
 *
 * Deliberately store-free: pauseResumeActions runs inside the store's own
 * construction, so importing the store from here would be circular. The row
 * bookkeeping that does need the store lives in conversionRows.ts.
 */
import type { BaseDownload } from './types';

export type ConversionControlResult = { success: boolean; error?: string };

/** True for a download-list row driven by a conversion job, not yt-dlp. */
export function isConversionRow(
  row: Pick<BaseDownload, 'conversion'> | null | undefined,
): boolean {
  return Boolean(row?.conversion?.jobId);
}

const invoke = (channel: string, ...args: unknown[]) =>
  window.downlodrFunctions.invokeMainProcess(channel, ...args);

/** SIGSTOPs the job's ffmpeg. Unsupported on Windows (resolves an error). */
export async function pauseConversionJob(
  jobId: string,
): Promise<ConversionControlResult> {
  return (await invoke(
    'format:pauseConvert',
    jobId,
  )) as ConversionControlResult;
}

/** SIGCONTs a paused job's ffmpeg. */
export async function resumeConversionJob(
  jobId: string,
): Promise<ConversionControlResult> {
  return (await invoke(
    'format:resumeConvert',
    jobId,
  )) as ConversionControlResult;
}

/** Kills the job's ffmpeg. False when it isn't running (e.g. already done). */
export async function cancelConversionJob(jobId: string): Promise<boolean> {
  return Boolean(await invoke('format:cancelConvert', jobId));
}
