/** Metadata tagger. */

import { normalizeForTagging } from '../clean';
import { extractTags } from '../extractor';
import { dedupeCaseInsensitive } from '../tagUtils';
import type { Tier1Input, TagOptions, TagResult } from '../types';

const TIER1_TOP_N = 5;

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

export function tagMetadataBatch(
  inputs: Tier1Input[],
  opts: TagOptions = {},
): TagResult[] {
  return inputs.map((input) => tagMetadata(input, opts));
}
