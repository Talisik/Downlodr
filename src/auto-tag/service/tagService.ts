/** Auto-tagging service (main process). */

import fs from 'fs';
import { tagMusic } from '../music';
import { tagMetadata } from '../tier1';
import { tagTranscriptBatch } from '../tier2';
import type { TagResult, Tier2Input } from '../types';

export interface TagJobInput {
  id: string;
  title: string;
  description?: string;
  channel?: string;
  category?: string;
  artist?: string;
  track?: string;
  album?: string;
  transcriptLocation?: string;
}

function isMusic(category?: string): boolean {
  return (category ?? '').trim().toLowerCase() === 'music';
}

function readTranscript(filePath?: string): string | null {
  if (!filePath) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

/** Tag a batch of downloads. Results preserve input order. */
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
      byId.set(input.id, tagMusic(meta));
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
