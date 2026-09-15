/** Types for auto-tagging. */

export interface VideoMeta {
  id: string;
  title: string;
  description?: string;
  channel?: string;
  category?: string;
  artist?: string;
  track?: string;
  album?: string;
}

export type Tier1Input = VideoMeta;

export interface Tier2Input extends VideoMeta {
  transcript: string;
}

export type Tier = 1 | 2;

export interface TagResult {
  id: string;
  tags: string[];
  tier: Tier;
}

export interface TagOptions {
  topN?: number;
}
