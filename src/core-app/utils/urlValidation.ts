/**
 * URL validation utilities
 *
 * This file contains reusable URL validation functions that can be used
 * across the application for consistent URL validation.
 */

import { toast } from '@/core-app/components/shadcn/hooks/use-toast';

/**
 * Checks if a URL is a YouTube link and determines its type
 * @param url - The URL to check
 * @returns 'playlist' | 'video' | 'invalid' - The type of YouTube link
 */
// URL validation with playlist check

export const cleanRawLink = (url: string): string => {
  const rawPattern = /^https:\/\/youtu\.be\/[\w-]+(?:\?.*)?$/;
  if (rawPattern.test(url)) {
    // Extract video ID from youtu.be URL (everything after the slash, before any query params)
    const videoIdMatch = url.match(/youtu\.be\/([\w-]+)/);
    if (videoIdMatch) {
      const videoId = videoIdMatch[1];
      return `https://youtube.com/watch?v=${videoId}`;
    }
  }
  return url;
};

/**
 * Reads the `list` query parameter off a YouTube URL, in any of its forms
 * (`youtube.com/watch?v=…&list=…`, `youtube.com/playlist?list=…`, or the
 * `youtu.be/<id>?list=…` short link). Returns null when there is no usable
 * list id.
 */
export const getYouTubeListId = (url: string): string | null => {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, '');
    if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'youtu.be') {
      return null;
    }
    const listId = parsed.searchParams.get('list');
    return listId && listId.trim() ? listId.trim() : null;
  } catch {
    return null;
  }
};

/**
 * True when a `list` id refers to a real, enumerable playlist.
 *
 * Not every `list=` value is a playlist yt-dlp can expand:
 *  - `RD…`  auto-generated radio / "Mix" — endless and personalised, so it has
 *           no fixed entry list to import. This is what a "Play all"/autoplay
 *           link carries, e.g. `?list=RD<videoId>`.
 *  - `WL`   Watch Later, `LL` Liked videos — private to the signed-in account,
 *           so an unauthenticated fetch returns nothing.
 * Everything else (`PL…`, `UU…`, `OL…`, `FL…`) is a normal playlist.
 *
 * Treating a mix as a playlist is what produced the "Failed to fetch playlist
 * information" toast: yt-dlp cannot flat-extract it, so the fetch threw and
 * the user got a generic error for a link that is really just a single video.
 */
export const isEnumerableYouTubeListId = (listId: string): boolean => {
  if (/^RD/i.test(listId)) return false; // radio / mix
  if (/^(WL|LL)$/i.test(listId)) return false; // private, per-account
  return true;
};

/**
 * True when `url` points at a playlist whose contents can actually be fetched.
 * Mixes and private pseudo-playlists return false and should be handled as a
 * plain single-video download instead.
 */
export const isEnumerableYouTubePlaylist = (url: string): boolean => {
  const listId = getYouTubeListId(url);
  return listId != null && isEnumerableYouTubeListId(listId);
};

export const isYouTubeLink = (
  url: string,
): 'playlist' | 'video' | 'invalid' => {
  // A real, enumerable `list=` makes this a playlist regardless of whether the
  // URL is a /watch, /playlist, or youtu.be short link. Mixes (RD…) and
  // private lists (WL/LL) deliberately fall through to 'video'.
  if (isEnumerableYouTubePlaylist(url)) {
    return 'playlist';
  }
  return 'video';
};

/**
 * Gets the domain name from a URL
 * @param url - The URL to extract domain from
 * @returns string | null - The domain name or null if invalid
 */
export const getDomainFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
};

/**
 * Validates if a string is a valid URL
 * @param url - The URL string to validate
 * @returns boolean - True if the URL is valid, false otherwise
 */
export const isValidUrl = (url: string): boolean => {
  try {
    // Validates link if it follows the standard format
    const urlPattern = new RegExp(
      '^(https?:\\/\\/)?' +
        '(' +
        '((([a-zA-Z\\d]([a-zA-Z\\d-]*[a-zA-Z\\d])*)\\.)+[a-zA-Z]{2,}|' +
        '((\\d{1,3}\\.){3}\\d{1,3}))' +
        '(\\:\\d+)?(\\/[-a-zA-Z\\d%_.~+@:]*)*' +
        '(\\?[;&a-zA-Z\\d%_.~+@=-]*)?' +
        '(\\#[-a-zA-Z\\d_]*)?' +
        ')$',
      'i',
    );

    if (!urlPattern.test(url)) {
      toast({
        variant: 'destructive',
        title: 'Invalid URL Format',
        description: `The URL format is not valid`,
        duration: 5000,
      });
      return false;
    }

    try {
      new URL(url);
      const linkType = isYouTubeLink(url);
      const rawPattern = /^https:\/\/youtu\.be\/[\w-]+(?:\?.*)?$/;

      if (rawPattern.test(url)) {
        const cleanedUrl = cleanRawLink(url);
        // Validate the cleaned URL instead of returning false
        url = cleanedUrl;
      }
      if (linkType === 'playlist') {
        toast({
          variant: 'destructive',
          title: 'Playlist not supported for clipboard downloading',
          description: 'Use a non-playlist URL or try manual download.',
          duration: 5000,
        });
        return false;
      } else if (linkType === 'video') {
        new URL(url);
        return true;
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Invalid URL Format',
        description: `The URL format is not valid: ${err}`,
        duration: 5000,
      });
      return false;
    }
  } catch {
    toast({
      variant: 'destructive',
      title: 'Invalid URL Format',
      description: 'The URL format is not valid',
      duration: 5000,
    });
    return false;
  }
};

/**
 * Extracts URLs from text content
 * @param text - The text content to search for URLs
 * @returns string | null - The first valid URL found, or null if none found
 */
export const extractUrlFromText = (text: string): string | null => {
  // Trim whitespace
  const trimmedText = text.trim();
  const rawPattern = /^https:\/\/youtu\.be\/[\w-]+(?:\?.*)?$/;

  if (rawPattern.test(trimmedText)) {
    const cleanedUrl = cleanRawLink(trimmedText);
    return cleanedUrl;
  }
  // If the entire text is a valid URL, return it
  else if (isValidUrl(trimmedText)) {
    return trimmedText;
  }

  // Try to find URLs within the text using a regex pattern
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = trimmedText.match(urlRegex);

  if (matches && matches.length > 0) {
    // Return the first valid URL found
    for (const match of matches) {
      if (isValidUrl(match)) {
        return match;
      }
    }
  }

  return null;
};
