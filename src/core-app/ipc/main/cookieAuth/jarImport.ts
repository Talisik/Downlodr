// src/core-app/ipc/main/cookieAuth/jarImport.ts
import { app } from 'electron';
import { chmod, mkdir, readFile, stat, unlink } from 'fs/promises';
import path from 'path';
import * as YTDLP from 'yt-dlp-helper';

export interface ImportResult {
  ok: boolean;
  count?: number;
  error?: string;
}

function jarDir(): string {
  return path.join(app.getPath('userData'), 'cookie-jars');
}

export function jarPathFor(browser: string): string {
  return path.join(jarDir(), `${browser}.txt`);
}

export async function jarExistsFor(browser: string): Promise<boolean> {
  try {
    const st = await stat(jarPathFor(browser));
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

/** Number of real cookie lines in a Netscape jar (excludes blank/comment lines). */
export function countCookieLines(jarText: string): number {
  return jarText
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('#')).length;
}

export function customJarPath(): string {
  return jarPathFor('custom');
}

export async function customJarExists(): Promise<boolean> {
  return jarExistsFor('custom');
}

/**
 * Loose but deliberate check: a valid jar must contain at least one real
 * tab-delimited 7-field cookie line, UNCONDITIONALLY — the standard Netscape
 * header comment (if present) is not by itself sufficient, since yt-dlp
 * aborts hard on a malformed `--cookies` file and a header-only (or
 * header-plus-garbage) file would otherwise pass. Real `cookies.txt` exports
 * from every major browser extension satisfy the cookie-line check; this is
 * enough to reject "wrong file entirely" without trying to fully validate
 * cookie semantics (domain format, expiry as a number, etc.) — that's
 * yt-dlp's job once the file is actually used.
 */
export function isValidNetscapeJar(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return trimmed
    .split('\n')
    .some((line) => line.split('\t').length === 7 && !line.trim().startsWith('#'));
}

/**
 * Import a user-picked cookies.txt. Unlike importCookies() (which shells out
 * to yt-dlp to export a browser's own store), this reads a file the user
 * already has — validate-then-overwrite, per the approved ordering: a
 * failed validation must never touch a previously-imported good jar.
 */
export async function importFile(sourcePath: string): Promise<ImportResult> {
  let text: string;
  try {
    text = await readFile(sourcePath, 'utf-8');
  } catch (err) {
    return {
      ok: false,
      error: `Could not read ${sourcePath}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  if (!isValidNetscapeJar(text)) {
    return {
      ok: false,
      error:
        'That file does not look like a cookies.txt export (expected a Netscape-format cookie jar).',
    };
  }

  const count = countCookieLines(text);
  if (count === 0) {
    return { ok: false, error: 'That file has no cookie entries.' };
  }

  await mkdir(jarDir(), { recursive: true });
  const targetPath = customJarPath();
  const { writeFile } = await import('fs/promises');
  const tempPath = `${targetPath}.importing-${Date.now()}`;
  await writeFile(tempPath, text, 'utf-8');

  // Same atomic-ish swap as importCookies(): only remove the old jar once
  // the new one is fully written.
  await unlink(targetPath).catch(() => undefined);
  const { rename } = await import('fs/promises');
  await rename(tempPath, targetPath);

  await chmod(targetPath, 0o600).catch((err) => {
    console.warn(`[cookieAuth] Could not restrict permissions on ${targetPath}:`, err);
  });

  return { ok: true, count };
}

/**
 * One-shot export of a browser's cookies to a Netscape jar this app owns.
 *
 * yt-dlp needs a URL argument to run at all. A deliberately invalid one
 * ("downlodr-cookie-export", not a real scheme) makes it fail URL parsing
 * before any network call — but --cookies-from-browser / --cookies are
 * processed first, so the export still happens and the process still exits
 * 1 either way. That means success can only be read from the filesystem
 * (did a non-empty jar appear), never from YTDLP.invoke's own `ok`/exitCode.
 */
export async function importCookies(browser: string): Promise<ImportResult> {
  const targetPath = jarPathFor(browser);
  await mkdir(jarDir(), { recursive: true });

  // Import into a temp path first so a failed/partial run never clobbers a
  // previously-good jar that resolveCookiesForCall() might read concurrently.
  const tempPath = `${targetPath}.importing-${Date.now()}`;

  // Exit code/`ok` are meaningless here (see file check below), but `data`
  // (yt-dlp's combined stdout/stderr) is kept — when the jar never gets
  // written, it's the only way to tell "browser still running" apart from
  // "browser closed, but yt-dlp can't decrypt its cookies anyway", which
  // need different advice (see the two branches below).
  const invocation = await YTDLP.invoke({
    args: [
      '--no-warnings',
      '--cookies-from-browser',
      browser,
      '--cookies',
      tempPath,
      '--simulate',
      'downlodr-cookie-export',
    ],
  }).catch(() => null);

  let jarText: string;
  try {
    jarText = await readFile(tempPath, 'utf-8');
  } catch {
    // Chrome's App-Bound Encryption (Chrome 127+) can make yt-dlp unable to
    // decrypt cookies even from a fully-closed browser — closing it again
    // will not help. Distinguishing this from the ordinary "still running"
    // lock (yt-dlp issue #7271) matters: telling a user to keep closing an
    // already-closed browser is actively misleading, not just unhelpful.
    // See https://github.com/yt-dlp/yt-dlp/issues/10927.
    if (invocation?.data && /Failed to decrypt with DPAPI/i.test(invocation.data)) {
      return {
        ok: false,
        error: `${browser}'s cookie encryption isn't supported yet on this machine, even with ${browser} fully closed. Try Firefox or Brave instead — they don't have this limitation.`,
      };
    }
    return {
      ok: false,
      error: `Could not read cookies from ${browser}. Make sure ${browser} is fully closed and you are signed in to the site, then try again.`,
    };
  }

  const count = countCookieLines(jarText);
  if (count === 0) {
    await unlink(tempPath).catch(() => undefined);
    return {
      ok: false,
      error: `${browser} reported no cookies. Make sure you are signed in, then try again.`,
    };
  }

  // Atomic-ish swap: the old jar (if any) is only removed once the new one
  // is fully written, so a crash mid-import leaves the previous jar intact
  // rather than a half-written file at the real path.
  await unlink(targetPath).catch(() => undefined);
  const { rename } = await import('fs/promises');
  await rename(tempPath, targetPath);

  // Best-effort permission scoping (owner read/write only). No-op/ignored on
  // Windows, which doesn't have this permission model; a failure here
  // shouldn't block the import — the jar is still written and usable.
  await chmod(targetPath, 0o600).catch((err) => {
    console.warn(
      `[cookieAuth] Could not restrict permissions on ${targetPath}:`,
      err,
    );
  });

  return { ok: true, count };
}
