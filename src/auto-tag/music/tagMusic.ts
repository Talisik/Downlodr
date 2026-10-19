/**
 * tagMusic.ts
 *
 * Music-specific tagging, routed to when the native category is "Music".
 * The transcript (lyrics) is ignored — useless as tags. See docs/PLAN.md §12.
 *
 * Artist + song are resolved via a priority cascade that prefers structured
 * data and never fabricates an artist from an untrusted channel:
 *   1. yt-dlp structured fields (track + artist)
 *   2. "<X> - Topic" channel  -> artist = X
 *   3. title "Artist - Song"  -> split the title (channel ignored)
 *   4. title "Artist 'Song'"  -> quoted song
 *   5. none                   -> tag the song only; drop the channel
 *
 * Extra tags when available: album, featured artist (own tag), "remix".
 */

import { dedupeCaseInsensitive } from '../tagUtils';
import type { TagResult, VideoMeta } from '../types';

/** Non-bracketed descriptor words stripped from a music title. */
const MUSIC_DESCRIPTORS =
  /\b(official\s+music\s+video|official\s+video|official\s+audio|official\s+lyric\s+video|music\s+video|lyric\s+video|lyrics?|visuali[sz]er|audio|remaster(?:ed)?|remix|live|acoustic|cover|performance(?:\s+video)?|color\s+coded|4k|hd|hq|explicit|clean|extended|radio\s+edit|mv|m\/v)\b/gi;

/** Artist/song separators. */
const DASH = /\s[-–—]\s/;

/** feat. / ft. / featuring X (X runs until a bracket, pipe, or end). */
const FEAT = /\b(?:feat\.?|ft\.?|featuring)\s+([^()[\]|]+)/i;

/** prod. by Y */
const PROD = /\(?\bprod\.?\s*(?:by)?\s*[^()[\]|]+\)?/gi;

/** Strip a trailing bracket/quote left dangling after other removals. */
function tidy(s: string): string {
  return s
    .replace(/[([{)\]}'"’”]+\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Clean a raw music title down to "Artist - Song" (or just the song). */
function cleanMusicTitle(title: string): string {
  return title
    .replace(FEAT, ' ') // remove featured annotation (captured separately)
    .replace(PROD, ' ')
    .replace(/[([{][^)\]}]*[)\]}]/g, ' ') // bracketed descriptors
    .split('|')[0] // trailing "| Channel/Label"
    .replace(MUSIC_DESCRIPTORS, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Split cleaned title into artist + song; null when no structure is found. */
function splitArtistSong(s: string): { artist: string; song: string } | null {
  // Artist - Song (or – / —)
  const dash = s.split(DASH);
  if (dash.length >= 2 && dash[0].trim()) {
    return { artist: tidy(dash[0]), song: tidy(dash.slice(1).join(' - ')) };
  }
  // Artist 'Song' / Artist "Song"
  const q = s.match(/^(.+?)\s*['"“‘]([^'"”’]+)['"”’]\s*$/);
  if (q && q[1].trim() && q[2].trim()) {
    return { artist: tidy(q[1]), song: tidy(q[2]) };
  }
  return null;
}

export function tagMusic(input: VideoMeta): TagResult {
  const rawTitle = input.title ?? '';

  const remix = /\bremix\b/i.test(rawTitle);
  const featMatch = rawTitle.match(FEAT);
  const featured = featMatch ? tidy(featMatch[1]) : null;

  let artist: string | null = null;
  let song: string | null = null;

  // 1. structured fields
  if (input.track && input.artist) {
    artist = input.artist.trim();
    song = input.track.trim();
  } else {
    const cleaned = cleanMusicTitle(rawTitle);
    const topic = input.channel?.match(/^(.*?)\s*-\s*topic$/i);

    if (topic && topic[1].trim()) {
      // 2. Topic channel — artist from channel, song from track or title
      artist = topic[1].trim();
      song = input.track ? input.track.trim() : cleaned;
    } else {
      const parts = splitArtistSong(cleaned);
      if (parts) {
        // 3/4. artist + song from the title
        artist = parts.artist;
        song = parts.song;
      } else {
        // 5. no reliable artist — tag the song only; DROP the channel
        song = cleaned || null;
      }
    }
  }

  const tags = [
    artist,
    song,
    input.album?.trim() || null,
    featured,
    remix ? 'remix' : null,
  ].filter((t): t is string => Boolean(t && t.trim()));

  return { id: input.id, tags: dedupeCaseInsensitive(tags), tier: 1 };
}
