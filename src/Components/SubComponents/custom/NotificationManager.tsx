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

  // Component successfully initialized

  // Initialize notification handlers
  useEffect(() => {
    console.log('🔧 NotificationManager: Initializing...');

    // Check if APIs are available
    console.log('📡 API availability check:');
    console.log('  - notificationAPI:', !!window.notificationAPI);
    console.log('  - dockBadgeAPI:', !!window.dockBadgeAPI);
    console.log('  - appControl:', !!window.appControl);

    // Log all available window APIs for debugging
    const availableAPIs = Object.keys(window).filter(
      (key) => key.includes('API') || key.includes('Control'),
    );
    console.log('📋 Available APIs:', availableAPIs);

    // Test dock badge API immediately
    if (window.dockBadgeAPI) {
      console.log('🧪 Testing dock badge API...');
      window.dockBadgeAPI
        .setBadgeCount(0)
        .then(() => console.log('✅ Dock badge API test successful'))
        .catch((error) =>
          console.error('❌ Dock badge API test failed:', error),
        );
    }

    // Test notification API immediately
    if (window.notificationAPI) {
      console.log('🧪 Testing notification API permissions...');
      window.notificationAPI
        .hasPermissions()
        .then((hasPerms) =>
          console.log('🔐 Notification permissions available:', hasPerms),
        )
        .catch((error) =>
          console.error('❌ Notification permission check failed:', error),
        );
    }

    // Set up window handler for notification clicks
    notificationManager.setWindowHandler(() => {
      console.log('📱 Notification clicked, showing window...');
      if (window.appControl) {
        window.appControl.showWindow();
      }
    });

    // Set up show in finder handler
    notificationManager.setShowInFinderHandler((path: string) => {
      console.log('📁 Show in finder requested for:', path);
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.openPath) {
        electronAPI.openPath(path);
      }
    });

    // Request notification permissions on startup
    notificationManager.requestPermissions().then((hasPermission) => {
      console.log(
        '🔐 Notification permissions:',
        hasPermission ? 'granted ✅' : 'denied ❌',
      );
    });

    console.log('✅ NotificationManager: Initialization complete');
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

    console.log(
      `NotificationManager: Active downloads changed to ${activeCount}`,
    );
    console.log(
      'Downloads:',
      downloading.map((d) => ({ id: d.id, name: d.name, status: d.status })),
    );

    // Update dock badge with current download count
    console.log(
      `NotificationManager: Calling dockBadgeManager.setDownloadCount(${activeCount})`,
    );
    dockBadgeManager.setDownloadCount(activeCount);

    // If downloads decreased, it means some completed
    if (activeCount < lastDownloadingCount.current) {
      const completedCount = lastDownloadingCount.current - activeCount;
      console.log(`NotificationManager: ${completedCount} downloads completed`);

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
    console.log(
      '📋 NotificationManager: Checking finished downloads:',
      finishedDownloads.length,
    );
    finishedDownloads.forEach((download) => {
      if (!processedFinishedIds.current.has(download.id)) {
        processedFinishedIds.current.add(download.id);
        console.log(
          '📱 NotificationManager: Showing completion notification for:',
          download.name,
        );

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
    console.log(
      '❌ NotificationManager: Checking failed downloads:',
      failedDownloads.length,
    );
    failedDownloads.forEach((download) => {
      if (!processedFailedIds.current.has(download.id)) {
        processedFailedIds.current.add(download.id);
        console.log(
          '💥 NotificationManager: Showing failure notification for:',
          download.name,
        );

        // Extract error message from failure reason or status
        const errorMessage =
          download.failureReason ||
          download.status ||
          'Download failed - check logs for details';

        // Show failure notification
        notificationManager.showNotification(
          NotificationType.DOWNLOAD_FAILED,
          download.name || download.downloadName,
          {
            error: errorMessage,
            canRetry: download.canRetry,
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
