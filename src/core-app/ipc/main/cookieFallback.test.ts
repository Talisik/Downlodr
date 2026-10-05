import { describe, expect, it, vi } from 'vitest';
import {
  cookieCliArgs,
  cookiesForVideo,
  hasCookies,
  isCookieSessionRejected,
  isYouTubeUrl,
  NO_COOKIES,
  retryInfoWithoutCookies,
  shouldRetryDownloadWithoutCookies,
} from './cookieFallback';

const RELOAD_LOG =
  '[youtube] abc123: Downloading player API JSON\nERROR: [youtube] abc123: The page needs to be reloaded.';

describe('hasCookies', () => {
  it.each([
    [{ cookiesFromBrowser: 'firefox' }, true],
    [{ cookies: '/jars/brave.txt' }, true],
    [NO_COOKIES, false],
    [{}, false],
  ])('%o -> %s', (cookies, expected) => {
    expect(hasCookies(cookies)).toBe(expected);
  });
});

describe('cookieCliArgs', () => {
  it('passes browser cookies the way getInfo does', () => {
    expect(cookieCliArgs({ cookiesFromBrowser: 'firefox' })).toEqual([
      '--cookies-from-browser',
      'firefox',
    ]);
  });

  it('passes a cookie jar the way getInfo does', () => {
    expect(cookieCliArgs({ cookies: '/jars/brave.txt' })).toEqual([
      '--cookies',
      '/jars/brave.txt',
    ]);
  });

  it('adds nothing when cookie auth is off', () => {
    expect(cookieCliArgs(NO_COOKIES)).toEqual([]);
  });
});

describe('isCookieSessionRejected', () => {
  it('recognises YouTube refusing the signed-in session', () => {
    expect(isCookieSessionRejected(RELOAD_LOG)).toBe(true);
  });

  it.each([
    'ERROR: [youtube] abc: Sign in to confirm your age',
    'ERROR: [youtube] abc: Video unavailable',
    '',
  ])('ignores %s', (log) => {
    expect(isCookieSessionRejected(log)).toBe(false);
  });
});

describe('retryInfoWithoutCookies', () => {
  it('retries without cookies when the signed-in session was rejected', async () => {
    const retry = vi.fn().mockResolvedValue({ ok: true, data: { title: 't' } });

    const result = await retryInfoWithoutCookies({
      cookies: { cookiesFromBrowser: 'firefox' },
      diagnosticLog: RELOAD_LOG,
      retry,
    });

    expect(retry).toHaveBeenCalledWith(NO_COOKIES);
    expect(result).toEqual({ ok: true, data: { title: 't' } });
  });

  it('returns null when the cookie-less retry also fails', async () => {
    const result = await retryInfoWithoutCookies({
      cookies: { cookiesFromBrowser: 'firefox' },
      diagnosticLog: RELOAD_LOG,
      retry: async () => ({ ok: false }),
    });

    expect(result).toBeNull();
  });

  it('does not retry when no cookies were sent', async () => {
    const retry = vi.fn();

    const result = await retryInfoWithoutCookies({
      cookies: NO_COOKIES,
      diagnosticLog: RELOAD_LOG,
      retry,
    });

    expect(retry).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('does not retry other failures, where cookies are what make it work', async () => {
    const retry = vi.fn();

    await retryInfoWithoutCookies({
      cookies: { cookiesFromBrowser: 'firefox' },
      diagnosticLog: 'ERROR: [youtube] abc: Sign in to confirm your age',
      retry,
    });

    expect(retry).not.toHaveBeenCalled();
  });
});

describe('shouldRetryDownloadWithoutCookies', () => {
  it('retries a cookie download that YouTube rejected', () => {
    expect(
      shouldRetryDownloadWithoutCookies({
        cookies: { cookies: '/jars/brave.txt' },
        log: RELOAD_LOG,
        cancelled: false,
      }),
    ).toBe(true);
  });

  it('does not retry once cookies are already dropped', () => {
    expect(
      shouldRetryDownloadWithoutCookies({
        cookies: NO_COOKIES,
        log: RELOAD_LOG,
        cancelled: false,
      }),
    ).toBe(false);
  });

  it('does not restart a download the user cancelled', () => {
    expect(
      shouldRetryDownloadWithoutCookies({
        cookies: { cookiesFromBrowser: 'firefox' },
        log: RELOAD_LOG,
        cancelled: true,
      }),
    ).toBe(false);
  });
});

describe('isYouTubeUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc', true],
    ['https://youtube.com/shorts/abc', true],
    ['https://m.youtube.com/watch?v=abc', true],
    ['https://music.youtube.com/watch?v=abc', true],
    ['https://youtu.be/abc', true],
    ['https://www.youtube-nocookie.com/embed/abc', true],
    ['https://notyoutube.com/watch?v=abc', false],
    ['https://youtube.com.evil.example/watch', false],
    ['https://vimeo.com/123', false],
    ['not a url', false],
  ])('%s -> %s', (url, expected) => {
    expect(isYouTubeUrl(url)).toBe(expected);
  });
});

describe('cookiesForVideo', () => {
  const live = { cookiesFromBrowser: 'brave' };
  const jar = { cookies: '/jars/custom.txt', cookiesFromBrowser: '' };

  it('sends no cookies to YouTube, whatever is configured', () => {
    expect(cookiesForVideo('https://www.youtube.com/watch?v=abc', live)).toBe(
      NO_COOKIES,
    );
    expect(cookiesForVideo('https://youtu.be/abc', jar)).toBe(NO_COOKIES);
  });

  it('leaves other sites untouched', () => {
    expect(cookiesForVideo('https://vimeo.com/123', live)).toBe(live);
    expect(cookiesForVideo('https://x.com/a/status/1', jar)).toBe(jar);
  });
});
