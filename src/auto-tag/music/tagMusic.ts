/** Tagging for music downloads. */

import { dedupeCaseInsensitive } from '../tagUtils';
import type { TagResult, VideoMeta } from '../types';

const MUSIC_DESCRIPTORS =
  /\b(official\s+music\s+video|official\s+video|official\s+audio|official\s+lyric\s+video|music\s+video|lyric\s+video|lyrics?|visuali[sz]er|audio|remaster(?:ed)?|remix|live|acoustic|cover|performance(?:\s+video)?|color\s+coded|4k|hd|hq|explicit|clean|extended|radio\s+edit|mv|m\/v)\b/gi;

const DASH = /\s[-–—]\s/;

const FEAT = /\b(?:feat\.?|ft\.?|featuring)\s+([^()[\]|]+)/i;

const PROD = /\(?\bprod\.?\s*(?:by)?\s*[^()[\]|]+\)?/gi;

function tidy(s: string): string {
  return s
    .replace(/[([{)\]}'"’”]+\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanMusicTitle(title: string): string {
  return title
    .replace(FEAT, ' ')
    .replace(PROD, ' ')
    .replace(/[([{][^)\]}]*[)\]}]/g, ' ')
    .split('|')[0]
    .replace(MUSIC_DESCRIPTORS, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function splitArtistSong(s: string): { artist: string; song: string } | null {
  const dash = s.split(DASH);
  if (dash.length >= 2 && dash[0].trim()) {
    return { artist: tidy(dash[0]), song: tidy(dash.slice(1).join(' - ')) };
  }
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

  if (input.track && input.artist) {
    artist = input.artist.trim();
    song = input.track.trim();
  } else {
    const cleaned = cleanMusicTitle(rawTitle);
    const topic = input.channel?.match(/^(.*?)\s*-\s*topic$/i);

    if (topic && topic[1].trim()) {
      artist = topic[1].trim();
      song = input.track ? input.track.trim() : cleaned;
    } else {
      const parts = splitArtistSong(cleaned);
      if (parts) {
        artist = parts.artist;
        song = parts.song;
      } else {
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
