import TooltipWrapper from '@/Components/SubComponents/custom/TooltipWrapper';
import { Button } from '@/Components/SubComponents/shadcn/components/ui/button';
import { useToast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import { cn } from '@/Components/SubComponents/shadcn/lib/utils';
import useDownloadStore from '@/Store/downloadStore';
import { useMainStore } from '@/Store/mainStore';
import { usePluginState } from '@/plugins/Hooks/usePluginState';
import { TaskBarItem } from '@/plugins/types';
import React, { useEffect, useState } from 'react';
import { FaPause, FaPlay, FaStop } from 'react-icons/fa';

const PluginTaskBarExtension: React.FC = () => {
  const [taskBarItems, setTaskBarItems] = useState<TaskBarItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const enabledPlugins = usePluginState();
  const { selectedDownloads, taskBarButtonsVisibility } = useMainStore();
  const { downloading, pauseConversion, resumeConversion, stopConversion, updateDownload } = useDownloadStore();
  const { toast } = useToast();
  const clearAllSelections = useMainStore((state) => state.clearAllSelections);
  
  // Filter for active conversions (exclude finished/failed)
  const activeConversions = downloading.filter((download) => {
    const d: any = download as any;
    const isConversion = d.type === 'conversion';
    const status = String(download.status);
    const isActive = ['paused', 'initializing', 'downloading', 'converting'].includes(status);
    return isConversion && isActive;
  });
  
  // Debug logging to see what's in downloading
  useEffect(() => {
    console.log('🔍 [PluginTaskBarExtension] All downloading items:', downloading);
    console.log('🔍 [PluginTaskBarExtension] Active conversions found:', activeConversions);
    downloading.forEach(item => {
      console.log(`🔍 [PluginTaskBarExtension] Item ${item.id}: type=${(item as any).type}, status=${item.status}`);
    });
  }, [downloading, activeConversions]);

  // Helper function to check if a string is an SVG
  const isSvgString = (str: string): boolean => {
    return str.trim().startsWith('<svg') && str.trim().endsWith('</svg>');
  };

  const fetchTaskBarItems = async () => {
    try {
      setIsLoading(true);
      // Get taskbar items from plugin registry
      const items = await window.plugins.getTaskBarItems();

      // Filter by enabled plugins
      const filteredItems = (items || []).filter(
        (item) => !item.pluginId || enabledPlugins[item.pluginId] !== false,
      );

      // Deduplicate items using the same pattern as for menu items
      const uniqueItems = new Map<string, TaskBarItem>();

      filteredItems.forEach((item) => {
        if (item.pluginId && item.label) {
          const key = `${item.pluginId.trim()}:${item.label.trim()}`;
          uniqueItems.set(key, item);
        } else {
          // Fallback for items without pluginId or label
          uniqueItems.set(item.id || String(Date.now()), item);
        }
      });

      setTaskBarItems(Array.from(uniqueItems.values()));
    } catch (error) {
      console.error('Failed to fetch taskbar items:', error);
      setTaskBarItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Listen for plugins ready event
  useEffect(() => {
    const handlePluginsReady = () => {
      fetchTaskBarItems();
    };

    window.addEventListener('pluginsReady', handlePluginsReady);

    // Initial fetch
    fetchTaskBarItems();

    return () => {
      window.removeEventListener('pluginsReady', handlePluginsReady);
    };
  }, []);

  // Handle plugin state changes
  useEffect(() => {
    if (!isLoading) {
      fetchTaskBarItems();
    }
  }, [enabledPlugins]);

  // Set up plugin reload listener
  useEffect(() => {
    const unsubscribe = window.plugins.onReloaded(() => {
      fetchTaskBarItems();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Show conversion status bar even if no plugin items are loaded
  const hasConversions = activeConversions.length > 0;
  const hasTaskBarItems = taskBarItems.length > 0;
  
  if (isLoading) {
    return null;
  }
  
  // If no conversions and no taskbar items, return null
  if (!hasConversions && !hasTaskBarItems) {
    return null;
  }

  // Render icon helper function
  const renderIcon = (
    icon: string | React.ReactNode,
    size: 'sm' | 'md' = 'sm',
  ) => {
    const sizeClass = size === 'md' ? 'w-6 h-6' : 'w-5 h-5';

    if (typeof icon === 'string' && isSvgString(icon)) {
      return (
        <div
          dangerouslySetInnerHTML={{ __html: icon }}
          className={`${sizeClass} flex items-center justify-center rounded-sm [&>svg]:w-full [&>svg]:h-full`}
        />
      );
    } else if (icon) {
      return <span>{icon}</span>;
    } else {
      return (
        <div
          className={`${sizeClass} bg-gray-300 dark:bg-gray-600 rounded-sm flex items-center justify-center`}
        >
          <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
            P
          </span>
        </div>
      );
    }
  };

  // Handle conversion pause/resume
  const handleConversionPauseResume = async (downloadId: string, isPaused: boolean) => {
    try {
      if (isPaused) {
        // Resume conversion
        console.log('🔄 Resuming conversion from navbar:', downloadId);
        const result = await resumeConversion(downloadId);
        if (result.success) {
          updateDownload(downloadId, {
            type: 'conversion',
            data: {
              status: 'converting',
              log: 'Conversion resumed from navbar',
            },
          });
          toast({
            variant: 'success',
            title: 'Conversion Resumed',
            description: 'Format conversion has been resumed',
            duration: 3000,
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Resume Failed',
            description: result.error || 'Failed to resume conversion',
            duration: 3000,
          });
        }
      } else {
        // Pause conversion
        console.log('⏸️ Pausing conversion from navbar:', downloadId);
        const result = await pauseConversion(downloadId);
        if (result.success) {
          updateDownload(downloadId, {
            type: 'conversion',
            data: {
              status: 'paused',
              log: 'Conversion paused from navbar',
            },
          });
          toast({
            variant: 'default',
            title: 'Conversion Paused',
            description: 'Format conversion has been paused',
            duration: 3000,
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Pause Failed',
            description: result.error || 'Failed to pause conversion',
            duration: 3000,
          });
        }
      }
    } catch (error) {
      console.error('Error toggling conversion pause state from navbar:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to change conversion state',
        duration: 3000,
      });
    }
  };

  // Handle conversion stop
  const handleConversionStop = async (downloadId: string) => {
    try {
      console.log('🛑 Stopping conversion from navbar:', downloadId);
      const result = await stopConversion(downloadId);
      if (result.success) {
        // Remove from downloading list
        const { deleteDownloading } = useDownloadStore.getState();
        deleteDownloading(downloadId);
        
        toast({
          variant: 'default',
          title: 'Conversion Stopped',
          description: 'Format conversion has been stopped',
          duration: 3000,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Stop Failed',
          description: result.error || 'Failed to stop conversion',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error stopping conversion from navbar:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to stop conversion',
        duration: 3000,
      });
    }
  };

  const handleItemClick = async (item: TaskBarItem) => {
    if (item.actionType === 'multiple' && !selectedDownloads.length) {
      try {
        // For plugins that work with all downloads, don't clear selections (there are none)
        const handler = window.PluginHandlers[item.handlerId];
        if (handler) {
          await Promise.resolve(handler(downloading));
        }
      } catch (error) {
        console.error(
          `Error executing plugin handler for ${item.handlerId}:`,
          error,
        );
        toast({
          variant: 'destructive',
          title: 'Plugin Error',
          description: 'Failed to execute plugin action',
          duration: 3000,
        });
      }
      return;
    }

    if (!selectedDownloads.length) {
      toast({
        variant: 'destructive',
        title: 'No Downloads Selected',
        description: 'Please select downloads to use plugin',
        duration: 3000,
      });
      return;
    }

    // Get selected downloads data
    const downloadsData = selectedDownloads.map((selectedDownload) => {
      // Gather relevant data about the selected downloads
      return {
        id: selectedDownload.id,
        controllerId: selectedDownload.controllerId,
        location: selectedDownload.location,
        videoUrl: selectedDownload.videoUrl,
        downloadName: selectedDownload.downloadName,
        status: selectedDownload.status,
        download: selectedDownload.download,
      };
    });

    // Find and call the handler using the handlerId
    if (
      item.handlerId &&
      window.PluginHandlers &&
      window.PluginHandlers[item.handlerId]
    ) {
      console.log(`Executing taskbar item with handler: ${item.handlerId}`);
      console.log('Downloads data:', downloadsData);

      try {
        // Execute the plugin handler and wait for completion
        const handler = window.PluginHandlers[item.handlerId];
        await Promise.resolve(handler(downloadsData));

        // Only clear selections after successful plugin execution
        // This prevents clearing selections while the plugin is still processing
        clearAllSelections();
      } catch (error) {
        console.error(
          `Error executing plugin handler for ${item.handlerId}:`,
          error,
        );
        toast({
          variant: 'destructive',
          title: 'Plugin Error',
          description:
            'Failed to execute plugin action. Downloads remain selected.',
          duration: 3000,
        });
        // Don't clear selections on error - let user retry or manually clear
      }
    } else {
      console.error(
        `No handler found for taskbar item ${item.id} (looking for handlerId: ${item.handlerId})`,
      );
      // Fallback to the IPC method for non-renderer plugins
      try {
        await window.plugins.executeTaskBarItem(item.id || '', downloadsData);
        // Only clear selections after successful IPC call
        clearAllSelections();
      } catch (error) {
        console.error(`Error executing taskbar item via IPC:`, error);
        toast({
          variant: 'destructive',
          title: 'Plugin Error',
          description: 'Failed to execute plugin action via IPC',
          duration: 3000,
        });
      }
    }
  };

  return (
    <>
      {/* Conversion Status Bar */}
      {activeConversions.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md mr-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Converting {activeConversions.length} file{activeConversions.length !== 1 ? 's' : ''}
          </span>
          
          {activeConversions.map((conversion) => {
            const isPaused = conversion.status === 'paused';
            
            return (
              <div key={conversion.id} className="flex items-center gap-1 ml-2">
                <TooltipWrapper 
                  content={isPaused ? 'Resume conversion' : 'Pause conversion'} 
                  side="bottom"
                >
                  <button
                    onClick={() => handleConversionPauseResume(conversion.id, isPaused)}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    {isPaused ? (
                      <FaPlay size={10} className="text-green-600 dark:text-green-400" />
                    ) : (
                      <FaPause size={10} className="text-yellow-600 dark:text-yellow-400" />
                    )}
                  </button>
                </TooltipWrapper>
                
                <TooltipWrapper content="Stop conversion" side="bottom">
                  <button
                    onClick={() => handleConversionStop(conversion.id)}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    <FaStop size={10} className="text-red-600 dark:text-red-400" />
                  </button>
                </TooltipWrapper>
              </div>
            );
          })}
        </div>
      )}

      {/* Plugin Task Bar Items */}
      {hasTaskBarItems && (
        <div
          className={cn(
            'flex flex-wrap gap-2 max-w-xs max-h-16 overflow-hidden',
            !taskBarButtonsVisibility.start &&
              !taskBarButtonsVisibility.stop &&
              !taskBarButtonsVisibility.stopAll &&
              'max-w-none',
          )}
        >
        {taskBarItems.map((item) => (
          <TooltipWrapper key={item.id} content={item.label} side="bottom">
            <Button
              variant="transparent"
              disabled={selectedDownloads.length === 0}
              style={
                typeof item.buttonStyle === 'string'
                  ? {
                      ...(item.buttonStyle as React.CSSProperties),
                    }
                  : item.buttonStyle
              }
              className={`bg-transparent hover:bg-lightGray dark:hover:bg-darkModeHover transition-colors duration-200 px-2 py-1 rounded flex gap-1 font-semibold text-gray-700 dark:text-gray-200 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                ${
                  selectedDownloads.length === 0
                    ? 'cursor-not-allowed disabled:pointer-events-auto'
                    : ''
                }`}
              onClick={() => handleItemClick(item)}
              icon={
                item.icon && (
                  <span
                    style={
                      typeof item.iconStyle === 'string'
                        ? {
                            ...(item.iconStyle as React.CSSProperties),
                          }
                        : item.iconStyle
                    }
                    className="inline-flex items-center justify-center w-4 h-4 flex-shrink-0"
                  >
                    {typeof item.icon === 'string' && isSvgString(item.icon) ? (
                      <span
                        dangerouslySetInnerHTML={{ __html: item.icon }}
                        className="text-black dark:text-white [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-none [&>svg]:stroke-current"
                      />
                    ) : (
                      <span className="text-black dark:text-white">
                        {renderIcon(item.icon, 'sm')}
                      </span>
                    )}
                  </span>
                )
              }
              aria-label={item.label}
            >
              {item.label && !item.icon && (
                <span
                  className="text-xs"
                  style={
                    typeof item.labelStyle === 'string'
                      ? { ...(item.labelStyle as React.CSSProperties) }
                      : item.labelStyle
                  }
                >
                  {item.label}
                </span>
              )}
            </Button>
          </TooltipWrapper>
        ))}
        </div>
      )}
    </>
  );
};

export default PluginTaskBarExtension;
