export interface ScrapeJobUpdate {
  id: number;
  section_id: number;
  status: string;
  parsed_count: number;
  section_count: number;
}

export interface ClassifiedUrl {
  url: string;
  status: string;
}

export interface AutoHealDeps {
  getJobUrls: (jobId: number) => Promise<ClassifiedUrl[]>;
  getSection: (sectionId: number) => Promise<{ website_id: number } | null>;
  getWebsite: (
    websiteId: number,
  ) => Promise<{ ignore_patterns: string | null } | null>;
  updateWebsite: (websiteId: number, patterns: string[]) => Promise<void>;
  runNow: (sectionId: number) => Promise<void>;
}

export const MAX_HEAL_ROUNDS = 3;

function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pathSegments(rawUrl: string): string[] | null {
  try {
    return new URL(rawUrl).pathname.split('/').filter(Boolean);
  } catch {
    return null;
  }
}

export function deriveIgnorePatterns(urls: ClassifiedUrl[]): string[] {
  const provenShapes = new Set<string>();
  for (const row of urls) {
    if (row.status !== 'parsed') continue;
    const segs = pathSegments(row.url);
    if (!segs?.length) continue;
    provenShapes.add(`${segs[0]}:${segs.length}`);
  }

  const patterns = new Set<string>();
  for (const row of urls) {
    if (row.status !== 'section') continue;
    const segs = pathSegments(row.url);
    if (!segs?.length) continue;

    if (segs.length > 2) continue;
    if (provenShapes.has(`${segs[0]}:${segs.length}`)) continue;

    const head = escapeRegex(segs[0]);
    patterns.add(segs.length === 1 ? `/${head}/$` : `/${head}/[^/]+/$`);
  }

  return [...patterns].sort();
}

export function shouldAttemptHeal(job: ScrapeJobUpdate): boolean {
  return (
    job.status === 'done' && job.parsed_count === 0 && job.section_count > 0
  );
}

function parseStoredPatterns(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((p): p is string => typeof p === 'string')
      : [];
  } catch {
    return [];
  }
}

const roundsUsed = new Map<number, number>();

export function resetHealState(): void {
  roundsUsed.clear();
}

export async function handleScrapeJobUpdate(
  job: ScrapeJobUpdate,
  deps: AutoHealDeps,
): Promise<void> {
  if (job.status === 'done' && job.parsed_count > 0) {
    roundsUsed.delete(job.section_id);
    return;
  }

  if (!shouldAttemptHeal(job)) return;

  const spent = roundsUsed.get(job.section_id) ?? 0;
  if (spent >= MAX_HEAL_ROUNDS) {
    console.warn(
      `[afda-autoheal] section ${job.section_id} still returns 0 articles after ` +
        `${MAX_HEAL_ROUNDS} rounds — leaving it alone. Its article filter likely ` +
        `needs fixing by hand.`,
    );
    return;
  }

  try {
    const rejected = await deps.getJobUrls(job.id);
    const derived = deriveIgnorePatterns(rejected);
    if (derived.length === 0) return;

    const section = await deps.getSection(job.section_id);
    if (!section) return;
    const website = await deps.getWebsite(section.website_id);
    if (!website) return;

    const existing = parseStoredPatterns(website.ignore_patterns);
    const merged = [...new Set([...existing, ...derived])];

    if (merged.length === existing.length) return;

    roundsUsed.set(job.section_id, spent + 1);
    await deps.updateWebsite(section.website_id, merged);

    console.log(
      `[afda-autoheal] section ${job.section_id}: 0 articles, ` +
        `${job.section_count} listing pages discarded. Added ` +
        `${merged.length - existing.length} ignore pattern(s) ` +
        `[${derived.join(', ')}] and re-running (round ${spent + 1}/${MAX_HEAL_ROUNDS}).`,
    );

    await deps.runNow(job.section_id);
  } catch (err) {
    console.error('[afda-autoheal] heal attempt failed:', err);
  }
}
