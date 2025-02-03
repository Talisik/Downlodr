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

  // Then check for uniqueness
  let counter = 1;
  let finalName = sanitizedName;

  // Check if file exists with extension
  while (
    await window.downlodrFunctions.fileExists(
      `${basePath}${finalName}.${extension}`,
    )
  ) {
    finalName = `${sanitizedName}[${counter}]`;
    counter++;
  }

  console.log('Processed filename:', finalName);
  return finalName;
};

export { removeInvalidChar, processFileName };
