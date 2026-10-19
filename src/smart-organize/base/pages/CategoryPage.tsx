/**
 * A custom React Sub Page
 * This component displays a list of categories , the contents of the page primarily depend on the type of category list chosen
 *
 * @returns JSX.Element - The rendered component displaying a category page.
 */
import CategoryTagPage from '@/downlodr/pages/CategoryTagPage';
import useDownloadStore from '@/downlodr/store/downloadStore';
import {
  mapArticleToSearchable,
  matchesTypeFilters,
  useTaskbarDownloadStore,
} from '@/downlodr/store/taskbarDownloadStore';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import React, { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';

const CategoryPage: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const downloading = useDownloadStore((state) => state.downloading);
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );
  const forDownloads = useDownloadStore((state) => state.forDownloads);
  const queuedDownloads = useDownloadStore((state) => state.queuedDownloads);
  const articleDownloads = useArticleDownloadStore((s) => s.articleDownloads);
  const activeTypeFilters = useTaskbarDownloadStore((s) => s.activeTypeFilters);
  const clearTypeFilters = useTaskbarDownloadStore((s) => s.clearTypeFilters);

  // The chips live in a shared store; reset them when switching pages rather
  // than inheriting whatever the previous view had selected.
  useEffect(() => {
    clearTypeFilters();
  }, [categoryId, clearTypeFilters]);

  const downloads = useMemo(() => {
    const allDownloads = [
      ...downloading,
      ...finishedDownloads,
      ...forDownloads,
      ...queuedDownloads,
    ];

    // mapArticleToSearchable carries `type: 'article'`, which CategoryTagPage
    // needs to render these as article rows instead of video rows.
    const articlesMapped = articleDownloads.map(mapArticleToSearchable);

    const combined = [...allDownloads, ...articlesMapped].filter((download) =>
      matchesTypeFilters(download, activeTypeFilters),
    );

    if (categoryId === 'all') {
      return combined;
    }

    if (categoryId === 'uncategorized') {
      return combined.filter(
        (download) => !download.category || download.category.length === 0,
      );
    }

    return combined.filter(
      (download) =>
        download.category?.includes(decodeURIComponent(categoryId || '')),
    );
  }, [
    categoryId,
    activeTypeFilters,
    downloading,
    finishedDownloads,
    forDownloads,
    queuedDownloads,
    articleDownloads,
  ]);

  return (
    <div className="w-full h-full">
      <CategoryTagPage downloads={downloads} categoryId={categoryId} />
    </div>
  );
};

export default CategoryPage;
