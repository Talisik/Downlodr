/**
 * Test file for the notification system
 * Tests notification functionality and dock badge functionality
 */

import {
  NotificationManager,
  DockBadgeManager,
  NotificationType,
} from './notificationSystem';

// Mock window APIs
const mockNotificationAPI = {
  showNotification: jest.fn(),
  requestPermissions: jest.fn(),
  hasPermissions: jest.fn(),
};

const mockDockBadgeAPI = {
  setBadgeCount: jest.fn(),
  getBadgeCount: jest.fn(),
  clearBadge: jest.fn(),
};

const mockAppControl = {
  showWindow: jest.fn(),
};

// Set up global window mocks
beforeEach(() => {
  // Reset mocks
  jest.clearAllMocks();

  // Setup window APIs
  global.window = {
    notificationAPI: mockNotificationAPI,
    dockBadgeAPI: mockDockBadgeAPI,
    appControl: mockAppControl,
  } as any;

  // Mock Notification constructor
  global.Notification = {
    permission: 'granted',
    requestPermission: jest.fn().mockResolvedValue('granted'),
  } as any;
});

describe('NotificationManager', () => {
  let notificationManager: NotificationManager;

  beforeEach(() => {
    notificationManager = new NotificationManager();
  });

  describe('permission handling', () => {
    it('should request notification permissions successfully', async () => {
      mockNotificationAPI.hasPermissions.mockResolvedValue(true);

      const result = await notificationManager.requestPermissions();

      expect(result).toBe(true);
    });

    it('should handle permission denial gracefully', async () => {
      global.Notification = {
        permission: 'denied',
      } as any;

      const result = await notificationManager.requestPermissions();

      expect(result).toBe(false);
    });
  });

  describe('notification display', () => {
    beforeEach(async () => {
      // Grant permissions first
      await notificationManager.requestPermissions();
    });

    it('should show download complete notification', async () => {
      const mockNotificationResult = {
        title: 'Download Complete',
        body: 'Test video has finished downloading',
        icon: '/Assets/AppLogo/notif.png',
      };

      mockNotificationAPI.showNotification.mockResolvedValue(
        mockNotificationResult,
      );

      const result = await notificationManager.showNotification(
        NotificationType.DOWNLOAD_COMPLETE,
        'Test video',
        { filename: 'test.mp4', location: '/downloads/test.mp4' },
      );

      expect(mockNotificationAPI.showNotification).toHaveBeenCalledWith({
        title: 'Download Complete',
        body: '"Test video" has finished downloading',
        icon: expect.any(String),
        actions: expect.arrayContaining([
          expect.objectContaining({
            action: 'show-in-finder',
            title: 'Show in Finder',
          }),
        ]),
      });

      expect(result).toBeTruthy();
    });

    it('should show download failed notification', async () => {
      const mockNotificationResult = {
        title: 'Download Failed',
        body: 'Test video failed to download: Network error',
        icon: '/Assets/AppLogo/notif.png',
      };

      mockNotificationAPI.showNotification.mockResolvedValue(
        mockNotificationResult,
      );

      const result = await notificationManager.showNotification(
        NotificationType.DOWNLOAD_FAILED,
        'Test video',
        { error: 'Network error' },
      );

      expect(mockNotificationAPI.showNotification).toHaveBeenCalledWith({
        title: 'Download Failed',
        body: '"Test video" failed to download: Network error',
        icon: expect.any(String),
      });

      expect(result).toBeTruthy();
    });

    it('should not show notification when type is disabled', async () => {
      // Disable download complete notifications
      notificationManager.updatePreferences({ downloadComplete: false });

      const result = await notificationManager.showNotification(
        NotificationType.DOWNLOAD_COMPLETE,
        'Test video',
      );

      expect(mockNotificationAPI.showNotification).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});

describe('DockBadgeManager', () => {
  let dockBadgeManager: DockBadgeManager;

  beforeEach(() => {
    dockBadgeManager = new DockBadgeManager();
  });

  describe('badge count management', () => {
    it('should set dock badge count', () => {
      mockDockBadgeAPI.setBadgeCount.mockResolvedValue(undefined);

      dockBadgeManager.setDownloadCount(5);

      expect(mockDockBadgeAPI.setBadgeCount).toHaveBeenCalledWith(5);
    });

    it('should increment download count', () => {
      mockDockBadgeAPI.setBadgeCount.mockResolvedValue(undefined);

      dockBadgeManager.incrementDownloads();
      dockBadgeManager.incrementDownloads();

      expect(mockDockBadgeAPI.setBadgeCount).toHaveBeenCalledWith(2);
    });

    it('should decrement download count', () => {
      mockDockBadgeAPI.setBadgeCount.mockResolvedValue(undefined);

      dockBadgeManager.setDownloadCount(3);
      dockBadgeManager.decrementDownloads();

      expect(mockDockBadgeAPI.setBadgeCount).toHaveBeenCalledWith(2);
    });

    it('should not set negative badge count', () => {
      mockDockBadgeAPI.setBadgeCount.mockResolvedValue(undefined);

      dockBadgeManager.setDownloadCount(0);
      dockBadgeManager.decrementDownloads();

      expect(mockDockBadgeAPI.setBadgeCount).toHaveBeenCalledWith(0);
    });

    it('should clear badge when all downloads complete', () => {
      mockDockBadgeAPI.setBadgeCount.mockResolvedValue(undefined);

      dockBadgeManager.clearBadge();

      expect(mockDockBadgeAPI.setBadgeCount).toHaveBeenCalledWith(0);
    });

    it('should include conversions in badge count when enabled', () => {
      mockDockBadgeAPI.setBadgeCount.mockResolvedValue(undefined);

      dockBadgeManager.updatePreferences({ includeConversions: true });
      dockBadgeManager.setDownloadCount(2);
      dockBadgeManager.setConversionCount(3);

      expect(mockDockBadgeAPI.setBadgeCount).toHaveBeenCalledWith(5);
    });

    it('should exclude conversions when disabled', () => {
      mockDockBadgeAPI.setBadgeCount.mockResolvedValue(undefined);

      dockBadgeManager.updatePreferences({ includeConversions: false });
      dockBadgeManager.setDownloadCount(2);
      dockBadgeManager.setConversionCount(3);

      expect(mockDockBadgeAPI.setBadgeCount).toHaveBeenCalledWith(2);
    });
  });

  describe('preferences', () => {
    it('should not set badge when disabled', () => {
      mockDockBadgeAPI.setBadgeCount.mockResolvedValue(undefined);

      dockBadgeManager.updatePreferences({ showBadge: false });
      dockBadgeManager.setDownloadCount(5);

      expect(mockDockBadgeAPI.setBadgeCount).toHaveBeenCalledWith(0);
    });
  });
});
