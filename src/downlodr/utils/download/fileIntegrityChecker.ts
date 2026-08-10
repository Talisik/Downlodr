/**
 * Background integrity check for finished downloads. Runs at app startup,
 * shortly after any download finishes, and on a fixed interval (see
 * App.tsx) to detect files that were moved or deleted outside Downlodr, so
 * pages can grey them out without each re-implementing their own
 * fileExists polling.
 *
 * A single fileExists() miss is NOT enough to flag a file as missing: right
 * after a download completes the on-disk file can transiently fail a probe
 * (still being flushed/renamed by ffmpeg, brief OS/AV-scan lock, etc.) even
 * though it's actually present, which used to show a confusing strikethrough
 * on a perfectly playable file. We require two consecutive misses across
 * separate check runs before flipping fileMissing to true; any exists=true
 * result clears the flag (and the miss counter) immediately.
 */
import { useDownloadStore } from '@/downlodr/store/downloadStore';

const CONCURRENCY_LIMIT = 8;

/** Consecutive-miss counters, keyed by download id. Module-level so counts
 * survive across scheduled/periodic runs but never persist to disk. */
const missStreaks = new Map<string, number>();
const REQUIRED_CONSECUTIVE_MISSES = 2;

async function checkOne(location: string, fileName: string): Promise<boolean> {
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

  const liveIds = new Set(finishedDownloads.map((d) => d.id));
  for (const id of missStreaks.keys()) {
    if (!liveIds.has(id)) missStreaks.delete(id); // download removed — drop stale counter
  }

  const existsResults = await mapWithConcurrency(
    finishedDownloads,
    (download) =>
      checkOne(download.location, download.downloadName || download.name),
  );

  const updates: { id: string; missing: boolean }[] = [];
  finishedDownloads.forEach((download, i) => {
    const exists = existsResults[i];
    let confirmedMissing: boolean;

    if (exists) {
      missStreaks.delete(download.id);
      confirmedMissing = false;
    } else {
      const streak = (missStreaks.get(download.id) ?? 0) + 1;
      missStreaks.set(download.id, streak);
      confirmedMissing =
        streak >= REQUIRED_CONSECUTIVE_MISSES || !!download.fileMissing;
    }

    if (download.fileMissing !== confirmedMissing) {
      updates.push({ id: download.id, missing: confirmedMissing });
    }
  });

  setFileMissingFlags(updates);
}

/**
 * Schedules a one-off integrity check shortly after a download finishes,
 * instead of waiting for the next 10-minute tick. Debounced to a single
 * pending timer so a burst of completions only triggers one extra check.
 */
let recheckTimerId: number | undefined;
export function scheduleFileIntegrityRecheck(delayMs = 3000): void {
  clearTimeout(recheckTimerId);
  recheckTimerId = window.setTimeout(() => {
    recheckTimerId = undefined;
    runFileIntegrityCheck().catch((err) =>
      console.error('File integrity recheck failed:', err),
    );
  }, delayMs);
}
