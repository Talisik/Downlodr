export interface VideoFormat {
  format_id: string;
  ext: string;
  video_ext?: string;
  audio_ext?: string;
  url: string;
  resolution?: string;
  format_note?: string;
  format?: string;
  vcodec?: string;
  acodec?: string;
  tbr?: number;
  width?: number;
  height?: number;
  filesize?: number;
}

/** Thumbnail entry from ytdlp getInfo response */
export interface VideoInfoThumbnail {
  url?: string;
  id?: string;
  [key: string]: unknown;
}

export interface VideoInfo {
  data: {
    formats: VideoFormat[];
    extractor_key: string;
    format_id: string;
    ext: string;
    channel?: string;
    uploader?: string;
    title?: string;
    description?: string;
    thumbnail?: string;
    thumbnails?: VideoInfoThumbnail[];
    subtitles?: Record<string, unknown>;
    automatic_captions?: Record<string, unknown>;
    is_live?: boolean;
    elapsed?: number | null;
    duration?: number | null;
    chapters?: { start_time: number; end_time: number; title: string }[];
  };
}

export interface FormatInfo {
  formatId: string;
  video_ext: string;
  format_note?: string;
  resolution?: string;
  format?: VideoFormat;
  vcodec?: string;
}

export interface FormatOption {
  value: string;
  label: string;
  formatId: string;
  fileExtension: string;
}

export interface ProcessedFormats {
  formatOptions: FormatOption[];
  audioOptions: FormatOption[];
  defaultFormatId: string;
  defaultExt: string;
}
