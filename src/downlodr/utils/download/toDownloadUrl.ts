/**
 * Site-specific URL corrections applied at download time only.
 *
 * Some sites need a URL shape for the download that differs from the shape
 * metadata lookups accept. This module owns those corrections so the download
 * controller stays site-agnostic and future quirks land in one place.
 *
 * Every function here degrades to returning its input unchanged — a URL that
 * doesn't match a known quirk is passed through untouched.
 */

const TWO_LETTER = /^[a-z]{2}$/i;

/** True for viu.com and any of its subdomains. */
const isViuHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  return host === 'viu.com' || host.endsWith('.viu.com');
};

/**
 * yt-dlp only resolves Viu episodes when the language segment is prefixed with
 * the country code, but metadata lookups only work on the plain form:
 *
 *   /ott/ph/en/vod/49646/slug     <- what the share button copies (metadata ok)
 *   /ott/ph/ph-en/vod/49646/slug  <- what yt-dlp needs to download
 *
 * Both values are already in the path, so this reads them off segments 1 and 2
 * and re-emits segment 2 as `country-language`. The vod ID is stable across
 * both forms.
 *
 * Returns null when the path isn't a Viu episode URL in the plain form —
 * including when segment 2 already contains a hyphen, which is what makes this
 * idempotent for an already-corrected URL.
 */
const rewriteViu = (parsed: URL): string | null => {
  const segments = parsed.pathname.split('/').filter(Boolean);
  const [section, country, language, kind] = segments;

  // Scoped to single-episode URLs: that's the case this quirk is confirmed on.
  // /series/ and /live/ paths are left alone.
  if (section !== 'ott' || kind !== 'vod') return null;
  if (!TWO_LETTER.test(country ?? '')) return null;
  // A hyphen means the locale is already country-prefixed.
  if (!TWO_LETTER.test(language ?? '')) return null;

  segments[2] = `${country}-${language}`.toLowerCase();

  // Drop the query string — Viu's share button appends utm_* tracking params
  // that yt-dlp has no use for. The stored record keeps the full original.
  return `${parsed.origin}/${segments.join('/')}`;
};

/**
 * Maps a stored video URL to the URL that should be handed to yt-dlp for the
 * actual download. Call this at the download call site only — the stored
 * `videoUrl` must stay as the user entered it so metadata lookups keep working.
 *
 * @param videoUrl - The URL as stored on the download record.
 * @returns The URL to download from, or `videoUrl` unchanged when no
 *          site-specific correction applies.
 */
export const toDownloadUrl = (videoUrl: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(videoUrl);
  } catch {
    return videoUrl;
  }

  if (isViuHost(parsed.hostname)) {
    return rewriteViu(parsed) ?? videoUrl;
  }

  return videoUrl;
};
