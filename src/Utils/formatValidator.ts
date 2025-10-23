/**
 * Format Validator Utility
 * Validates and provides fallbacks for video format selection
 * 
 * Purpose: Prevent "Requested format is not available" errors
 */

import { VideoFormat } from '../schema/download';

export interface FormatValidationResult {
  isValid: boolean;
  fallbackFormat?: string;
  suggestion?: string;
}

/**
 * Validate if a format ID exists in the available formats
 */
export function validateFormatId(
  formatId: string,
  availableFormats: VideoFormat[]
): FormatValidationResult {
  // Check if the exact format exists
  const formatExists = availableFormats.some(f => f.format_id === formatId);
  
  if (formatExists) {
    return { isValid: true };
  }
  
  // Format doesn't exist - suggest fallback
  console.warn(`Format ID ${formatId} not found in available formats`);
  
  // Try to find a similar format based on quality
  const fallback = findBestFallbackFormat(formatId, availableFormats);
  
  return {
    isValid: false,
    fallbackFormat: fallback,
    suggestion: fallback ? `Using fallback format: ${fallback}` : 'Use "best" format'
  };
}

/**
 * Find best fallback format when requested format is not available
 */
function findBestFallbackFormat(
  requestedFormat: string,
  availableFormats: VideoFormat[]
): string | undefined {
  // If no formats available, return undefined
  if (!availableFormats || availableFormats.length === 0) {
    return undefined;
  }
  
  // Try to match by quality/resolution
  const requestedQuality = extractQualityFromFormatId(requestedFormat);
  
  if (requestedQuality) {
    // Find format with similar resolution
    const similarFormat = availableFormats.find(f => 
      f.height === requestedQuality || 
      f.format_note?.includes(`${requestedQuality}p`)
    );
    
    if (similarFormat) {
      return similarFormat.format_id;
    }
  }
  
  // Fallback to best video format with audio
  const bestCombined = availableFormats.find(f => 
    f.vcodec && f.vcodec !== 'none' && 
    f.acodec && f.acodec !== 'none'
  );
  
  if (bestCombined) {
    return bestCombined.format_id;
  }
  
  // Last resort: return the first video format
  const firstVideo = availableFormats.find(f => 
    f.vcodec && f.vcodec !== 'none'
  );
  
  return firstVideo?.format_id;
}

/**
 * Extract quality number from format ID
 * Examples: "137" (1080p), "136" (720p), "135" (480p)
 */
function extractQualityFromFormatId(formatId: string): number | null {
  // Common YouTube format IDs to quality mapping
  const formatQualityMap: Record<string, number> = {
    '137': 1080,
    '136': 720,
    '135': 480,
    '134': 360,
    '133': 240,
    '160': 144,
    '313': 2160, // 4K
    '271': 1440, // 2K
  };
  
  return formatQualityMap[formatId] || null;
}

/**
 * Build safe format string with fallback
 * Returns a format string that yt-dlp can handle
 */
export function buildSafeFormatString(
  videoFormatId?: string,
  audioFormatId?: string,
  availableFormats?: VideoFormat[]
): string {
  // If no specific formats requested, use best
  if (!videoFormatId && !audioFormatId) {
    return 'best';
  }
  
  // Validate formats if we have available formats list
  if (availableFormats && availableFormats.length > 0) {
    let safeVideoFormat = videoFormatId;
    let safeAudioFormat = audioFormatId;
    
    // Validate video format
    if (videoFormatId) {
      const videoValidation = validateFormatId(videoFormatId, availableFormats);
      if (!videoValidation.isValid) {
        console.warn(`Video format ${videoFormatId} not available, using fallback`);
        safeVideoFormat = videoValidation.fallbackFormat;
      }
    }
    
    // Validate audio format
    if (audioFormatId) {
      const audioValidation = validateFormatId(audioFormatId, availableFormats);
      if (!audioValidation.isValid) {
        console.warn(`Audio format ${audioFormatId} not available, using fallback`);
        safeAudioFormat = audioValidation.fallbackFormat;
      }
    }
    
    // Build format string with fallback
    if (safeVideoFormat && safeAudioFormat) {
      return `${safeVideoFormat}+${safeAudioFormat}/bestvideo+bestaudio/best`;
    } else if (safeVideoFormat) {
      return `${safeVideoFormat}/bestvideo/best`;
    } else if (safeAudioFormat) {
      return `${safeAudioFormat}/bestaudio/best`;
    }
  }
  
  // Fallback without validation
  if (videoFormatId && audioFormatId) {
    return `${videoFormatId}+${audioFormatId}/bestvideo+bestaudio/best`;
  } else if (videoFormatId) {
    return `${videoFormatId}/bestvideo/best`;
  } else if (audioFormatId) {
    return `${audioFormatId}/bestaudio/best`;
  }
  
  return 'best';
}

/**
 * Check if format combination is valid
 */
export function isValidFormatCombination(
  videoFormatId: string | undefined,
  audioFormatId: string | undefined,
  availableFormats: VideoFormat[]
): boolean {
  if (!videoFormatId && !audioFormatId) {
    return true; // Will use 'best'
  }
  
  let videoValid = true;
  let audioValid = true;
  
  if (videoFormatId) {
    const result = validateFormatId(videoFormatId, availableFormats);
    videoValid = result.isValid;
  }
  
  if (audioFormatId) {
    const result = validateFormatId(audioFormatId, availableFormats);
    audioValid = result.isValid;
  }
  
  return videoValid && audioValid;
}

/**
 * Get user-friendly error message for format issues
 */
export function getFormatErrorMessage(
  videoFormatId?: string,
  audioFormatId?: string
): string {
  if (videoFormatId && audioFormatId) {
    return `The requested video format (${videoFormatId}) and audio format (${audioFormatId}) combination is not available for this video. Using best available quality instead.`;
  } else if (videoFormatId) {
    return `The requested video format (${videoFormatId}) is not available for this video. Using best available quality instead.`;
  } else if (audioFormatId) {
    return `The requested audio format (${audioFormatId}) is not available for this video. Using best available quality instead.`;
  }
  
  return 'The requested format is not available. Using best available quality instead.';
}

