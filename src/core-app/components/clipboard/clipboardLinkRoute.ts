import { isArticleSiteUrl } from '@/afda/utils/articleSiteDetection';
import { isYouTubeChannelUrl } from '@/core-app/utils/urlValidation';

export type ClipboardLinkRoute = 'channel' | 'article' | 'video';

/**
 * Where a link picked up from the clipboard should go — the same checks the
 * taskbar input runs before it downloads anything, so a copied article or
 * channel isn't blindly queued as a video:
 * - channel: a YouTube channel page — not downloadable as one video
 * - article: a known news/blog site — goes to the article list
 * - video:   everything else — the normal download queue
 */
export function clipboardLinkRoute(url: string): ClipboardLinkRoute {
  if (isYouTubeChannelUrl(url)) return 'channel';
  if (isArticleSiteUrl(url)) return 'article';
  return 'video';
}
