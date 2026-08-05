/**
 * Type definitions for the download store
 * Centralized location for all download-related types and interfaces
 */

export interface SpeedDataPoint {
  timestamp: number;
  speed: number; // Speed in MB/s
  rawSpeed: string; // Original speed string
}

export interface ChapterInfo {
  start_time: number;
  end_time: number;
  title: string;
}

// Base interface for all download types
export interface BaseDownload {
  subscriptionId?: string;
  id: string; // Unique identifier for the download
  videoUrl: string; // URL of the video to be downloaded
  name: string; // Name of the video
  downloadName: string; // Name used for the download file
  displayName?: string; // Display name for UI purposes (can be customized by user)
  channelName: string; // Name of the channel
  size: number; // Size of the download in bytes
  speed: string; // Current download speed
  timeLeft: string; // Estimated time left for the download
  DateAdded: string; // Date when the download was added
  uploadDate?: string; // Date the video was uploaded/published on the source site (ISO string)
  progress: number; // Current progress of the download (0-100)
  location: string; // File path where the download will be saved
  status: string; // Current status of the download
  ext: string; // File extension of the download
  controllerId?: string; // ID of the download controller
  tags: string[]; // Tags associated with the download
  tagSource?: Record<string, 'manual' | 'tier1' | 'tier2'>; // auto-tag: lowercased tag -> source tier (see src/auto-tag)
  nativeCategory?: string; // auto-tag: native source category (e.g. yt-dlp "Music") — used for routing
  musicArtist?: string; // auto-tag: yt-dlp artist (music route)
  musicTrack?: string; // auto-tag: yt-dlp track (music route)
  musicAlbum?: string; // auto-tag: yt-dlp album (music route)
  category: string[]; // Categories associated with the download
  extractorKey: string; // Key for the extractor used
  formatId: string; // ID of the selected format
  audioExt: string; // Audio file extension
  audioFormatId: string; // ID of the audio format
  isLive: boolean; // Indicates if the download is a live stream
  elapsed?: number; // Elapsed time of the download
  automaticCaption: any; // Automatic caption of the download
  thumbnails: any; // Thumbnails of the download
  autoCaptionLocation?: string; // Location of the automatic caption
  thumnailsLocation?: string; // Location of the thumbnails
  transcriptLocation?: string; // Location of the transcript
  description?: string; // Description of the video
  chapters?: ChapterInfo[]; // Chapters of the video
  getTranscript: boolean; // Indicates if the download has a transcript
  getThumbnail: boolean; // Indicates if the download has a thumbnail
  duration: number; // Duration of the download
  isCreateFolder?: boolean; // Indicates if the download needs to create a folder
  log?: string; // Download Log of the download
  downloadPhase?: 'video' | 'audio'; // Current download phase
  completionCount?: number; // Number of times reached 100%
  rawProgress?: number; // Raw progress from the download engine (0-100)
  speedHistory?: SpeedDataPoint[]; // Speed history for persistent graph data
  transcriptionStatus?: 'queued' | 'transcribing' | 'completed' | 'failed';
  transcriptionProgress?: number;

  // Playlist tracking
  isFromPlaylist?: boolean; // Whether this download came from a playlist
  playlistBatchId?: string; // Batch ID to group playlist downloads together

  // File integrity tracking
  fileMissing?: boolean; // Set by the background file integrity checker when the on-disk file can't be found

  favorited?: boolean; // Whether the user has favorited this download
}

// Interface for downloads that are currently being processed
export interface ForDownload extends BaseDownload {
  status: string; // Current status of the download
  downloadStart: boolean; // Indicates if the download has started
  formatId: string; // ID of the selected format
  audioExt: string; // Audio file extension
  audioFormatId: string; // ID of the audio format
  formats?: any[]; // formats property to the interface
  error?: string; // error property for error handling
  pendingAutoQueue?: boolean; // set by setDownload to trigger automated queue via component watcher
}

// Download status type
export type DownloadStatus =
  | 'downloading'
  | 'finished'
  | 'failed'
  | 'cancelled'
  | 'initializing'
  | 'fetching metadata'
  | 'paused'
  // Transitional state between clicking Pause and the process actually
  // exiting — blocks Resume until the graceful kill is confirmed, so a
  // second process can't start writing the same output file while the
  // first one is still alive (see ytdlpHandler.ts gracefulKill).
  | 'pausing';

// Interface for downloads that are currently downloading
export interface Downloading extends Omit<BaseDownload, 'status'> {
  status: DownloadStatus;
  formatId: string; // ID of the selected format
  backupExt?: string; // Backup file extension
  backupFormatId?: string; // Backup format ID
  backupAudioExt?: string; // Backup audio file extension
  backupAudioFormatId?: string; // Backup audio format ID
  liveRetryCount?: number; // Number of auto-retry attempts used after a live-stream error (see docs/superpowers/specs/2026-07-30-live-download-auto-retry-design.md)
  isFinishingRecording?: boolean; // Set while a graceful "finish recording" kill is in flight, cleared once the row leaves 'downloading' or the kill fails
}

// Interface for finished downloads
export interface FinishedDownloads extends BaseDownload {
  status: string; // Status of the finished download
  transcriptLocation: string;
}

// Interface for failed downloads
export interface FailedDownloads extends BaseDownload {
  status: string; // Status of the failed download
  transcriptLocation: string;
  failureReason?: string; // Optional reason for failure
  canRetry?: boolean; // Whether the download can be retried
}

// Interface for historical downloads
export interface HistoryDownloads extends BaseDownload {
  status: string; // Status of the historical download
  transcriptLocation: string;
}

// Interface for queued downloads
export interface QueuedDownload extends BaseDownload {
  id: string;
  videoUrl: string;
  name: string;
  downloadName: string;
  size: number;
  speed: string;
  timeLeft: string;
  DateAdded: string;
  progress: number;
  location: string;
  status: string;
  ext: string;
  formatId: string;
  audioExt: string;
  audioFormatId: string;
  extractorKey: string;
  limitRate: string;
  automaticCaption: any;
  thumbnails: any;
  getTranscript: boolean;
  getThumbnail: boolean;
  duration: number;
  isCreateFolder?: boolean;
  queuedAt: string; // Timestamp when added to queue
}

// Main interface for the download store state
export interface DownloadStoreState {
  downloading: Downloading[];
  finishedDownloads: FinishedDownloads[];
  failedDownloads: FailedDownloads[];
  historyDownloads: HistoryDownloads[];
  forDownloads: ForDownload[];
  queuedDownloads: QueuedDownload[];
  availableTags: string[];
  availableCategories: string[];
}

// Progress phase information
export interface ProgressPhaseInfo {
  phaseLabel: string;
  phaseProgress: number;
  overallProgress: number;
  isComplete: boolean;
}
