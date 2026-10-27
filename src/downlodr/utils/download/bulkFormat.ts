/**
 * Resolves one bulk-download quality tier to a concrete format per video.
 *
 * Every video has its own format list (ids and labels differ per site and per
 * upload), so the bulk Start modal offers tiers instead of formats and this
 * maps the chosen tier onto each row's stored `formats`. Video tiers take the
 * best height at or below the tier, then the closest height above it, then the
 * row's stored (best) format — the last two are reported via `adjusted` so the
 * modal can tell the user which videos won't match exactly.
 */
import type { FormatOption } from '@/downlodr/schema/metadataSchema';

export type BulkFormatTier =
  | 'best'
  | '2160'
  | '1440'
  | '1080'
  | '720'
  | '480'
  | '360'
  | 'audio'
  | 'mp3';

export const BULK_FORMAT_TIERS: BulkFormatTier[] = [
  'best',
  '2160',
  '1440',
  '1080',
  '720',
  '480',
  '360',
  'audio',
  'mp3',
];

/** The format fields a queued download carries. */
export interface StoredFormat {
  ext: string;
  formatId: string;
  audioExt: string;
  audioFormatId: string;
}

export interface ResolvedBulkFormat extends StoredFormat {
  /** The chosen option's label, for showing the user what a video will get. */
  label: string;
  /**
   * Null when the tier matched. 'above' = nothing at or below the tier, so the
   * closest higher quality was used; 'container' = the video doesn't offer the
   * requested file type, so another one was used; 'best' = no usable option
   * for the tier, so the row's stored format was kept.
   */
  adjusted: 'above' | 'container' | 'best' | null;
}

const isAudioOption = (f: FormatOption) => f.label.startsWith('Audio');

/** Lowercase file types the videos offer for video tiers, e.g. ['mp4', 'mkv']. */
export function videoContainersOf(
  formatLists: (FormatOption[] | undefined)[],
): string[] {
  const seen = new Set<string>();
  for (const options of formatLists) {
    for (const f of options ?? []) {
      // The "Default Format" entry has no resolution and isn't a real pick.
      if (isAudioOption(f) || heightOfFormatLabel(f.label) === undefined) {
        continue;
      }
      if (f.fileExtension) seen.add(f.fileExtension.toLowerCase());
    }
  }
  return [...seen];
}

/** Vertical resolution from "mp4 - 1080p", "mp4 - 1080p60" or "mp4 - 1920x1080". */
export function heightOfFormatLabel(label: string): number | undefined {
  const byDims = label.match(/\d{3,4}x(\d{3,4})/);
  if (byDims) return Number(byDims[1]);
  const byP = label.match(/(\d{3,4})p/i);
  return byP ? Number(byP[1]) : undefined;
}

const asVideo = (f: FormatOption): StoredFormat => ({
  ext: f.fileExtension,
  formatId: f.formatId,
  audioExt: '',
  audioFormatId: '',
});

// Same field split as FormatSelector / FormatSelectorModal for audio-only.
const asAudio = (f: FormatOption): StoredFormat => ({
  ext: f.fileExtension,
  formatId: '',
  audioExt: f.fileExtension,
  audioFormatId: f.formatId,
});

type HeightedOption = { f: FormatOption; h: number };

/**
 * Picks a video tier's option from `withHeights`: the best height at or below
 * the tier, else the closest above it. 'best' takes the highest. Null when
 * there is nothing to pick from.
 */
function pickForTier(
  tier: Exclude<BulkFormatTier, 'audio' | 'mp3'>,
  withHeights: HeightedOption[],
): { f: FormatOption; adjusted: 'above' | null } | null {
  // Stable sorts keep FormatService's order between options of equal height,
  // so the site's preferred container wins ties.
  const highestFirst = [...withHeights].sort((a, b) => b.h - a.h);
  if (tier === 'best') {
    return highestFirst[0] ? { f: highestFirst[0].f, adjusted: null } : null;
  }

  const wanted = Number(tier);
  const atOrBelow = highestFirst.find((x) => x.h <= wanted);
  if (atOrBelow) return { f: atOrBelow.f, adjusted: null };

  const above = [...withHeights]
    .filter((x) => x.h > wanted)
    .sort((a, b) => a.h - b.h)[0];
  return above ? { f: above.f, adjusted: 'above' } : null;
}

/**
 * `container` is an optional file type (e.g. 'mp4') for video tiers. The
 * tier is tried within that file type first; a video that doesn't offer it
 * falls back to its normal pick and is reported as adjusted 'container'.
 */
export function resolveBulkFormat(
  tier: BulkFormatTier,
  formats: FormatOption[] | undefined,
  stored: StoredFormat,
  container?: string,
): ResolvedBulkFormat {
  const options = formats ?? [];
  const keepStored = (adjusted: ResolvedBulkFormat['adjusted']) => ({
    ...stored,
    label:
      options.find((f) => f.formatId === stored.formatId && !isAudioOption(f))
        ?.label ?? stored.ext,
    adjusted,
  });

  if (tier === 'audio' || tier === 'mp3') {
    const audio = options.filter(isAudioOption);
    const pick =
      tier === 'mp3'
        ? audio.find((f) => f.fileExtension === 'mp3')
        : audio.find((f) => f.fileExtension !== 'mp3') ?? audio[0];
    return pick
      ? { ...asAudio(pick), label: pick.label, adjusted: null }
      : keepStored('best');
  }

  const wantedContainer = container?.toLowerCase();
  const matchesContainer = (ext: string) =>
    !wantedContainer || ext.toLowerCase() === wantedContainer;

  // 'best' with no file type, or one the stored format already satisfies,
  // keeps the stored format exactly as before.
  if (tier === 'best' && matchesContainer(stored.ext)) return keepStored(null);

  const withHeights = options
    .filter((f) => !isAudioOption(f))
    .map((f) => ({ f, h: heightOfFormatLabel(f.label) }))
    .filter((x): x is HeightedOption => x.h !== undefined);

  const inContainer = pickForTier(
    tier,
    withHeights.filter((x) => matchesContainer(x.f.fileExtension)),
  );
  if (inContainer) {
    return {
      ...asVideo(inContainer.f),
      label: inContainer.f.label,
      adjusted: inContainer.adjusted,
    };
  }

  if (tier === 'best') return keepStored('container');
  const anyContainer = pickForTier(tier, withHeights);
  if (anyContainer) {
    return {
      ...asVideo(anyContainer.f),
      label: anyContainer.f.label,
      adjusted: wantedContainer ? 'container' : anyContainer.adjusted,
    };
  }

  return keepStored('best');
}
