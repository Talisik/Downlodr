import React, { useEffect, useState } from 'react';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { useSettingStore } from '@/core-app/store/settingsStore';
import { processFileName } from '@/downlodr/utils/download/filterName';
import type { ForDownload } from '@/downlodr/store/download/types';

interface Format {
  value: string;
  label: string;
  fileExtension: string;
  formatId: string;
}

interface FormatSelectorModalProps {
  download: ForDownload | null;
  onClose: () => void;
}

function getFormatDisplayLabel(f: Format): string {
  if (
    f.label.toLowerCase().startsWith('audio only') ||
    f.label.toLowerCase().startsWith('audio ')
  ) {
    return `${f.fileExtension} - ${f.label}`;
  }
  return f.label;
}

const FormatSelectorModal: React.FC<FormatSelectorModalProps> = ({
  download,
  onClose,
}) => {
  const { settings } = useSettingStore();
  const { removeFromForDownloads, addQueue } = useDownloadStore();
  const [selected, setSelected] = useState<Format | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const formats: Format[] = (download?.formats ?? []) as Format[];
  useEffect(() => {
    if (formats.length > 0) setSelected(formats[0]);
  }, [download]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!download) return null;

  const isAudioOnly = !!selected && selected.label.startsWith('Audio');

  let thumbnailUrl: string | null = null;
  if (Array.isArray(download.thumbnails)) {
    thumbnailUrl =
      download.thumbnails[download.thumbnails.length - 1]?.url ?? null;
  } else if (typeof download.thumbnails === 'string') {
    thumbnailUrl = download.thumbnails;
  }

  const handleConfirm = async () => {
    if (!selected || isDownloading) return;
    setIsDownloading(true);

    const ext = selected.fileExtension;
    const processedName = await processFileName(
      download.location,
      download.name,
      ext,
    );

    addQueue({
      videoUrl: download.videoUrl ?? '',
      name: `${processedName}.${ext}`,
      downloadName: `${processedName}.${ext}`,
      displayName: download.displayName ?? `${processedName}.${ext}`,
      size: download.size,
      speed: download.speed,
      channelName: download.channelName ?? '',
      timeLeft: download.timeLeft ?? '',
      DateAdded: new Date().toISOString(),
      progress: download.progress ?? 0,
      location: download.location ?? '',
      status: 'queued',
      ext,
      formatId: isAudioOnly ? '' : selected.formatId,
      audioExt: isAudioOnly ? selected.fileExtension : '',
      audioFormatId: isAudioOnly ? selected.formatId : '',
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
    });

    removeFromForDownloads(download.id);

    toast({
      title: 'Download queued',
      description: processedName,
      duration: 3000,
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-white dark:bg-darkModeDropdown rounded-xl shadow-xl w-full max-w-xl mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            New Download
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m18 6-12 12M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-4">
            <div className="bg-[#F4F4F5] dark:bg-darkMode rounded-xl p-4 flex gap-4">
            {/* Left: video info */}
            <div className="flex-shrink-0 w-40">
              <div className="w-40 h-24 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={download.displayName ?? download.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-gray-400"
                    >
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="m10 8 6 4-6 4V8Z" fill="currentColor" />
                    </svg>
                  </div>
                )}
              </div>
              <p
                title={download.displayName ?? download.name}
                className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight"
              >
                {download.displayName ?? download.name}
              </p>
              {download.channelName && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate">
                  {download.channelName}
                </p>
              )}
            </div>

            {/* Right: format grid */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Select Format
              </p>
              {formats.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">
                  No formats available
                </p>
              ) : (
                <div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {formats.map((f) => (
                      <button
                        key={f.value}
                        title={f.label}
                        onClick={() => setSelected(f)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors text-center truncate ${
                          selected?.value === f.value
                            ? 'bg-green-100 text-green-700'
                            : 'bg-white dark:bg-darkModeDropdown border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-green-500 hover:text-green-500'
                        }`}
                      >
                        {getFormatDisplayLabel(f)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || isDownloading}
            className="primary-custom-btn px-5 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormatSelectorModal;
