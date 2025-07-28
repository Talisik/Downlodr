/* eslint-disable @typescript-eslint/no-explicit-any */
interface VideoFormat {
  format_id: string;
  format_note?: string;
  format_index?: number | null;
  url: string;
  manifest_url?: string;
  ext: string;
  protocol: string;
  preference?: number | null;
  quality?: number;
  has_drm?: boolean;
  vcodec?: string;
  acodec?: string;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  vbr?: number;
  abr?: number;
  tbr?: number | null;
  filesize?: number;
  filesize_approx?: number | null;
  resolution?: string;
  aspect_ratio?: number | null;
  audio_ext?: string;
  video_ext?: string;
  language?: string;
  language_preference?: number;
  source_preference?: number;
  dynamic_range?: string | null;
  container?: string;
  downloader_options?: {
    http_chunk_size?: number;
  };
  http_headers: {
    'User-Agent': string;
    Accept: string;
    'Accept-Language': string;
    'Sec-Fetch-Mode': string;
  };
  format: string;
  // Storyboard specific fields
  rows?: number;
  columns?: number;
  fragments?: Array<{
    url: string;
    duration: number;
  }>;
  // Audio specific fields
  asr?: number;
  audio_channels?: number;
}

interface SubtitleFormat {
  ext: string;
  url: string;
  name: string;
}

interface ThumbnailInfo {
  url: string;
  preference?: number;
  id?: string;
  height?: number;
  width?: number;
  resolution?: string;
}

interface HeatmapPoint {
  start_time: number;
  end_time: number;
  value: number;
}

interface VideoInfo {
  id: string;
  title: string;
  formats: VideoFormat[];
  thumbnails?: ThumbnailInfo[];
  thumbnail?: string;
  description?: string;
  uploader?: string;
  uploader_id?: string;
  uploader_url?: string;
  channel?: string;
  channel_id?: string;
  channel_url?: string;
  channel_follower_count?: number;
  duration?: number;
  duration_string?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  upload_date?: string;
  timestamp?: number;
  availability?: string;
  age_limit?: number;
  webpage_url?: string;
  webpage_url_basename?: string;
  webpage_url_domain?: string;
  original_url?: string;
  extractor?: string;
  extractor_key?: string;
  playlist?: string | null;
  playlist_index?: number | null;
  display_id?: string;
  fulltitle?: string;
  release_year?: number | null;
  is_live?: boolean;
  was_live?: boolean;
  requested_subtitles?: any;
  subtitles?: Record<string, SubtitleFormat[]>;
  automatic_captions?: Record<string, SubtitleFormat[]>;
  chapters?: any;
  heatmap?: HeatmapPoint[];
  tags?: string[];
  categories?: string[];
  _has_drm?: boolean | null;
  epoch?: number;
  requested_formats?: VideoFormat[];
  format?: string;
  format_id?: string;
  ext?: string;
  protocol?: string;
  language?: string;
  format_note?: string;
  filesize_approx?: number;
  tbr?: number;
  width?: number;
  height?: number;
  resolution?: string;
  fps?: number;
  dynamic_range?: string;
  vcodec?: string;
  vbr?: number;
  stretched_ratio?: any;
  aspect_ratio?: number;
  acodec?: string;
  abr?: number;
  asr?: number;
  audio_channels?: number;
  _filename?: string;
  filename?: string;
  _type?: string;
  _version?: {
    version: string;
    current_git_head?: string | null;
    release_git_head?: string;
    repository?: string;
  };
}

export interface GetInfoResponse {
  ok: boolean;
  data: VideoInfo;
}

export interface AddDownload {
  id: string; // Unique identifier for the download
  location: string; // Location of the file to download
  name: string; // Name of the file
  status: string; // Current status of the download
  ext: string; // File extension
  audioExt: string; // Audio file extension
  videoUrl: string; // URL of the video to download
  channelName: string; // Channel name
  size: number; // Size of the file in bytes
  speed: string; // Download speed
  timeLeft: string; // Estimated time left for the download
  progress: number; // Download progress percentage
  formatId: string; // Format ID of the download
  audioFormatId: string; // Audio format ID
  extractorKey: string; // Key for the extractor
  automaticCaption: string;
  thumbnails: string;
  getTranscript: boolean;
  getThumbnail: boolean;
  duration: number;
}
