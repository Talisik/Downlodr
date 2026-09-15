/** Merge tag results into a download's tag state. */

import type { TagResult, Tier } from './types';

export type TagSource = 'manual' | 'tier1' | 'tier2';

export interface TagState {
  tags: string[];
  tagSource: Record<string, TagSource>;
}

function tierSource(tier: Tier): TagSource {
  return tier === 1 ? 'tier1' : 'tier2';
}

export function mergeTierResult(
  current: Partial<TagState> | undefined,
  result: TagResult,
): TagState {
  const src = tierSource(result.tier);
  const tagSource: Record<string, TagSource> = {
    ...(current?.tagSource ?? {}),
  };

  const kept = (current?.tags ?? []).filter(
    (t) => tagSource[t.toLowerCase()] !== src,
  );
  for (const key of Object.keys(tagSource)) {
    if (tagSource[key] === src) delete tagSource[key];
  }

  const keptLower = new Set(kept.map((t) => t.toLowerCase()));
  for (const tag of result.tags) {
    const key = tag.toLowerCase();
    if (!keptLower.has(key)) {
      kept.push(tag);
      keptLower.add(key);
      tagSource[key] = src;
    }
  }

  return { tags: kept, tagSource };
}

export function addManualTags(
  current: Partial<TagState> | undefined,
  manualTags: string[],
): TagState {
  const tagSource: Record<string, TagSource> = {
    ...(current?.tagSource ?? {}),
  };
  const tags = [...(current?.tags ?? [])];
  const lower = new Set(tags.map((t) => t.toLowerCase()));

  for (const tag of manualTags) {
    const key = tag.toLowerCase();
    if (tag && !lower.has(key)) {
      tags.push(tag);
      lower.add(key);
      tagSource[key] = 'manual';
    }
  }

  return { tags, tagSource };
}
