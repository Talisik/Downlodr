/** Text normalization helpers for auto-tagging. */

const RE_SEQUENCE = /^\d+\s*$/;

const RE_TIMESTAMP_LINE = /^\d{1,2}:\d{2}(?::\d{2})?[.,]\d{2,3}\s*-->/;

const RE_VTT_HEADER = /^(WEBVTT|NOTE|STYLE|REGION)/;

const RE_INLINE_TAG = /<[^>]+>/g;

/** Remove SRT/VTT structure from raw subtitle text. */
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

const RE_EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi;

const RE_URL = /\b(?:https?:\/\/|www\.)\S+/gi;

const RE_BARE_DOMAIN =
  /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:com|net|org|io|co|tv|gg|ly|me|app|dev|xyz)\b\S*/gi;

const RE_MENTION = /(^|\s)@[\w.]+/g;

const RE_HASHTAG = /#(\w+)/g;

const RE_EMOJI =
  /(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{2600}-\u{27BF}]|\u{FE0F}|\u{200D})/gu;

const RE_TIMESTAMP = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;

const BOILERPLATE_PHRASES = [
  'subscribe',
  'follow me',
  'link in bio',
  'like and comment',
  'like and subscribe',
  'hit the bell',
  'turn on notifications',
  'check out',
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

/** Normalize text for tag extraction. */
export function normalizeForTagging(text: string): string {
  if (!text) return '';

  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&(?:[a-z]+|#\d+);/gi, ' ')
      .replace(RE_EMAIL, ' ')
      .replace(RE_URL, ' ')
      .replace(RE_BARE_DOMAIN, ' ')
      .replace(RE_MENTION, ' ')
      .replace(RE_HASHTAG, '$1')
      .replace(RE_EMOJI, ' ')
      .replace(RE_TIMESTAMP, ' ')
      .replace(RE_BOILERPLATE, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}
