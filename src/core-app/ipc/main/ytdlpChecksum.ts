/* Verifies downloaded yt-dlp binaries against the release's published SHA-256 sums. */

import { createHash } from 'crypto';
import { createReadStream } from 'fs';

const RELEASES_URL = 'https://github.com/yt-dlp/yt-dlp/releases/download';

/** Release tags are dotted numbers (2026.10.20, 2026.08.17.073947). */
const VERSION_RE = /^\d+(\.\d+)+$/;

/**
 * The expected SHA-256 for `fileName` from a SHA2-256SUMS body, lowercased,
 * or null when the file isn't listed. Lines are `<hex>  <name>`, with an
 * optional `*` before the name for binary mode.
 */
export function parseSha256Sums(text: string, fileName: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (match && match[2].trim() === fileName) return match[1].toLowerCase();
  }
  return null;
}

/** SHA-256 of a file, lowercase hex. */
export function sha256OfFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(filePath)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Throws unless `filePath` matches the SHA-256 that yt-dlp published for
 * `fileName` in release `version`. Run this before the file is ever executed
 * or swapped in: yt-dlp-helper downloads over HTTPS but checks nothing about
 * what it received, so this is the only thing standing between a tampered or
 * truncated download and a binary the app runs for every job.
 */
export async function verifyYtdlpDownload(
  filePath: string,
  version: string,
  fileName: string,
): Promise<void> {
  if (!VERSION_RE.test(version)) {
    throw new Error(`Refusing to verify unexpected yt-dlp version "${version}"`);
  }

  const response = await fetch(`${RELEASES_URL}/${version}/SHA2-256SUMS`);
  if (!response.ok) {
    throw new Error(
      `Could not fetch yt-dlp checksums for ${version} (HTTP ${response.status})`,
    );
  }
  const expected = parseSha256Sums(await response.text(), fileName);
  if (!expected) {
    throw new Error(`yt-dlp ${version} publishes no checksum for ${fileName}`);
  }

  const actual = await sha256OfFile(filePath);
  if (actual !== expected) {
    throw new Error(
      `Downloaded yt-dlp ${version} failed its checksum (expected ${expected}, got ${actual})`,
    );
  }
}
