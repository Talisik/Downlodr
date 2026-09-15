/**
 * Pause / resume actions for active downloads.
 *
 * These deliberately do NOT toggle. The UI handler (statusPageHandler) and the
 * plugin API both resume when called on an already-paused row, which is right
 * for a button whose label flips but wrong for a caller that may retry — a
 * repeated `pause` must never restart a download. Each action here states the
 * transition it performs and refuses anything else.
 *
 * Lives in the store, with no React or plugin-registry dependency, so the chat
 * bridge can call it from any page.
 */
import type { AddQueuePayload } from '../downloadPayloads';
import type { DownloadStatus, Downloading } from '../types';

/**
 * The slice of the store these actions touch. Typed against the store's own
 * types (not a structural stand-in) so the real getState stays assignable —
 * updateDownloadStatus in particular accepts the full status union, and a
 * narrower parameter type here would not accept the store's function.
 */
type GetState = () => {
  downloading: Downloading[];
  updateDownloadStatus: (id: string, status: DownloadStatus) => void;
  deleteDownloading: (id: string) => void;
  addQueue: (payload: AddQueuePayload) => void;
};

export type ActionResult = { ok: true } | { error: string };
export type BulkResult = { ok: true; count: number };

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function createPauseResumeActions(get: GetState) {
  const findActive = (downloadId: string) =>
    get().downloading.find((d) => String(d.id) === downloadId) as
      | (Downloading & Record<string, unknown>)
      | undefined;

  const pauseDownloadById = async (
    downloadId: string,
  ): Promise<ActionResult> => {
    const row = findActive(downloadId);
    if (!row) return { error: `No active download with id ${downloadId}.` };
    if (row.status === 'paused') {
      return { error: 'That download is already paused.' };
    }
    const controllerId = str(row.controllerId);
    // '---' is the placeholder a row carries until yt-dlp actually spawns.
    if (!controllerId || controllerId === '---') {
      return {
        error:
          'That download is still initializing and cannot be paused yet. Try again in a moment.',
      };
    }

    get().updateDownloadStatus(downloadId, 'paused');
    const killed = await window.ytdlp?.killController?.(controllerId);
    if (!killed) {
      get().updateDownloadStatus(downloadId, 'downloading');
      return {
        error: 'Failed to pause the download — it may have already finished.',
      };
    }
    return { ok: true };
  };

  const resumeDownloadById = async (
    downloadId: string,
  ): Promise<ActionResult> => {
    const row = findActive(downloadId);
    if (!row) return { error: `No active download with id ${downloadId}.` };
    if (row.status !== 'paused')
      return { error: 'That download is not paused.' };

    // Resuming an m4a onto its own partial file corrupts the output: yt-dlp
    // appends rather than resuming cleanly for this container. Drop the
    // fragment first, as the app's cleanup variant does.
    const isM4a = row.ext === 'm4a' || row.audioExt === 'm4a';
    if (isM4a && row.location && row.downloadName) {
      try {
        const fullPath = await window.downlodrFunctions.joinDownloadPath(
          str(row.location),
          str(row.downloadName),
        );
        if (await window.downlodrFunctions.fileExists(fullPath)) {
          await window.downlodrFunctions.deleteFile(fullPath);
        }
      } catch (error) {
        console.error('[pause-resume] m4a cleanup failed:', error);
      }
    }

    // The live ext/formatId are cleared while a row is paused; backup* holds
    // what it was actually downloading.
    get().addQueue({
      videoUrl: str(row.videoUrl),
      name: str(row.name),
      downloadName: str(row.downloadName),
      displayName: str(row.displayName),
      size: (row.size as number) ?? 0,
      speed: str(row.speed),
      channelName: str(row.channelName),
      timeLeft: str(row.timeLeft),
      DateAdded: new Date().toISOString(),
      uploadDate: row.uploadDate as string | undefined,
      progress: (row.progress as number) ?? 0,
      location: str(row.location),
      status: 'downloading',
      ext: str(row.backupExt),
      formatId: str(row.backupFormatId),
      audioExt: str(row.backupAudioExt),
      audioFormatId: str(row.backupAudioFormatId),
      extractorKey: str(row.extractorKey),
      limitRate: '',
      automaticCaption: row.automaticCaption,
      thumbnails: row.thumbnails ?? null,
      getTranscript: Boolean(row.getTranscript),
      getThumbnail: Boolean(row.getThumbnail),
      duration: (row.duration as number) || 60,
      isCreateFolder: false,
      tags: (row.tags as string[]) ?? [],
      category: (row.category as string[]) ?? [],
    } as AddQueuePayload);

    get().deleteDownloading(downloadId);
    return { ok: true };
  };

  return {
    pauseDownloadById,
    resumeDownloadById,

    pauseAllDownloads: async (): Promise<BulkResult> => {
      // Snapshot the ids first: pausing mutates the store's downloading array.
      const ids = get()
        .downloading.filter((d) => d.status !== 'paused')
        .map((d) => String(d.id));
      let count = 0;
      for (const id of ids) {
        const result = await pauseDownloadById(id);
        if ('ok' in result) count++;
      }
      return { ok: true, count };
    },

    resumeAllDownloads: async (): Promise<BulkResult> => {
      const ids = get()
        .downloading.filter((d) => d.status === 'paused')
        .map((d) => String(d.id));
      let count = 0;
      for (const id of ids) {
        const result = await resumeDownloadById(id);
        if ('ok' in result) count++;
      }
      return { ok: true, count };
    },
  };
}
