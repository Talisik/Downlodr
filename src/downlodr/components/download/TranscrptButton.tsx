import { Skeleton } from '@/core-app/components/shadcn/components/ui/skeleton';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import type { FinishedDownloads } from '@/downlodr/store/download/types';
import { enqueueTranscript } from '@/downlodr/utils/transcription/transcriptQueue';
import React, { useEffect, useState } from 'react';
import { AiOutlineStop } from 'react-icons/ai';
import { FaRegClock, FaRegClosedCaptioning } from 'react-icons/fa';
import { MdOutlineFileDownload } from 'react-icons/md';
import { AnimatedLinearProgressBar } from './LinearProgress';

const BLOCKED_STATUSES = new Set([
  'downloading',
  'queued',
  'initializing',
  'paused',
  'failed',
  'cancelled',
  'to download',
]);

interface TranscrptButtonProps {
  download: FinishedDownloads;
  onViewFile: (location?: string, downloadId?: string) => void;
}

const TranscrptButton: React.FC<TranscrptButtonProps> = ({
  download,
  onViewFile,
}) => {
  const transcriptLocation =
    typeof download.transcriptLocation === 'string'
      ? download.transcriptLocation
      : download.autoCaptionLocation;

  const [fileExists, setFileExists] = useState(false);

  // Re-check the file whenever the path or transcription status changes.
  // This is the ground truth — the store's transcriptionStatus can lag behind
  // due to race conditions between async caption downloads and the lifecycle
  // action that promotes downloads to finishedDownloads.
  useEffect(() => {
    if (!transcriptLocation || !transcriptLocation.trim()) {
      setFileExists(false);
      return;
    }
    window.downlodrFunctions
      .fileExists(transcriptLocation)
      .then(setFileExists)
      .catch(() => setFileExists(false));
  }, [transcriptLocation, download.transcriptionStatus]);

  if (download.status === 'fetching metadata') {
    return (
      <div className="flex justify-center items-center">
        <Skeleton className="h-8 w-[50px] rounded-[3px]" />
      </div>
    );
  }

  if (BLOCKED_STATUSES.has(download.status)) {
    return (
      <TooltipWrapper
        content={`${
          download.status.charAt(0).toUpperCase() + download.status.slice(1)
        } video`}
        side="bottom"
      >
        <span className="text-notAvailableStatus dark:text-darkModeNotAvailableStatus flex justify-center items-center w-full">
          —
        </span>
      </TooltipWrapper>
    );
  }

  // File exists on disk — show the view button regardless of store status.
  if (fileExists) {
    return (
      <TooltipWrapper content="View transcript" side="bottom">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewFile(transcriptLocation, download.id);
          }}
          className="flex justify-center items-center w-full hover:text-green-400 transition-colors duration-200"
        >
          {download.getTranscript ? (
            <FaRegClosedCaptioning
              size={20}
              className="text-green-600 hover:text-green-400 transition-colors duration-200"
            />
          ) : (
            '—'
          )}
        </button>
      </TooltipWrapper>
    );
  }

  // File not on disk yet — fall back to store status for in-progress states.
  const isQueued = download.transcriptionStatus === 'queued';
  const isTranscribing = download.transcriptionStatus === 'transcribing';
  const progress = download.transcriptionProgress ?? 0;

  if (isQueued) {
    return (
      <TooltipWrapper content="Queued" side="bottom">
        <span className="flex justify-center items-center w-full">
          <FaRegClock size={18} className="text-amber-500 dark:text-amber-400" />
        </span>
      </TooltipWrapper>
    );
  }

  if (isTranscribing) {
    return (
      <TooltipWrapper
        content={`Transcribing... ${Math.round(progress)}%`}
        side="bottom"
      >
        <span className="flex justify-center items-center w-full min-w-[60px]">
          <AnimatedLinearProgressBar
            status="transcribing"
            value={progress}
            min={0}
            max={100}
            gaugePrimaryColor="#f59e0b"
            gaugeSecondaryColor="#fef3c7"
            width={80}
          />
        </span>
      </TooltipWrapper>
    );
  }

  if (!transcriptLocation) {
    return (
      <TooltipWrapper content="Transcript not available" side="bottom">
        <span className="flex justify-center items-center w-full">
          <AiOutlineStop
            size={20}
            className="text-red-500 hover:text-red-400 transition-colors duration-200"
          />
        </span>
      </TooltipWrapper>
    );
  }

  return (
    <TooltipWrapper content="Generate Caption" side="bottom">
      <button
        onClick={(e) => {
          e.stopPropagation();
          enqueueTranscript({
            downloadId: download.id,
            location: download.location,
            downloadName: download.downloadName,
          });
        }}
      >
        <MdOutlineFileDownload
          size={18}
          className="mt-2 text-green-600 hover:text-green-400 transition-colors duration-200"
        />
      </button>
    </TooltipWrapper>
  );
};

export default TranscrptButton;
