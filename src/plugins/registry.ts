// src/plugins/registry.ts
import { MenuItem } from './types';

// Simple registry to keep track of plugin registrations
export class PluginRegistry {
  private menuItems: MenuItem[] = [];
  private menuItemHandlers: Map<string, (contextData?: any) => void> =
    new Map();

  registerMenuItem(item: MenuItem): string {
    const id = item.id || `menu-item-${Date.now()}`;

    console.log('Registering menu item with ID:', id);
    console.log('Has onClick handler:', !!item.onClick);

    // Store the onClick handler separately
    if (item.onClick) {
      this.menuItemHandlers.set(id, item.onClick);
      console.log('Handler registered successfully');
    }

    // Create a serializable version of the menu item without the function
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
    const items = context
      ? this.menuItems.filter(
          (item) =>
            !item.context || item.context === context || item.context === 'all',
        )
      : this.menuItems;

    // Return serializable items (without onClick functions)
    return items;
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

  // Add more registration methods for other extension points
}

// Singleton instance
export const pluginRegistry = new PluginRegistry();
