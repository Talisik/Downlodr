/**
 * NotificationManager Component
 * Integrates the notification system with download store events
 * Handles both native notifications and dock badge counter updates
 */

import React, { useEffect, useRef } from 'react';
import useDownloadStore from '@/Store/downloadStore';
import { useMainStore } from '@/Store/mainStore';
import {
  notificationManager,
  dockBadgeManager,
  NotificationType,
} from '@/Utils/notificationSystem';

const NotificationManager: React.FC = () => {
  const { downloading, finishedDownloads, failedDownloads } =
    useDownloadStore();
  const { settings } = useMainStore();
  const lastDownloadingCount = useRef(0);
  const processedFinishedIds = useRef(new Set<string>());
  const processedFailedIds = useRef(new Set<string>());

  console.log('NotificationManager: Successfully initialized hooks');

  // Initialize notification handlers
  useEffect(() => {
    // Set up window handler for notification clicks
    notificationManager.setWindowHandler(() => {
      if (window.appControl) {
        window.appControl.showWindow();
      }
    });

    // Set up show in finder handler
    notificationManager.setShowInFinderHandler((path: string) => {
      if (window.electronAPI?.openPath) {
        window.electronAPI.openPath(path);
      }
    });

    // Request notification permissions on startup
    notificationManager.requestPermissions().then((hasPermission) => {
      console.log(
        'Notification permissions:',
        hasPermission ? 'granted' : 'denied',
      );
    });
  }, []);

  // Update preferences when settings change
  useEffect(() => {
    if (settings.notificationPreferences) {
      notificationManager.updatePreferences(settings.notificationPreferences);
    }
    if (settings.dockBadgePreferences) {
      dockBadgeManager.updatePreferences(settings.dockBadgePreferences);
    }
  }, [settings.notificationPreferences, settings.dockBadgePreferences]);

  // Track active downloads for dock badge
  useEffect(() => {
    const activeCount = downloading.length;

    // Update dock badge with current download count
    dockBadgeManager.setDownloadCount(activeCount);

    // If downloads decreased, it means some completed
    if (activeCount < lastDownloadingCount.current) {
      const completedCount = lastDownloadingCount.current - activeCount;

      // Show batch completion notification if multiple completed
      if (completedCount > 1) {
        notificationManager.showNotification(
          NotificationType.BATCH_COMPLETE,
          '',
          { count: completedCount },
        );
      }
    }

    lastDownloadingCount.current = activeCount;
  }, [downloading.length]);

  // Handle finished downloads
  useEffect(() => {
    finishedDownloads.forEach((download) => {
      if (!processedFinishedIds.current.has(download.id)) {
        processedFinishedIds.current.add(download.id);

        // Show completion notification
        notificationManager.showNotification(
          NotificationType.DOWNLOAD_COMPLETE,
          download.name || download.downloadName,
          {
            filename: download.downloadName,
            location: download.location,
          },
        );
      }
    });
  }, [finishedDownloads]);

  // Handle failed downloads
  useEffect(() => {
    failedDownloads.forEach((download) => {
      if (!processedFailedIds.current.has(download.id)) {
        processedFailedIds.current.add(download.id);

        // Show failure notification
        notificationManager.showNotification(
          NotificationType.DOWNLOAD_FAILED,
          download.name || download.downloadName,
          {
            error: download.status || 'Unknown error',
          },
        );
      }
    });
  }, [failedDownloads]);

  // Clean up processed IDs to prevent memory leaks
  useEffect(() => {
    const cleanup = () => {
      // Keep only the last 100 processed IDs to prevent unbounded growth
      const currentFinishedIds = new Set(finishedDownloads.map((d) => d.id));
      const currentFailedIds = new Set(failedDownloads.map((d) => d.id));

      // Remove processed IDs that are no longer in the store
      processedFinishedIds.current = new Set(
        Array.from(processedFinishedIds.current)
          .filter((id) => currentFinishedIds.has(id))
          .slice(-100),
      );

      processedFailedIds.current = new Set(
        Array.from(processedFailedIds.current)
          .filter((id) => currentFailedIds.has(id))
          .slice(-100),
      );
    };

    const interval = setInterval(cleanup, 60000); // Clean up every minute
    return () => clearInterval(interval);
  }, [finishedDownloads, failedDownloads]);

  // This component doesn't render anything
  return null;
};

export default NotificationManager;
