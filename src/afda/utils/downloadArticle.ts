/**
 * Saves a `for_download` article to the download folder as DOCX or PDF and
 * records the result on its store entry. Shared by every table that shows
 * articles (Status page, tag/category/favorites pages).
 */
import {
  fetchArticle,
  isArticleModel,
} from '@/afda/backend/dummy/dummyArticleService';
import type { ArticleModel } from '@/afda/backend/schema/articleSchema';
import {
  useArticleDownloadStore,
  type ArticleLogLevel,
} from '@/afda/store/articleDownloadStore';
import { mapArticleError } from '@/afda/utils/articleErrorMap';
import {
  generateArticleDocx,
  generateArticleHtml,
  normalizeArticleRow,
  sanitizeFilename,
} from '@/afda/utils/articleDocxGenerator';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useSettingStore } from '@/core-app/store/settingsStore';

/**
 * Where a standalone article download lands: the download location chosen in
 * Settings, same as video downloads. `getDownloadFolder()` is only the OS
 * Downloads folder (it seeds that setting on first run), so it is just the
 * fallback for when the setting is still empty.
 */
export const resolveArticleDownloadFolder = async (): Promise<string> =>
  useSettingStore.getState().settings.defaultLocation?.trim() ||
  (await window.downlodrFunctions.getDownloadFolder());

// Paths picked but not yet written. Two downloads of the same article (or of
// two articles whose titles truncate to the same filename) can both pass the
// exists check before either file lands, so a pick also has to skip these.
const reservedPaths = new Set<string>();

/**
 * Writes an article file without overwriting an existing one: "name.docx",
 * then "name (1).docx", "name (2).docx", … Returns the path actually written.
 */
export const saveArticleFile = async (
  folder: string,
  filename: string,
  ext: string,
  buffer: number[],
): Promise<string> => {
  let filePath = '';
  for (let n = 0; ; n++) {
    const name = n === 0 ? filename : `${filename} (${n})`;
    filePath = await window.downlodrFunctions.joinDownloadPath(
      folder,
      `${name}.${ext}`,
    );
    if (reservedPaths.has(filePath)) continue;
    // Reserve before the exists check: it awaits, and a concurrent save that
    // checks in the meantime must already see this path as taken.
    reservedPaths.add(filePath);
    if (!(await window.downlodrFunctions.fileExists(filePath))) break;
    reservedPaths.delete(filePath);
  }
  try {
    const saveResult = await window.downlodrFunctions.saveBufferToFile(
      buffer,
      filePath,
    );
    if (!saveResult.success)
      throw new Error(saveResult.error ?? 'Failed to save file');
    return filePath;
  } finally {
    reservedPaths.delete(filePath);
  }
};

/** Appends a line to an article's log panel. */
export const logArticleStep = (
  articleId: string,
  message: string,
  level: ArticleLogLevel = 'info',
): void => {
  useArticleDownloadStore
    .getState()
    .appendArticleLog(articleId, level, message);
};

/**
 * Logs what the parser/database handed back, plus warnings for the gaps that
 * make a saved file look wrong (no title, no body, unsure publish date).
 */
export const logArticleFetched = (
  articleId: string,
  model: ArticleModel,
): void => {
  const sections = model.article_sections?.length ?? 0;
  const images = model.article_images?.length ?? 0;
  const authors = (model.article_authors ?? []).map((a) => a.name).join(', ');
  logArticleStep(
    articleId,
    `Fetched "${model.article_title ?? '(untitled)'}" — ${sections} section${
      sections === 1 ? '' : 's'
    }, ${images} image${images === 1 ? '' : 's'}${
      authors ? `, by ${authors}` : ''
    } (parser status: ${model.article_status})`,
  );
  if (!model.article_title)
    logArticleStep(
      articleId,
      'WARNING: No title found; file will be named "article"',
      'warn',
    );
  if (!model.article_content?.trim() && sections === 0)
    logArticleStep(articleId, 'WARNING: No article body was extracted', 'warn');
  if (!model.article_publish_date)
    logArticleStep(articleId, 'WARNING: No publish date found', 'warn');
  else if (
    !model.is_published_date_correct ||
    model.article_status === 'Done 2'
  )
    logArticleStep(
      articleId,
      'WARNING: Publish date could not be confirmed',
      'warn',
    );
};

