/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { IoMdClose } from 'react-icons/io';
import useDownloadStore from '../../../Store/downloadStore';
import GetEmbedUrl from '../../..//DataFunctions/EmbedVideo';
import { Skeleton } from '../../SubComponents/shadcn/components/ui/skeleton';
import { useMainStore } from '../../../Store/mainStore';
import { toast } from '../../SubComponents/shadcn/hooks/use-toast';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose }) => {
  // Simplified state - remove unnecessary states for initial URL input flow
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

  // Simplified URL validation
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
  // Simplified download handler - only initiates the background process
  const handleDownload = async () => {
    try {
      // Initialize download with just the essential information
      setDownload(
        videoUrl,
        downloadFolder, // Now correctly passing the location
        maxDownload,
      );

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

  // Simplified reset
  const resetModal = () => {
    setVideoUrl('');
    setIsValidUrl(false);
    setDownloadFolder(settings.defaultLocation);
  };

  // Remove invalid characters from download name
  const removeInvalidChar = (filename: string) => {
    const invalidChars = /[<>:"/\\|?*.]+/g;
    let sanitized = filename.replace(invalidChars, '_').trim();
    sanitized = sanitized.replace(/^\s+|\s+$/g, '');
    sanitized = sanitized.substring(0, 255);
    return sanitized;
  };

  // checks if file location is correct
  const isValidPath = async (path: string): Promise<boolean> => {
    // Check for undefined or empty path
    if (!path || path.includes('undefined')) {
      console.log('undefined path');
      return false;
    }
    try {
      // Call the validatePath method from the preload script
      const isValid = await window.downlodrFunctions.validatePath(path);
      return isValid;
    } catch (error) {
      console.error('Error validating path:', error);
      return false;
    }
  };

  // automatically adjust name for duplicate names
  const getUniqueFileName = async (
    basePath: string,
    fileName: string,
    extension: string,
  ): Promise<string> => {
    let counter = 1;
    let finalName = fileName;

    // Check if file exists with extension
    while (
      await window.downlodrFunctions.fileExists(
        basePath + finalName + '.' + extension,
      )
    ) {
      finalName = `${fileName}[${counter}]`;
      counter++;
    }
    console.log('finalName: ');
    console.log(finalName);
    return finalName;
  };

  // Find location
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
        className={`bg-white dark:bg-darkMode rounded-lg pt-6 pr-6 pl-6 pb-4 ${
          videoUrl && isValidUrl
            ? 'w-4/5 max-w-[1000px] flex gap-6'
            : 'w-full max-w-xl'
        }`}
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
            <form
              onSubmit={(e) => e.preventDefault()}
              className={videoUrl && isValidUrl ? 'w-2/3' : 'flex-1'}
            >
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
