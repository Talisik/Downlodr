import React from 'react';
import { processFileName } from '../../../DataFunctions/FilterName';
import useDownloadStore from '../../../Store/downloadStore';
import { AnimatedCircularProgressBar } from './RadialProgress';
import { useMainStore } from '../../../Store/mainStore';
import { toast } from '../shadcn/hooks/use-toast';

interface DownloadButtonProps {
  download: {
    id: string;
    location: string;
    name: string;
    status: string;
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
  const { settings } = useMainStore();
  const { downloading, addDownload, removeFromForDownloads } =
    useDownloadStore();

  const handleDownloadClick = async (e: React.MouseEvent) => {
    console.log(
      `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
    );
    e.stopPropagation(); // Prevent row expansion
    console.log(downloading.length);
    if (downloading.length >= settings.maxDownloadNum) {
      toast({
        variant: 'destructive',
        title: 'Download limit reached',
        description: `Maximum download limit (${settings.maxDownloadNum}) reached. Please wait for current downloads to complete.`,
      });
      return;
    }
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
      `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
    );
    removeFromForDownloads(download.id);
  };

  return (
    <button onClick={handleDownloadClick} className="text-left">
      <AnimatedCircularProgressBar
        status={download.status}
        max={100}
        min={0}
        value={download.progress}
        gaugePrimaryColor="#4CAF50"
        gaugeSecondaryColor="#EEEEEE"
      />{' '}
    </button>
  );
};

export default DownloadButton;
