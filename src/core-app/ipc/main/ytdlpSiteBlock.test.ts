import { describe, expect, it } from 'vitest';
import { isBlockedBySite } from './ytdlpSiteBlock';

describe('isBlockedBySite', () => {
  it.each([
    'ERROR: [generic] Got HTTP Error 403 caused by Cloudflare anti-bot challenge; try again with  --extractor-args "generic:impersonate"',
    'ERROR: [generic] Unable to download webpage: HTTP Error 403: Forbidden',
    'ERROR: [example] Please solve the CAPTCHA to continue',
  ])('recognises %s', (text) => {
    expect(isBlockedBySite(text)).toBe(true);
  });

  it.each([
    'ERROR: Unsupported URL: https://example.com/',
    'ERROR: [youtube] abc: Sign in to confirm your age',
    'ERROR: [generic] Unable to download webpage: HTTP Error 404: Not Found',
  ])('ignores unrelated failures: %s', (text) => {
    expect(isBlockedBySite(text)).toBe(false);
  });
});
