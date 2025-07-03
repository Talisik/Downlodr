/**
 * URL validation utilities
 *
 * This file contains reusable URL validation functions that can be used
 * across the application for consistent URL validation.
 */

import { toast } from '../Components/SubComponents/shadcn/hooks/use-toast';

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

export const isYouTubeLink = (
  url: string,
): 'playlist' | 'video' | 'invalid' => {
  const videoPattern = /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/;
  const playlistPattern =
    /^https:\/\/(?:www\.)?youtube\.com\/playlist\?list=[\w-]+$/;

  // If the URL matches a video URL and has a "list" query, it's part of a playlist
  if (videoPattern.test(url) && url.includes('list=')) {
    return 'playlist';
  }
  // If it's a direct playlist URL
  else if (playlistPattern.test(url)) {
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
        '(\\:\\d+)?(\\/[-a-zA-Z\\d%_.~+@]*)*' +
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
        duration: 3000,
      });
      return false;
    }

    try {
      new URL(url);
      const linkType = isYouTubeLink(url);

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
        duration: 3000,
      });
      return false;
    }
  } catch {
    toast({
      variant: 'destructive',
      title: 'Invalid URL Format',
      description: 'The URL format is not valid',
      duration: 3000,
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

  // If the entire text is a valid URL, return it
  if (isValidUrl(trimmedText)) {
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
