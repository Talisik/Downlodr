/**
 * Download-list rows for local format conversions (Format Converter plugin).
 *
 * The plugin used to "convert" by re-downloading the video through yt-dlp,
 * which put the job through the normal download lifecycle for free: a row in
 * the list, live progress, the status bar, then Finished. The local-ffmpeg
 * conversion that replaced it had none of that — the file was written but
 * the app never showed it. This module gives a conversion the same
 * lifecycle, driven by the ffmpeg job instead of yt-dlp:
 *
 *   start   -> row in `downloading` (status 'downloading', controllerId = jobId)
 *   running -> progress/speed/timeLeft from 'format:convertProgress'
 *   success -> status 'finished' + completionCount 2, then the regular
 *              checkFinishedDownloads moves it to Finished/History
 *   failure -> moved to Failed with ffmpeg's error; Retry re-runs the job
 *
 * Stop/Remove need no special casing: they call killController with the
 * row's controllerId, which the main process routes to the conversion job.
 * Rows removed some other way (e.g. a paused row deleted without a kill)
 * are caught by the store subscription below, so no ffmpeg is left behind.
 */
import useDownloadStore from './downloadStore';
import {
  cancelConversionJob,
  isConversionRow,
  pauseConversionJob,
  resumeConversionJob,
  type ConversionControlResult,
} from './conversionJobs';
import type {
  BaseDownload,
  ConversionInfo,
  Downloading,
  FailedDownloads,
} from './types';
import { uuidv4 } from './utils';

export interface StartConversionOptions {
  inputPath: string;
  outputPath: string;
  format: string;
  /** Id of the download being converted; looked up by path when absent. */
  sourceId?: string;
}

type CompletePayload = {
  jobId: string;
  success: boolean;
  outputPath?: string;
  size?: number;
  error?: string;
};

/**
 * How long a cancelled job's row may linger before we treat it as orphaned.
 * Stop/Remove delete the row right after killController resolves; a row
 * still present after this was killed by a path that didn't remove it.
 */
const ORPHAN_GRACE_MS = 2000;

/** Jobs whose outcome has been handled — never cancel or re-handle these. */
const settledJobs = new Set<string>();
/** Events that arrived before their row was inserted (a very fast exit). */
const earlyCompletions = new Map<string, CompletePayload>();

// ─── path helpers (the renderer has no `path`) ─────────────────────────────

const normalizePath = (p: string) =>
  p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '').toLowerCase();

const dirName = (p: string) =>
  p.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]*$/, '');
const baseName = (p: string) =>
  p
    .replace(/[\\/]+$/, '')
    .split(/[\\/]/)
    .pop() ?? '';
const stripExt = (name: string) => name.replace(/\.[^/.]+$/, '');

// ─── row lookup / construction ─────────────────────────────────────────────

const findRow = (jobId: string) =>
  useDownloadStore
    .getState()
    .downloading.find((d) => d.conversion?.jobId === jobId);

/** The download a conversion's input file belongs to, if it's in the list. */
function findSourceRecord(
  inputPath: string,
  sourceId?: string,
): BaseDownload | undefined {
  const { finishedDownloads, historyDownloads } = useDownloadStore.getState();
  const records: BaseDownload[] = [...finishedDownloads, ...historyDownloads];

  if (sourceId) {
    const byId = records.find((d) => d.id === sourceId);
    if (byId) return byId;
  }

  const target = normalizePath(inputPath);
  return records.find((d) => {
    if (!d.location) return false;
    const location = normalizePath(d.location);
    if (location === target) return true; // location already a file path
    return (
      !!d.downloadName &&
      `${location}/${normalizePath(d.downloadName)}` === target
    );
  });
}

