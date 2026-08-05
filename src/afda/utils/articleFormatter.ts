import {
  ArticleModel,
  ArticleSection,
} from '@/afda/backend/schema/articleSchema';

export interface FormattedSection {
  heading: string | null;
  paragraphs: string[];
}

const chunkBySentences = (text: string, perChunk = 3): string[] => {
  const sentences = text.match(/[^.!?]+[.!?]+["']?\s*/g) ?? [text];
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += perChunk) {
    const chunk = sentences
      .slice(i, i + perChunk)
      .join('')
      .trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
};

export const splitIntoParagraphs = (text: string): string[] => {
  const byDoubleNewline = text
    .split(/\n{2,}|\r\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (byDoubleNewline.length > 1) return byDoubleNewline;

  const bySingleNewline = text
    .split(/\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (bySingleNewline.length > 1) return bySingleNewline;

  return chunkBySentences(text.trim());
};

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

export const formatArticleSections = (
  article: ArticleModel,
): FormattedSection[] => {
  if (article.article_content) {
    return [
      {
        heading: null,
        paragraphs: splitIntoParagraphs(article.article_content),
      },
    ];
  }

  if (article.raw_html) {
    const text = stripHtml(article.raw_html);
    const paragraphs = splitIntoParagraphs(text);
    if (paragraphs.length > 0) {
      return [{ heading: null, paragraphs }];
    }
  }

  if (article.article_sections.length > 0) {
    return article.article_sections
      .map((section: ArticleSection) => ({
        heading: section.heading ?? null,
        paragraphs: splitIntoParagraphs(section.content),
      }))
      .filter((s) => s.paragraphs.length > 0);
  }

  return [];
};
