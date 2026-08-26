/* Version-ordering for yt-dlp release tags. */

/**
 * yt-dlp tags are dotted numbers: `2026.07.04` on the stable channel and
 * `2026.08.17.073947` on the nightly one. Comparing them as strings — or
 * for plain inequality — makes a newer nightly look "different from
 * latest stable" and therefore outdated, which force-downgrades a binary
 * the user installed on purpose. Compare segment by segment instead,
 * treating a missing trailing segment as 0 so `2026.07.04` sorts below
 * `2026.07.04.120000`.
 *
 * Returns a negative number when `a` is older than `b`, 0 when they are
 * equivalent, positive when `a` is newer. Non-numeric or unparseable tags
 * yield null — the caller should then leave the binary alone rather than
 * guess.
 */
export function compareYtdlpVersions(
  a: string,
  b: string,
): number | null {
  const parse = (v: string): number[] | null => {
    const parts = v.trim().split('.');
    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => !Number.isFinite(n))) {
      return null;
    }
    return nums;
  };

  const left = parse(a);
  const right = parse(b);
  if (!left || !right) {
    return null;
  }

  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

/**
 * True only when `latest` is strictly newer than `current`. Equivalent
 * versions, a newer local binary (a manually installed nightly), and
 * unparseable tags all return false so the live binary is left untouched.
 *
 * The resulting policy is channel-agnostic — only recency decides. A
 * manually installed nightly outranks the older stable the update check
 * reports and is kept; once a stable dated after that nightly ships, it
 * is newer and gets installed normally. Nothing special-cases either
 * channel, so no state has to be tracked about which one is in use.
 */
export function isYtdlpUpgrade(current: string, latest: string): boolean {
  const ordering = compareYtdlpVersions(current, latest);
  return ordering !== null && ordering < 0;
}
