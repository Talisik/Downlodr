import { describe, expect, it } from 'vitest';
import { isNoVideosTabError } from './shortsChannel';

describe('isNoVideosTabError', () => {
  it.each([
    'This channel has no Videos tab. If it only posts Shorts, add /shorts to the link',
    'ERROR: [youtube:tab] @ShortsOnlyChannel: This channel does not have a videos tab',
    'yt-dlp returned no channel data. If this is a Shorts-only channel, try appending /shorts to the URL.',
  ])('recognises %s', (text) => {
    expect(isNoVideosTabError(text)).toBe(true);
  });

  it.each(['yt-dlp timed out after 60s', 'Unsupported URL', ''])(
    'ignores unrelated errors: %s',
    (text) => {
      expect(isNoVideosTabError(text)).toBe(false);
    },
  );
});

