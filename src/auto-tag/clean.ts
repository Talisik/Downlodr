/**
 * clean.ts
 *
 * Text cleaning for the auto-tagging engine.
 *
 * The keyword extractor is noise-sensitive: the document embedding used by MMR
 * is computed over the *whole* corpus, so URLs, emojis, hashtag walls, and
 * boilerplate ("Subscribe!", "link in bio") skew tag relevance. Descriptions are
 * the worst offenders. Every corpus is run through normalizeForTagging() before
 * extraction so both the document embedding and the candidate phrases see clean
 * text.
 *
 * Two stages:
 *   stripSubtitleStructure() — transcript pre-clean (SRT/VTT structure removal)
 *   normalizeForTagging()    — semantic clean applied to every corpus
 *
 * Metadata path:   normalizeForTagging
 * Transcript path: stripSubtitleStructure -> normalizeForTagging
 *
 * NOTE (known limitation): the downstream extractor drops non-Latin scripts, so
 * non-English videos tag poorly. These cleaners do not attempt to fix that.
 */

// ─── Subtitle structure regexes (mirrors videoTransformer.cleanSubtitleText) ──

/** SRT sequence numbers (a line that is only digits). */
const RE_SEQUENCE = /^\d+\s*$/;

/** SRT/VTT timestamp lines: 00:00:01,000 --> 00:00:04,000 */
const RE_TIMESTAMP_LINE = /^\d{1,2}:\d{2}(?::\d{2})?[.,]\d{2,3}\s*-->/;

/** VTT "WEBVTT" header and NOTE/STYLE/REGION blocks. */
const RE_VTT_HEADER = /^(WEBVTT|NOTE|STYLE|REGION)/;

/** Inline subtitle tags: <i>, <b>, <c.color>, <00:00:01.000>, etc. */
const RE_INLINE_TAG = /<[^>]+>/g;

/**
 * Remove SRT/VTT structure from raw subtitle text, leaving plain prose.
 * Drops sequence numbers, timestamp lines, VTT headers, and inline tags.
 */
export function stripSubtitleStructure(raw: string): string {
  if (!raw) return '';

  const kept: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (RE_SEQUENCE.test(trimmed)) continue;
    if (RE_TIMESTAMP_LINE.test(trimmed)) continue;
    if (RE_VTT_HEADER.test(trimmed)) continue;
    kept.push(trimmed.replace(RE_INLINE_TAG, ''));
  }

  return kept
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─── Semantic clean regexes ───────────────────────────────────────────────────

/** Emails — run before @mention removal (an email contains '@'). */
const RE_EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi;

/** URLs with a scheme or leading www. */
const RE_URL = /\b(?:https?:\/\/|www\.)\S+/gi;

/** Bare domains with a common TLD (e.g. "example.com/path"). */
const RE_BARE_DOMAIN =
  /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:com|net|org|io|co|tv|gg|ly|me|app|dev|xyz)\b\S*/gi;

/** @handles. */
const RE_MENTION = /(^|\s)@[\w.]+/g;

/** #hashtags — capture the word so we can keep it, dropping only the '#'. */
const RE_HASHTAG = /#(\w+)/g;

/**
 * Emoji and pictographic symbols. \p{Extended_Pictographic} covers most emoji;
 * the extra ranges catch arrows, dingbats, misc symbols, and the zero-width
 * joiner / variation selector used in compound emoji.
 */
const RE_EMOJI =
  /(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{2600}-\u{27BF}]|\u{FE0F}|\u{200D})/gu;

/** Bare timestamps / chapter markers: 0:00, 00:00, 1:23:45. */
const RE_TIMESTAMP = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;

/**
 * Boilerplate phrases that recur across descriptions and would otherwise become
 * false tags. Matched case-insensitively as whole phrases.
 */
const BOILERPLATE_PHRASES = [
  'subscribe',
  'follow me',
  'link in bio',
  'like and comment',
  'like and subscribe',
  'hit the bell',
  'turn on notifications',
  'check out',
  // creator solicitation / sponsorship noise
  'help fund',
  'fund future projects',
  'support the channel',
  'support this channel',
  'patreon',
  'become a member',
  'donate',
  'sponsored by',
  'use code',
  'promo code',
  'check the description',
  'check description below',
  'link below',
  // production credits / affiliate
  'executive producer',
  'production company',
  'directed by',
  'produced by',
  'all rights reserved',
  'store links',
  'links may give',
];
const RE_BOILERPLATE = new RegExp(
  `\\b(?:${BOILERPLATE_PHRASES.map((p) => p.replace(/\s+/g, '\\s+')).join(
    '|',
  )})\\b`,
  'gi',
);

/**
 * Normalize arbitrary text for tag extraction.
 *
 * Order matters: emails before mentions (emails contain '@'); URLs before bare
 * domains; hashtags keep their word; emojis/symbols stripped; timestamps and
 * boilerplate removed; whitespace collapsed last.
 */
export function normalizeForTagging(text: string): string {
  if (!text) return '';

  return (
    text
      // Strip diacritics so accented words don't fragment at the split step
      // (e.g. "Appétit" -> "Appetit" instead of "app" + "tit").
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // HTML entities (&nbsp; &amp; &#39; ...) \u2014 common in scraped transcripts
      .replace(/&(?:[a-z]+|#\d+);/gi, ' ')
      .replace(RE_EMAIL, ' ')
      .replace(RE_URL, ' ')
      .replace(RE_BARE_DOMAIN, ' ')
      .replace(RE_MENTION, ' ')
      .replace(RE_HASHTAG, '$1') // strip '#', keep the word
      .replace(RE_EMOJI, ' ')
      .replace(RE_TIMESTAMP, ' ')
      .replace(RE_BOILERPLATE, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}
