/**
 * Concurrency gate for yt-dlp metadata (`getInfo`) fetches.
 *
 * Queueing a playlist fires one `setDownload` per video, so without a gate we
 * spawn a yt-dlp process per entry. The gate caps that — but a plain FIFO gate
 * resolves entries in *insertion* order while the status table renders them
 * newest-first, so the rows the user is looking at (page 1) are the last ones
 * to resolve.
 *
 * So the queue is priority-aware: the table publishes the ids it currently has
 * on screen via `setInfoFetchPriority`, and whenever a slot frees the waiter
 * highest in that list wins. Anything not on screen falls back to FIFO, which
 * makes this a no-op for single downloads. Priority is read at dispatch time,
 * never at enqueue time, so paging around while a playlist resolves simply
 * re-aims the queue — in-flight fetches (at most MAX_CONCURRENT) finish either
 * way.
 */

const MAX_CONCURRENT_INFO_FETCHES = 3;

interface Waiter {
  id: string;
  release: () => void;
}

let activeInfoFetches = 0;
const waiting: Waiter[] = [];
/** Visible download ids → their position on screen. Lower rank fetches first. */
let priorityRank = new Map<string, number>();

/**
 * Publish the download ids currently visible, in display order. Pass an empty
 * array to drop back to FIFO (e.g. when the table unmounts).
 */
export function setInfoFetchPriority(ids: string[]): void {
  priorityRank = new Map(ids.map((id, index) => [id, index]));
}

/** Index of the queued waiter that should run next. */
function pickNextWaiterIndex(): number {
  let bestIndex = 0;
  let bestRank = Number.POSITIVE_INFINITY;
  for (let i = 0; i < waiting.length; i++) {
    const rank = priorityRank.get(waiting[i].id);
    if (rank === undefined) continue;
    // Strict `<` keeps FIFO as the tie-break, since we scan in arrival order.
    if (rank < bestRank) {
      bestRank = rank;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * Wait for a metadata-fetch slot. Every caller must pair this with exactly one
 * `releaseInfoFetchSlot()` in a `finally`.
 */
export async function acquireInfoFetchSlot(downloadId: string): Promise<void> {
  if (activeInfoFetches < MAX_CONCURRENT_INFO_FETCHES) {
    activeInfoFetches++;
    return;
  }
  await new Promise<void>((resolve) => {
    waiting.push({ id: downloadId, release: resolve });
  });
  activeInfoFetches++;
}

/** Give the slot back and hand it to the highest-priority waiter. */
export function releaseInfoFetchSlot(): void {
  activeInfoFetches--;
  if (waiting.length === 0) return;
  const [next] = waiting.splice(pickNextWaiterIndex(), 1);
  next.release();
}

/** Test/diagnostic hook — number of fetches parked behind the gate. */
export function getQueuedInfoFetchCount(): number {
  return waiting.length;
}

/** Test-only: drop all state between scenarios. */
export function resetInfoFetchQueue(): void {
  activeInfoFetches = 0;
  waiting.length = 0;
  priorityRank = new Map();
}
