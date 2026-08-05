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

import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
import { useSettingStore } from '@/core-app/store/settingsStore';
import { AddDownload } from '@/downlodr/schema/downloadSchema';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { processFileName } from '@/downlodr/utils/download/filterName';
import { maybeShowFormatHint } from '@/downlodr/utils/formatHint';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IoMdDownload } from 'react-icons/io';

// Interface representing the props for the DownloadButton component
interface DownloadButtonProps {
  download: AddDownload;
  /**
   * Optional subscription ID. When provided, the download will be tracked
   * in the specified subscription's download list. Only use this when the
   * download is actually initiated by or associated with a subscription.
   */
  subscriptionId?: string;
  iconSize?: number;
  iconClassName?: string;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({
  download,
  subscriptionId,
  iconSize = 22,
  iconClassName = '',
}) => {
  const { t } = useTranslation('downlodr');
  const [isDisabled, setIsDisabled] = useState(false);
  const { settings } = useSettingStore();
  const { removeFromForDownloads, addQueue } = useDownloadStore();
  const setSelectedRowIds = useSelectedDownloadStore(
    (state) => state.setSelectedRowIds,
  );
  const setSelectedDownloads = useSelectedDownloadStore(
    (state) => state.setSelectedDownloads,
  );

  /**
   * Handles the click event for the download button.
   * Initiates the download process and updates the download store.
   *
   * @param e - The mouse event triggered by the button click.
   */
  const handleDownloadClick = async (e: React.MouseEvent) => {
    // 👇 Prevent double click
    if (isDisabled) return;
    e.stopPropagation(); // Prevent row expansion

    // One-time hint: consumes this click without starting the download.
    // Do this before setIsDisabled(true) so the button stays clickable.
    if (maybeShowFormatHint()) return;

    setIsDisabled(true);
    setSelectedRowIds([]);
    setSelectedDownloads([]);

    // Process the filename first
    const processedName = await processFileName(
      download.location,
      download.name,
      download.ext || download.audioExt, // Use appropriate extension
    );

    // Add to queue - let the download controller handle starting it
    addQueue({
      subscriptionId: subscriptionId,
      videoUrl: download.videoUrl ?? download.videoUrl ?? '',
      name: `${processedName}.${download.ext}`,
      downloadName: `${processedName}.${download.ext}`,
      displayName: download.displayName ?? `${processedName}.${download.ext}`,
      size: download.size,
      speed: download.speed,
      channelName: download.channelName ?? '',
      timeLeft: download.timeLeft ?? '',
      DateAdded: new Date().toISOString(),
      uploadDate: download.uploadDate,
      progress: download.progress ?? 0,
      location: download.location ?? download.location ?? '',
      status: 'queued',
      ext: download.ext,
      formatId: download.formatId,
      audioExt: download.audioExt,
      audioFormatId: download.audioFormatId,
      extractorKey: download.extractorKey,
      limitRate:
        settings.defaultDownloadSpeed === 0
          ? ''
          : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
      automaticCaption: download.automaticCaption,
      thumbnails: download.thumbnails,
      getTranscript: download.getTranscript ?? false,
      getThumbnail: download.getThumbnail ?? false,
      duration: download.duration ?? 60,
      isCreateFolder: true,
      description: download.description,
      chapters: download.chapters,
      autoCaptionLocation: download.autoCaptionLocation,
      thumnailsLocation: download.thumnailsLocation,
      transcriptLocation: download.transcriptLocation,
      tags: download.tags,
      category: download.category,
      isLive: download.isLive ?? false,
    });

    // Remove from forDownloads
    removeFromForDownloads(download.id);

    toast({
      title: t('downloadButton.toastTitle'),
      description: t('downloadButton.toastDesc', { name: processedName }),
      duration: 5000,
    });
  };

  return (
    <TooltipWrapper content={t('downloadButton.tooltip')} side="bottom">
      <button
        disabled={isDisabled}
        onClick={handleDownloadClick}
        className="text-center items-center relative"
      >
        <div className="relative flex items-center text-sm whitespace-nowrap">
          {' '}
          <IoMdDownload className={`mr-1 ${iconClassName}`} size={iconSize} />
        </div>
      </button>
    </TooltipWrapper>
  );
};

export default DownloadButton;
