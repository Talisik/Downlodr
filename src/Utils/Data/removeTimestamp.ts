export interface TranscriptSegment {
  timestamp: string;
  text: string;
}

/**
 * Parses SRT transcript content into timestamped segments.
 * SRT format: index\r\nHH:MM:SS,ms --> HH:MM:SS,ms\r\ntext\r\n
 */
export function parseTranscriptContent(content: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  // Split on blank lines to get SRT blocks
  const blocks = content.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    // Find the timecode line (contains "-->")
    const timecodeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timecodeIdx === -1) continue;

    const timecode = lines[timecodeIdx];
    const startTime = timecode.split('-->')[0].trim();
    const textLines = lines.slice(timecodeIdx + 1).filter(Boolean);
    const text = textLines.join(' ').trim();

    if (text) {
      segments.push({ timestamp: startTime, text });
    }
  }

  return segments;
}

/**
 * Formats an SRT timestamp (HH:MM:SS,ms or HH:MM:SS) for display as MM:SS or HH:MM:SS.
 */
export function formatTimestamp(timestamp: string): string {
  // Normalize comma to period for consistency
  const normalized = timestamp.replace(',', '.');
  const parts = normalized.split(':');
  if (parts.length < 2) return timestamp;

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = Math.floor(parseFloat(parts[2] ?? '0'));

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Strips SRT sequence numbers, timecodes, and blank lines, returning plain text.
 */
export function cleanTranscriptContent(content: string): string {
  return content
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^\d+$/.test(trimmed)) return false; // SRT index numbers
      if (/\d{2}:\d{2}:\d{2}[,.]/.test(trimmed)) return false; // timecodes
      return true;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
