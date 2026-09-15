import { app, session } from 'electron';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';

export interface SiteLogin {
  domain: string;
  jarPath: string;
  loginUrl: string;
  lastLoginAt: number;
}

const VALID_DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)+$/;

function assertValidDomain(domain: string): void {
  if (!VALID_DOMAIN_RE.test(domain)) {
    throw new Error(`Invalid domain: ${domain}`);
  }
}

function cookieJarsDir(): string {
  return path.join(app.getPath('userData'), 'cookie-jars');
}

function siteLoginsFilePath(): string {
  return path.join(cookieJarsDir(), 'site-logins.json');
}

export function partitionNameFor(domain: string): string {
  assertValidDomain(domain);
  return `persist:site-${domain}`;
}

export function siteJarPathFor(domain: string): string {
  assertValidDomain(domain);
  return path.join(cookieJarsDir(), `site-${domain}.txt`);
}

let cache: SiteLogin[] | null = null;

async function load(): Promise<SiteLogin[]> {
  if (cache) return cache;
  try {
    const text = await readFile(siteLoginsFilePath(), 'utf-8');
    const parsed = JSON.parse(text);
    cache = Array.isArray(parsed)
      ? parsed.filter(
          (l): l is SiteLogin =>
            !!l && typeof l.domain === 'string' && typeof l.jarPath === 'string',
        )
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function persist(logins: SiteLogin[]): Promise<void> {
  cache = logins;
  await mkdir(cookieJarsDir(), { recursive: true });
  await writeFile(siteLoginsFilePath(), JSON.stringify(logins, null, 2), 'utf-8');
}

export async function listSiteLogins(): Promise<SiteLogin[]> {
  return [...(await load())];
}

export async function findSiteLoginForDomain(domain: string): Promise<SiteLogin | null> {
  const logins = await load();
  return logins.find((l) => l.domain === domain) ?? null;
}

export async function upsertSiteLogin(
  domain: string,
  jarPath: string,
  loginUrl: string,
): Promise<void> {
  const logins = await load();
  const next = logins.filter((l) => l.domain !== domain);
  next.push({ domain, jarPath, loginUrl, lastLoginAt: Date.now() });
  await persist(next);
}

export async function removeSiteLogin(domain: string): Promise<{ ok: boolean }> {
  const logins = await load();
  const next = logins.filter((l) => l.domain !== domain);
  await persist(next);
  await unlink(siteJarPathFor(domain)).catch(() => undefined);
  try {
    await session.fromPartition(partitionNameFor(domain)).clearStorageData();
  } catch {
  }
  return { ok: true };
}
