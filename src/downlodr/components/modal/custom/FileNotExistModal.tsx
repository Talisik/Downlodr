/**
 * Modal shown when downloaded files no longer exist.
 * Allows redownload or removal of download logs.
 */

import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
import { useSettingStore } from '@/core-app/store/settingsStore';
import { FileNotExistModalProps } from '@/downlodr/schema/componentSchema';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { processFileName } from '@/downlodr/utils/download/filterName';
import React from 'react';
import BaseModal from '../BaseModal';

const FileNotExistModal: React.FC<FileNotExistModalProps> = ({
  isOpen,
  onClose,
  download,
  selectedDownloads = [],
}) => {
  const { deleteDownload, addDownload } = useDownloadStore();
  const { settings } = useSettingStore();
  const { clearAllSelections } = useSelectedDownloadStore();

  const isSingleDownload = !!download;
  const downloads = download ? [download] : selectedDownloads;

  const pluralSuffix = downloads.length > 1 ? 's' : '';

  // ✅ Redownload
  const handleRedownload = async () => {
    for (const item of downloads) {
      try {
        const processedName = await processFileName(
          item.download.location,
          item.download.name.replace(/\.[^/.]+$/, ''),
          '',
        );

        addDownload({
          videoUrl: item.videoUrl,
          name: `${processedName}.${item.download.ext}`,
          downloadName: `${processedName}.${item.download.ext}`,
          displayName: item.download.displayName,
          size: item.download.size,
          speed: item.download.speed,
          channelName: item.download.channelName,
          timeLeft: item.download.timeLeft,
          DateAdded: new Date().toISOString(),
          progress: 0,
          location: item.download.location,
          status: 'downloading',
          ext: item.download.ext,
          formatId: item.download.formatId,
          audioExt: item.download.audioExt,
          audioFormatId: item.download.audioFormatId,
          extractorKey: item.download.extractorKey,
          limitRate:
            settings.defaultDownloadSpeed === 0
              ? ''
              : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
          automaticCaption: item.download.automaticCaption,
          thumbnails: item.download.thumbnails[0],
          getTranscript: item.download.getTranscript || false,
          getThumbnail: item.download.getThumbnail || false,
          duration: item.download.duration || 60,
          isCreateFolder: false,
        });

        deleteDownload(item.id);
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Redownload Error',
          description: `Failed to redownload: ${error?.message ?? error}`,
          duration: 3000,
        });
      }
    }

    toast({
      variant: 'success',
      title: isSingleDownload ? 'Download Added' : 'Downloads Added',
      description: isSingleDownload
        ? 'Your download has been added successfully'
        : `${downloads.length} downloads have been added successfully`,
      duration: 3000,
    });

    clearAllSelections();
    onClose();
  };

  // ✅ Remove logs
  const handleDeleteLog = () => {
    downloads.forEach((item) => deleteDownload(item.id));

    toast({
      variant: 'success',
      title: isSingleDownload
        ? 'Download Log Removed'
        : 'Download Logs Removed',
      description: isSingleDownload
        ? 'Download log has been removed successfully'
        : `${downloads.length} download logs have been removed successfully`,
      duration: 3000,
    });

    clearAllSelections();
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Missing File${pluralSuffix}`}
      width="max-w-md"
      footer={
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleDeleteLog}
            className="px-3 py-1 text-gray-600 bg-white dark:bg-[#18181B] dark:text-white border dark:border-[#27272A] hover:bg-gray-50 dark:hover:bg-darkModeHover rounded-md font-medium"
          >
            Remove Log{pluralSuffix}
          </button>

          <button
            onClick={handleRedownload}
            className="px-3 py-1 bg-primary text-white rounded hover:bg-primary/90 dark:hover:bg-primary/80"
          >
            Redownload
          </button>
        </div>
      }
    >
      <p className="text-gray-700 dark:text-gray-300 mb-4">
        File{pluralSuffix} does not exist at the given location. Do you wish to
        redownload or remove the log{pluralSuffix}?
      </p>

      {downloads.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1">
          {downloads.map((item) => (
            <div
              key={item.id}
              className="text-xs text-gray-600 dark:text-gray-400 truncate"
            >
              • {item.name || item.downloadName}
            </div>
          ))}
        </div>
      )}
    </BaseModal>
  );
};

export default FileNotExistModal;
