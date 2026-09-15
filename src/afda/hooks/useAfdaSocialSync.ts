import { useEffect, useRef } from 'react';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import type { AfdaArticleInput } from '@/afda/store/articleDownloadStore';

/**
 * Social posts have no push "saved" event from the bridge (unlike website
 * articles, which arrive via scrapeArticleSaved). Instead we poll
 * social.posts.list for every tracked social source and mirror the posts into
 * articleDownloadStore — the same store that backs the Downloads-list SUB card.
 *
 * This makes a social profile (X / Reddit / Facebook / YouTube) render an
 * identical "N posts" SUB card and per-post rows as an article website, reusing
 * the existing grouping / routing / download pipeline. Posts are keyed with a
 * `social-post-<id>` prefix so the download path can tell them apart from
 * `afda-article-<id>` rows.
 *
 * Call this once in App.tsx alongside useAfdaArticleSync.
 */

const POLL_INTERVAL_MS = 60_000;
const POSTS_PER_SOURCE = 50;

interface SocialPostRow {
  id: number;
  url: string;
  author: string | null;
  content: string | null;
  image_url: string | null;
  published_at: string | null;
}

/** Build a stable title from a post's content, falling back to author/url. */
function postTitle(post: SocialPostRow): string {
  const text = (post.content ?? '').trim();
  if (text) return text.length > 100 ? `${text.slice(0, 100)}…` : text;
  return post.author ?? post.url;
}

/** Comma-joined social ids, used to detect when the set of sources changes. */
function socialSourceKey(websites: { kind?: string; socialId?: number }[]): string {
  return websites
    .filter((w) => w.kind === 'social' && w.socialId != null)
    .map((w) => w.socialId)
    .sort((a, b) => (a as number) - (b as number))
    .join(',');
}

/**
 * Fetch every post for one social source and mirror them into
 * articleDownloadStore (deduped by id). Returns the number of posts pushed.
 *
 * Exported so callers that already know a source just got fresh posts — e.g.
 * the subscribe flow right after `scrapeNow` resolves — can land them
 * immediately instead of waiting for the 60s poll.
 */
export async function syncSocialSource(
  socialId: number,
  subscriptionId: string,
): Promise<number> {
  const bridge =
    typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
  if (!bridge?.social?.posts?.list) return 0;

  const res = await bridge.social.posts.list({
    id: socialId,
    limit: POSTS_PER_SOURCE,
    offset: 0,
  });
  const posts: SocialPostRow[] = Array.isArray(res?.posts) ? res.posts : [];
  if (posts.length === 0) return 0;

  const batch: AfdaArticleInput[] = posts.map((post) => ({
    id: `social-post-${post.id}`,
    title: postTitle(post),
    url: post.url,
    subscriptionId,
    dateAdded: post.published_at ?? new Date().toISOString(),
    thumbnailDataUrl: post.image_url ?? null,
    publishedAt: post.published_at ?? null,
  }));

  useArticleDownloadStore.getState().addAfdaArticlesBatch(batch);
  return batch.length;
}

export function useAfdaSocialSync() {
  // Keep a ref so the poll always sees the latest social sources without
  // re-subscribing the interval on every website change.
  const websitesRef = useRef(useAfdaWebsitesStore.getState().websites);

  useEffect(() => {
    const bridge =
      typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
    if (!bridge?.social?.posts?.list) return;

    let cancelled = false;

    const syncOnce = async () => {
      const socialSources = websitesRef.current.filter(
        (w) => w.kind === 'social' && w.socialId != null,
      );
      if (socialSources.length === 0) return;

      for (const source of socialSources) {
        if (cancelled) return;
        try {
          await syncSocialSource(source.socialId as number, source.id);
        } catch (err) {
          console.error(
            `[afda] social posts sync failed for source ${source.socialId}:`,
            err,
          );
        }
      }
    };

    // Re-sync whenever the set of social sources changes (e.g. once
    // useAfdaWebsitesInit finishes hydrating them, or a source is added), so
    // posts land immediately rather than waiting for the next poll tick.
    let lastKey = socialSourceKey(websitesRef.current);
    const unsub = useAfdaWebsitesStore.subscribe((state) => {
      websitesRef.current = state.websites;
      const key = socialSourceKey(state.websites);
      if (key !== lastKey) {
        lastKey = key;
        syncOnce();
      }
    });

    syncOnce();
    const timer = setInterval(syncOnce, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      unsub();
    };
  }, []); // registered once — websitesRef always has the latest
}
