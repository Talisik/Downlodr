// src/core-app/ipc/main/cookieAuth/domain.ts

// Deliberately small: a handful of common two-label public suffixes so
// "accounts.bbc.co.uk" doesn't collapse to the useless "co.uk". This is not
// a full Public Suffix List implementation — a mismatch here only means a
// site login gets tagged with a slightly wrong (but still stable, still
// usable) domain name, never a security issue, since the jar is still
// scoped to whatever domain was actually extracted and matched consistently
// on both save and lookup.
const TWO_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk',
  'co.jp', 'co.kr', 'co.in', 'co.nz', 'co.za',
  'com.au', 'com.br', 'com.cn', 'com.tw', 'com.hk', 'com.sg',
]);

export function extractRegistrableDomain(rawUrl: string): string | null {
  let hostname: string;
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!hostname) return null;

  const labels = hostname.split('.').filter(Boolean);
  if (labels.length <= 2) return hostname;

  const lastTwo = labels.slice(-2).join('.');
  if (TWO_LABEL_SUFFIXES.has(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join('.');
  }
  return lastTwo;
}
