/**
 * Recovering when YouTube rejects the user's signed-in cookies.
 *
 * Once yt-dlp sees YouTube account cookies it only uses player clients that
 * need a JavaScript runtime to solve YouTube's challenge, and Downlodr ships
 * none. YouTube then answers every request with "The page needs to be
 * reloaded." Without cookies yt-dlp falls back to a client that needs no JS
 * runtime, so the same video downloads fine. Sign-in-gated videos
 * (age-restricted, members-only) fail either way, so single-video YouTube
 * calls skip cookies up front (cookiesForVideo). The retry below stays for
 * when cookiesForVideo is dropped.
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

const YOUTUBE_HOST = /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/i;

export function isYouTubeUrl(url: string): boolean {
  try {
    return YOUTUBE_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Cookies for a single-video lookup or download. YouTube gets none: without
 * a JS runtime the cookies can't unlock sign-in-gated videos anyway, and
 * sending them only costs a rejected first attempt plus, on macOS with a
 * Chromium browser selected, a keychain prompt. Playlist lookups keep the
 * cookies — listing a private playlist reads the page, not the player.
 * Drop this once Downlodr bundles a JS runtime for yt-dlp.
 */
export function cookiesForVideo(
  url: string,
  cookies: CookieOptions,
): CookieOptions {
  return isYouTubeUrl(url) ? NO_COOKIES : cookies;
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
