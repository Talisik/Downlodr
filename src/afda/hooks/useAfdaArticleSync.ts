import { useEffect, useRef } from 'react';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import type { AfdaArticleInput } from '@/afda/store/articleDownloadStore';
import { initialScrapeGuard } from './initialScrapeGuard';

/**
 * Global listener for scrapeArticleSaved events from the afda bridge.
 * Writes new articles into articleDownloadStore (the permanent source of truth)
 * so they appear in AfdaTableGroup regardless of which page is mounted.
 *
 * Articles are collected in a 150 ms window then flushed as a single batch
 * to avoid N separate Zustand set() calls (and N React re-renders) when the
 * scraper emits many events in quick succession.
 *
 * The bridge is the informant; this hook persists the data.
 * Call this once in App.tsx alongside useAfdaWebsitesInit.
 */
export function useAfdaArticleSync() {
  // Keep a ref so the bridge listener always sees the latest websites
  // without needing to re-subscribe on every website change.
  const websitesRef = useRef(useAfdaWebsitesStore.getState().websites);

  useEffect(() => {
    const unsub = useAfdaWebsitesStore.subscribe((state) => {
      websitesRef.current = state.websites;
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const bridge =
      typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
    if (!bridge) return;

    const pendingBatch: AfdaArticleInput[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      flushTimer = null;
      if (pendingBatch.length === 0) return;
      const batch = pendingBatch.splice(0);
      useArticleDownloadStore.getState().addAfdaArticlesBatch(batch);
    };

    const unsub = bridge.on.scrapeArticleSaved(
      async (data: {
        job_id: number;
        article_id: number;
        section_id: number;
        url: string;
      }) => {
        if (initialScrapeGuard.has(data.section_id)) return;

        const website = websitesRef.current.find((w) =>
          w.sections.some((s) => parseInt(s.id) === data.section_id),
        );
        if (!website) return;

        try {
          const article = await bridge.articles.get({
            article_id: data.article_id,
          });
          if (!article) return;

          pendingBatch.push({
            id: `afda-article-${data.article_id}`,
            title: article.title ?? data.url,
            url: data.url,
            subscriptionId: website.id,
            dateAdded: new Date().toISOString(),
            thumbnailDataUrl: article.heroImage ?? null,
            sectionId: String(data.section_id),
            publishedAt: article.published_at ?? null,
          });

          // Reset the flush timer so the batch grows for 150 ms of silence
          if (flushTimer !== null) clearTimeout(flushTimer);
          flushTimer = setTimeout(flush, 150);
        } catch {
          // article still visible in AfdaDownloads via bridge
        }
      },
    );

    return () => {
      unsub?.();
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        // Flush any pending articles on unmount so nothing is lost
        flush();
      }
    };
  }, []); // registered once — websitesRef always has the latest
}
