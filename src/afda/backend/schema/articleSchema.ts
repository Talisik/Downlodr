/**
 * Schema types for AFDA article data returned by the parser microservice.
 *
 * Source: resources/parser_ts/src/models/articleModel.ts
 */

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

export interface ArticleAuthor {
  name: string;
  url?: string | null;
}

export interface ArticleSection {
  heading?: string | null;
  content: string;
}

export interface ArticleMedia {
  url: string;
  alt?: string | null;
  caption?: string | null;
}

// ---------------------------------------------------------------------------
// Parser status values
// ---------------------------------------------------------------------------

/** "Done" = publish date confirmed; "Done 2" = publish date uncertain */
export type ArticleStatus = 'Done' | 'Done 2' | string;

// ---------------------------------------------------------------------------
// Full article model (success path)
// ---------------------------------------------------------------------------

export interface ArticleModel {
  article_title: string | null;
  article_publish_date: Date | null;
  article_authors: ArticleAuthor[];
  article_sections: ArticleSection[];
  article_content: string | null;
  article_videos: ArticleMedia[];
  article_images: ArticleMedia[];
  article_status: ArticleStatus;
  article_error_status: string | null;
  is_published_date_correct: boolean;
  updated_by: string;      // "Parser Microservice"
  date_updated: Date;
  date_parsed: Date;
  raw_html: string | null;
}

// ---------------------------------------------------------------------------
// Slim error model (error path)
// ---------------------------------------------------------------------------

export interface ArticleErrorModel {
  article_status: string;
  article_error_status: string | null;
  updated_by: string;
  date_updated: Date;
  date_parsed: Date;
}

// ---------------------------------------------------------------------------
// Union — what the parser actually returns
// ---------------------------------------------------------------------------

export type ParserResult = ArticleModel | ArticleErrorModel;

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

export function isArticleModel(result: ParserResult): result is ArticleModel {
  return 'article_title' in result;
}
