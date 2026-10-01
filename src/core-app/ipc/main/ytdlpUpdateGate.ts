/**
 * Keeps yt-dlp work from racing a yt-dlp self-update.
 *
 * The startup update downloads a new binary and swaps it in. A download or
 * metadata fetch started meanwhile could spawn the old binary mid-swap (or hit
 * EBUSY). While an update runs, yt-dlp entry points await it and then carry on
 * with whichever binary is in place — a failed update releases them too.
 */

let inFlight: Promise<void> | null = null;

/** Resolves once no yt-dlp update is running. Never rejects. */
export function waitForYtdlpUpdate(): Promise<void> {
  return inFlight ?? Promise.resolve();
}

/** Runs an update while holding the gate; its result passes through. */
export async function runExclusiveYtdlpUpdate<T>(
  update: () => Promise<T>,
): Promise<T> {
  const run = update();
  const gate = run.then(
    () => undefined,
    () => undefined,
  );
  inFlight = gate;
  try {
    return await run;
  } finally {
    if (inFlight === gate) inFlight = null;
  }
}
