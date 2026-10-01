import { describe, expect, it } from 'vitest';
import { toExtractorUrl } from './extractorUrl';

describe('toExtractorUrl — Vimeo', () => {
  it.each([
    ['https://vimeo.com/1084537', 'https://player.vimeo.com/video/1084537'],
    ['https://www.vimeo.com/1084537', 'https://player.vimeo.com/video/1084537'],
    ['https://vimeo.com/1084537/', 'https://player.vimeo.com/video/1084537'],
    [
      'https://vimeo.com/1084537?share=copy',
      'https://player.vimeo.com/video/1084537',
    ],
    [
      'https://vimeo.com/channels/staffpicks/1084537',
      'https://player.vimeo.com/video/1084537',
    ],
  ])('rewrites %s to the player URL', (input, expected) => {
    expect(toExtractorUrl(input)).toBe(expected);
  });

  it('keeps the privacy hash of an unlisted video', () => {
    expect(toExtractorUrl('https://vimeo.com/1084537/a1b2c3d4e5')).toBe(
      'https://player.vimeo.com/video/1084537?h=a1b2c3d4e5',
    );
  });

  it.each([
    'https://player.vimeo.com/video/1084537',
    'https://vimeo.com/channels/staffpicks',
    'https://vimeo.com/someuser',
    'https://vimeo.com/showcase/12345',
    'https://www.youtube.com/watch?v=abc',
    'not a url',
  ])('leaves %s unchanged', (input) => {
    expect(toExtractorUrl(input)).toBe(input);
  });
});
