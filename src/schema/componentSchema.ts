export interface DownloadItem {
  id: string;
  videoUrl: string;
  location?: string;
  name?: string;
  ext?: string;
  downloadName?: string;
  extractorKey?: string;
  download: {
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
