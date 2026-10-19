// src/core-app/ipc/main/cookieAuth/state.ts
import { detectBrowsers, type BrowserDetection } from './browserDetection';
import { extractRegistrableDomain } from './domain';
import { customJarExists, customJarPath, jarExistsFor, jarPathFor } from './jarImport';
import { findSiteLoginForDomain } from './siteLogins';

export type CookieAuthMode = 'live' | 'import' | 'file' | 'none';

// Mirrors settingsStore's cookieAuthMode/cookieAuthBrowser in the main
// process. The renderer's copy lives in IndexedDB, which main can't read
// directly, so the renderer pushes changes here over IPC (Task 6) and this
// module is the source of truth for every yt-dlp call.
let currentMode: CookieAuthMode = 'none';
let currentBrowser: string | null = null;

export function setCookieAuthMode(
  mode: CookieAuthMode,
  browser: string | null,
): void {
  currentMode = mode;
  currentBrowser = mode === 'none' ? null : browser;
}

export function getCookieAuthState(): {
  mode: CookieAuthMode;
  browser: string | null;
  detected: BrowserDetection[];
} {
  return { mode: currentMode, browser: currentBrowser, detected: detectBrowsers() };
}

/**
 * What every yt-dlp call (getInfo/getPlaylistInfo/download) should spread
 * into its options.
 *
 * The "no cookie auth" result is `{ cookiesFromBrowser: '', cookies: '' }`,
 * NOT `{}`. yt-dlp-helper's getInfo/getPlaylistInfo auto-inject
 * `cookiesFromBrowser: <detected browser>` for YouTube/TikTok URLs via
 * getDefaultMetadataOptionsForUrl(), then merge caller options on top with
 * object spread. An absent key does not override that default; an explicit
 * empty string does (getArgs()/getMetadataArgs() gate on `if
 * (cookiesFromBrowser)`), which is what suppresses the auto-selected browser
 * so "cookies = none" actually reaches yt-dlp. A running Chrome otherwise
 * makes every YouTube metadata call fail with "Could not copy Chrome cookie
 * database".
 */
export async function resolveCookiesForCall(targetUrl: string): Promise<{
  cookiesFromBrowser?: string;
  cookies?: string;
}> {
  // The single "no cookies" result, used by every fall-through below.
  const suppress = { cookiesFromBrowser: '', cookies: '' };

  // Per-site login takes priority over the global mode for its own domain
  // (user-approved priority — see the design spec's "Priority" section).
  const domain = extractRegistrableDomain(targetUrl);
  if (domain) {
    try {
      const siteLogin = await findSiteLoginForDomain(domain);
      if (siteLogin) {
        const { stat } = await import('fs/promises');
        const exists = await stat(siteLogin.jarPath)
          .then((st) => st.isFile() && st.size > 0)
          .catch(() => false);
        if (exists)
          return { cookies: siteLogin.jarPath, cookiesFromBrowser: '' };
        // Jar went missing (deleted externally) — fall through to the global
        // mode rather than treating this as "cookies configured but broken".
      }
    } catch {
      // Any failure reading the site-login registry must never block a
      // download — fall through to the global mode.
    }
  }

  if (currentMode === 'none') return suppress;

  if (currentMode === 'file') {
    const exists = await customJarExists();
    if (!exists) return suppress;
    return { cookies: customJarPath(), cookiesFromBrowser: '' };
  }

  if (!currentBrowser) return suppress;

  if (currentMode === 'live') {
    return { cookiesFromBrowser: currentBrowser };
  }

  // import mode: fall back to suppression rather than throwing if the jar
  // somehow isn't there (deleted externally, import never completed) — a
  // missing jar must never turn into a blocked download.
  const exists = await jarExistsFor(currentBrowser);
  if (!exists) return suppress;
  return { cookies: jarPathFor(currentBrowser), cookiesFromBrowser: '' };
}