function buildConversionRow(
  conversion: ConversionInfo,
  source: BaseDownload | undefined,
): Downloading {
  const fileName = baseName(conversion.outputPath);
  const title = stripExt(fileName);
  return {
    id: uuidv4(),
    // Carry over what describes the *video*; never subscriptionId (the
    // conversion is not a Skedulosa download) or per-row user state.
    videoUrl: source?.videoUrl ?? '',
    channelName: source?.channelName ?? '',
    uploadDate: source?.uploadDate,
    nativeCategory: source?.nativeCategory,
    thumbnailUrl: source?.thumbnailUrl,
    extractorKey: source?.extractorKey ?? '',
    automaticCaption: source?.automaticCaption ?? null,
    thumbnails: source?.thumbnails ?? null,
    thumnailsLocation: source?.thumnailsLocation,
    transcriptLocation: source?.transcriptLocation ?? '',
    description: source?.description,
    chapters: source?.chapters,
    duration: source?.duration ?? 0,
    tags: [...(source?.tags ?? [])],
    category: [...(source?.category ?? [])],

    name: title,
    displayName: title,
    downloadName: fileName,
    location: dirName(conversion.outputPath),
    ext: conversion.format,
    formatId: '',
    audioExt: '',
    audioFormatId: '',
    DateAdded: new Date().toISOString(),
    status: 'downloading',
    controllerId: conversion.jobId,
    progress: 0,
    rawProgress: 0,
    size: 0,
    speed: '',
    timeLeft: '',
    isLive: false,
    getTranscript: false,
    getThumbnail: false,
    isCreateFolder: false,
    downloadPhase: 'video',
    completionCount: 0,
    speedHistory: [],
    log: '',
    conversion,
  };
}

// ─── outcome handling ──────────────────────────────────────────────────────

function moveToFailed(row: Downloading, reason: string) {
  const failed: FailedDownloads = {
    ...row,
    status: 'failed',
    speed: '',
    timeLeft: '',
    transcriptLocation: row.transcriptLocation ?? '',
    failureReason: reason,
    canRetry: true,
  };
  useDownloadStore.setState((state) => ({
    failedDownloads: state.failedDownloads.some((d) => d.id === row.id)
      ? state.failedDownloads
      : [...state.failedDownloads, failed],
    historyDownloads: state.historyDownloads.some((d) => d.id === row.id)
      ? state.historyDownloads
      : [...state.historyDownloads, failed],
    downloading: state.downloading.filter((d) => d.id !== row.id),
  }));
}

function handleComplete(data: CompletePayload) {
  if (settledJobs.has(data.jobId)) return;
  const row = findRow(data.jobId);
  if (!row) {
    // Either the row was already removed (Stop) or it isn't inserted yet.
    earlyCompletions.set(data.jobId, data);
    setTimeout(() => earlyCompletions.delete(data.jobId), 10_000);
    return;
  }

  if (data.success) {
    settledJobs.add(data.jobId);
    useDownloadStore.setState((state) => ({
      downloading: state.downloading.map((d) =>
        d.id === row.id
          ? {
              ...d,
              status: 'finished' as const,
              completionCount: 2,
              progress: 100,
              rawProgress: 100,
              speed: '',
              timeLeft: '',
              size: data.size || d.size,
            }
          : d,
      ),
    }));
    // The same promotion yt-dlp downloads go through (verifies the file,
    // reads its size, moves it to Finished + History).
    useDownloadStore.getState().checkFinishedDownloads();
    return;
  }

  if (data.error === 'CANCELLED') {
    // Normally the Stop/Remove that killed it deletes the row right after.
    // If the row survives, something killed the job without removing it —
    // surface that as a failure rather than leaving a frozen row.
    setTimeout(() => {
      const orphan = findRow(data.jobId);
      if (orphan && !settledJobs.has(data.jobId)) {
        settledJobs.add(data.jobId);
        moveToFailed(orphan, 'Conversion was interrupted');
      }
    }, ORPHAN_GRACE_MS);
    return;
  }

  settledJobs.add(data.jobId);
  moveToFailed(
    row,
    `Conversion failed: ${(data.error || 'unknown error').slice(-300)}`,
  );
}

function handleProgress(data: {
  jobId: string;
  percent: number;
  speed: string;
  timeLeft: string;
}) {
  if (settledJobs.has(data.jobId)) return;
  useDownloadStore.setState((state) => ({
    downloading: state.downloading.map((d) =>
      d.conversion?.jobId === data.jobId && d.status === 'downloading'
        ? {
            ...d,
            progress: data.percent,
            rawProgress: data.percent,
            speed: data.speed,
            timeLeft: data.timeLeft,
          }
        : d,
    ),
  }));
}

let listening = false;
function ensureListeners() {
  if (listening) return;
  listening = true;

  window.downlodrFunctions.onFormatConvertComplete(handleComplete);
  window.downlodrFunctions.onFormatConvertProgress(handleProgress);

  // A conversion row that leaves `downloading` before its job settled was
  // removed by the user (Stop/Remove/Clear). Paths that delete a *paused*
  // row skip killController (a paused yt-dlp download has no process), but
  // a paused conversion still has a SIGSTOPped ffmpeg — end it here.
  useDownloadStore.subscribe((state, prev) => {
    if (state.downloading === prev.downloading) return;
    const live = new Set(
      state.downloading.map((d) => d.conversion?.jobId).filter(Boolean),
    );
    for (const d of prev.downloading) {
      const jobId = d.conversion?.jobId;
      if (jobId && !live.has(jobId) && !settledJobs.has(jobId)) {
        settledJobs.add(jobId);
        void cancelConversionJob(jobId).catch(() => undefined);
      }
    }
  });
}

