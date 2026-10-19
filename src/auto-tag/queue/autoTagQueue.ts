/**
 * autoTagQueue.ts  (renderer)
 *
 * Serial queue that drives automatic auto-tagging. Tagging is synchronous CPU
 * work in the main process (RAKE / TF-IDF over text), so this queue runs at most
 * ONE tagging IPC in flight at a time — a burst of downloads finishing at once
 * never fans out into parallel main-process work.
 *
 * Flow (see src/auto-tag/docs/PLAN.md):
 *   - download finishes  -> enqueueTier1(id)   (metadata only)
 *   - transcript arrives -> enqueueTier2(id)   (metadata + transcript)
 *   - app startup        -> enqueueBackfill()  (tag pre-existing, once)
 *
 * Tier routing is driven purely by what we put in the single-item input:
 *   - tier 1 job omits transcriptLocation -> tagService runs tagMetadata (or music)
 *   - tier 2 job includes transcriptLocation -> tagService runs tier 2
 * Results are merged via applyAutoTags (mergeTierResult handles dedup + append).
 *
 * The store is read only inside functions (call time), never at module load, so
 * the store <-> queue import cycle is harmless (same pattern as useAutoTag).
 */

import { useDownloadStore } from '@/downlodr/store/downloadStore';
import type { BaseDownload } from '@/downlodr/store/download/types';

type Tier = 1 | 2;

interface Job {
  id: string;
  tier: Tier;
}

// Temporary kill switch: set to false to re-enable automatic tagging
// (download-finish tier 1, transcript tier 2, and startup backfill).
// Manual tagging via useAutoTag/AutoTagButton is unaffected.
const AUTO_TAG_DISABLED = true;

const pending: Job[] = [];
const keys = new Set<string>(); // "id:tier" of queued or in-flight jobs
let running = false;

const keyOf = (id: string, tier: Tier) => `${id}:${tier}`;

/** Whether a download already has tags contributed by the given tier. */
function hasTier(d: BaseDownload, src: 'tier1' | 'tier2'): boolean {
  return Object.values(d.tagSource ?? {}).includes(src);
}

/**
 * Music downloads route to the music tagger, which is metadata-only and always
 * reports tier 1 — a transcript (lyrics) makes no useful tags. They can never
 * gain a tier-2 tag, so a tier-2 job for them would be re-enqueued on every
 * launch and do nothing.
 */
function isMusic(d: BaseDownload): boolean {
  return (d.nativeCategory ?? '').trim().toLowerCase() === 'music';
}

/** A transcript location that actually points at a usable transcript. */
function isValidTranscript(loc?: string): boolean {
  if (typeof loc !== 'string') return false;
  const v = loc.trim();
  // 'iu' / 'fu' are sentinels used elsewhere (see TranscrptButton) to mean
  // "in use" / "failed/unavailable", not real paths.
  return v !== '' && v !== 'iu' && v !== 'fu';
}

/** Find a download by id across the lists that can carry tags. */
function findDownload(id: string): BaseDownload | undefined {
  const s = useDownloadStore.getState();
  return (
    s.finishedDownloads.find((d: BaseDownload) => d.id === id) ??
    s.historyDownloads.find((d: BaseDownload) => d.id === id) ??
    s.downloading.find((d: BaseDownload) => d.id === id)
  );
}

function push(id: string, tier: Tier) {
  if (AUTO_TAG_DISABLED) return;
  const k = keyOf(id, tier);
  if (keys.has(k)) return;
  keys.add(k);
  pending.push({ id, tier });
  void pump();
}

/** Enqueue tier-1 (metadata) tagging for a finished download. */
export function enqueueTier1(id: string) {
  push(id, 1);
}

/** Enqueue tier-2 (transcript) tagging for a download with a transcript. */
export function enqueueTier2(id: string) {
  push(id, 2);
}

/**
 * On startup, tag pre-existing downloads that are missing tags. The per-tier
 * guard means already-tagged items are skipped, so this is safe to call on every
 * launch.
 */
export function enqueueBackfill() {
  const s = useDownloadStore.getState();
  const seen = new Set<string>();
  for (const d of [...s.finishedDownloads, ...s.historyDownloads]) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    if (!hasTier(d, 'tier1')) push(d.id, 1);
    if (
      !isMusic(d) &&
      isValidTranscript(d.transcriptLocation) &&
      !hasTier(d, 'tier2')
    ) {
      push(d.id, 2);
    }
  }
}

/** Build the single-item input for a job, or null if it should be skipped. */
function buildInput(job: Job) {
  const d = findDownload(job.id);
  if (!d) return null;
  if (
    job.tier === 2 &&
    (isMusic(d) || !isValidTranscript(d.transcriptLocation))
  ) {
    return null;
  }

  return {
    id: d.id,
    title: d.name || d.displayName || '',
    description: d.description,
    channel: d.channelName,
    category: d.nativeCategory,
    artist: d.musicArtist,
    track: d.musicTrack,
    album: d.musicAlbum,
    // tier 1 omits the transcript so tagService routes to tagMetadata/music.
    transcriptLocation: job.tier === 2 ? d.transcriptLocation : undefined,
  };
}

async function runJob(job: Job) {
  const input = buildInput(job);
  if (!input) return;
  try {
    const res = await window.autoTagBridge.run([input]);
    if (res.ok) {
      useDownloadStore.getState().applyAutoTags(res.results);
    } else {
      console.error(
        '[auto-tag] queue job failed:',
        (res as { message: string }).message,
      );
    }
  } catch (e) {
    console.error('[auto-tag] queue job error:', e);
  }
}

/** Drain the queue one job at a time. */
async function pump() {
  if (running) return;
  running = true;
  try {
    while (pending.length > 0) {
      const job = pending.shift()!;
      keys.delete(keyOf(job.id, job.tier));
      await runJob(job);
      // Yield between jobs so the UI thread isn't starved by a long backlog.
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    running = false;
  }
}
