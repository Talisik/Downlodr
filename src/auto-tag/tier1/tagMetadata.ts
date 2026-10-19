/**
 * tagMetadata.ts
 *
 * Tier 1 tagger — turns video metadata (title + description + channel) into a
 * set of descriptive tags. Metadata only; no transcript, no model.
 *
 * Output = [ publisher (atomic, verbatim) , ...extracted keyphrases ],
 * deduped case-insensitively (keeping the first/original-cased form).
 */

import { normalizeForTagging } from '../clean';
import { extractTags } from '../extractor';
import { dedupeCaseInsensitive } from '../tagUtils';
import type { Tier1Input, TagOptions, TagResult } from '../types';

/** Default number of extracted keyphrase tags for tier 1. */
const TIER1_TOP_N = 5;

/**
 * Tag a single video from its metadata.
 *
 * Tags come from the TITLE only. The description is intentionally NOT used (it
 * is a dump of credits / affiliate / sponsor boilerplate that only adds noise),
 * and the channel is NOT tagged (already shown from metadata — redundant). See
 * docs/PLAN.md §3a and the .temp eval.
 */
export function tagMetadata(
  input: Tier1Input,
  opts: TagOptions = {},
): TagResult {
  const topN = opts.topN ?? TIER1_TOP_N;

  const titleTags = extractTags(normalizeForTagging(input.title ?? ''), {
    topN,
  });
  const tags = dedupeCaseInsensitive(titleTags).slice(0, topN);

  return { id: input.id, tags, tier: 1 };
}

/** Tag a batch of videos (on-demand batch entry point). */
export function tagMetadataBatch(
  inputs: Tier1Input[],
  opts: TagOptions = {},
): TagResult[] {
  return inputs.map((input) => tagMetadata(input, opts));
}
