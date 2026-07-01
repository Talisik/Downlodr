/**
 * A custom React Sub Page
 * This component displays a list of tags , the contents of the page primarily depend on the type of tag list chosen
 *
 * @returns JSX.Element - The rendered component displaying a tag page.
 */
import CategoryTagPage from '@/downlodr/pages/CategoryTagPage';
import useDownloadStore from '@/downlodr/store/downloadStore';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';

const TagPage: React.FC = () => {
  // takes the type of tag from url paramaters
  const { tagId } = useParams<{ tagId: string }>();
  const downloading = useDownloadStore((state) => state.downloading);
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );
  const forDownloads = useDownloadStore((state) => state.forDownloads);
  const articleDownloads = useArticleDownloadStore((s) => s.articleDownloads);

  const downloads = useMemo(() => {
    const allDownloads = [
      ...downloading,
      ...finishedDownloads,
      ...forDownloads,
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
    }));

    const combined = [...allDownloads, ...articlesMapped];

    if (tagId === 'all') {
      return combined;
    }

    if (tagId === 'untagged') {
      return combined.filter(
        (download) => !download.tags || download.tags.length === 0,
      );
    }

    return combined.filter(
      (download) => download.tags?.includes(decodeURIComponent(tagId || '')),
    );
  }, [tagId, downloading, finishedDownloads, forDownloads, articleDownloads]);

  return (
    <div className="w-full h-full">
      <CategoryTagPage downloads={downloads} />
    </div>
  );
};

export default TagPage;
