// src/plugins/pluginManager.ts
import { app, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { validatePlugin } from './security';

export class PluginManager {
  private pluginsDir: string;
  private loadedPlugins: Map<string, any> = new Map();

  constructor() {
    this.pluginsDir = path.join(app.getPath('userData'), 'plugins');
    this.ensurePluginDirectory();
    // Don't call setupIPC here - it will be called separately
  }

  private ensurePluginDirectory() {
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
    }
  }

  // Make this method public so we can call it once from main.ts
  setupIPC() {
    // Get list of available plugins
    ipcMain.handle('plugins:list', async () => {
      return this.getPluginsMetadata();
    });

    // Get plugin code for renderer to execute
    ipcMain.handle('plugins:get-code', async (event, pluginId) => {
      const pluginPath = path.join(this.pluginsDir, pluginId);
      if (!fs.existsSync(pluginPath)) {
        return { error: 'Plugin not found' };
      }

      try {
        // Read manifest
        const manifestPath = path.join(pluginPath, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
          return { error: 'Manifest not found' };
        }
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

        // Read main code file
        const mainFile = manifest.main || 'index.js';
        const mainFilePath = path.join(pluginPath, mainFile);
        if (!fs.existsSync(mainFilePath)) {
          return { error: 'Main file not found' };
        }
        const code = fs.readFileSync(mainFilePath, 'utf8');

        return { code, manifest };
      } catch (error) {
        console.error(`Error getting plugin code for ${pluginId}:`, error);
        return { error: `Failed to load plugin: ${error.message}` };
      }
    });

    // Install plugin
    ipcMain.handle('plugins:install', async (event, pluginPath) => {
      return await this.installPlugin(pluginPath);
    });

    // Uninstall plugin
    ipcMain.handle('plugins:uninstall', async (event, pluginId) => {
      const pluginDir = path.join(this.pluginsDir, pluginId);
      if (fs.existsSync(pluginDir)) {
        fs.rmSync(pluginDir, { recursive: true });
        return true;
      }
      return false;
    });

    // Load unzipped plugin
    ipcMain.handle('plugins:loadUnzipped', async (event, pluginDirPath) => {
      return await this.loadUnzippedPlugin(pluginDirPath);
    });

    // Register for handling plugin IPC requests
    ipcMain.handle('plugin:fs:writeFile', async (event, args) => {
      // Validate paths to ensure they're within allowed directories
      const { filePath, content } = args;
      // Security check: only allow writing to plugin data directory
      if (!this.isPathWithinPluginsData(filePath)) {
        return {
          error: 'Access denied: Cannot write outside plugin data directory',
        };
      }

      try {
        fs.writeFileSync(filePath, content, 'utf8');
        return { success: true };
      } catch (error) {
        return { error: error.message };
      }
    });

    // Add other controlled filesystem operations here
  }

  // Security check to limit file access to appropriate directories
  private isPathWithinPluginsData(filePath: string): boolean {
    const pluginsDataDir = path.join(app.getPath('userData'), 'plugin-data');
    const normalizedPath = path.normalize(filePath);
    return normalizedPath.startsWith(pluginsDataDir);
  }

  getPluginsMetadata() {
    try {
      const pluginDirs = fs
        .readdirSync(this.pluginsDir)
        .filter((file) =>
          fs.statSync(path.join(this.pluginsDir, file)).isDirectory(),
        );

      return pluginDirs
        .map((dir) => {
          try {
            const manifestPath = path.join(
              this.pluginsDir,
              dir,
              'manifest.json',
            );
            if (fs.existsSync(manifestPath)) {
              const manifest = JSON.parse(
                fs.readFileSync(manifestPath, 'utf8'),
              );
              return {
                id: manifest.id || dir,
                name: manifest.name || dir,
                version: manifest.version || '0.0.0',
                description: manifest.description || '',
                author: manifest.author || 'Unknown',
              };
            }
            return null;
          } catch (error) {
            console.error(`Error reading plugin ${dir}:`, error);
            return null;
          }
        })
        .filter(Boolean);
    } catch (error) {
      console.error('Error listing plugins:', error);
      return [];
    }
  }

  async installPlugin(pluginPath: string): Promise<boolean> {
    try {
      // Check if the path exists
      if (!fs.existsSync(pluginPath)) {
        console.error(`Plugin path does not exist: ${pluginPath}`);
        return false;
      }

      // Check if it's a directory with a valid plugin structure
      const isValid = await validatePlugin(pluginPath);
      if (!isValid) {
        console.error(`Invalid plugin at: ${pluginPath}`);
        return false;
      }

      // Get the plugin ID from the manifest
      const manifestPath = path.join(pluginPath, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const pluginId = manifest.id;

      // Create destination directory
      const destDir = path.join(this.pluginsDir, pluginId);

      // Remove existing plugin with same ID if it exists
      if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true });
      }

      // Copy the plugin files
      fs.mkdirSync(destDir, { recursive: true });
      this.copyFolderRecursive(pluginPath, destDir);

      return true;
    } catch (error) {
      console.error('Failed to install plugin:', error);
      return false;
    }
  }

  async loadUnzippedPlugin(pluginDirPath: string): Promise<boolean> {
    try {
      // Validate the plugin
      const isValid = await validatePlugin(pluginDirPath);
      if (!isValid) {
        console.error(`Invalid plugin at: ${pluginDirPath}`);
        return false;
      }

      // Get the plugin ID from the manifest
      const manifestPath = path.join(pluginDirPath, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const pluginId = manifest.id;

      // Create destination directory
      const destDir = path.join(this.pluginsDir, pluginId);

      // Remove existing plugin with same ID if it exists
      if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true });
      }

      // Copy the plugin files
      fs.mkdirSync(destDir, { recursive: true });
      this.copyFolderRecursive(pluginDirPath, destDir);

      return true;
    } catch (error) {
      console.error('Failed to load unzipped plugin:', error);
      return false;
    }
  }

  // Helper method to copy folders recursively
  private copyFolderRecursive(source: string, target: string) {
    // Create target directory if it doesn't exist
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    // Copy each file/directory from source to target
    const files = fs.readdirSync(source);
    files.forEach((file) => {
      const sourcePath = path.join(source, file);
      const targetPath = path.join(target, file);

      if (fs.statSync(sourcePath).isDirectory()) {
        this.copyFolderRecursive(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    });
  }

  getPlugins() {
    return this.getPluginsMetadata();
  }

  async unloadPlugin(pluginId: string): Promise<boolean> {
    try {
      // 1. Remove from memory if loaded
      this.loadedPlugins.delete(pluginId);

      // 2. Delete from disk
      const pluginDir = path.join(this.pluginsDir, pluginId);
      if (fs.existsSync(pluginDir)) {
        fs.rmSync(pluginDir, { recursive: true });
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to unload plugin ${pluginId}:`, error);
      return false;
    }
  }

  async loadPlugins() {
    try {
      // Get all subdirectories in the plugins directory
      const pluginDirs = fs
        .readdirSync(this.pluginsDir)
        .filter((file) =>
          fs.statSync(path.join(this.pluginsDir, file)).isDirectory(),
        );

      // Load each plugin
      for (const dir of pluginDirs) {
        const pluginPath = path.join(this.pluginsDir, dir);
        const isValid = await validatePlugin(pluginPath);

        if (isValid) {
          // Just validate and register plugins - actual execution happens in renderer
          const manifestPath = path.join(pluginPath, 'manifest.json');
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          this.loadedPlugins.set(manifest.id, { path: pluginPath, manifest });
          console.log(`Plugin ${manifest.id} registered for loading`);
        } else {
          console.error(`Invalid plugin found at ${pluginPath}`);
        }
      }

      return true;
    } catch (error) {
      console.error('Error loading plugins:', error);
      return false;
    }
  }
}
