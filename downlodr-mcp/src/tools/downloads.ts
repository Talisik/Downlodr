import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { bridgeGet, bridgePost, connectEventStream } from '../client.js';
import { recordGetVideoInfo, checkDownloadPrereqs, checkBatchDownloadPrereqs } from '../workflow-state.js';

export async function handleGetVideoInfo({ url }: { url: string }) {
  // Same envelope as /downloads/playlist: the metadata is under .data.
  const res = await bridgeGet<{
    ok?: boolean;
    data?: Record<string, unknown>;
    isPlaylist?: boolean;
    entryCount?: number;
  }>('/downloads/info', { url });
  if (res.ok === false) {
    // A container URL (a bilibili season, a YouTube playlist page) has no
    // single video to describe. Say so instead of returning a row of
    // undefined fields, which would still mark the download prereq met.
    if (res.isPlaylist) {
      const count = res.entryCount ?? '?';
      throw new Error(
        `This URL is a playlist or series (${count} entries), not a single ` +
          'video. Use downlodr_get_playlist_info instead.',
      );
    }
    throw new Error(`Could not fetch video info for ${url}.`);
  }
  const info = res.data ?? {};
  const formats = Array.isArray(info.formats)
    ? (info.formats as Array<Record<string, unknown>>)
        .filter((f) => f.vcodec !== 'none' || f.acodec !== 'none')
        .slice(0, 20)
        .map((f) => ({
          id: f.format_id,
          ext: f.ext,
          quality: f.format_note ?? f.resolution,
          vcodec: f.vcodec,
          acodec: f.acodec,
          filesize: f.filesize,
        }))
    : [];
  recordGetVideoInfo(url, (info.title as string) ?? undefined);
  return {
    title: info.title,
    uploader: info.uploader,
    duration_seconds: info.duration,
    view_count: info.view_count,
    upload_date: info.upload_date,
    description: typeof info.description === 'string' ? info.description.slice(0, 300) : undefined,
    webpage_url: info.webpage_url,
    formats,
  };
}

export async function handleGetPlaylistInfo({ url }: { url: string }) {
  // The bridge forwards yt-dlp-helper's envelope verbatim — { ok, data } — so
  // the playlist itself lives under .data, not at the top level.
  const res = await bridgeGet<{ ok?: boolean; data?: Record<string, unknown> }>(
    '/downloads/playlist',
    { url },
  );
  const info = res.data ?? {};
  const entries = Array.isArray(info.entries)
    ? (info.entries as Array<Record<string, unknown>>).slice(0, 50).map((e) => ({
        id: e.id,
        title: e.title,
        url: e.url ?? e.webpage_url,
        duration: e.duration,
      }))
    : [];
  return { title: info.title, playlist_count: info.playlist_count, entries };
}

export async function handleQueueDownload({
  url,
  outputFilepath,
  videoFormat,
  audioExt,
  limitRate,
}: {
  url: string;
  outputFilepath: string;
  videoFormat?: string;
  audioExt?: string;
  limitRate?: string;
}) {
  const prereqError = checkDownloadPrereqs(url);
  if (prereqError) throw new Error(`${prereqError.message} [${prereqError.code}]`);
  return bridgePost<
    | { ok: true; message?: string }
    | { downloadId: string; controllerId: string }
  >('/downloads/queue', {
    url,
    outputFilepath,
    videoFormat,
    audioExt,
    limitRate,
  });
}

export async function handleDownloadVideo({
  url,
  outputFilepath,
  quality,
  limitRate,
  getThumbnail,
  getTranscript,
}: {
  url: string;
  outputFilepath: string;
  quality?: string;
  limitRate?: string;
  getThumbnail?: boolean;
  getTranscript?: boolean;
}) {
  const prereqError = checkDownloadPrereqs(url);
  if (prereqError) throw new Error(`${prereqError.message} [${prereqError.code}]`);
  return bridgePost<
    | { ok: true; started?: boolean; message?: string }
    | { downloadId: string; controllerId: string }
  >('/downloads/download-now', {
    url,
    outputFilepath,
    quality,
    limitRate,
    getThumbnail,
    getTranscript,
  });
}

