import React, { useEffect, useState } from 'react';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
} from '../../Components/SubComponents/shadcn/components/ui/tooltip';
import { useToast } from '../../Components/SubComponents/shadcn/hooks/use-toast';
import { useMainStore } from '../../Store/mainStore';
import { usePluginState } from '../Hooks/usePluginState';
import { TaskBarItem } from '../types';

// Using the global TaskBarItem interface instead of redefining it
const TaskBarPluginItems: React.FC = () => {
  const [taskBarItems, setTaskBarItems] = useState<TaskBarItem[]>([]);
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
    }
  };

  useEffect(() => {
    fetchTaskBarItems();

    // Set up listener for plugin reloaded events
    const unsubscribe = window.plugins.onReloaded(() => {
      fetchTaskBarItems();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [enabledPlugins]);

  if (taskBarItems.length === 0) {
    return null;
  }

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
                  <span className="inline-flex items-center justify-center w-3 h-3 mt-1 flex-shrink-0">
                    {typeof item.icon === 'string' && isSvgString(item.icon) ? (
                      <span
                        dangerouslySetInnerHTML={{ __html: item.icon }}
                        className="text-black dark:text-white [&>svg]:w-3 [&>svg]:h-3 [&>svg]:fill-current"
                      />
                    ) : (
                      <span className="text-black dark:text-white">
                        {item.icon}
                      </span>
                    )}
                  </span>
                )}
                <span className="hidden lg:inline text-sm">{item.label}</span>{' '}
              </button>
            </TooltipTrigger>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
};

export default TaskBarPluginItems;
