/**
 * Shared utilities, constants, and types for the Status page and its subcomponents.
 */

import i18n from '@/core-app/i18n';
import type {
  RowSelectionTarget,
  SelectableRow,
} from '@/downlodr/pages/status/statusPageTypes';

export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMilliseconds = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInWeeks = Math.floor(diffInDays / 7);
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInDays / 365);

  if (diffInMinutes < 60) {
    return i18n.t('downlodr:timeAgo.minutes', { count: diffInMinutes });
  } else if (diffInHours < 24) {
    return i18n.t('downlodr:timeAgo.hour', { count: diffInHours });
  } else if (diffInDays < 7) {
    return i18n.t('downlodr:timeAgo.day', { count: diffInDays });
  } else if (diffInWeeks < 4) {
    return i18n.t('downlodr:timeAgo.week', { count: diffInWeeks });
  } else if (diffInMonths < 12) {
    return i18n.t('downlodr:timeAgo.month', { count: diffInMonths });
  } else {
    return i18n.t('downlodr:timeAgo.year', { count: diffInYears });
  }
};

export const formatFileSize = (bytes: number | undefined): string => {
  if (!bytes) return i18n.t('downlodr:fileSize.unknown');
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;

  if (bytes >= GB) {
    return i18n.t('downlodr:fileSize.gb', { value: (bytes / GB).toFixed(2) });
  } else if (bytes >= MB) {
    return i18n.t('downlodr:fileSize.mb', { value: (bytes / MB).toFixed(2) });
  } else if (bytes >= KB) {
    return i18n.t('downlodr:fileSize.kb', { value: (bytes / KB).toFixed(2) });
  } else {
    return i18n.t('downlodr:fileSize.bytes', { count: bytes });
  }
};

/** A plain download row is its own key; a group row is given `[[key, ids]]`. */
const asRow = (row: RowSelectionTarget): SelectableRow =>
  typeof row === 'string' ? { key: row, ids: [row] } : row;

/** A row counts as checked only once every download it stands for is selected. */
const isRowChecked = (row: SelectableRow, selected: Set<string>): boolean =>
  row.ids.length > 0 && row.ids.every((id) => selected.has(id));

/**
 * New selection after a row checkbox / row click.
 *
 * A plain click toggles just that row. A shift-click (caller passes the rows
 * currently on screen, in display order) applies the same thing you just did
 * to the whole range between the previously clicked row (`anchorKey`) and
 * this one: if that click checked the anchor, the range is checked; if it
 * unchecked it, the range is unchecked. Rows outside the range are never
 * touched.
 *
 * Rows that stand for several downloads — a subscription or website group,
 * which the table draws as one collapsed row — take part as a single unit:
 * one entry in the range, all of its downloads selected together. Callers
 * with only plain rows can pass bare download ids.
 */
export function resolveRowSelection(
  selectedIds: string[],
  clicked: RowSelectionTarget,
  orderedRows?: RowSelectionTarget[],
  anchorKey?: string | null,
): string[] {
  const clickedRow = asRow(clicked);
  const selectedSet = new Set(selectedIds);

  if (orderedRows && anchorKey && anchorKey !== clickedRow.key) {
    const rows = orderedRows.map(asRow);
    const anchorIndex = rows.findIndex((r) => r.key === anchorKey);
    const clickedIndex = rows.findIndex((r) => r.key === clickedRow.key);
    if (anchorIndex !== -1 && clickedIndex !== -1) {
      const range = rows
        .slice(
          Math.min(anchorIndex, clickedIndex),
          Math.max(anchorIndex, clickedIndex) + 1,
        )
        .flatMap((r) => r.ids);

      // to deselect range
      if (!isRowChecked(rows[anchorIndex], selectedSet)) {
        const dropped = new Set(range);
        return selectedIds.filter((id) => !dropped.has(id));
      }
      return Array.from(new Set([...selectedIds, ...range]));
    }
  }

  if (isRowChecked(clickedRow, selectedSet)) {
    const dropped = new Set(clickedRow.ids);
    return selectedIds.filter((id) => !dropped.has(id));
  }
  return Array.from(new Set([...selectedIds, ...clickedRow.ids]));
}

