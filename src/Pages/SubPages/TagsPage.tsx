/**
 * A custom React Sub Page
 * This component displays a list of tags , the contents of the page primarily depend on the type of tag list chosen
 *
 * @returns JSX.Element - The rendered component displaying a tag page.
 */
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import useDownloadStore from '../../Store/downloadStore';
import DownloadList from '../../Components/SubComponents/custom/DownloadList';

const TagPage: React.FC = () => {
  // takes the type of tag from url paramaters
  const { tagId } = useParams<{ tagId: string }>();
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

    if (tagId === 'all') {
      return allDownloads;
    }

    if (tagId === 'untagged') {
      return allDownloads.filter(
        (download) => !download.tags || download.tags.length === 0,
      );
    }

    return allDownloads.filter(
      (download) => download.tags?.includes(decodeURIComponent(tagId || '')),
    );
  }, [tagId, downloading, finishedDownloads, historyDownloads, forDownloads]);

  return (
    <div className="w-full pb-5">
      <DownloadList downloads={downloads} />
    </div>
  );
};

export default TagPage;
