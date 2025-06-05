// src/plugins/pluginManager.ts
import { app, ipcMain, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { validatePlugin } from './security';

export class PluginManager {
  private pluginsDir: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private loadedPlugins: Map<string, any> = new Map();
  private enabledPlugins: Record<string, boolean> = {};
  private configPath: string;

  constructor() {
    this.pluginsDir = path.join(app.getPath('userData'), 'plugins');
    this.configPath = path.join(app.getPath('userData'), 'plugin-config.json');
    this.ensurePluginDirectory();
    this.loadEnabledState();
  }

  private ensurePluginDirectory() {
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
    }
  }

  private loadEnabledState() {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        this.enabledPlugins = config.enabledPlugins || {};
      }
    } catch (error) {
      console.error('Error loading plugin config:', error);
      this.enabledPlugins = {};
    }
  }

  private saveEnabledState() {
    try {
      const config = { enabledPlugins: this.enabledPlugins };
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf8',
      );
    } catch (error) {
      console.error('Error saving plugin config:', error);
    }
  }

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

    // Get plugin location
    ipcMain.handle('plugins:get-location', async (event, pluginId) => {
      const pluginPath = path.join(this.pluginsDir, pluginId);
      if (fs.existsSync(pluginPath)) {
        return pluginPath;
      }
      return null;
    });

    // Open plugin folder in file explorer
    ipcMain.handle('plugins:open-folder', async (event, pluginId) => {
      const pluginPath = path.join(this.pluginsDir, pluginId);
      if (fs.existsSync(pluginPath)) {
        // Use electron shell to open the folder
        await shell.openPath(pluginPath);
        return true;
      }
      return false;
    });

    // Install plugin
    ipcMain.handle('plugins:install', async (event, pluginPath) => {
      try {
        // Assuming pluginManager is your instance of PluginManager
        return await this.installPlugin(pluginPath);
      } catch (error) {
        console.error('Failed to install plugin via IPC:', error);
        return false;
      }
    });
    /*
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
  */
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

    // Get enabled plugins state
    ipcMain.handle('plugins:getEnabled', () => {
      return this.enabledPlugins;
    });

    // Set plugin enabled state
    ipcMain.handle('plugins:setEnabled', (event, pluginId, enabled) => {
      try {
        this.enabledPlugins[pluginId] = enabled;
        this.saveEnabledState();

        // Notify renderer about the state change
        event.sender.send('plugins:stateChanged', { pluginId, enabled });

        return true;
      } catch (error) {
        console.error(`Error setting plugin ${pluginId} state:`, error);
        return false;
      }
    });

    // Execute taskbar item
    ipcMain.handle(
      'plugins:executeTaskBarItem',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (event, itemId, contextData) => {
        try {
          return true;
        } catch (error) {
          console.error(`Error executing taskbar item ${itemId}:`, error);
          return false;
        }
      },
    );

    // Modified writeFile handler
    ipcMain.handle('plugins:writeFile', async (event, options) => {
      try {
        const {
          pluginId,
          fileName,
          content,
          fileType,
          directory,
          overwrite,
          customPath,
        } = options;

        let finalPath;

        // If customPath is provided, use it directly (plugin is requesting to write to a specific location)
        if (customPath) {
          // For security, you may want to restrict certain paths or require confirmation
          finalPath = customPath;
        } else {
          // Create plugin-specific data directory
          const pluginDataDir = path.join(
            app.getPath('userData'),
            'plugin-data',
            pluginId,
          );
          if (!fs.existsSync(pluginDataDir)) {
            fs.mkdirSync(pluginDataDir, { recursive: true });
          }

          // Determine final directory (with optional subdirectory)
          let targetDir = pluginDataDir;
          if (directory) {
            // Sanitize directory name to prevent path traversal
            const sanitizedDir = directory
              .replace(/\.\./g, '')
              .replace(/[/\\]/g, '-');
            targetDir = path.join(pluginDataDir, sanitizedDir);
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }
          }

          // Sanitize filename
          const sanitizedFileName = fileName
            .replace(/\.\./g, '')
            .replace(/[/\\]/g, '-');
          // Add appropriate extension based on fileType if not already present
          let finalFileName = sanitizedFileName;
          if (fileType && !finalFileName.endsWith(`.${fileType}`)) {
            finalFileName += `.${fileType}`;
          }

          finalPath = path.join(targetDir, finalFileName);
        }

        // Check if file exists and handle overwrite option
        if (fs.existsSync(finalPath) && overwrite !== true) {
          return {
            success: false,
            error: 'File already exists and overwrite option is not enabled',
          };
        }

        // Ensure the directory exists
        const dirPath = path.dirname(finalPath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        // Write the file
        fs.writeFileSync(finalPath, content, 'utf8');

        return {
          success: true,
          filePath: finalPath,
        };
      } catch (error) {
        console.error('Error writing file:', error);
        return {
          success: false,
          error: error.message || 'Unknown error occurred while writing file',
        };
      }
    });

    /*ipcMain.handle('plugins:save-file-dialog', async (event, options) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { pluginId, content, defaultPath, filters, title } = options;

        // Show save dialog
        const result = await dialog.showSaveDialog({
          title: title || 'Save File',
          defaultPath: defaultPath,
          filters: filters || [{ name: 'All Files', extensions: ['*'] }],
          properties: ['createDirectory'],
        });

        if (result.canceled || !result.filePath) {
          return {
            success: false,
            error: 'File save was canceled',
          };
        }

        // Write the file to the user-selected location
        fs.writeFileSync(result.filePath, content, 'utf8');

        return {
          success: true,
          filePath: result.filePath,
        };
      } catch (error) {
        console.error('Error in save file dialog:', error);
        return {
          success: false,
          error: error.message || 'Unknown error occurred while saving file',
        };
      }
    }); */
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
              const pluginId = manifest.id || dir;

              // Set default enabled state if not already set
              if (this.enabledPlugins[pluginId] === undefined) {
                this.enabledPlugins[pluginId] = true; // Enable by default
                this.saveEnabledState();
              }

              return {
                id: pluginId,
                name: manifest.name || dir,
                version: manifest.version || '0.0.0',
                description: manifest.description || '',
                author: manifest.author || 'Unknown',
                enabled: this.enabledPlugins[pluginId],
                icon:
                  manifest.icon ||
                  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.5 12.5C19.5 13.88 18.38 15 17 15C15.62 15 14.5 13.88 14.5 12.5V11H13V12.5C13 13.88 11.88 15 10.5 15C9.12 15 8 13.88 8 12.5C8 11.12 9.12 10 10.5 10C11.88 10 13 11.12 13 12.5V11H14.5V12.5C14.5 11.12 15.62 10 17 10C18.38 10 19.5 11.12 19.5 12.5Z" fill="currentColor"/>
                  <path fill-rule="evenodd" clip-rule="evenodd" d="M4 4C4 2.89543 4.89543 2 6 2H10.5C10.5 3.38071 11.6193 4.5 13 4.5C14.3807 4.5 15.5 3.38071 15.5 2H18C19.1046 2 20 2.89543 20 4V6.5C18.6193 6.5 17.5 7.61929 17.5 9C17.5 10.3807 18.6193 11.5 20 11.5V18C20 19.1046 19.1046 20 18 20H15.5C15.5 18.6193 14.3807 17.5 13 17.5C11.6193 17.5 10.5 18.6193 10.5 20H6C4.89543 20 4 19.1046 4 18V11.5C5.38071 11.5 6.5 10.3807 6.5 9C6.5 7.61929 5.38071 6.5 4 6.5V4ZM6 4V6.5C5.38071 6.5 4.5 7.11929 4.5 7.75V9.25C4.5 9.88071 5.38071 10.5 6 10.5H6.5V11H6C5.38071 11 4.5 11.6193 4.5 12.25V13.75C4.5 14.3807 5.38071 15 6 15H10.5V15.5C10.5 16.1193 11.1193 16.75 11.75 16.75H13.25C13.8807 16.75 14.5 16.1193 14.5 15.5V15H15V15.5C15 16.1193 15.6193 16.75 16.25 16.75H17.75C18.3807 16.75 19 16.1193 19 15.5V15H18C17.3807 15 16.75 14.3807 16.75 13.75V12.25C16.75 11.6193 17.3807 11 18 11H19V10.5H18C17.3807 10.5 16.75 9.88071 16.75 9.25V7.75C16.75 7.11929 17.3807 6.5 18 6.5H19V6H18C17.3807 6 16.75 5.38071 16.75 4.75V3.25C16.75 2.61929 17.3807 2 18 2H15.5V2.5C15.5 3.11929 14.8807 3.75 14.25 3.75H12.75C12.1193 3.75 11.5 3.11929 11.5 2.5V2H10.5V2.5C10.5 3.11929 9.88071 3.75 9.25 3.75H7.75C7.11929 3.75 6.5 3.11929 6.5 2.5V2H6V4Z" fill="currentColor"/>
                </svg>`,
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

  async installPlugin(pluginPath: string): Promise<boolean | string> {
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

      // Check if plugin with same ID already exists
      if (fs.existsSync(destDir)) {
        // Compare manifest version to check if it's the same plugin
        try {
          const existingManifestPath = path.join(destDir, 'manifest.json');
          if (fs.existsSync(existingManifestPath)) {
            const existingManifest = JSON.parse(
              fs.readFileSync(existingManifestPath, 'utf8'),
            );

            // If same plugin ID and version, it's already installed
            if (existingManifest.version === manifest.version) {
              console.log(
                `Plugin ${pluginId} is already installed with the same version`,
              );
              return 'already-installed';
            }
          }
        } catch (err) {
          console.error('Error checking existing plugin:', err);
        }

        // If different version or can't determine, remove existing and continue with installation
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
      console.log(`Unloading plugin ${pluginId}`);

      // 1. Get plugin details before removal
      // const plugin = this.loadedPlugins.get(pluginId);

      // 2. Remove from memory
      this.loadedPlugins.delete(pluginId);

      // 3. Delete from disk
      const pluginDir = path.join(this.pluginsDir, pluginId);
      if (fs.existsSync(pluginDir)) {
        fs.rmSync(pluginDir, { recursive: true });
        console.log(`Deleted plugin directory: ${pluginDir}`);
        return true;
      } else {
        console.log(`Plugin directory not found: ${pluginDir}`);
      }

      // 4. Force a reload of available plugins list
      await this.loadPlugins();

      return true;
    } catch (error) {
      console.error(`Failed to unload plugin ${pluginId}:`, error);
      return false;
    }
  }

  async loadPlugins() {
    try {
      // Log the contents of the plugins directory
      if (fs.existsSync(this.pluginsDir)) {
        const files = fs.readdirSync(this.pluginsDir);
        console.log('Found plugins directory with contents:', files);
      } else {
        console.log('Plugins directory does not exist');
      }

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

  public getEnabledPlugins(): Record<string, boolean> {
    return this.enabledPlugins;
  }
}
