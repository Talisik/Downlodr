/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Checks if content is an M3U playlist by looking for the header
 * @param content The file content to check
 * @returns boolean indicating if it's an M3U playlist
 */
function isM3UPlaylist(content: string): boolean {
  return content.trim().startsWith('#EXTM3U');
}

/**
 * Extracts YouTube timedtext URLs from M3U playlist content
 * @param m3uContent The M3U playlist content
 * @returns Array of YouTube timedtext URLs found
 */
function extractYouTubeTimedtextUrls(m3uContent: string): string[] {
  const lines = m3uContent.split('\n');
  const timedtextUrls: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.includes('youtube.com/api/timedtext')) {
      timedtextUrls.push(trimmedLine);
    }
  }

  return timedtextUrls;
}

/**
 * Downloads content from a YouTube timedtext URL and ensures VTT format
 * @param timedtextUrl The YouTube timedtext API URL
 * @returns Promise<string | null> The VTT content or null if failed
 */
async function downloadTimedtextContent(
  timedtextUrl: string,
): Promise<string | null> {
  try {
    // Ensure the URL requests VTT format by modifying the fmt parameter
    const url = new URL(timedtextUrl);
    url.searchParams.set('fmt', 'vtt');

    const response = await fetch(url.toString());
    if (!response.ok) {
      return null;
    }

    const content = await response.text();

    // Basic validation - VTT files should start with "WEBVTT"
    if (!content.trim().startsWith('WEBVTT')) {
      return null;
    }

    return content;
  } catch (error) {
    return null;
  }
}

/**
 * Processes M3U playlist file to extract and download actual caption content
 * @param filePath Path to the downloaded M3U file
 * @returns Promise<boolean> True if successfully processed and replaced, false otherwise
 */
async function processM3UPlaylist(filePath: string): Promise<boolean> {
  try {
    // Read the M3U file content
    const fileResult = await window.plugins.readFileContents({
      filePath: filePath,
      pluginId: 'captionsHelper',
    });

    if (!fileResult.success || !fileResult.data) {
      return false;
    }

    const fileContent = fileResult.data;

    // Check if it's actually an M3U playlist
    if (!isM3UPlaylist(fileContent)) {
      return false;
    }

    // Extract YouTube timedtext URLs
    const timedtextUrls = extractYouTubeTimedtextUrls(fileContent);
    if (timedtextUrls.length === 0) {
      return false;
    }

    // Download content from the first timedtext URL
    const actualContent = await downloadTimedtextContent(timedtextUrls[0]);
    if (!actualContent) {
      return false;
    }

    // Replace the M3U file with the actual VTT content
    const writeResult = await window.plugins.writeFile({
      customPath: filePath,
      content: actualContent,
      overwrite: true,
      pluginId: 'captionsHelper',
      fileName: '', // Not used when customPath is provided
    });

    if (!writeResult.success) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Attempts to download English automatic captions from video metadata
 * @param videoInfo The video info object returned from ytdlp.getInfo
 * @param outputPath path to save the captions file (defaults to same location as video with .en.vtt extension)
 * @param fileName file name to save the captions file (defaults to video if no name is available)
 * @returns Promise<string> Path to the downloaded captions file or undefined if not available
 */

export async function downloadEnglishCaptions(
  videoInfo: any,
  outputPath: string,
  fileName: string,
): Promise<string | undefined> {
  try {
    // Check if automatic captions exist
    if (!videoInfo) {
      return undefined;
    }

    // Priority order: English original, then English
    let captionsData = undefined;
    let captionLang = '';
    if (videoInfo) {
      captionsData = videoInfo;
      captionLang = 'en';
    }
    if (!captionsData) {
      return undefined;
    }

    // Find the VTT format (preferred) or fallback to others in order of preference
    const formatPreference = ['vtt', 'ttml', 'srv3', 'srv2', 'srv1', 'json3'];
    let selectedCaption = undefined;

    for (const format of formatPreference) {
      selectedCaption = captionsData.find(
        (caption: any) => caption.ext === format,
      );
      if (selectedCaption) break;
    }

    if (!selectedCaption) {
      return undefined;
    }

    // Remove file extension from fileName if it exists
    const fileNameWithoutExt = fileName
      ? fileName.replace(/\.[^/.]+$/, '')
      : '';

    // Use fileName if provided, otherwise fallback to video title/ID
    const videoId = videoInfo.id || 'video';
    const videoTitle = fileNameWithoutExt || videoInfo.title || videoId;
    const sanitizedTitle = videoTitle.replace(/[\\ñ'/:*?"<>|]/g, '_');

    // Generate output path if not provided
    if (!outputPath) {
      outputPath = `${sanitizedTitle}.${captionLang}.${selectedCaption.ext}`;
    } else {
      outputPath = await window.downlodrFunctions.joinDownloadPath(
        outputPath,
        `${sanitizedTitle}.${captionLang}.${selectedCaption.ext}`,
      );
    }

    // Download the captions
    const downloadResult = await window.downlodrFunctions.downloadFile(
      selectedCaption.url,
      outputPath,
    );

    if (!downloadResult.success) {
      return undefined;
    }

    // Validate the downloaded content
    const fileSize = await window.downlodrFunctions.getFileSize(outputPath);
    if (!fileSize || fileSize < 10) {
      // Less than 10 bytes is likely empty/invalid
      await window.downlodrFunctions.deleteFile(outputPath);
      return undefined;
    }

    // NEW: Process M3U playlist if detected
    const wasProcessed = await processM3UPlaylist(outputPath);
    if (wasProcessed) {
      // Re-validate the file size after processing
      const newFileSize = await window.downlodrFunctions.getFileSize(
        outputPath,
      );
      if (!newFileSize || newFileSize < 10) {
        await window.downlodrFunctions.deleteFile(outputPath);
        return undefined;
      }
    } else {
      console.log(
        'File was not an M3U playlist or processing failed, keeping original file',
      );
    }

    // Additional content validation for VTT files
    if (selectedCaption.ext === 'vtt') {
      // Could add more sophisticated validation here if needed
      // For now, size check should catch most empty files
    }
    return outputPath;
  } catch (error) {
    return undefined;
  }
}
