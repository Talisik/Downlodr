import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import i18n from '@/core-app/i18n';

/**
 * Helpers for YouTube channels that only post Shorts. Their Videos tab is
 * missing or empty, so the channel lookup (…/videos) finds nothing, and
 * Shorts-only subscriptions aren't supported.
 */

/**
 * True when a channel-lookup error means "no Videos tab". Matches yt-dlp's
 * own wording and the messages the Skedulosa add-on raises for it.
 */
export function isNoVideosTabError(text: string): boolean {
  return /no videos tab|does not have a videos tab|no channel data/i.test(text);
}

/** Tells the user the channel only posts Shorts, which isn't supported. */
export function notifyShortsOnlyChannel(): void {
  const t = (key: string) => i18n.t(key, { ns: 'skedulosa' });
  toast({
    title: t('subscribeModal.shortsOnly.title'),
    description: t('subscribeModal.shortsOnly.description'),
    duration: 8000,
  });
}
