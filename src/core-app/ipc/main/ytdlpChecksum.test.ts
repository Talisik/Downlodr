import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseSha256Sums,
  sha256OfFile,
  verifyYtdlpDownload,
} from './ytdlpChecksum';

const MAC = 'a'.repeat(64);
const EXE = 'B'.repeat(64);
const SUMS = [
  `${MAC}  yt-dlp_macos`,
  `${MAC.replace(/a/g, 'c')}  yt-dlp_macos.zip`,
  `${EXE} *yt-dlp.exe`,
  '',
].join('\n');

// sha256("hello\n")
const HELLO_SHA =
  '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03';

function tempFile(contents: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ytdlp-sum-'));
  const file = path.join(dir, 'yt-dlp_macos');
  writeFileSync(file, contents);
  return file;
}

describe('parseSha256Sums', () => {
  it('finds the exact file, not one sharing its prefix', () => {
    expect(parseSha256Sums(SUMS, 'yt-dlp_macos')).toBe(MAC);
  });

  it('accepts binary-mode entries and lowercases the hash', () => {
    expect(parseSha256Sums(SUMS, 'yt-dlp.exe')).toBe(EXE.toLowerCase());
  });

  it('returns null for an unlisted file', () => {
    expect(parseSha256Sums(SUMS, 'yt-dlp_linux')).toBeNull();
  });
});

describe('verifyYtdlpDownload', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubSums = (body: string, ok = true) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok, status: ok ? 200 : 404, text: async () => body })),
    );

  it('hashes a file', async () => {
    expect(await sha256OfFile(tempFile('hello\n'))).toBe(HELLO_SHA);
  });

  it('passes a file matching the published sum', async () => {
    stubSums(`${HELLO_SHA}  yt-dlp_macos\n`);
    await expect(
      verifyYtdlpDownload(tempFile('hello\n'), '2026.10.20', 'yt-dlp_macos'),
    ).resolves.toBeUndefined();
  });

  it('rejects a file that does not match', async () => {
    stubSums(`${HELLO_SHA}  yt-dlp_macos\n`);
    await expect(
      verifyYtdlpDownload(tempFile('tampered\n'), '2026.10.20', 'yt-dlp_macos'),
    ).rejects.toThrow(/checksum/);
  });

  it('rejects when the sums file is missing or omits the binary', async () => {
    stubSums('', false);
    await expect(
      verifyYtdlpDownload(tempFile('hello\n'), '2026.10.20', 'yt-dlp_macos'),
    ).rejects.toThrow(/HTTP 404/);

    stubSums(`${HELLO_SHA}  yt-dlp_linux\n`);
    await expect(
      verifyYtdlpDownload(tempFile('hello\n'), '2026.10.20', 'yt-dlp_macos'),
    ).rejects.toThrow(/no checksum/);
  });

  it('refuses a version that is not a release tag', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(
      verifyYtdlpDownload(tempFile('x'), '../../evil', 'yt-dlp_macos'),
    ).rejects.toThrow(/unexpected/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
