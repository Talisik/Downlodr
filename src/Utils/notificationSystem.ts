/**
 * Native macOS notification system for Downlodr
 * Provides native system notifications and dock badge counter functionality
 */

export enum NotificationType {
  DOWNLOAD_COMPLETE = 'download-complete',
  DOWNLOAD_FAILED = 'download-failed',
  CONVERSION_COMPLETE = 'conversion-complete',
  CONVERSION_FAILED = 'conversion-failed',
  BATCH_COMPLETE = 'batch-complete',
  APP_UPDATE = 'app-update',
}

export interface NotificationPreferences {
  downloadComplete: boolean;
  downloadFailed: boolean;
  conversionComplete: boolean;
  conversionFailed: boolean;
  batchComplete: boolean;
  appUpdates: boolean;
  soundEnabled: boolean;
}

export interface NotificationData {
  filename?: string;
  location?: string;
  error?: string;
  count?: number;
  format?: string;
  canRetry?: boolean;
  version?: string;
}

export interface DownlodrNotification {
  title: string;
  body: string;
  icon?: string;
  hasReply?: boolean;
  onclick?: (event: Event) => void;
  actions?: NotificationAction[];
}

interface NotificationAction {
  action: string;
  title: string;
  handler: () => void;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  downloadComplete: true,
  downloadFailed: true,
  conversionComplete: true,
  conversionFailed: true,
  batchComplete: true,
  appUpdates: true,
  soundEnabled: true,
};

export class NotificationManager {
  private preferences: NotificationPreferences = DEFAULT_PREFERENCES;
  private windowHandler?: () => void;
  private showInFinderHandler?: (path: string) => void;
  private hasPermission = false;

  constructor() {
    this.initializePermissions();
  }

  private async initializePermissions(): Promise<void> {
    this.hasPermission = await this.requestPermissions();
  }

  async requestPermissions(): Promise<boolean> {
    try {
      if (typeof Notification === 'undefined') {
        console.warn('Notifications not supported in this environment');
        return false;
      }

      if (Notification.permission === 'granted') {
        this.hasPermission = true;
        return true;
      }

      if (Notification.permission === 'denied') {
        this.hasPermission = false;
        return false;
      }

      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      return this.hasPermission;
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      this.hasPermission = false;
      return false;
    }
  }

  updatePreferences(preferences: Partial<NotificationPreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
  }

  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  setWindowHandler(handler: () => void): void {
    this.windowHandler = handler;
  }

  setShowInFinderHandler(handler: (path: string) => void): void {
    this.showInFinderHandler = handler;
  }

