/**
 * Turning yt-dlp-helper's metadata result into something a caller can act on.
 *
 * Pure and import-free on purpose: mcpBridgeServer.ts pulls in better-sqlite3
 * and electron at module scope and so cannot be loaded under vitest, which is
 * why the bridge's testable logic lives in small modules like this one beside
 * it (see the note at the top of mcpBridgeServer.batch.test.ts).
 */

/** The shape yt-dlp-helper's getInfo resolves. It carries no error field. */
export interface VideoInfoResult {
  ok: boolean;
  data?: unknown;
  isPlaylist?: boolean;
  entryCount?: number;
}

/** What the bridge should answer with, when a lookup did not produce metadata. */
export interface VideoInfoFailure {
  status: number;
  error: string;
  /** Always false: nothing about re-running the same lookup would change it. */
  retry: false;
}

/**
 * Describe why a video-info lookup produced nothing, or null when it succeeded.
 *
 * `{ ok: false }` is all the library gives us — yt-dlp's own reason ("This
 * video is not available") is discarded before it reaches any caller — so the
 * most honest answer names the URL and the handful of causes that actually
 * produce it. Forwarding the bare `ok: false`, as the bridge used to, left the
 * agent to speculate in the user's face instead.
 *
 * A container URL is the one failure the library does distinguish, via
 * `isPlaylist`, and it is a different conversation: the URL is fine, the
 * endpoint is wrong.
 */
export function describeVideoInfoFailure(
  url: string,
  info: VideoInfoResult | null | undefined,
): VideoInfoFailure | null {
  if (info && info.ok === true) return null;

  if (info?.isPlaylist) {
    const count = info.entryCount ?? 0;
    return {
      status: 400,
      error:
        `${url} is a playlist or channel container, not a single video ` +
        `(${count} entries). Use get_playlist_info for it, then request each ` +
        `entry's own URL.`,
      retry: false,
    };
  }

  return {
    status: 502,
    error:
      `Could not read video info for ${url}. yt-dlp returned no metadata, ` +
      'which means the video is unavailable rather than slow: it may be ' +
      'private, removed, age-restricted, region-blocked, or require sign-in. ' +
      'Do not retry — drop this URL and tell the user it could not be read.',
    retry: false,
  };
}
