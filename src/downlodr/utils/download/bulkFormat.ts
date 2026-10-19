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
   * closest higher quality was used; 'best' = no usable option for the tier,
   * so the row's stored format was kept.
   */
  adjusted: 'above' | 'best' | null;
}

const isAudioOption = (f: FormatOption) => f.label.startsWith('Audio');

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

export function resolveBulkFormat(
  tier: BulkFormatTier,
  formats: FormatOption[] | undefined,
  stored: StoredFormat,
): ResolvedBulkFormat {
  const options = formats ?? [];
  const keepStored = (adjusted: ResolvedBulkFormat['adjusted']) => ({
    ...stored,
    label:
      options.find((f) => f.formatId === stored.formatId && !isAudioOption(f))
        ?.label ?? stored.ext,
    adjusted,
  });

  if (tier === 'best') return keepStored(null);

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

  const wanted = Number(tier);
  const withHeights = options
    .filter((f) => !isAudioOption(f))
    .map((f) => ({ f, h: heightOfFormatLabel(f.label) }))
    .filter((x): x is { f: FormatOption; h: number } => x.h !== undefined);

  // Stable sort keeps FormatService's order between options of equal height,
  // so the site's preferred container wins ties.
  const atOrBelow = withHeights
    .filter((x) => x.h <= wanted)
    .sort((a, b) => b.h - a.h)[0];
  if (atOrBelow) {
    return {
      ...asVideo(atOrBelow.f),
      label: atOrBelow.f.label,
      adjusted: null,
    };
  }

  const above = withHeights
    .filter((x) => x.h > wanted)
    .sort((a, b) => a.h - b.h)[0];
  if (above) {
    return { ...asVideo(above.f), label: above.f.label, adjusted: 'above' };
  }

  return keepStored('best');
}
