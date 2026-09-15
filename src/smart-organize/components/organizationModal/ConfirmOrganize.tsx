import FolderTree from '@/assets/icon/FolderTree';
import { Button } from '@/core-app/components/shadcn/components/ui/button';
import useDownloadStore from '@/downlodr/store/downloadStore';
import { SelectedDownload } from '@/Store/mainStore';
import React, { useEffect, useMemo, useRef } from 'react';
import { FaCheck } from 'react-icons/fa6';
import { FiInfo } from 'react-icons/fi';
import { IoMdClose } from 'react-icons/io';
// TypeScript interfaces for event handlers
type DivClickEvent = React.MouseEvent<HTMLDivElement>;

const CircularProgressCount = ({
  ready,
  total,
  arcProgress,
}: {
  ready: number;
  total: number;
  arcProgress: number; // 0–100, drives the arc fill
}) => {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - arcProgress / 100);

  return (
    <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-gray-200 dark:text-neutral-600"
        />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="text-amber-400 dark:text-amber-500 transition-all duration-500"
        />
      </svg>
      <span className="absolute text-xs font-bold text-gray-700 dark:text-gray-200">
        {ready}/{total}
      </span>
    </div>
  );
};

interface ConfirmOrganizeProps {
  show: boolean;
  selectedDownloads: SelectedDownload[];
  onClose: () => void;
  setActiveMenu: (menu: string | null) => void;
  onConfirm: (downloads: SelectedDownload[]) => void;
  onWaitForAll?: () => void;
}

