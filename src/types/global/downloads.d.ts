/* eslint-disable prettier/prettier */
/** Core Downlodr: yt-dlp, cookie auth, transcription, browser extension. */
import type { GetInfoResponse, PlaylistInfoResponse, YtdlpDownloadStatus } from './shared';

declare global {
  interface Window {
    /** YT-DLP: info, download, stop, version (downlodrHandler) */
    ytdlpFunctionsBridge: {
      getPlaylistInfo: (url: string) => Promise<PlaylistInfoResponse>;
      getInfo: (url: string) => Promise<GetInfoResponse>;
      killController: (id: string) => Promise<unknown>;
      onUpdateStatus: (
        callback: (status: {
          state: 'updating' | 'updated' | 'failed';
          version: string | null;
        }) => void,
      ) => () => void;
      finishRecording: (id: string) => Promise<unknown>;
      stop: (id: string) => Promise<boolean>;
      selectDownloadDirectory: () => Promise<string>;
      downloadYTDLP: (options?: {
        filePath?: string;
        version?: string;
        platform?: string;
        forceDownload?: boolean;
      }) => Promise<{ success: boolean; error?: string }>;
      getCurrentVersion: () => Promise<{ success: boolean; version?: string; error?: string }>;
      getLatestVersion: () => Promise<{ success: boolean; version?: string; message?: string; error?: string }>;
      checkAndUpdate: () => Promise<{
        success: boolean;
        action: 'downloaded' | 'updated' | 'up-to-date' | 'error';
        message: string;
        currentVersion?: string;
        latestVersion?: string;
        error?: string;
      }>;
      /** Returns download id; status updates delivered via callback */
      download: (
        args: { url: string; outputFilepath: string; videoFormat: string },
        callback: (result: YtdlpDownloadStatus) => void,
      ) => string;
      getDirectUrl: (url: string) => Promise<string>;
      downloadPreview: (requestId: string, url: string) => Promise<string>;
      cancelPreviewDownload: (requestId: string) => Promise<void>;
      releasePreviewFile: (tempPath: string) => Promise<void>;
      readCaptionFile: (filePath: string) => Promise<string>;
    };

    /** Cookie authentication: browser detection, live/import/file mode, one-shot import (cookieAuth/handler.ts) */
    cookieAuthBridge: {
      getState: () => Promise<{
        mode: 'live' | 'import' | 'file' | 'none';
        browser: string | null;
        detected: {
          name: string;
          exists: boolean;
          kind: 'live' | 'import';
          recommended: boolean;
        }[];
      }>;
      setMode: (
        mode: 'live' | 'import' | 'file' | 'none',
        browser: string | null,
      ) => Promise<void>;
      import: (
        browser: string,
      ) => Promise<{ ok: boolean; count?: number; error?: string }>;
      importFile: () => Promise<{ ok: boolean; count?: number; error?: string }>;
      siteLogin: {
        open: (
          url: string,
        ) => Promise<{ ok: boolean; domain?: string; error?: string }>;
        list: () => Promise<
          { domain: string; jarPath: string; loginUrl: string; lastLoginAt: number }[]
        >;
        remove: (domain: string) => Promise<{ ok: boolean }>;
      };
    };

    /** Transcription (transcriptHandler) */
    transcribeBridge: {
      ffmpegWhisperTranscribe: (options: {
        inputFile: string;
        outputFile: string;
        modelPath: string;
        language?: string;
        format?: string;
        /** Tags this job's progress events; see the main-process handler. */
        jobId?: string;
      }) => Promise<{ success: boolean; outputFile: string; stdout: string; stderr: string }>;
      onFFmpegProgress: (callback: (progress: string) => void) => () => void;
    };

    /** Browser extension download bridge (extensionHandler) */
    extensionDownloadBridge?: {
      onDownload: (callback: (data: { url: string; title: string; format_id?: string; autoDownload?: boolean }) => void) => void;
      offDownload: () => void;
    };
  }
}
