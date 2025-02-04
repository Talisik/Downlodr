/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { IoMdClose } from 'react-icons/io';
import useDownloadStore from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import { toast } from '../../SubComponents/shadcn/hooks/use-toast';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose }) => {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isValidUrl, setIsValidUrl] = useState<boolean>(false);

  // Store
  const { setDownload } = useDownloadStore();
  const { settings } = useMainStore();
  const [downloadFolder, setDownloadFolder] = useState<string>(
    settings.defaultLocation,
  );
  const maxDownload =
    settings.defaultDownloadSpeed === 0
      ? ''
      : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`;

  // URL validation
  const handleUrl = (url: string) => {
    setVideoUrl(url);
    setIsValidUrl(false);

    const urlPattern = new RegExp(
      '^(https?:\\/\\/)?' +
        '(' +
        '((([a-zA-Z\\d]([a-zA-Z\\d-]*[a-zA-Z\\d])*)\\.)+[a-zA-Z]{2,}|' +
        '((\\d{1,3}\\.){3}\\d{1,3}))' +
        '(\\:\\d+)?(\\/[-a-zA-Z\\d%_.~+@]*)*' +
        '(\\?[;&a-zA-Z\\d%_.~+@=-]*)?' +
        '(\\#[-a-zA-Z\\d_]*)?' +
        ')$',
      'i',
    );

    if (!urlPattern.test(url)) {
      toast({
        variant: 'destructive',
        title: 'Invalid URL',
        description: 'Please enter a valid video URL',
      });
      return;
    }

    try {
      new URL(url);
      setIsValidUrl(true);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Invalid URL Format',
        description: 'The URL format is not valid',
      });
    }
  };

  // Cancel button
  const handleCancel = () => {
    resetModal(); // Reset the state
    onClose(); // Close the modal
  };

  // download handler - only initiates the background process
  const handleDownload = async () => {
    try {
      // Initialize download with just the basic information
      setDownload(videoUrl, downloadFolder, maxDownload);

      // Reset and close modal
      resetModal();
      onClose();

      // Show toast notification
      toast({
        title: 'Download Queued',
        description: 'Getting video information...',
      });
    } catch (error) {
      console.error('Error initiating download:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to start download process',
      });
    }
  };

  // reset
  const resetModal = () => {
    setVideoUrl('');
    setIsValidUrl(false);
    setDownloadFolder(settings.defaultLocation);
  };

  // set download folder location
  const handleDirectory = async () => {
    const path = await window.ytdlp.selectDownloadDirectory();
    setDownloadFolder(path);
  };

  // Move the conditional return after all hooks
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-20 dark:bg-opacity-50 flex items-center justify-center h-full z-[9999]"
      onClick={(e) => {
        // Only close if clicking the overlay background
        if (e.target === e.currentTarget) {
          handleCancel();
        }
      }}
    >
      {' '}
      <div
        className={`bg-white dark:bg-darkMode rounded-lg pt-6 pr-6 pl-6 pb-4 w-full max-w-xl`}
      >
        <div className={videoUrl && isValidUrl ? 'flex-1' : 'w-full'}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold dark:text-gray-200">
              New Download
            </h2>
            <button
              onClick={handleCancel}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <IoMdClose size={16} />
            </button>
          </div>

          <div className="flex gap-6">
            <form onSubmit={(e) => e.preventDefault()} className={'w-full'}>
              <div className="space-y-4">
                <div>
                  <label className="block dark:text-gray-200">
                    Download link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste link here"
                      disabled={isValidUrl}
                      value={videoUrl}
                      onChange={(e) => handleUrl(e.target.value)}
                      className="flex-1 border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block dark:text-gray-200">
                    Save file to
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      disabled={isValidUrl}
                      value={downloadFolder}
                      onClick={handleDirectory}
                      placeholder="Download Destination Folder"
                      className="flex-1 border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-transparent"
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>
          <hr className="solid mt-4 mb-2 -mx-6 w-[calc(100%+47px)] border-t-2 border-divider dark:border-gray-700" />

          <div className="flex gap-3">
            <button
              type="submit"
              className="bg-primary text-white px-2 py-2 rounded-md hover:bg-primary/90 dark:hover:text-black dark:hover:bg-white"
              onClick={handleDownload}
            >
              Download
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-2 py-2 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 dark:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadModal;
