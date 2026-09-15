import React from 'react';
import { HiOutlineSquares2X2 } from 'react-icons/hi2';
import { IoCheckmarkCircleOutline } from 'react-icons/io5';
import type { SmartOrganizeProgress } from '../../schema/smartOrganizeTypes';

interface SmartOrganizeProgressToastProps {
  progress: SmartOrganizeProgress | null;
  error: string | null;
  state: 'running' | 'error';
  totalVideos: number;
  onDismissError: () => void;
}

function ProgressBar({ current, total }: { current?: number; total?: number }) {
  const hasCounts = current !== undefined && total !== undefined && total > 0;
  const pct = hasCounts ? Math.round((current / total) * 100) : 0;

  return (
    <div className="w-full h-1.5 rounded-full bg-[#D5D5D5] overflow-hidden">
      {hasCounts ? (
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      ) : (
        <div className="h-full w-3/3 rounded-full bg-primary animate-[shimmer_1.4s_ease-in-out_infinite]" />
      )}
    </div>
  );
}

const SmartOrganizeProgressToast: React.FC<SmartOrganizeProgressToastProps> = ({
  progress,
  error,
  state,
  totalVideos,
  onDismissError,
}) => {
  const hasCounts =
    progress?.current !== undefined &&
    progress?.total !== undefined &&
    progress.total > 0;
  const pct = hasCounts
    ? Math.round((progress!.current! / progress!.total!) * 100)
    : 0;

  if (state === 'error') {
    return (
      <div className="fixed bottom-5 right-5 z-50 w-80 rounded-xl shadow-xl overflow-hidden">
        {/* Red header */}
        <div className="bg-red-500 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HiOutlineSquares2X2
              size={20}
              className="text-white flex-shrink-0"
            />
            <div>
              <p className="text-white font-bold text-[13px] leading-tight">
                Organizing failed
              </p>
              <p className="text-white/80 text-[11px]">Something went wrong</p>
            </div>
          </div>
        </div>
        {/* Body */}
        <div className="bg-white dark:bg-[#3D3D3D] px-4 py-3 space-y-2">
          <p className="text-[12px] text-gray-600 dark:text-gray-300 break-words">
            {error ?? 'Unknown error'}
          </p>
          <button
            type="button"
            onClick={onDismissError}
            className="text-[11px] text-primary hover:underline"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 rounded-xl shadow-xl overflow-hidden">
      {/* Orange header */}
      <div className="bg-primary px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <HiOutlineSquares2X2 size={22} className="text-white flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-bold text-[13px] leading-tight">
              Organizing videos
            </p>
            <p className="text-white/80 text-[11px]">
              {totalVideos} {totalVideos === 1 ? 'video' : 'videos'} across
              categories
            </p>
          </div>
        </div>
        <IoCheckmarkCircleOutline size={22} className="text-white/80 flex-shrink-0" />
      </div>

      {/* Body */}
      <div className="bg-white px-4 pb-3 pt-2 space-y-2">
        <p className="text-black text-[12px] leading-relaxed truncate">
          {progress?.message ?? 'Starting...'}
        </p>
        <ProgressBar current={progress?.current} total={progress?.total} />
        <p className="text-black text-[11px]">
          {hasCounts ? `${pct}%` : '100%'}
        </p>
      </div>
    </div>
  );
};

export default SmartOrganizeProgressToast;
