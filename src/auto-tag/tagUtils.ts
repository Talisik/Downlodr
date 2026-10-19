/**
 * tagUtils.ts
 *
 * Small helpers shared by tier1 and tier2 (so the tiers never import each other).
 */

import { PorterStemmer } from './natural';

/** Dedup case-insensitively, keeping the first occurrence's original casing. */
export function dedupeCaseInsensitive(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const key = t.toLowerCase();
    if (t && !seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

/**
 * Drop near-duplicate tags by token overlap (first occurrence = highest priority
 * wins). A later tag is dropped when, versus a kept one, it is a subset OR shares
 * 2+ word stems — collapsing "macbook" / "macbook air" / "macbook air review"
 * into one, while keeping distinct tags that share at most one word
 * ("macbook air review" vs "macbook pro").
 */
export function dedupeOverlapping(tags: string[]): string[] {
  const kept: { tag: string; stems: Set<string> }[] = [];

  for (const tag of tags) {
    if (!tag) continue;
    const stems = new Set(
      tag
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => PorterStemmer.stem(w)),
    );
    if (stems.size === 0) continue;

    const tooSimilar = kept.some((k) => {
      const shared = [...stems].filter((s) => k.stems.has(s)).length;
      return shared === stems.size || shared >= 2;
    });
    if (!tooSimilar) kept.push({ tag, stems });
  }

  return kept.map((k) => k.tag);
}
