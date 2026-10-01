import { describe, expect, it, vi } from 'vitest';
import { declineHeadfulRetryOnMac } from './headfulConsent';

describe('declineHeadfulRetryOnMac', () => {
  it('installs a handler that declines the visible-browser retry on macOS', async () => {
    const setHandler = vi.fn();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(declineHeadfulRetryOnMac(setHandler, 'darwin')).toBe(true);

    const handler = setHandler.mock.calls[0][0];
    await expect(
      handler({ url: 'https://example.com/a', reason: 'cloudflare_blocked' }),
    ).resolves.toBe(false);
  });

  it('leaves the default on Windows and Linux', () => {
    const setHandler = vi.fn();

    expect(declineHeadfulRetryOnMac(setHandler, 'win32')).toBe(false);
    expect(declineHeadfulRetryOnMac(setHandler, 'linux')).toBe(false);
    expect(setHandler).not.toHaveBeenCalled();
  });

  it('does nothing when the add-on predates the consent hook', () => {
    expect(declineHeadfulRetryOnMac(undefined, 'darwin')).toBe(false);
  });
});
