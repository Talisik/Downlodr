/**
 * Map the toolkit's channel metadata onto the shape the renderer store keeps.
 *
 * `toolkit:channel:fetchDetails` resolves `fetchChannelDetails`
 * (skedulosa/backend/.../workers/scraper-worker/scrape.ts), whose contract is
 *
 *   { channelName, avatarUrl, subscriberCount, videoCount, site }
 *
 * The bridge's subscribe route used to read `thumbnailUrl`/`name` — keys that
 * function never emits — so every chat-created subscription was pushed to the
 * renderer with an empty avatar and rendered without a thumbnail. The Subscribe
 * modal reads the same call's real keys, which is why only the chat path broke.
 */

/** What `toolkit:channel:fetchDetails` can resolve to, error branch included. */
export interface ToolkitChannelDetails {
  channelName?: string;
  avatarUrl?: string | null;
  subscriberCount?: number | null;
  videoCount?: string | number | null;
  site?: string;
  error?: string;
}

/** The `channel_details` shape the skedulosa store persists per subscription. */
export interface SubscriptionChannelDetails {
  avatarUrl: string;
  subscriberCount: number;
  videoCount: string;
  site: string;
}

export function toChannelDetails(
  details: ToolkitChannelDetails | null | undefined,
): SubscriptionChannelDetails | null {
  if (!details || details.error) return null;
  return {
    avatarUrl: details.avatarUrl ?? '',
    subscriberCount: details.subscriberCount ?? 0,
    videoCount: details.videoCount != null ? String(details.videoCount) : '',
    site: details.site ?? 'youtube',
  };
}
