import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import useDownloadStore from '@/downlodr/store/downloadStore';
import { transcriptActions } from '@/transcript/store/transcriptStore';
import { redownloadTranscript } from './ffmpegWhisperTranscriber';

const MAX_CONCURRENT = 2;

export interface TranscriptJob {
  downloadId: string;
  location: string;
  downloadName: string;
}

let running = 0;
const pendingJobs: TranscriptJob[] = [];
const runningIds = new Set<string>();

function setStatus(
  id: string,
  status: 'queued' | 'transcribing' | 'completed' | 'failed',
): void {
  useDownloadStore.setState((state) => {
    const update = <
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
      forDownloads: state.forDownloads.map(update),
      downloading: state.downloading.map(update),
      finishedDownloads: state.finishedDownloads.map(update),
      historyDownloads: state.historyDownloads.map(update),
      queuedDownloads: state.queuedDownloads.map(update),
    };
  });
}

function setProgress(id: string, percent: number): void {
  useDownloadStore.setState((state) => {
    const update = <T extends { id: string; transcriptionProgress?: number }>(
      d: T,
    ): T => (d.id === id ? { ...d, transcriptionProgress: percent } : d);
    return {
      forDownloads: state.forDownloads.map(update),
      downloading: state.downloading.map(update),
      finishedDownloads: state.finishedDownloads.map(update),
      historyDownloads: state.historyDownloads.map(update),
      queuedDownloads: state.queuedDownloads.map(update),
    };
  });
}

async function runJob(job: TranscriptJob): Promise<void> {
  const inputLocation = await window.downlodrFunctions.joinDownloadPath(
    job.location,
    job.downloadName,
  );
  const outputLocation = await window.downlodrFunctions.joinDownloadPath(
    job.location,
    job.downloadName.replace(/\.[^/.]+$/, '.srt'),
  );

  const result = await redownloadTranscript(
    {
      inputFile: inputLocation,
      outputFile: outputLocation,
      modelPath: 'ggml-small.bin',
      language: 'auto',
      format: 'srt',
    },
    {
      onProgressPercent: (percent: number) =>
        setProgress(job.downloadId, percent),
    },
  );

  if (result.success && result.outputFile) {
    setStatus(job.downloadId, 'completed');
    const { updateDownloadTranscript } = transcriptActions(
      useDownloadStore.setState,
      useDownloadStore.getState,
    );
    updateDownloadTranscript(job.downloadId, result.outputFile);
  } else {
    setStatus(job.downloadId, 'failed');
    toast({
      variant: 'destructive',
      title: 'Transcription failed',
      description: result.error ?? 'Could not create transcript',
      duration: 5000,
    });
  }
}

function drain(): void {
  while (running < MAX_CONCURRENT && pendingJobs.length > 0) {
    const job = pendingJobs.shift()!;
    running++;
    runningIds.add(job.downloadId);
    setStatus(job.downloadId, 'transcribing');
    runJob(job)
      .catch(() => setStatus(job.downloadId, 'failed'))
      .finally(() => {
        running--;
        runningIds.delete(job.downloadId);
        drain();
      });
  }
}

export function enqueueTranscript(job: TranscriptJob): void {
  if (
    pendingJobs.some((j) => j.downloadId === job.downloadId) ||
    runningIds.has(job.downloadId)
  )
    return;
  pendingJobs.push(job);
  setStatus(job.downloadId, 'queued');
  toast({
    title: 'Downloading transcript',
    description: 'Transcript generation has started. Please wait.',
    duration: 5000,
  });
  drain();
}
