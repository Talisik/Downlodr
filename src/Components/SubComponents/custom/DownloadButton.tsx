import React from 'react';
import { processFileName } from '../../../DataFunctions/FilterName';
import useDownloadStore from '../../../Store/downloadStore';

interface DownloadButtonProps {
  download: {
    id: string;
    location: string;
    name: string;
    ext: string;
    audioExt: string;
    videoUrl: string;
    size: number;
    speed: string;
    timeLeft: string;
    progress: number;
    formatId: string;
    audioFormatId: string;
    extractorKey: string;
  };
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ download }) => {
  const addDownload = useDownloadStore((state) => state.addDownload);
  const removeFromForDownloads = useDownloadStore(
    (state) => state.removeFromForDownloads,
  );

  const handleDownloadClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row expansion

    // Process the filename first
    const processedName = await processFileName(
      download.location,
      download.name,
      download.ext || download.audioExt, // Use appropriate extension
    );

    addDownload(
      download.videoUrl,
      `${processedName}.${download.ext}`,
      `${processedName}.${download.ext}`,
      download.size,
      download.speed,
      download.timeLeft,
      new Date().toISOString(),
      download.progress,
      download.location,
      'downloading',
      download.ext,
      download.formatId,
      download.audioExt,
      download.audioFormatId,
      download.extractorKey,
      '',
    );
    removeFromForDownloads(download.id);
  };

  return (
    <button onClick={handleDownloadClick} className="text-left">
      ready for download
    </button>
  );
};

export default DownloadButton;