// ─── public API ────────────────────────────────────────────────────────────

/**
 * Starts a local conversion and adds its row to the download list. Resolves
 * once ffmpeg has spawned; the row then tracks the job to completion.
 */
export async function startConversion(
  options: StartConversionOptions,
): Promise<{ jobId: string; downloadId: string }> {
  ensureListeners();
  const { inputPath, outputPath, format } = options;

  const { jobId } = (await window.downlodrFunctions.invokeMainProcess(
    'format:startConvert',
    { inputPath, outputPath, format },
  )) as { jobId: string };

  const source = findSourceRecord(inputPath, options.sourceId);
  const row = buildConversionRow(
    { jobId, inputPath, outputPath, format, sourceId: source?.id },
    source,
  );
  useDownloadStore.setState((state) => ({
    downloading: [...state.downloading, row],
  }));

  const early = earlyCompletions.get(jobId);
  if (early) {
    earlyCompletions.delete(jobId);
    handleComplete(early);
  }
  return { jobId, downloadId: row.id };
}

/** Pauses a running conversion row (SIGSTOP; not available on Windows). */
export async function pauseConversionRow(
  downloadId: string,
): Promise<ConversionControlResult> {
  const row = useDownloadStore
    .getState()
    .downloading.find((d) => d.id === downloadId);
  if (!row?.conversion)
    return { success: false, error: 'Conversion not found' };
  if (row.status === 'paused') return { success: true };

  const result = await pauseConversionJob(row.conversion.jobId);
  if (result.success) {
    useDownloadStore.getState().updateDownloadStatus(downloadId, 'paused');
  }
  return result;
}

/** Resumes a paused conversion row where it left off. */
export async function resumeConversionRow(
  downloadId: string,
): Promise<ConversionControlResult> {
  const row = useDownloadStore
    .getState()
    .downloading.find((d) => d.id === downloadId);
  if (!row?.conversion)
    return { success: false, error: 'Conversion not found' };
  if (row.status !== 'paused') return { success: true };

  const result = await resumeConversionJob(row.conversion.jobId);
  if (result.success) {
    useDownloadStore.getState().updateDownloadStatus(downloadId, 'downloading');
  }
  return result;
}

/** The row-click toggle: pause a running conversion, resume a paused one. */
export async function toggleConversionRowPause(
  downloadId: string,
): Promise<ConversionControlResult & { paused?: boolean }> {
  const row = useDownloadStore
    .getState()
    .downloading.find((d) => d.id === downloadId);
  if (row?.status === 'paused') {
    const result = await resumeConversionRow(downloadId);
    return { ...result, paused: !result.success };
  }
  const result = await pauseConversionRow(downloadId);
  return { ...result, paused: result.success };
}

/**
 * Cancels a conversion by jobId and drops its row (the plugin's own Stop
 * button). The row removal is what keeps the orphan check from turning the
 * cancel into a "Conversion was interrupted" failure.
 */
export async function cancelConversionByJobId(jobId: string): Promise<boolean> {
  const row = findRow(jobId);
  settledJobs.add(jobId);
  const cancelled = await cancelConversionJob(jobId);
  if (row) useDownloadStore.getState().deleteDownloading(row.id);
  return cancelled || Boolean(row);
}

/**
 * Retry for a failed conversion row: runs the same conversion again as a
 * fresh row instead of re-downloading through yt-dlp.
 */
export async function retryConversion(
  record: Pick<BaseDownload, 'id' | 'conversion'>,
): Promise<void> {
  const conversion = record.conversion;
  if (!conversion) throw new Error('Not a conversion');
  await startConversion({
    inputPath: conversion.inputPath,
    outputPath: conversion.outputPath,
    format: conversion.format,
    sourceId: conversion.sourceId,
  });
  useDownloadStore.getState().deleteDownload(record.id);
}

/** Row for a jobId, so the plugin API can map job controls onto it. */
export function findConversionRowByJobId(jobId: string) {
  return findRow(jobId);
}

export { isConversionRow };
