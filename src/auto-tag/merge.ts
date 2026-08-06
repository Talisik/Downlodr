// STUB — see src/auto-tag/README.md.
import type { TagResult } from './types';

export interface TaggedDownload {
 tags: string[];
 tagSource?: Record<string, 'manual' | 'tier1' | 'tier2'>;
}

/**
 * Real merge logic (tier1/tier2 accumulate rules — see the call site's
 * doc comment in tagsCategoriesActions.ts) was never committed upstream.
 * This pass-through leaves existing tags untouched.
 */
export function mergeTierResult(
 current: TaggedDownload,
 _result: TagResult,
): TaggedDownload {
 return current;
}
