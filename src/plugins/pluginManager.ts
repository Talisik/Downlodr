// src/plugins/pluginManager.ts
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { DownlodrPlugin, PluginAPI } from './types';
import { createPluginAPI } from './pluginAPI';

export class PluginManager {
  private plugins: Map<string, DownlodrPlugin> = new Map();
  private pluginAPIs: Map<string, PluginAPI> = new Map();
  private pluginsDir: string;

  constructor() {
    this.pluginsDir = path.join(app.getPath('userData'), 'plugins');
    this.ensurePluginDirectory();
  }

  private ensurePluginDirectory() {
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
    }
  }

  async loadPlugins() {
    const pluginDirs = fs
      .readdirSync(this.pluginsDir)
      .filter((file) =>
        fs.statSync(path.join(this.pluginsDir, file)).isDirectory(),
      );

    for (const dir of pluginDirs) {
      await this.loadPlugin(dir);
    }
  }

  async loadPlugin(pluginDir: string) {
    try {
      const manifestPath = path.join(
        this.pluginsDir,
        pluginDir,
        'manifest.json',
      );

      if (!fs.existsSync(manifestPath)) {
        console.error(`Plugin ${pluginDir} missing manifest.json`);
        return;
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const mainFile = path.join(
        this.pluginsDir,
        pluginDir,
        manifest.main || 'index.js',
      );

      if (!fs.existsSync(mainFile)) {
        console.error(
          `Plugin ${pluginDir} missing main file: ${
            manifest.main || 'index.js'
          }`,
        );
        return;
      }

      // Load plugin (using dynamic import instead of require)
      const pluginModule = await import(mainFile);
      const plugin: DownlodrPlugin = pluginModule.default || pluginModule;

      // Create isolated API for this plugin
      const api = createPluginAPI(plugin.id);

      // Initialize plugin
      await plugin.initialize(api);

      // Store references
      this.plugins.set(plugin.id, plugin);
      this.pluginAPIs.set(plugin.id, api);

      console.log(`Plugin loaded: ${plugin.name} v${plugin.version}`);
    } catch (error) {
      console.error(`Failed to load plugin ${pluginDir}:`, error);
    }
  }

  async unloadPlugin(pluginId: string) {
    const plugin = this.plugins.get(pluginId);
    if (plugin && plugin.onUnload) {
      await plugin.onUnload();
    }
    this.plugins.delete(pluginId);
    this.pluginAPIs.delete(pluginId);
  }

  getPlugins() {
    return Array.from(this.plugins.values()).map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      description: p.description,
      author: p.author,
    }));
  }

  async installPlugin(pluginPath: string): Promise<boolean> {
    try {
      // 1. Validate the plugin file (check if it's a zip file)
      if (!pluginPath.endsWith('.zip')) {
        console.error('Plugin file must be a .zip file');
        return false;
      }

      // 2. Extract the plugin to a temporary directory
      const tempDir = path.join(
        app.getPath('temp'),
        `downlodr-plugin-${Date.now()}`,
      );
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // You'll need to add extraction logic here
      // For example, using a library like 'extract-zip'

      // 3. Validate the plugin structure
      const manifestPath = path.join(tempDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        console.error('Invalid plugin: Missing manifest.json');
        return false;
      }

      // 4. Read the manifest to get the plugin ID
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (!manifest.id) {
        console.error('Invalid plugin: Missing plugin ID in manifest');
        return false;
      }

      // 5. Create the plugin directory
      const pluginDir = path.join(this.pluginsDir, manifest.id);
      if (fs.existsSync(pluginDir)) {
        // Plugin already exists, remove it first
        fs.rmSync(pluginDir, { recursive: true, force: true });
      }

      // 6. Copy the plugin files
      fs.mkdirSync(pluginDir, { recursive: true });
      fs.cpSync(tempDir, pluginDir, { recursive: true });

      // 7. Load the plugin
      await this.loadPlugin(manifest.id);

      // 8. Clean up temporary directory
      fs.rmSync(tempDir, { recursive: true, force: true });

      return true;
    } catch (error) {
      console.error('Failed to install plugin:', error);
      return false;
    }
  }
}
