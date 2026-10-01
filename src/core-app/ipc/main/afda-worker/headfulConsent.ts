/**
 * When a site blocks the AFDA backend's headless Chrome (Cloudflare challenge,
 * or a JS shell that renders empty), the backend retries with a visible
 * Chrome window — but only if the consent handler agrees, and with no handler
 * set it treats the retry as approved. On macOS that window can't be kept off
 * screen: it opens in the foreground and takes focus. So on macOS the worker
 * declines every retry; the article is reported as blocked instead. Windows
 * keeps the default: its headful Chrome runs on a hidden desktop.
 */

export type HeadfulConsentInfo = { url: string; reason: string };
export type SetHeadfulConsentHandler = (
  fn: ((info: HeadfulConsentInfo) => Promise<boolean>) | null,
) => void;

/**
 * Installs the decline-everything handler on macOS. Returns whether it was
 * installed. Add-on builds that predate setHeadfulConsentHandler are left
 * alone.
 */
export function declineHeadfulRetryOnMac(
  setHandler: SetHeadfulConsentHandler | undefined,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (platform !== 'darwin' || typeof setHandler !== 'function') return false;
  setHandler(async ({ url, reason }) => {
    console.log(
      `[afda-worker] declined visible-browser retry for ${url} (${reason}) — macOS keeps scraping headless`,
    );
    return false;
  });
  return true;
}
