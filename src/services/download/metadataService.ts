/**
 * Metadata service
 * Handles metadata extraction and processing for downloads
 */

import { downloadEnglishCaptions } from '@/Utils/Metadata/captionsHelper';

/**
 * Service for handling download metadata operations
 */
export class MetadataService {
  /**
   * Downloads English captions for a video
   */
  static async downloadEnglishCaptions(
    videoInfo: any,
    outputPath: string,
    fileName: string,
  ): Promise<string | undefined> {
    return downloadEnglishCaptions(videoInfo, outputPath, fileName);
  }

  // Additional metadata operations can be added here
  // e.g., extractThumbnails, getVideoInfo, etc.
}
