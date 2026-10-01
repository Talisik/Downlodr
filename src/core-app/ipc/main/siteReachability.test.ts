import { describe, expect, it } from 'vitest';
import { checkSiteReachable } from './siteReachability';

const networkError = (code: string) =>
  Object.assign(new TypeError('fetch failed'), { cause: { code } });

describe('checkSiteReachable', () => {
  it.each([200, 301, 403, 404, 503])(
    'counts any HTTP response (%i) as reachable',
    async (status) => {
      const result = await checkSiteReachable('https://example.com', async () =>
        new Response(null, { status }),
      );
      expect(result).toEqual({ reachable: true });
    },
  );

  it.each([
    ['ENOTFOUND', 'not_found'],
    ['EAI_AGAIN', 'not_found'],
    ['ECONNREFUSED', 'refused'],
    ['ECONNRESET', 'refused'],
  ])('reports %s as %s', async (code, reason) => {
    const result = await checkSiteReachable('https://nope.example', async () => {
      throw networkError(code);
    });
    expect(result).toEqual({ reachable: false, reason });
  });

  it('reports a timeout', async () => {
    const result = await checkSiteReachable(
      'https://slow.example',
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
      20,
    );
    expect(result).toEqual({ reachable: false, reason: 'timeout' });
  });

  it('rejects an invalid URL without fetching', async () => {
    let called = false;
    const result = await checkSiteReachable('not a url', async () => {
      called = true;
      return new Response(null);
    });
    expect(result).toEqual({ reachable: false, reason: 'invalid' });
    expect(called).toBe(false);
  });
});