export async function handleDownloadVideos({
  items,
  quality,
  limitRate,
  getThumbnail,
  getTranscript,
  duplicatesRemoved,
  chunkIndex,
  chunkTotal,
}: {
  items: { url: string; outputFilepath: string }[];
  quality?: string;
  limitRate?: string;
  getThumbnail?: boolean;
  getTranscript?: boolean;
  duplicatesRemoved?: number;
  chunkIndex?: number;
  chunkTotal?: number;
}) {
  const prereqError = checkBatchDownloadPrereqs(items.map((i) => i.url));
  if (prereqError) throw new Error(`${prereqError.message} [${prereqError.code}]`);
  return bridgePost<
    | { ok: true; started?: boolean; message?: string }
    | { downloadId: string; controllerId: string }
  >('/downloads/download-now', {
    items,
    quality,
    limitRate,
    getThumbnail,
    getTranscript,
    duplicatesRemoved,
    ...(chunkIndex && chunkTotal ? { chunk: { index: chunkIndex, total: chunkTotal } } : {}),
  });
}

export function handleWaitForDownload({
  downloadId,
  timeoutSeconds = 600,
  onProgress,
}: {
  downloadId: string;
  timeoutSeconds?: number;
  onProgress?: (pct: string) => void;
}): Promise<{ status: string; downloadId: string; progressLog?: string[]; error?: unknown }> {
  return new Promise((resolve) => {
    const progressLog: string[] = [];
    let finished = false;
    const ws = connectEventStream(
      (event) => {
        const p = event.payload as Record<string, unknown>;
        if (p?.downloadId !== downloadId) return;
        if (event.type === 'download:progress') {
          const chunk = p.chunk as Record<string, unknown> | undefined;
          const data = chunk?.data as Record<string, unknown> | undefined;
          if (data?.progress !== undefined) {
            const pct = `${data.progress}%`;
            progressLog.push(pct);
            onProgress?.(pct);
          }
        }
        if (event.type === 'download:finished' && !finished) {
          finished = true;
          ws.close();
          resolve({ status: 'finished', downloadId, progressLog: progressLog.slice(-10) });
        }
        if (event.type === 'download:error' && !finished) {
          finished = true;
          ws.close();
          resolve({ status: 'error', downloadId, error: p.error });
        }
      },
      () => {
        if (!finished) {
          finished = true;
          resolve({ status: 'connection_closed', downloadId });
        }
      },
    );
    setTimeout(() => {
      if (!finished) {
        finished = true;
        ws.close();
        resolve({ status: 'timeout', downloadId, progressLog: progressLog.slice(-10) });
      }
    }, timeoutSeconds * 1000);
  });
}

export async function handleStopDownload({ controllerId }: { controllerId: string }) {
  return bridgePost<{ stopped: boolean }>('/downloads/stop', { controllerId });
}

export async function handleGetYtdlpVersion() {
  return bridgeGet<{ version: string }>('/downloads/ytdlp-version');
}

