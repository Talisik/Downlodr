import { useSlidePanel } from '@/core-app/hooks/animation/useSlidePanel';
import { usePluginStore } from '@/plugins/store/pluginStore';
import { useCallback, useEffect, useState } from 'react';

export function useSidePanels() {
  const { updateIsOpenPluginSidebar, settingsPlugin } = usePluginStore();
  const isPluginSidebarOpen = settingsPlugin.isOpenPluginSidebar;

  const [showActivityTracker, setShowActivityTrackerRaw] = useState(false);
  const [activityTrackerDownloadId, setActivityTrackerDownloadId] = useState<string | null>(null);
  const [showLogModal, setShowLogModalRaw] = useState(false);
  const [logModalDownloadId, setLogModalDownloadId] = useState('');

  const {
    wrapperRef: activityTrackerWrapperRef,
    panelRef: activityTrackerRef,
    mounted: activityTrackerMounted,
  } = useSlidePanel(showActivityTracker);

  const {
    wrapperRef: downloadLogsWrapperRef,
    panelRef: downloadLogsRef,
    mounted: downloadLogsMounted,
  } = useSlidePanel(showLogModal);

  const { wrapperRef: pluginWrapperRef, panelRef: pluginPanelRef } =
    useSlidePanel(isPluginSidebarOpen, { gapPx: 8 });

  const setShowActivityTracker = useCallback(
    (open: boolean) => {
      if (open) {
        setShowLogModalRaw(false);
        updateIsOpenPluginSidebar(false);
      }
      setShowActivityTrackerRaw(open);
    },
    [updateIsOpenPluginSidebar],
  );

  const setShowLogModal = useCallback(
    (open: boolean) => {
      if (open) {
        setShowActivityTrackerRaw(false);
        updateIsOpenPluginSidebar(false);
      }
      setShowLogModalRaw(open);
    },
    [updateIsOpenPluginSidebar],
  );

  // Closing plugin sidebar closes the other two
  useEffect(() => {
    if (isPluginSidebarOpen) {
      setShowActivityTrackerRaw(false);
      setShowLogModalRaw(false);
    }
  }, [isPluginSidebarOpen]);

  const openLog = useCallback(
    (downloadId: string) => {
      setLogModalDownloadId(downloadId);
      setShowLogModal(true);
    },
    [setShowLogModal],
  );

  const openActivityTracker = useCallback(
    (downloadId: string) => {
      setActivityTrackerDownloadId(downloadId);
      setShowActivityTracker(true);
    },
    [setShowActivityTracker],
  );

  return {
    // Simple openers for context menus
    openLog,
    openActivityTracker,
    // Everything SidePanels needs
    showActivityTracker,
    activityTrackerDownloadId,
    setShowActivityTracker,
    activityTrackerWrapperRef,
    activityTrackerRef,
    activityTrackerMounted,
    showLogModal,
    logModalDownloadId,
    setShowLogModal,
    setLogModalDownloadId,
    downloadLogsWrapperRef,
    downloadLogsRef,
    downloadLogsMounted,
    pluginWrapperRef,
    pluginPanelRef,
  };
}

export type SidePanelsState = ReturnType<typeof useSidePanels>;
