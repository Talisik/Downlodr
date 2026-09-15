/** Keyphrase extraction for auto-tagging. */

import { PorterStemmer, stopwords } from './natural';

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

function hasVowel(word: string): boolean {
  return /[aeiouy]/.test(word);
}

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

function splitPhrases(text: string): string[][] {
  const phrases: string[][] = [];

  const chunks = text.toLowerCase().split(/[^a-z0-9'\-\s]+/);

  for (const chunk of chunks) {
    let current: string[] = [];
    for (const raw of chunk.split(/\s+/)) {
      let word = raw.replace(/^[-']+|[-']+$/g, '');
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

function wordScores(phrases: string[][]): Map<string, number> {
  const freq = new Map<string, number>();
  const degree = new Map<string, number>();

  for (const phrase of phrases) {
    const len = phrase.length;
    for (const w of phrase) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
      degree.set(w, (degree.get(w) ?? 0) + len);
    }
  }

  const scores = new Map<string, number>();
  for (const [w, f] of freq) {
    scores.set(w, (degree.get(w) ?? 0) / f);
  }
  return scores;
}

interface Candidate {
  text: string;
  words: string[];
  score: number;
}

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

export interface ExtractOptions {
  topN?: number;
  maxWords?: number;
}

/** Extract up to `topN` tag phrases from cleaned text. */
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
