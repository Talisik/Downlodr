/**
 * A custom React Sub Page
 * This component displays a list of categories , the contents of the page primarily depend on the type of category list chosen
 *
 * @returns JSX.Element - The rendered component displaying a category page.
 */
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import useDownloadStore from '../../Store/downloadStore';
import DownloadList from '../../Components/SubComponents/custom/DownloadList';

const CategoryPage: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const downloading = useDownloadStore((state) => state.downloading);
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );
  const historyDownloads = useDownloadStore((state) => state.historyDownloads);
  const forDownloads = useDownloadStore((state) => state.forDownloads);

  const downloads = useMemo(() => {
    const allDownloads = [
      ...downloading,
      ...finishedDownloads,
      ...historyDownloads,
      ...forDownloads,
    ];

    if (categoryId === 'all') {
      return allDownloads;
    }

    if (categoryId === 'uncategorized') {
      return allDownloads.filter(
        (download) => !download.category || download.category.length === 0,
      );
    }

    return allDownloads.filter(
      (download) =>
        download.category?.includes(decodeURIComponent(categoryId || '')),
    );
  }, [
    categoryId,
    downloading,
    finishedDownloads,
    historyDownloads,
    forDownloads,
  ]);

  return (
    <div className="w-full pb-5">
      <DownloadList downloads={downloads} />
    </div>
  );
};

export default CategoryPage;
