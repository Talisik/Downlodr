import { normalizeForTagging } from '../clean';
import type { VideoMeta } from '../types';

export function gatherMetadataText(input: VideoMeta): string {
  const parts = [input.title ?? '', input.description ?? ''];
  return normalizeForTagging(parts.join('. '));
}
