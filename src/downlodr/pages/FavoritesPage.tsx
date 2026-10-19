/**
 * Favorites view. Mirrors CategoryPage/TagPage: filters the live download
 * lists (video + article) by the `favorited` flag and renders the same
 * CategoryTagPage table — so favorites get the same status column, live
 * record/stop control, pause/stop, context menu, etc. as every other view.
 * Favorites is no longer a separate persisted snapshot; a favorited item
 * disappears from this list exactly when the underlying download is deleted.
 *
 * Favorited subscriptions (Skedulosa channels, AFDA websites) are listed above
 * the downloads as the same collapsed group rows the Status page uses. A
 * favorite whose subscription no longer exists is simply not shown.
 *
 * The Toolbar's type chips filter this page the same way they filter the
 * Status page: articles (incl. AFDA website groups), subscriptions (Skedulosa
 * groups and their videos), and plain videos.
 */
import CategoryTagPage, {
  type SubscriptionGroupRow,
} from '@/downlodr/pages/CategoryTagPage';
import useDownloadStore from '@/downlodr/store/downloadStore';
import { useFavoriteSubscriptionsStore } from '@/downlodr/store/favoriteSubscriptionsStore';
import {
  mapArticleToSearchable,
  matchesTypeFilters,
  useTaskbarDownloadStore,
} from '@/downlodr/store/taskbarDownloadStore';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import React, { useEffect, useMemo } from 'react';

const FavoritesPage: React.FC = () => {
  const downloading = useDownloadStore((state) => state.downloading);
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );
  const forDownloads = useDownloadStore((state) => state.forDownloads);
  const queuedDownloads = useDownloadStore((state) => state.queuedDownloads);
  const articleDownloads = useArticleDownloadStore((s) => s.articleDownloads);
  const activeTypeFilters = useTaskbarDownloadStore((s) => s.activeTypeFilters);
  const clearTypeFilters = useTaskbarDownloadStore((s) => s.clearTypeFilters);

  // The chips live in a shared store; don't inherit whatever the Status page
  // had selected when navigating here.
  useEffect(() => {
    clearTypeFilters();
  }, [clearTypeFilters]);

  const downloads = useMemo(() => {
    const allDownloads = [
      ...downloading,
      ...finishedDownloads,
      ...forDownloads,
      ...queuedDownloads,
    ];

    // Carries `type: 'article'`, which the row's favorite toggle and the type
    // filter both rely on to tell articles apart from videos.
    const articlesMapped = articleDownloads.map(mapArticleToSearchable);

    const combined = [...allDownloads, ...articlesMapped];
    return combined.filter(
      (download) =>
        download.favorited && matchesTypeFilters(download, activeTypeFilters),
    );
  }, [
    activeTypeFilters,
    downloading,
    finishedDownloads,
    forDownloads,
    queuedDownloads,
    articleDownloads,
  ]);

  const favoriteSubscriptionKeys = useFavoriteSubscriptionsStore(
    (s) => s.favorites,
  );
  const subscriptions = useSkedulosaStore((s) => s.subscriptions);
  const websites = useAfdaWebsitesStore((s) => s.websites);

  const subscriptionGroups = useMemo(() => {
    const coreDownloads = [
      ...downloading,
      ...finishedDownloads,
      ...forDownloads,
      ...queuedDownloads,
    ];
    const groups: SubscriptionGroupRow[] = [];
    // AFDA website groups are made of articles, so on the Status page they
    // follow the Articles chip, not Subscriptions — match that here.
    const showSkedulosa =
      activeTypeFilters.size === 0 || activeTypeFilters.has('subscriptions');
    const showAfda =
      activeTypeFilters.size === 0 || activeTypeFilters.has('articles');

    for (const key of favoriteSubscriptionKeys) {
      const separator = key.indexOf(':');
      const kind = key.slice(0, separator);
      const id = key.slice(separator + 1);

      if (
        kind === 'skedulosa' &&
        showSkedulosa &&
        subscriptions.some((s) => s.id === id)
      ) {
        groups.push({
          kind,
          id,
          downloads: coreDownloads.filter((d) => d.subscriptionId === id),
        });
      } else if (
        kind === 'afda' &&
        showAfda &&
        websites.some((w) => w.id === id)
      ) {
        groups.push({
          kind,
          id,
          downloads: articleDownloads
            .filter((a) => a.subscriptionId === id)
            .map(mapArticleToSearchable),
        });
      }
    }

    return groups;
  }, [
    activeTypeFilters,
    favoriteSubscriptionKeys,
    subscriptions,
    websites,
    downloading,
    finishedDownloads,
    forDownloads,
    queuedDownloads,
    articleDownloads,
  ]);

  return (
    <div className="w-full h-full">
      <CategoryTagPage
        downloads={downloads}
        categoryId="Favorites"
        subscriptionGroups={subscriptionGroups}
      />
    </div>
  );
};

export default FavoritesPage;
