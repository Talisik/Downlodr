/* eslint-disable @typescript-eslint/no-explicit-any */
// src/plugins/registry.ts
import { MenuItem, NotifItem, TaskBarItem } from './types';

// Simple registry to keep track of plugin registrations
export class PluginRegistry {
  private menuItems: MenuItem[] = [];
  private menuItemHandlers: Map<string, (contextData?: any) => void> =
    new Map();

  private notifItems: NotifItem[] = [];
  private notifItemHandlers: Map<string, (contextData?: any) => void> =
    new Map();

  // Keep a reference to enabled plugin states
  private enabledPlugins: Record<string, boolean> = {};

  // Add this property near the other private property declarations
  private _extensions: Record<string, any[]> = {};

  // New array for taskbar items
  private taskBarItems: TaskBarItem[] = [];

  // Methods for taskbar items
  registerTaskBarItem(item: TaskBarItem): string {
    const id = item.id || `${item.pluginId}:taskbar:${Date.now()}`;

    // Store the onClick handler in handlers map for later execution
    if (item.onClick && item.handlerId) {
      this.taskBarActionHandlers.set(item.handlerId, item.onClick);
    }

    // Create a serializable version without function properties
    const serializableItem = {
      ...item,
      id,
      onClick: undefined as unknown as (contextData?: any) => void,
    };

    // Replace any existing item with the same ID
    const existingIndex = this.taskBarItems.findIndex((i) => i.id === id);
    if (existingIndex >= 0) {
      this.taskBarItems[existingIndex] = serializableItem;
    } else {
      this.taskBarItems.push(serializableItem);
    }

    return id;
  }

  unregisterTaskBarItem(id: string): boolean {
    const initialLength = this.taskBarItems.length;
    this.taskBarItems = this.taskBarItems.filter((item) => item.id !== id);
    return this.taskBarItems.length < initialLength;
  }

