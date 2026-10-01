/**
 * Channel URL comparison for duplicate-subscription detection.
 *
 * The same channel reaches the subscribe modal in many spellings — with or
 * without `www.`, the `m.` mobile host, a trailing slash, a share link's
 * `?si=` tracking param, a channel-tab suffix, different handle casing. An
 * exact string compare treats each of those as a new channel, so compare a
 * normalized key instead.
 *
 * `/shorts` is deliberately not a tab suffix here: a Shorts-only subscription
 * is kept as its own subscription (see SkedulosaSubscribeModal).
 */

export const YOUTUBE_CHANNEL_TAB_SUFFIXES = [
  '/featured',
  '/videos',
  '/streams',
  '/playlists',
  '/community',
  '/about',
];

const stripHostPrefix = (host: string): string =>
  host.replace(/^(www\.|m\.)/, '');

/** A comparison key for a channel URL — never shown, never sent anywhere. */
export const channelUrlKey = (url: string): string => {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed.toLowerCase();
  }
  const host = stripHostPrefix(parsed.hostname.toLowerCase());
  let path = parsed.pathname.replace(/\/+$/, '').toLowerCase();
  if (host === 'youtube.com') {
    const suffix = YOUTUBE_CHANNEL_TAB_SUFFIXES.find((s) => path.endsWith(s));
    if (suffix) path = path.slice(0, -suffix.length);
  }
  return `${host}${path}`;
};

export const isSameChannelUrl = (a: string, b: string): boolean =>
  channelUrlKey(a) === channelUrlKey(b);
