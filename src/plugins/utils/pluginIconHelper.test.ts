import { describe, expect, it } from 'vitest';
import { looksLikeImageSource } from './pluginIconHelper';

describe('looksLikeImageSource', () => {
  it.each([
    'data:image/png;base64,iVBORw0KGgo=',
    'https://example.com/icon.png',
    '/assets/FormatConverter-abc123.png',
    './icons/tool.svg',
    'C:\\Users\\me\\plugins\\thing\\icon.webp',
    'icon.JPG',
  ])('treats %s as an image', (value) => {
    expect(looksLikeImageSource(value)).toBe(true);
  });

  it.each(['🎵', 'download', 'FaRegClosedCaptioning', '<svg></svg>', ''])(
    'keeps %s as text',
    (value) => {
      expect(looksLikeImageSource(value)).toBe(false);
    },
  );
});
