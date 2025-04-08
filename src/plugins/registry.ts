// src/plugins/registry.ts
import { MenuItem } from './types';

// Simple registry to keep track of plugin registrations
export class PluginRegistryClass {
  private menuItems = new Map<string, MenuItem>();

  registerMenuItem(id: string, item: MenuItem) {
    this.menuItems.set(id, item);
  }

  unregisterMenuItem(id: string) {
    this.menuItems.delete(id);
  }

  getMenuItems() {
    return Array.from(this.menuItems.values());
  }

  // Add more registration methods for other extension points
}

// Singleton instance
export const PluginRegistry = new PluginRegistryClass();
