/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { pluginManager } from '../../../plugins/pluginManager';
import { pluginRegistry } from '../../../plugins/registry';
/**
 * Handles the behavior of the base app such as closing, minimizing, maximizing, etc.
 * @param mainWindow - The main window of the base app
 * @returns void
 */
export const pluginHandler = (mainWindow: BrowserWindow) => {
  // Register all PluginManager IPC handlers (plugins:list, plugins:getEnabled, plugins:setEnabled, etc.)
  pluginManager.setupIPC();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ipcMain.on('plugins:stateChanged', (event, { pluginId, enabled }) => {
    // update the registry's knowledge of enabled plugins
    pluginRegistry.updateEnabledStates(pluginManager.getEnabledPlugins());
  });

  // Initial loading of enabled states into the registry
  pluginRegistry.updateEnabledStates(pluginManager.getEnabledPlugins());

  // handler to get plugin menu items
  ipcMain.handle('plugins:menu-items', (event, context) => {
    return pluginRegistry.getMenuItems(context);
  });

  // handler to execute plugin menu items
  ipcMain.handle('plugins:execute-menu-item', (event, id, contextData) => {
    pluginRegistry.executeMenuItemAction(id, contextData);
    return true;
  });

  // handler to register plugin menu items
  ipcMain.handle('plugins:register-menu-item', (event, menuItem) => {
    //console.log('Main process registering menu item:', menuItem);
    return pluginRegistry.registerMenuItem(menuItem);
  });

  // handler to unregister plugin menu items
  ipcMain.handle('plugins:unregister-menu-item', (event, id) => {
    //console.log('Main process unregistering menu item:', id);
    pluginRegistry.unregisterMenuItem(id);
    return true;
  });

  // handler to get plugin data path
  ipcMain.handle('plugins:get-data-path', (event, pluginId) => {
    const pluginDataDir = path.join(
      app.getPath('userData'),
      'plugin-data',
      pluginId,
    );
    // Ensure the directory exists
    if (!fs.existsSync(pluginDataDir)) {
      fs.mkdirSync(pluginDataDir, { recursive: true });
    }
    return pluginDataDir;
  });

  // handler to reload plugins
  ipcMain.handle('plugins:reload', async (event) => {
    // Clear existing registry items before reloading
    pluginRegistry.clearAllRegistrations();

    // Only reload the plugins from disk, don't re-setup IPC handlers
    await pluginManager.loadPlugins();

    // Notify renderer that plugins have been reloaded
    event.sender.send('plugins:reloaded');

    return true;
  });

  // handler to get thumbnail data url
  ipcMain.handle('get-thumbnail-data-url', async (_event, imagePath) => {
    try {
      if (!fs.existsSync(imagePath)) {
        return null;
      }

      // Read the file as a buffer
      const buffer = await fs.promises.readFile(imagePath);

      // Determine MIME type based on file extension
      const ext = path.extname(imagePath).toLowerCase();
      let mimeType = 'image/jpeg'; // Default

      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.webp') mimeType = 'image/webp';

      // Convert to base64 and return as data URL
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch (error) {
      return null;
    }
  });

  // handler to register taskbar items
  ipcMain.handle('plugins:register-taskbar-item', (event, taskBarItem) => {
    //console.log('Main process registering taskbar item:', taskBarItem);
    return pluginRegistry.registerTaskBarItem(taskBarItem);
  });

  // handler to unregister taskbar items
  ipcMain.handle('plugins:unregister-taskbar-item', (_, id) => {
    //console.log('Main process unregistering taskbar item:', id);
    pluginRegistry.unregisterTaskBarItem(id);
    return true;
  });

  // handler to get taskbar items
  ipcMain.handle('plugins:taskbar-items', () => {
    return pluginRegistry.getTaskBarItems();
  });

  // handler to execute taskbar items
  ipcMain.handle('plugins:execute-taskbar-item', (event, id, contextData) => {
    // console.log('Executing taskbar item action:', id, contextData);
    pluginRegistry.executeTaskBarItemAction(id, contextData);
    return true;
  });

  // handler to read file contents
  ipcMain.handle('plugin:fs:readFile', async (event, options) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { filePath, pluginId } = options;

      // Security check: Make sure we're not reading outside allowed directories
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File does not exist' };
      }

      const fileContents = await fs.promises.readFile(filePath, 'utf8');
      return { success: true, data: fileContents };
    } catch (error) {
      console.error('Error reading file:', error);
      return { success: false, error: error.message };
    }
  });

  // handler to read file contents
  ipcMain.handle('plugin:readFileContents', async (event, { options }) => {
    try {
      const { filePath } = options;
      // Security check: Make sure we're not reading outside allowed directories

      // Ensure the requested path is within the plugin's data directory or another safe location
      // Normalize the path to fix double backslashes caused by JSON.stringify/parse
      let adjustedPath;
      if (typeof filePath === 'string') {
        // Replace any escaped backslashes (\\) with single backslashes (\)
        adjustedPath = filePath.replace(/\\\\/g, '\\');
      }

      const normalizedPath = path.normalize(adjustedPath);
      const resolvedPath = path.resolve(normalizedPath);

      if (!fs.existsSync(resolvedPath)) {
        // console.log('file doesnt exist');
        return { success: false, error: 'File does not exist' };
      }
      // console.log('path given to read:', resolvedPath);

      const fileContents = await fs.promises.readFile(resolvedPath, 'utf8');
      return { success: true, data: fileContents };
    } catch (error) {
      console.error('Error reading file contents:', error);
      return { success: false, error: error.message };
    }
  });

  // Handle closing the plugin panel
  ipcMain.handle('plugins:close-panel', async () => {
    try {
      // Send an event to the renderer to close the panel
      mainWindow.webContents.send('plugin:close-panel');
      return { success: true };
    } catch (error) {
      console.error('Error closing plugin panel:', error);
      return { success: false, error: error.message };
    }
  });
};