const ConfirmOrganize: React.FC<ConfirmOrganizeProps> = ({
  show,
  selectedDownloads,
  onClose,
  onConfirm,
  onWaitForAll,
}) => {
  const finishedDownloads = useDownloadStore((s) => s.finishedDownloads);
  const historyDownloads = useDownloadStore((s) => s.historyDownloads);

  // Merge prop IDs with live store data so progress updates re-render the modal
  const liveDownloads = useMemo(() => {
    const pool = [...finishedDownloads, ...historyDownloads];
    return selectedDownloads.map((sd) => {
      const live = pool.find((d) => d.id === sd.id);
      if (!live) return sd;
      return { ...sd, status: live.status ?? sd.status, download: live };
    });
  }, [selectedDownloads, finishedDownloads, historyDownloads]);

  // Freeze the "without transcript" count when the modal first opens
  const frozenTotal = useRef<number | null>(null);
  useEffect(() => {
    if (show && frozenTotal.current === null) {
      frozenTotal.current = liveDownloads.filter(
        (d) => d.download?.transcriptionStatus !== 'completed',
      ).length;
    }
  }, [show]); // intentionally excludes liveDownloads — value is frozen on first open

  // Snapshot which videos were transcribing when modal opened, to track ordinal progress
  const initialTranscribingIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (show) {
      initialTranscribingIds.current = new Set(
        liveDownloads
          .filter((d) => d.download?.transcriptionStatus === 'transcribing')
          .map((d) => d.id),
      );
    }
  }, [show]); // intentionally excludes liveDownloads — snapshot on open only

  if (!show) return null;

  // Split downloads by status — also treat caption-generating videos as "processing"
  const readyDownloads = liveDownloads.filter(
    (d) =>
      d.status === 'finished' &&
      d.download?.transcriptionStatus !== 'transcribing',
  );
  const processingDownloads = liveDownloads.filter(
    (d) =>
      d.status !== 'finished' ||
      d.download?.transcriptionStatus === 'transcribing',
  );
  const totalSelected = liveDownloads.filter(
    (d) => d.download?.transcriptionStatus !== 'completed',
  ).length;

  const completedFromInitial = liveDownloads.filter(
    (d) =>
      initialTranscribingIds.current.has(d.id) &&
      d.download?.transcriptionStatus === 'completed',
  ).length;
  const currentTranscriptOrdinal = Math.min(
    completedFromInitial + 1,
    frozenTotal.current ?? totalSelected,
  );

  const canProceed = readyDownloads.length > 0;

  const isGeneratingCaptions = processingDownloads.some(
    (d) => d.download?.transcriptionStatus === 'transcribing',
  );

  // Header content
  const headerTitle =
    readyDownloads.length === 0
      ? 'Videos Still Processing'
      : processingDownloads.length > 0
      ? 'Almost ready to organize!'
      : `Ready to organize ${readyDownloads.length} videos`;

  const headerSubtitle =
    readyDownloads.length === 0
      ? `${processingDownloads.length} of ${totalSelected} videos are still in progress. Please wait.`
      : processingDownloads.length > 0
      ? `A few videos are still in progress`
      : `Let's sort these into categories`;

  const SmartOrganizeInfo =
    readyDownloads.length === 0
      ? isGeneratingCaptions
        ? 'Captions are being generated for your selected videos. You can wait for them to finish or come back later.'
        : 'Some of your selected videos are still being downloaded or having their metadata fetched.'
      : processingDownloads.length > 0
      ? isGeneratingCaptions
        ? 'Some of your selected videos are still having their captions generated.'
        : 'Some of your selected videos are still being downloaded or having their metadata fetched.'
      : `Smart Organize will analyze your videos and suggest categories based on their content. This usually takes a moment depending on how many videos you've selected.`;

  // Body renderer
  const renderBody = () => {
    if (readyDownloads.length === 0) {
      return (
        <div className="text-center text-gray-700 dark:text-gray-200">
          <p>Please wait until the videos finish processing.</p>
          <ul className="mt-2 list-disc list-inside text-left text-sm">
            {processingDownloads.map((d) => (
              <li key={d.id}>{d.name || d.downloadName || 'Untitled'}</li>
            ))}
          </ul>
        </div>
      );
    }

    if (processingDownloads.length > 0) {
      return (
        <div className="py-0.5 rounded-md bg-gray-100 dark:bg-[#474747]">
          {/* Ready summary row */}
          <div className="mx-4 my-2 flex flex-row justify-between items-center">
            <div className="flex flex-row justify-start items-center">
              <div className="py-2 px-2 items-center justify-center bg-green-300/70 dark:bg-green-700/40 rounded-md text-green-700 dark:text-green-400">
                <FaCheck size={18} color="#34C759" />
              </div>
              <div className="py-1 px-2 items-center justify-center">
                <h1 className="font-semibold text-sm">Ready to organize</h1>
                <p className="text-gray-500 dark:text-gray-400">
                  Fully downloaded with metadata
                </p>
              </div>
            </div>
            <div className="py-1 px-3 items-center justify-center bg-gray-200 dark:bg-neutral-600 rounded-md">
              <span className="font-bold">{readyDownloads.length}</span>
            </div>
          </div>

          <div className="border-2 border-b border-titleBarBorder dark:border-neutral-600"></div>

          {/* Grouped processing summary */}
          <div className="mx-1 my-2 flex flex-row justify-start items-center">
            <CircularProgressCount
              ready={currentTranscriptOrdinal}
              total={frozenTotal.current ?? totalSelected}
              arcProgress={(() => {
                const current = processingDownloads[0];
                if (!current) return 100;
                if (current.download?.transcriptionStatus === 'transcribing') {
                  return current.download?.transcriptionProgress ?? 0;
                }
                return 0;
              })()}
            />
            <div className="flex flex-col justify-center">
              <h1 className="font-semibold text-sm">Still downloading</h1>
              {processingDownloads.filter(
                (d) =>
                  d.status !== 'finished' &&
                  d.download?.transcriptionStatus !== 'transcribing',
              ).length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {
                    processingDownloads.filter(
                      (d) =>
                        d.status !== 'finished' &&
                        d.download?.transcriptionStatus !== 'transcribing',
                    ).length
                  }{' '}
                  fetching metadata...
                </p>
              )}
              {processingDownloads.filter(
                (d) => d.download?.transcriptionStatus === 'transcribing',
              ).length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {
                    processingDownloads.filter(
                      (d) => d.download?.transcriptionStatus === 'transcribing',
                    ).length
                  }{' '}
                  fetching metadata...
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    // All ready
    return (
      <div className="py-4 px-2 rounded-md bg-gray-100 dark:bg-[#474747] flex flex-row justify-start gap-2 border-l-4 border-blue-500 dark:border-blue-500">
        <div className="justify-center items-center py-1 text-blue-500 dark:text-blue-500">
          <FiInfo size={20} />
        </div>
        <div className="justify-start items-center space-x-0.5">
          <span className="text-start font-bold">Heads up: </span>
          <span className="text-start">
            Once started, the organizing process will run until its complete.
            Feel free to use Downlodr while you wait for the results to finish.
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e: DivClickEvent) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-[#3D3D3D] rounded-lg p-4 w-full max-w-md shadow-lg"
        onClick={(e: DivClickEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-lightOrange dark:bg-orange-700/40 text-primary dark:text-orange-500 rounded-md p-2">
              <FolderTree className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">
                {headerTitle}
              </h3>
              <p>{headerSubtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 mb-8"
          >
            <IoMdClose size={16} />
          </button>
        </div>

        <div className="space-y-4 mb-4">
          <div className="p-4 rounded-md bg-gray-100 dark:bg-[#474747]">
            <p>{SmartOrganizeInfo}</p>
          </div>

          {/* Body */}
          <div className="mb-6">
            <div>{renderBody()}</div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-end gap-3 p-2">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex items-center border border-lightBorder dark:border-secondarkDarkHover rounded-md justify-center gap-2 py-4 px-4 bg-white dark:bg-[#3D3D3D] dark:hover:bg-secondarkDarkHover"
          >
            Cancel
          </Button>

          <Button
            onClick={() => onConfirm(readyDownloads)}
            disabled={!canProceed}
            className={
              processingDownloads.length > 0
                ? `flex items-center text-black border border-lightBorder dark:border-secondarkDarkHover rounded-md justify-center gap-2 py-4 px-4 bg-[#E6E6E6] hover:bg-[#E6E6E6] dark:bg-[#3D3D3D] dark:hover:bg-secondarkDarkHover ${
                    !canProceed ? 'opacity-50 cursor-not-allowed' : ''
                  }`
                : `flex items-center justify-center py-4 px-4 bg-primary text-white rounded-md dark:bg-primary dark:text-white hover:bg-primaryDarkHover hover:dark:text-black ${
                    !canProceed ? 'opacity-50 cursor-not-allowed' : ''
                  }`
            }
          >
            <div className="flex items-center gap-2">
              <span>
                {processingDownloads.length > 0
                  ? 'Skip downloads'
                  : 'Run Smart Organize'}
              </span>
            </div>
          </Button>

          {processingDownloads.length > 0 && onWaitForAll && (
            <Button
              onClick={onWaitForAll}
              className="flex items-center justify-center py-4 px-4 bg-primary text-white rounded-md dark:bg-primary dark:text-white hover:bg-primaryDarkHover hover:dark:text-black"
            >
              Wait for all
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfirmOrganize;
