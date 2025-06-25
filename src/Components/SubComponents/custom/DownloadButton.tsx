/**
 * A custom React component
 * A React component that represents a button for initiating a download.
 * It displays a circular progress bar indicating the download status and progress.
 *
 * @param DownloadButtonProps
 *   @param download - An object containing details about the download, including its ID, location, name, status, and progress.
 *
 * @returns JSX.Element - The rendered download button component.
 */

import React from 'react';
import { IoMdDownload } from 'react-icons/io';
import { processFileName } from '../../../DataFunctions/FilterName';
import useDownloadStore from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import { toast } from '../shadcn/hooks/use-toast';

// Interface representing the props for the DownloadButton component
interface DownloadButtonProps {
  download: {
    id: string; // Unique identifier for the download
    location: string; // Location of the file to download
    name: string; // Name of the file
    status: string; // Current status of the download
    ext: string; // File extension
    audioExt: string; // Audio file extension
    videoUrl: string; // URL of the video to download
    size: number; // Size of the file in bytes
    speed: string; // Download speed
    timeLeft: string; // Estimated time left for the download
    progress: number; // Download progress percentage
    formatId: string; // Format ID of the download
    audioFormatId: string; // Audio format ID
    extractorKey: string; // Key for the extractor
    automaticCaption: string;
    thumbnails: string;
    getTranscript: boolean;
    getThumbnail: boolean;
    duration: number;
  };
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ download }) => {
  const { settings } = useMainStore();
  const { removeFromForDownloads, addQueue } = useDownloadStore();

  /**
   * Handles the click event for the download button.
   * Initiates the download process and updates the download store.
   *
   * @param e - The mouse event triggered by the button click.
   */
  const handleDownloadClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row expansion

    // Process the filename first
    const processedName = await processFileName(
      download.location,
      download.name,
      download.ext || download.audioExt, // Use appropriate extension
    );

    // Add to queue - let the download controller handle starting it
    addQueue(
      download.videoUrl,
      `${processedName}.${download.ext}`,
      `${processedName}.${download.ext}`,
      download.size,
      download.speed,
      download.timeLeft,
      new Date().toISOString(),
      download.progress,
      download.location,
      'queued',
      download.ext,
      download.formatId,
      download.audioExt,
      download.audioFormatId,
      download.extractorKey,
      settings.defaultDownloadSpeed === 0
        ? ''
        : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
      download.automaticCaption,
      download.thumbnails,
      download.getTranscript || false,
      download.getThumbnail || false,
      download.duration || 60,
      true,
    );

    // Remove from forDownloads
    removeFromForDownloads(download.id);

    toast({
      title: 'Download Added to Queue',
      description: `"${processedName}" added to queue. The download controller will start it automatically.`,
      duration: 3000,
    });
  };

  return (
    <button onClick={handleDownloadClick} className="text-left relative">
      <div className="relative flex items-center text-sm whitespace-nowrap">
        {' '}
        <IoMdDownload className="mr-1" size={18} />
        Start Download
      </div>
    </button>
  );
};

export default DownloadButton;
