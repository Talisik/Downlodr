import { ArticleModel, ArticleErrorModel, ParserResult } from '../backend/schema/articleSchema';
import dummyData from '../backend/dummy/dummyArticle.json';

/**
 * Extendr extension entry point for AFDA (Article Fetcher & Detail Analyzer).
 * Registers IPC channels for article parsing.
 */
export function main(entry: any) {
  const { events } = entry;
  const priority = -10;

  // Handle article parsing request
  events.on('afda:parse-article', async (event: any, url: string) => {
    console.log(`[AFDA Extension] Parsing article: ${url}`);
    
    // Simulate parsing delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (!url.startsWith('http')) {
      const error: ArticleErrorModel = {
        article_status: 'Error',
        article_error_status: `Invalid URL: "${url}" must start with http or https`,
        updated_by: 'AFDA Extension',
        date_updated: new Date(),
        date_parsed: new Date(),
      };
      return error;
    }

    const result: ArticleModel = {
      ...dummyData,
      article_publish_date: dummyData.article_publish_date
        ? new Date(dummyData.article_publish_date)
        : null,
      date_updated: new Date(),
      date_parsed: new Date(),
    };

    return result;
  }, priority);
}

/** All IPC channel names this extension handles */
export const extendrChannels = Object.freeze({
  PARSE_ARTICLE: 'afda:parse-article',
});
