/**
 * Site-specific URL corrections applied to every yt-dlp call made from the
 * main process — metadata, download, preview and preview download alike.
 *
 * Unlike the renderer's toDownloadUrl (download-only), these are needed
 * because the URL the user pastes cannot be extracted at all. The stored
 * record keeps the URL as entered, so "Copy link" / "Open in browser" still
 * point at the page the user knows.
 *
 * Every rewrite degrades to returning its input unchanged.
 */

const isVimeoPageHost = (host: string): boolean =>
  host === 'vimeo.com' || host === 'www.vimeo.com';

const NUMERIC_ID = /^\d+$/;
// Vimeo's privacy hash for unlisted videos: vimeo.com/<id>/<hash>.
const PRIVACY_HASH = /^[0-9a-f]{6,}$/i;

/**
 * vimeo.com/<id> → player.vimeo.com/video/<id>.
 *
 * Vimeo's page ("web client") now answers yt-dlp with "The web client only
 * works when logged-in" for public videos, while the embed player endpoint
 * still serves the same video with full formats. Verified with the bundled
 * yt-dlp 2026.08.19: vimeo.com/1084537 fails, player.vimeo.com/video/1084537
 * returns metadata and downloads.
 */
const rewriteVimeo = (parsed: URL): string | null => {
  const segments = parsed.pathname.split('/').filter(Boolean);
  let id: string | undefined;
  let hash: string | undefined;

  if (NUMERIC_ID.test(segments[0] ?? '')) {
    // /<id> or /<id>/<hash>
    if (segments.length > 2) return null;
    id = segments[0];
    if (segments[1]) {
      if (!PRIVACY_HASH.test(segments[1])) return null;
      hash = segments[1];
    }
  } else if (
    segments[0] === 'channels' &&
    segments.length === 3 &&
    NUMERIC_ID.test(segments[2])
  ) {
    // /channels/<name>/<id>
    id = segments[2];
  } else {
    return null;
  }

  const player = `https://player.vimeo.com/video/${id}`;
  return hash ? `${player}?h=${hash}` : player;
};

export const toExtractorUrl = (url: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (isVimeoPageHost(parsed.hostname.toLowerCase())) {
    return rewriteVimeo(parsed) ?? url;
  }
  return url;
};
