/**
 * Determines how to obtain a playable video URL.
 *
 * - status "finished" + local location + downloadName → joins directory + filename,
 *   reads the file via videoBridge, and returns a blob: URL
 * - anything else → fetches a streaming URL from yt-dlp
 *
 * Returns { url, isLocalBlob } so the caller can revoke the blob URL when done.
 */

interface ResolveVideoSourceOpts {
  status?: string;
  location?: string;
  downloadName?: string;
  videoUrl: string;
}

interface ResolveVideoSourceResult {
  url: string;
  isLocalBlob: boolean;
}

export async function resolveVideoSource(
  opts: ResolveVideoSourceOpts,
): Promise<ResolveVideoSourceResult> {
  const { status, location, downloadName, videoUrl } = opts;

  if (status === 'finished' && location && downloadName) {
    const fullPath = await window.downlodrFunctions.joinDownloadPath(
      location,
      downloadName,
    );

    const result = (await window.videoBridge.getVideoBlob(fullPath)) as {
      type: 'buffer' | 'stream';
      data?: Uint8Array;
      mimeType?: string;
      filePath?: string;
    } | null;

    if (result?.type === 'buffer' && result.data) {
      const blob = new Blob([result.data], {
        type: result.mimeType ?? 'video/mp4',
      });
      return { url: URL.createObjectURL(blob), isLocalBlob: true };
    }
  }

  const url = await window.ytdlp.getDirectUrl(videoUrl);
  return { url, isLocalBlob: false };
}
