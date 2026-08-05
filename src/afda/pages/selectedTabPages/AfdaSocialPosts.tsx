import { useCallback, useEffect, useState } from 'react';
import { formatWordDate } from '@/afda/pages/utils/afdaUtils';
import { LuCopy, LuDot, LuRefreshCw } from 'react-icons/lu';
import { IoPersonCircleSharp } from 'react-icons/io5';
import type { WebsiteListItem } from '@/afda/store/afdaWebsitesStore';

interface SocialPostRow {
  id: number;
  url: string;
  author: string | null;
  content: string | null;
  image_url: string | null;
  images: string[];
  video_url: string | null;
  post_type: string | null;
  shared: boolean;
  platform: string | null;
  published_at: string | null;
}

interface AfdaSocialPostsProps {
  website: WebsiteListItem;
}

/**
 * Backend dedup is keyed on exact `url` string (see storage.ts UNIQUE
 * constraint), but some platforms (e.g. Facebook share links vs canonical
 * permalinks) can produce different urls for what is really the same post.
 * Collapse those here by author+content so the list never shows the same
 * post twice — first occurrence wins since posts already arrive newest-first.
 */
function dedupePosts(posts: SocialPostRow[]): SocialPostRow[] {
  const seen = new Set<string>();
  const result: SocialPostRow[] = [];
  for (const post of posts) {
    const content = (post.content ?? '').trim();
    // Posts with no text (image/video-only) aren't safely comparable by
    // content alone, so fall back to url — only text posts get collapsed.
    const key = content
      ? `${post.author ?? ''}|${content}`
      : `url|${post.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(post);
  }
  return result;
}

/**
 * Posts list for a social source (X / Reddit / Facebook / YouTube). Mirrors the
 * AfdaDownloads layout (list + preview) but reads from social.posts.list rather
 * than the article download store, since social posts live in their own table.
 */
const AfdaSocialPosts = ({ website }: AfdaSocialPostsProps) => {
  const [posts, setPosts] = useState<SocialPostRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<SocialPostRow | null>(null);

  const sourceId = website.socialId;

  const load = useCallback(async () => {
    const bridge =
      typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
    if (!bridge?.social || sourceId == null) return;
    setLoading(true);
    try {
      const res = await bridge.social.posts.list({
        id: sourceId,
        limit: 50,
        offset: 0,
      });
      setPosts(dedupePosts(Array.isArray(res?.posts) ? res.posts : []));
    } catch (err) {
      console.error('[afda] load social posts failed:', err);
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    const bridge =
      typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
    if (!bridge?.social || sourceId == null || refreshing) return;
    setRefreshing(true);
    try {
      await bridge.social.sources.scrapeNow({ id: sourceId });
      await load();
    } catch (err) {
      console.error('[afda] social scrape-now failed:', err);
    } finally {
      setRefreshing(false);
    }
  }, [sourceId, refreshing, load]);

  return (
    <div className="flex flex-row h-full overflow-hidden">
      {/* ── Posts list ── */}
      <div className="w-[260px] min-w-[200px] 1xl:w-1/3 1xl:max-w-[340px] overflow-y-auto flex-shrink-0 border-r-2 dark:border-darkModeTableBorder">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-[12px] text-[#808080]">
            {posts.length} post{posts.length !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            title="Scrape now"
            disabled={refreshing}
            onClick={handleRefresh}
            className="disabled:opacity-40"
          >
            {refreshing ? (
              <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <LuRefreshCw size={15} />
            )}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500 text-sm">
            Loading posts…
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center text-gray-400 dark:text-gray-500 text-sm">
            <p>No posts scraped yet.</p>
            <p className="text-[11px]">
              Try “Scrape now”. Some platforms (e.g. Facebook) need a login
              account set on this source.
            </p>
          </div>
        ) : (
          posts.map((post) => {
            const isActive = selected?.id === post.id;
            const preview =
              (post.content ?? '').slice(0, 120) || '(no text)';
            return (
              <button
                key={post.id}
                type="button"
                onClick={() => setSelected(post)}
                className={`w-full text-left px-3 py-3 transition-colors ${
                  isActive
                    ? 'bg-[#F3F3F3] dark:bg-darkModeTable'
                    : 'hover:bg-gray-50 dark:hover:bg-zinc-700'
                }`}
              >
                <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
                  {preview}
                </div>
                <div className="flex gap-2 mt-1.5 text-[11px] text-gray-400 dark:text-gray-300">
                  <span>{post.author ?? '—'}</span>
                  {post.published_at && (
                    <>
                      <LuDot />
                      <span>{formatWordDate(post.published_at)}</span>
                    </>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* ── Post preview ── */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="flex flex-col gap-3 py-4 px-8">
            <div className="flex flex-row items-center gap-1.5">
              <IoPersonCircleSharp className="text-[#808080]" size={18} />
              <p className="text-[12px] text-[#808080] dark:text-gray-400">
                {selected.author ?? '—'}
              </p>
              {selected.published_at && (
                <>
                  <LuDot className="text-[#808080]" />
                  <p className="text-[11.5px] text-[#808080] dark:text-gray-500">
                    {formatWordDate(selected.published_at)}
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(selected.url)}
                title="Copy link"
                className="text-[#808080] hover:text-[#474747] dark:hover:text-gray-200 ml-1"
              >
                <LuCopy size={13} />
              </button>
            </div>

            {selected.image_url && (
              <img
                src={selected.image_url}
                alt=""
                className="max-h-72 w-auto rounded-md object-contain"
              />
            )}

            <p className="text-[13.5px] text-[#5B5B5B] dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {selected.content ?? '(no text)'}
            </p>

            <a
              href={selected.url}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-primary hover:underline"
            >
              Open original post ↗
            </a>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
            Select a post to preview.
          </div>
        )}
      </div>
    </div>
  );
};

export default AfdaSocialPosts;
