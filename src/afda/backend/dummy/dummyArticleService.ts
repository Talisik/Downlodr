/**
 * Dummy article service — stands in for the real backend package.
 *
 * When the real parser microservice package is available, replace this file
 * with an actual call (e.g. window.afdaFunctions.parseArticle(url)) and keep
 * the same return signature so ArticleSidePanel needs no changes.
 */

import {
  ArticleModel,
  ArticleErrorModel,
  ParserResult,
  isArticleModel,
} from '@/afda/backend/schema/articleSchema';
import dummyData from './dummyArticle.json';

/** Simulated network/parsing delay in ms */
const SIMULATED_DELAY_MS = 1200;

function normalizeManualArticle(article: any): ArticleModel {
  const images =
    Array.isArray(article?.images) && article.images.length > 0
      ? article.images.map((url: string) => ({
          url,
          alt: null as string | null,
        }))
      : [{ url: '', alt: null as string | null }];

  const sections = Array.isArray(article?.sections)
    ? article.sections.map((section: any) => ({
        heading: section?.heading ?? null,
        content: section?.content ?? '',
      }))
    : [];

  const authors = article?.author ? [{ name: String(article.author) }] : [];

  return {
    article_title: article?.title ?? null,
    article_publish_date: article?.publishedAt
      ? new Date(article.publishedAt)
      : null,
    article_authors: authors,
    article_sections: sections,
    article_content: article?.bodyText ?? null,
    article_videos: [],
    article_images: images,
    article_status: 'Done',
    article_error_status: null,
    is_published_date_correct: true,
    updated_by: 'Parser Microservice',
    date_updated: new Date(),
    date_parsed: new Date(),
    raw_html: null,
  };
}

function createParseError(message: string): ArticleErrorModel {
  return {
    article_status: 'Error',
    article_error_status: message,
    updated_by: 'Parser Microservice',
    date_updated: new Date(),
    date_parsed: new Date(),
  };
}

/**
 * Try the real AFDA IPC bridge first; fallback to the existing dummy payload.
 */
export async function fetchArticle(url: string): Promise<ParserResult> {
  if (!url.startsWith('http')) {
    return createParseError(
      `Invalid URL: "${url}" must start with http or https`,
    );
  }

  const bridgeParse =
    typeof window !== 'undefined' && window.afdaBridge?.parseArticle
      ? window.afdaBridge.parseArticle(url)
      : typeof window !== 'undefined' &&
        window.afdaBridge?.manualArticles?.parse
      ? window.afdaBridge.manualArticles.parse({ url })
      : null;

  if (bridgeParse) {
    try {
      const result = await bridgeParse;

      if (result && typeof result === 'object') {
        if ('error' in result && result.error) {
          const errorInfo = result.error as { message?: string; code?: string };
          return createParseError(
            errorInfo.message ?? String(errorInfo.code ?? 'Unknown error'),
          );
        }

        if ('article' in result && result.article) {
          return normalizeManualArticle(result.article);
        }
      }

      return createParseError('Unexpected AFDA parse response');
    } catch (error) {
      return createParseError(
        error instanceof Error ? error.message : 'AFDA parse bridge failed',
      );
    }
  }

  await new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY_MS));

  const result: ArticleModel = {
    ...dummyData,
    article_publish_date: dummyData.article_publish_date
      ? new Date(dummyData.article_publish_date)
      : null,
    date_updated: new Date(dummyData.date_updated),
    date_parsed: new Date(dummyData.date_parsed),
  };

  return result;
}

export { isArticleModel };
export type { ArticleModel, ArticleErrorModel, ParserResult };
