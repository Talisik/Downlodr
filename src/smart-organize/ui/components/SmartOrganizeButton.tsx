import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { redownloadTranscript } from '@/downlodr/utils/transcription/ffmpegWhisperTranscriber';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { useAddonStore } from '@/core-app/store/addonStore';
import { transcriptActions } from '@/transcript/store/transcriptStore';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NoTranscriptModal from '../../components/organizationModal/NoTranscriptModal';
import ConfirmOrganize from '../../components/organizationModal/ConfirmOrganize';
import type { SmartOrganizeDownloadInput } from '../../schema/smartOrganizeTypes';
import { useOrganizationStore } from '../../store/organizationStore';
import { useSmartOrganize } from '../hooks/useSmartOrganize';
import SmartOrganizeProgressToast from './SmartOrganizeProgressToast';
import TranscriptDownloadProgressModal from './TranscriptDownloadProgressModal';

interface SmartOrganizeButtonProps {
  mode?: 'all' | 'selected';
  selectedIds?: string[];
}

/**
 * Taskbar button that opens the Smart Organize modal.
 * In 'all' mode: collects all finished + history downloads that have a transcript on disk.
 * In 'selected' mode: organizes only the downloads whose IDs are in selectedIds.
 */
const SmartOrganizeButton: React.FC<SmartOrganizeButtonProps> = ({
  mode = 'all',
  selectedIds = [],
}) => {
  const navigate = useNavigate();
  const { setOrganizationData } = useOrganizationStore();
  const { state, progress, result, error, start, reset } = useSmartOrganize();

  const [isOpen, setIsOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [eligibleDownloads, setEligibleDownloads] = useState<any[]>([]);
  const [runningCount, setRunningCount] = useState(0);

  // No-transcript modal state
  const [showNoTranscriptModal, setShowNoTranscriptModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ineligibleDownloads, setIneligibleDownloads] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [allSourceDownloads, setAllSourceDownloads] = useState<any[]>([]);

  // "Wait for all" — watching for caption generation to finish
  const [waitingForCaptions, setWaitingForCaptions] = useState(false);
  const [waitingIds, setWaitingIds] = useState<string[]>([]);

  // Transcript download progress modal
  const [showTranscriptProgress, setShowTranscriptProgress] = useState(false);
  const [transcriptProgressIds, setTranscriptProgressIds] = useState<string[]>(
    [],
  );
  // Pending downloads to pass to ConfirmOrganize once transcripts finish
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingAllDownloads, setPendingAllDownloads] = useState<any[]>([]);

  // Subscribe to store so the wait-for-captions effect re-runs on transcriptionStatus changes
  const finishedDownloads = useDownloadStore((s) => s.finishedDownloads);
  const historyDownloads = useDownloadStore((s) => s.historyDownloads);
  const smartOrganizeDownloaded = useAddonStore(
    (s) => s.smartOrganize.status === 'ready',
  );

  // Only video downloads (present in the video download store) count toward
  // enabling the button — article selections from AFDA don't apply here.
  const selectedVideoCount =
    mode === 'selected'
      ? selectedIds.filter((id) => finishedDownloads.some((d) => d.id === id))
          .length
      : 0;
  const isDisabled = mode === 'selected' && selectedVideoCount === 0;

  // When the AI finishes, apply categories and navigate to /organization
  useEffect(() => {
    if (state === 'done' && result) {
      const groups: Record<
        string,
        { video_id: string; video_title: string }[]
      > = {};
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
      reset();
      navigate('/organization');
    }
  }, [state, result]);

  // Watch for caption generation to complete after "Wait for all"
  useEffect(() => {
    if (!waitingForCaptions || waitingIds.length === 0) return;

    const pool = [...finishedDownloads, ...historyDownloads];
    const allDone = waitingIds.every((id) => {
      const d = pool.find((x) => x.id === id);
      return (
        d?.transcriptionStatus === 'completed' ||
        d?.transcriptionStatus === 'failed'
      );
    });

    if (allDone) {
      setWaitingForCaptions(false);
      setWaitingIds([]);
      // Re-open ConfirmOrganize with fresh store data
      const updatedSelected = allSourceDownloads.map((src) => {
        const updated = pool.find((x) => x.id === src.id) ?? src;
        return {
          id: updated.id,
          name: updated.name,
          downloadName: updated.name,
          status: updated.status ?? 'finished',
          download: updated,
        };
      });
      setEligibleDownloads(updatedSelected);
      setIsOpen(true);
    }
  }, [waitingForCaptions, waitingIds, finishedDownloads, historyDownloads]);

  // ── Store helpers (pattern from TranscrptButton.tsx) ──────────────────────

  const setDownloadTranscriptionStatus = (
    id: string,
    status: 'transcribing' | 'completed' | 'failed',
  ) => {
    useDownloadStore.setState((s) => {
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
        forDownloads: s.forDownloads.map(withStatus),
        downloading: s.downloading.map(withStatus),
        finishedDownloads: s.finishedDownloads.map(withStatus),
        historyDownloads: s.historyDownloads.map(withStatus),
        queuedDownloads: s.queuedDownloads.map(withStatus),
      };
    });
  };

  const setDownloadTranscriptionProgress = (id: string, percent: number) => {
    useDownloadStore.setState((s) => {
      const withProgress = <
        T extends { id: string; transcriptionProgress?: number },
      >(
        d: T,
      ): T => (d.id === id ? { ...d, transcriptionProgress: percent } : d);
      return {
        forDownloads: s.forDownloads.map(withProgress),
        downloading: s.downloading.map(withProgress),
        finishedDownloads: s.finishedDownloads.map(withProgress),
        historyDownloads: s.historyDownloads.map(withProgress),
        queuedDownloads: s.queuedDownloads.map(withProgress),
      };
    });
  };

  // ── Open handler ──────────────────────────────────────────────────────────

  const handleOpen = () => {
    const pool = [...useDownloadStore.getState().finishedDownloads];

    const source =
      mode === 'selected'
        ? pool.filter((d) => selectedIds.includes(d.id))
        : pool;

    // Mirror the isValidLocation check from TranscrptButton.tsx
    const getTranscriptLocation = (d: (typeof source)[number]) =>
      typeof d.transcriptLocation === 'string'
        ? d.transcriptLocation
        : d.autoCaptionLocation;

    const isValidTranscript = (d: (typeof source)[number]) => {
      const loc = getTranscriptLocation(d);
      return !!loc && loc.trim() !== '' && loc !== 'iu' && loc !== 'fu';
    };

    const eligible = source.filter(isValidTranscript).map((d) => ({
      id: d.id,
      name: d.name,
      downloadName: d.name,
      status: d.status ?? 'finished',
      download: d,
    }));

    // Matches "Generate Caption" button condition in TranscrptButton:
    // transcriptLocation is defined but invalid, and not currently transcribing
    const neverStarted = source.filter((d) => {
      const loc = getTranscriptLocation(d);
      return (
        !isValidTranscript(d) &&
        loc !== undefined &&
        d.transcriptionStatus !== 'transcribing'
      );
    });

    // Deduplicate eligible
    const deduped = new Map(eligible.map((d) => [d.id, d]));
    const eligibleDeduped = [...deduped.values()];

    if (neverStarted.length > 0) {
      // Show NoTranscriptModal only for videos that haven't started generating captions
      setIneligibleDownloads(neverStarted);
      setAllSourceDownloads(source);
      setEligibleDownloads(eligibleDeduped);
      setShowNoTranscriptModal(true);
      return;
    }

    // No never-started videos — go straight to ConfirmOrganize.
    // Videos with transcriptionStatus === 'transcribing' will appear as the processing row there.
    const allAsSelected = source.map((d) => ({
      id: d.id,
      name: d.name,
      downloadName: d.name,
      status: d.status ?? 'finished',
      download: d,
    }));
    const dedupedAll = new Map(allAsSelected.map((d) => [d.id, d]));
    setEligibleDownloads([...dedupedAll.values()]);
    setIsOpen(true);
  };

  // ── Caption generation (triggered by "Next" in NoTranscriptModal) ─────────

  const handleGenerateCaptions = async () => {
    setShowNoTranscriptModal(false);

    const { updateDownloadTranscript } = transcriptActions(
      useDownloadStore.setState,
      useDownloadStore.getState,
    );

    for (const d of ineligibleDownloads) {
      setDownloadTranscriptionStatus(d.id, 'transcribing');

      const inputLocation = await window.downlodrFunctions.joinDownloadPath(
        d.location,
        d.downloadName,
      );
      const outputLocation = await window.downlodrFunctions.joinDownloadPath(
        d.location,
        d.downloadName.replace(/\.[^/.]+$/, '.srt'),
      );

      redownloadTranscript(
        {
          inputFile: inputLocation,
          outputFile: outputLocation,
          // ggml-small.bin is the only model bundled (forge.config.ts
          // extraResource). This asked for ggml-base.bin, which ships nowhere,
          // so Smart Organize transcription could never succeed.
          modelPath: 'ggml-small.bin',
          // 'auto', not 'en': forcing English makes Whisper *translate* non-English
          // audio into English rather than transcribe it in its own language.
          language: 'auto',
          format: 'srt',
        },
        {
          onProgressPercent: (percent) =>
            setDownloadTranscriptionProgress(d.id, percent),
        },
      ).then((result) => {
        if (result.success && result.outputFile) {
          setDownloadTranscriptionStatus(d.id, 'completed');
          updateDownloadTranscript(d.id, result.outputFile);
        } else {
          setDownloadTranscriptionStatus(d.id, 'failed');
        }
      });
    }

    // Show transcript progress modal; open ConfirmOrganize once all transcripts finish.
    const ineligibleIds = new Set(ineligibleDownloads.map((d) => d.id));
    const allAsSelected = allSourceDownloads.map((d) => ({
      id: d.id,
      name: d.name,
      downloadName: d.name,
      status: d.status ?? 'finished',
      download: ineligibleIds.has(d.id)
        ? { ...d, transcriptionStatus: 'transcribing' }
        : d,
    }));
    setPendingAllDownloads(allAsSelected);
    setTranscriptProgressIds(ineligibleDownloads.map((d) => d.id));
    setShowTranscriptProgress(true);
  };

  // ── Called when all transcripts finish downloading ────────────────────────

  const handleTranscriptProgressComplete = () => {
    setShowTranscriptProgress(false);
    const pool = [
      ...useDownloadStore.getState().finishedDownloads,
      ...useDownloadStore.getState().historyDownloads,
    ];
    const updated = pendingAllDownloads.map((d) => {
      const live = pool.find((x) => x.id === d.id);
      return live
        ? { ...d, download: live, status: live.status ?? d.status }
        : d;
    });
    setEligibleDownloads(updated);
    setIsOpen(true);
  };

  // ── "Wait for all" — closes modal, waits for captions, re-opens ──────────

  const handleWaitForAll = () => {
    setIsOpen(false);
    setWaitingForCaptions(true);
    setWaitingIds(ineligibleDownloads.map((d) => d.id));
  };

  // ── Confirm (start smart organize) ────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleConfirm = (readyDownloads: any[]) => {
    setIsOpen(false);
    const inputs: SmartOrganizeDownloadInput[] = readyDownloads.map((d) => ({
      id: d.id,
      name: d.name ?? d.downloadName ?? '',
      transcriptLocation:
        (typeof d.download?.transcriptLocation === 'string'
          ? d.download.transcriptLocation
          : d.download?.autoCaptionLocation) ?? '',
    }));
    setRunningCount(inputs.length);
    start(inputs);
  };

  return (
    <>
      <TooltipWrapper
        content={
          !smartOrganizeDownloaded
            ? 'Download the Smart Organize add-on to use this feature'
            : isDisabled
            ? 'Select at least one video download to organize'
            : 'Organize your videos into categories using Smart Organize'
        }
        side="bottom"
      >
        <button
          type="button"
          onClick={() => {
            if (!smartOrganizeDownloaded) {
              useAddonStore
                .getState()
                .setAddonManagerOpen(true, 'smart-organize-required');
              return;
            }
            if (!isDisabled) handleOpen();
          }}
          aria-disabled={isDisabled}
          className={`px-3 py-1 rounded font-semibold text-primary ${
            isDisabled || !smartOrganizeDownloaded
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-gray-100 dark:hover:bg-darkModeCompliment'
          }`}
        >
          Smart Organize
        </button>
      </TooltipWrapper>

      <NoTranscriptModal
        show={showNoTranscriptModal}
        ineligibleDownloads={ineligibleDownloads}
        totalCount={allSourceDownloads.length}
        onCancel={() => setShowNoTranscriptModal(false)}
        onNext={handleGenerateCaptions}
      />

      <TranscriptDownloadProgressModal
        show={showTranscriptProgress}
        transcribingIds={transcriptProgressIds}
        onClose={() => setShowTranscriptProgress(false)}
        onComplete={handleTranscriptProgressComplete}
      />

      <ConfirmOrganize
        show={isOpen}
        onClose={() => setIsOpen(false)}
        selectedDownloads={eligibleDownloads}
        setActiveMenu={() => {}}
        onConfirm={handleConfirm}
        onWaitForAll={handleWaitForAll}
      />

      {(state === 'running' || state === 'error') && (
        <SmartOrganizeProgressToast
          state={state}
          progress={progress}
          error={error}
          totalVideos={runningCount}
          onDismissError={reset}
        />
      )}
    </>
  );
};

export default SmartOrganizeButton;
