import BaseModal from '@/downlodr/components/modal/BaseModal';
import React from 'react';
import type { SmartOrganizeDownloadInput } from '../../schema/smartOrganizeTypes';
import { useOrganizationStore } from '../../store/organizationStore';
import { useSmartOrganize } from '../hooks/useSmartOrganize';
import { useNavigate } from 'react-router-dom';

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current?: number; total?: number }) {
  const hasCounts = current !== undefined && total !== undefined && total > 0;
  const pct = hasCounts ? Math.round((current / total) * 100) : 0;

  return (
    <div className="w-full h-1.5 rounded-full bg-lightGray dark:bg-darkModeCompliment overflow-hidden">
      {hasCounts ? (
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      ) : (
        // Indeterminate — sliding shimmer
        <div className="h-full w-1/3 rounded-full bg-primary animate-[shimmer_1.4s_ease-in-out_infinite]" />
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-5 h-5 rounded-full border-2 border-lightGray dark:border-darkModeCompliment border-t-primary animate-spin flex-shrink-0" />
  );
}

// ─── Panels ───────────────────────────────────────────────────────────────────

interface IdlePanelProps {
  eligibleCount: number;
  onStart: () => void;
  onClose: () => void;
}

function IdlePanel({ eligibleCount, onStart, onClose }: IdlePanelProps) {
  return (
    <>
      <div className="space-y-4 py-4">
        <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
          Automatically groups your videos into semantic categories using local
          AI — no internet connection required.
        </p>
        <p className="text-[13px] text-gray-700 dark:text-gray-300">
          <span className="font-semibold">{eligibleCount}</span>{' '}
          {eligibleCount === 1 ? 'video' : 'videos'} with transcripts will be
          analyzed.
        </p>
        {eligibleCount === 0 && (
          <p className="text-[12px] text-gray-500 dark:text-gray-400">
            No downloads with transcripts found. Add transcripts to your
            downloads to use Smart Organize.
          </p>
        )}
      </div>

      <hr className="-mx-6 w-[calc(100%+48px)] border-t border-divider dark:border-gray-700" />

      <div className="flex justify-end space-x-3 py-3">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200 text-[13px]"
        >
          Close
        </button>
        <button
          type="button"
          onClick={onStart}
          disabled={eligibleCount === 0}
          className="px-3 py-1 bg-primary text-white dark:text-darkModeLight rounded-md hover:bg-primary/90 dark:hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-[13px]"
        >
          Start
        </button>
      </div>
    </>
  );
}

function RunningPanel({
  message,
  current,
  total,
  onCancel,
}: {
  message: string;
  current?: number;
  total?: number;
  onCancel: () => void;
}) {
  const hasCounts = current !== undefined && total !== undefined && total > 0;

  return (
    <>
      <div className="space-y-4 py-4">
        <div className="flex items-center gap-3">
          <Spinner />
          <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
            {message}
          </p>
        </div>

        <ProgressBar current={current} total={total} />

        {hasCounts && (
          <p className="text-[12px] text-gray-500 dark:text-gray-400 text-right">
            {current} / {total}
          </p>
        )}
      </div>

      <hr className="-mx-6 w-[calc(100%+48px)] border-t border-divider dark:border-gray-700" />

      <div className="flex justify-end py-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200 text-[13px]"
        >
          Cancel
        </button>
      </div>
    </>
  );
}

function ResultsPanel({
  clusters,
  categoryContexts,
  onApply,
  onDiscard,
}: {
  clusters: {
    cluster_id: string;
    category_tag: string;
    video_ids: string[];
    video_titles: string[];
  }[];
  categoryContexts?: Record<string, string>;
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <>
      <div className="py-4 space-y-1">
        <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {clusters.length} {clusters.length === 1 ? 'category' : 'categories'}{' '}
          found
        </p>

        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {clusters.map((cluster) => (
            <div key={cluster.cluster_id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                  {cluster.category_tag}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 bg-recurringTag dark:bg-darkModeCompliment px-1.5 py-0.5 rounded">
                  {cluster.video_ids.length}{' '}
                  {cluster.video_ids.length === 1 ? 'video' : 'videos'}
                </span>
              </div>

              {categoryContexts?.[cluster.category_tag] && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  {categoryContexts[cluster.category_tag]}
                </p>
              )}

              <ul className="space-y-0.5 pl-2">
                {cluster.video_titles.map((title, i) => (
                  <li
                    key={i}
                    className="text-[12px] text-gray-600 dark:text-gray-400 truncate"
                    title={title}
                  >
                    {title}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <hr className="-mx-6 w-[calc(100%+48px)] border-t border-divider dark:border-gray-700" />

      <div className="flex justify-end space-x-3 py-3">
        <button
          type="button"
          onClick={onDiscard}
          className="px-3 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200 text-[13px]"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onApply}
          className="px-3 py-1 bg-primary text-white dark:text-darkModeLight rounded-md hover:bg-primary/90 dark:hover:bg-primary/90 text-[13px]"
        >
          Apply Categories
        </button>
      </div>
    </>
  );
}

function ErrorPanel({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <>
      <div className="py-4">
        <p className="text-[13px] text-gray-700 dark:text-gray-300">
          Something went wrong:
        </p>
        <p className="text-[12px] text-red-500 dark:text-red-400 mt-1 break-words">
          {message}
        </p>
      </div>

      <hr className="-mx-6 w-[calc(100%+48px)] border-t border-divider dark:border-gray-700" />

      <div className="flex justify-end pt-3 pb-1">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200 text-[13px]"
        >
          Close
        </button>
      </div>
    </>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface SmartOrganizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-filtered eligible downloads (must have transcriptLocation set). */
  eligibleDownloads: SmartOrganizeDownloadInput[];
}

const SmartOrganizeModal: React.FC<SmartOrganizeModalProps> = ({
  isOpen,
  onClose,
  eligibleDownloads,
}) => {
  const navigate = useNavigate();
  const { setOrganizationData } = useOrganizationStore();
  const {
    state,
    progress,
    result,
    error,
    start,
    cancel,
    reset,
    applyCategories,
  } = useSmartOrganize();

  const handleClose = () => {
    if (state === 'running') return; // block closing while running
    reset();
    onClose();
  };

  const handleStart = () => {
    start(eligibleDownloads);
  };

  const handleApply = () => {
    if (result) {
      const groups: Record<string, { video_id: string; video_title: string }[]> = {};
      for (const cluster of result.clusters) {
        groups[cluster.category_tag] = cluster.video_ids.map((id, i) => ({
          video_id: id,
          video_title: cluster.video_titles[i] ?? id,
        }));
      }
      setOrganizationData({
        groups,
        category_contexts: result.category_contexts ?? {},
        timestamp: Date.now(),
      });
    }
    applyCategories();
    reset();
    onClose();
    navigate('/organization');
  };

  const handleDiscard = () => {
    reset();
    onClose();
  };

  const title =
    state === 'done' ? 'Smart Organize — Results' : 'Smart Organize';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      width="max-w-md"
      closeOnOverlay={state !== 'running'}
      showCloseButton={state !== 'running'}
    >
      {state === 'idle' && (
        <IdlePanel
          eligibleCount={eligibleDownloads.length}
          onStart={handleStart}
          onClose={handleClose}
        />
      )}

      {state === 'running' && (
        <RunningPanel
          message={progress?.message ?? 'Starting...'}
          current={progress?.current}
          total={progress?.total}
          onCancel={cancel}
        />
      )}

      {state === 'done' && result && (
        <ResultsPanel
          clusters={result.clusters}
          categoryContexts={result.category_contexts}
          onApply={handleApply}
          onDiscard={handleDiscard}
        />
      )}

      {state === 'error' && (
        <ErrorPanel message={error ?? 'Unknown error'} onClose={handleClose} />
      )}
    </BaseModal>
  );
};

export default SmartOrganizeModal;
