/**
 * Share-link payload encoding.
 *
 * A share link is self-contained: the source URLs live inside the link itself,
 * encoded into the `shareId` query param, with no server record behind it.
 * Categories can hold many videos, so the payload is deflated before encoding —
 * 100 videos land near 1,550 characters instead of ~6,250.
 *
 * Deflate does nothing for a single video: one URL is ~100 bytes with no
 * repetition to exploit, so the encoded link comes out the same length plain
 * base64 would give. It is applied uniformly anyway to keep one wire format.
 *
 * Wire format:  ?shareId=z.<base64url(deflate-raw(utf8(json)))>
 *
 * Legacy links stay valid: they are plain base64 of `{url, createdAt}` (or
 * `{url, expiresAt}` from the shortener-fallback path) and always begin `eyJ`,
 * so downlodr.com/share-video can tell the two apart by prefix alone.
 */

/**
 * Gates every share entry point in the UI. Off until downlodr.com's
 * share-video page is configured to open these links.
 */
export const SHARE_ENABLED = false;

/** Landing page that decodes `shareId` and renders the shared video(s). */
export const SHARE_BASE_URL = 'https://downlodr.com/share-video/';

/** Marks the deflate + base64url format, distinguishing it from legacy `eyJ…` payloads. */
const FORMAT_PREFIX = 'z.';

/** Carried in the payload so the share page can evolve the shape without guessing. */
const SCHEMA_VERSION = 1;

/**
 * Cap on videos in a single category share, chosen for what the share page can
 * sensibly render. Length is a secondary concern but not a free one: each video
 * costs ~14 chars once deflated, so a full 100-video share lands near 1,550 —
 * under the ~2,000-char ceiling browsers and mail clients handle comfortably,
 * though playlist URLs carrying `&list=`/`&index=` eat into that margin.
 */
export const MAX_SHARED_VIDEOS = 100;

/**
 * Decoded shape the share page receives. Keys are terse because they are
 * repeated once per share and sit in a URL.
 */
export interface SharePayload {
  /** Schema version. */
  v: number;
  /** 'v' = single video, 'c' = category. */
  t: 'v' | 'c';
  /** Category name. Absent on single-video shares */
  n?: string;
  /** Source URLs, in display order. */
  u: string[];
  /** Created at, unix seconds. */
  c: number;
}

/**
 * base64url over raw bytes: the standard alphabet's `+` decodes as a space in a
 * query string, which would corrupt every payload. Padding is dropped since it
 * carries no information.
 */
const toBase64Url = (bytes: Uint8Array): string => {
  // Chunked because String.fromCharCode(...) blows the argument limit on large inputs.
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/** Deflate (raw, no zlib header) via the platform CompressionStream. */
const deflateRaw = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

/**
 * Drops blanks and duplicates while preserving order. Duplicates are common
 * when a category was built from overlapping playlists, and removing them
 * shrinks the payload as a side effect.
 */
const normalizeUrls = (urls: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
};

/**
 * Encodes a payload into the `shareId` value.
 *
 * Uses TextEncoder rather than `btoa` directly: `btoa` throws on any character
 * above U+00FF, so a category named "音楽" or one carrying an emoji would fail.
 */
export const encodeSharePayload = async (
  payload: SharePayload,
): Promise<string> => {
  const json = new TextEncoder().encode(JSON.stringify(payload));
  return FORMAT_PREFIX + toBase64Url(await deflateRaw(json));
};

/** Assembles the full landing-page URL for an encoded payload. */
export const buildShareUrl = (shareId: string): string =>
  `${SHARE_BASE_URL}?shareId=${shareId}`;

/**
 * Share link for a single video. Emits the same shape as a category share with
 * one entry, so the share page needs only one code path.
 */
export const buildVideoShareLink = async (
  videoUrl: string,
): Promise<string | null> => {
  const urls = normalizeUrls([videoUrl]);
  if (urls.length === 0) return null;

  return buildShareUrl(
    await encodeSharePayload({
      v: SCHEMA_VERSION,
      t: 'v',
      u: urls,
      c: Math.floor(Date.now() / 1000),
    }),
  );
};

/**
 * Share link for a category and the videos inside it. Returns null when the
 * category has no shareable videos; callers surface that as an error toast.
 *
 * Per-video titles are deliberately omitted — they would roughly double the
 * payload for text the share page can resolve itself from the source URLs.
 */
export const buildCategoryShareLink = async (
  categoryName: string,
  videoUrls: readonly string[],
): Promise<string | null> => {
  const urls = normalizeUrls(videoUrls).slice(0, MAX_SHARED_VIDEOS);
  if (urls.length === 0) return null;

  return buildShareUrl(
    await encodeSharePayload({
      v: SCHEMA_VERSION,
      t: 'c',
      n: categoryName?.trim() || undefined,
      u: urls,
      c: Math.floor(Date.now() / 1000),
    }),
  );
};
