/**
 * Recover per-entry metadata that yt-dlp hides in the entry URL.
 *
 * `--flat-playlist` only guarantees `{ie_key, id, _type, url}` per entry.
 * YouTube happens to also emit `title`/`thumbnails`, which is why the playlist
 * selection page has always looked populated. Extractors that resolve the
 * container in one request instead smuggle the episode's metadata into the URL
 * fragment, so the flat entry itself is bare:
 *
 *   https://www.bilibili.tv/en/play/2288197/24739195#__youtubedl_smuggle=%7B%22title%22...
 *
 * The fragment is a URL-encoded JSON blob (yt-dlp's `smuggle_url`) carrying
 * title, description, thumbnail and episode_number. Without unpacking it the
 * selection page shows a list of blank rows, and the only way to learn what an
 * episode is called is to select it and run a full per-video getInfo.
 *
 * Only fills in fields the entry does not already have, so YouTube and every
 * other extractor that reports them properly is untouched.
 */

const SMUGGLE_MARKER = '__youtubedl_smuggle=';

interface SmuggledMetadata {
  title?: string;
  description?: string;
  thumbnail?: string;
  timestamp?: number | null;
  episode_number?: number | null;
}

/** Parse the `#__youtubedl_smuggle=` fragment off a URL, if it has one. */
export function readSmuggledMetadata(url: unknown): SmuggledMetadata | null {
  if (typeof url !== 'string') return null;
  const marker = url.indexOf(SMUGGLE_MARKER);
  if (marker === -1) return null;
  try {
    const encoded = url.slice(marker + SMUGGLE_MARKER.length);
    // yt-dlp encodes spaces as '+', which decodeURIComponent leaves alone.
    const parsed: unknown = JSON.parse(
      decodeURIComponent(encoded.replace(/\+/g, ' ')),
    );
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as SmuggledMetadata;
  } catch {
    // A malformed fragment is not worth failing the whole playlist over —
    // the entry just stays as bare as yt-dlp reported it.
    return null;
  }
}

/**
 * Fill missing `title`/`thumbnails` on flat-playlist entries from their
 * smuggled URL fragment. Mutates nothing; returns a new response object.
 */
export function hydratePlaylistEntries<T>(info: T): T {
  const response = info as {
    data?: { entries?: Record<string, unknown>[] };
  } | null;
  const entries = response?.data?.entries;
  if (!Array.isArray(entries)) return info;

  return {
    ...(info as object),
    data: {
      ...response.data,
      entries: entries.map((entry) => {
        if (!entry || typeof entry !== 'object') return entry;

        const hasTitle = typeof entry.title === 'string' && entry.title !== '';
        const hasThumbnail =
          Array.isArray(entry.thumbnails) && entry.thumbnails.length > 0;
        if (hasTitle && hasThumbnail) return entry;

        const smuggled = readSmuggledMetadata(entry.url);
        if (!smuggled) return entry;

        const hydrated = { ...entry };
        if (!hasTitle && typeof smuggled.title === 'string') {
          hydrated.title = smuggled.title;
        }
        if (!hasThumbnail && typeof smuggled.thumbnail === 'string') {
          hydrated.thumbnails = [{ url: smuggled.thumbnail }];
        }
        if (
          hydrated.description == null &&
          typeof smuggled.description === 'string'
        ) {
          hydrated.description = smuggled.description;
        }
        if (
          hydrated.episode_number == null &&
          typeof smuggled.episode_number === 'number'
        ) {
          hydrated.episode_number = smuggled.episode_number;
        }
        return hydrated;
      }),
    },
  } as T;
}
