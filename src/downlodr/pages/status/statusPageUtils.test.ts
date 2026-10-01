import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core-app/i18n', () => ({
  default: {
    t: (key: string, opts?: { count?: number }) =>
      `${key.replace('downlodr:timeAgo.', '')}:${opts?.count}`,
  },
}));

import { formatRelativeTime } from './statusPageUtils';

const NOW = new Date('2026-09-24T12:00:00Z');
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('formatRelativeTime', () => {
  it.each([
    [0.5 / 24, 'minutes:30'],
    [3 / 24, 'hour:3'],
    [3, 'day:3'],
    [7, 'week:1'],
    [27, 'week:3'],
    [28, 'week:4'],
    [29, 'week:4'],
    [30, 'month:1'],
    [200, 'month:6'],
    [360, 'month:12'],
    [364, 'month:12'],
    [365, 'year:1'],
    [800, 'year:2'],
  ])('%s days ago → %s', (days, expected) => {
    expect(formatRelativeTime(daysAgo(days))).toBe(expected);
  });

  it('never shows a zero count for a unit above minutes', () => {
    for (let days = 1; days <= 800; days++) {
      const label = formatRelativeTime(daysAgo(days));
      expect(label.endsWith(':0'), `${days} days → ${label}`).toBe(false);
    }
  });

  it('treats a date slightly in the future as just now, not negative', () => {
    const inFuture = new Date(NOW.getTime() + 5 * 60_000).toISOString();
    expect(formatRelativeTime(inFuture)).toBe('minutes:0');
  });
});
