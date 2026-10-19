/**
 * tagTranscript.ts
 *
 * Tier 2 tagger — enriches metadata tags with content terms from the transcript.
 *
 * Transcript terms are scored with TF-IDF **over the batch** (docs/PLAN.md):
 * distinctive terms that recur within one video (e.g. "neurons", "blockchain",
 * "flour") get high TF-IDF, while conversational filler that appears across all
 * videos ("really", "going", "pretty") has low IDF and is suppressed. This is
 * far cleaner than phrase extraction (RAKE) over rambling speech.
 *
 * Because IDF needs the corpus, tier 2 is a BATCH operation. A single-video call
 * still works (IDF degenerates to term frequency).
 *
 * Output ordering: title tags -> distinctive transcript terms. The channel is
 * not tagged (already shown from metadata). tier2 does not import tier1 — it
 * computes its own title tags via the shared extractor (keeps tiers independent).
 */

import { normalizeForTagging, stripSubtitleStructure } from '../clean';
import { extractTags, isValidWord } from '../extractor';
import { PorterStemmer, TfIdf } from '../natural';
import { dedupeOverlapping } from '../tagUtils';
import type { TagOptions, TagResult, Tier2Input } from '../types';

const TITLE_TOP_N = 4;
const TRANSCRIPT_TOP_N = 5;

/** Tokenize a transcript into valid unigrams + bigrams for TF-IDF. */
function transcriptTokens(raw: string): string[] {
  const text = normalizeForTagging(stripSubtitleStructure(raw)).toLowerCase();
  const words = text.split(/[^a-z0-9'-]+/).filter((w) => isValidWord(w));
  const grams: string[] = [...words];
  for (let i = 0; i < words.length - 1; i++) {
    // Skip repeated words ("give give") — spoken/lyric filler.
    if (words[i] !== words[i + 1]) grams.push(`${words[i]} ${words[i + 1]}`);
  }
  return grams;
}

/** Top-N distinctive transcript terms for document `idx`, stem-deduped. */
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
    // drop a term whose words are all contained in an already-kept term
    if (kept.some((k) => words.every((w) => k.split(' ').includes(w))))
      continue;
    seenStem.add(sig);
    kept.push(term);
    if (kept.length >= n) break;
  }
  return kept;
}

/** Tag a batch of videos with transcripts (builds one TF-IDF corpus). */
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

    // Title tags first (priority), then transcript terms; collapse near-dupes
    // so "macbook air review" absorbs "macbook" / "macbook air".
    const tags = dedupeOverlapping([...titleTags, ...transcriptTerms]);

    return { id: input.id, tags, tier: 2 };
  });
}

/** Tag a single video with a transcript (IDF degenerates to term frequency). */
export function tagTranscript(
  input: Tier2Input,
  opts: TagOptions = {},
): TagResult {
  return tagTranscriptBatch([input], opts)[0];
}
