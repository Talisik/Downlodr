import { detectBrowsers, type BrowserDetection } from './browserDetection';
import { extractRegistrableDomain } from './domain';
import { customJarExists, customJarPath, jarExistsFor, jarPathFor } from './jarImport';
import { findSiteLoginForDomain } from './siteLogins';

export type CookieAuthMode = 'live' | 'import' | 'file' | 'none';

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

export async function resolveCookiesForCall(targetUrl: string): Promise<{
  cookiesFromBrowser?: string;
  cookies?: string;
}> {
  const suppress = { cookiesFromBrowser: '', cookies: '' };

  const domain = extractRegistrableDomain(targetUrl);
  if (domain) {
    try {
      const siteLogin = await findSiteLoginForDomain(domain);
      if (siteLogin) {
        const { stat } = await import('fs/promises');
        const exists = await stat(siteLogin.jarPath)
          .then((st) => st.isFile() && st.size > 0)
          .catch(() => false);
        if (exists) return { cookies: siteLogin.jarPath };
      }
    } catch {
    }
  }

  if (currentMode === 'none') return suppress;

  if (currentMode === 'file') {
    const exists = await customJarExists();
    if (!exists) return suppress;
    return { cookies: customJarPath() };
  }

  if (!currentBrowser) return suppress;

  if (currentMode === 'live') {
    return { cookiesFromBrowser: currentBrowser };
  }

  const exists = await jarExistsFor(currentBrowser);
  if (!exists) return suppress;
  return { cookies: jarPathFor(currentBrowser) };
}
