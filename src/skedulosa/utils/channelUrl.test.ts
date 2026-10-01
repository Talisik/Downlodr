import { describe, expect, it } from 'vitest';
import { channelUrlKey, isSameChannelUrl } from '@/skedulosa/utils/channelUrl';

describe('isSameChannelUrl', () => {
  const stored = 'https://www.youtube.com/@ExampleChannel';

  it.each([
    'https://www.youtube.com/@ExampleChannel',
    'https://youtube.com/@ExampleChannel',
    'https://www.youtube.com/@ExampleChannel/',
    'https://m.youtube.com/@ExampleChannel',
    'https://www.youtube.com/@ExampleChannel?si=abc123',
    'https://www.youtube.com/@examplechannel',
    'http://www.youtube.com/@ExampleChannel',
    'https://www.youtube.com/@ExampleChannel/videos',
    'https://www.youtube.com/@ExampleChannel#about',
    '  https://www.youtube.com/@ExampleChannel  ',
  ])('treats %s as the same channel', (input) => {
    expect(isSameChannelUrl(input, stored)).toBe(true);
  });

  it('keeps a Shorts-only subscription distinct from the main channel', () => {
    expect(
      isSameChannelUrl(
        'https://www.youtube.com/@ShortsOnlyChannel/shorts',
        'https://www.youtube.com/@ShortsOnlyChannel',
      ),
    ).toBe(false);
  });

  it('does not match different channels', () => {
    expect(isSameChannelUrl('https://www.youtube.com/@ExampleChannel2', stored)).toBe(
      false,
    );
  });

  it('still compares unparseable input as trimmed, case-insensitive text', () => {
    expect(channelUrlKey('  Not A URL ')).toBe('not a url');
  });
});
