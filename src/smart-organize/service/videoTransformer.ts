import fs from 'fs';
import type { VideoInput } from '../backend/smart-organize-backend/index.js';
import type { SmartOrganizeDownloadInput } from '../schema/smartOrganizeTypes.js';

// ─── SRT / VTT Cleaning ───────────────────────────────────────────────────────

/** Remove SRT sequence numbers (lines that are just digits). */
const RE_SEQUENCE   = /^\d+\s*$/;

/** Remove SRT/VTT timestamp lines: 00:00:01,000 --> 00:00:04,000 */
const RE_TIMESTAMP  = /^\d{1,2}:\d{2}(?::\d{2})?[.,]\d{2,3}\s*-->/;

/** Remove VTT "WEBVTT" header and NOTE/STYLE/REGION blocks. */
const RE_VTT_HEADER = /^(WEBVTT|NOTE|STYLE|REGION)/;

/** Strip inline tags: <i>, <b>, <c.color>, <00:00:01.000>, etc. */
const RE_INLINE_TAG = /<[^>]+>/g;

/**
 * Clean an SRT or VTT file's raw text content into plain prose.
 *
 * Steps:
 *   1. Split into lines
 *   2. Drop sequence numbers, timestamps, VTT header/block lines
 *   3. Strip inline tags
 *   4. Collapse multiple blank lines and join into a single string
 */
function cleanSubtitleText(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const kept: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed)                          continue; // blank line
    if (RE_SEQUENCE.test(trimmed))         continue; // SRT index
    if (RE_TIMESTAMP.test(trimmed))        continue; // timestamp
    if (RE_VTT_HEADER.test(trimmed))       continue; // VTT header/block
    kept.push(trimmed.replace(RE_INLINE_TAG, ''));
  }

  return kept.join(' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Read a transcript file from disk and return cleaned plain text.
 * Handles .srt, .vtt, and plain .txt.
 * Returns null if the file cannot be read or is empty after cleaning.
 */
/** Only these extensions are ever treated as real transcript/caption content. */
const SUPPORTED_TRANSCRIPT_EXTENSIONS = new Set(['txt', 'srt', 'vtt']);

function readTranscript(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (!ext || !SUPPORTED_TRANSCRIPT_EXTENSIONS.has(ext)) {
    console.warn(
      `[SmartOrganize] Skipping unsupported transcript file type ".${ext}" (${filePath}) — expected .txt/.srt/.vtt`,
    );
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return null;

    if (ext === 'txt') return raw.trim() || null;

    // SRT and VTT both go through the same cleaner
    const cleaned = cleanSubtitleText(raw);
    return cleaned.length > 0 ? cleaned : null;
  } catch {
    // File unreadable — silently return null; organizer still works without it
    return null;
  }
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

/**
 * Map a SmartOrganizeDownloadInput to a VideoInput for the ML pipeline.
 *
 * - id          → download store id (already unique)
 * - title       → download name
 * - description → "" (includeDescription is false for YouTube sources)
 * - transcription → cleaned SRT/VTT text, or undefined if unreadable
 */
export function toVideoInput(download: SmartOrganizeDownloadInput): VideoInput {
  const transcription = readTranscript(download.transcriptLocation) ?? undefined;
  return {
    id: download.id,
    title: download.name,
    description: '',
    ...(transcription ? { transcription } : {}),
  };
}

/**
 * Map an array of eligible downloads to VideoInputs.
 * Logs a warning for any transcript that could not be read.
 */
export function toVideoInputs(
  downloads: SmartOrganizeDownloadInput[],
): VideoInput[] {
  return downloads.map((d) => {
    const input = toVideoInput(d);
    if (!input.transcription) {
      console.warn(
        `[SmartOrganize] Could not read transcript for "${d.name}" (${d.transcriptLocation}) — will use title only`,
      );
    }
    return input;
  });
}
