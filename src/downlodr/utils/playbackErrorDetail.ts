const MAX_LENGTH = 160;

/**
 * A short, readable reason for the video player's error screen, taken from
 * whatever failed (an IPC call into yt-dlp, a MediaError, a thrown string).
 * Drops Electron's "Error invoking remote method '…': Error:" wrapper and
 * yt-dlp's "ERROR: [extractor] id:" prefix, keeps the first line, and caps
 * the length. Returns null when there's nothing worth showing.
 */
export function playbackErrorDetail(error: unknown): string | null {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : '';
  let text = raw.split('\n')[0] ?? '';
  text = text.replace(/^Error invoking remote method '[^']*':\s*(Error:\s*)?/i, '');
  text = text.replace(/^ERROR:\s*/i, '');
  text = text.replace(/^\[[^\]]+\]\s*[^:]*:\s*/, '');
  text = text.trim();
  if (!text) return null;
  return text.length > MAX_LENGTH
    ? `${text.slice(0, MAX_LENGTH - 1)}…`
    : text;
}
