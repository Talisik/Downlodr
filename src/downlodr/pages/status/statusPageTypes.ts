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
  /** Overrides the shared i18n label for this column, for this page only. */
  label?: string;
}

export interface FormatSelectData {
  ext: string;
  formatId: string;
  audioExt?: string;
  audioFormatId?: string;
}

/**
 * A row the user can check. Usually one download, but a collapsed group row
 * (a subscription, an article website) stands for all the downloads inside
 * it, and selects them as one unit.
 */
export interface SelectableRow {
  /** Stable per-row key — a download id, or `group:<id>` for a group row. */
  key: string;
  /** Every download this row selects. */
  ids: string[];
}

/** A bare download id is shorthand for the row `{ key: id, ids: [id] }`. */
export type RowSelectionTarget = string | SelectableRow;

export interface StatusPageRowHandlers {
  onContextMenu: (e: React.MouseEvent, download: SearchableDownload) => void;
  onRowClick: () => void;
  /** `shiftKey` asks the page to select the range from the last clicked row. */
  onCheckboxChange: (shiftKey?: boolean) => void;
  onViewFile: (location?: string, downloadId?: string) => void;
  onViewDownload: (location?: string, downloadId?: string) => void;
  onViewFolder: (location?: string, filePath?: string) => void;
  onRetry: (downloadId: string) => void;
  onPause: (downloadId: string) => void;
  onStop: (downloadId: string) => void;
  onFinishRecording: (downloadId: string) => void;
  onRedownloadTranscript: (downloadId: string) => void;
  onFormatSelect: (formatData: FormatSelectData) => void;
  onViewEmbed: (download: SearchableDownload) => void;
}