/**
 * Marks an article download as failed and tells the user why. `failed` is the
 * status the row's ✕ tooltip and the context menu's Retry option key off —
 * resetting to `for_download` instead would swallow the error silently.
 */
export const failArticleDownload = (articleId: string, err: unknown): void => {
  const { articleDownloads, updateArticleDownload } =
    useArticleDownloadStore.getState();
  const message = err instanceof Error ? err.message : 'Download failed';
  updateArticleDownload(articleId, { status: 'failed', errorMessage: message });

  const article = articleDownloads.find((a) => a.id === articleId);
  const info = mapArticleError(message);
  const summary = `${info.title}. ${info.hint}`;
  toast({
    variant: 'destructive',
    title: 'Article download failed',
    description: article?.title
      ? `${article.title}: ${summary}`
      : article?.url
      ? `${article.url}: ${summary}`
      : summary,
    duration: 5000,
  });
};

export const downloadArticle = async (articleId: string): Promise<void> => {
  const { articleDownloads, updateArticleDownload } =
    useArticleDownloadStore.getState();
  const d = articleDownloads.find((a) => a.id === articleId);
  if (!d || d.status !== 'for_download') return;
  updateArticleDownload(d.id, { status: 'loading' });
  try {
    let articleModel;
    const numericId = parseInt(d.id.replace('afda-article-', ''), 10);
    const isSubscriptionArticle =
      !isNaN(numericId) && d.id.startsWith('afda-article-');
    if (isSubscriptionArticle) {
      const bridge = (
        window as unknown as {
          afdaBridge?: {
            articles: {
              get: (p: {
                article_id: number;
              }) => Promise<Record<string, unknown> | null>;
            };
          };
        }
      ).afdaBridge;
      if (!bridge) throw new Error('Bridge unavailable');
      const row = await bridge.articles.get({ article_id: numericId });
      if (!row) throw new Error('Article not found');
      articleModel = normalizeArticleRow(row);
    } else {
      const result = await fetchArticle(d.url);
      if (!isArticleModel(result)) {
        throw new Error(
          result.article_error_status ?? 'Failed to fetch article',
        );
      }
      articleModel = result;
    }
    logArticleFetched(d.id, articleModel);
    const currentFormat = d.format ?? 'docx';
    const downloadFolder = await resolveArticleDownloadFolder();
    const filename = sanitizeFilename(articleModel.article_title);
    logArticleStep(
      d.id,
      `Generating ${currentFormat.toUpperCase()} in ${downloadFolder}`,
    );
    let buffer: number[];
    let ext: string;
    if (currentFormat === 'pdf') {
      const html = generateArticleHtml(articleModel);
      const pdfResult = await window.downlodrFunctions.htmlToPdf(html);
      if (!pdfResult.success || !pdfResult.data)
        throw new Error(pdfResult.error ?? 'PDF generation failed');
      buffer = pdfResult.data;
      ext = 'pdf';
    } else {
      const bytes = await generateArticleDocx(articleModel);
      buffer = Array.from(bytes);
      ext = 'docx';
    }
    const filePath = await saveArticleFile(
      downloadFolder,
      filename,
      ext,
      buffer,
    );
    const fileSize =
      (await window.downlodrFunctions.getFileSize(filePath)) ?? 0;
    updateArticleDownload(d.id, {
      status: 'finished',
      title: articleModel.article_title ?? '',
      filePath,
      fileSize,
      articleData: articleModel,
      thumbnailDataUrl:
        articleModel.article_images?.[0]?.url ?? d.thumbnailDataUrl ?? null,
    });
  } catch (err) {
    failArticleDownload(d.id, err);
  }
};
