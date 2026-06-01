import { Skeleton } from '@/core-app/components/shadcn/components/ui/skeleton';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { FinishedDownloads } from '@/downlodr/store/download/types';
import useDownloadStore from '@/downlodr/store/downloadStore';
import { redownloadTranscript } from '@/downlodr/utils/transcription/ffmpegWhisperTranscriber';
import { transcriptActions } from '@/transcript/store/transcriptStore';
import { AiOutlineStop } from 'react-icons/ai';
import { FaRegClosedCaptioning } from 'react-icons/fa';
import { FaArrowRotateRight } from 'react-icons/fa6';
import { AnimatedLinearProgressBar } from './LinearProgress';
import { MdOutlineFileDownload } from 'react-icons/md';

/** Resizable table column shape (id, width) used by status table */
interface StatusTableColumn {
  id: string;
  width: number;
}

interface TranscrptButtonProps {
  download: FinishedDownloads;
  column: StatusTableColumn;
  onViewFile: (location?: string, downloadId?: string) => void;
}

const TranscrptButton: React.FC<TranscrptButtonProps> = ({
  download,
  onViewFile,
}) => {
  const { updateDownloadTranscript } = transcriptActions(
    useDownloadStore.setState,
    useDownloadStore.getState,
  );
  const setDownloadTranscriptionStatus = (
    id: string,
    status: 'transcribing' | 'completed' | 'failed',
  ) => {
    useDownloadStore.setState((state) => {
      const withStatus = <
        T extends {
          id: string;
          transcriptionStatus?: string;
          transcriptionProgress?: number;
          getTranscript?: boolean;
        },
      >(
        d: T,
      ): T =>
        d.id === id
          ? {
              ...d,
              transcriptionStatus: status,
              ...(status === 'transcribing'
                ? { getTranscript: true, transcriptionProgress: 0 }
                : {}),
              ...(status === 'completed' ? { transcriptionProgress: 100 } : {}),
            }
          : d;
      return {
        forDownloads: state.forDownloads.map(withStatus),
        downloading: state.downloading.map(withStatus),
        finishedDownloads: state.finishedDownloads.map(withStatus),
        historyDownloads: state.historyDownloads.map(withStatus),
        queuedDownloads: state.queuedDownloads.map(withStatus),
      };
    });
  };

  const setDownloadTranscriptionProgress = (id: string, percent: number) => {
    useDownloadStore.setState((state) => {
      const withProgress = <
        T extends { id: string; transcriptionProgress?: number },
      >(
        d: T,
      ): T => (d.id === id ? { ...d, transcriptionProgress: percent } : d);
      return {
        forDownloads: state.forDownloads.map(withProgress),
        downloading: state.downloading.map(withProgress),
        finishedDownloads: state.finishedDownloads.map(withProgress),
        historyDownloads: state.historyDownloads.map(withProgress),
        queuedDownloads: state.queuedDownloads.map(withProgress),
      };
    });
  };

  const handleRedownloadTranscript = async (downloadId: string) => {
    if (!download) return;

    setDownloadTranscriptionStatus(downloadId, 'transcribing');

    const inputLocation = await window.downlodrFunctions.joinDownloadPath(
      download.location,
      download.downloadName,
    );
    const outputLocation = await window.downlodrFunctions.joinDownloadPath(
      download.location,
      download.downloadName.replace(/\.[^/.]+$/, '.srt'),
    );

    const result = await redownloadTranscript(
      {
        inputFile: inputLocation,
        outputFile: outputLocation,
        modelPath: 'ggml-base.bin',
        language: 'en',
        format: 'srt',
      },
      {
        onProgressPercent: (percent) =>
          setDownloadTranscriptionProgress(downloadId, percent),
      },
    );
    if (result.success && result.outputFile) {
      setDownloadTranscriptionStatus(downloadId, 'completed');
      updateDownloadTranscript(downloadId, result.outputFile);
    } else {
      setDownloadTranscriptionStatus(downloadId, 'failed');
      toast({
        variant: 'destructive',
        title: 'Transcription failed',
        description: result.error ?? 'Could not create transcript',
        duration: 5000,
      });
    }
  };
  return (
    <div>
      {(() => {
        /* ---------------------------------------
         * 1. Status groups (matches original)
         * -------------------------------------*/
        const BLOCKED_STATUSES = new Set([
          'downloading',
          'queued',
          'initializing',
          'paused',
          'failed',
          'cancelled',
          'to download',
        ]);

        /* ---------------------------------------
         * 2. FIRST CONDITION (exact match)
         * -------------------------------------*/
        if (download.status === 'fetching metadata') {
          return (
            <div className="flex justify-center items-center">
              <Skeleton className="h-8 w-[50px] rounded-[3px]" />
            </div>
          );
        }

        /* ---------------------------------------
         * 3. SECOND CONDITION (exact match)
         * -------------------------------------*/
        if (BLOCKED_STATUSES.has(download.status)) {
          return (
            <TooltipWrapper
              content={`${
                download.status.charAt(0).toUpperCase() +
                download.status.slice(1)
              } video`}
              side="bottom"
            >
              <span className="text-notAvailableStatus dark:text-darkModeNotAvailableStatus flex justify-center items-center w-full">
                —
              </span>
            </TooltipWrapper>
          );
        }

        /* ---------------------------------------
         * 4. Transcript logic (unchanged behavior)
         * -------------------------------------*/
        const transcriptLocation =
          typeof download.transcriptLocation === 'string'
            ? download.transcriptLocation
            : download.autoCaptionLocation;

        const isValidLocation =
          !!transcriptLocation &&
          transcriptLocation.trim() !== '' &&
          transcriptLocation !== 'iu' &&
          transcriptLocation !== 'fu';

        const isTranscribing =
          download.getTranscript &&
          download.transcriptionStatus === 'transcribing';

        const progress = download.transcriptionProgress ?? 0;

        /* ---------- Transcribing ---------- */
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

        /* ---------- Invalid transcript ---------- */
        if (!isValidLocation) {
          if (transcriptLocation === undefined) {
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
              <button onClick={() => handleRedownloadTranscript(download.id)}>
                <MdOutlineFileDownload
                  size={18}
                  className="mt-2 text-green-600 hover:text-green-400 transition-colors duration-200"
                />
              </button>
            </TooltipWrapper>
          );
        }

        /* ---------- View transcript ---------- */
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
      })()}
    </div>
  );
};

export default TranscrptButton;
