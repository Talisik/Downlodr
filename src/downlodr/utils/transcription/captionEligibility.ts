/**
 * Which finished downloads can have captions generated — the rule behind the
 * Toolbar's bulk "Generate Captions" button.
 *
 * The disk is the ground truth, same as the per-row TranscrptButton. A
 * finished record can carry a caption path with no file behind it: when
 * captions were requested at download time, lifecycleActions stores the
 * *expected* `<folder>/<title>.srt` path whether or not it was ever written.
 * Checking only that the path string was non-empty disabled the bulk button
 * for exactly those videos, while their row still offered Generate.
 */
interface CaptionCandidate {
  id: string;
  status: string;
  transcriptionStatus?: string;
  transcriptLocation?: string;
  autoCaptionLocation?: string;
}

// Legacy sentinel values some older records carry instead of a path.
const NOT_A_PATH = new Set(['', 'iu', 'fu']);

export async function findCaptionlessDownloads<T extends CaptionCandidate>(
  downloads: T[],
  fileExists: (path: string) => Promise<boolean>,
): Promise<T[]> {
  const checks = downloads.map(async (download) => {
    if (download.status !== 'finished') return null;
    if (
      download.transcriptionStatus === 'queued' ||
      download.transcriptionStatus === 'transcribing'
    ) {
      return null;
    }
    const location = (
      typeof download.transcriptLocation === 'string'
        ? download.transcriptLocation
        : download.autoCaptionLocation ?? ''
    ).trim();
    if (NOT_A_PATH.has(location)) return download;
    const exists = await fileExists(location).catch(() => false);
    return exists ? null : download;
  });
  return (await Promise.all(checks)).filter((d): d is Awaited<T> => d !== null);
}
