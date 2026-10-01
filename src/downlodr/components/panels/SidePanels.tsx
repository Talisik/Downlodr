import ArticleLogs from '@/afda/components/log/ArticleLogs';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
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
  // Article rows share the log panel with videos; their ids are UUIDs too, so
  // tell them apart by which store holds the id.
  const isArticleLog = useArticleDownloadStore((s) =>
    s.articleDownloads.some((a) => a.id === logModalDownloadId),
  );
  const closeLogs = () => {
    setShowLogModal(false);
    setLogModalDownloadId('');
  };

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
            {isArticleLog ? (
              <ArticleLogs articleId={logModalDownloadId} onClose={closeLogs} />
            ) : (
              <DownloadLogs
                isOpen={showLogModal}
                onClose={closeLogs}
                downloadId={logModalDownloadId}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SidePanels;
