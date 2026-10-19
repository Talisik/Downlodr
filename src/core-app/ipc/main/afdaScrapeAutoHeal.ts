// src/core-app/ipc/main/afdaScrapeAutoHeal.ts

/**
 * Auto-heal for scrapes that fetch only listing pages.
 *
 * The scrape engine caps a run with `max_articles_per_run` by slicing the
 * discovered URL list *before* anything knows which of those URLs are articles
 * (afda-backend `scrape-engine.ts`, Phase 2). Candidates come back in DOM order,
 * so on a site whose nav sits above its content — every `/topic/…` hub in the
 * header, say — the cap can hand the whole budget to listing pages. The tier-2
 * page classifier then correctly discards every one, and the job finishes
 * `status: 'done'` with `parsed_count: 0` and no error at all.
 *
 * Fixing that properly means capping *after* classification, which lives in the
 * afda-backend package. This module is the app-side compensation: when a job
 * reports that shape, read back which URLs the classifier rejected, turn them
 * into `ignore_patterns` for the website (a user-managed regex list the engine
 * applies up-front, before the article filter runs), and re-run the section so
 * the budget goes to URLs that might actually be articles.
 *
 * Hooked into afdaWorkerProxy's push handler, which is the one place in main
 * that sees every `scrape:job_update` regardless of whether the scrape came
 * from the UI, the CLI bridge, the chat tools, or the scheduler.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScrapeJobUpdate {
  id: number;
  section_id: number;
  status: string;
  parsed_count: number;
  section_count: number;
}

/** One row of `article_urls` as `storage.getArticleUrlsForJob` returns it. */
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

// ─── Tuning ───────────────────────────────────────────────────────────────────

/**
 * A heal round costs a full re-scrape, and each one only sees as many URLs as
 * the section's cap allows, so a site that is *all* hubs would otherwise
 * re-scrape indefinitely, learning a few patterns at a time.
 */
export const MAX_HEAL_ROUNDS = 3;

// ─── Pattern derivation (pure) ────────────────────────────────────────────────

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

/**
 * Turn the classifier's rejects into ignore patterns.
 *
 * Two rules, both deliberately narrow — an over-broad pattern silently costs
 * real articles on every future run, which is a worse failure than the one
 * being fixed:
 *
 * 1. Patterns are always anchored to the depth actually observed. A rejected
 *    `/video/top-5-news-this-week/` yields `/video/[^/]+/$`, never `/video/`.
 *    Blocking the whole segment would also kill `/video/daily-wrap/2026-09-07/`,
 *    which is a real article one level deeper — on a real news site that distinction
 *    is the difference between four articles and none.
 * 2. A shape that has *already* produced a parsed article is never blocked,
 *    even if some URL of the same shape was rejected this run.
 *
 * `pending` rows are not evidence either way: they were discovered but never
 * fetched, so nothing classified them. Only `parsed` counts as proof of real
 * content, and only `section` counts as proof of a listing page.
 */
export function deriveIgnorePatterns(urls: ClassifiedUrl[]): string[] {
  // `${firstSegment}:${depth}` shapes known to yield real articles.
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

    // Deeper than two segments is too specific to generalise from a single
    // observation without risking real articles; leave those alone.
    if (segs.length > 2) continue;
    if (provenShapes.has(`${segs[0]}:${segs.length}`)) continue;

    const head = escapeRegex(segs[0]);
    patterns.add(segs.length === 1 ? `/${head}/$` : `/${head}/[^/]+/$`);
  }

  return [...patterns].sort();
}

/** True for the "finished successfully, saved nothing, discarded listings" shape. */
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

// ─── Orchestration ────────────────────────────────────────────────────────────

// section id → heal rounds spent this session. In-memory on purpose: a restart
// is a reasonable moment to let a site try again.
const roundsUsed = new Map<number, number>();

/** Test seam — drops the per-section round counters. */
export function resetHealState(): void {
  roundsUsed.clear();
}

export async function handleScrapeJobUpdate(
  job: ScrapeJobUpdate,
  deps: AutoHealDeps,
): Promise<void> {
  // A run that produced articles clears the budget: if this section regresses
  // later (a redesign, say) it gets a fresh set of attempts.
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

    // Nothing new to learn — another round would fetch the same URLs and
    // discard them again. Stop here rather than burn the remaining budget.
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
    // Best-effort: a failed heal must never take down the scrape pipeline.
    console.error('[afda-autoheal] heal attempt failed:', err);
  }
}
