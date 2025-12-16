/**
 * Language Helper - Intelligently selects the best quality captions
 *
 * This helper prioritizes high-quality manual subtitles over automatic captions
 * while ensuring we get the original language content when available.
 */

// Type definitions for caption data structures
interface CaptionInfo {
  ext: string;
  url: string;
  name: string;
  impersonate?: boolean;
  __yt_dlp_client?: string;
}

interface SubtitlesData {
  [languageCode: string]: CaptionInfo[];
}

interface AutomaticCaptionsData {
  [languageCode: string]: CaptionInfo[];
}

interface CaptionSelection {
  caption: CaptionInfo;
  source: 'subtitle' | 'automatic';
  languageCode: string;
  languageName: string;
  isOriginal: boolean;
}

// Format preference order (best to worst quality)
const FORMAT_PREFERENCE = [
  'srt',
  'vtt',
  'ttml',
  'srv3',
  'srv2',
  'srv1',
  'json3',
] as const;

/**
 * Finds the original language from automatic captions
 * The original language is marked with "(Original)" in the name field
 */
function findOriginalLanguage(
  automaticCaptions: AutomaticCaptionsData,
): string | null {
  for (const [languageCode, captions] of Object.entries(automaticCaptions)) {
    if (captions && captions.length > 0) {
      // Check if any caption in this language is marked as original
      const hasOriginal = captions.some(
        (caption) =>
          caption.name && caption.name.toLowerCase().includes('(original)'),
      );

      if (hasOriginal) {
        return languageCode;
      }
    }
  }

  return null;
}

/**
 * Selects the best caption from a list based on format preference
 */
function selectBestCaption(captions: CaptionInfo[]): CaptionInfo | null {
  if (!captions || captions.length === 0) {
    return null;
  }

  // Try each format in preference order
  for (const format of FORMAT_PREFERENCE) {
    const caption = captions.find((c) => c.ext === format);
    if (caption) {
      return caption;
    }
  }

  // Fallback to first available caption
  return captions[0] || null;
}

/**
 * Searches for a specific language in subtitles data
 */
function findLanguageInSubtitles(
  subtitles: SubtitlesData,
  targetLanguageCode: string,
): CaptionInfo | null {
  const targetCaptions = subtitles[targetLanguageCode];
  if (!targetCaptions || targetCaptions.length === 0) {
    return null;
  }

  return selectBestCaption(targetCaptions);
}

/**
 * Gets the display name for a language by extracting it from caption data
 */
function getLanguageName(captions: CaptionInfo[], isOriginal = false): string {
  if (!captions || captions.length === 0) {
    return 'Unknown';
  }

  const caption = captions[0];
  let name = caption.name || 'Unknown';

  // Remove "(Original)" suffix if present for cleaner display
  if (isOriginal && name.includes('(Original)')) {
    name = name.replace(' (Original)', '').replace('(Original)', '').trim();
  }

  return name;
}

/**
 * Main function to intelligently select the best caption
 *
 * Strategy:
 * 1. Find the original language from automatic captions
 * 2. Look for that language in higher-quality subtitles
 * 3. If not found in subtitles, fall back to automatic captions for that language
 * 4. If no original language detected, try to find any good subtitle or automatic caption
 *
 * @param subtitles - Manual subtitle data (higher quality)
 * @param automaticCaptions - Auto-generated caption data (lower quality but more language options)
 * @returns Selected caption with metadata or null if none available
 */

