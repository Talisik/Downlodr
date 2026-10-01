/**
 * Turns the raw error text an article download fails with into a stable code
 * plus a message a user can act on. The raw text is still kept on the row
 * (`errorMessage`) and shown as the details line, so nothing is lost for bug
 * reports.
 *
 * The raw strings come from several places, which is why this matches on text
 * rather than on a code:
 * - the AFDA backend's `manual_articles:parse` handler (afda-backend
 *   ipc-handlers.ts / scrape-engine.ts validateHtml): "Invalid URL",
 *   "Failed to fetch the page", `Error page detected: "404" in title`,
 *   "HTML too short (…)"
 * - the renderer pipelines (downloadArticle.ts, articleDocxGenerator.ts):
 *   "Bridge unavailable", "Article not found", "Post not found",
 *   "PDF generation failed"
 * - Electron IPC and Node fs errors bubbling up: "No handler registered for …",
 *   EACCES, ENOSPC, …
 *
 * Note the backend drops the HTTP status of a failed fetch, so a hard 404 only
 * shows up here when the error page's title/body says so. Otherwise it arrives
 * as the generic "Failed to fetch the page".
 */

export type ArticleErrorCode =
  | 'INVALID_URL'
  | 'NOT_FOUND'
  | 'GONE'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'BOT_PROTECTION'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'DNS_FAILED'
  | 'CONNECTION_FAILED'
  | 'FETCH_FAILED'
  | 'EMPTY_PAGE'
  | 'NOT_AN_ARTICLE'
  | 'SERVICE_NOT_READY'
  | 'MISSING_IN_DATABASE'
  | 'PDF_FAILED'
  | 'NO_PERMISSION'
  | 'DISK_FULL'
  | 'FILE_IN_USE'
  | 'FOLDER_MISSING'
  | 'SAVE_FAILED'
  | 'UNKNOWN';

export interface ArticleErrorInfo {
  code: ArticleErrorCode;
  /** Short, user-facing summary. */
  title: string;
  /** What the user can do about it. */
  hint: string;
}

interface ErrorRule extends ArticleErrorInfo {
  match: RegExp;
}

