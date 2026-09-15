/** Transcript tagger. */

import { normalizeForTagging, stripSubtitleStructure } from '../clean';
import { extractTags, isValidWord } from '../extractor';
import { PorterStemmer, TfIdf } from '../natural';
import { dedupeOverlapping } from '../tagUtils';
import type { TagOptions, TagResult, Tier2Input } from '../types';

const TITLE_TOP_N = 4;
const TRANSCRIPT_TOP_N = 5;

function transcriptTokens(raw: string): string[] {
  const text = normalizeForTagging(stripSubtitleStructure(raw)).toLowerCase();
  const words = text.split(/[^a-z0-9'-]+/).filter((w) => isValidWord(w));
  const grams: string[] = [...words];
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] !== words[i + 1]) grams.push(`${words[i]} ${words[i + 1]}`);
  }
  return grams;
}

function topTranscriptTerms(tfidf: TfIdf, idx: number, n: number): string[] {
  const terms = tfidf
    .listTerms(idx)
    .slice(0, 40)
    .map((t) => t.term);

  const kept: string[] = [];
  const seenStem = new Set<string>();
  for (const term of terms) {
    const words = term.split(' ');
    const sig = [...new Set(words.map((w) => PorterStemmer.stem(w)))]
      .sort()
      .join(' ');
    if (seenStem.has(sig)) continue;
    if (kept.some((k) => words.every((w) => k.split(' ').includes(w))))
      continue;
    seenStem.add(sig);
    kept.push(term);
    if (kept.length >= n) break;
  }
  return kept;
}

export function tagTranscriptBatch(
  inputs: Tier2Input[],
  opts: TagOptions = {},
): TagResult[] {
  const tfidf = new TfIdf();
  for (const input of inputs) {
    tfidf.addDocument(transcriptTokens(input.transcript ?? ''));
  }

  return inputs.map((input, idx) => {
    const titleTags = extractTags(normalizeForTagging(input.title ?? ''), {
      topN: TITLE_TOP_N,
    });
    const transcriptTerms = topTranscriptTerms(
      tfidf,
      idx,
      opts.topN ?? TRANSCRIPT_TOP_N,
    );

    const tags = dedupeOverlapping([...titleTags, ...transcriptTerms]);

    return { id: input.id, tags, tier: 2 };
  });
}

export function tagTranscript(
  input: Tier2Input,
  opts: TagOptions = {},
): TagResult {
  return tagTranscriptBatch([input], opts)[0];
}
