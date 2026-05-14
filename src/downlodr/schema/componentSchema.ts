export interface DownloadItem {
  id: string;
  videoUrl?: string;
  location?: string;
  name?: string;
  ext?: string;
  downloadName?: string;
  extractorKey?: string;
  download: {
    displayName: string;
    location: string;
    name: string;
    ext: string;
    size: number;
    speed: string;
    channelName: string;
    timeLeft: string;
    progress: number;
    formatId: string;
    audioExt: string;
    audioFormatId: string;
    extractorKey: string;
    automaticCaption: boolean;
    thumbnails: string[];
    getTranscript: boolean;
    getThumbnail: boolean;
    duration?: number;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ForDownload {
  id: string;
  videoUrl?: string;
  location?: string;
  name?: string;
  ext?: string;
  downloadName?: string;
  extractorKey?: string;
  download: {
    displayName: string;
    location: string;
    name: string;
    ext: string;
    size: number;
    speed: string;
    channelName: string;
    timeLeft: string;
    progress: number;
    formatId: string;
    audioExt: string;
    audioFormatId: string;
    extractorKey: string;
    automaticCaption: boolean;
    thumbnails: string[];
    getTranscript: boolean;
    getThumbnail: boolean;
    duration?: number;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface FileNotExistModalProps {
  isOpen: boolean;
  onClose: () => void;
  download?: DownloadItem | null; // Single download from context menu
  selectedDownloads?: DownloadItem[]; // Multiple downloads from selection
}

export interface FormatData {
  ext: string;
  formatId: string;
  audioExt: string;
  audioFormatId: string;
}

export interface DownloadStoreState {
  forDownloads: ForDownload[];
  downloads: DownloadItem[];
  historyDownloads: DownloadItem[];
  queuedDownloads: DownloadItem[];
  downloadingDownloads: DownloadItem[];
  finishedDownloads: DownloadItem[];
  failedDownloads: DownloadItem[];
  pausedDownloads: DownloadItem[];
  cancelledDownloads: DownloadItem[];
  removedDownloads: DownloadItem[];
}
