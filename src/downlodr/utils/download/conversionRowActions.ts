/**
 * Pause/resume and retry for Format Converter rows, with the same toasts the
 * list shows for downloads. A conversion row is an ffmpeg job (see
 * conversionRows.ts): pausing must not kill it and resuming/retrying must not
 * re-queue it as a yt-dlp download, which is what the download handlers do.
 *
 * Each helper returns false when the row isn't a conversion, so callers can
 * fall through to their normal download handling.
 */
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import {
  isConversionRow,
  retryConversion,
  toggleConversionRowPause,
} from '@/downlodr/store/download/conversionRows';
import { useDownloadStore } from '@/downlodr/store/downloadStore';

type Translate = (key: string) => string;

/** The row's pause button: pause a running conversion, resume a paused one. */
export async function handleConversionPauseToggle(
  downloadId: string,
  t: Translate,
): Promise<boolean> {
  const row = useDownloadStore
    .getState()
    .downloading.find((d) => d.id === downloadId);
  if (!isConversionRow(row)) return false;

  const wasPaused = row?.status === 'paused';
  const result = await toggleConversionRowPause(downloadId);
  if (result.success) {
    toast({
      variant: 'success',
      title: t(
        wasPaused
          ? 'statusHandler.downloadResumed'
          : 'statusHandler.downloadPaused',
      ),
      description: t(
        wasPaused
          ? 'statusHandler.downloadResumedDesc'
          : 'statusHandler.downloadPausedDesc',
      ),
      duration: 5000,
    });
  } else {
    // e.g. Windows, where ffmpeg can't be suspended in place.
    toast({
      variant: 'destructive',
      title: t('statusHandler.pauseFailed'),
      description: result.error || t('statusHandler.pauseFailedDesc'),
      duration: 5000,
    });
  }
  return true;
}

/** Retry on a failed conversion: run the conversion again, as a new row. */
export async function handleConversionRetry(
  downloadId: string,
  t: Translate,
): Promise<boolean> {
  const { failedDownloads, historyDownloads } = useDownloadStore.getState();
  const record =
    failedDownloads.find((d) => d.id === downloadId) ??
    historyDownloads.find((d) => d.id === downloadId);
  if (!record || !isConversionRow(record)) return false;

  try {
    await retryConversion(record);
    toast({
      variant: 'success',
      title: t('statusHandler.downloadRetried'),
      description: t('statusHandler.downloadRetriedDesc'),
      duration: 5000,
    });
  } catch (error) {
    // Most likely the source file was moved or deleted since.
    toast({
      variant: 'destructive',
      title: t('statusHandler.error'),
      description: error instanceof Error ? error.message : String(error),
      duration: 5000,
    });
  }
  return true;
}
