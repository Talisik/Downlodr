/**
 * Types used by Status page subcomponents.
 */
import type React from 'react';
import type { SearchableDownload } from '@/downlodr/store/taskbarDownloadStore';

export type { SearchableDownload };

export interface DisplayColumn {
  id: string;
  width: number;
  minWidth?: number;
  displayIndex?: number;
}

export interface FormatSelectData {
  ext: string;
  formatId: string;
  audioExt?: string;
  audioFormatId?: string;
}

export interface StatusPageRowHandlers {
  onContextMenu: (
    e: React.MouseEvent,
    download: SearchableDownload,
  ) => void;
  onRowClick: () => void;
  onCheckboxChange: () => void;
  onViewFile: (location?: string, downloadId?: string) => void;
  onViewDownload: (location?: string, downloadId?: string) => void;
  onViewFolder: (location?: string, filePath?: string) => void;
  onRetry: (downloadId: string) => void;
  onPause: (downloadId: string) => void;
  onRedownloadTranscript: (downloadId: string) => void;
  onFormatSelect: (formatData: FormatSelectData) => void;
  onViewEmbed: (download: SearchableDownload) => void;
}
