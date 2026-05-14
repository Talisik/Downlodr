/**
 * Custom hooks for Status page: encapsulate useEffects and reusable logic
 * so StatusPage.tsx stays focused on composition.
 */
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { generateErrorExplanation } from '@/downlodr/utils/error/ToastErrorHelper';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SearchableDownload } from '@/downlodr/store/taskbarDownloadStore';

/** Set document title when status changes */
export function useStatusPageTitle(currentStatus: string): void {
  useEffect(() => {
    const title =
      currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);
    document.title = `${title} Downloads - Downlodr`;
  }, [currentStatus]);
}

/** Detect transition from 'downloading' to 'failed' for a download */
function detectErrorTransition(
  previousStatusesRef: React.MutableRefObject<Map<string, string>>,
  download: SearchableDownload,
): boolean {
  const previousStatus = previousStatusesRef.current.get(download.id);
  previousStatusesRef.current.set(download.id, download.status);
  return previousStatus === 'downloading' && download.status === 'failed';
}

/** Monitor downloads and show error toasts on failure transition */
export function useErrorTransitionMonitor(
  allDownloads: SearchableDownload[],
): void {
  const previousStatusesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    allDownloads.forEach((download) => {
      if (detectErrorTransition(previousStatusesRef, download)) {
        const errorExplanation = generateErrorExplanation(download);
        toast({
          title: 'Something went wrong!',
          description: `${errorExplanation}`,
          variant: 'destructive',
          expandable: true,
          duration: 5500,
        });
      }
    });
  }, [allDownloads]);
}

/** Ref for transition timeout + cleanup on unmount */
export function useTransitionTimeoutRef(): React.MutableRefObject<NodeJS.Timeout | null> {
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  return transitionTimeoutRef;
}

const THUMBNAIL_BATCH_SIZE = 5;
const THUMBNAIL_BATCH_DELAY_MS = 50;

/** Load thumbnails for visible downloads in batches */
export function useThumbnails(
  allDownloads: Array<{ id: string; thumnailsLocation?: string }>,
): {
  thumbnailDataUrls: Record<string, string>;
  setThumbnailDataUrls: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
} {
  const [thumbnailDataUrls, setThumbnailDataUrls] = useState<
    Record<string, string>
  >({});

  const loadThumbnails = useCallback(
    async (downloads: typeof allDownloads) => {
      const loadPromises = downloads.map(async (download) => {
        if (download.thumnailsLocation && !thumbnailDataUrls[download.id]) {
          try {
            const dataUrl = await window.downlodrFunctions.getThumbnailDataUrl(
              download.thumnailsLocation,
            );
            if (dataUrl) {
              setThumbnailDataUrls((prev) => ({
                ...prev,
                [download.id]: dataUrl,
              }));
            }
          } catch (error) {
            console.warn(`Failed to load thumbnail for ${download.id}:`, error);
          }
        }
      });

      for (let i = 0; i < loadPromises.length; i += THUMBNAIL_BATCH_SIZE) {
        const batch = loadPromises.slice(i, i + THUMBNAIL_BATCH_SIZE);
        await Promise.allSettled(batch);
        if (i + THUMBNAIL_BATCH_SIZE < loadPromises.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, THUMBNAIL_BATCH_DELAY_MS),
          );
        }
      }
    },
    [thumbnailDataUrls],
  );

  useEffect(() => {
    if (allDownloads.length > 0) {
      loadThumbnails(allDownloads);
    }
  }, [allDownloads, loadThumbnails]);

  return { thumbnailDataUrls, setThumbnailDataUrls };
}

export interface ClickOutsideToCloseOptions {
  contextMenuDownloadId: string | null;
  transitionTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  setContextMenu: (menu: {
    downloadId: string | null;
    x: number;
    y: number;
  }) => void;
  setSelectedDownloadId: (id: string | null) => void;
  setColumnHeaderContextMenuVisible: (visible: boolean) => void;
  setIsTransitioning: (value: boolean) => void;
}

