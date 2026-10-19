/**
 * types.ts
 *
 * Public types for the auto-tagging feature. See docs/PLAN.md.
 */

/** Structured video metadata available after a link is fetched. */
export interface VideoMeta {
  id: string;
  title: string;
  description?: string;
  channel?: string;
  /** Native source category (e.g. yt-dlp "Music"). Used for routing, not tagged. */
  category?: string;
  // Structured music metadata (yt-dlp), present mainly on Topic/art-track uploads.
  artist?: string;
  track?: string;
  album?: string;
}

/** Tier 1 input — metadata only, no transcript by design. */
export type Tier1Input = VideoMeta;

/** Tier 2 input — metadata plus a transcript (raw SRT/VTT/txt or plain prose). */
export interface Tier2Input extends VideoMeta {
  transcript: string;
}

export type Tier = 1 | 2;

/** Result of tagging one video at a given tier. */
export interface TagResult {
  id: string;
  tags: string[];
  tier: Tier;
}

export interface TagOptions {
  /** Max extracted tags (publisher tag is added on top). Default per tier. */
  topN?: number;
}