/** Item shape needed for sort comparison */
export interface SortableDownloadItem {
  id: string;
  name: string;
  size?: number;
  ext?: string;
  status: string;
  speed?: string;
  DateAdded: string;
  uploadDate?: string;
  extractorKey?: string;
}

/** Sort downloads by column and direction */
export function sortDownloadsByColumn<T extends SortableDownloadItem>(
  items: T[],
  sortColumn: string,
  sortDirection: 'asc' | 'desc',
): T[] {
  return [...items].sort((a, b) => {
    switch (sortColumn) {
      case 'name':
        return sortDirection === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      case 'size': {
        const sizeA = a.size ?? 0;
        const sizeB = b.size ?? 0;
        return sortDirection === 'asc' ? sizeA - sizeB : sizeB - sizeA;
      }
      case 'format': {
        const formatA = a.ext ?? '';
        const formatB = b.ext ?? '';
        return sortDirection === 'asc'
          ? formatA.localeCompare(formatB)
          : formatB.localeCompare(formatA);
      }
      case 'status':
        return sortDirection === 'asc'
          ? a.status.localeCompare(b.status)
          : b.status.localeCompare(a.status);
      case 'speed': {
        const speedA = a.speed ? parseFloat(a.speed.split(' ')[0]) || 0 : 0;
        const speedB = b.speed ? parseFloat(b.speed.split(' ')[0]) || 0 : 0;
        return sortDirection === 'asc' ? speedA - speedB : speedB - speedA;
      }
      case 'dateAdded':
        return sortDirection === 'asc'
          ? new Date(a.DateAdded).getTime() - new Date(b.DateAdded).getTime()
          : new Date(b.DateAdded).getTime() - new Date(a.DateAdded).getTime();
      case 'uploadedOn': {
        const uploadA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
        const uploadB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
        return sortDirection === 'asc' ? uploadA - uploadB : uploadB - uploadA;
      }
      case 'source':
      case 'transcript': {
        const sourceA = a.extractorKey ?? '';
        const sourceB = b.extractorKey ?? '';
        return sortDirection === 'asc'
          ? sourceA.localeCompare(sourceB)
          : sourceB.localeCompare(sourceA);
      }
      default:
        return sortDirection === 'asc'
          ? new Date(a.DateAdded).getTime() - new Date(b.DateAdded).getTime()
          : new Date(b.DateAdded).getTime() - new Date(a.DateAdded).getTime();
    }
  });
}

export interface MetadataFetchProgress {
  /** Items still waiting on (or running) their metadata fetch. */
  pending: number;
  /** Items in the same run that already resolved. */
  done: number;
  total: number;
}

/**
 * Progress of the in-flight metadata resolution, or null when nothing is
 * fetching. Playlist entries carry a batch id, which gives a real denominator
 * ("42 of 100"); one-off pastes have no batch, so they only contribute their
 * own pending count.
 */
export function getMetadataFetchProgress(
  forDownloads: Array<{ status: string; playlistBatchId?: string }>,
): MetadataFetchProgress | null {
  const isPending = (d: { status: string }) => d.status === 'fetching metadata';
  if (!forDownloads.some(isPending)) return null;

  const activeBatchIds = new Set(
    forDownloads
      .filter((d) => isPending(d) && d.playlistBatchId)
      .map((d) => d.playlistBatchId as string),
  );

  const scoped = forDownloads.filter((d) =>
    d.playlistBatchId ? activeBatchIds.has(d.playlistBatchId) : isPending(d),
  );

  const pending = scoped.filter(isPending).length;
  return { pending, done: scoped.length - pending, total: scoped.length };
}

