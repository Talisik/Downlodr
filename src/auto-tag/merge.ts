/**
 * merge.ts
 *
 * Accumulate tag results across tiers and manual edits (docs/PLAN.md §6).
 *
 * Rules:
 *   final tags = manual ∪ tier1 ∪ tier2   (deduped, case-insensitive)
 *   re-running a tier refreshes ONLY its own tags:
 *     - manual tags are never clobbered
 *     - the other tier's tags survive
 *
 * Source is tracked per tag (keyed by lowercased tag) so a re-run can remove
 * exactly the tags it previously contributed. Tags with no recorded source
 * (e.g. legacy/manual) are always preserved.
 */

import type { TagResult, Tier } from './types';

export type TagSource = 'manual' | 'tier1' | 'tier2';

export interface TagState {
  /** Union of all tags, original casing preserved. */
  tags: string[];
  /** lowercased tag -> the source that contributed it. */
  tagSource: Record<string, TagSource>;
}

function tierSource(tier: Tier): TagSource {
  return tier === 1 ? 'tier1' : 'tier2';
}

/**
 * Merge a tier's tag result into the current state.
 *
 * Removes the tags this tier previously contributed, then adds the new ones
 * (skipping any already owned by manual or the other tier — those win).
 */
export function mergeTierResult(
  current: Partial<TagState> | undefined,
  result: TagResult,
): TagState {
  const src = tierSource(result.tier);
  const tagSource: Record<string, TagSource> = {
    ...(current?.tagSource ?? {}),
  };

  // 1. Drop tags previously contributed by THIS tier.
  const kept = (current?.tags ?? []).filter(
    (t) => tagSource[t.toLowerCase()] !== src,
  );
  for (const key of Object.keys(tagSource)) {
    if (tagSource[key] === src) delete tagSource[key];
  }

  // 2. Add this tier's tags if not already owned by manual / the other tier.
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

/**
 * Register manually-added tags into the state (so later tier runs won't clobber
 * them). Adds any not already present, marking them 'manual'.
 */
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
