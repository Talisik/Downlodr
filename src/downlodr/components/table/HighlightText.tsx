import React from 'react';

// Wraps substrings of `text` matching `query` (case-insensitive) in a <mark>.
// Shared by StatusPageTableRow (videos) and ArticleDownloadTableRow (articles)
// so search-match highlighting looks the same across both.
export const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query) return text;
  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
    'gi',
  );
  const parts = text.split(regex);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="bg-yellow-200 dark:bg-yellow-600 text-inherit rounded-sm px-0"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
};
