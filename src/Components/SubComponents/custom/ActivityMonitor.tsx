/**
 * ActivityMonitor component for managing the system tray activity indicator
 * This component monitors download and conversion activity and controls the blinking green dot
 */

import useDownloadStore from '@/Store/downloadStore';
import { useEffect, useRef } from 'react';

const ActivityMonitor: React.FC = () => {
  const { downloading, queuedDownloads } = useDownloadStore();
  const lastActivityState = useRef<boolean>(false);

  useEffect(() => {
    // Check if there's any active download or conversion activity
    const hasActiveDownloads = downloading.length > 0;
    const hasQueuedDownloads = queuedDownloads.length > 0;
    const hasActivity = hasActiveDownloads || hasQueuedDownloads;

    // Check for conversions (downloads with initializing status that are likely converting)
    const hasConversions = downloading.some(
      (download) =>
        download.status === 'initializing' ||
        (download.status === 'downloading' && download.progress === 100),
    );

    const shouldShowActivity = hasActivity || hasConversions;

    // Only call the activity indicator API if the state has changed
    if (shouldShowActivity !== lastActivityState.current) {
      lastActivityState.current = shouldShowActivity;

      if (window.activityIndicator) {
        if (shouldShowActivity) {
          window.activityIndicator.start().catch((error) => {
            console.error('Failed to start activity indicator:', error);
          });
        } else {
          window.activityIndicator.stop().catch((error) => {
            console.error('Failed to stop activity indicator:', error);
          });
        }
      }
    }
  }, [downloading, queuedDownloads]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (window.activityIndicator && lastActivityState.current) {
        window.activityIndicator.stop().catch((error) => {
          console.error('Failed to stop activity indicator on cleanup:', error);
        });
      }
    };
  }, []);

  // This component doesn't render anything, it just monitors activity
  return null;
};

export default ActivityMonitor;