  async showNotification(
    type: NotificationType,
    itemName: string,
    data?: NotificationData,
  ): Promise<DownlodrNotification | null> {
    // Check if this notification type is enabled
    if (!this.isNotificationTypeEnabled(type)) {
      console.log(`🔕 Notification type ${type} is disabled`);
      return null;
    }

    // Check if we have permission
    if (!this.hasPermission) {
      console.warn('❌ No notification permission available');
      return null;
    }

    const notificationConfig = this.createNotificationConfig(
      type,
      itemName,
      data,
    );

    try {
      console.log(
        `📱 Attempting to show notification: ${notificationConfig.title}`,
      );

      // Use the IPC notification API
      if (window.notificationAPI) {
        console.log(`📡 Using IPC notification API`);
        const result = await window.notificationAPI.showNotification(
          notificationConfig,
        );
        console.log(`✅ Notification shown via IPC:`, result);
        return result;
      } else {
        console.warn('❌ notificationAPI not available in window object');
        console.log(
          'Available APIs:',
          Object.keys(window).filter((key) => key.includes('API')),
        );
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to show notification:', error);
      return null;
    }
  }

  private isNotificationTypeEnabled(type: NotificationType): boolean {
    switch (type) {
      case NotificationType.DOWNLOAD_COMPLETE:
        return this.preferences.downloadComplete;
      case NotificationType.DOWNLOAD_FAILED:
        return this.preferences.downloadFailed;
      case NotificationType.CONVERSION_COMPLETE:
        return this.preferences.conversionComplete;
      case NotificationType.CONVERSION_FAILED:
        return this.preferences.conversionFailed;
      case NotificationType.BATCH_COMPLETE:
        return this.preferences.batchComplete;
      case NotificationType.APP_UPDATE:
        return this.preferences.appUpdates;
      default:
        return false;
    }
  }

  private createNotificationConfig(
    type: NotificationType,
    itemName: string,
    data?: NotificationData,
  ): DownlodrNotification {
    switch (type) {
      case NotificationType.DOWNLOAD_COMPLETE:
        return {
          title: 'Download Complete',
          body: `"${itemName}" has finished downloading`,
          icon: this.getNotificationIcon(),
          actions: data?.location
            ? [
                {
                  action: 'show-in-finder',
                  title: 'Show in Finder',
                  handler: () =>
                    this.showInFinderHandler?.(data.location || ''),
                },
              ]
            : undefined,
        };

      case NotificationType.DOWNLOAD_FAILED:
        return {
          title: 'Download Failed',
          body: `"${itemName}" failed to download${
            data?.error ? `: ${data.error}` : ''
          }`,
          icon: this.getNotificationIcon(),
        };

      case NotificationType.CONVERSION_COMPLETE:
        return {
          title: 'Conversion Complete',
          body: `"${itemName}" has been converted${
            data?.format ? ` to ${data.format}` : ''
          }`,
          icon: this.getNotificationIcon(),
        };

      case NotificationType.CONVERSION_FAILED:
        return {
          title: 'Conversion Failed',
          body: `"${itemName}" failed to convert${
            data?.format ? ` to ${data.format}` : ''
          }${data?.error ? `: ${data.error}` : ''}`,
          icon: this.getNotificationIcon(),
        };

      case NotificationType.BATCH_COMPLETE:
        return {
          title: 'Batch Download Complete',
          body: `${data?.count || 'Multiple'} downloads have finished`,
          icon: this.getNotificationIcon(),
        };

      case NotificationType.APP_UPDATE:
        return {
          title: 'Downlodr Update Available',
          body: `Version ${data?.version || 'latest'} is now available`,
          icon: this.getNotificationIcon(),
        };

      default:
        return {
          title: 'Downlodr',
          body: itemName,
          icon: this.getNotificationIcon(),
        };
    }
  }

  private getNotificationIcon(): string {
    // Use the app icon for notifications
    // In production, this will be resolved properly by the main process
    return 'notif.png'; // Simple filename - let main process resolve the path
  }

  private handleNotificationClick(
    type: NotificationType,
    data?: NotificationData,
  ): void {
    // Always bring app to foreground
    this.windowHandler?.();

    // Handle specific actions based on notification type
    switch (type) {
      case NotificationType.DOWNLOAD_COMPLETE:
        if (data?.location && this.showInFinderHandler) {
          this.showInFinderHandler(data.location);
        }
        break;

      case NotificationType.DOWNLOAD_FAILED:
        // Could navigate to failed downloads view
        break;

      case NotificationType.APP_UPDATE:
        // Could open update dialog
        break;

      default:
        // Just show the app
        break;
    }
  }
}

export class DockBadgeManager {
  private activeDownloads = 0;
  private activeConversions = 0;
  private preferences = {
    showBadge: true,
    includeConversions: true,
    includePausedDownloads: false,
  };

  constructor() {
    this.updateBadge();
  }

  updatePreferences(prefs: Partial<typeof this.preferences>): void {
    this.preferences = { ...this.preferences, ...prefs };
    this.updateBadge();
  }

  incrementDownloads(): void {
    this.activeDownloads++;
    this.updateBadge();
  }

  decrementDownloads(): void {
    this.activeDownloads = Math.max(0, this.activeDownloads - 1);
    this.updateBadge();
  }

  incrementConversions(): void {
    this.activeConversions++;
    this.updateBadge();
  }

  decrementConversions(): void {
    this.activeConversions = Math.max(0, this.activeConversions - 1);
    this.updateBadge();
  }

  setDownloadCount(count: number): void {
    this.activeDownloads = Math.max(0, count);
    this.updateBadge();
  }

  setConversionCount(count: number): void {
    this.activeConversions = Math.max(0, count);
    this.updateBadge();
  }

  clearBadge(): void {
    this.activeDownloads = 0;
    this.activeConversions = 0;
    this.updateBadge();
  }

  private updateBadge(): void {
    if (!this.preferences.showBadge) {
      this.setBadgeCount(0);
      return;
    }

    let totalCount = this.activeDownloads;

    if (this.preferences.includeConversions) {
      totalCount += this.activeConversions;
    }

    this.setBadgeCount(totalCount);
  }

  private async setBadgeCount(count: number): Promise<void> {
    try {
      console.log(
        `🏷️ DockBadgeManager: Attempting to set badge count to ${count}`,
      );

      if (window.dockBadgeAPI) {
        console.log(`📡 DockBadgeManager: Using IPC API`);
        await window.dockBadgeAPI.setBadgeCount(count);
        console.log(
          `✅ DockBadgeManager: Badge count set successfully via IPC`,
        );
      } else {
        console.warn(
          '❌ DockBadgeManager: dockBadgeAPI not available in window object',
        );
        console.log(
          'Available APIs:',
          Object.keys(window).filter((key) => key.includes('API')),
        );
      }
    } catch (error) {
      console.error('❌ Failed to set badge count:', error);
    }
  }

  getActiveCount(): { downloads: number; conversions: number; total: number } {
    const total =
      this.activeDownloads +
      (this.preferences.includeConversions ? this.activeConversions : 0);

    return {
      downloads: this.activeDownloads,
      conversions: this.activeConversions,
      total,
    };
  }
}

// Singleton instances
export const notificationManager = new NotificationManager();
export const dockBadgeManager = new DockBadgeManager();
