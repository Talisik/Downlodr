/**
 * A custom React function
 * This function sanitizes a given filename by removing invalid characters,
 * replacing multiple consecutive underscores with a single one, and ensuring
 * the filename does not exceed a specified length.
 * It also trims leading and trailing whitespace.
 *
 * @param filename - The original filename to be sanitized and validated.
 *
 * @returns string - The sanitized and validated  filename.
 */

import useDownloadStore from '../Store/downloadStore';

// Remove invalid characters from download name
const removeInvalidChar = (filename: string) => {
  // More comprehensive list of invalid characters
  const invalidChars = /[<>:"/\\|?*.!,]+/g;
  let sanitized = filename.replace(invalidChars, '_');

  // Replace multiple consecutive underscores with a single one
  sanitized = sanitized.replace(/_+/g, '_');

  // Remove leading/trailing whitespace and underscores
  sanitized = sanitized.replace(/^[_\s]+|[_\s]+$/g, '');

  // Ensure filename doesn't exceed maximum length (1150 characters)
  sanitized = sanitized.substring(0, 150);

  return sanitized;
};

// Process the filename to ensure it's valid and unique
const processFileName = async (
  basePath: string,
  fileName: string,
  extension: string,
): Promise<string> => {
  // First sanitize the filename
  const sanitizedName = removeInvalidChar(fileName);

  let counter = 1;
  let finalName = sanitizedName;
  let fileExists = true;

  while (fileExists) {
    // Check physical file existence
    const physicalFileExists = await window.downlodrFunctions.fileExists(
      `${basePath}${finalName}.${extension}`,
    );

    // Get store data directly from the imported store
    const store = useDownloadStore.getState();

    // Check if file exists in forDownloads or downloading
    const pendingFileExists = [
      ...store.forDownloads,
      ...store.downloading,
    ].some(
      (download) =>
        download.location === basePath &&
        download.downloadName === `${finalName}.${extension}`,
    );

    fileExists = physicalFileExists || pendingFileExists;

    if (fileExists) {
      finalName = `${sanitizedName}[${counter}]`;
      counter++;
    }
  }

  console.log('Processed filename:', finalName);
  return finalName;
};

// returns processed filtered and validated name
export { removeInvalidChar, processFileName };