// helper to normalize
function normalizeOriginalLanguageCode(code: string): string {
  return code
    ? code.toLowerCase().replace(/-orig$/, '') // lowercase + strip "-orig"
    : '';
}
export function selectOptimalCaption(
  subtitles: SubtitlesData,
  automaticCaptions: AutomaticCaptionsData,
): CaptionSelection | null {
  // Validate inputs
  if (!subtitles && !automaticCaptions) {
    return null;
  }

  // Step 1: Find the original language from automatic captions
  const rawOriginalLanguageCode = automaticCaptions
    ? findOriginalLanguage(automaticCaptions)
    : null;

  const originalLanguageCode = rawOriginalLanguageCode
    ? normalizeOriginalLanguageCode(rawOriginalLanguageCode)
    : null;
  if (originalLanguageCode) {
    console.log(`Found original language: ${originalLanguageCode}`);

    // Step 2: Try to find this language in higher-quality subtitles first
    if (subtitles) {
      const subtitleCaption = findLanguageInSubtitles(
        subtitles,
        originalLanguageCode,
      );

      if (subtitleCaption) {
        console.log(`Using high-quality subtitle for ${originalLanguageCode}`);
        const subtitleCaptions = subtitles[originalLanguageCode];
        return {
          caption: subtitleCaption,
          source: 'subtitle',
          languageCode: originalLanguageCode,
          languageName: getLanguageName(subtitleCaptions),
          isOriginal: true,
        };
      }
    }

    // Step 3: Fall back to automatic captions for the original language
    if (automaticCaptions && automaticCaptions[originalLanguageCode]) {
      const autoCaption = selectBestCaption(
        automaticCaptions[originalLanguageCode],
      );

      if (autoCaption) {
        console.log(
          `Using automatic caption for original language ${originalLanguageCode}`,
        );
        const autoCaptions = automaticCaptions[originalLanguageCode];
        return {
          caption: autoCaption,
          source: 'automatic',
          languageCode: originalLanguageCode,
          languageName: getLanguageName(autoCaptions, true),
          isOriginal: true,
        };
      }
    }
  }

  // Step 4: No original language found or available, try English as fallback
  console.log('No original language found, looking for English captions...');

  // Try English subtitles first (higher quality)
  if (subtitles) {
    const englishLanguageCodes = ['en', 'eng', 'english'];
    for (const langCode of englishLanguageCodes) {
      const caption = findLanguageInSubtitles(subtitles, langCode);
      if (caption) {
        console.log(`Using English subtitle (${langCode}) as fallback`);
        const subtitleCaptions = subtitles[langCode];
        return {
          caption,
          source: 'subtitle',
          languageCode: langCode,
          languageName: getLanguageName(subtitleCaptions),
          isOriginal: false,
        };
      }
    }
  }

  // Try English automatic captions
  if (automaticCaptions) {
    const englishLanguageCodes = ['en', 'eng', 'english'];
    for (const langCode of englishLanguageCodes) {
      if (automaticCaptions[langCode]) {
        const caption = selectBestCaption(automaticCaptions[langCode]);
        if (caption) {
          console.log(
            `Using English automatic caption (${langCode}) as fallback`,
          );
          const autoCaptions = automaticCaptions[langCode];
          return {
            caption,
            source: 'automatic',
            languageCode: langCode,
            languageName: getLanguageName(autoCaptions),
            isOriginal: false,
          };
        }
      }
    }
  }

  // Step 5: If no English found, try any available caption
  console.log('No English captions found, using any available caption...');

  // Try subtitles first (higher quality)
  if (subtitles) {
    for (const [languageCode, captions] of Object.entries(subtitles)) {
      const caption = selectBestCaption(captions);
      if (caption) {
        console.log(`Using subtitle for ${languageCode} as final fallback`);
        return {
          caption,
          source: 'subtitle',
          languageCode,
          languageName: getLanguageName(captions),
          isOriginal: false,
        };
      }
    }
  }

  // Finally, try automatic captions
  if (automaticCaptions) {
    for (const [languageCode, captions] of Object.entries(automaticCaptions)) {
      const caption = selectBestCaption(captions);
      if (caption) {
        console.log(
          `Using automatic caption for ${languageCode} as final fallback`,
        );
        return {
          caption,
          source: 'automatic',
          languageCode,
          languageName: getLanguageName(captions),
          isOriginal: false,
        };
      }
    }
  }

  // No captions available at all
  console.log('No captions available');
  return null;
}

/**
 * Helper function to get all available languages from both sources
 */
export function getAvailableLanguages(
  subtitles: SubtitlesData,
  automaticCaptions: AutomaticCaptionsData,
): Array<{
  code: string;
  name: string;
  source: 'subtitle' | 'automatic' | 'both';
  isOriginal: boolean;
}> {
  const languages = new Map<
    string,
    {
      name: string;
      sources: Set<'subtitle' | 'automatic'>;
      isOriginal: boolean;
    }
  >();

  // Find original language
  const originalLanguageCode = automaticCaptions
    ? findOriginalLanguage(automaticCaptions)
    : null;

  // Process subtitles
  if (subtitles) {
    for (const [code, captions] of Object.entries(subtitles)) {
      if (captions && captions.length > 0) {
        languages.set(code, {
          name: getLanguageName(captions),
          sources: new Set(['subtitle']),
          isOriginal: code === originalLanguageCode,
        });
      }
    }
  }

  // Process automatic captions
  if (automaticCaptions) {
    for (const [code, captions] of Object.entries(automaticCaptions)) {
      if (captions && captions.length > 0) {
        const existing = languages.get(code);
        const isOriginal = code === originalLanguageCode;

        if (existing) {
          existing.sources.add('automatic');
          existing.isOriginal = isOriginal;
        } else {
          languages.set(code, {
            name: getLanguageName(captions, isOriginal),
            sources: new Set(['automatic']),
            isOriginal,
          });
        }
      }
    }
  }

  // Convert to array format
  return Array.from(languages.entries())
    .map(([code, info]) => ({
      code,
      name: info.name,
      source: (info.sources.size > 1 ? 'both' : Array.from(info.sources)[0]) as
        | 'subtitle'
        | 'automatic'
        | 'both',
      isOriginal: info.isOriginal,
    }))
    .sort((a, b) => {
      // Sort: original first, then by source preference (subtitle > automatic), then alphabetically
      if (a.isOriginal && !b.isOriginal) return -1;
      if (!a.isOriginal && b.isOriginal) return 1;

      if (a.source !== b.source) {
        if (a.source === 'subtitle' || a.source === 'both') return -1;
        if (b.source === 'subtitle' || b.source === 'both') return 1;
      }

      return a.name.localeCompare(b.name);
    });
}

// Export types for use by other modules
export type {
  CaptionInfo,
  SubtitlesData,
  AutomaticCaptionsData,
  CaptionSelection,
};
