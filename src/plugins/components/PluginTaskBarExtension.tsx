import React, { useEffect, useState } from 'react';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
} from '../../Components/SubComponents/shadcn/components/ui/tooltip';
import { useToast } from '../../Components/SubComponents/shadcn/hooks/use-toast';
import { cn } from '../../Components/SubComponents/shadcn/lib/utils';
import { useMainStore } from '../../Store/mainStore';
import { usePluginState } from '../Hooks/usePluginState';
import { TaskBarItem } from '../types';

const PluginTaskBarExtension: React.FC = () => {
  const [taskBarItems, setTaskBarItems] = useState<TaskBarItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const enabledPlugins = usePluginState();
  const { selectedDownloads } = useMainStore();
  const { toast } = useToast();
  const clearAllSelections = useMainStore((state) => state.clearAllSelections);

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

  if (isLoading || taskBarItems.length === 0) {
    return null;
  }

  // Render icon helper function
  const renderIcon = (icon: any, size: 'sm' | 'md' = 'sm') => {
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

  const handleItemClick = (item: TaskBarItem) => {
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
    <div className="flex flex-wrap gap-2 max-w-xs max-h-16 overflow-hidden">
      <TooltipProvider>
        {taskBarItems.map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                className="hover:bg-gray-100 dark:hover:bg-darkModeHover px-2 py-1 rounded flex gap-1 font-semibold dark:text-gray-200 flex-shrink-0"
                onClick={() => handleItemClick(item)}
                aria-label={item.label}
              >
                {item.icon && (
                  <span className="inline-flex items-center justify-center w-4 h-4 flex-shrink-0">
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
                )}
                <span
                  className={cn('text-sm', item.icon && 'hidden lg:inline')}
                >
                  {item.label}
                </span>{' '}
              </button>
            </TooltipTrigger>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
};

export default PluginTaskBarExtension;
