import React, { useState, useEffect } from 'react';
import { usePluginState } from '../../../plugins/Hooks/usePluginState';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../shadcn/components/ui/tooltip';
import { TaskBarItem } from '../../../plugins/types';

// Using the global TaskBarItem interface instead of redefining it
const TaskBarPluginItems: React.FC = () => {
  const [taskBarItems, setTaskBarItems] = useState<TaskBarItem[]>([]);
  const enabledPlugins = usePluginState();

  const fetchTaskBarItems = async () => {
    try {
      // Get taskbar items from plugin registry
      const items = await window.plugins.getTaskBarItems();
      setTaskBarItems(items);
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

  return (
    <div className="flex gap-2 items-center">
      <TooltipProvider>
        {taskBarItems.map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => {
                  if (item.onClick) {
                    item.onClick();
                  } else {
                    window.plugins.executeTaskBarItem(item.id);
                  }
                }}
                aria-label={item.label}
              >
                {item.icon ? (
                  item.icon
                ) : (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{item.tooltip || item.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
};

export default TaskBarPluginItems;
