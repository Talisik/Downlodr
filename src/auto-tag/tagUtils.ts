/** Shared tag helpers. */

import { PorterStemmer } from './natural';

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
