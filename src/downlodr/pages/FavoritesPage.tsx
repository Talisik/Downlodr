/**
 * Favorites view. Mirrors CategoryPage/TagPage: filters the live download
 * lists (video + article) by the `favorited` flag and renders the same
 * CategoryTagPage table — so favorites get the same status column, live
 * record/stop control, pause/stop, context menu, etc. as every other view.
 * Favorites is no longer a separate persisted snapshot; a favorited item
 * disappears from this list exactly when the underlying download is deleted.
 */
import CategoryTagPage from '@/downlodr/pages/CategoryTagPage';
import useDownloadStore from '@/downlodr/store/downloadStore';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import React, { useMemo } from 'react';

const FavoritesPage: React.FC = () => {
  const downloading = useDownloadStore((state) => state.downloading);
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );
  const forDownloads = useDownloadStore((state) => state.forDownloads);
  const queuedDownloads = useDownloadStore((state) => state.queuedDownloads);
  const articleDownloads = useArticleDownloadStore((s) => s.articleDownloads);

  const downloads = useMemo(() => {
    const allDownloads = [
      ...downloading,
      ...finishedDownloads,
      ...forDownloads,
      ...queuedDownloads,
    ];

    const articlesMapped = articleDownloads.map((a) => ({
      id: a.id,
      videoUrl: a.url,
      name: a.title || a.url,
      downloadName: a.title || a.url,
      displayName: a.title || undefined,
      channelName: '',
      size: a.fileSize ?? 0,
      speed: '',
      timeLeft: '',
      DateAdded: a.dateAdded,
      progress: a.status === 'finished' ? 100 : a.status === 'failed' ? 0 : 50,
      location: a.filePath ?? '',
      status: a.status === 'loading' ? 'downloading' : a.status,
      ext: a.format ?? 'docx',
      tags: a.tags ?? [],
      category: a.category ?? [],
      extractorKey: 'Article',
      formatId: '',
      audioExt: '',
      audioFormatId: '',
      isLive: false as const,
      automaticCaption: null,
      thumbnails: null,
      favorited: a.favorited ?? false,
    }));

    const combined = [...allDownloads, ...articlesMapped];
    return combined.filter((download) => download.favorited);
  }, [
    downloading,
    finishedDownloads,
    forDownloads,
    queuedDownloads,
    articleDownloads,
  ]);

  return (
    <div className="w-full h-full">
      <CategoryTagPage downloads={downloads} categoryId="Favorites" />
    </div>
  );
};

export default FavoritesPage;
