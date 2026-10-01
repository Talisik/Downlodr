/**
 * Whether yt-dlp's error output says the site itself refused the request —
 * Cloudflare's anti-bot challenge, a CAPTCHA wall, or a bare HTTP 403.
 *
 * Without this the metadata fetch fell through to the generic "No info
 * returned" and the renderer told the user to "enter a valid video URL",
 * which is wrong: the link is fine, the site blocked the automated request
 * (e.g. a Medium article page).
 */
export function isBlockedBySite(ytdlpOutput: string): boolean {
  return /cloudflare|anti-bot|captcha|HTTP Error 403/i.test(ytdlpOutput);
}
