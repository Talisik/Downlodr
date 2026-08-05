/**
 * Payload schemas for download store actions.
 * Use these as single-argument payloads instead of long parameter lists.
 */

import type { ChapterInfo, DownloadStatus } from './types';

/** Caption source: URL string, structured data for automatic captions, or boolean flag from UI */
export type CaptionSource = string | unknown[] | boolean;

/** Thumbnail source: URL string */
export type ThumbnailSource = string | null;

/** Payload for addDownload */
export interface AddDownloadPayload {
  subscriptionId?: string;
  videoUrl: string;
  name: string;
  downloadName: string;
  displayName: string;
  size: number;
  speed: string;
  channelName: string;
  timeLeft: string;
  DateAdded: string;
  uploadDate?: string;
  progress: number;
  location: string;
  status: string;
  ext: string;
  formatId: string;
  audioExt: string;
  audioFormatId: string;
  extractorKey: string;
  limitRate: string;
  automaticCaption: CaptionSource;
  thumbnails: ThumbnailSource;
  getTranscript: boolean;
  getThumbnail: boolean;
  duration: number;
  isCreateFolder: boolean;
  autoCaptionLocation?: string;
  thumnailsLocation?: string;
  tags?: string[];
  category?: string[];
}

/** Payload for retryDownload (caption/thumbnail paths required) */
export interface RetryDownloadPayload {
  videoUrl: string;
  name: string;
  downloadName: string;
  displayName: string;
  size: number;
  speed: string;
  channelName: string;
  timeLeft: string;
  DateAdded: string;
  uploadDate?: string;
  progress: number;
  location: string;
  status: string;
  ext: string;
  formatId: string;
  audioExt: string;
  audioFormatId: string;
  extractorKey: string;
  limitRate: string;
  automaticCaption: CaptionSource;
  thumbnails: ThumbnailSource;
  getTranscript: boolean;
  getThumbnail: boolean;
  duration: number;
  thumnailsLocation: string;
  autoCaptionLocation: string;
  isCreateFolder: boolean;
  tags?: string[];
  category?: string[];
}

/** Options for setDownload (metadata fetch + queue) */
export interface SetDownloadOptions {
  getTranscript: boolean;
  getThumbnail: boolean;
  isFromPlaylist?: boolean;
  playlistBatchId?: string;
  autoQueueFormatId?: string;
  autoDownload?: boolean;
}

/** Payload for setDownload */
export interface SetDownloadPayload {
  videoUrl: string;
  location: string;
  limitRate: string;
  options?: SetDownloadOptions;
}

/** Payload for addQueue */
export interface AddQueuePayload {
  subscriptionId?: string;
  videoUrl: string;
  name: string;
  downloadName: string;
  displayName: string;
  size: number;
  speed: string;
  channelName: string;
  timeLeft: string;
  DateAdded: string;
  uploadDate?: string;
  progress: number;
  location: string;
  status: string;
  ext: string;
  formatId: string;
  audioExt: string;
  audioFormatId: string;
  extractorKey: string;
  limitRate: string;
  automaticCaption: CaptionSource;
  thumbnails: ThumbnailSource;
  getTranscript: boolean;
  getThumbnail: boolean;
  duration: number;
  isCreateFolder: boolean;
  description?: string;
  chapters?: ChapterInfo[];
  autoCaptionLocation?: string;
  thumnailsLocation?: string;
  transcriptLocation?: string;
  tags?: string[];
  category?: string[];
  isLive?: boolean;
}

/** Payload for updateDownloadStatus */
export interface UpdateDownloadStatusPayload {
  id: string;
  status: DownloadStatus;
}
