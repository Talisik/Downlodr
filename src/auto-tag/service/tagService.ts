/**
 * tagService.ts  (main process)
 *
 * Orchestrates auto-tagging for a batch of downloads. For each item:
 *   - if a readable transcript file exists -> tier 2 (metadata + transcript)
 *   - otherwise                            -> tier 1 (metadata only)
 *
 * Pure JS (natural) — no model, no heavy init. Transcript files are read here
 * because file access lives in the main process.
 */

import fs from 'fs';
import { tagMusic } from '../music';
import { tagMetadata } from '../tier1';
import { tagTranscriptBatch } from '../tier2';
import type { TagResult, Tier2Input } from '../types';

/** Minimal slice of a download needed to tag it. */
export interface TagJobInput {
  id: string;
  title: string;
  description?: string;
  channel?: string;
  /** Native source category (e.g. yt-dlp "Music") — routes music to its own tagger. */
  category?: string;
  // Structured music metadata (yt-dlp) — used by the music route when present.
  artist?: string;
  track?: string;
  album?: string;
  /** Absolute path to a transcript file (SRT/VTT/txt). Triggers tier 2 when readable. */
  transcriptLocation?: string;
}

/** Whether a category routes to the music-specific tagger. */
function isMusic(category?: string): boolean {
  return (category ?? '').trim().toLowerCase() === 'music';
}

function readTranscript(filePath?: string): string | null {
  if (!filePath) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return raw.trim() ? raw : null;
  } catch {
    return null; // unreadable -> fall back to tier 1
  }
}

/**
 * Tag a batch of downloads. Routing per item:
 *   - native category "Music"      -> music tagger (title parse; transcript ignored)
 *   - has a readable transcript     -> tier 2 (batched; TF-IDF needs the corpus)
 *   - otherwise                     -> tier 1 (metadata only)
 * Results preserve input order.
 */
export function runAutoTag(inputs: TagJobInput[]): TagResult[] {
  const tier2Inputs: Tier2Input[] = [];
  const byId = new Map<string, TagResult>();

  for (const input of inputs) {
    const meta = {
      id: input.id,
      title: input.title,
      description: input.description,
      channel: input.channel,
      category: input.category,
      artist: input.artist,
      track: input.track,
      album: input.album,
    };

    if (isMusic(input.category)) {
      byId.set(input.id, tagMusic(meta)); // music: ignore transcript
      continue;
    }

    const transcript = readTranscript(input.transcriptLocation);
    if (transcript) {
      tier2Inputs.push({ ...meta, transcript });
    } else {
      byId.set(input.id, tagMetadata(meta));
    }
  }

  for (const result of tagTranscriptBatch(tier2Inputs)) {
    byId.set(result.id, result);
  }

  return inputs.map((i) => byId.get(i.id)!);
}
