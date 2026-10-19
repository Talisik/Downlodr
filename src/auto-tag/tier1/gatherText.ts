/**
 * gatherText.ts
 *
 * Builds the tier-1 corpus from structured metadata and cleans it for the
 * extractor. Channel/publisher is intentionally NOT folded in here — it is
 * emitted as an atomic verbatim tag by tagMetadata.ts (so names like
 * "3Blue1Brown" are never fragmented by phrase splitting).
 */

import { normalizeForTagging } from '../clean';
import type { VideoMeta } from '../types';

/**
 * Combine title + description into one cleaned corpus for extraction.
 * Title is placed first so its phrases lead the text.
 */
export function gatherMetadataText(input: VideoMeta): string {
  const parts = [input.title ?? '', input.description ?? ''];
  return normalizeForTagging(parts.join('. '));
}
