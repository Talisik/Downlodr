import useDownloadStore from '../Store/downloadStore';

// Remove invalid characters from download name
const removeInvalidChar = (filename: string) => {
  const invalidChars = /[<>:"/\\|?*.]+/g;
  let sanitized = filename.replace(invalidChars, '_').trim();
  sanitized = sanitized.replace(/^\s+|\s+$/g, '');
  sanitized = sanitized.substring(0, 255);
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

export { removeInvalidChar, processFileName };
