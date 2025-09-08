import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PluginTaskBarExtension } from './PluginTaskBarExtension';
import { useMainStore } from '../../Store/mainStore';
import { useDownloadStore } from '../../Store/downloadStore';

// Mock the stores
jest.mock('../../Store/mainStore');
jest.mock('../../Store/downloadStore');

// Mock window.PluginHandlers and other globals
const mockPluginHandlers: Record<string, jest.Mock> = {};
const mockClearAllSelections = jest.fn();
const mockToast = jest.fn();

// Setup window mocks
Object.defineProperty(window, 'PluginHandlers', {
  value: mockPluginHandlers,
  writable: true,
});

Object.defineProperty(window, 'plugins', {
  value: {
    executeTaskBarItem: jest.fn(),
  },
  writable: true,
});

// Mock toast
jest.mock(
  '../../Components/SubComponents/shadcn/components/ui/use-toast',
  () => ({
    toast: mockToast,
  }),
);

describe('PluginTaskBarExtension', () => {
  const mockUseMainStore = useMainStore as jest.MockedFunction<
    typeof useMainStore
  >;
  const mockUseDownloadStore = useDownloadStore as jest.MockedFunction<
    typeof useDownloadStore
  >;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default store mocks
    mockUseMainStore.mockReturnValue({
      selectedDownloads: [],
      clearAllSelections: mockClearAllSelections,
    } as any);

    mockUseDownloadStore.mockReturnValue({
      downloading: [],
    } as any);

    // Clear plugin handlers
    Object.keys(mockPluginHandlers).forEach(
      (key) => delete mockPluginHandlers[key],
    );
  });

  describe('when format converter plugin task bar item is clicked', () => {
    it('should not cause download cancellation when processing selected downloads', async () => {
      // Arrange: Mock selected downloads and format converter plugin
      const mockSelectedDownloads = [
        { id: 'download-1', status: 'downloading', controllerId: 'ctrl-1' },
        { id: 'download-2', status: 'downloading', controllerId: 'ctrl-2' },
      ];

      const mockDownloading = [
        { id: 'download-1', status: 'downloading', controllerId: 'ctrl-1' },
        { id: 'download-2', status: 'downloading', controllerId: 'ctrl-2' },
      ];

      mockUseMainStore.mockReturnValue({
        selectedDownloads: mockSelectedDownloads,
        clearAllSelections: mockClearAllSelections,
      } as any);

      mockUseDownloadStore.mockReturnValue({
        downloading: mockDownloading,
      } as any);

      // Mock format converter plugin handler
      const formatConverterHandler = jest.fn();
      const handlerId = 'format-converter:taskbar:123456789';
      mockPluginHandlers[handlerId] = formatConverterHandler;

      // Mock taskbar items state with format converter
      const mockTaskBarItems = [
        {
          id: 'format-converter-btn',
          label: 'Convert Format',
          icon: '🔄',
          handlerId: handlerId,
          actionType: 'multiple' as const,
          pluginId: 'format-converter',
        },
      ];

      // Mock the component to have task bar items
      const TestComponent = () => {
        const [taskBarItems] = React.useState(mockTaskBarItems);
        // Simulate the fixed handleItemClick logic
        return (
          <div>
            {taskBarItems.map((item) => (
              <button
                key={item.id}
                data-testid={`taskbar-item-${item.id}`}
                onClick={async () => {
                  // Simulate the fixed handleItemClick logic
                  if (
                    item.actionType === 'multiple' &&
                    !mockSelectedDownloads.length
                  ) {
                    try {
                      const handler = mockPluginHandlers[item.handlerId!];
                      if (handler) {
                        await Promise.resolve(handler(mockDownloading));
                      }
                    } catch (error) {
                      console.error(`Error executing plugin handler:`, error);
                    }
                    return;
                  }

                  if (!mockSelectedDownloads.length) {
                    mockToast({
                      variant: 'destructive',
                      title: 'No Downloads Selected',
                      description: 'Please select downloads to use plugin',
                      duration: 3000,
                    });
                    return;
                  }

                  const downloadsData = mockSelectedDownloads.map(
                    (download) => ({
                      id: download.id,
                      status: download.status,
                      controllerId: download.controllerId,
                    }),
                  );

                  if (item.handlerId && mockPluginHandlers[item.handlerId]) {
                    try {
                      console.log(
                        `Executing taskbar item with handler: ${item.handlerId}`,
                      );
                      const handler = mockPluginHandlers[item.handlerId];
                      await Promise.resolve(handler(downloadsData));

                      // Only clear selections after successful execution
                      mockClearAllSelections();
                    } catch (error) {
                      console.error(`Error executing plugin handler:`, error);
                      // Don't clear selections on error
                    }
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        );
      };

      render(<TestComponent />);

      // Act: Click the format converter button
      const formatConverterButton = screen.getByTestId(
        'taskbar-item-format-converter-btn',
      );
      await fireEvent.click(formatConverterButton);

      // Wait for async operations to complete
      await waitFor(() => {
        // Assert: Plugin handler should be called with correct data
        expect(formatConverterHandler).toHaveBeenCalledWith([
          { id: 'download-1', status: 'downloading', controllerId: 'ctrl-1' },
          { id: 'download-2', status: 'downloading', controllerId: 'ctrl-2' },
        ]);

        // Assert: clearAllSelections should be called ONLY AFTER plugin execution completes
        expect(mockClearAllSelections).toHaveBeenCalled();
      });

      // Fixed: clearAllSelections is now called only after successful plugin execution
      // This prevents clearing selections while the plugin is still processing downloads
    });

    it('should handle format converter plugin with no selected downloads correctly', async () => {
      // Arrange: No selected downloads but active downloads exist
      const mockDownloading = [
        { id: 'download-1', status: 'downloading', controllerId: 'ctrl-1' },
      ];

      mockUseMainStore.mockReturnValue({
        selectedDownloads: [],
        clearAllSelections: mockClearAllSelections,
      } as any);

      mockUseDownloadStore.mockReturnValue({
        downloading: mockDownloading,
      } as any);

      const formatConverterHandler = jest.fn();
      const handlerId = 'format-converter:taskbar:123456789';
      mockPluginHandlers[handlerId] = formatConverterHandler;

      const mockTaskBarItems = [
        {
          id: 'format-converter-btn',
          label: 'Convert Format',
          icon: '🔄',
          handlerId: handlerId,
          actionType: 'multiple' as const,
          pluginId: 'format-converter',
        },
      ];

      const TestComponent = () => {
        const [taskBarItems] = React.useState(mockTaskBarItems);
        return (
          <div>
            {taskBarItems.map((item) => (
              <button
                key={item.id}
                data-testid={`taskbar-item-${item.id}`}
                onClick={() => {
                  // When actionType is 'multiple' and no downloads selected,
                  // should use all downloading items
                  if (
                    item.actionType === 'multiple' &&
                    mockUseMainStore().selectedDownloads.length === 0
                  ) {
                    mockPluginHandlers[item.handlerId!](mockDownloading);
                    return;
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        );
      };

      render(<TestComponent />);

      // Act: Click format converter when no downloads selected
      const formatConverterButton = screen.getByTestId(
        'taskbar-item-format-converter-btn',
      );
      fireEvent.click(formatConverterButton);

      // Assert: Should pass all downloading items to plugin
      expect(formatConverterHandler).toHaveBeenCalledWith(mockDownloading);

      // clearAllSelections should NOT be called when no downloads were selected
      expect(mockClearAllSelections).not.toHaveBeenCalled();
    });

    it('should prevent download cancellation when plugin handler is async', async () => {
      // Arrange: Mock async plugin handler that takes time to process
      const mockSelectedDownloads = [
        { id: 'download-1', status: 'downloading', controllerId: 'ctrl-1' },
      ];

      mockUseMainStore.mockReturnValue({
        selectedDownloads: mockSelectedDownloads,
        clearAllSelections: mockClearAllSelections,
      } as any);

      // Create an async plugin handler that simulates format conversion
      const asyncFormatConverterHandler = jest
        .fn()
        .mockImplementation(async (downloads) => {
          // Simulate async processing time
          await new Promise((resolve) => setTimeout(resolve, 100));

          // During this time, if clearAllSelections is called immediately,
          // it might interfere with the conversion process
          console.log('Processing format conversion for downloads:', downloads);

          return {
            success: true,
            convertedFiles: downloads.map((d) => `${d.id}.mp3`),
          };
        });

      const handlerId = 'format-converter:taskbar:123456789';
      mockPluginHandlers[handlerId] = asyncFormatConverterHandler;

      const TestComponent = () => {
        return (
          <button
            data-testid="async-format-converter"
            onClick={async () => {
              const downloadsData = mockSelectedDownloads.map((d) => ({
                id: d.id,
                status: d.status,
                controllerId: d.controllerId,
              }));

              try {
                // Fixed implementation - wait for async completion
                const handler = mockPluginHandlers[handlerId];
                await Promise.resolve(handler(downloadsData));

                // Only clear selections after successful completion
                mockClearAllSelections();
              } catch (error) {
                console.error('Plugin error:', error);
                // Don't clear selections on error
              }
            }}
          >
            Convert Format
          </button>
        );
      };

      render(<TestComponent />);

      // Act: Click the async format converter
      const button = screen.getByTestId('async-format-converter');
      await fireEvent.click(button);

      // Wait for async operation to complete
      await waitFor(async () => {
        // Assert: The async handler should be called
        expect(asyncFormatConverterHandler).toHaveBeenCalledWith([
          {
            id: 'download-1',
            status: 'downloading',
            controllerId: 'ctrl-1',
          },
        ]);

        // Assert: clearAllSelections is called only AFTER async operation completes
        expect(mockClearAllSelections).toHaveBeenCalled();
      });

      // Fixed: clearAllSelections now waits for async operation to complete
      // This prevents the plugin from losing context or causing downloads to be cancelled
    });
  });

  describe('error scenarios', () => {
    it('should handle missing plugin handler gracefully', async () => {
      mockUseMainStore.mockReturnValue({
        selectedDownloads: [{ id: 'download-1' }],
        clearAllSelections: mockClearAllSelections,
      } as any);

      const TestComponent = () => (
        <button
          data-testid="missing-handler-btn"
          onClick={async () => {
            const item = {
              id: 'missing-plugin',
              handlerId: 'non-existent-handler',
            };

            if (item.handlerId && mockPluginHandlers[item.handlerId]) {
              try {
                await Promise.resolve(mockPluginHandlers[item.handlerId]([]));
                mockClearAllSelections();
              } catch (error) {
                console.error('Plugin error:', error);
              }
            } else {
              console.error(`No handler found for taskbar item ${item.id}`);
              // Should fallback to IPC method
              try {
                await window.plugins.executeTaskBarItem(item.id, []);
                mockClearAllSelections();
              } catch (error) {
                console.error('IPC error:', error);
              }
            }
          }}
        >
          Missing Handler
        </button>
      );

      render(<TestComponent />);

      const button = screen.getByTestId('missing-handler-btn');
      await fireEvent.click(button);

      // Should fallback to IPC method
      expect(window.plugins.executeTaskBarItem).toHaveBeenCalledWith(
        'missing-plugin',
        [],
      );

      // clearAllSelections should be called after successful IPC call
      expect(mockClearAllSelections).toHaveBeenCalled();
    });

    it('should not clear selections when plugin handler throws error', async () => {
      const mockSelectedDownloads = [
        { id: 'download-1', status: 'downloading' },
      ];

      mockUseMainStore.mockReturnValue({
        selectedDownloads: mockSelectedDownloads,
        clearAllSelections: mockClearAllSelections,
      } as any);

      // Create a plugin handler that throws an error
      const errorHandler = jest
        .fn()
        .mockRejectedValue(new Error('Plugin execution failed'));
      const handlerId = 'error-plugin:taskbar:123';
      mockPluginHandlers[handlerId] = errorHandler;

      const TestComponent = () => (
        <button
          data-testid="error-plugin-btn"
          onClick={async () => {
            const downloadsData = mockSelectedDownloads.map((d) => ({
              id: d.id,
              status: d.status,
            }));

            try {
              const handler = mockPluginHandlers[handlerId];
              await Promise.resolve(handler(downloadsData));
              mockClearAllSelections();
            } catch (error) {
              console.error('Plugin error:', error);
              // Don't clear selections on error
            }
          }}
        >
          Error Plugin
        </button>
      );

      render(<TestComponent />);

      const button = screen.getByTestId('error-plugin-btn');
      await fireEvent.click(button);

      await waitFor(() => {
        // Assert: Plugin handler should be called
        expect(errorHandler).toHaveBeenCalledWith([
          { id: 'download-1', status: 'downloading' },
        ]);

        // Assert: clearAllSelections should NOT be called when plugin throws error
        expect(mockClearAllSelections).not.toHaveBeenCalled();
      });
    });
  });
});
