// src/plugins/registry.ts
import { MenuItem, NotifItem } from './types';

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
        if (key.startsWith(pluginId)) {
          handlersToRemove.push(key);
        }
      });

      handlersToRemove.forEach((key) => {
        this.menuItemHandlers.delete(key);
      });
    } else {
      // Clear everything
      this.menuItems = [];
      this.menuItemHandlers.clear();
    }
  }

  registerMenuItem(item: MenuItem): string {
    const id = item.id || `menu-item-${Date.now()}`;

    console.log('Registering menu item with ID:', id);
    console.log('Has onClick handler:', !!item.onClick);

    // Store the onClick handler separately
    if (item.onClick) {
      this.menuItemHandlers.set(id, item.onClick);
      console.log('Handler registered successfully');
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
    console.log(`Getting menu items for context: ${context}`);
    console.log(`Total registered items: ${this.menuItems.length}`);

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

    filteredItems.forEach((item) => {
      console.log(`Item key: ${item.pluginId}:${item.label}`);
    });

    // Create a map to deduplicate items
    const itemMap = new Map();

    // More explicit deduplication with trimming to handle whitespace issues
    for (const item of filteredItems) {
      const key = `${item.pluginId.trim()}:${item.label.trim()}`;
      itemMap.set(key, item);
    }

    const uniqueItems = Array.from(itemMap.values());

    console.log(`Returning ${uniqueItems.length} items for context ${context}`);
    console.log('Items:', uniqueItems);

    return uniqueItems;
  }

  executeMenuItemAction(id: string, contextData?: any): void {
    console.log('Executing menu item with ID:', id);
    console.log(
      'Available handlers:',
      Array.from(this.menuItemHandlers.keys()),
    );
    const handler = this.menuItemHandlers.get(id);
    console.log('Handler found:', handler ? 'Yes' : 'No');
    console.log(contextData);
    if (handler) {
      console.log(contextData);
      handler(contextData);
    }
  }

  registerNotifItem(item: NotifItem): string {
    const id = item.id || `notif-item-${Date.now()}`;

    console.log('Registering notif item with ID:', id);
    console.log('Has onClick handler:', !!item.onClick);

    // Store the onClick handler separately
    if (item.onClick) {
      this.notifItemHandlers.set(id, item.onClick);
      console.log('Handler registered successfully');
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
    console.log(`Getting notif items for context: ${context}`);
    console.log(`Total registered items: ${this.notifItems.length}`);

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

    // Add debug logging to see the generated keys
    filteredItems.forEach((item) => {
      console.log(`Item key: ${item.pluginId}:${item.title}`);
    });

    // Create a map to deduplicate items
    const itemMap = new Map();

    // More explicit deduplication with trimming to handle whitespace issues
    for (const item of filteredItems) {
      const key = `${item.pluginId.trim()}:${item.title.trim()}`;
      itemMap.set(key, item);
    }

    const uniqueItems = Array.from(itemMap.values());

    console.log(`Returning ${uniqueItems.length} items for context ${context}`);
    console.log('Items:', uniqueItems);

    return uniqueItems;
  }

  executeNotifItemAction(id: string, contextData?: any): void {
    console.log('Executing notif item with ID:', id);
    console.log(
      'Available handlers:',
      Array.from(this.notifItemHandlers.keys()),
    );
    const handler = this.notifItemHandlers.get(id);
    console.log('Handler found:', handler ? 'Yes' : 'No');
    console.log(contextData);
    if (handler) {
      console.log(contextData);
      handler(contextData);
    }
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

  // Add a method to register extensions
  registerExtension(extensionPoint: string, extension: any): void {
    if (!this._extensions[extensionPoint]) {
      this._extensions[extensionPoint] = [];
    }
    this._extensions[extensionPoint].push(extension);
  }
}

// Export a singleton instance
export const pluginRegistry = new PluginRegistry();
