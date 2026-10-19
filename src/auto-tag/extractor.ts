/**
 * extractor.ts
 *
 * Embedding-free keyword/keyphrase extraction for auto-tagging.
 *
 * Strategy (RAKE — Rapid Automatic Keyword Extraction — with bounded n-gram
 * emission):
 *   1. Split cleaned text into candidate phrases, breaking on stopwords and
 *      punctuation (a phrase = a run of content words).
 *   2. Score each WORD by RAKE: score(w) = degree(w) / freq(w), where degree
 *      counts a word's co-occurrences within phrases (longer phrases => higher
 *      degree => multi-word context is rewarded).
 *   3. Emit readable tag candidates as the 1–3 word sub-spans of each phrase,
 *      scored by the sum of their member word scores.
 *   4. Stem-dedup (Porter): collapse run/running; drop a candidate that is a
 *      token-subset of a higher-scoring kept candidate.
 *   5. Return the top-N surface phrases.
 *
 * No embeddings, no model — pure `natural`. See docs/PLAN.md §3/§3a.
 *
 * Input is expected to be already cleaned by clean.ts (URLs/emojis/boilerplate
 * removed). This module additionally drops stopwords, short tokens, and
 * vowel-less tokens.
 */

import { PorterStemmer, stopwords } from './natural';

// ─── Stopwords ────────────────────────────────────────────────────────────────

/**
 * Generic words that are valid English but make poor tags. Augments natural's
 * built-in stopword list (~170 words).
 */
const EXTRA_STOPWORDS = [
  'video',
  'videos',
  'watch',
  'channel',
  'today',
  'new',
  'one',
  'two',
  'way',
  'thing',
  'things',
  'part',
  'episode',
  'full',
  'official',
  'free',
  'best',
  'get',
  'make',
  'use',
  'using',
  'like',
  'just',
  'really',
  'actually',
  // production credits / affiliate boilerplate (common description noise)
  'executive',
  'producer',
  'production',
  'directed',
  'filmed',
  'edited',
  'copyright',
  'links',
  'store',
  'buy',
  'content',
  'company',
  // spoken-transcript contractions / fillers
  "it's",
  "i'm",
  "we're",
  "let's",
  "that's",
  "you're",
  "don't",
  "doesn't",
  "didn't",
  "can't",
  "won't",
  "they're",
  "what's",
  "here's",
  "there's",
  'gonna',
  'wanna',
  'okay',
  'yeah',
  'guys',
  'stuff',
  'going',
  'say',
  'right',
  'people',
  'want',
  // generic title descriptors — weak as standalone tags
  'good',
  'bad',
  'ugly',
  'best',
  'worst',
  'every',
  'everything',
  'anything',
  'amazing',
  'awesome',
  'crazy',
  'insane',
  'needs',
  'more',
  'else',
  // modal / auxiliary verbs — never useful as tags
  'will',
  'would',
  'should',
  'could',
  'shall',
  'may',
  'might',
  'must',
  'let',
  'keep',
  'come',
  'comes',
];

const STOPWORDS = new Set<string>([...stopwords, ...EXTRA_STOPWORDS]);

// ─── Word validity ────────────────────────────────────────────────────────────

function hasVowel(word: string): boolean {
  return /[aeiouy]/.test(word);
}

/**
 * A token usable inside a tag: 3+ chars, not a stopword, not a pure number.
 * Requires a vowel UNLESS it is short (<= 5 chars), which lets vowel-less
 * acronyms through (css, sql, php, xml, html). Alphanumeric tokens
 * (e.g. "3blue1brown", "web3") are kept whole.
 */
/** Contraction suffixes that are never real tags (we'll, you're, i've, n't...). */
const CONTRACTION = /(?:'(?:ll|re|ve|m|d)|n't)$/i;

export function isValidWord(word: string): boolean {
  return (
    word.length >= 3 &&
    (hasVowel(word) || word.length <= 5) &&
    !/^\d+$/.test(word) &&
    !CONTRACTION.test(word) &&
    !STOPWORDS.has(word)
  );
}

// ─── Phrase splitting ─────────────────────────────────────────────────────────

/**
 * Split text into content-word phrases. Phrases break on punctuation and on
 * stopwords / invalid tokens. Digits are dropped (the char class keeps only
 * letters, apostrophes, hyphens, and whitespace).
 */
