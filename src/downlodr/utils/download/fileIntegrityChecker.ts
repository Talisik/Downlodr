/**
 * Background integrity check for finished downloads. Runs at app startup
 * and on a fixed interval (see App.tsx) to detect files that were moved or
 * deleted outside Downlodr, so pages can grey them out without each
 * re-implementing their own fileExists polling.
 */
import { useDownloadStore } from '@/downlodr/store/downloadStore';

const CONCURRENCY_LIMIT = 8;

type FinishedDownload = ReturnType<
  typeof useDownloadStore.getState
>['finishedDownloads'][number];

async function checkOne(
  location: string,
  fileName: string,
): Promise<boolean> {
  if (!location || !fileName) return true; // can't check → assume present, don't flag
  try {
    const fullPath = await window.downlodrFunctions.joinDownloadPath(
      location,
      fileName,
    );
    return await window.downlodrFunctions.fileExists(fullPath);
  } catch {
    return true; // can't verify → assume present, don't flag as missing
  }
}

/** Runs `worker` over `items` with at most CONCURRENCY_LIMIT in flight. */
async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    const index = nextIndex++;
    if (index >= items.length) return;
    results[index] = await worker(items[index]);
    await runNext();
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY_LIMIT, items.length) },
    () => runNext(),
  );
  await Promise.all(workers);
  return results;
}

export async function runFileIntegrityCheck(): Promise<void> {
  if (!window.downlodrFunctions) return;

  const { finishedDownloads, setFileMissingFlags } =
    useDownloadStore.getState();
  if (finishedDownloads.length === 0) return;

  const existsResults = await mapWithConcurrency(
    finishedDownloads,
    (download) =>
      checkOne(download.location, download.downloadName || download.name),
  );

  const updates = finishedDownloads
    .map((download, i) => ({ id: download.id, missing: !existsResults[i] }))
    .filter(
      (update, i) => finishedDownloads[i].fileMissing !== update.missing,
    );

  setFileMissingFlags(updates);

  // Diagnostic: finished downloads have been flagged missing on macOS while
  // their files still play. Log what was checked and what's actually in the
  // folder for each newly flagged row, so the mismatch shows in DevTools.
  const newlyMissing = finishedDownloads.filter(
    (download, i) => !existsResults[i] && !download.fileMissing,
  );
  await Promise.all(newlyMissing.map(logMissingFileDiagnosis));
}

async function logMissingFileDiagnosis(
  download: FinishedDownload,
): Promise<void> {
  const fileName = download.downloadName || download.name;
  try {
    const fullPath = await window.downlodrFunctions.joinDownloadPath(
      download.location,
      fileName,
    );
    const diagnosis =
      await window.downlodrFunctions.diagnoseMissingFile?.(fullPath);
    console.warn('[file-integrity] flagged as missing:', {
      id: download.id,
      location: download.location,
      downloadName: download.downloadName,
      name: download.name,
      ext: download.ext,
      audioExt: download.audioExt,
      ...diagnosis,
    });
  } catch (err) {
    console.warn('[file-integrity] could not diagnose', download.id, err);
  }
}
