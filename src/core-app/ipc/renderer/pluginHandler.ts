import { contextBridge, ipcRenderer } from 'electron';
import {
    MenuItemRegistration,
    TaskBarItemRegistration,
} from '../../../plugins/schema/types';
// Plugin control functions
contextBridge.exposeInMainWorld('pluginControlBridge', {
  list: () => ipcRenderer.invoke('plugins:list'),
  getCode: (pluginId: string) =>
    ipcRenderer.invoke('plugins:get-code', pluginId),
  install: (pluginPath: string) =>
    ipcRenderer.invoke('plugins:install', pluginPath),
  uninstall: (pluginId: string) =>
    ipcRenderer.invoke('plugins:uninstall', pluginId),
  getMenuItems: (context: any) =>
    ipcRenderer.invoke('plugins:menu-items', context),
  executeMenuItem: (id: any, contextData?: any) =>
    ipcRenderer.invoke('plugins:execute-menu-item', id, contextData),
  loadUnzipped: (pluginDirPath: any) =>
    ipcRenderer.invoke('plugins:loadUnzipped', pluginDirPath),
  extractPlugin: (zipPath: string, extractTo: string) =>
    ipcRenderer.invoke('plugins:extractPlugin', zipPath, extractTo),

  // Safe file operations for plugins
  writeFile: (options: any) => ipcRenderer.invoke('plugins:writeFile', options),

  registerMenuItem: (menuItem: MenuItemRegistration) =>
    ipcRenderer.invoke('plugins:register-menu-item', menuItem),
  unregisterMenuItem: (id: any) =>
    ipcRenderer.invoke('plugins:unregister-menu-item', id),

  getPluginDataPath: (pluginId: string) =>
    ipcRenderer.invoke('plugins:get-data-path', pluginId),
  saveFileDialog: (options: any) =>
    ipcRenderer.invoke('plugins:save-file-dialog', options),
  reload: () => ipcRenderer.invoke('plugins:reload'),
  onReloaded: (callback: () => void) => {
    ipcRenderer.on('plugins:reloaded', callback);
    return () => {
      ipcRenderer.removeListener('plugins:reloaded', callback);
    };
  },
  getEnabledPlugins: () => ipcRenderer.invoke('plugins:getEnabled'),
  setPluginEnabled: (pluginId: string, enabled: boolean) =>
    ipcRenderer.invoke('plugins:setEnabled', pluginId, enabled),
  onPluginStateChanged: (callback: any) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('plugins:stateChanged', subscription);
    return () => {
      ipcRenderer.removeListener('plugins:stateChanged', subscription);
    };
  },
  getPluginLocation: (pluginId: string) =>
    ipcRenderer.invoke('plugins:get-location', pluginId),
  openPluginFolder: (pluginId: string) =>
    ipcRenderer.invoke('plugins:open-folder', pluginId),

  // TaskBar items
  registerTaskBarItem: (item: TaskBarItemRegistration) =>
    ipcRenderer.invoke('plugins:register-taskbar-item', item),

  unregisterTaskBarItem: (id: string) =>
    ipcRenderer.invoke('plugins:unregister-taskbar-item', id),

  getTaskBarItems: () => ipcRenderer.invoke('plugins:taskbar-items'),

  executeTaskBarItem: (id: string, contextData?: any) =>
    ipcRenderer.invoke('plugins:execute-taskbar-item', id, contextData),

  readFile: (filePath: string) =>
    ipcRenderer.invoke('plugin:fs:readFile', { filePath }),

  readFileContents: (options: { filePath: string; pluginId?: string }) =>
    ipcRenderer.invoke('plugin:readFileContents', { options }),

  // Close plugin panel
  closePluginPanel: () => ipcRenderer.invoke('plugins:close-panel'),
});

contextBridge.exposeInMainWorld('pluginFunctionsBridge', {
  convertToDocx: (content: string, title?: string) =>
    ipcRenderer.invoke('convert-to-docx', content, title),
});
