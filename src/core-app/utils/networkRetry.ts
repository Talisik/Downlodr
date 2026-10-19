/**
 * Retries a network call when it fails before the server answered.
 *
 * On slow networks GitHub connections can take longer than the 10s limits
 * both axios (`timeout`) and Node's fetch (undici's connect timeout) apply,
 * so plugin installs failed with "timeout of 10000ms exceeded" / "fetch
 * failed" on the first slow handshake. A failure where the server did answer
 * (an HTTP error status) is not retried — trying again won't change it.
 *
 * Pure (no node/electron imports) so both the renderer and main can use it.
 */

const TRANSIENT_CODES = new Set([
  'ECONNABORTED', // axios timeout
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ERR_NETWORK', // axios: no response at all
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
]);

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  response?: unknown;
  cause?: unknown;
};

export function isTransientNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as ErrorLike & { name?: unknown };
  if (e.response) return false;
  // AbortSignal.timeout() — a per-attempt cap on a stalled transfer.
  if (e.name === 'TimeoutError') return true;
  if (typeof e.code === 'string' && TRANSIENT_CODES.has(e.code)) return true;
  // Node's fetch wraps every network-level failure as
  // TypeError('fetch failed') with the real reason in `cause`.
  if (e.message === 'fetch failed') return true;
  const cause = e.cause as ErrorLike | undefined;
  return typeof cause?.code === 'string' && TRANSIENT_CODES.has(cause.code);
}

export interface NetworkRetryOptions {
  /** Total tries, including the first. */
  attempts?: number;
  /** Wait before retry N (last value repeats). */
  delaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  {
    attempts = 3,
    delaysMs = [1000, 3000],
    sleep = defaultSleep,
  }: NetworkRetryOptions = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= attempts || !isTransientNetworkError(err)) throw err;
      await sleep(delaysMs[Math.min(attempt - 1, delaysMs.length - 1)]);
    }
  }
}
