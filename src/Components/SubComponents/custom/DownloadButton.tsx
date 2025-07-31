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

import TooltipWrapper from '@/Components/SubComponents/custom/TooltipWrapper';
import { toast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import { processFileName } from '@/DataFunctions/FilterName';
import { AddDownload } from '@/schema/download';
import useDownloadStore from '@/Store/downloadStore';
import { useMainStore } from '@/Store/mainStore';
import React from 'react';
import { IoMdDownload } from 'react-icons/io';

// Interface representing the props for the DownloadButton component
interface DownloadButtonProps {
  download: AddDownload;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ download }) => {
  const { settings } = useMainStore();
  const { removeFromForDownloads, addQueue } = useDownloadStore();
  const setSelectedRowIds = useMainStore((state) => state.setSelectedRowIds);
  const setSelectedDownloads = useMainStore(
    (state) => state.setSelectedDownloads,
  );
  /**
   * Handles the click event for the download button.
   * Initiates the download process and updates the download store.
   *
   * @param e - The mouse event triggered by the button click.
   */
  const handleDownloadClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row expansion
    setSelectedRowIds([]);
    setSelectedDownloads([]);
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
      download.channelName,
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
    <TooltipWrapper content="Download video" side="bottom">
      <button
        onClick={handleDownloadClick}
        className="text-center items-center relative"
      >
        <div className="relative flex items-center text-sm whitespace-nowrap">
          {' '}
          <IoMdDownload className="mr-1" size={22} />
        </div>
      </button>
    </TooltipWrapper>
  );
};

export default DownloadButton;
