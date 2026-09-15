import React, { useEffect, useState } from 'react';
import { IoMdClose } from 'react-icons/io';
import { FaRegClosedCaptioning } from 'react-icons/fa';
import { Button } from '@/core-app/components/shadcn/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface IneligibleDownload {
  id: string;
  name: string;
  thumnailsLocation?: string;
}

interface NoTranscriptModalProps {
  show: boolean;
  ineligibleDownloads: IneligibleDownload[];
  totalCount: number;
  onCancel: () => void;
  onNext: () => void;
}

const NoTranscriptModal: React.FC<NoTranscriptModalProps> = ({
  show,
  ineligibleDownloads,
  totalCount,
  onCancel,
  onNext,
}) => {
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    if (!show) return;
    const load = async () => {
      const entries: Record<string, string> = {};
      for (const d of ineligibleDownloads) {
        const loc = d.thumnailsLocation;
        if (loc) {
          try {
            const url = await window.downlodrFunctions.getThumbnailDataUrl(loc);
            if (url) entries[d.id] = url;
          } catch {
            // fallback to placeholder
          }
        }
      }
      setThumbnailUrls(entries);
    };
    load();
  }, [show, ineligibleDownloads]);

  if (!show) return null;

  const missingCount = ineligibleDownloads.length;
  console.log('ineligible downloads', ineligibleDownloads);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <div
        className="bg-white dark:bg-[#3D3D3D] rounded-lg p-4 w-full max-w-md shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-lightOrange text-primary dark:text-orange-500 rounded-md p-2">
              <FaRegClosedCaptioning size={24} />
            </div>
            <div className="flex flex-col">
              <h3 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100">
                Some videos have no transcript
              </h3>
              <p className="text-xs text-gray-800 dark:text-gray-400">
                {missingCount} of {totalCount} videos are missing captions
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 mb-8"
          >
            <IoMdClose size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-2 mb-4">
          <div className="p-4 rounded-md bg-recurringTag dark:bg-[#474747]">
            <p className="text-xs">
              The following videos have no transcript and won't be available to
              proceed with smart organize:
            </p>
          </div>

          <div className=" max-h-56 overflow-y-auto">
            {ineligibleDownloads.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 p-3 border-b first:rounded-t-md last:rounded-b-md last:border-b-0
                bg-recurringTag dark:bg-[#474747] pr-4"
              >
                {/* Thumbnail */}
                <div className="w-7 h-7 rounded-md overflow-hidden shrink-0 bg-gray-200 dark:bg-neutral-600">
                  {thumbnailUrls[d.id] ? (
                    <img
                      src={thumbnailUrls[d.id]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full" />
                  )}
                </div>

                {/* Name */}
                <span className="flex-1 text-xs truncate">
                  {d.name || 'Untitled'}
                </span>

                {/* Warning icon */}
                <AlertTriangle
                  className="shrink-0 text-orange-500 w-5 h-5"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Pagination dots (decorative, matching screenshot style) */}
        <div className="flex justify-center gap-1.5 mb-4">
          <div className="w-4 h-1.5 rounded-full bg-primary" />
          <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-neutral-500" />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 ">
          <Button
            variant="secondary"
            onClick={onCancel}
            className="flex items-center border border-lightBorder dark:border-secondarkDarkHover rounded-md justify-center gap-2 py-4 px-6 bg-white dark:bg-[#3D3D3D] dark:hover:bg-secondarkDarkHover"
          >
            Cancel
          </Button>
          <Button
            onClick={onNext}
            className="flex items-center justify-center px-3 py-4 bg-primary text-white rounded-md dark:bg-primary dark:text-white hover:bg-primaryDarkHover hover:dark:text-black"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NoTranscriptModal;