  getTaskBarItems(): TaskBarItem[] {
    // First filter by enabled state
    // First filter by enabled state
    const filteredItems = this.taskBarItems.filter(
      (item) => this.enabledPlugins[item.pluginId || ''] !== false,
    );

    // Create a map to deduplicate items
    const itemMap = new Map();

    // Deduplicate items using a unique key
    for (const item of filteredItems) {
      const key = `${item.pluginId.trim()}:${item.label.trim()}`;
      itemMap.set(key, item);
    }

    // Return the deduplicated items
    return Array.from(itemMap.values());
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executeTaskBarItemAction(id: string, contextData?: any): void {
    console.log('Executing with contextData:', contextData);
    console.log('ContextData type:', typeof contextData);
    console.log(
      'ContextData keys:',
      contextData ? Object.keys(contextData) : 'none',
    );

    const handler = this.taskBarActionHandlers.get(id);
    if (handler) {
      handler(contextData);
    } else {
      console.warn(`No handler found for taskbar item ${id}`);
    }
  }

  // Method to update enabled states
  updateEnabledStates(enabledStates: Record<string, boolean>) {
    this.enabledPlugins = enabledStates;
  }

  // Add this method to clear everything
  clearAllRegistrations(pluginId?: string) {
    if (pluginId) {
      // Clear only items from this plugin
      this.menuItems = this.menuItems.filter(
        (item) => item.pluginId !== pluginId,
      );

      // Clear handlers from this plugin
      const handlersToRemove: string[] = [];
      this.menuItemHandlers.forEach((_, key) => {
        console.log(this.menuItemHandlers);
        if (key.startsWith(pluginId)) {
          handlersToRemove.push(key);
        }
      });

      handlersToRemove.forEach((key) => {
        this.menuItemHandlers.delete(key);
      });

      // Remove all taskbar items for this plugin
      this.taskBarItems = this.taskBarItems.filter(
        (item) => item.pluginId !== pluginId,
      );

      // Remove all handlers for this plugin's taskbar items
      for (const [key] of this.taskBarActionHandlers) {
        if (key.startsWith(`${pluginId}:`)) {
          this.taskBarActionHandlers.delete(key);
        }
      }
    } else {
      // Clear everything
      this.menuItems = [];
      this.menuItemHandlers.clear();
    }
  }

  registerMenuItem(item: MenuItem): string {
    const id = item.id || `menu-item-${Date.now()}`;

    // Store the onClick handler separately
    if (item.onClick) {
      this.menuItemHandlers.set(id, item.onClick);
    }

    const serializableItem = {
      ...item,
      id,
      // Explicitly type onClick as undefined
      onClick: undefined as unknown as () => void,
    };

    this.menuItems.push(serializableItem);
    return id;
  }

  unregisterMenuItem(id: string) {
    this.menuItems = this.menuItems.filter((item) => item.id !== id);
  }

  getMenuItems(context?: string): Omit<MenuItem, 'onClick'>[] {
    // Filter by context first
    let filteredItems = context
      ? this.menuItems.filter(
          (item) =>
            !item.context || item.context === context || item.context === 'all',
        )
      : this.menuItems;

    // Filter by enabled state
    filteredItems = filteredItems.filter((item) => {
      // Items without pluginId or from enabled plugins are shown
      return !item.pluginId || this.enabledPlugins[item.pluginId] !== false;
    });

    // Create a map to deduplicate items
    const itemMap = new Map();

    // More explicit deduplication with trimming to handle whitespace issues
    for (const item of filteredItems) {
      const key = `${item.pluginId.trim()}:${item.label.trim()}`;
      itemMap.set(key, item);
    }

    const uniqueItems = Array.from(itemMap.values());

    return uniqueItems;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executeMenuItemAction(id: string, contextData?: any): void {
    const handler = this.menuItemHandlers.get(id);
    if (handler) {
      handler(contextData);
    }
  }

  registerNotifItem(item: NotifItem): string {
    const id = item.id || `notif-item-${Date.now()}`;

    // Store the onClick handler separately
    if (item.onClick) {
      this.notifItemHandlers.set(id, item.onClick);
    }

    const serializableItem = {
      ...item,
      id,
      // Explicitly type onClick as undefined
      onClick: undefined as unknown as () => void,
    };

    this.notifItems.push(serializableItem);
    return id;
  }

  unregisterNotifItem(id: string) {
    this.notifItems = this.notifItems.filter((item) => item.id !== id);
  }

  getNotifItems(context?: string): Omit<NotifItem, 'onClick'>[] {
    // Filter by context first
    let filteredItems = context
      ? this.notifItems.filter(
          (item) =>
            !item.context || item.context === context || item.context === 'all',
        )
      : this.notifItems;

    // Filter by enabled state
    filteredItems = filteredItems.filter((item) => {
      // Items without pluginId or from enabled plugins are shown
      return !item.pluginId || this.enabledPlugins[item.pluginId] !== false;
    });

    // Create a map to deduplicate items
    const itemMap = new Map();

    // More explicit deduplication with trimming to handle whitespace issues
    for (const item of filteredItems) {
      const key = `${item.pluginId.trim()}:${item.title.trim()}`;
      itemMap.set(key, item);
    }

    const uniqueItems = Array.from(itemMap.values());

    return uniqueItems;
  }

  // Generic method to filter any plugin features by enabled state
  filterByEnabled<T extends { pluginId?: string }>(items: T[]): T[] {
    return items.filter(
      (item) => !item.pluginId || this.enabledPlugins[item.pluginId] !== false,
    );
  }

  // For any extension point (components, UI elements, functions, etc.)
  getExtensions(extensionPoint: string) {
    const extensions = this._extensions[extensionPoint] || [];
    return this.filterByEnabled(extensions);
  }

  // taskbar action handlers map
  private taskBarActionHandlers = new Map<
    string,
    (contextData?: any) => void
  >();

  setTaskBarItemHandler(
    id: string,
    handler: (contextData?: any) => void,
  ): void {
    this.taskBarActionHandlers.set(id, handler);
  }
}

// Export a singleton instance
export const pluginRegistry = new PluginRegistry();