// First match wins, so the specific rules sit above the generic ones (e.g. a
// 404 error page must win over the catch-all "Failed to fetch").
const RULES: ErrorRule[] = [
  {
    code: 'INVALID_URL',
    match:
      /invalid url|must start with http|bad_url|invalid social post reference/i,
    title: 'Invalid link',
    hint: 'The link is not a valid web address. Check that it starts with http:// or https://.',
  },
  // Above the status-code rules: its message carries a character count
  // ("HTML too short (404 chars…") that would otherwise read as a status.
  {
    code: 'EMPTY_PAGE',
    match: /html too short|no content/i,
    title: 'Page is empty',
    hint: 'The site returned almost nothing. The page may load its content with scripts, or the link may be wrong.',
  },
  {
    code: 'NOT_FOUND',
    match: /\b404\b|page not found|"not found"|status code 404/i,
    title: 'Article not found (404)',
    hint: 'The link does not point to a valid article. It may have been moved or deleted, or the URL is mistyped.',
  },
  {
    code: 'GONE',
    match: /\b410\b/,
    title: 'Article removed (410)',
    hint: 'The site has permanently removed this article.',
  },
  {
    code: 'UNAUTHORIZED',
    match: /\b401\b|unauthori[sz]ed|login required|paywall/i,
    title: 'Login required (401)',
    hint: 'This article is behind a login or paywall. Set up website login for this site in AFDA, then retry.',
  },
  {
    code: 'BOT_PROTECTION',
    match:
      /captcha|are you a robot|verify you are human|just a moment|cloudflare/i,
    title: 'Blocked by bot protection',
    hint: 'The site showed a CAPTCHA or bot check instead of the article. Try again later, or open it in your browser first.',
  },
  {
    code: 'FORBIDDEN',
    match: /\b403\b|forbidden|access denied/i,
    title: 'Access denied (403)',
    hint: 'The site refused to serve this page. It may block automated downloads or be restricted in your region.',
  },
  {
    code: 'RATE_LIMITED',
    match: /\b429\b|too many requests|rate.?limit/i,
    title: 'Too many requests (429)',
    hint: 'The site is limiting requests. Wait a few minutes before retrying.',
  },
  {
    code: 'SERVER_ERROR',
    match:
      /\b50[0-4]\b|internal server|service unavailable|temporarily unavailable|bad gateway/i,
    title: 'Website error (5xx)',
    hint: "The website is having problems on its end. It's not an issue with Downlodr — try again later.",
  },
  {
    code: 'TIMEOUT',
    match: /timed? ?out|etimedout|timeout/i,
    title: 'Timed out',
    hint: 'The site took too long to respond. Check your connection and retry.',
  },
  {
    code: 'DNS_FAILED',
    match: /enotfound|eai_again|getaddrinfo|err_name_not_resolved/i,
    title: 'Website not reachable',
    hint: "The site's address could not be found. Check the link and your internet connection.",
  },
  {
    code: 'CONNECTION_FAILED',
    match:
      /econnrefused|econnreset|enetunreach|socket hang up|network error|err_internet_disconnected|err_connection/i,
    title: 'Connection failed',
    hint: 'Could not connect to the site. Check your internet connection and retry.',
  },
  {
    code: 'NOT_AN_ARTICLE',
    match: /error page detected|invalid page|not an article/i,
    title: 'Not an article page',
    hint: 'The link opened an error or non-article page. Make sure it points to a specific article.',
  },
  {
    code: 'FETCH_FAILED',
    match: /failed to fetch/i,
    title: 'Could not load the page',
    hint: 'The page could not be downloaded. The link may be broken (e.g. 404), the site may be down, or it blocks downloads.',
  },
  {
    code: 'SERVICE_NOT_READY',
    match:
      /bridge unavailable|no handler registered|afda parse bridge failed|unexpected afda parse response/i,
    title: 'Article service not ready',
    hint: 'The AFDA service is still starting or has stopped. Wait a moment and retry; restart Downlodr if it persists.',
  },
  {
    code: 'MISSING_IN_DATABASE',
    match: /article not found|post not found/i,
    title: 'Article no longer available',
    hint: 'This article was removed from the AFDA database (e.g. its website was deleted or re-scraped). Re-scrape the site and try again.',
  },
  {
    code: 'PDF_FAILED',
    match: /pdf generation failed|htmltopdf|printtopdf/i,
    title: 'Could not create the PDF',
    hint: 'PDF generation failed for this article. Switch the format to DOCX and retry.',
  },
  {
    code: 'NO_PERMISSION',
    match: /eacces|eperm|permission denied|operation not permitted/i,
    title: 'No permission to save',
    hint: 'Downlodr cannot write to the download folder. Choose a different folder in Settings.',
  },
  {
    code: 'DISK_FULL',
    match: /enospc|no space left/i,
    title: 'Disk is full',
    hint: 'Free up some disk space, then retry.',
  },
  {
    code: 'FILE_IN_USE',
    match: /ebusy|resource busy|\blocked\b/i,
    title: 'File is in use',
    hint: 'A file with this name is open in another program. Close it and retry.',
  },
  {
    code: 'FOLDER_MISSING',
    match: /enoent|no such file or directory/i,
    title: 'Download folder not found',
    hint: 'The download folder no longer exists. Pick a folder in Settings and retry.',
  },
  {
    code: 'SAVE_FAILED',
    match: /failed to save file/i,
    title: 'Could not save the file',
    hint: 'The article was fetched but could not be written to disk. Check the download folder and retry.',
  },
];

const UNKNOWN: ArticleErrorInfo = {
  code: 'UNKNOWN',
  title: 'Download failed',
  hint: 'An unexpected error occurred. Copy the log from this panel if you need to report it.',
};

export const mapArticleError = (
  raw: string | null | undefined,
): ArticleErrorInfo => {
  if (!raw) return UNKNOWN;
  const rule = RULES.find((r) => r.match.test(raw));
  if (!rule) return UNKNOWN;
  const { code, title, hint } = rule;
  return { code, title, hint };
};