/** Close context menus when clicking outside table/details/context menu */
export function useClickOutsideToCloseMenus(
  options: ClickOutsideToCloseOptions,
): void {
  const {
    contextMenuDownloadId,
    transitionTimeoutRef,
    setContextMenu,
    setSelectedDownloadId,
    setColumnHeaderContextMenuVisible,
    setIsTransitioning,
  } = options;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isClickInsideTable = target.closest('table');
      const isClickInsideDetailsPanel = target.closest(
        '.download-details-panel',
      );
      const isClickInsideContextMenu =
        target.closest(
          '.fixed.bg-white.dark\\:bg-darkMode.border.rounded-md.shadow-lg',
        ) ||
        target.closest(
          '.fixed.bg-white.dark\\:bg-darkMode.border.rounded-md.shadow-lg.py-1.z-50',
        ) ||
        target.closest('div[style*="position: fixed"]');

      const clickedRow = target.closest('tr');
      const isClickOnDifferentRow =
        clickedRow &&
        contextMenuDownloadId &&
        !clickedRow.querySelector(
          `[data-download-id="${contextMenuDownloadId}"]`,
        );

      if (
        (!isClickInsideTable &&
          !isClickInsideDetailsPanel &&
          !isClickInsideContextMenu) ||
        isClickOnDifferentRow
      ) {
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
          transitionTimeoutRef.current = null;
        }
        setContextMenu({ downloadId: null, x: 0, y: 0 });
        setSelectedDownloadId(null);
        setColumnHeaderContextMenuVisible(false);
        setIsTransitioning(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [
    contextMenuDownloadId,
    transitionTimeoutRef,
    setContextMenu,
    setSelectedDownloadId,
    setColumnHeaderContextMenuVisible,
    setIsTransitioning,
  ]);
}

export interface PlaylistAutoSelectOptions {
  forDownloads: Array<{ id: string; isFromPlaylist?: boolean; status: string }>;
  selectedRowIds: string[];
  allDownloads: SearchableDownload[];
  setSelectedRowIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  setSelectedDownloads: (downloads: unknown[]) => void;
}

/** Auto-select new playlist downloads when they appear in forDownloads */
export function usePlaylistAutoSelect(options: PlaylistAutoSelectOptions): void {
  const {
    forDownloads,
    selectedRowIds,
    allDownloads,
    setSelectedRowIds,
    setSelectedDownloads,
  } = options;
  const forDownloadIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    forDownloadIdsRef.current = new Set(forDownloads.map((d) => d.id));

    const playlistDownloads = forDownloads.filter(
      (download) =>
        download.isFromPlaylist &&
        download.status === 'to download' &&
        !selectedRowIds.includes(download.id),
    );

    if (playlistDownloads.length > 0) {
      const playlistDownloadIds = playlistDownloads.map((d) => d.id);
      const newSelectedIds = [...selectedRowIds, ...playlistDownloadIds];
      setSelectedRowIds(newSelectedIds);

      const promises = newSelectedIds.map(async (id) => {
        const download = allDownloads.find((d) => d.id === id);
        return {
          id,
          controllerId: download?.controllerId,
          videoUrl: download?.videoUrl,
          downloadName: download?.downloadName,
          status: download?.status,
          download,
          location: download?.location
            ? await window.downlodrFunctions.joinDownloadPath(
                download.location,
                download.downloadName ?? download.name ?? '',
              )
            : undefined,
        };
      });

      Promise.all(promises).then((resolvedData) => {
        const stillInForDownloads = resolvedData.filter((d) =>
          forDownloadIdsRef.current.has(d.id),
        );
        setSelectedDownloads(stillInForDownloads);
      });
    }
  }, [
    forDownloads,
    selectedRowIds,
    allDownloads,
    setSelectedRowIds,
    setSelectedDownloads,
  ]);
}

/** Track window dimensions and cleanup resize listener */
export function useWindowSize(): {
  windowWidth: number;
  windowHeight: number;
} {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { windowWidth, windowHeight };
}
