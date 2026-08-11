import { Button } from '@/core-app/components/shadcn/components/ui/button';
import { renderIcon } from '@/plugins/utils/pluginIconHelper';
import { isSvgString } from '@/core-app/utils/stringHelper';
import { useToast } from '@/core-app/components/shadcn/hooks/use-toast';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { useMainStore } from '@/core-app/store/mainStore';
import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
import useDownloadStore from '@/downlodr/store/downloadStore';
import { TaskBarItem } from '@/plugins/schema/types';
import React, { useEffect, useState } from 'react';
import { usePluginState } from '../hook/usePluginState';

const PluginTaskBarExtension: React.FC = () => {
  const [taskBarItems, setTaskBarItems] = useState<TaskBarItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const enabledPlugins = usePluginState();
  const { taskBarButtonsVisibility } = useMainStore();
  const selectedDownloads = useSelectedDownloadStore(
    (state) => state.selectedDownloads,
  );
  const { downloading } = useDownloadStore();
  const { toast } = useToast();
  const clearAllSelections = useSelectedDownloadStore(
    (state) => state.clearAllSelections,
  );

  // Helper function to check if a string is an SVG

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

  if (isLoading || taskBarItems.length === 0) {
    return null;
  }

  // Render icon helper function

  const handleItemClick = (item: TaskBarItem) => {
    if (item.actionType === 'multiple' && !selectedDownloads.length) {
      window.PluginHandlers[item.handlerId](downloading);
      return;
    }

    if (!selectedDownloads.length) {
      toast({
        variant: 'destructive',
        title: 'No Downloads Selected',
        description: 'Please select downloads to use plugin',
        duration: 5000,
      });
      return;
    }

    // Get selected downloads data
    const downloadsData = selectedDownloads.map((id) => {
      // Here you would gather any relevant data about the selected downloads
      return { id };
    });

    // Find and call the handler using the handlerId
    if (
      item.handlerId &&
      window.PluginHandlers &&
      window.PluginHandlers[item.handlerId]
    ) {
      console.log(`Executing taskbar item with handler: ${item.handlerId}`);
      console.log(downloadsData);
      window.PluginHandlers[item.handlerId](downloadsData);
      clearAllSelections();
    } else {
      console.error(
        `No handler found for taskbar item ${item.id} (looking for handlerId: ${item.handlerId})`,
      );
      // Fallback to the IPC method for non-renderer plugins
      window.plugins.executeTaskBarItem(item.id || '', downloadsData);
    }
  };

  return (
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
            className={`hover:bg-gray-100 dark:hover:bg-darkModeHover px-2 py-1 rounded flex gap-1 font-semibold dark:text-gray-200 flex-shrink-0
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
                      {renderIcon(item.icon, 'sm', item.label, 'w-4 h-4')}
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
  );
};

export default PluginTaskBarExtension;