/** Status mapping for URL parameters to actual status values */
export const statusMapping: Record<string, string> = {
  'fetching-metadata': 'fetching metadata',
  'to-download': 'to download',
  paused: 'paused',
  pausing: 'pausing',
  initializing: 'initializing',
  failed: 'failed',
  finished: 'finished',
  downloading: 'downloading',
  all: 'all',
  articles: 'articles',
};

export const calculateContextMenuPosition = (
  clientX: number,
  clientY: number,
  menuWidth = 220,
  menuHeight = 400,
): { x: number; y: number } => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  const margin = 10;
  let x = clientX;
  let y = clientY;

  if (clientX + menuWidth > viewportWidth - margin) {
    x = Math.max(margin, viewportWidth - menuWidth - margin);
  }
  if (clientY + menuHeight > viewportHeight - margin) {
    y = Math.max(margin, viewportHeight - menuHeight - margin);
  }
  if (x < margin) x = margin;
  if (y < margin) y = margin;

  return { x: x + scrollX, y: y + scrollY };
};

/** Download object shape used for context menu */
export interface ContextMenuDownload {
  id: string;
  status: string;
  controllerId?: string;
  location: string;
  name: string;
  videoUrl: string;
  extractorKey: string;
  size?: number;
  progress?: number;
  DateAdded: string;
  channelName?: string;
  thumnailsLocation?: string;
  autoCaptionLocation?: string;
}

export const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'downloading':
      return '#2196F3';
    case 'finished':
      return '#34C759';
    case 'failed':
    case 'cancelled':
      return '#E74C3C';
    case 'initializing':
      return '#3498DB';
    case 'paused':
    case 'pausing':
      return '#FFEB3B';
    case 'to download':
      return '#FF9800';
    case 'fetching metadata':
      return 'currentColor';
    default:
      return 'currentColor';
  }
};

const COLUMN_KEY_MAP: Record<string, string> = {
  name: 'table.title',
  title: 'table.title',
  size: 'table.size',
  format: 'table.format',
  status: 'table.status',
  speed: 'table.speed',
  dateAdded: 'table.dateAdded',
  uploadedOn: 'table.uploadedOn',
  transcript: 'table.transcript',
  source: 'table.source',
  action: 'table.action',
  tags: 'table.tags',
  categories: 'table.categories',
};

export const getColumnDisplayName = (columnId: string): string => {
  const key = COLUMN_KEY_MAP[columnId];
  return key ? i18n.t(`downlodr:${key}`) : columnId;
};

/** Base menu item count by status; plugins add more (capped when >3). */
export function getMenuItemCount(
  downloadStatus: string,
  pluginCount: number,
): number {
  let baseCount: number;
  switch (downloadStatus) {
    case 'finished':
      baseCount = 6;
      break;
    case 'to download':
      baseCount = 7;
      break;
    case 'paused':
    case 'downloading':
    case 'initializing':
      baseCount = 6;
      break;
    default:
      baseCount = 6;
  }
  return baseCount + (pluginCount > 3 ? 1 : pluginCount);
}

export function getColumnOptions() {
  return [
    { id: 'name', label: i18n.t('downlodr:table.title'), required: true },
    { id: 'action', label: i18n.t('downlodr:table.action'), required: true },
    { id: 'format', label: i18n.t('downlodr:table.format'), required: true },
    { id: 'status', label: i18n.t('downlodr:table.status'), required: true },
    { id: 'speed', label: i18n.t('downlodr:table.speed'), required: false },
    {
      id: 'dateAdded',
      label: i18n.t('downlodr:table.dateAdded'),
      required: false,
    },
    { id: 'source', label: i18n.t('downlodr:table.source'), required: false },
    {
      id: 'transcript',
      label: i18n.t('downlodr:table.transcript'),
      required: false,
    },
    { id: 'size', label: i18n.t('downlodr:table.size'), required: false },
  ];
}
