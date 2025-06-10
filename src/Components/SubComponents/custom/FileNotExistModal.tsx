/**
 * A modal component displayed when downloaded files don't exist at their expected location.
 * Provides options to either redownload the video(s) or delete the download log(s).
 */
import React from 'react';
import { processFileName } from '../../../DataFunctions/FilterName';
import useDownloadStore from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import { toast } from '../shadcn/hooks/use-toast';

export interface DownloadItem {
  id: string;
  videoUrl: string;
  location?: string;
  name?: string;
  ext?: string;
  downloadName?: string;
  extractorKey?: string;
  download: {
    location: string;
    name: string;
    ext: string;
    size: number;
    speed: string;
    timeLeft: string;
    progress: number;
    formatId: string;
    audioExt: string;
    audioFormatId: string;
    extractorKey: string;
    automaticCaption: boolean;
    thumbnails: string[];
    getTranscript: boolean;
    getThumbnail: boolean;
    duration?: number;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface FileNotExistModalProps {
  isOpen: boolean;
  onClose: () => void;
  download?: DownloadItem | null; // Single download from context menu
  selectedDownloads?: DownloadItem[]; // Multiple downloads from selection
}

const FileNotExistModal: React.FC<FileNotExistModalProps> = ({
  isOpen,
  onClose,
  download,
  selectedDownloads = [],
}) => {
  const { deleteDownload, addDownload } = useDownloadStore();
  const { settings, clearAllSelections } = useMainStore();

  // Determine if we're dealing with a single download or multiple
  const isSingleDownload = !!download;
  const downloads = download ? [download] : selectedDownloads;

  // Handle redownload action
  const handleRedownload = () => {
    downloads.forEach(async (item) => {
      try {
        // get the corrected name of download by adding increments for copies
        const processedName = await processFileName(
          item.download.location,
          item.download.name.replace(/\.[^/.]+$/, ''),
          '',
        );
        console.log(item.download.location);
        // check if folder exists to determine if addDownload creates a new folder or not
        const folderExist = await window.downlodrFunctions.fileExists(
          item.download.location,
        );
        console.log(folderExist);
        // Add Download function
        addDownload(
          item.videoUrl,
          `${processedName}.${item.download.ext}`,
          `${processedName}.${item.download.ext}`,
          item.download.size,
          item.download.speed,
          item.download.timeLeft,
          new Date().toISOString(),
          0,
          item.download.location,
          'downloading',
          item.download.ext,
          item.download.formatId,
          item.download.audioExt,
          item.download.audioFormatId,
          item.download.extractorKey,
          settings.defaultDownloadSpeed === 0
            ? ''
            : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
          item.download.automaticCaption,
          item.download.thumbnails,
          item.download.getTranscript || false,
          item.download.getThumbnail || false,
          item.download.duration || 60,
          false,
        );
        // delete log of non existing download
        deleteDownload(item.id);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Redownload Error',
          description: `Failed to redownload: ${error.message}`,
          duration: 3000,
        });
      }
    });

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

  // Handle delete log action
  const handleDeleteLog = () => {
    downloads.forEach((item) => {
      deleteDownload(item.id);
    });

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

  if (!isOpen) return null;

  // Create a reusable suffix for singular/plural text
  const pluralSuffix = downloads.length > 1 ? 's' : '';

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="missing-files-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="bg-white dark:bg-darkMode rounded-lg p-6 max-w-sm w-full mx-4">
        <h3
          id="missing-files-title"
          className="text-lg font-medium mb-2 dark:text-gray-200"
        >
          Missing File{pluralSuffix}
        </h3>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          File{pluralSuffix} does not exist at the given location. Do you wish
          to redownload or remove the log
          {pluralSuffix}?
        </p>

        {/* Display file information */}
        {downloads.length > 0 && (
          <div className="mb-4 max-h-40 overflow-y-auto">
            {downloads.map((item) => (
              <div
                key={item.id}
                className="text-sm text-gray-600 dark:text-gray-400 truncate"
              >
                • {item.name || item.downloadName}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-3 py-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteLog}
            className="px-3 py-1 bg-black text-white rounded hover:bg-gray-100 hover:text-black"
          >
            Remove Log{pluralSuffix}
          </button>
          <button
            onClick={handleRedownload}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Redownload
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileNotExistModal;
