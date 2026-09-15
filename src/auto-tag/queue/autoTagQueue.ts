/** Serial queue for automatic auto-tagging (renderer). */

import { useDownloadStore } from '@/downlodr/store/downloadStore';
import type { BaseDownload } from '@/downlodr/store/download/types';

type Tier = 1 | 2;

interface Job {
  id: string;
  tier: Tier;
}

const AUTO_TAG_DISABLED = true;

const pending: Job[] = [];
const keys = new Set<string>();
let running = false;

const keyOf = (id: string, tier: Tier) => `${id}:${tier}`;

function hasTier(d: BaseDownload, src: 'tier1' | 'tier2'): boolean {
  return Object.values(d.tagSource ?? {}).includes(src);
}

function isMusic(d: BaseDownload): boolean {
  return (d.nativeCategory ?? '').trim().toLowerCase() === 'music';
}

function isValidTranscript(loc?: string): boolean {
  if (typeof loc !== 'string') return false;
  const v = loc.trim();
  return v !== '' && v !== 'iu' && v !== 'fu';
}

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

export function enqueueTier1(id: string) {
  push(id, 1);
}

export function enqueueTier2(id: string) {
  push(id, 2);
}

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

async function pump() {
  if (running) return;
  running = true;
  try {
    while (pending.length > 0) {
      const job = pending.shift()!;
      keys.delete(keyOf(job.id, job.tier));
      await runJob(job);
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    running = false;
  }
}