export function registerDownloadTools(server: McpServer): void {
  // ── get video info ──────────────────────────────────────────────────────────
  server.tool(
    'downlodr_get_video_info',
    'Fetch metadata for a video URL (title, duration, available formats/qualities). Works with YouTube, Vimeo, and 1800+ sites.',
    { url: z.string().describe('Video URL to inspect') },
    async ({ url }) => {
      const result = await handleGetVideoInfo({ url });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── get playlist info ───────────────────────────────────────────────────────
  server.tool(
    'downlodr_get_playlist_info',
    'Fetch metadata for a playlist URL (title, video count, entries).',
    { url: z.string().describe('Playlist URL') },
    async ({ url }) => {
      const result = await handleGetPlaylistInfo({ url });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── queue download ──────────────────────────────────────────────────────────
  server.tool(
    'downlodr_queue_download',
    [
      'Queue a video in the Downlodr to-download list. This does NOT start the',
      'download — the user starts it from the app.',
      'Do NOT use this for an ordinary "download this video" request: that is',
      'downlodr_download_video. Use this ONLY when the user explicitly asks to',
      'line a video up for later. Before calling this you MUST:',
      '1. Call downlodr_get_video_info(url) and show the title/duration to the user',
      '2. ASK the user which format they want (show numbered list from the info response)',
      '3. ASK where to save (default: Downloads folder)',
      '4. Show a confirmation summary and get explicit yes/no',
      'confirmed must be true — only set after the user says yes.',
    ].join('\n'),
    {
      url: z.string().describe('Video URL to download'),
      outputFilepath: z.string().describe('Full output file path including filename and extension'),
      confirmed: z.boolean().describe('Set true only after showing user title, format, save path and they said yes.'),
      videoFormat: z.string().optional().describe('yt-dlp video format string, e.g. "bestvideo+bestaudio"'),
      audioExt: z.string().optional().describe('Audio extension for merging, e.g. "m4a" or "mp3"'),
      limitRate: z.string().optional().describe('Download speed limit, e.g. "5M" for 5 MB/s'),
    },
    async ({ url, outputFilepath, confirmed, videoFormat, audioExt, limitRate }) => {
      if (!confirmed) {
        return { content: [{ type: 'text' as const, text: 'Cannot queue download: confirmed is false. Show the user the video title, selected format, and save path — then ask "Confirm download? (yes/no)" before calling this.' }] };
      }
      const prereqError = checkDownloadPrereqs(url);
      if (prereqError) {
        return {
          content: [{
            type: 'text' as const,
            text: `${prereqError.message}\n\n[Guardrail code: ${prereqError.code}]`,
          }],
        };
      }
      const result = await handleQueueDownload({ url, outputFilepath, videoFormat, audioExt, limitRate });
      if ('ok' in result) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  message:
                    result.message ??
                    'Added to the to-download list in Downlodr. It is NOT downloading ' +
                      'yet — the user starts it from the app. Tell them it is queued, ' +
                      'not started.',
                  tip: 'Use downlodr_list_downloads to find and manage it in the visible Downlodr list.',
                },
                null,
                2,
              ),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                message: 'Download started',
                downloadId: result.downloadId,
                controllerId: result.controllerId,
                tip: 'This was started through the standalone headless fallback. Use downlodr_wait_for_download with the downloadId to track progress, or downlodr_stop_download with the controllerId to cancel.',
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── download video (actually downloads) ─────────────────────────────────────
  server.tool(
    'downlodr_download_video',
    [
      'Download a SINGLE video NOW. This actually runs the download, unlike',
      'downlodr_queue_download, which only adds it to the to-download list.',
      'THIS IS THE DEFAULT for a single download request: "download this video",',
      '"save this", "download as MP3", "download in 1080p", or one bare pasted',
      'video URL all mean this tool. If the user pastes MORE THAN ONE video URL,',
      'use downlodr_download_videos instead — do NOT call this tool once per link.',
      'Before calling this you MUST:',
      '1. Call downlodr_get_video_info(url) and show the title/duration to the user',
      '2. Show a confirmation summary (title, quality, save folder) and get explicit yes/no',
      'confirmed must be true — only set after the user says yes.',
    ].join('\n'),
    {
      url: z.string().describe('Video URL to download'),
      outputFilepath: z
        .string()
        .describe(
          'Full output file path. The folder is what is used — Downlodr names the file from the video title.',
        ),
      confirmed: z
        .boolean()
        .describe('Set true only after showing the user title, quality and save path and they said yes.'),
      quality: z
        .string()
        .optional()
        .describe('"best" (default), a resolution like "1080p"/"720p", "worst", or "audio"/"mp3". If the exact resolution is unavailable the next one below it is used.'),
      limitRate: z.string().optional().describe('Download speed limit, e.g. "5M" for 5 MB/s'),
      getThumbnail: z
        .boolean()
        .optional()
        .describe(
          "Pre-tick 'Save thumbnail' on the confirmation card. Set this only when the user already said they want it — the card asks either way, so do NOT ask them yourself.",
        ),
      getTranscript: z
        .boolean()
        .optional()
        .describe(
          "Pre-tick 'Save transcript' on the confirmation card. Downloads the video's existing subtitle track; it does not transcribe audio. Set only when the user already said they want it.",
        ),
    },
    async ({ url, outputFilepath, confirmed, quality, limitRate, getThumbnail, getTranscript }) => {
      if (!confirmed) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Cannot download: confirmed is false. Show the user the video title, quality and save path — then ask "Confirm download? (yes/no)" before calling this.',
          }],
        };
      }
      const prereqError = checkDownloadPrereqs(url);
      if (prereqError) {
        return {
          content: [{
            type: 'text' as const,
            text: `${prereqError.message}\n\n[Guardrail code: ${prereqError.code}]`,
          }],
        };
      }
      const result = await handleDownloadVideo({ url, outputFilepath, quality, limitRate, getThumbnail, getTranscript });
      if ('ok' in result) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(
              {
                message:
                  result.message ??
                  'Downloading now — it appears in the Downlodr downloads list with live progress.',
                tip: 'Use downlodr_list_downloads to check on it.',
              },
              null,
              2,
            ),
          }],
        };
      }
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(
            {
              message: 'Download started',
              downloadId: result.downloadId,
              controllerId: result.controllerId,
              tip: 'This ran through the standalone headless fallback, so it will NOT appear in the Downlodr list. Use downlodr_wait_for_download with the downloadId to track progress, or downlodr_stop_download with the controllerId to cancel.',
            },
            null,
            2,
          ),
        }],
      };
    },
  );

  // ── download several videos at once ──────────────────────────────────────
  server.tool(
    'downlodr_download_videos',
    [
      'Download 2-6 videos NOW behind ONE confirmation card.',
      'THIS IS THE DEFAULT whenever the user pastes more than one video URL.',
      'Do NOT call downlodr_download_video once per link — that raises one card',
      'per video and makes the user click through all of them.',
      'Before calling this you MUST:',
      '1. Dedupe the URLs, preserving the order the user gave them',
      '2. Call downlodr_get_video_info(url) for EVERY url (they can run together)',
      '3. Call downlodr_get_download_folder once',
      'At most 6 items per call. For more, split into chunks of 6 and call this',
      'once per chunk, passing chunkIndex/chunkTotal, and WAIT for each card to',
      'be answered before starting the next chunk — only one card can be open.',
      'Do NOT ask the user about thumbnails or transcripts: the card asks.',
      'confirmed must be true — only set after showing the user the list.',
    ].join('\n'),
    {
      items: z
        .array(
          z.object({
            url: z.string().describe('Video URL'),
            outputFilepath: z
              .string()
              .describe('Full output path; the folder is what is used'),
          }),
        )
        .min(1)
        .max(6)
        .describe('The videos in this chunk, at most 6'),
      confirmed: z
        .boolean()
        .describe('Set true only after showing the user the list of videos.'),
      quality: z
        .string()
        .optional()
        .describe('"best" (default), "1080p", "worst", or "audio"/"mp3". Applies to every video.'),
      limitRate: z.string().optional().describe('Speed cap, e.g. "5M"'),
      getThumbnail: z.boolean().optional().describe('Pre-tick Save thumbnail; the card still asks.'),
      getTranscript: z.boolean().optional().describe('Pre-tick Save transcript; the card still asks.'),
      duplicatesRemoved: z
        .number()
        .optional()
        .describe('How many duplicate links you dropped, so the card can say so.'),
      chunkIndex: z.number().optional().describe('1-based chunk number, when splitting >6'),
      chunkTotal: z.number().optional().describe('Total chunks, when splitting >6'),
    },
    async (args) => {
      if (!args.confirmed) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Cannot download: confirmed is false. List the videos for the user first, then set confirmed.',
          }],
        };
      }
      const prereqError = checkBatchDownloadPrereqs(args.items.map((i) => i.url));
      if (prereqError) {
        return {
          content: [{
            type: 'text' as const,
            text: `${prereqError.message}\n\n[Guardrail code: ${prereqError.code}]`,
          }],
        };
      }
      const result = await handleDownloadVideos(args);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── wait for download ───────────────────────────────────────────────────────
  server.tool(
    'downlodr_wait_for_download',
    'Wait for a standalone/headless fallback download to complete. UI-routed downloads appear in Downlodr; use downlodr_list_downloads for those.',
    {
      downloadId: z.string().describe('downloadId returned by downlodr_queue_download only when it used the standalone/headless fallback'),
      timeoutSeconds: z.number().optional().describe('Max seconds to wait (default 600)'),
    },
    async ({ downloadId, timeoutSeconds = 600 }) => {
      return new Promise((resolve) => {
        const progressLog: string[] = [];
        let finished = false;

        const ws = connectEventStream(
          (event) => {
            const p = event.payload as Record<string, unknown>;
            if (p?.downloadId !== downloadId) return;

            if (event.type === 'download:progress') {
              const chunk = p.chunk as Record<string, unknown> | undefined;
              const data = chunk?.data as Record<string, unknown> | undefined;
              if (data?.progress !== undefined) {
                progressLog.push(`${data.progress}%`);
              }
            }

            if (event.type === 'download:finished' && !finished) {
              finished = true;
              ws.close();
              resolve({
                content: [
                  {
                    type: 'text' as const,
                    text: JSON.stringify(
                      { status: 'finished', downloadId, progressLog: progressLog.slice(-10) },
                      null,
                      2,
                    ),
                  },
                ],
              });
            }

            if (event.type === 'download:error' && !finished) {
              finished = true;
              ws.close();
              resolve({
                content: [
                  {
                    type: 'text' as const,
                    text: JSON.stringify(
                      { status: 'error', downloadId, error: p.error },
                      null,
                      2,
                    ),
                  },
                ],
              });
            }
          },
          () => {
            if (!finished) {
              finished = true;
              resolve({
                content: [
                  {
                    type: 'text' as const,
                    text: JSON.stringify({ status: 'connection_closed', downloadId }, null, 2),
                  },
                ],
              });
            }
          },
        );

        setTimeout(() => {
          if (!finished) {
            finished = true;
            ws.close();
            resolve({
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      status: 'timeout',
                      downloadId,
                      progressLog: progressLog.slice(-10),
                      message: 'Download is still running — check Downlodr UI for progress.',
                    },
                    null,
                    2,
                  ),
                },
              ],
            });
          }
        }, timeoutSeconds * 1000);
      });
    },
  );

  // ── stop download ───────────────────────────────────────────────────────────
  server.tool(
    'downlodr_stop_download',
    'Cancel a standalone/headless fallback download by its controllerId. For UI-routed downloads, list visible downloads and manage them through downlodr-library.',
    { controllerId: z.string().describe('controllerId returned by downlodr_queue_download only when it used the standalone/headless fallback') },
    async ({ controllerId }) => {
      const result = await bridgePost<{ stopped: boolean }>('/downloads/stop', { controllerId });
      return {
        content: [
          {
            type: 'text' as const,
            text: result.stopped
              ? `Download ${controllerId} stopped successfully.`
              : `Controller ${controllerId} not found — it may have already finished.`,
          },
        ],
      };
    },
  );

  // ── yt-dlp version ──────────────────────────────────────────────────────────
  server.tool(
    'downlodr_get_ytdlp_version',
    'Get the currently installed yt-dlp version in Downlodr.',
    {},
    async () => {
      const result = await bridgeGet<{ version: string }>('/downloads/ytdlp-version');
      return {
        content: [{ type: 'text' as const, text: `yt-dlp version: ${result.version}` }],
      };
    },
  );
}
