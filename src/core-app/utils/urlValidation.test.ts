import { describe, expect, it, vi } from 'vitest';
import {
  cleanRawLink,
  extractUrlFromText,
  getDomainFromUrl,
  isValidUrl,
  isYouTubeChannelUrl,
  isYouTubeLink,
} from './urlValidation';

vi.mock('@/core-app/components/shadcn/hooks/use-toast', () => ({ toast: vi.fn() }));

describe('cleanRawLink', () => {
  it('rewrites a bare youtu.be link to the canonical youtube.com watch URL', () => {
    expect(cleanRawLink('https://youtu.be/abc123')).toBe('https://youtube.com/watch?v=abc123');
  });

  it('leaves a non-youtu.be URL unchanged', () => {
    expect(cleanRawLink('https://example.com/video')).toBe('https://example.com/video');
  });
});

describe('isYouTubeLink', () => {
  it('classifies a watch URL with a list param as a playlist', () => {
    expect(isYouTubeLink('https://youtube.com/watch?v=abc&list=xyz')).toBe('playlist');
  });

  it('classifies a plain watch URL as a video', () => {
    expect(isYouTubeLink('https://youtube.com/watch?v=abc')).toBe('video');
  });

  it('classifies a direct playlist URL as a playlist', () => {
    expect(isYouTubeLink('https://youtube.com/playlist?list=xyz')).toBe('playlist');
  });
});

describe('getDomainFromUrl', () => {
  it('extracts the hostname from a valid URL', () => {
    expect(getDomainFromUrl('https://example.com/path')).toBe('example.com');
  });

  it('returns null for an invalid URL', () => {
    expect(getDomainFromUrl('not a url')).toBeNull();
  });
});

describe('isValidUrl', () => {
  it('accepts a well-formed https URL', () => {
    expect(isValidUrl('https://example.com/video')).toBe(true);
  });

  it('rejects a YouTube playlist URL (playlists are not supported for clipboard downloading)', () => {
    expect(isValidUrl('https://youtube.com/playlist?list=xyz')).toBe(false);
  });

  it('rejects a non-URL string', () => {
    expect(isValidUrl('just some text')).toBe(false);
  });
});

describe('extractUrlFromText', () => {
  it('finds a URL embedded in arbitrary pasted text', () => {
    expect(extractUrlFromText('check this out https://example.com/video nice right?')).toBe(
      'https://example.com/video',
    );
  });

  it('rewrites a bare youtu.be URL when it is the entire clipboard text', () => {
    expect(extractUrlFromText('https://youtu.be/abc123')).toBe('https://youtube.com/watch?v=abc123');
  });

  it('returns null when the text contains no URL', () => {
    expect(extractUrlFromText('just some random text, no links here')).toBeNull();
  });
});

describe('isYouTubeChannelUrl', () => {
  it.each([
    'https://www.youtube.com/@ExampleChannel',
    'https://youtube.com/@ExampleChannel',
    'https://m.youtube.com/@ExampleChannel',
    'https://www.youtube.com/@ExampleChannel/videos',
    'https://www.youtube.com/@Example.Channel-1?si=abc',
    'https://www.youtube.com/channel/UC0123456789abcdefABCDEF',
    'https://www.youtube.com/c/SomeName',
    'https://www.youtube.com/user/SomeName',
  ])('recognises the channel link %s', (url) => {
    expect(isYouTubeChannelUrl(url)).toBe(true);
  });

  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/playlist?list=PL123',
    'https://www.youtube.com/shorts/abc123',
    'https://vimeo.com/1084537',
  ])('does not treat %s as a channel', (url) => {
    expect(isYouTubeChannelUrl(url)).toBe(false);
  });
});
