import { describe, expect, it } from 'vitest';

import { mapArticleError } from '@/afda/utils/articleErrorMap';

describe('mapArticleError', () => {
  it.each([
    // Real messages from the AFDA backend's manual_articles:parse handler
    ['Invalid URL', 'INVALID_URL'],
    ['URL must start with http:// or https://', 'INVALID_URL'],
    ['Error page detected: "404" in title', 'NOT_FOUND'],
    ['Error page detected: "page not found" in body', 'NOT_FOUND'],
    ['Error page detected: "not found" in title', 'NOT_FOUND'],
    ['Error page detected: "403 forbidden" in title', 'FORBIDDEN'],
    ['Error page detected: "access denied" in body', 'FORBIDDEN'],
    ['Error page detected: "captcha" in title', 'BOT_PROTECTION'],
    ['Error page detected: "just a moment" in body', 'BOT_PROTECTION'],
    ['Error page detected: "service unavailable" in body', 'SERVER_ERROR'],
    ['Error page detected: "500 internal server" in body', 'SERVER_ERROR'],
    ['HTML too short (404 chars, min 500)', 'EMPTY_PAGE'],
    ['Failed to fetch the page', 'FETCH_FAILED'],
    // Renderer pipelines
    ['Request failed with status code 404', 'NOT_FOUND'],
    ['Request failed with status code 429', 'RATE_LIMITED'],
    ['Bridge unavailable', 'SERVICE_NOT_READY'],
    [
      "Error invoking remote method 'manual_articles:parse': Error: No handler registered for 'manual_articles:parse'",
      'SERVICE_NOT_READY',
    ],
    ['Article not found', 'MISSING_IN_DATABASE'],
    ['Post not found', 'MISSING_IN_DATABASE'],
    ['PDF generation failed', 'PDF_FAILED'],
    // Network / fs
    ['getaddrinfo ENOTFOUND example.invalid', 'DNS_FAILED'],
    ['connect ECONNREFUSED 127.0.0.1:443', 'CONNECTION_FAILED'],
    ['timeout of 8000ms exceeded', 'TIMEOUT'],
    ["EACCES: permission denied, open 'C:\\x.docx'", 'NO_PERMISSION'],
    ['ENOSPC: no space left on device', 'DISK_FULL'],
    ["EBUSY: resource busy or locked, open 'C:\\x.docx'", 'FILE_IN_USE'],
    [
      "ENOENT: no such file or directory, open 'C:\\gone\\x.docx'",
      'FOLDER_MISSING',
    ],
  ])('%s → %s', (raw, code) => {
    expect(mapArticleError(raw).code).toBe(code);
  });

  it('falls back to UNKNOWN for unrecognised or missing messages', () => {
    expect(mapArticleError('something odd happened').code).toBe('UNKNOWN');
    expect(mapArticleError(undefined).code).toBe('UNKNOWN');
  });

  it('does not treat "blocked" as a locked file', () => {
    expect(mapArticleError('Request blocked').code).not.toBe('FILE_IN_USE');
  });

  it('tells the user a 404 link is not a valid article', () => {
    expect(mapArticleError('Error page detected: "404" in title').hint).toMatch(
      /does not point to a valid article/,
    );
  });
});
