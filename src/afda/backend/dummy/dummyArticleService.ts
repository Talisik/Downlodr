/**
 * Dummy article service — stands in for the real backend package.
 *
 * When the real parser microservice package is available, replace this file
 * with an actual call (e.g. window.afdaFunctions.parseArticle(url)) and keep
 * the same return signature so ArticleSidePanel needs no changes.
 */

import { ArticleModel, ArticleErrorModel, ParserResult, isArticleModel } from '@/afda/backend/schema/articleSchema';
import dummyData from './dummyArticle.json';

/** Simulated network/parsing delay in ms */
const SIMULATED_DELAY_MS = 1200;

/**
 * Pretend to call the parser backend with a URL.
 * Returns a fully typed ArticleModel on success, ArticleErrorModel on failure.
 *
 * Swap this function body for the real IPC/API call once the backend package lands.
 */
export async function fetchArticle(url: string): Promise<ParserResult> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY_MS));

  // Simulate a parse error for obviously bad URLs so the error path is testable
  if (!url.startsWith('http')) {
    const error: ArticleErrorModel = {
      article_status: 'Error',
      article_error_status: `Invalid URL: "${url}" must start with http or https`,
      updated_by: 'Parser Microservice',
      date_updated: new Date(),
      date_parsed: new Date(),
    };
    return error;
  }

  // Happy path — return the dummy payload with dates coerced to Date objects
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
