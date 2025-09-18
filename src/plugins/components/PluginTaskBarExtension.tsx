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
  const { downloading } = useDownloadStore(); // Only get downloading for rendering
  const { toast } = useToast();
  const clearAllSelections = useMainStore((state) => state.clearAllSelections);
  
  // Filter for active conversions (exclude finished/failed)
  const activeConversions = downloading.filter((download) => {
    const d: any = download as any;
    // Check multiple ways conversions might be marked
    const isConversion = d.type === 'conversion' || 
                        d.convertedFormat !== undefined ||
                        (d.status === 'converting');
    const status = String(download.status);
    // Include all non-finished/failed conversions
    const isActive = status !== 'finished' && 
                    status !== 'failed' && 
                    status !== 'conversion_complete' && 
                    status !== 'conversion_failed' &&
                    status !== 'cancelled';
    return isConversion && isActive;
  });
  
  // Debug logging to see what's in downloading
  useEffect(() => {
    // Log all downloading items to see their structure
    if (downloading.length > 0) {
      console.log('🔍 [PluginTaskBarExtension] All downloading items:', downloading.length);
      downloading.forEach(item => {
        const d = item as any;
        console.log(`🔍 [PluginTaskBarExtension] Item ${item.id}:`, {
          status: item.status,
          type: d.type,
          convertedFormat: d.convertedFormat,
          name: item.name,
        });
      });
    }
    
    if (activeConversions.length > 0) {
      console.log('🎯 [PluginTaskBarExtension] Active conversions found:', activeConversions.length);
      activeConversions.forEach(item => {
        console.log(`🎯 [PluginTaskBarExtension] Active conversion ${item.id}: status=${item.status}, type=${(item as any).type}`);
      });
    } else if (downloading.length > 0) {
      console.log('⚠️ [PluginTaskBarExtension] No active conversions detected from', downloading.length, 'downloading items');
    }
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

  // Global state helpers
  const anyPaused = activeConversions.some((c) => c.status === 'paused');
  const anyRunning = activeConversions.some((c) => c.status !== 'paused');

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

  // Handle conversion pause/resume - mirrors right-click menu behavior
  const handleConversionPauseResume = async (downloadId: string, isPaused: boolean) => {
    try {
      console.log(`🎯 [handleConversionPauseResume] Called with downloadId=${downloadId}, isPaused=${isPaused}`);
      
      // Get the latest state from store
      const { pauseConversion, resumeConversion, updateDownload, downloading } = useDownloadStore.getState();
      
      // Find the conversion to ensure it exists
      const conversion = downloading.find(d => d.id === downloadId);
      console.log(`🎯 [handleConversionPauseResume] Found conversion:`, conversion);
      
      if (isPaused) {
        // Resume conversion
        console.log('🔄 Resuming conversion from navbar:', downloadId);
        const result = await resumeConversion(downloadId);
        if (result.success) {
          // Update status immediately for UI responsiveness
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
        
        // CRITICAL: Update status to paused BEFORE calling pauseConversion
        // This prevents race condition where FFmpeg termination triggers failure
        updateDownload(downloadId, {
          type: 'conversion',
          data: {
            status: 'paused',
            log: 'Conversion pausing from navbar...',
          },
        });
        
        // Now pause the actual conversion
        const result = await pauseConversion(downloadId);
        if (result.success) {
          // Update log to confirm pause completed
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
          // Revert status if pause failed
          updateDownload(downloadId, {
            type: 'conversion',
            data: {
              status: 'converting',
              log: 'Failed to pause conversion',
            },
          });
          
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

  // Handle conversion stop (single) - mirrors right-click menu behavior
  const handleConversionStop = async (downloadId: string) => {
    try {
      console.log('🛑 Stopping conversion from navbar:', downloadId);
      // Get the latest functions from store to avoid stale closures
      const { stopConversion, deleteDownloading } = useDownloadStore.getState();
      const result = await stopConversion(downloadId);
      if (result.success) {
        // Remove from downloading list
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

  // Global controls - mirrors right-click menu "pause all" behavior
  const pauseAll = async () => {
    try {
      console.log('🎯 [pauseAll] Called with activeConversions:', activeConversions.length);
      
      // Get fresh functions from store
      const { pauseConversion, updateDownload } = useDownloadStore.getState();
      const ids = activeConversions
        .filter((c) => c.status !== 'paused')
        .map((c) => c.id);
      
      console.log('⏸️ Pausing all conversions:', ids);
      
      for (const id of ids) {
        // CRITICAL: Update status to paused BEFORE calling pauseConversion
        updateDownload(id, {
          type: 'conversion',
          data: { status: 'paused', log: 'Conversion pausing from navbar (all)...' },
        });
        
        const res = await pauseConversion(id);
        if (res.success) {
          // Update log to confirm pause completed  
          updateDownload(id, {
            type: 'conversion',
            data: { status: 'paused', log: 'Conversion paused from navbar (all)' },
          });
        } else {
          // Revert status if pause failed
          updateDownload(id, {
            type: 'conversion',
            data: { status: 'converting', log: 'Failed to pause conversion' },
          });
        }
      }
      if (ids.length) {
        toast({
          variant: 'default',
          title: 'Conversions Paused',
          description: `Paused ${ids.length} conversion(s)`,
          duration: 3000,
        });
      }
    } catch (err) {
      console.error('Pause all error:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to pause all', duration: 3000 });
    }
  };

  const resumeAll = async () => {
    try {
      // Get fresh functions from store
      const { resumeConversion, updateDownload } = useDownloadStore.getState();
      const ids = activeConversions
        .filter((c) => c.status === 'paused')
        .map((c) => c.id);
      
      console.log('▶️ Resuming all conversions:', ids);
      
      for (const id of ids) {
        const res = await resumeConversion(id);
        if (res.success) {
          updateDownload(id, {
            type: 'conversion',
            data: { status: 'converting', log: 'Conversion resumed from navbar (all)' },
          });
        }
      }
      if (ids.length) {
        toast({
          variant: 'success',
          title: 'Conversions Resumed',
          description: `Resumed ${ids.length} conversion(s)`,
          duration: 3000,
        });
      }
    } catch (err) {
      console.error('Resume all error:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to resume all', duration: 3000 });
    }
  };

  const stopAll = async () => {
    try {
      const ids = activeConversions.map((c) => c.id);
      // Get fresh functions from store
      const { stopConversion, deleteDownloading } = useDownloadStore.getState();
      
      console.log('🛑 Stopping all conversions:', ids);
      
      for (const id of ids) {
        const res = await stopConversion(id);
        if (res.success) {
          deleteDownloading(id);
        }
      }
      if (ids.length) {
        toast({
          variant: 'default',
          title: 'Conversions Stopped',
          description: `Stopped ${ids.length} conversion(s)`,
          duration: 3000,
        });
      }
    } catch (err) {
      console.error('Stop all error:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to stop all', duration: 3000 });
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

          {/* Global controls to mirror context menu behaviour */}
          <div className="flex items-center gap-1 border-l border-gray-300 dark:border-gray-600 pl-2 ml-1">
            {anyRunning && (
              <TooltipWrapper content="Pause all conversions" side="bottom">
                <button 
                  onClick={pauseAll} 
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  aria-label="Pause all conversions"
                >
                  <FaPause size={12} className="text-yellow-600 dark:text-yellow-400" />
                </button>
              </TooltipWrapper>
            )}
            {anyPaused && (
              <TooltipWrapper content="Resume all conversions" side="bottom">
                <button 
                  onClick={resumeAll} 
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  aria-label="Resume all conversions"
                >
                  <FaPlay size={12} className="text-green-600 dark:text-green-400" />
                </button>
              </TooltipWrapper>
            )}
            <TooltipWrapper content="Stop all conversions" side="bottom">
              <button 
                onClick={stopAll} 
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Stop all conversions"
              >
                <FaStop size={12} className="text-red-600 dark:text-red-400" />
              </button>
            </TooltipWrapper>
          </div>

          {/* Individual conversion controls - show only if multiple conversions */}
          {activeConversions.length > 1 && (
            <div className="flex items-center gap-1 border-l border-gray-300 dark:border-gray-600 pl-2 ml-1">
              {activeConversions.map((conversion, index) => {
                const isPaused = conversion.status === 'paused';
                const conversionName = conversion.name || conversion.downloadName || `Conversion ${index + 1}`;

                return (
                  <div key={conversion.id} className="flex items-center gap-1">
                    <TooltipWrapper 
                      content={`${conversionName}: ${isPaused ? 'Resume' : 'Pause'}`} 
                      side="bottom"
                    >
                      <button
                        onClick={() => handleConversionPauseResume(conversion.id, isPaused)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        aria-label={`${isPaused ? 'Resume' : 'Pause'} ${conversionName}`}
                      >
                        {isPaused ? (
                          <FaPlay size={10} className="text-green-600 dark:text-green-400" />
                        ) : (
                          <FaPause size={10} className="text-yellow-600 dark:text-yellow-400" />
                        )}
                      </button>
                    </TooltipWrapper>

                    <TooltipWrapper content={`Stop ${conversionName}`} side="bottom">
                      <button
                        onClick={() => handleConversionStop(conversion.id)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        aria-label={`Stop ${conversionName}`}
                      >
                        <FaStop size={10} className="text-red-600 dark:text-red-400" />
                      </button>
                    </TooltipWrapper>
                  </div>
                );
              })}
            </div>
          )}
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
