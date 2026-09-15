import ActivityTracker from '@/downlodr/components/download/log/ActivityTracker';
import DownloadLogs from '@/downlodr/components/download/log/DownloadLogs';
import type { SidePanelsState } from '@/downlodr/hooks/useSidePanels';
import PluginSidePanelManager from '@/plugins/components/PluginSidePanelManager';
import React from 'react';

const SidePanels: React.FC<SidePanelsState> = ({
  pluginWrapperRef,
  pluginPanelRef,
  activityTrackerMounted,
  activityTrackerWrapperRef,
  activityTrackerRef,
  showActivityTracker,
  setShowActivityTracker,
  activityTrackerDownloadId,
  downloadLogsMounted,
  downloadLogsWrapperRef,
  downloadLogsRef,
  showLogModal,
  setShowLogModal,
  setLogModalDownloadId,
  logModalDownloadId,
}) => {
  return (
    <>
      <div
        ref={pluginWrapperRef}
        className="overflow-hidden flex-shrink-0 flex flex-col"
      >
        <div ref={pluginPanelRef} className="flex-1 min-h-0">
          <PluginSidePanelManager />
        </div>
      </div>

      {activityTrackerMounted && (
        <div
          ref={activityTrackerWrapperRef}
          className="overflow-hidden flex-shrink-0 flex flex-col"
        >
          <div ref={activityTrackerRef} className="flex-1 min-h-0">
            <ActivityTracker
              isOpen={showActivityTracker}
              onClose={() => setShowActivityTracker(false)}
              downloadId={activityTrackerDownloadId}
            />
          </div>
        </div>
      )}

      {downloadLogsMounted && (
        <div
          ref={downloadLogsWrapperRef}
          className="overflow-hidden flex-shrink-0 flex flex-col"
        >
          <div ref={downloadLogsRef} className="flex-1 min-h-0">
            <DownloadLogs
              isOpen={showLogModal}
              onClose={() => {
                setShowLogModal(false);
                setLogModalDownloadId('');
              }}
              downloadId={logModalDownloadId}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default SidePanels;
