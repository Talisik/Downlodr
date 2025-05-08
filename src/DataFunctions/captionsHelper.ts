/* eslint-disable @typescript-eslint/no-explicit-any */
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
      console.log('No automatic captions available in this video');
      return undefined;
    }

    // Priority order: English original, then English
    let captionsData = undefined;
    let captionLang = '';
    console.log(videoInfo);
    if (videoInfo) {
      captionsData = videoInfo;
      captionLang = 'en';
      console.log('found caption!last');
    }
    if (!captionsData) {
      console.log('No English automatic captions available');
      return undefined;
    }

    // Find the VTT format (preferred) or fallback to others in order of preference
    const formatPreference = ['vtt', 'ttml', 'srv3', 'srv2', 'srv1', 'json3'];
    let selectedCaption = undefined;

    for (const format of formatPreference) {
      console.log(captionsData);
      selectedCaption = captionsData.find(
        (caption: any) => caption.ext === format,
      );
      if (selectedCaption) break;
    }

    if (!selectedCaption) {
      console.log(
        `English captions found in ${captionLang} but no suitable format available`,
      );
      return undefined;
    }

    // Remove file extension from fileName if it exists
    const fileNameWithoutExt = fileName
      ? fileName.replace(/\.[^/.]+$/, '')
      : '';

    // Use fileName if provided, otherwise fallback to video title/ID
    const videoId = videoInfo.id || 'video';
    const videoTitle = fileNameWithoutExt || videoInfo.title || videoId;
    const sanitizedTitle = videoTitle.replace(/[\\/:*?"<>|]/g, '_');

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
    console.log(
      `Downloading ${captionLang} captions in ${selectedCaption.ext} format`,
    );
    await window.downlodrFunctions.downloadFile(
      selectedCaption.url,
      outputPath,
    );

    console.log(`Captions saved to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error downloading English captions:', error);
    return undefined;
  }
}
