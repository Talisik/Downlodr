import { useDownloadStore } from '@/downlodr/store/downloadStore';
import React, { useEffect, useRef, useState } from 'react';
import { FaRegClosedCaptioning } from 'react-icons/fa';
import { IoMdClose } from 'react-icons/io';

interface TranscriptDownloadProgressModalProps {
  show: boolean;
  transcribingIds: string[];
  onClose: () => void;
  onComplete: () => void;
}

const TranscriptDownloadProgressModal: React.FC<
  TranscriptDownloadProgressModalProps
> = ({ show, transcribingIds, onClose, onComplete }) => {
  const finishedDownloads = useDownloadStore((s) => s.finishedDownloads);
  const historyDownloads = useDownloadStore((s) => s.historyDownloads);

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (show) {
      setElapsed(0);
      timerRef.current = setInterval(
        () => setElapsed((e) => e + 1),
        1000,
      );
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [show]);

  const pool = [...finishedDownloads, ...historyDownloads];
  const downloads = transcribingIds
    .map((id) => pool.find((d) => d.id === id))
    .filter(Boolean) as (typeof pool)[number][];

  const total = transcribingIds.length;
  const completedCount = downloads.filter(
    (d) =>
      d.transcriptionStatus === 'completed' ||
      d.transcriptionStatus === 'failed',
  ).length;

  // Average progress across all downloads (completed ones count as 100)
  const combinedProgress =
    total > 0
      ? downloads.reduce((sum, d) => {
          if (
            d.transcriptionStatus === 'completed' ||
            d.transcriptionStatus === 'failed'
          )
            return sum + 100;
          return sum + (d.transcriptionProgress ?? 0);
        }, 0) / total
      : 0;

  const pct = Math.round(combinedProgress);
  const ordinal = Math.min(completedCount + 1, total);

  // Auto-advance when all transcripts are done
  useEffect(() => {
    if (show && total > 0 && completedCount >= total) {
      onCompleteRef.current();
    }
  }, [show, completedCount, total]);

  if (!show) return null;

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 rounded-xl shadow-xl overflow-hidden">
      {/* Orange header */}
      <div className="bg-primary px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaRegClosedCaptioning size={20} className="text-white flex-shrink-0" />
          <p className="text-white font-bold text-[13px] leading-tight">
            Downloading transcript
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-white/80 hover:text-white"
        >
          <IoMdClose size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="bg-white dark:bg-[#3D3D3D] px-4 pb-3 pt-2 space-y-2">
        <p className="text-[12px] text-gray-700 dark:text-gray-200">
          {ordinal} of {total} transcript downloading
        </p>
        <div className="w-full h-1.5 rounded-full bg-[#D5D5D5] overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between">
          <p className="text-[11px] text-gray-700 dark:text-gray-200">{pct}%</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {mm}:{ss}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TranscriptDownloadProgressModal;
