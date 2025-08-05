// Helper function to check if string is SVG
export const isSvgString = (str: string): boolean => {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  return trimmed.startsWith('<svg') && trimmed.endsWith('</svg>');
};

// Helper function to get first paragraph of description
export const getFirstParagraph = (
  description: string,
  pluginName?: string,
): string => {
  if (!description) return '';

  // Split by double line breaks first (common paragraph separator)
  const paragraphs = description.split(/\n\s*\n/);
  if (paragraphs.length > 1 && paragraphs[0].trim()) {
    return paragraphs[0].trim();
  }

  // If no double line breaks, try single line breaks
  const lines = description.split('\n');
  if (lines.length > 1 && lines[0].trim()) {
    return lines[0].trim();
  }

  // If no line breaks, return the full description (will be truncated by CSS)
  return description;
};
