const ARTICLE_KEYWORDS = ['article', 'https://articlesEasterEgg0101.com'];

/**
 * Returns true if the input matches any registered article keyword
 * (case-insensitive, trimmed).
 */
export const isArticleKeyword = (input: string): boolean => {
  const normalized = input.trim().toLowerCase();
  return ARTICLE_KEYWORDS.some((kw) => normalized === kw);
};
