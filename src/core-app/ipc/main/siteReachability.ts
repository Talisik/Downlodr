/**
 * Whether a website answers at all — checked before the AFDA mapper runs.
 *
 * The mapper never reports an unreachable site as an error: for a domain that
 * doesn't exist it returns website_status "Done" with the homepage as its one
 * "section", so the Add Website flow accepted sites that could never be
 * scraped.
 *
 * Any HTTP response counts as reachable, including 403/404/5xx and bot
 * challenges (Medium answers 403 to plain requests but is a real site). Only
 * failures to get a response at all — no such host, connection refused,
 * timeout — count as unreachable.
 */

export type ReachabilityResult =
  | { reachable: true }
  | {
      reachable: false;
      reason: 'invalid' | 'not_found' | 'refused' | 'timeout' | 'other';
    };

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 15_000;

function classify(error: unknown): ReachabilityResult {
  const err = error as { name?: string; cause?: { code?: string } };
  if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
    return { reachable: false, reason: 'timeout' };
  }
  const code = err?.cause?.code ?? '';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return { reachable: false, reason: 'not_found' };
  }
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET') {
    return { reachable: false, reason: 'refused' };
  }
  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
    return { reachable: false, reason: 'timeout' };
  }
  return { reachable: false, reason: 'other' };
}

export async function checkSiteReachable(
  url: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ReachabilityResult> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { reachable: false, reason: 'invalid' };
    }
  } catch {
    return { reachable: false, reason: 'invalid' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    // Only the status line matters; don't download the page.
    response.body?.cancel().catch(() => undefined);
    return { reachable: true };
  } catch (error) {
    return classify(error);
  } finally {
    clearTimeout(timer);
  }
}