function splitPhrases(text: string): string[][] {
  const phrases: string[][] = [];

  // Break on any run of non-(letter/digit/apostrophe/hyphen/space). Digits are
  // kept *inside* tokens so alphanumeric names (3blue1brown, web3) stay whole;
  // pure-number tokens are rejected later by isValidWord.
  const chunks = text.toLowerCase().split(/[^a-z0-9'\-\s]+/);

  for (const chunk of chunks) {
    let current: string[] = [];
    for (const raw of chunk.split(/\s+/)) {
      let word = raw.replace(/^[-']+|[-']+$/g, ''); // trim edge punctuation
      // Possessive "'s" is a phrase boundary: "Gordon Ramsay's eggs" ->
      // ["gordon","ramsay"] | ["eggs"]. Keep the possessor, then end the phrase.
      const possessive = /'s$/i.test(word);
      if (possessive) word = word.replace(/'s$/i, '');

      if (word && isValidWord(word)) {
        current.push(word);
        if (possessive) {
          phrases.push(current);
          current = [];
        }
      } else if (current.length) {
        phrases.push(current);
        current = [];
      }
    }
    if (current.length) phrases.push(current);
  }

  return phrases;
}

// ─── RAKE word scores ─────────────────────────────────────────────────────────

/** Compute RAKE word scores: score(w) = degree(w) / freq(w). */
function wordScores(phrases: string[][]): Map<string, number> {
  const freq = new Map<string, number>();
  const degree = new Map<string, number>();

  for (const phrase of phrases) {
    const len = phrase.length;
    for (const w of phrase) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
      // RAKE degree: each word accrues the full phrase length (includes itself).
      degree.set(w, (degree.get(w) ?? 0) + len);
    }
  }

  const scores = new Map<string, number>();
  for (const [w, f] of freq) {
    scores.set(w, (degree.get(w) ?? 0) / f);
  }
  return scores;
}

// ─── Candidate generation (bounded n-grams) ───────────────────────────────────

interface Candidate {
  text: string; // surface phrase, e.g. "neural network"
  words: string[];
  score: number;
}

/**
 * Emit 1..maxWords contiguous sub-spans of each phrase as tag candidates,
 * scored by the sum of member word scores. Keeps the highest score seen for a
 * given surface phrase.
 */
function buildCandidates(
  phrases: string[][],
  scores: Map<string, number>,
  maxWords: number,
): Candidate[] {
  const best = new Map<string, Candidate>();

  for (const phrase of phrases) {
    for (let start = 0; start < phrase.length; start++) {
      for (
        let len = 1;
        len <= maxWords && start + len <= phrase.length;
        len++
      ) {
        const words = phrase.slice(start, start + len);
        // Skip phrases with a repeated word ("phospho phospho", "technical
        // technical") — these come from spoken-transcript filler and are noise.
        if (new Set(words).size < words.length) continue;
        const text = words.join(' ');
        const score = words.reduce((s, w) => s + (scores.get(w) ?? 0), 0);
        const prev = best.get(text);
        if (!prev || score > prev.score) {
          best.set(text, { text, words, score });
        }
      }
    }
  }

  return [...best.values()];
}

// ─── Stem dedup ───────────────────────────────────────────────────────────────

/**
 * Greedy dedup (highest-scored first). Drops a candidate when, versus an
 * already-kept one, it is either:
 *   - a subset (all its stems appear in the kept phrase), e.g. "network" when
 *     "neural network" is kept; or
 *   - a sliding-window fragment that shares 2+ stems, e.g. collapsing
 *     "gordon ramsay's perfect" / "ramsay's perfect scrambled" /
 *     "perfect scrambled eggs" to one phrase.
 * Distinct phrases that share only ONE word ("machine learning" vs "deep
 * learning") are both kept.
 */
function dedupe(sorted: Candidate[]): Candidate[] {
  const kept: { cand: Candidate; stems: Set<string> }[] = [];

  for (const cand of sorted) {
    const stems = new Set(cand.words.map((w) => PorterStemmer.stem(w)));
    const tooSimilar = kept.some((k) => {
      const shared = [...stems].filter((s) => k.stems.has(s)).length;
      return shared === stems.size || shared >= 2;
    });
    if (tooSimilar) continue;
    kept.push({ cand, stems });
  }

  return kept.map((k) => k.cand);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ExtractOptions {
  /** Max tags to return. Default 8. */
  topN?: number;
  /** Max words per tag phrase. Default 3. */
  maxWords?: number;
}

/**
 * Extract up to `topN` descriptive tag phrases from already-cleaned text.
 * Returns lowercased surface phrases, highest-ranked first.
 */
export function extractTags(text: string, opts: ExtractOptions = {}): string[] {
  const topN = opts.topN ?? 8;
  const maxWords = opts.maxWords ?? 3;

  if (!text || !text.trim()) return [];

  const phrases = splitPhrases(text);
  if (phrases.length === 0) return [];

  const scores = wordScores(phrases);
  const candidates = buildCandidates(phrases, scores, maxWords);

  candidates.sort((a, b) => b.score - a.score);
  const deduped = dedupe(candidates);

  return deduped.slice(0, topN).map((c) => c.text);
}
