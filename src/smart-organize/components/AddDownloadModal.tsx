/**
 * AddDownloadModal
 * Simple modal for adding a new download from within Smart Organize.
 * Uses the default download folder from settings and triggers the standard download flow.
 */

import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useSettingStore } from '@/core-app/store/settingsStore';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import BaseModal from '@/downlodr/components/modal/BaseModal';
import { useEffect, useRef, useState } from 'react';

interface AddDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddDownloadModal: React.FC<AddDownloadModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const settings = useSettingStore((state) => state.settings);
  const setDownload = useDownloadStore((state) => state.setDownload);

  const maxDownload =
    settings.defaultDownloadSpeed === 0
      ? ''
      : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`;

  useEffect(() => {
    if (isOpen) {
      setUrl('');
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const trimmedUrl = url.trim();
  const isValidUrl =
    trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidUrl || isLoading) return;

    if (!settings.defaultLocation) {
      toast({
        variant: 'destructive',
        title: 'No download folder set',
        description: 'Please set a default download location in Settings first.',
        duration: 5000,
      });
      return;
    }

    setIsLoading(true);
    try {
      await setDownload(trimmedUrl, settings.defaultLocation, maxDownload, {
        getTranscript: false,
        getThumbnail: false,
      });
      toast({
        title: 'Download added',
        description: 'Your download has been queued.',
        duration: 5000,
      });
      onClose();
    } catch {
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: 'Could not start the download. Please check the URL and try again.',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Download"
      width="max-w-md"
      footer={
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-download-form"
            disabled={!isValidUrl || isLoading}
            className="px-5 py-1 bg-primary text-white rounded disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? 'Adding...' : 'Download'}
          </button>
        </div>
      }
    >
      <form id="add-download-form" onSubmit={handleSubmit} className="pb-2">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Video URL
        </label>
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full p-2 border rounded dark:bg-darkMode dark:border-inputDarkModeBorder outline-none dark:text-gray-200 text-sm"
        />
        {trimmedUrl && !isValidUrl && (
          <p className="text-xs text-red-500 mt-1">
            URL must start with http:// or https://
          </p>
        )}
      </form>
    </BaseModal>
  );
};

export default AddDownloadModal;
