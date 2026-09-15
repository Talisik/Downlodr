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

export function isValidNetscapeJar(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return trimmed
    .split('\n')
    .some((line) => line.split('\t').length === 7 && !line.trim().startsWith('#'));
}

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

  await unlink(targetPath).catch(() => undefined);
  const { rename } = await import('fs/promises');
  await rename(tempPath, targetPath);

  await chmod(targetPath, 0o600).catch((err) => {
    console.warn(`[cookieAuth] Could not restrict permissions on ${targetPath}:`, err);
  });

  return { ok: true, count };
}

export async function importCookies(browser: string): Promise<ImportResult> {
  const targetPath = jarPathFor(browser);
  await mkdir(jarDir(), { recursive: true });

  const tempPath = `${targetPath}.importing-${Date.now()}`;

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

  await unlink(targetPath).catch(() => undefined);
  const { rename } = await import('fs/promises');
  await rename(tempPath, targetPath);

  await chmod(targetPath, 0o600).catch((err) => {
    console.warn(
      `[cookieAuth] Could not restrict permissions on ${targetPath}:`,
      err,
    );
  });

  return { ok: true, count };
}
