/**
 * Resolves an agent-supplied quality string to a concrete format the queue can
 * run.
 *
 * The chat/MCP surface talks in user words ("1080p", "audio", "best") because
 * that is what the person asked for. The download queue needs a real
 * `formatId` + extension out of the list FormatService built for *this* video,
 * which differs per site and per upload. This is the bridge between the two.
 *
 * It never fails: an unrecognised or unavailable quality falls back to the
 * video's default format rather than refusing the download. The caller gets
 * `matched: false` so it can tell the user what it actually picked.
 */
import type { FormatOption } from '@/downlodr/schema/metadataSchema';

export interface ResolvedAutoFormat {
  formatId: string;
  ext: string;
  /** True when the requested quality was found; false means we fell back. */
  matched: boolean;
  /** The chosen option's label, for reporting back to the user. */
  label: string;
}

const AUDIO_WORDS = ['audio', 'mp3', 'm4a', 'sound', 'music'];

/** Pull the vertical resolution out of "1080p", "1080", "hd1080", "2160p60". */
function parseHeight(quality: string): number | undefined {
  const m = quality.match(/(\d{3,4})\s*p?/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

/** Same, but read off a format option's label ("mp4 - 1080p60"). */
function heightOfLabel(label: string): number | undefined {
  const m = label.match(/(\d{3,4})p/i);
  return m ? Number(m[1]) : undefined;
}

export function resolveAutoFormat(
  quality: string | undefined,
  formats: {
    formatOptions: FormatOption[];
    audioOptions: FormatOption[];
    defaultFormatId: string;
    defaultExt: string;
  },
): ResolvedAutoFormat {
  const { formatOptions, audioOptions, defaultFormatId, defaultExt } = formats;
  const fallback = {
    formatId: defaultFormatId,
    ext: defaultExt,
    matched: false,
    label: formatOptions[0]?.label ?? defaultExt,
  };

  const q = (quality ?? '').trim().toLowerCase();
  if (!q || q === 'best' || q === 'best quality' || q === 'default') {
    return { ...fallback, matched: true };
  }

  // Audio-only. Prefer the mp3 option when the user said mp3, else the first.
  if (AUDIO_WORDS.some((w) => q.includes(w))) {
    const wantsMp3 = q.includes('mp3');
    const pick =
      (wantsMp3
        ? audioOptions.find((a) => a.fileExtension === 'mp3')
        : undefined) ?? audioOptions[0];
    if (pick) {
      return {
        formatId: pick.formatId,
        ext: pick.fileExtension,
        matched: true,
        label: pick.label,
      };
    }
    return fallback;
  }

  // An exact formatId the caller already knows (e.g. echoed back from
  // get_video_info). Accept the bare id as well as the "audio+video" pair
  // FormatService builds, which is what the store actually stores.
  const byId = formatOptions.find(
    (f) => f.formatId === q || f.formatId.toLowerCase().endsWith(`+${q}`),
  );
  if (byId) {
    return {
      formatId: byId.formatId,
      ext: byId.fileExtension,
      matched: true,
      label: byId.label,
    };
  }

  // Lowest quality — the tail of the list, which FormatService sorts descending.
  if (q === 'worst' || q === 'lowest' || q === 'smallest') {
    const pick = formatOptions
      .filter((f) => heightOfLabel(f.label) !== undefined)
      .slice(-1)[0];
    if (pick) {
      return {
        formatId: pick.formatId,
        ext: pick.fileExtension,
        matched: true,
        label: pick.label,
      };
    }
    return fallback;
  }

  // A resolution. Exact height first, then the best one at or below it —
  // asking for 1080p on a 720p-max video should download the 720p, not the
  // site default, which may be something else entirely.
  const wanted = parseHeight(q);
  if (wanted !== undefined) {
    const withHeights = formatOptions
      .map((f) => ({ f, h: heightOfLabel(f.label) }))
      .filter((x): x is { f: FormatOption; h: number } => x.h !== undefined);

    const exact = withHeights.find((x) => x.h === wanted);
    const below = withHeights
      .filter((x) => x.h <= wanted)
      .sort((a, b) => b.h - a.h)[0];
    const pick = exact ?? below;
    if (pick) {
      return {
        formatId: pick.f.formatId,
        ext: pick.f.fileExtension,
        matched: exact !== undefined,
        label: pick.f.label,
      };
    }
  }

  // A container preference on its own ("mkv", "mp4") — take the best option
  // with that extension.
  const byExt = formatOptions.find((f) => f.fileExtension.toLowerCase() === q);
  if (byExt) {
    return {
      formatId: byExt.formatId,
      ext: byExt.fileExtension,
      matched: true,
      label: byExt.label,
    };
  }

  return fallback;
}
