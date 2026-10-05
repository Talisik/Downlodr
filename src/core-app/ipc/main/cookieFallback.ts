/**
 * Recovering when YouTube rejects the user's signed-in cookies.
 *
 * Once yt-dlp sees YouTube account cookies it only uses player clients that
 * need a JavaScript runtime to solve YouTube's challenge, and Downlodr ships
 * none. YouTube then answers every request with "The page needs to be
 * reloaded." Without cookies yt-dlp falls back to a client that needs no JS
 * runtime, so the same video downloads fine — only sign-in-gated videos
 * (age-restricted, members-only) still need the cookies.
 *
 * Pure and import-free so it can run under vitest; ytdlpHandler.ts and
 * mcpBridgeServer.ts load electron at module scope and cannot.
 */

/** The cookie options resolveCookiesForCall() hands to yt-dlp-helper. */
export interface CookieOptions {
  cookiesFromBrowser?: string;
  cookies?: string;
}

/**
 * Explicitly no cookies. Empty strings, not undefined: yt-dlp-helper fills
 * in the first installed browser's cookies for YouTube unless the caller
 * overrides them.
 */
export const NO_COOKIES: CookieOptions = {
  cookiesFromBrowser: '',
  cookies: '',
};

export function hasCookies(cookies: CookieOptions): boolean {
  return Boolean(cookies.cookiesFromBrowser || cookies.cookies);
}

/** The same cookie flags yt-dlp-helper's getInfo adds, for raw invocations. */
export function cookieCliArgs(cookies: CookieOptions): string[] {
  const args: string[] = [];
  if (cookies.cookies) args.push('--cookies', cookies.cookies);
  if (cookies.cookiesFromBrowser) {
    args.push('--cookies-from-browser', cookies.cookiesFromBrowser);
  }
  return args;
}

export function isCookieSessionRejected(ytdlpOutput: string): boolean {
  return /page needs to be reloaded/i.test(ytdlpOutput);
}

/**
 * Re-run a metadata lookup without cookies when the diagnostic run shows
 * YouTube rejected the signed-in session. Resolves the cookie-less result if
 * it worked, or null when no retry applied or the retry also failed.
 */
export async function retryInfoWithoutCookies<T extends { ok?: boolean }>({
  cookies,
  diagnosticLog,
  retry,
}: {
  cookies: CookieOptions;
  diagnosticLog: string | null | undefined;
  retry: (cookies: CookieOptions) => Promise<T | null | undefined>;
}): Promise<T | null> {
  if (!hasCookies(cookies) || !isCookieSessionRejected(diagnosticLog ?? '')) {
    return null;
  }
  const result = await retry(NO_COOKIES);
  return result?.ok ? result : null;
}

export function shouldRetryDownloadWithoutCookies({
  cookies,
  log,
  cancelled,
}: {
  cookies: CookieOptions;
  log: string;
  cancelled: boolean;
}): boolean {
  return !cancelled && hasCookies(cookies) && isCookieSessionRejected(log);
}
