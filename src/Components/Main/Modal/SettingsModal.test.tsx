/**
 * Test suite for SettingsModal component
 * Tests collapsible sections, responsive behavior, and existing functionality
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useMainStore } from '@/Store/mainStore';
import SettingsModal from './SettingsModal';

// Mock the store
jest.mock('@/Store/mainStore');
jest.mock('@/Store/taskbarDownloadStore');
jest.mock('@/Components/SubComponents/shadcn/hooks/use-toast');

const mockUseMainStore = useMainStore as jest.MockedFunction<typeof useMainStore>;

describe('SettingsModal', () => {
  const mockSettings = {
    defaultLocation: '/Users/test/Downloads',
    defaultDownloadSpeed: 100,
    defaultDownloadSpeedBit: 'M',
    permitConnectionLimit: true,
    maxUploadNum: 5,
    maxDownloadNum: 3,
    runInBackground: true,
    enableClipboardMonitoring: false,
    exitModal: true,
    notificationPreferences: {
      downloadComplete: true,
      downloadFailed: true,
      conversionComplete: true,
      batchComplete: true,
      appUpdates: true,
      soundEnabled: true,
    },
    dockBadgePreferences: {
      showBadge: true,
      includeConversions: true,
      includePausedDownloads: false,
    },
  };

  const mockStoreReturn = {
    settings: mockSettings,
    updateDefaultLocation: jest.fn(),
    updateDefaultDownloadSpeed: jest.fn(),
    updatePermitConnectionLimit: jest.fn(),
    updateMaxDownloadNum: jest.fn(),
    updateDefaultDownloadSpeedBit: jest.fn(),
    visibleColumns: ['name', 'status', 'action'],
    setVisibleColumns: jest.fn(),
    updateRunInBackground: jest.fn(),
    updateEnableClipboardMonitoring: jest.fn(),
    updateNotificationPreferences: jest.fn(),
    updateDockBadgePreferences: jest.fn(),
  };

  beforeEach(() => {
    mockUseMainStore.mockReturnValue(mockStoreReturn);
    // Mock window APIs
    global.window.ytdlp = {
      selectDownloadDirectory: jest.fn().mockResolvedValue('/new/path'),
    };
    global.window.backgroundSettings = {
      setRunInBackground: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Collapsible Notifications Section', () => {
    it('should render notifications section collapsed by default', () => {
      render(<SettingsModal isOpen={true} onClose={jest.fn()} />);
      
      const notificationsHeader = screen.getByText('Notifications & Dock Badge');
      expect(notificationsHeader).toBeInTheDocument();
      
      // Check for collapse/expand button
      const collapseButton = screen.getByRole('button', { name: /toggle notifications/i });
      expect(collapseButton).toBeInTheDocument();
      
      // Should be collapsed by default
      const notificationOptions = screen.queryByText('Show notification when downloads complete');
      expect(notificationOptions).not.toBeVisible();
    });

    it('should expand notifications section when toggle button is clicked', async () => {
      render(<SettingsModal isOpen={true} onClose={jest.fn()} />);
      
      const collapseButton = screen.getByRole('button', { name: /toggle notifications/i });
      fireEvent.click(collapseButton);
      
      await waitFor(() => {
        const notificationOptions = screen.getByText('Show notification when downloads complete');
        expect(notificationOptions).toBeVisible();
      });
    });

    it('should persist section collapse state during modal session', async () => {
      render(<SettingsModal isOpen={true} onClose={jest.fn()} />);
      
      const collapseButton = screen.getByRole('button', { name: /toggle notifications/i });
      
      // Expand section
      fireEvent.click(collapseButton);
      
      await waitFor(() => {
        expect(screen.getByText('Show notification when downloads complete')).toBeVisible();
      });
      
      // Collapse section
      fireEvent.click(collapseButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Show notification when downloads complete')).not.toBeVisible();
      });
    });

    it('should show proper accessibility attributes for collapsible section', () => {
      render(<SettingsModal isOpen={true} onClose={jest.fn()} />);
      
      const collapseButton = screen.getByRole('button', { name: /toggle notifications/i });
      expect(collapseButton).toHaveAttribute('aria-expanded', 'false');
      expect(collapseButton).toHaveAttribute('aria-controls');
      
      const contentSection = screen.getByRole('region', { name: /notifications content/i });
      expect(contentSection).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Responsive Design', () => {
    it('should handle small viewport sizes without overflow', () => {
      // Mock small viewport
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 600,
      });
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      render(<SettingsModal isOpen={true} onClose={jest.fn()} />);
      
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveClass('max-h-[90vh]'); // Should have max height constraint
      expect(modal).toHaveClass('overflow-y-auto'); // Should allow scrolling
    });

    it('should adjust content layout for mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480,
      });

      render(<SettingsModal isOpen={true} onClose={jest.fn()} />);
      
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveClass('mx-2'); // Smaller margins on mobile
    });

    it('should not cover the main app screen', () => {
      render(<SettingsModal isOpen={true} onClose={jest.fn()} />);
      
      const overlay = screen.getByTestId('modal-overlay');
      expect(overlay).toHaveClass('fixed', 'inset-0');
      expect(overlay).toHaveStyle({ zIndex: '8999' }); // High z-index but not covering everything
    });
  });

  describe('Existing Functionality', () => {
    it('should preserve all notification preference settings', async () => {
      render(<SettingsModal isOpen={true} onClose={jest.fn()} />);
      
      // Expand notifications section first
      const collapseButton = screen.getByRole('button', { name: /toggle notifications/i });
      fireEvent.click(collapseButton);
      
      await waitFor(() => {
        const downloadCompleteCheckbox = screen.getByLabelText('Show notification when downloads complete');
        expect(downloadCompleteCheckbox).toBeChecked();
        
        const soundEnabledCheckbox = screen.getByLabelText('Play sound with notifications');
        expect(soundEnabledCheckbox).toBeChecked();
        
        const badgeCheckbox = screen.getByLabelText('Show badge counter on dock icon');
        expect(badgeCheckbox).toBeChecked();
      });
    });

    it('should save settings when OK button is clicked', async () => {
      const onClose = jest.fn();
      render(<SettingsModal isOpen={true} onClose={onClose} />);
      
      const okButton = screen.getByText('Okay');
      fireEvent.click(okButton);
      
      expect(mockStoreReturn.updateNotificationPreferences).toHaveBeenCalledWith(mockSettings.notificationPreferences);
      expect(mockStoreReturn.updateDockBadgePreferences).toHaveBeenCalledWith(mockSettings.dockBadgePreferences);
      expect(onClose).toHaveBeenCalled();
    });

    it('should close modal without saving when Cancel is clicked', () => {
      const onClose = jest.fn();
      render(<SettingsModal isOpen={true} onClose={onClose} />);
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      expect(onClose).toHaveBeenCalled();
      expect(mockStoreReturn.updateNotificationPreferences).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing notification preferences gracefully', () => {
      const settingsWithoutNotifications = {
        ...mockSettings,
        notificationPreferences: undefined,
      };
      
      mockUseMainStore.mockReturnValue({
        ...mockStoreReturn,
        settings: settingsWithoutNotifications,
      });

      expect(() => {
        render(<SettingsModal isOpen={true} onClose={jest.fn()} />);
      }).not.toThrow();
    });
  });
});
